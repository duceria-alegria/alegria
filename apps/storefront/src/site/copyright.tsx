import {getRouteLocale} from '@/platform/i18n/server';
import {cacheLife} from 'next/cache';
import {getTranslations} from 'next-intl/server';

const COPYRIGHT_YEAR = 2026;

export async function Copyright({className}: {className?: string}) {
    'use cache'
    cacheLife('days');

    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Footer'});

    return (
        <div className={className}>
            &copy; {COPYRIGHT_YEAR} {t('copyright')}
        </div>
    )
}
