import {toIntlLocale} from '@/platform/i18n/locale-utils';

type DateFormat = 'short' | 'long';

/**
 * Zona de la tienda: se usa al renderizar en el servidor (que no conoce la zona del visitante) y como
 * respaldo; en el navegador `LocalDate` la reemplaza por la zona del propio usuario.
 */
export const STORE_TIME_ZONE = 'America/Mexico_City';

/**
 * Format a date string
 * @param dateString ISO date string
 * @param format 'short' (Jan 15, 2024) or 'long' (January 15, 2024)
 * @param locale App locale code (e.g. 'en', 'de')
 * @param options.withTime Also show the hour and minute
 * @param options.timeZone IANA zone; omit to use the runtime's own zone (the visitor's, in the browser)
 */
export function formatDate(
    dateString: string,
    format: DateFormat = 'short',
    locale: string = 'en',
    options: {withTime?: boolean; timeZone?: string} = {},
): string {
    const formatOptions: Intl.DateTimeFormatOptions = format === 'long'
        ? { year: 'numeric', month: 'long', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' };
    if (options.withTime) {
        formatOptions.hour = 'numeric';
        formatOptions.minute = '2-digit';
    }
    if (options.timeZone) {
        formatOptions.timeZone = options.timeZone;
    }

    return new Date(dateString).toLocaleString(toIntlLocale(locale), formatOptions);
}
