'use client';

import { Link, usePathname } from '@/platform/i18n/navigation';
import {cn} from '@/lib/utils';
import {Package, User, MapPin} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {useTranslations} from 'next-intl';

const iconMap: Record<string, LucideIcon> = {
    Package,
    MapPin,
    User,
};

interface NavItem {
    href: string;
    labelKey: string;
    icon: string;
}

interface AccountNavLinksProps {
    items: NavItem[];
}

/**
 * The account sections as a row of pill tabs. The active tab is filled purple so it does not read as a second
 * copy of the store's main nav, whose active pill is yellow. On phones the row scrolls sideways if it ever overflows.
 */
export function AccountNavLinks({items}: AccountNavLinksProps) {
    const pathname = usePathname();
    const t = useTranslations('Account');

    return (
        <nav
            aria-label={t('pageTitle')}
            className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-[#efe8f6] bg-card p-1.5 shadow-tile [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
            {items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = iconMap[item.icon];
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            'inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors sm:px-5 sm:text-[15px]',
                            isActive
                                ? 'bg-primary font-extrabold text-primary-foreground shadow-button'
                                : 'text-primary hover:bg-pastel-lavender'
                        )}
                    >
                        {Icon && <Icon className="size-4" strokeWidth={2.4} aria-hidden="true" />}
                        {t(item.labelKey)}
                    </Link>
                );
            })}
        </nav>
    );
}
