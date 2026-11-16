'use client';

import {useSyncExternalStore} from 'react';
import {getFavoriteIds} from '@/features/favorites/actions';

/**
 * Client-side mirror of the customer's favorite product ids, shared by every card and heart on
 * screen so they stay in sync with a single fetch. `signedIn` is only known once `loaded`.
 */
type State = {ids: ReadonlySet<string>; loaded: boolean; signedIn: boolean};

const INITIAL: State = {ids: new Set(), loaded: false, signedIn: false};
let state: State = INITIAL;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Hearts mounted together share one in-flight request; a later mount refetches. */
export function refreshFavorites() {
    inflight ??= getFavoriteIds()
        .then((ids) => {
            state = {ids: new Set(ids ?? []), loaded: true, signedIn: ids !== null};
            emit();
        })
        .finally(() => {
            inflight = null;
        });
    return inflight;
}

export function setFavoriteLocally(productId: string, favorite: boolean) {
    const ids = new Set(state.ids);
    if (favorite) ids.add(productId);
    else ids.delete(productId);
    state = {...state, ids};
    emit();
}

/** Forget everything on sign-out so the next customer on this browser never sees the previous list. */
export function resetFavorites() {
    state = INITIAL;
    emit();
}

export function useIsFavorite(productId: string): boolean {
    return useSyncExternalStore(
        subscribe,
        () => state.ids.has(productId),
        () => false,
    );
}

export function useFavoritesLoaded(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => state.loaded,
        () => false,
    );
}

export function isSignedInToFavorites() {
    return state.signedIn;
}
