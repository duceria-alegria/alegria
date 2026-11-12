import { PluginCommonModule, ScheduledTask, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';
import { BUSQUEDA_OPTIONS, BusquedaProductosOptions, verBusquedasClientes } from './constants';
import { ProductSearchDocument } from './product-search-document.entity';
import { ProductSearchDocumentService } from './product-search-document.service';
import { SearchLog } from './search-log.entity';
import { SearchResultAssetsResolver } from './search-result-assets.resolver';
import { SearchLogAdminResolver } from './search-log-admin.resolver';
import { SearchLogResolver } from './search-log.resolver';
import { SearchLogService } from './search-log.service';

const shopApiSchema = gql`
    input RegistrarBusquedaInput {
        term: String!
        resultCount: Int!
        visitorId: String!
    }

    extend type SearchResult {
        "Fotos del producto en su orden (la principal primero), para el carrusel de la tarjeta."
        productAssets: [SearchResultAsset!]!
    }

    extend type Mutation {
        "Registra una búsqueda ya asentada. Solo la tienda puede llamarla: exige el secreto compartido."
        registrarBusqueda(input: RegistrarBusquedaInput!): Boolean!
    }
`;

const adminApiSchema = gql`
    type BusquedaFrecuente {
        "La forma en que más la escribieron (se agrupa sin acentos ni mayúsculas)."
        busqueda: String!
        veces: Int!
        "Visitantes distintos que la hicieron."
        visitantes: Int!
        "Promedio de productos que dio."
        resultados: Int!
    }

    type BusquedaPorTipo {
        "visitante (sin sesión), menudeo, mayoreo1…"
        tipo: String!
        busquedas: Int!
        sinResultados: Int!
    }

    type ReporteBusquedas {
        dias: Int!
        total: Int!
        visitantes: Int!
        "Clientes distintos con sesión iniciada."
        clientes: Int!
        sinResultados: Int!
        masBuscado: [BusquedaFrecuente!]!
        "Búsquedas que no dieron ningún producto: lo que los clientes no encuentran."
        sinEncontrar: [BusquedaFrecuente!]!
        porTipoDeCliente: [BusquedaPorTipo!]!
    }

    extend type Query {
        "Lo que buscan los clientes en los últimos días (solo agregados). Requiere el permiso VerBusquedasClientes."
        reporteBusquedas(dias: Int, limite: Int): ReporteBusquedas!
    }
`;

/** Borra cada madrugada las búsquedas registradas más viejas que el plazo de retención. */
const limpiarBusquedasTask = new ScheduledTask({
    id: 'limpiar-registro-busquedas',
    description: 'Borra las búsquedas de clientes registradas hace más del plazo de retención',
    schedule: cron => cron.everyDayAt(3, 30),
    async execute({ injector }) {
        const deleted = await injector.get(SearchLogService).purge();
        return { result: `Se borraron ${deleted} búsquedas antiguas` };
    },
});

/**
 * Búsqueda de productos en español: ignora acentos, tolera errores de dedo y plurales, encuentra lo
 * que se escribe distinto pero suena igual ("lukas" → "lucas"), entiende sinónimos y ordena por
 * relevancia. Este plugin mantiene la tabla `product_search_document`
 * (el índice); la consulta la hace `BusquedaProductosStrategy`, que se pasa a
 * `DefaultSearchPlugin.init({ searchStrategy })` en `vendure-config.ts`. La Shop API de búsqueda no
 * cambia.
 *
 * El índice se actualiza solo con los eventos del catálogo y se repara al arrancar el servidor.
 * Tras editar los sinónimos o las reglas de texto, sube `SEARCH_TEXT_VERSION` (search-text.ts): el
 * servidor reconstruye solo los documentos de otra versión al arrancar. `pnpm --filter server
 * search:reindex` fuerza la reconstrucción completa en desarrollo.
 *
 * También registra lo que buscan los clientes (`search_log`, mutación `registrarBusqueda`) para
 * saber qué no se encuentra. Ver `search-log.service.ts`.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [ProductSearchDocument, SearchLog],
    providers: [
        ProductSearchDocumentService,
        SearchLogService,
        { provide: BUSQUEDA_OPTIONS, useFactory: () => BusquedaProductosPlugin.options },
    ],
    shopApiExtensions: { schema: shopApiSchema, resolvers: [SearchLogResolver, SearchResultAssetsResolver] },
    adminApiExtensions: { schema: adminApiSchema, resolvers: [SearchLogAdminResolver] },
    configuration: config => {
        config.schedulerOptions.tasks = [...(config.schedulerOptions.tasks ?? []), limpiarBusquedasTask];
        config.authOptions.customPermissions = [...(config.authOptions.customPermissions ?? []), verBusquedasClientes];
        return config;
    },
    dashboard: './dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class BusquedaProductosPlugin {
    static options: BusquedaProductosOptions = {};

    static init(options: BusquedaProductosOptions) {
        this.options = options;
        return this;
    }
}
