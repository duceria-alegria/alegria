/** Orden del catálogo cuando no se busca nada ni se eligió otro: lo más vendido primero. */
export const DEFAULT_SORT = 'sales-desc';

export interface SearchInputParams {
    term?: string;
    collectionSlug?: string;
    take: number;
    skip: number;
    groupByProduct: boolean;
    sort: { name?: 'ASC' | 'DESC'; price?: 'ASC' | 'DESC'; ventas?: 'ASC' | 'DESC' };
    facetValueFilters?: Array<{ and: string } | { or: string[] }>;
    /** Rango de precio en centavos. */
    precioMin?: number;
    precioMax?: number;
}

interface BuildSearchInputOptions {
    searchParams: { [key: string]: string | string[] | undefined };
    collectionSlug?: string;
    /** id de valor de filtro → id de su filtro (facet). Con esto los valores de un mismo filtro se suman (OR). */
    facetOf?: Record<string, string>;
}

// Dentro de un mismo filtro (p. ej. Línea) los valores elegidos se suman; entre filtros distintos se cruzan.
// Sin saber a qué filtro pertenece cada valor se mantiene el cruce estricto de antes.
function buildFacetValueFilters(ids: string[], facetOf?: Record<string, string>) {
    const groups = new Map<string, string[]>();
    const filters: Array<{ and: string } | { or: string[] }> = [];
    for (const id of ids) {
        const facetId = facetOf?.[id];
        if (!facetId) {
            filters.push({ and: id });
            continue;
        }
        groups.set(facetId, [...(groups.get(facetId) ?? []), id]);
    }
    for (const group of groups.values()) {
        filters.push(group.length === 1 ? { and: group[0] } : { or: group });
    }
    return filters;
}

/** Pesos de la URL (`?precioMin=50`) a centavos; lo que no sea un precio válido se ignora. */
function parsePrice(value: string | string[] | undefined) {
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    const pesos = Number(value);
    return Number.isFinite(pesos) && pesos >= 0 ? Math.round(pesos * 100) : undefined;
}

export function buildSearchInput({ searchParams, collectionSlug, facetOf }: BuildSearchInputOptions): SearchInputParams {
    const page = Number(searchParams.page) || 1;
    const take = 12;
    const skip = (page - 1) * take;
    const searchTerm = searchParams.q as string;
    const hasTerm = typeof searchTerm === 'string' && searchTerm.trim().length > 0;
    const requestedSort = searchParams.sort as string | undefined;
    // Con un término y sin orden elegido el servidor ordena por relevancia (le basta un `sort` vacío);
    // sin término, por lo más vendido.
    const sort = requestedSort && requestedSort !== 'relevance' ? requestedSort : hasTerm ? 'relevance' : DEFAULT_SORT;

    // Extract facet value IDs from search params
    const facetValueIds = searchParams.facets
        ? Array.isArray(searchParams.facets)
            ? searchParams.facets
            : [searchParams.facets]
        : [];

    // Map sort parameter to Vendure SearchResultSortParameter
    const sortMapping: Record<string, SearchInputParams['sort']> = {
        relevance: {},
        'sales-desc': { ventas: 'DESC' },
        'name-asc': { name: 'ASC' },
        'name-desc': { name: 'DESC' },
        'price-asc': { price: 'ASC' },
        'price-desc': { price: 'DESC' },
    };

    const precioMin = parsePrice(searchParams.precioMin);
    const precioMax = parsePrice(searchParams.precioMax);

    return {
        ...(searchTerm && { term: searchTerm }),
        ...(collectionSlug && { collectionSlug }),
        take,
        skip,
        groupByProduct: true,
        sort: sortMapping[sort] || sortMapping[DEFAULT_SORT],
        ...(precioMin !== undefined && { precioMin }),
        ...(precioMax !== undefined && { precioMax }),
        ...(facetValueIds.length > 0 && {
            facetValueFilters: buildFacetValueFilters(facetValueIds, facetOf)
        })
    };
}

export function getCurrentPage(searchParams: { [key: string]: string | string[] | undefined }): number {
    return Number(searchParams.page) || 1;
}
