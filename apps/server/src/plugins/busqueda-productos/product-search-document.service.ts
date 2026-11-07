import { Injectable, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import {
    CollectionEvent,
    CollectionModificationEvent,
    ConfigService,
    EventBus,
    FacetValueEvent,
    ID,
    Logger,
    ProcessContext,
    ProductEvent,
    ProductVariantEvent,
    TransactionalConnection,
} from '@vendure/core';
import { buildSearchDocument, SEARCH_TEXT_VERSION } from './search-text';

const LOGGER_CTX = 'BusquedaProductos';
const BATCH_SIZE = 100;
/** Espera para agrupar eventos seguidos (p. ej. al importar o sembrar muchos productos). */
const DEBOUNCE_MS = 250;

interface NameRow { productId: number; languageCode: string; name: string; description: string | null }
interface SkuRow { productId: number; sku: string }
/** Nombre traducido de un facet value o colección (`entityId`) que pertenece al producto. */
interface TextRow { productId: number; entityId: number; languageCode: string; name: string }
interface DocumentRow {
    productId: number;
    languageCode: string;
    nameNormalized: string;
    skusNormalized: string;
    documentNormalized: string;
    documentPhonetic: string;
}

/**
 * Mantiene `product_search_document`: un documento normalizado por producto e idioma que la
 * estrategia de búsqueda consulta. Se actualiza con los eventos del catálogo (producto, variante,
 * colección y facet) y se autorrepara al arrancar el servidor, así que normalmente no hay que
 * hacer nada. `reindexAll` reconstruye todo (ver `src/reindex-busqueda.ts`).
 */
@Injectable()
export class ProductSearchDocumentService implements OnModuleInit, OnApplicationBootstrap {
    private pending = new Set<number>();
    private timer?: ReturnType<typeof setTimeout>;
    private queue: Promise<void> = Promise.resolve();

    constructor(
        private readonly connection: TransactionalConnection,
        private readonly eventBus: EventBus,
        private readonly processContext: ProcessContext,
        private readonly configService: ConfigService,
    ) {}

    onModuleInit() {
        this.eventBus.ofType(ProductEvent).subscribe(event => this.enqueue([event.entity.id]));
        this.eventBus
            .ofType(ProductVariantEvent)
            .subscribe(event => this.enqueue(event.entity.map(variant => variant.productId)));
        this.eventBus
            .ofType(CollectionModificationEvent)
            .subscribe(event => this.enqueueFrom(() => this.productIdsOfVariants(event.productVariantIds)));
        this.eventBus
            .ofType(CollectionEvent)
            .subscribe(event => this.enqueueFrom(() => this.productIdsOfCollection(event.entity.id)));
        this.eventBus
            .ofType(FacetValueEvent)
            .subscribe(event => this.enqueueFrom(() => this.productIdsOfFacetValue(event.entity.id)));
    }

    /** Repara lo que falte (producto o idioma sin documento, documentos huérfanos) en cada arranque. */
    async onApplicationBootstrap() {
        if (!this.processContext.isServer) {
            return;
        }
        try {
            const repaired = await this.syncMissing();
            if (repaired > 0) {
                Logger.info(`Se indexaron ${repaired} productos que no tenían documento de búsqueda`, LOGGER_CTX);
            }
        } catch (error) {
            Logger.error(`No se pudo comprobar el índice de búsqueda: ${String(error)}`, LOGGER_CTX);
        }
    }

    /** Reconstruye el documento de cada producto dado (y borra el de los que ya no existen). */
    async syncProducts(productIds: ID[]): Promise<void> {
        const ids = [...new Set(productIds.map(Number))].filter(Number.isFinite);
        for (let start = 0; start < ids.length; start += BATCH_SIZE) {
            const batch = ids.slice(start, start + BATCH_SIZE);
            const documents = await this.buildDocuments(batch);
            await this.connection.rawConnection.transaction(async manager => {
                const keys = documents.map(doc => `${doc.productId}:${doc.languageCode}`);
                // Lo que ya no corresponde: productos eliminados e idiomas que perdieron su traducción.
                await manager.query(
                    `DELETE FROM "product_search_document"
                     WHERE "productId" = ANY($1) AND ("productId"::text || ':' || "languageCode") <> ALL($2)`,
                    [batch, keys],
                );
                if (documents.length === 0) {
                    return;
                }
                await manager.query(
                    `INSERT INTO "product_search_document"
                         ("productId", "languageCode", "nameNormalized", "skusNormalized", "documentNormalized", "documentPhonetic", "textVersion")
                     SELECT u.*, $7::int FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[]) AS u
                     ON CONFLICT ("productId", "languageCode") DO UPDATE SET
                         "nameNormalized" = EXCLUDED."nameNormalized",
                         "skusNormalized" = EXCLUDED."skusNormalized",
                         "documentNormalized" = EXCLUDED."documentNormalized",
                         "documentPhonetic" = EXCLUDED."documentPhonetic",
                         "textVersion" = EXCLUDED."textVersion",
                         "updatedAt" = now()`,
                    [
                        documents.map(doc => doc.productId),
                        documents.map(doc => doc.languageCode),
                        documents.map(doc => doc.nameNormalized),
                        documents.map(doc => doc.skusNormalized),
                        documents.map(doc => doc.documentNormalized),
                        documents.map(doc => doc.documentPhonetic),
                        SEARCH_TEXT_VERSION,
                    ],
                );
            });
        }
    }

    /** Reconstruye todo el índice. Devuelve cuántos productos procesó. */
    async reindexAll(): Promise<number> {
        const rows: Array<{ id: number }> = await this.connection.rawConnection.query(
            `SELECT id FROM "product" WHERE "deletedAt" IS NULL`,
        );
        await this.syncProducts(rows.map(row => row.id));
        await this.deleteOrphans();
        return rows.length;
    }

    /**
     * Indexa los productos a los que les falta el documento de algún idioma de la tienda, o cuyos
     * documentos se generaron con otra versión de las reglas de texto (`SEARCH_TEXT_VERSION`): así un
     * cambio de sinónimos o de fonética se aplica solo en el siguiente arranque, también en producción.
     */
    async syncMissing(): Promise<number> {
        const languages = await this.searchLanguages();
        const rows: Array<{ id: number }> = await this.connection.rawConnection.query(
            `SELECT p.id FROM "product" p
             WHERE p."deletedAt" IS NULL
               AND ((SELECT count(*) FROM "product_search_document" d
                     WHERE d."productId" = p.id AND d."languageCode" = ANY($1)) < $2
                    OR EXISTS (SELECT 1 FROM "product_search_document" d
                               WHERE d."productId" = p.id AND d."textVersion" <> $3::int))`,
            [languages, languages.length, SEARCH_TEXT_VERSION],
        );
        await this.syncProducts(rows.map(row => row.id));
        await this.deleteOrphans();
        return rows.length;
    }

    private async deleteOrphans() {
        await this.connection.rawConnection.query(
            `DELETE FROM "product_search_document" d
             WHERE NOT EXISTS (SELECT 1 FROM "product" p WHERE p.id = d."productId" AND p."deletedAt" IS NULL)`,
        );
    }

    /**
     * Los idiomas que indexa DefaultSearchPlugin: los de todos los canales más el idioma por
     * defecto de la configuración. Hay un documento por producto en cada uno, porque la consulta
     * se une al índice de Vendure por idioma (si faltara, el producto no saldría al buscar).
     */
    private async searchLanguages(): Promise<string[]> {
        const rows: Array<{ availableLanguageCodes: string }> = await this.connection.rawConnection.query(
            `SELECT "availableLanguageCodes" FROM "channel"`,
        );
        const channelLanguages = rows.flatMap(row => row.availableLanguageCodes.split(',')).filter(Boolean);
        return [...new Set([...channelLanguages, this.configService.defaultLanguageCode as string])];
    }

    private async buildDocuments(productIds: number[]): Promise<DocumentRow[]> {
        const db = this.connection.rawConnection;
        const languages = await this.searchLanguages();
        const defaultLanguage = this.configService.defaultLanguageCode as string;
        const [names, skus, facets, collections]: [NameRow[], SkuRow[], TextRow[], TextRow[]] = await Promise.all([
            db.query(
                `SELECT p.id AS "productId", pt."languageCode", pt.name, pt.description
                 FROM "product" p JOIN "product_translation" pt ON pt."baseId" = p.id
                 WHERE p.id = ANY($1) AND p."deletedAt" IS NULL
                 ORDER BY pt.id`,
                [productIds],
            ),
            db.query(
                `SELECT "productId", sku FROM "product_variant"
                 WHERE "productId" = ANY($1) AND "deletedAt" IS NULL`,
                [productIds],
            ),
            db.query(
                `SELECT x."productId", x."facetValueId" AS "entityId", fvt."languageCode", fvt.name
                 FROM (
                     SELECT "productId", "facetValueId" FROM "product_facet_values_facet_value"
                     WHERE "productId" = ANY($1)
                     UNION
                     SELECT pv."productId", vf."facetValueId"
                     FROM "product_variant_facet_values_facet_value" vf
                     JOIN "product_variant" pv ON pv.id = vf."productVariantId"
                     WHERE pv."productId" = ANY($1) AND pv."deletedAt" IS NULL
                 ) x JOIN "facet_value_translation" fvt ON fvt."baseId" = x."facetValueId"`,
                [productIds],
            ),
            db.query(
                `SELECT DISTINCT pv."productId", c.id AS "entityId", ct."languageCode", ct.name
                 FROM "collection_product_variants_product_variant" j
                 JOIN "product_variant" pv ON pv.id = j."productVariantId" AND pv."deletedAt" IS NULL
                 JOIN "collection" c ON c.id = j."collectionId" AND c."isRoot" = false AND c."isPrivate" = false
                 JOIN "collection_translation" ct ON ct."baseId" = c.id
                 WHERE pv."productId" = ANY($1)`,
                [productIds],
            ),
        ]);

        // Igual que el indexador de Vendure: idioma pedido → idioma por defecto → primera traducción.
        const pick = <T extends { languageCode: string }>(translations: T[], languageCode: string): T | undefined =>
            translations.find(t => t.languageCode === languageCode) ??
            translations.find(t => t.languageCode === defaultLanguage) ??
            translations[0];
        const namesOf = (rows: TextRow[], productId: number, languageCode: string): string[] => {
            const byEntity = new Map<number, TextRow[]>();
            for (const row of rows.filter(r => r.productId === productId)) {
                byEntity.set(row.entityId, [...(byEntity.get(row.entityId) ?? []), row]);
            }
            return [...byEntity.values()].flatMap(translations => pick(translations, languageCode)?.name ?? []);
        };

        const productIdsFound = [...new Set(names.map(row => row.productId))];
        return productIdsFound.flatMap(productId => {
            const translations = names.filter(row => row.productId === productId);
            const productSkus = skus.filter(sku => sku.productId === productId).map(sku => sku.sku);
            return languages.map(languageCode => {
                const translation = pick(translations, languageCode)!;
                const document = buildSearchDocument({
                    name: translation.name,
                    description: translation.description,
                    facetValueNames: namesOf(facets, productId, languageCode),
                    collectionNames: namesOf(collections, productId, languageCode),
                    skus: productSkus,
                });
                return { productId, languageCode, ...document };
            });
        });
    }

    private async productIdsOfVariants(variantIds: ID[]): Promise<number[]> {
        if (variantIds.length === 0) {
            return [];
        }
        const rows: Array<{ productId: number }> = await this.connection.rawConnection.query(
            `SELECT DISTINCT "productId" FROM "product_variant" WHERE id = ANY($1)`,
            [variantIds.map(Number)],
        );
        return rows.map(row => row.productId);
    }

    private async productIdsOfCollection(collectionId: ID): Promise<number[]> {
        const rows: Array<{ productId: number }> = await this.connection.rawConnection.query(
            `SELECT DISTINCT pv."productId"
             FROM "collection_product_variants_product_variant" j
             JOIN "product_variant" pv ON pv.id = j."productVariantId"
             WHERE j."collectionId" = $1`,
            [Number(collectionId)],
        );
        return rows.map(row => row.productId);
    }

    private async productIdsOfFacetValue(facetValueId: ID): Promise<number[]> {
        const rows: Array<{ productId: number }> = await this.connection.rawConnection.query(
            `SELECT "productId" FROM "product_facet_values_facet_value" WHERE "facetValueId" = $1
             UNION
             SELECT pv."productId"
             FROM "product_variant_facet_values_facet_value" vf
             JOIN "product_variant" pv ON pv.id = vf."productVariantId"
             WHERE vf."facetValueId" = $1`,
            [Number(facetValueId)],
        );
        return rows.map(row => row.productId);
    }

    private enqueueFrom(resolveIds: () => Promise<number[]>) {
        resolveIds()
            .then(ids => this.enqueue(ids))
            .catch(error => Logger.error(`No se pudo resolver qué productos reindexar: ${String(error)}`, LOGGER_CTX));
    }

    /** Agrupa los ids que llegan seguidos y los sincroniza de uno en uno (sin solaparse). */
    private enqueue(productIds: ID[]) {
        productIds.forEach(id => this.pending.add(Number(id)));
        this.timer ??= setTimeout(() => {
            const ids = [...this.pending];
            this.pending.clear();
            this.timer = undefined;
            this.queue = this.queue
                .then(() => this.syncProducts(ids))
                .catch(error => Logger.error(`No se pudo actualizar el índice de búsqueda: ${String(error)}`, LOGGER_CTX));
        }, DEBOUNCE_MS);
    }
}
