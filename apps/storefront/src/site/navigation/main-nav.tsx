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

const linkClass = 'inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-bold text-primary transition-colors hover:bg-pastel-lavender sm:px-5 sm:text-[15px]';
const currentClass = 'bg-brand-yellow font-extrabold shadow-[0_4px_10px_-4px_rgba(75,29,110,0.4)] hover:bg-brand-yellow';

function CurrentDot() {
    return <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-pink"/>;
}

export function MainNavView({current}: {current?: NavKey}) {
    const t = useTranslations('Navigation');

    return (
        <nav aria-label={t('mainNav')} className="flex justify-center pb-3 pt-3">
            <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-3xl border border-[#efe8f6] bg-card p-1.5 shadow-tile sm:flex-nowrap sm:rounded-full">
                <Link
                    href="/"
                    aria-current={current === 'home' ? 'page' : undefined}
                    className={cn(linkClass, current === 'home' && currentClass)}
                >
                    {current === 'home' && <CurrentDot/>}
                    {t('home')}
                </Link>
                <Link
                    href="/search"
                    aria-current={current === 'shop' ? 'page' : undefined}
                    className={cn(linkClass, current === 'shop' && currentClass)}
                >
                    {current === 'shop' && <CurrentDot/>}
                    {t('shop')}
                </Link>
                <Link href="/#categorias" className={linkClass}>{t('categories')}</Link>
                <Link href="/#caja" className={linkClass}>{t('buildBox')}</Link>
                <a href="#contacto" className={linkClass}>{t('contact')}</a>
            </div>
        </nav>
    );
}

export function MainNav() {
    const pathname = usePathname();
    return <MainNavView current={currentKey(pathname)} />;
}
