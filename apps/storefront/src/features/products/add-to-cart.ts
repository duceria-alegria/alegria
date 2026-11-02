'use server';

import {getLocale, getTranslations} from 'next-intl/server';
import {updateTag} from 'next/cache';
import {
    AddToCartMutation,
    AdjustCartItemMutation,
    GetActiveOrderQuery,
    RemoveFromCartMutation,
} from '@/features/cart/graphql';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {mutate, query} from '@/platform/vendure/api';
import {setAuthToken} from '@/platform/vendure/auth-token';

export async function addToCart(variantId: string, quantity = 1) {
    const locale = await getLocale();
    const currencyCode = await getActiveCurrencyCode();
    const t = await getTranslations({locale, namespace: 'Errors'});

    try {
        const result = await mutate(
            AddToCartMutation,
            {variantId, quantity},
            {useAuthToken: true, currencyCode},
        );

        if (result.token) await setAuthToken(result.token);

        if (result.data.addItemToOrder.__typename === 'Order') {
            updateTag('cart');
            updateTag('active-order');
            return {success: true as const, order: result.data.addItemToOrder};
        }
        return {success: false as const, error: result.data.addItemToOrder.message};
    } catch {
        return {success: false as const, error: t('failedAddToCart')};
    }
}

export type CartLineState = {lineId: string; quantity: number};

export async function getCartLine(variantId: string): Promise<CartLineState | null> {
    try {
        const {data} = await query(GetActiveOrderQuery, undefined, {
            useAuthToken: true,
            fetch: {cache: 'no-store'},
        });
        const line = data.activeOrder?.lines.find((l) => l.productVariant.id === variantId);
        return line ? {lineId: line.id, quantity: line.quantity} : null;
    } catch {
        return null;
    }
}

/** All lines of the active order keyed by variant id, so a grid of cards needs a single request. */
export async function getCartLines(): Promise<Record<string, CartLineState>> {
    try {
        const {data} = await query(GetActiveOrderQuery, undefined, {
            useAuthToken: true,
            fetch: {cache: 'no-store'},
        });
        return Object.fromEntries(
            (data.activeOrder?.lines ?? []).map((l) => [l.productVariant.id, {lineId: l.id, quantity: l.quantity}]),
        );
    } catch {
        return {};
    }
}

/** Sets the quantity of an existing cart line; a quantity of 0 removes the line. */
export async function setCartLineQuantity(lineId: string, quantity: number) {
    const currencyCode = await getActiveCurrencyCode();

    try {
        const options = {useAuthToken: true, currencyCode} as const;
        const result = quantity <= 0
            ? (await mutate(RemoveFromCartMutation, {lineId}, options)).data.removeOrderLine
            : (await mutate(AdjustCartItemMutation, {lineId, quantity}, options)).data.adjustOrderLine;

        if (result.__typename === 'Order') {
            updateTag('cart');
            updateTag('active-order');
            return {success: true as const};
        }
        return {success: false as const, error: result.message};
    } catch {
        return {success: false as const, error: undefined};
    }
}
