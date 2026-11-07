import Image from 'next/image';
import {Plus} from 'lucide-react';
import {FragmentOf, readFragment} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '@/features/products/graphql';
import {Price} from '@/features/pricing/price';
import {Suspense} from "react";
import { Link } from '@/platform/i18n/navigation';
import {useTranslations} from 'next-intl';
import {cn} from '@/lib/utils';
import {ProductCardCartControl} from '@/features/products/components/product-card-cart-control';

interface ProductCardProps {
    product: FragmentOf<typeof ProductCardFragment>;
    preload?: boolean;
    className?: string;
}

const IMAGE_BACKGROUNDS = [
    'bg-pastel-lavender',
    'bg-brand-yellow-soft',
    'bg-pastel-pink',
    'bg-pastel-blue',
    'bg-pastel-cyan',
    'bg-pastel-orange',
] as const;

// Stable per-product tint so a given card keeps its color across pages.
function imageBackgroundFor(productId: string) {
    let hash = 0;
    for (const char of productId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return IMAGE_BACKGROUNDS[hash % IMAGE_BACKGROUNDS.length];
}

export function ProductCard({product: productProp, preload, className}: ProductCardProps) {
    const t = useTranslations('Product');
    const product = readFragment(ProductCardFragment, productProp);
    // A price range means several variants: the shopper has to pick one on the product page.
    const canQuickAdd = product.priceWithTax.__typename === 'SinglePrice'
        || (product.priceWithTax.__typename === 'PriceRange' && product.priceWithTax.min === product.priceWithTax.max);

    return (
        <article
            className={cn(
                "group relative flex flex-col rounded-2xl border border-border/70 bg-card p-2.5 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:transform-none",
                className,
            )}
        >
            <div className={cn("relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl", imageBackgroundFor(product.productId))}>
                {product.productAsset ? (
                    <Image
                        src={product.productAsset.preview}
                        alt=""
                        fill
                        preload={preload}
                        className="object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                ) : (
                    <span className="text-sm font-semibold text-muted-foreground">{t('noImage')}</span>
                )}
            </div>
            <div className="flex flex-col gap-1 px-1 pb-0.5 pt-2.5">
                <h3 className="line-clamp-2 font-display text-[15px] font-bold leading-tight">
                    {/* Stretched link: the pseudo-element makes the whole card the click target. */}
                    <Link
                        href={`/product/${product.slug}`}
                        className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
                    >
                        {product.productName}
                    </Link>
                </h3>
                <div className="mt-2 flex items-center justify-between gap-2">
                    <Suspense fallback={<div className="h-7 w-20 rounded bg-muted"></div>}>
                        <p className="font-display text-lg font-extrabold">
                            {product.priceWithTax.__typename === 'PriceRange' ? (
                                product.priceWithTax.min !== product.priceWithTax.max ? (
                                    <>
                                        <span className="mr-1 font-sans text-xs font-normal text-muted-foreground">{t('from')}</span>
                                        <Price value={product.priceWithTax.min} currencyCode={product.currencyCode}/>
                                    </>
                                ) : (
                                    <Price value={product.priceWithTax.min} currencyCode={product.currencyCode}/>
                                )
                            ) : product.priceWithTax.__typename === 'SinglePrice' ? (
                                <Price value={product.priceWithTax.value} currencyCode={product.currencyCode}/>
                            ) : null}
                        </p>
                    </Suspense>
                    {canQuickAdd ? (
                        <ProductCardCartControl variantId={product.productVariantId}/>
                    ) : (
                        <span
                            aria-hidden="true"
                            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-primary shadow-button transition-colors group-hover:bg-brand-yellow-deep"
                        >
                            <Plus className="size-4" strokeWidth={2.4}/>
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}
