'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useRouter, usePathname} from '@/platform/i18n/navigation';
import {routing, localeNames} from '@/platform/i18n/routing';
import {Globe} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LanguagePicker() {
    const t = useTranslations('Navigation');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const handleLocaleChange = (newLocale: string) => {
        router.replace(pathname, {locale: newLocale});
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="h-11 gap-1.5 rounded-full border-[1.5px] px-3 text-[15px] font-bold" />}>
                <Globe className="size-5" aria-hidden="true" />
                <span className="sr-only">{t('switchLanguage')}</span>
                <span className="hidden sm:inline">{localeNames[locale as keyof typeof localeNames] ?? locale.toUpperCase()}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {routing.locales.map((loc) => (
                    <DropdownMenuItem
                        key={loc}
                        onClick={() => handleLocaleChange(loc)}
                    >
                        <span>{localeNames[loc] ?? loc.toUpperCase()}</span>
                        {locale === loc && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
