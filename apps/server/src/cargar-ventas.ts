/**
 * Carga lo vendido de cada producto (campo `ventas`) a partir del reporte "Mejores artículos" del
 * punto de venta (.xlsx). La tienda ordena por ese número en "Más vendidos", que es el orden por
 * defecto del catálogo.
 *
 * Empata por nombre del artículo (el mismo que usa `importar-productos.ts`, sin importar mayúsculas
 * ni espacios repetidos). Los productos que no aparecen en el reporte quedan en 0, así que volver a
 * correr con un reporte nuevo deja todo al día (también pisa lo que se haya ajustado a mano).
 *
 * Es un UPDATE directo, sin eventos de Vendure: no hace falta reindexar ni apagar el servidor, el
 * orden se lee de la tabla `product` en cada búsqueda.
 *
 * Uso (desde apps/server):  npx ts-node src/cargar-ventas.ts <PRODUCTOS.xlsx> [--simular]
 * En producción (sin ts-node):  node dist/cargar-ventas.js <PRODUCTOS.xlsx>
 */
import { runMigrations } from '@vendure/core';
import { readFileSync } from 'fs';
import { DataSource } from 'typeorm';
import { COLUMNA_VENTAS } from './plugins/busqueda-productos/constants';
import { leerVentasXlsx, normalizarNombre, ventasPorNombre } from './plugins/busqueda-productos/ventas-xlsx';
import { config } from './vendure-config';

const pesos = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

async function main() {
    const [archivo, ...banderas] = process.argv.slice(2);
    if (!archivo) throw new Error('Uso: npx ts-node src/cargar-ventas.ts <PRODUCTOS.xlsx> [--simular]');
    const simular = banderas.includes('--simular');

    const filas = leerVentasXlsx(readFileSync(archivo));
    const ventas = ventasPorNombre(filas);
    console.log(`Reporte: ${filas.length} filas, ${ventas.size} artículos distintos, ${pesos([...ventas.values()].reduce((a, b) => a + b, 0))} vendidos.`);

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
        const productos: Array<{ id: number; nombre: string }> = await conexion.query(
            `SELECT p.id, t.name AS nombre FROM product p
             JOIN product_translation t ON t."baseId" = p.id AND t."languageCode" = 'es'
             WHERE p."deletedAt" IS NULL`,
        );
        const ids: number[] = [];
        const montos: number[] = [];
        const sinVentas: string[] = [];
        const usados = new Set<string>();
        for (const { id, nombre } of productos) {
            const clave = normalizarNombre(nombre);
            const monto = ventas.get(clave);
            if (monto === undefined) sinVentas.push(nombre);
            else usados.add(clave);
            ids.push(id);
            montos.push(monto ?? 0);
        }
        console.log(`Catálogo: ${productos.length} productos; ${productos.length - sinVentas.length} con ventas en el reporte, ${sinVentas.length} sin ventas (quedan en 0).`);

        const fueraDelCatalogo = [...ventas].filter(([nombre]) => !usados.has(nombre)).sort((a, b) => b[1] - a[1]);
        if (fueraDelCatalogo.length) {
            console.log(`Del reporte, ${fueraDelCatalogo.length} artículos no están en el catálogo (los de más venta):`);
            for (const [nombre, venta] of fueraDelCatalogo.slice(0, 10)) console.log(`  ${pesos(venta).padStart(14)}  ${nombre}`);
        }
        if (sinVentas.length) {
            console.log('Del catálogo sin coincidencia en el reporte (primeros 10):');
            for (const nombre of sinVentas.slice(0, 10)) console.log(`  ${nombre}`);
        }

        if (simular) {
            console.log('--simular: no se escribió nada.');
            return;
        }
        // El resultado de UPDATE en TypeORM/pg es [filas, cantidad].
        const [, actualizados] = await conexion.query(
            `UPDATE product SET "${COLUMNA_VENTAS}" = d.monto
             FROM unnest($1::int[], $2::float8[]) AS d(id, monto) WHERE product.id = d.id`,
            [ids, montos],
        );
        console.log(`Listo: ${actualizados} productos actualizados.`);
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
