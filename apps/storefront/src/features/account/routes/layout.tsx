import type {Metadata} from 'next';
import {Suspense} from 'react';
import {noIndexRobots} from '@/config/metadata';
import {AccountNavLinks} from '@/features/account/components/account-nav-links';
import {AccountShell} from '@/features/account/components/account-shell';

export const metadata: Metadata = {
    robots: noIndexRobots(),
};

const navItems = [
    {href: '/account/orders', labelKey: 'orders', icon: 'Package'},
    {href: '/account/addresses', labelKey: 'addresses', icon: 'MapPin'},
    {href: '/account/profile', labelKey: 'profile', icon: 'User'},
];

export default async function AccountLayout({children}: LayoutProps<'/[locale]/account'>) {
    return (
        <AccountShell>
            <div className="mb-6">
                <Suspense>
                    <AccountNavLinks items={navItems} />
                </Suspense>
            </div>
            <main className="min-w-0">
                {children}
            </main>
        </AccountShell>
    );
}
