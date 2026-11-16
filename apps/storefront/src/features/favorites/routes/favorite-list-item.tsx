'use client';

import type {ReactNode} from 'react';
import {useFavoritesLoaded, useIsFavorite} from '@/features/favorites/favorites-store';

/** A card on the favorites page leaves the list as soon as its heart is switched off. */
export function FavoriteListItem({productId, children}: {productId: string; children: ReactNode}) {
    const loaded = useFavoritesLoaded();
    const isFavorite = useIsFavorite(productId);
    return <li className="flex" hidden={loaded && !isFavorite}>{children}</li>;
}
