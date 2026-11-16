import {Heart} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {Button} from '@/components/ui/button';
import {Link} from '@/platform/i18n/navigation';
import {getRouteLocale} from '@/platform/i18n/server';

export async function FavoritesLink() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Navigation'});

    return (
        <Button
            render={<Link href="/favorites"/>}
            nativeButton={false}
            variant="outline"
            aria-label={t('favorites')}
            className="size-11 rounded-full border-[1.5px] p-0"
        >
            <Heart className="size-5" aria-hidden="true"/>
        </Button>
    );
}
