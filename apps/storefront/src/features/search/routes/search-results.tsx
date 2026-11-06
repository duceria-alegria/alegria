import {Suspense} from "react";
import {getRouteLocale} from "@/platform/i18n/server";
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {FacetFilters} from '@/features/search/facet-filters';
import {SearchBox} from '@/features/search/search-box';
import {SearchPendingArea, SearchPendingProvider} from '@/features/search/search-pending';
import {ProductGridSkeleton} from '@/features/products/product-grid-skeleton';
import {ProductGrid} from '@/features/products/product-grid';
import {buildSearchInput, getCurrentPage} from "@/features/search/search-helpers";
import {query} from "@/platform/vendure/api";
import {SearchProductsQuery} from '@/features/search/graphql';
import {getPricingToken} from '@/features/pricing/pricing-token';

interface SearchResultsProps {
    searchParams: Promise<{
        page?: string
        q?: string | string[]
    }>
}

export async function SearchResults({searchParams}: SearchResultsProps) {
    const searchParamsResolved = await searchParams;
    const locale = await getRouteLocale();
    const currencyCode = await getActiveCurrencyCode();
    const page = getCurrentPage(searchParamsResolved);

    const pricingToken = await getPricingToken();
    const productDataPromise = query(SearchProductsQuery, {
        input: buildSearchInput({searchParams: searchParamsResolved})
    }, {languageCode: locale, currencyCode, token: pricingToken});


    return (
        <SearchPendingProvider>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Search + filters sidebar (stacks above the grid on mobile) */}
                <aside className="space-y-6 lg:col-span-1">
                    <SearchBox/>
                    <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded-lg"/>}>
                        <FacetFilters productDataPromise={productDataPromise}/>
                    </Suspense>
                </aside>

                {/* Product Grid (dimmed while a new search loads) */}
                <SearchPendingArea className="lg:col-span-3">
                    <Suspense fallback={<ProductGridSkeleton/>}>
                        <ProductGrid productDataPromise={productDataPromise} currentPage={page} take={12}
                                     term={typeof searchParamsResolved.q === 'string' ? searchParamsResolved.q.trim() : undefined}/>
                    </Suspense>
                </SearchPendingArea>
            </div>
        </SearchPendingProvider>
    )
}
