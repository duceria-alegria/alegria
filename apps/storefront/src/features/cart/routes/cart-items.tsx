import Image from 'next/image';
import { Link } from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {Minus, Plus, X} from 'lucide-react';
import {Price} from '@/features/pricing/price';
import {removeFromCart, adjustQuantity} from './actions';
import {getTranslations} from 'next-intl/server';

type ActiveOrder = {
    id: string;
    currencyCode: string;
    lines: Array<{
        id: string;
        quantity: number;
        unitPriceWithTax: number;
        linePriceWithTax: number;
        productVariant: {
            id: string;
            name: string;
            sku: string;
            product: {
                name: string;
                slug: string;
                featuredAsset?: {
                    preview: string;
                } | null;
            };
        };
    }>;
};

export async function CartItems({activeOrder}: { activeOrder: ActiveOrder | null }) {
    const t = await getTranslations('Cart');
    if (!activeOrder || activeOrder.lines.length === 0) {
        return (
            <div className="container mx-auto px-4 py-16">
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-4">{t('empty')}</h1>
                    <p className="text-muted-foreground mb-8">
                        {t('emptyMessage')}
                    </p>
                    <Button render={<Link href="/" />} nativeButton={false}>{t('continueShopping')}</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="lg:col-span-2 space-y-4">
            {activeOrder.lines.map((line) => (
                <div
                    key={line.id}
                    className="flex flex-col sm:flex-row gap-3 p-3 rounded-2xl border border-border/70 bg-card shadow-card"
                >
                    {line.productVariant.product.featuredAsset && (
                        <Link
                            href={`/product/${line.productVariant.product.slug}`}
                            className="flex-shrink-0"
                        >
                            <Image
                                src={line.productVariant.product.featuredAsset.preview}
                                alt={line.productVariant.name}
                                width={88}
                                height={88}
                                className="rounded-xl object-cover w-full sm:w-[88px] h-[88px]"
                            />
                        </Link>
                    )}

                    <div className="flex-grow min-w-0">
                        <Link
                            href={`/product/${line.productVariant.product.slug}`}
                            className="text-[15px] font-semibold hover:underline block"
                        >
                            {line.productVariant.product.name}
                        </Link>
                        {line.productVariant.name !== line.productVariant.product.name && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {line.productVariant.name}
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t('sku', {sku: line.productVariant.sku})}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1.5 sm:hidden">
                            <Price value={line.unitPriceWithTax} currencyCode={activeOrder.currencyCode}/> {t('each')}
                        </p>

                        <div className="flex items-center gap-2 mt-2.5">
                            <div className="flex items-center gap-1 border rounded-full bg-muted/50">
                                <form
                                    action={async () => {
                                        'use server';
                                        await adjustQuantity(line.id, Math.max(1, line.quantity - 1));
                                    }}
                                >
                                    <Button
                                        type="submit"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-full transition-all duration-200 hover:bg-background"
                                        disabled={line.quantity <= 1}
                                    >
                                        <Minus className="h-3.5 w-3.5"/>
                                    </Button>
                                </form>

                                <span className="w-8 text-center text-sm font-semibold tabular-nums transition-all duration-200">{line.quantity}</span>

                                <form
                                    action={async () => {
                                        'use server';
                                        await adjustQuantity(line.id, line.quantity + 1);
                                    }}
                                >
                                    <Button
                                        type="submit"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-full transition-all duration-200 hover:bg-background"
                                    >
                                        <Plus className="h-3.5 w-3.5"/>
                                    </Button>
                                </form>
                            </div>

                            <form
                                action={async () => {
                                    'use server';
                                    await removeFromCart(line.id);
                                }}
                            >
                                <Button
                                    type="submit"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors duration-200"
                                >
                                    <X className="h-4 w-4"/>
                                </Button>
                            </form>

                            <div className="sm:hidden ml-auto">
                                <p className="font-semibold text-base">
                                    <Price value={line.linePriceWithTax}
                                           currencyCode={activeOrder.currencyCode}/>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="hidden sm:block text-right flex-shrink-0">
                        <p className="font-semibold text-base">
                            <Price value={line.linePriceWithTax} currencyCode={activeOrder.currencyCode}/>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            <Price value={line.unitPriceWithTax} currencyCode={activeOrder.currencyCode}/> {t('each')}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
