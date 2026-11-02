import type {Metadata} from "next";
import {getRouteLocale} from "@/platform/i18n/server";
import {HeroSection} from "@/site/home/hero-section";
import {CategoriesSection} from "@/site/home/categories-section";
import {FavoritesSection} from "@/site/home/favorites-section";
import {BoxCtaSection} from "@/site/home/box-cta-section";
import {SITE_NAME, SITE_URL, buildCanonicalUrl} from "@/config/metadata";
import {getTranslations} from 'next-intl/server';
import {toOgLocale} from '@/platform/i18n/locale-utils';

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Home'});
    const ogLocale = toOgLocale(locale);

    return {
        title: {
            absolute: `${SITE_NAME} - ${t('pageTitle')}`,
        },
        description: t('description'),
        alternates: {
            canonical: buildCanonicalUrl("/"),
        },
        openGraph: {
            title: `${SITE_NAME} - ${t('pageTitle')}`,
            description: t('ogDescription'),
            type: "website",
            locale: ogLocale,
            url: SITE_URL,
        },
    };
}

export default function Home() {
    return (
        <main className="min-h-screen">
            <HeroSection/>
            <CategoriesSection/>
            <FavoritesSection/>
            <BoxCtaSection/>
        </main>
    );
}
