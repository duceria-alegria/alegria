import {getCurrencyCookie} from './currency';
import {getActiveChannel} from '@/platform/vendure/channel';

/**
 * Get the active currency code for the current request.
 * Reads from cookie when the channel offers that currency, otherwise falls back to the channel default.
 * A stale cookie (e.g. left over from a database with a different currency) must not reach the Shop API,
 * which rejects currencies the channel does not support and breaks every page.
 *
 * Safe inside 'use cache: private' (cookies are part of the per-user cache key).
 * NOT safe inside public 'use cache' — pass currency as a parameter instead.
 */
export async function getActiveCurrencyCode(): Promise<string> {
    const channel = await getActiveChannel();
    const cookieValue = await getCurrencyCookie();
    if (cookieValue && (channel.availableCurrencyCodes as string[]).includes(cookieValue)) {
        return cookieValue;
    }

    return channel.defaultCurrencyCode;
}
