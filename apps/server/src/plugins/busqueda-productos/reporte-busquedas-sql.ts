/**
 * Consultas del reporte de lo que buscan los clientes (tabla `search_log`). Las usan el comando
 * `npm run search:terms` y la pantalla del Dashboard (consulta `reporteBusquedas`), así que los
 * números son los mismos en los dos. Recibe cómo ejecutar SQL para no depender de Vendure.
 */
export type EjecutarSql = (sql: string, params: unknown[]) => Promise<any[]>;

export interface BusquedaFrecuente {
    /** La forma en que más la escribieron (el término se agrupa sin acentos ni mayúsculas). */
    busqueda: string;
    veces: number;
    visitantes: number;
    /** Promedio de productos que dio. */
    resultados: number;
}

export interface BusquedaPorTipo {
    /** "visitante (sin sesión)", "menudeo", "mayoreo1"… */
    tipo: string;
    busquedas: number;
    sinResultados: number;
}

export interface ReporteBusquedas {
    dias: number;
    total: number;
    visitantes: number;
    clientes: number;
    sinResultados: number;
    masBuscado: BusquedaFrecuente[];
    sinEncontrar: BusquedaFrecuente[];
    porTipoDeCliente: BusquedaPorTipo[];
}

const DESDE = `"createdAt" > now() - make_interval(days => $1::int)`;

export async function consultarReporteBusquedas(
    ejecutar: EjecutarSql,
    dias: number,
    limite: number,
): Promise<ReporteBusquedas> {
    const lista = (soloSinResultados: boolean): Promise<BusquedaFrecuente[]> =>
        ejecutar(
            `SELECT mode() WITHIN GROUP (ORDER BY "term") AS busqueda,
                    count(*)::int AS veces,
                    count(DISTINCT "visitorId")::int AS visitantes,
                    round(avg("resultCount"))::int AS resultados
             FROM "search_log"
             WHERE ${DESDE} ${soloSinResultados ? 'AND "resultCount" = 0' : ''}
             GROUP BY "termNormalized"
             ORDER BY veces DESC, visitantes DESC, busqueda
             LIMIT $2::int`,
            [dias, limite],
        );

    const [[resumen], masBuscado, sinEncontrar, porTipoDeCliente] = await Promise.all([
        ejecutar(
            `SELECT count(*)::int AS total,
                    count(DISTINCT "visitorId")::int AS visitantes,
                    count(DISTINCT "customerId")::int AS clientes,
                    count(*) FILTER (WHERE "resultCount" = 0)::int AS "sinResultados"
             FROM "search_log" WHERE ${DESDE}`,
            [dias],
        ),
        lista(false),
        lista(true),
        ejecutar(
            `SELECT CASE WHEN l."customerId" IS NULL THEN 'visitante (sin sesión)'
                         ELSE coalesce(c."customFieldsListaprecios", 'menudeo') END AS tipo,
                    count(*)::int AS busquedas,
                    count(*) FILTER (WHERE l."resultCount" = 0)::int AS "sinResultados"
             FROM "search_log" l LEFT JOIN "customer" c ON c.id = l."customerId"
             WHERE l."createdAt" > now() - make_interval(days => $1::int)
             GROUP BY 1 ORDER BY busquedas DESC`,
            [dias],
        ),
    ]);

    return { dias, ...resumen, masBuscado, sinEncontrar, porTipoDeCliente };
}
