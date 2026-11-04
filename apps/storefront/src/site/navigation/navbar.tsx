import Image from "next/image";
import {NavigationLink} from '@/site/navigation/navigation-link';
import {NavbarCart} from '@/site/navigation/navbar/navbar-cart';
import {NavbarUser} from '@/site/navigation/navbar/navbar-user';
import {CurrencyPickerWrapper} from '@/site/navigation/navbar/currency-picker-wrapper';
import {MainNav, MainNavView} from '@/site/navigation/main-nav';
import {Suspense} from "react";
import {SearchInput} from '@/site/navigation/search-input';
import {NavbarUserSkeleton} from '@/site/navigation/skeletons/navbar-user-skeleton';
import {SearchInputSkeleton} from '@/site/navigation/skeletons/search-input-skeleton';
import {SITE_NAME} from '@/config/metadata';

export function Navbar() {
    return (
        <>
            <header className="bg-background">
                <div className="container-page pt-3 max-sm:pb-2.5 max-sm:pt-2.5">
                    {/* On phones everything stays on one row; the search panel anchors to this row to span it. */}
                    <div className="relative flex flex-wrap items-center justify-between gap-x-2.5 gap-y-3 max-sm:flex-nowrap max-sm:gap-x-2">
                        <NavigationLink href="/" className="block shrink-0">
                            <Image
                                src="/brand/logo.png"
                                alt={SITE_NAME}
                                width={326}
                                height={320}
                                preload
                                className="block h-14 w-auto sm:h-16"
                            />
                        </NavigationLink>
                        <div className="flex h-11 min-w-11 flex-[1_1_44px] justify-end">
                            <Suspense fallback={<SearchInputSkeleton />}>
                                <SearchInput/>
                            </Suspense>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-2.5 max-sm:gap-2">
                            <Suspense>
                                <CurrencyPickerWrapper />
                            </Suspense>
                            <Suspense fallback={<NavbarUserSkeleton />}>
                                <NavbarUser/>
                            </Suspense>
                            <Suspense>
                                <NavbarCart/>
                            </Suspense>
                        </div>
                    </div>
                    <div aria-hidden="true" className="mt-1 h-px bg-border/50 shadow-[0_4px_10px_rgba(75,29,110,0.2),0_12px_28px_rgba(75,29,110,0.14)] max-sm:hidden" />
                </div>
            </header>
            <Suspense fallback={<MainNavView />}>
                <MainNav />
            </Suspense>
        </>
    );
}
