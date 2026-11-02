import type {ReactNode} from 'react';
import {Copyright} from '@/site/copyright';

/** Sign-in and register pages: no top bar or footer, only a discreet copyright line. */
export default function AuthLayout({children}: {children: ReactNode}) {
    return (
        <>
            {children}
            <footer className="relative z-10 px-5 pb-6 pt-2 text-center">
                <Copyright className="text-xs text-muted-foreground/70" />
            </footer>
        </>
    );
}
