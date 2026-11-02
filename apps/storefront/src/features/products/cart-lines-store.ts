'use client';

import {useSyncExternalStore} from 'react';
import {getCartLines, type CartLineState} from '@/features/products/add-to-cart';

/**
 * Client-side mirror of the active order's lines, shared by every product card on screen so
 * the same product stays in sync across grids and carousels with a single fetch.
 */
type Lines = Record<string, CartLineState>;

const EMPTY: Lines = {};
let lines: Lines = EMPTY;
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

/** Cards mounted together share one in-flight request; a later mount refetches. */
export function refreshCartLines() {
    inflight ??= getCartLines()
        .then((next) => {
            lines = next;
            emit();
        })
        .finally(() => {
            inflight = null;
        });
    return inflight;
}

export function replaceCartLines(orderLines: Array<{id: string; quantity: number; productVariant: {id: string}}>) {
    lines = Object.fromEntries(
        orderLines.map((l) => [l.productVariant.id, {lineId: l.id, quantity: l.quantity}]),
    );
    emit();
}

export function setCartLine(variantId: string, line: CartLineState | null) {
    const next = {...lines};
    if (line) next[variantId] = line;
    else delete next[variantId];
    lines = next;
    emit();
}

export function useCartLine(variantId: string): CartLineState | null {
    return useSyncExternalStore(
        subscribe,
        () => lines[variantId] ?? null,
        () => null,
    );
}
