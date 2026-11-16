import {query} from '@/platform/vendure/api';
import {PriceRangeQuery, SearchFacetValuesQuery, SearchProductsQuery} from '@/features/search/graphql';
import {buildSearchInput} from '@/features/search/search-helpers';

type SearchParams = { [key: string]: string | string[] | undefined };
type RequestOptions = Parameters<typeof query>[2];

// Resultado de la búsqueda más el catálogo completo de valores de filtro (con los filtros elegidos
// o sin ellos), que es lo que pinta el panel de filtros: así las opciones no marcadas siguen ahí.
// Incluye también el precio más bajo y más alto del catálogo para la barra de precio.
export async function searchWithFacetCatalog({searchParams, collectionSlug, requestOptions}: {
    searchParams: SearchParams;
    collectionSlug?: string;
    requestOptions: RequestOptions;
}) {
    const input = buildSearchInput({searchParams, collectionSlug});
    const priceRangeResult = query(PriceRangeQuery, undefined, requestOptions);
    if (!input.facetValueFilters?.length) {
        const [result, priceRange] = await Promise.all([query(SearchProductsQuery, {input}, requestOptions), priceRangeResult]);
        return {...result, facetCatalog: result.data.search.facetValues, priceRange: priceRange.data.rangoPrecios};
    }

    // El catálogo (qué valores existen y de qué filtro son) se arma SIN el rango de precio: si no, una
    // opción marcada que se queda sin productos en ese rango desaparece y el cruce de las líneas
    // elegidas se rompe (dejaría de sumarlas y no saldría nada). El rango solo cambia los conteos.
    const catalogInput = {
        ...(input.term && {term: input.term}),
        ...(input.collectionSlug && {collectionSlug: input.collectionSlug}),
        groupByProduct: true,
        take: 0,
    };
    const hasPriceRange = input.precioMin !== undefined || input.precioMax !== undefined;
    const [catalog, pricedCatalog] = await Promise.all([
        query(SearchFacetValuesQuery, {input: catalogInput}, requestOptions),
        hasPriceRange
            ? query(SearchFacetValuesQuery, {
                input: {
                    ...catalogInput,
                    ...(input.precioMin !== undefined && {precioMin: input.precioMin}),
                    ...(input.precioMax !== undefined && {precioMax: input.precioMax}),
                },
            }, requestOptions)
            : undefined,
    ]);
    const countsInRange = pricedCatalog && new Map(
        pricedCatalog.data.search.facetValues.map(({facetValue, count}) => [facetValue.id, count]),
    );
    const facetCatalog = catalog.data.search.facetValues.map((item) =>
        countsInRange ? {...item, count: countsInRange.get(item.facetValue.id) ?? 0} : item);
    const facetOf = Object.fromEntries(facetCatalog.map(({facetValue}) => [facetValue.id, facetValue.facet.id]));

    const [filtered, priceRange] = await Promise.all([
        query(SearchProductsQuery, {input: buildSearchInput({searchParams, collectionSlug, facetOf})}, requestOptions),
        priceRangeResult,
    ]);
    return {...filtered, facetCatalog, priceRange: priceRange.data.rangoPrecios};
}
