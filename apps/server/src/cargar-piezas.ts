/**
 * Carga cuántas piezas trae cada paquete (campo `piezasPorPaquete` de la variante) desde un JSON
 * `[{ "sku": "…", "piezas": 40 }, …]`. Con ese dato la tienda muestra el precio por pieza; los
 * productos que no vienen en el archivo se quedan como están (sin precio por pieza si estaban vacíos).
 *
 * Empata por SKU (el mismo que usa `importar-productos.ts`). Es un UPDATE directo, sin eventos de
 * Vendure: no hace falta reindexar ni apagar el servidor. Volver a correrlo con un archivo nuevo
 * actualiza lo que cambió y no borra nada.
 *
 * Uso (desde apps/server):  npx ts-node src/cargar-piezas.ts <archivo.json> [--simular]
 * En producción (sin ts-node):  node dist/cargar-piezas.js <archivo.json>
 */
import { runMigrations } from '@vendure/core';
import { readFileSync } from 'fs';
import { DataSource } from 'typeorm';
import { config } from './vendure-config';

const COLUMNA = 'customFieldsPiezasporpaquete';

interface Entrada {
    sku: string;
    piezas: number;
}

async function main() {
    const [archivo, ...banderas] = process.argv.slice(2);
    if (!archivo) throw new Error('Uso: npx ts-node src/cargar-piezas.ts <archivo.json> [--simular]');
    const simular = banderas.includes('--simular');

    const crudo = JSON.parse(readFileSync(archivo, 'utf8'));
    const entradas: Entrada[] = Array.isArray(crudo) ? crudo : crudo.seguros;
    const invalidas = entradas.filter(e => !e.sku || !Number.isInteger(e.piezas) || e.piezas < 1);
    if (invalidas.length) throw new Error(`${invalidas.length} filas sin SKU o con piezas inválidas (la primera: ${JSON.stringify(invalidas[0])}); no se cargó nada.`);
    if (new Set(entradas.map(e => e.sku)).size !== entradas.length) throw new Error('Hay SKU repetidos en el archivo; no se cargó nada.');
    console.log(`Archivo: ${entradas.length} productos con piezas.`);

    await runMigrations(config);
    const db = config.dbConnectionOptions as { host: string; port: number; username: string; password: string; database: string; schema?: string };
    const conexion = new DataSource({
        type: 'postgres',
        host: db.host,
        port: db.port,
        username: db.username,
        password: db.password,
        database: db.database,
        schema: db.schema,
    });
    await conexion.initialize();
    try {
        const skus = entradas.map(e => e.sku);
        const existentes: Array<{ sku: string }> = await conexion.query(
            `SELECT sku FROM product_variant WHERE "deletedAt" IS NULL AND sku = ANY($1::text[])`,
            [skus],
        );
        const enCatalogo = new Set(existentes.map(e => e.sku));
        const faltan = skus.filter(sku => !enCatalogo.has(sku));
        console.log(`En el catálogo: ${enCatalogo.size}; sin coincidencia: ${faltan.length}${faltan.length ? ` (primeros: ${faltan.slice(0, 5).join(', ')})` : ''}.`);
        if (simular) {
            console.log('--simular: no se escribió nada.');
            return;
        }
        // El resultado de UPDATE en TypeORM/pg es [filas, cantidad].
        const [, actualizadas] = await conexion.query(
            `UPDATE product_variant SET "${COLUMNA}" = d.piezas
             FROM unnest($1::text[], $2::int[]) AS d(sku, piezas)
             WHERE product_variant.sku = d.sku AND product_variant."deletedAt" IS NULL`,
            [skus, entradas.map(e => e.piezas)],
        );
        console.log(`Listo: ${actualizadas} variantes actualizadas.`);
    } finally {
        await conexion.destroy();
    }
}

main().then(
    () => process.exit(0),
    error => {
        console.error(error);
        process.exit(1);
    },
);
