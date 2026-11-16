import type {ReactNode} from 'react';
import {cn} from '@/lib/utils';

/**
 * Page frame for the account section. The orders list is a wide table, so a page that renders an element with
 * `data-account-wide` (the orders list) gets the full width with a little horizontal padding; the other account pages
 * (addresses, profile, order detail) keep the narrower centered column. It is decided with CSS `:has()` instead of
 * `usePathname()`, which would force the whole layout out of the prerender.
 */
export function AccountShell({children}: {children: ReactNode}) {
    return (
        <div
            className={cn(
                'container mx-auto max-w-5xl px-4 py-30',
                'has-[[data-account-wide]]:max-w-none has-[[data-account-wide]]:px-4 md:has-[[data-account-wide]]:px-8'
            )}
        >
            {children}
        </div>
    );
}
