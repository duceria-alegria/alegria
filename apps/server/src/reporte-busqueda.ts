/**
 * Corre las consultas de oro de la búsqueda (`plugins/busqueda-productos/consultas-de-oro.ts`)
 * contra el Shop API y dice cuáles cumplen lo esperado. Solo hace búsquedas (lectura): no arranca
 * Vendure ni toca datos, así que se puede apuntar a otro ambiente con `--url`.
 *
 * Uso (desde apps/server, con el servidor corriendo):
 *   npm run search:golden
 *   npm run search:golden -- --verbose           muestra los primeros resultados de cada consulta
 *   npm run search:golden -- --only skit         solo las que contengan ese texto
 *   npm run search:golden -- --url https://tienda.example.com/shop-api
 *
 * Termina con código 1 si alguna consulta falla (sirve para usarlo en CI).
 */
import { CONSULTAS_DE_ORO } from './plugins/busqueda-productos/consultas-de-oro';
import { estadoDeConsulta } from './plugins/busqueda-productos/evaluar-consulta';

const args = process.argv.slice(2);
const valueOf = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
};
const url = valueOf('--url') ?? process.env.SHOP_API_URL ?? 'http://localhost:3001/shop-api';
const verbose = args.includes('--verbose') || args.includes('-v');
const only = valueOf('--only')?.toLowerCase();

const color = (code: number, text: string) => (process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text);
const green = (text: string) => color(32, text);
const red = (text: string) => color(31, text);
const yellow = (text: string) => color(33, text);
const dim = (text: string) => color(2, text);

const SEARCH_QUERY = `query($term: String, $take: Int) {
    search(input: { term: $term, groupByProduct: true, take: $take }) { totalItems items { productName } }
}`;

async function buscar(q: string, lang: string) {
    const response = await fetch(`${url}?languageCode=${lang}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: SEARCH_QUERY, variables: { term: q, take: 100 } }),
    });
    const body = (await response.json()) as {
        data?: { search: { totalItems: number; items: Array<{ productName: string }> } };
        errors?: Array<{ message: string }>;
    };
    if (!body.data) {
        throw new Error(body.errors?.[0]?.message ?? `respuesta inesperada (HTTP ${response.status})`);
    }
    return { total: body.data.search.totalItems, nombres: body.data.search.items.map(item => item.productName) };
}

async function main() {
    const consultas = CONSULTAS_DE_ORO.filter(
        c => !only || [c.q, c.label, c.grupo].some(text => text.toLowerCase().includes(only)),
    );
    if (consultas.length === 0) {
        console.log(`Ninguna consulta coincide con "${only}".`);
        return;
    }

    let fallidas = 0;
    let pendientes = 0;
    let grupoActual = '';
    const tiempos: Array<{ q: string; ms: number }> = [];
    for (const consulta of consultas) {
        if (consulta.grupo !== grupoActual) {
            grupoActual = consulta.grupo;
            console.log(`\n${grupoActual}`);
        }
        const inicio = Date.now();
        const resultado = await buscar(consulta.q, consulta.lang ?? 'es');
        const ms = Date.now() - inicio;
        tiempos.push({ q: consulta.q, ms });
        const { estado, fallas } = estadoDeConsulta(consulta, resultado);
        const idioma = consulta.lang ? ` [${consulta.lang}]` : '';
        const resumen = `${consulta.label}  ${dim(`"${consulta.q}"${idioma} → ${resultado.total} · ${ms} ms`)}`;
        const marca = { ok: green('✔'), falla: red('✘'), pendiente: yellow('~'), resuelta: red('!') }[estado];
        console.log(`  ${marca} ${resumen}`);
        if (estado === 'falla') {
            fallidas++;
            fallas.forEach(falla => console.log(`      ${red(falla)}`));
        } else if (estado === 'pendiente') {
            pendientes++;
            console.log(`      ${yellow(`límite conocido: ${consulta.pendiente}`)}`);
        } else if (estado === 'resuelta') {
            fallidas++;
            console.log(`      ${red('ya cumple lo esperado: quítale `pendiente` en consultas-de-oro.ts')}`);
        }
        if (verbose || estado === 'falla' || estado === 'pendiente') {
            resultado.nombres.slice(0, 5).forEach((nombre, i) => console.log(dim(`      ${i + 1}. ${nombre}`)));
        }
    }

    const lenta = tiempos.reduce((a, b) => (b.ms > a.ms ? b : a));
    const cumplen = consultas.length - fallidas - pendientes;
    console.log(
        `\n${fallidas === 0 ? green('Todo bien') : red('Hay fallas')}: ${cumplen}/${consultas.length} consultas cumplen lo esperado` +
            (pendientes > 0 ? `, ${pendientes} límites conocidos` : '') +
            dim(` (la más lenta: "${lenta.q}", ${lenta.ms} ms)`),
    );
    if (fallidas > 0) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    // `fetch failed` esconde el motivo real (p. ej. ECONNREFUSED) en `cause`.
    const cause = (error as { cause?: unknown }).cause;
    const causa = cause ? ` (${String(cause)})` : '';
    console.error(`No se pudo consultar ${url}: ${String(error instanceof Error ? error.message : error)}${causa}`);
    console.error('¿Está corriendo el servidor? (npm run dev:server)');
    process.exitCode = 1;
});
