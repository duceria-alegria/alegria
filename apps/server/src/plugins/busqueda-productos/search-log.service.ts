import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ID, Logger, ProcessContext, TransactionalConnection } from '@vendure/core';
import { BUSQUEDA_OPTIONS, BusquedaProductosOptions, DEFAULT_SEARCH_LOG_RETENTION_DAYS } from './constants';
import { esVisitorIdValido, prepararBusqueda, secretoCoincide } from './registro-busquedas';
import { consultarReporteBusquedas, ReporteBusquedas } from './reporte-busquedas-sql';

const LOGGER_CTX = 'BusquedaProductos';
/** La misma búsqueda del mismo visitante dentro de este plazo cuenta una sola vez. */
const DEDUPE_SECONDS = 30;
/** Tope de búsquedas registradas por visitante en un minuto (un humano no llega ni cerca). */
const MAX_PER_MINUTE = 30;
const MAX_RESULT_COUNT = 1_000_000;

export interface RegistrarBusquedaInput {
    term: string;
    resultCount: number;
    visitorId: string;
    languageCode: string;
    customerId?: ID | null;
}

@Injectable()
export class SearchLogService implements OnApplicationBootstrap {
    constructor(
        private readonly connection: TransactionalConnection,
        private readonly processContext: ProcessContext,
        @Inject(BUSQUEDA_OPTIONS) private readonly options: BusquedaProductosOptions,
    ) {}

    onApplicationBootstrap() {
        if (this.processContext.isServer && !this.options.searchLogSecret) {
            Logger.warn(
                'SEARCH_LOG_SECRET no está definido: no se registrarán las búsquedas de los clientes.',
                LOGGER_CTX,
            );
        }
    }

    get retentionDays(): number {
        return this.options.searchLogRetentionDays ?? DEFAULT_SEARCH_LOG_RETENTION_DAYS;
    }

    /** Quien llama (la tienda) debe mandar el secreto compartido; sin secreto configurado, nadie. */
    isAuthorized(receivedKey: unknown): boolean {
        return secretoCoincide(this.options.searchLogSecret, receivedKey);
    }

    /** Devuelve true si se guardó; false si se descartó (dato dudoso, repetida o demasiadas). */
    async record(input: RegistrarBusquedaInput): Promise<boolean> {
        const search = prepararBusqueda(input.term);
        if (!search || !esVisitorIdValido(input.visitorId)) {
            return false;
        }
        const resultCount = Math.min(Math.max(Math.trunc(input.resultCount) || 0, 0), MAX_RESULT_COUNT);
        // Un solo SQL: inserta solo si no es repetida y el visitante no pasó del tope por minuto.
        const rows: Array<{ id: number }> = await this.connection.rawConnection.query(
            `INSERT INTO "search_log" ("term", "termNormalized", "languageCode", "resultCount", "visitorId", "customerId")
             SELECT $1::varchar, $2::varchar, $3::varchar, $4::int, $5::varchar, $6::int
             WHERE NOT EXISTS (
                     SELECT 1 FROM "search_log"
                     WHERE "visitorId" = $5 AND "termNormalized" = $2
                       AND "createdAt" > now() - make_interval(secs => $7::int))
               AND (SELECT count(*) FROM "search_log"
                    WHERE "visitorId" = $5 AND "createdAt" > now() - interval '1 minute') < $8::int
             RETURNING "id"`,
            [
                search.term,
                search.termNormalized,
                input.languageCode.slice(0, 10),
                resultCount,
                input.visitorId,
                input.customerId == null ? null : Number(input.customerId),
                DEDUPE_SECONDS,
                MAX_PER_MINUTE,
            ],
        );
        return rows.length > 0;
    }

    /** Lo que buscan los clientes en los últimos `dias` (solo agregados: no devuelve quién buscó qué). */
    report(dias = 30, limite = 20): Promise<ReporteBusquedas> {
        return consultarReporteBusquedas(
            (sql, params) => this.connection.rawConnection.query(sql, params),
            Math.min(Math.max(Math.trunc(dias) || 30, 1), 3650),
            Math.min(Math.max(Math.trunc(limite) || 20, 1), 200),
        );
    }

    /** Borra lo anterior al plazo de retención. Devuelve cuántas búsquedas borró. */
    async purge(): Promise<number> {
        const [, deleted]: [unknown, number] = await this.connection.rawConnection.query(
            `DELETE FROM "search_log" WHERE "createdAt" < now() - make_interval(days => $1::int)`,
            [this.retentionDays],
        );
        return deleted;
    }
}
