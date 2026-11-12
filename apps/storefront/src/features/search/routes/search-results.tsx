import {cache} from 'react';
import {getRouteLocale} from "@/platform/i18n/server";
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {FacetFilters} from '@/features/search/facet-filters';
import {ProductGrid} from '@/features/products/product-grid';
import {getCurrentPage} from "@/features/search/search-helpers";
import {searchWithFacetCatalog} from "@/features/search/search-data";
import {getPricingToken} from '@/features/pricing/pricing-token';

interface SearchResultsProps {
    searchParams: Promise<{
        page?: string
        q?: string | string[]
    }>
}

// Filters and grid render in separate Suspense boundaries but share one request. `cache` dedupes it
// per render, keyed on the (same) searchParams promise both receive from the page.
const getSearchData = cache(async (searchParams: SearchResultsProps['searchParams']) => {
    const searchParamsResolved = await searchParams;
    const locale = await getRouteLocale();
    const currencyCode = await getActiveCurrencyCode();
    const pricingToken = await getPricingToken();
    return searchWithFacetCatalog({
        searchParams: searchParamsResolved,
        requestOptions: {languageCode: locale, currencyCode, token: pricingToken},
    });
});

export async function SearchFacets({searchParams}: SearchResultsProps) {
    return <FacetFilters productDataPromise={getSearchData(searchParams)}/>;
}

export async function SearchProducts({searchParams}: SearchResultsProps) {
    const searchParamsResolved = await searchParams;
    const term = typeof searchParamsResolved.q === 'string' ? searchParamsResolved.q.trim() : undefined;

    return (
        <ProductGrid productDataPromise={getSearchData(searchParams)}
                     currentPage={getCurrentPage(searchParamsResolved)} take={12} term={term}/>
    );
}
