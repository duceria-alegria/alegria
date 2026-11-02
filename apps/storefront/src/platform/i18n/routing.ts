import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
    // The store is Spanish-only for now. `en`/`de` messages stay registered (English is the
    // fallback for untranslated modules) and /en, /de redirect to /es in next.config.ts.
    // To offer more languages again, list them here, restore their entries below and in
    // locale-utils.ts, re-add <LanguagePicker /> to the navbar and remove the redirect.
    locales: ['es'],
    defaultLocale: 'es',
    localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
    es: 'Español',
};
