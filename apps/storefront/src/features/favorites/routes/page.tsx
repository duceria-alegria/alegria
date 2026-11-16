import type {Metadata} from 'next';
import {Heart} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {noIndexRobots} from '@/config/metadata';
import {getFavoriteIds} from '@/features/favorites/actions';
import {FavoriteListItem} from '@/features/favorites/routes/favorite-list-item';
import {Pagination} from '@/features/products/pagination';
import {ProductCard} from '@/features/products/product-card';
import {ProductCardFragment} from '@/features/products/graphql';
import {SearchProductsQuery} from '@/features/search/graphql';
import {Button} from '@/components/ui/button';
import {Link, redirect} from '@/platform/i18n/navigation';
import {getRouteLocale} from '@/platform/i18n/server';
import {query} from '@/platform/vendure/api';
import {readFragment} from '@/platform/vendure/graphql';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';

const ITEMS_PER_PAGE = 24;

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Favorites'});
    return {title: t('pageTitle'), robots: noIndexRobots()};
}

export default async function FavoritesPage(props: PageProps<'/[locale]/favorites'>) {
    const locale = await getRouteLocale();
    const searchParams = await props.searchParams;
    const pageParam = searchParams.page;
    const requestedPage = parseInt(Array.isArray(pageParam) ? pageParam[0] : pageParam || '1', 10);

    const ids = await getFavoriteIds();
    if (!ids) {
        return redirect({href: '/sign-in', locale});
    }
    const t = await getTranslations({locale, namespace: 'Favorites'});

    const totalPages = Math.max(1, Math.ceil(ids.length / ITEMS_PER_PAGE));
    const currentPage = Math.min(Math.max(Number.isNaN(requestedPage) ? 1 : requestedPage, 1), totalPages);
    const pageIds = ids.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // The list is newest-first; the search has no such order, so the page restores it.
    const products = pageIds.length
        ? (await query(
            SearchProductsQuery,
            {input: {groupByProduct: true, productIds: pageIds, take: pageIds.length}},
            {languageCode: locale, currencyCode: await getActiveCurrencyCode(), useAuthToken: true, fetch: {cache: 'no-store'}},
        )).data.search.items
        : [];
    const position = new Map(pageIds.map((id, index) => [id, index]));
    const cards = products
        .map((product) => ({product, id: readFragment(ProductCardFragment, product).productId}))
        .sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));

    return (
        <div className="container mx-auto px-4 py-8 mt-16">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
                <h1 className="font-display text-3xl font-extrabold">{t('title')}</h1>
                {ids.length > 0 && (
                    <p className="text-sm text-muted-foreground">{t('count', {count: ids.length})}</p>
                )}
            </div>

            {cards.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <Heart className="size-12 text-muted-foreground" strokeWidth={1.6} aria-hidden="true"/>
                    <div className="space-y-1">
                        <p className="text-lg font-bold">{t('emptyTitle')}</p>
                        <p className="max-w-sm text-sm text-muted-foreground">{t('emptyHint')}</p>
                    </div>
                    <Button nativeButton={false} render={<Link href="/search"/>} className="rounded-full font-bold">
                        {t('browse')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-8">
                    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                        {cards.map(({product, id}) => (
                            <FavoriteListItem key={id} productId={id}>
                                <ProductCard product={product} className="w-full"/>
                            </FavoriteListItem>
                        ))}
                    </ul>
                    {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages}/>}
                </div>
            )}
        </div>
    );
}
