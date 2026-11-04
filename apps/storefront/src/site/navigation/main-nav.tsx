'use client';

import {useTranslations} from 'next-intl';
import {Link, usePathname} from '@/platform/i18n/navigation';
import {cn} from '@/lib/utils';

type NavKey = 'home' | 'shop';

const SHOP_PREFIXES = ['/search', '/collection', '/product'];

function currentKey(pathname: string): NavKey | undefined {
    if (pathname === '/') return 'home';
    if (SHOP_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))) return 'shop';
    return undefined;
}

const linkClass = 'inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-bold text-primary transition-colors hover:bg-pastel-lavender max-sm:min-h-10 max-sm:shrink-0 max-sm:px-3.5 sm:px-5 sm:text-[15px]';
const idleClass = 'max-sm:bg-card';
const currentClass = 'bg-brand-yellow font-extrabold shadow-[0_4px_10px_-4px_rgba(75,29,110,0.4)] hover:bg-brand-yellow';

function CurrentDot() {
    return <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-pink"/>;
}

export function MainNavView({current}: {current?: NavKey}) {
    const t = useTranslations('Navigation');

    return (
        <nav aria-label={t('mainNav')} className="container-page flex justify-center pb-3 pt-3 max-sm:border-y max-sm:border-border/60 max-sm:bg-muted max-sm:px-0 max-sm:py-1">
            {/* Phones: a single swipeable row of chips (fading at the edge to hint there is more) instead of a wrapped pill. */}
            <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-3xl border border-[#efe8f6] bg-card p-1.5 shadow-tile sm:flex-nowrap sm:rounded-full max-sm:w-full max-sm:flex-nowrap max-sm:justify-start max-sm:gap-2 max-sm:overflow-x-auto max-sm:overscroll-x-contain max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:py-1.5 max-sm:page-gutter max-sm:shadow-none max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-20px),transparent)] max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
                <Link
                    href="/"
                    aria-current={current === 'home' ? 'page' : undefined}
                    className={cn(linkClass, current === 'home' ? currentClass : idleClass)}
                >
                    {current === 'home' && <CurrentDot/>}
                    {t('home')}
                </Link>
                <Link
                    href="/search"
                    aria-current={current === 'shop' ? 'page' : undefined}
                    className={cn(linkClass, current === 'shop' ? currentClass : idleClass)}
                >
                    {current === 'shop' && <CurrentDot/>}
                    {t('shop')}
                </Link>
                <Link href="/#categorias" className={cn(linkClass, idleClass)}>{t('categories')}</Link>
                <Link href="/#caja" className={cn(linkClass, idleClass)}>{t('buildBox')}</Link>
                <a href="#contacto" className={cn(linkClass, idleClass)}>{t('contact')}</a>
            </div>
        </nav>
    );
}

export function MainNav() {
    const pathname = usePathname();
    return <MainNavView current={currentKey(pathname)} />;
}
