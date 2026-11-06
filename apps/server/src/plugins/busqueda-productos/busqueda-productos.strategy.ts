import {
    applyLanguageConstraints,
    createCollectionIdCountMap,
    createFacetIdCountMap,
    createPlaceholderFromId,
    getFieldsToSelect,
    hasSortParameter,
    Injector,
    mapToSearchResult,
    RequestContext,
    SearchStrategy,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
// La entidad del índice no está en la API pública de Vendure (@vendure/core está fijado en 3.8.1).
import { SearchIndexItem } from '@vendure/core/dist/plugin/default-search-plugin/entities/search-index-item.entity';
import { Brackets, SelectQueryBuilder } from 'typeorm';
import { ProductSearchDocument } from './product-search-document.entity';
import { buildSearchSql } from './search-sql';
import { ParsedSearchQuery, parseSearchQuery } from './search-text';

// `inStock` lo agrega DefaultSearchPlugin al input de la API (con `indexStockStatus`).
type SearchInput = Parameters<SearchStrategy['getSearchResults']>[1] & { inStock?: boolean | null };
type SearchResult = Awaited<ReturnType<SearchStrategy['getSearchResults']>>[number];

/** Las mismas opciones que se le pasan a `DefaultSearchPlugin.init`. */
export interface BusquedaProductosStrategyOptions {
    indexStockStatus?: boolean;
    indexCurrencyCode?: boolean;
}

/**
 * Búsqueda por texto sobre `product_search_document` en lugar del `to_tsvector` (configuración en
 * inglés) del plugin por defecto: ignora acentos, tolera errores de dedo y plurales, entiende
 * sinónimos y ordena por relevancia. Todo lo demás (facets, colecciones, orden, paginación) es la
 * estrategia de Postgres de Vendure 3.8.1 (MIT) sin cambios; solo se sustituyó el manejo de `term`.
 * Los precios por lista no se ven afectados: se resuelven por campo, no desde el índice.
 */
export class BusquedaProductosStrategy implements SearchStrategy {
    private connection: TransactionalConnection;

    constructor(private readonly options: BusquedaProductosStrategyOptions = {}) {}

    async init(injector: Injector) {
        this.connection = injector.get(TransactionalConnection);
    }

    async getFacetValueIds(ctx: RequestContext, input: SearchInput, enabledOnly: boolean) {
        const facetValuesQb = this.connection
            .getRepository(ctx, SearchIndexItem)
            .createQueryBuilder('si')
            .select(['"si"."productId"', 'MAX("si"."productVariantId")'])
            .addSelect('string_agg("si"."facetValueIds",\',\')', 'facetValues');
        this.applyTermAndFilters(ctx, facetValuesQb, input, parseSearchQuery(input.term));
        if (!input.groupByProduct) {
            facetValuesQb.groupBy('"si"."productVariantId", "si"."productId"');
        }
        if (enabledOnly) {
            facetValuesQb.andWhere('"si"."enabled" = :enabled', { enabled: true });
        }
        return createFacetIdCountMap(await facetValuesQb.getRawMany());
    }

    async getCollectionIds(ctx: RequestContext, input: SearchInput, enabledOnly: boolean) {
        const collectionsQb = this.connection
            .getRepository(ctx, SearchIndexItem)
            .createQueryBuilder('si')
            .select(['"si"."productId"', 'MAX("si"."productVariantId")'])
            .addSelect('string_agg("si"."collectionIds",\',\')', 'collections');
        this.applyTermAndFilters(ctx, collectionsQb, input, parseSearchQuery(input.term));
        if (!input.groupByProduct) {
            collectionsQb.groupBy('"si"."productVariantId", "si"."productId"');
        }
        if (enabledOnly) {
            collectionsQb.andWhere('"si"."enabled" = :enabled', { enabled: true });
        }
        return createCollectionIdCountMap(await collectionsQb.getRawMany());
    }

    async getSearchResults(ctx: RequestContext, input: SearchInput, enabledOnly: boolean): Promise<SearchResult[]> {
        const take = input.take || 25;
        const skip = input.skip || 0;
        const sort = input.sort;
        const query = parseSearchQuery(input.term);
        const qb = this.connection
            .getRepository(ctx, SearchIndexItem)
            .createQueryBuilder('si')
            .select(this.createPostgresSelect(!!input.groupByProduct));
        if (input.groupByProduct) {
            qb.addSelect('MIN(si.price)', 'minPrice')
                .addSelect('MAX(si.price)', 'maxPrice')
                .addSelect('MIN(si.priceWithTax)', 'minPriceWithTax')
                .addSelect('MAX(si.priceWithTax)', 'maxPriceWithTax');
        }
        this.applyTermAndFilters(ctx, qb, input, query, true);
        if (hasSortParameter(sort)) {
            if (sort?.name) {
                qb.addOrderBy('"si_productName"', sort.name);
            }
            if (sort?.price) {
                qb.addOrderBy('"si_price"', sort.price);
            }
        } else if (query) {
            // Sin orden explícito, lo más relevante primero y, a igual relevancia, por nombre.
            qb.addOrderBy('score', 'DESC').addOrderBy('"si_productName"', 'ASC');
        }
        // Necesario para un orden determinista cuando hay nombres, precios o puntajes repetidos.
        qb.addOrderBy('"si_productVariantId"', 'ASC');
        if (enabledOnly) {
            qb.andWhere('"si"."enabled" = :enabled', { enabled: true });
        }
        const rows = await qb.limit(take).offset(skip).getRawMany();
        return rows.map(row =>
            mapToSearchResult(row, this.options.indexCurrencyCode ? row.si_currencyCode : ctx.channel.defaultCurrencyCode),
        );
    }

    async getTotalCount(ctx: RequestContext, input: SearchInput, enabledOnly: boolean): Promise<number> {
        const innerQb = this.applyTermAndFilters(
            ctx,
            this.connection
                .getRepository(ctx, SearchIndexItem)
                .createQueryBuilder('si')
                .select(this.createPostgresSelect(!!input.groupByProduct)),
            input,
            parseSearchQuery(input.term),
        );
        if (enabledOnly) {
            innerQb.andWhere('"si"."enabled" = :enabled', { enabled: true });
        }
        const total = await this.connection.rawConnection
            .createQueryBuilder()
            .select('COUNT(*) as total')
            .from(`(${innerQb.getQuery()})`, 'inner')
            .setParameters(innerQb.getParameters())
            .getRawOne();
        return Number(total.total);
    }

    private applyTermAndFilters(
        ctx: RequestContext,
        qb: SelectQueryBuilder<SearchIndexItem>,
        input: SearchInput,
        query: ParsedSearchQuery | null,
        withScore = false,
    ) {
        const {
            facetValueFilters,
            facetValueIds,
            facetValueOperator,
            collectionId,
            collectionSlug,
            collectionIds,
            collectionSlugs,
        } = input;
        qb.where('1 = 1');

        if (query) {
            const search = buildSearchSql(query);
            qb.innerJoin(
                ProductSearchDocument,
                'doc',
                '"doc"."productId" = "si"."productId" AND "doc"."languageCode" = "si"."languageCode"',
            )
                .andWhere(search.where)
                .setParameters(search.params);
            if (withScore) {
                qb.addSelect(input.groupByProduct ? `MAX(${search.score})` : search.score, 'score');
            }
        }

        if (input.inStock != null) {
            if (input.groupByProduct) {
                qb.andWhere('si.productInStock = :inStock', { inStock: input.inStock });
            } else {
                qb.andWhere('si.inStock = :inStock', { inStock: input.inStock });
            }
        }
        if (facetValueIds?.length) {
            qb.andWhere(
                new Brackets(qb1 => {
                    for (const id of facetValueIds) {
                        const placeholder = createPlaceholderFromId(id);
                        const clause = `:${placeholder}::varchar = ANY (string_to_array(si.facetValueIds, ','))`;
                        const params = { [placeholder]: id };
                        if (String(facetValueOperator) === 'AND') {
                            qb1.andWhere(clause, params);
                        } else {
                            qb1.orWhere(clause, params);
                        }
                    }
                }),
            );
        }
        if (facetValueFilters?.length) {
            qb.andWhere(
                new Brackets(qb1 => {
                    for (const facetValueFilter of facetValueFilters) {
                        qb1.andWhere(
                            new Brackets(qb2 => {
                                if (facetValueFilter.and && facetValueFilter.or?.length) {
                                    throw new UserInputError('error.facetfilterinput-invalid-input');
                                }
                                if (facetValueFilter.and) {
                                    const placeholder = createPlaceholderFromId(facetValueFilter.and);
                                    const clause = `:${placeholder}::varchar = ANY (string_to_array(si.facetValueIds, ','))`;
                                    qb2.where(clause, { [placeholder]: facetValueFilter.and });
                                }
                                if (facetValueFilter.or?.length) {
                                    for (const id of facetValueFilter.or) {
                                        const placeholder = createPlaceholderFromId(id);
                                        const clause = `:${placeholder}::varchar = ANY (string_to_array(si.facetValueIds, ','))`;
                                        qb2.orWhere(clause, { [placeholder]: id });
                                    }
                                }
                            }),
                        );
                    }
                }),
            );
        }
        if (collectionId) {
            qb.andWhere(":collectionId::varchar = ANY (string_to_array(si.collectionIds, ','))", { collectionId });
        }
        if (collectionSlug) {
            qb.andWhere(":collectionSlug::varchar = ANY (string_to_array(si.collectionSlugs, ','))", {
                collectionSlug,
            });
        }
        if (collectionIds?.length) {
            qb.andWhere(
                new Brackets(qb1 => {
                    for (const id of Array.from(new Set(collectionIds))) {
                        const placeholder = createPlaceholderFromId(id);
                        qb1.orWhere(`:${placeholder}::varchar = ANY (string_to_array(si.collectionIds, ','))`, {
                            [placeholder]: id,
                        });
                    }
                }),
            );
        }
        if (collectionSlugs?.length) {
            qb.andWhere(
                new Brackets(qb1 => {
                    for (const slug of Array.from(new Set(collectionSlugs))) {
                        const placeholder = createPlaceholderFromId(slug);
                        qb1.orWhere(`:${placeholder}::varchar = ANY (string_to_array(si.collectionSlugs, ','))`, {
                            [placeholder]: slug,
                        });
                    }
                }),
            );
        }
        qb.andWhere('si.channelId = :channelId', { channelId: ctx.channelId });
        applyLanguageConstraints(qb, ctx.languageCode, ctx.channel.defaultLanguageCode);
        if (this.options.indexCurrencyCode) {
            qb.andWhere('si.currencyCode = :currencyCode', { currencyCode: ctx.currencyCode });
        }
        if (input.groupByProduct === true) {
            qb.groupBy('si.productId');
        }
        return qb;
    }

    /**
     * Con GROUP BY todas las columnas seleccionadas deben ir agregadas: se aplica MIN a todas
     * menos a productId (y string_agg/bool_or donde corresponde).
     */
    private createPostgresSelect(groupByProduct: boolean) {
        return getFieldsToSelect(this.options.indexStockStatus, this.options.indexCurrencyCode)
            .map(col => {
                const qualifiedName = `si.${col}`;
                const alias = `si_${col}`;
                if (groupByProduct && col !== 'productId') {
                    if (col === 'facetIds' || col === 'facetValueIds' || col === 'collectionIds' || col === 'channelIds') {
                        return `string_agg(${qualifiedName}, ',') as "${alias}"`;
                    }
                    if (col === 'enabled' || col === 'inStock' || col === 'productInStock') {
                        return `bool_or(${qualifiedName}) as "${alias}"`;
                    }
                    return `MIN(${qualifiedName}) as "${alias}"`;
                }
                return `${qualifiedName} as "${alias}"`;
            })
            .join(', ');
    }
}
