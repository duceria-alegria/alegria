import {ProductCard} from "@/features/products/components/product-card";
import {getRouteLocale} from "@/platform/i18n/server";
import {cacheLife, cacheTag} from "next/cache";
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {query} from "@/platform/vendure/api";
import {GetCollectionProductsQuery} from '@/features/collections/graphql';
import {preconnect} from 'react-dom';
import {readFragment} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '@/features/products/graphql';
import {getPricingToken} from '@/features/pricing/pricing-token';

const FEATURED_PRODUCT_COUNT = 8;
const FEATURED_COLLECTION_SLUG = "dulces-mexicanos";

function getAssetOrigin(preview?: string) {
    if (!preview) return undefined;

    try {
        return new URL(preview).origin;
    } catch {
        return undefined;
    }
}

function queryFeaturedProducts(locale: string, currencyCode: string, token?: string) {
    // Fetch featured products from a specific collection
    // Replace 'featured' with your actual collection slug
    return query(GetCollectionProductsQuery, {
        slug: FEATURED_COLLECTION_SLUG,
        input: {
            collectionSlug: FEATURED_COLLECTION_SLUG,
            take: FEATURED_PRODUCT_COUNT,
            skip: 0,
            groupByProduct: true
        }
    }, {languageCode: locale, currencyCode, token});
}

async function getFeaturedCollectionProducts(currencyCode: string) {
    'use cache'
    cacheLife('days')

    const locale = await getRouteLocale();
    cacheTag(`featured-${locale}-${currencyCode}`);
    cacheTag('products');

    const result = await queryFeaturedProducts(locale, currencyCode);

    return result.data.search.items;
}


export async function FeaturedProducts() {
    const currencyCode = await getActiveCurrencyCode();
    const pricingToken = await getPricingToken();
    const products = pricingToken
        ? (await queryFeaturedProducts(await getRouteLocale(), currencyCode, pricingToken)).data.search.items
        : await getFeaturedCollectionProducts(currencyCode);
    const firstProduct = products[0]
        ? readFragment(ProductCardFragment, products[0])
        : undefined;
    const assetOrigin = getAssetOrigin(firstProduct?.productAsset?.preview);

    if (assetOrigin) {
        preconnect(assetOrigin);
    }

    return (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(max(150px,22%),1fr))] gap-[clamp(12px,2vw,24px)]">
            {products.map((product, index) => (
                <li key={readFragment(ProductCardFragment, product).productId} className="flex">
                    <ProductCard product={product} preload={index === 0} className="w-full"/>
                </li>
            ))}
        </ul>
    );
}
