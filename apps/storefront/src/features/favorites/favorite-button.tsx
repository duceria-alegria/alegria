'use client';

import {useEffect, useTransition, type MouseEvent} from 'react';
import {Heart} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {setFavorite} from '@/features/favorites/actions';
import {refreshFavorites, setFavoriteLocally, useIsFavorite} from '@/features/favorites/favorites-store';
import {useRouter} from '@/platform/i18n/navigation';
import {cn} from '@/lib/utils';

interface FavoriteButtonProps {
    productId: string;
    productName: string;
    /** `card` is the round icon over a product card image; `detail` is the labelled button on the product page. */
    variant?: 'card' | 'detail';
    className?: string;
}

export function FavoriteButton({productId, productName, variant = 'card', className}: FavoriteButtonProps) {
    const t = useTranslations('Favorites');
    const router = useRouter();
    const isFavorite = useIsFavorite(productId);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        void refreshFavorites();
    }, []);

    const handleClick = (event: MouseEvent) => {
        // Inside a product card this sits above the stretched link: never navigate to the product.
        event.preventDefault();
        event.stopPropagation();
        const next = !isFavorite;
        setFavoriteLocally(productId, next);
        startTransition(async () => {
            const result = await setFavorite(productId, next);
            if (result.success) {
                toast.success(next ? t('added') : t('removed'), {description: productName});
                return;
            }
            setFavoriteLocally(productId, !next);
            if (result.unauthenticated) {
                toast(t('signInTitle'), {
                    action: {label: t('signInAction'), onClick: () => router.push('/sign-in')},
                });
            } else {
                toast.error(result.error);
            }
        });
    };

    const label = isFavorite ? t('remove') : t('add');
    const icon = (
        <Heart
            className={cn('transition-colors', variant === 'card' ? 'size-[18px]' : 'size-5', isFavorite && 'fill-brand-red text-brand-red')}
            strokeWidth={2.2}
            aria-hidden="true"
        />
    );

    if (variant === 'detail') {
        return (
            <button
                type="button"
                aria-pressed={isFavorite}
                disabled={isPending}
                onClick={handleClick}
                className={cn(
                    'inline-flex h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-border bg-background px-4 text-sm font-bold transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-60 max-sm:w-11 max-sm:px-0',
                    className,
                )}
            >
                {icon}
                <span className="max-sm:sr-only">{label}</span>
            </button>
        );
    }

    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={isFavorite}
            disabled={isPending}
            onClick={handleClick}
            className={cn(
                'absolute right-2 top-2 z-10 flex size-9 items-center justify-center rounded-full bg-background/90 text-primary shadow-button transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-background active:scale-90 disabled:pointer-events-none disabled:opacity-60',
                className,
            )}
        >
            {icon}
        </button>
    );
}
