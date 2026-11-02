import {Suspense} from 'react';
import {ArrowRight} from 'lucide-react';
import {Link} from '@/platform/i18n/navigation';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';
import {FeaturedProducts} from '@/features/products/featured-products';
import {SectionHeading} from '@/site/home/section-heading';

export async function FavoritesSection() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Home'});

    return (
        <section id="tienda" className="container-page pb-[clamp(48px,6vw,88px)]">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                <SectionHeading>{t('favorites.title')}</SectionHeading>
                <Link
                    href="/search"
                    className="inline-flex min-h-11 items-center gap-2 text-[15px] font-extrabold hover:underline"
                >
                    {t('favorites.viewAll')}
                    <ArrowRight className="size-4" strokeWidth={2.4} aria-hidden="true" />
                </Link>
            </div>
            <Suspense>
                <FeaturedProducts/>
            </Suspense>
        </section>
    );
}
