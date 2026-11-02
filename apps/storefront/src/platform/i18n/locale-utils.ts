import type {Locale} from './routing';

const OG_LOCALE_MAP: Record<Locale, string> = { es: 'es_MX' };
const INTL_LOCALE_MAP: Record<Locale, string> = { es: 'es-MX' };

export function toOgLocale(locale: string): string {
    return OG_LOCALE_MAP[locale as Locale] || 'es_MX';
}

export function toIntlLocale(locale: string): string {
    return INTL_LOCALE_MAP[locale as Locale] || 'es-MX';
}
