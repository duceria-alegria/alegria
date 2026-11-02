'use client';

import {useEffect, useTransition} from 'react';
import {Minus, Plus, Trash2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {addToCart, setCartLineQuantity} from '@/features/products/add-to-cart';
import {refreshCartLines, replaceCartLines, setCartLine, useCartLine} from '@/features/products/cart-lines-store';

interface ProductCardCartControlProps {
    variantId: string;
}

const stepperButton =
    "flex size-9 items-center justify-center rounded-full bg-brand-yellow text-primary transition-colors hover:bg-brand-yellow-deep disabled:pointer-events-none disabled:opacity-60";

// Sits above the card's stretched link so these clicks don't navigate to the product page.
export function ProductCardCartControl({variantId}: ProductCardCartControlProps) {
    const t = useTranslations('Product');
    const cartLine = useCartLine(variantId);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        void refreshCartLines();
    }, []);

    const handleAdd = () => {
        startTransition(async () => {
            const result = await addToCart(variantId, 1);
            if (result.success) {
                replaceCartLines(result.order.lines);
            } else {
                toast.error(t('errorTitle'), {description: result.error || t('errorAddToCart')});
            }
        });
    };

    const handleSetQuantity = (quantity: number) => {
        if (!cartLine) return;
        startTransition(async () => {
            const result = await setCartLineQuantity(cartLine.lineId, quantity);
            if (result.success) {
                setCartLine(variantId, quantity <= 0 ? null : {...cartLine, quantity});
            } else {
                toast.error(t('errorTitle'), {description: result.error || t('errorUpdateCart')});
            }
        });
    };

    if (!cartLine) {
        return (
            <button
                type="button"
                aria-label={t('addToCart')}
                disabled={isPending}
                onClick={handleAdd}
                className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-primary transition-colors hover:bg-brand-yellow-deep group-hover:bg-brand-yellow-deep disabled:pointer-events-none disabled:opacity-60"
            >
                <Plus className="size-5" strokeWidth={2.4}/>
            </button>
        );
    }

    return (
        <div className="relative z-10 flex shrink-0 items-center gap-1.5 rounded-full bg-brand-yellow-soft p-1">
            <button
                type="button"
                aria-label={cartLine.quantity <= 1 ? t('removeFromCart') : t('decreaseQuantity')}
                disabled={isPending}
                onClick={() => handleSetQuantity(cartLine.quantity - 1)}
                className={stepperButton}
            >
                {cartLine.quantity <= 1
                    ? <Trash2 className="size-4" strokeWidth={2.4}/>
                    : <Minus className="size-4" strokeWidth={2.4}/>}
            </button>
            <span className="min-w-6 text-center font-display text-base font-extrabold tabular-nums" aria-live="polite">
                {cartLine.quantity}
            </span>
            <button
                type="button"
                aria-label={t('increaseQuantity')}
                disabled={isPending}
                onClick={() => handleSetQuantity(cartLine.quantity + 1)}
                className={stepperButton}
            >
                <Plus className="size-4" strokeWidth={2.4}/>
            </button>
        </div>
    );
}
