import {query} from '@/platform/vendure/api';
import {SearchFacetValuesQuery, SearchProductsQuery} from '@/features/search/graphql';
import {buildSearchInput} from '@/features/search/search-helpers';

type SearchParams = { [key: string]: string | string[] | undefined };
type RequestOptions = Parameters<typeof query>[2];

// Resultado de la búsqueda más el catálogo completo de valores de filtro (con los filtros elegidos
// o sin ellos), que es lo que pinta el panel de filtros: así las opciones no marcadas siguen ahí.
export async function searchWithFacetCatalog({searchParams, collectionSlug, requestOptions}: {
    searchParams: SearchParams;
    collectionSlug?: string;
    requestOptions: RequestOptions;
}) {
    const input = buildSearchInput({searchParams, collectionSlug});
    if (!input.facetValueFilters?.length) {
        const result = await query(SearchProductsQuery, {input}, requestOptions);
        return {...result, facetCatalog: result.data.search.facetValues};
    }

    const catalog = await query(SearchFacetValuesQuery, {
        input: {
            ...(input.term && {term: input.term}),
            ...(input.collectionSlug && {collectionSlug: input.collectionSlug}),
            groupByProduct: true,
            take: 0,
        },
    }, requestOptions);
    const facetCatalog = catalog.data.search.facetValues;
    const facetOf = Object.fromEntries(facetCatalog.map(({facetValue}) => [facetValue.id, facetValue.facet.id]));

    const filtered = await query(SearchProductsQuery, {
        input: buildSearchInput({searchParams, collectionSlug, facetOf}),
    }, requestOptions);
    return {...filtered, facetCatalog};
}
