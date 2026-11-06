'use client';

import {useLocale} from 'next-intl';
import {toIntlLocale} from '@/platform/i18n/locale-utils';

interface PriceProps {
    value: number;
    currencyCode?: string;
}

/** Formats an amount in minor currency units (cents) with the active locale, for use inside text. */
export function useFormatPrice() {
    const locale = useLocale();
    const intlLocale = toIntlLocale(locale);
    return (value: number, currencyCode = 'USD') =>
        new Intl.NumberFormat(intlLocale, {
            style: 'currency',
            currency: currencyCode,
        }).format(value / 100);
}

export function Price({value, currencyCode = 'USD'}: PriceProps) {
    const formatPrice = useFormatPrice();
    return <>{formatPrice(value, currencyCode)}</>;
}
