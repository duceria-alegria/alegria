import type {ReactNode} from 'react';

/**
 * Route template: Next.js remounts it on every navigation, so the page content fades in
 * instead of switching abruptly. Layout chrome (top bar, footer) lives outside and stays put.
 */
export default function PageTransition({children}: {children: ReactNode}) {
    return (
        <div className="flex flex-1 flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none">
            {children}
        </div>
    );
}
