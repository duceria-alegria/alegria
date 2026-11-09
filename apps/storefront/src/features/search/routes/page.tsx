import type {Metadata} from 'next';
import {Suspense} from 'react';
import {getTranslations} from 'next-intl/server';
import {getRouteLocale} from '@/platform/i18n/server';
import {SearchFacets, SearchProducts} from "@/features/search/routes/search-results";
import {SearchTerm, SearchTermSkeleton} from "@/features/search/routes/search-term";
import {SearchBox} from '@/features/search/search-box';
import {SearchPendingArea, SearchPendingProvider} from '@/features/search/search-pending';
import {ProductGridSkeleton} from '@/features/products/product-grid-skeleton';
import {SITE_NAME, noIndexRobots} from '@/config/metadata';

export async function generateMetadata({
    searchParams,
}: PageProps<'/[locale]/search'>): Promise<Metadata> {
    const resolvedParams = await searchParams;
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Search'});
    const searchQuery = resolvedParams.q as string | undefined;

    const title = searchQuery
        ? t('resultsTitle', {query: searchQuery})
        : t('pageTitle');

    return {
        title,
        description: searchQuery
            ? t('metaDescription', {query: searchQuery, siteName: SITE_NAME})
            : t('metaCatalogDescription', {siteName: SITE_NAME}),
        robots: noIndexRobots(),
    };
}

export default async function SearchPage({searchParams}: PageProps<'/[locale]/search'>) {
    return (
        <div className="container mx-auto px-4 py-8 mt-16">
            <Suspense fallback={<SearchTermSkeleton/>}>
                <SearchTerm searchParams={searchParams}/>
            </Suspense>
            {/* The shell (and the search box in it) is outside the data Suspense boundaries, so it is
                in the first HTML and is never unmounted while results reload — otherwise typing would
                lose the input on every keystroke-triggered navigation. */}
            <SearchPendingProvider>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Search + filters sidebar (stacks above the grid on mobile) */}
                    <aside className="space-y-6 lg:col-span-1">
                        <Suspense fallback={<div className="h-11 rounded-full border-[1.5px] border-border bg-background"/>}>
                            <SearchBox/>
                        </Suspense>
                        <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded-lg"/>}>
                            <SearchFacets searchParams={searchParams}/>
                        </Suspense>
                    </aside>

                    {/* Product Grid (dimmed while a new search loads) */}
                    <SearchPendingArea className="lg:col-span-3">
                        <Suspense fallback={<ProductGridSkeleton/>}>
                            <SearchProducts searchParams={searchParams}/>
                        </Suspense>
                    </SearchPendingArea>
                </div>
            </SearchPendingProvider>
        </div>
    );
}
