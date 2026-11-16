'use client';

import type {ReactNode} from 'react';
import {usePathname} from '@/platform/i18n/navigation';
import {cn} from '@/lib/utils';

/**
 * Page frame for the account section. The orders list is a wide table, so it uses the full width with a little
 * horizontal padding; the other account pages (addresses, profile, order detail) keep the narrower centered column.
 */
export function AccountShell({children}: {children: ReactNode}) {
    const pathname = usePathname();
    const isOrdersList = pathname.replace(/\/$/, '') === '/account/orders';

    return (
        <div
            className={cn(
                'py-30',
                isOrdersList ? 'w-full px-4 md:px-8' : 'container mx-auto max-w-5xl px-4'
            )}
        >
            {children}
        </div>
    );
}
