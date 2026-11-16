'use server';

import {getTranslations} from 'next-intl/server';
import {AddFavoriteMutation, GetFavoriteIdsQuery, RemoveFavoriteMutation} from '@/features/favorites/graphql';
import {mutate, query} from '@/platform/vendure/api';
import {getAuthToken} from '@/platform/vendure/auth-token';

/** Product ids the signed-in customer saved, newest first; `null` for visitors (they have no list). */
export async function getFavoriteIds(): Promise<string[] | null> {
    if (!(await getAuthToken())) return null;
    try {
        const {data} = await query(GetFavoriteIdsQuery, undefined, {
            useAuthToken: true,
            fetch: {cache: 'no-store'},
        });
        return data.misFavoritos;
    } catch {
        // An expired session is rejected as unauthorized; treat it like a visitor.
        return null;
    }
}

export async function setFavorite(productId: string, favorite: boolean) {
    if (!(await getAuthToken())) return {success: false as const, unauthenticated: true as const};
    try {
        const options = {useAuthToken: true} as const;
        if (favorite) await mutate(AddFavoriteMutation, {productId}, options);
        else await mutate(RemoveFavoriteMutation, {productId}, options);
        return {success: true as const};
    } catch (error) {
        const unauthorized = error instanceof Error && /not currently authorized/i.test(error.message);
        if (unauthorized) return {success: false as const, unauthenticated: true as const};
        const t = await getTranslations('Favorites');
        return {success: false as const, unauthenticated: false as const, error: t('errorUpdate')};
    }
}
