import type {ReactNode} from 'react';
import {Navbar} from '@/site/navigation/navbar';
import {Footer} from '@/site/footer';

/** Storefront chrome: top bar and full footer around the shopping pages. */
export default function ShopLayout({children}: {children: ReactNode}) {
    return (
        <>
            <Navbar />
            {children}
            <Footer />
        </>
    );
}
