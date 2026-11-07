/**
 * Reporte de lo que buscan los clientes (tabla `search_log`): lo más buscado y, sobre todo, lo que
 * NO encuentran (búsquedas con 0 resultados). Solo lee de la base; no arranca Vendure.
 *
 * Uso (desde apps/server; toma la base del .env):
 *   npm run search:terms                       últimos 30 días, 20 por lista
 *   npm run search:terms -- --days 7 --limit 50
 *
 * Lo que no se encuentra sirve para: agregar sinónimos (`search-text.ts`), corregir nombres de
 * productos, o ver qué productos faltan en el catálogo. Cada caso nuevo va también a
 * `consultas-de-oro.ts` con lo que el cliente esperaba encontrar.
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { consultarReporteBusquedas } from './plugins/busqueda-productos/reporte-busquedas-sql';

const args = process.argv.slice(2);
const numberArg = (name: string, fallback: number) => {
    const value = Number(args[args.indexOf(name) + 1]);
    return args.includes(name) && Number.isInteger(value) && value > 0 ? value : fallback;
};
const days = numberArg('--days', 30);
const limit = numberArg('--limit', 20);

type Fila = object;

const valor = (fila: Fila, clave: string) => (fila as Record<string, unknown>)[clave] ?? '';

function tabla(titulo: string, columnas: Array<[clave: string, encabezado: string]>, filas: Fila[]) {
    console.log(`\n${titulo}`);
    if (filas.length === 0) {
        console.log('  (nada todavía)');
        return;
    }
    const anchos = columnas.map(([clave, encabezado]) =>
        Math.max(encabezado.length, ...filas.map(fila => String(valor(fila, clave)).length)),
    );
    const linea = (celdas: string[]) => '  ' + celdas.map((celda, i) => (i === celdas.length - 1 ? celda : celda.padEnd(anchos[i]))).join('  ');
    console.log(linea(columnas.map(([, encabezado]) => encabezado)));
    filas.forEach(fila => console.log(linea(columnas.map(([clave]) => String(valor(fila, clave))))));
}

async function main() {
    const db = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        schema: process.env.DB_SCHEMA,
    });
    await db.initialize();
    try {
        const r = await consultarReporteBusquedas((sql, params) => db.query(sql, params), days, limit);
        console.log(`Búsquedas de los últimos ${days} días`);
        if (r.total === 0) {
            console.log('  Todavía no hay búsquedas registradas en ese periodo.');
            return;
        }
        const porcentaje = Math.round((r.sinResultados * 100) / r.total);
        console.log(
            `  ${r.total} búsquedas de ${r.visitantes} visitantes distintos (${r.clientes} clientes con sesión); ` +
                `${r.sinResultados} sin resultados (${porcentaje}%)`,
        );
        const frecuentes: Array<[string, string]> = [['veces', 'veces'], ['visitantes', 'visitantes']];
        tabla('Lo más buscado', [...frecuentes, ['resultados', 'resultados (prom.)'], ['busqueda', 'búsqueda']], r.masBuscado);
        tabla('Lo que NO encuentran (0 resultados)', [...frecuentes, ['busqueda', 'búsqueda']], r.sinEncontrar);
        tabla('Por tipo de cliente', [['tipo', 'tipo'], ['busquedas', 'búsquedas'], ['sinResultados', 'sin resultados']], r.porTipoDeCliente);
    } finally {
        await db.destroy();
    }
}

main().catch(error => {
    console.error(`No se pudo leer el registro de búsquedas: ${String(error instanceof Error ? error.message : error)}`);
    process.exitCode = 1;
});
