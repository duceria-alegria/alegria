'use client';

import {createContext, useContext, useMemo, useState} from 'react';
import {cn} from '@/lib/utils';

interface SearchPendingValue {
    pending: boolean;
    setPending: (pending: boolean) => void;
}

const SearchPendingContext = createContext<SearchPendingValue>({pending: false, setPending: () => {}});

/**
 * Lets the search box tell the results area that a new search is loading, so the old results can
 * be dimmed instead of staying on screen with no sign that they are about to change.
 */
export function SearchPendingProvider({children}: {children: React.ReactNode}) {
    const [pending, setPending] = useState(false);
    const value = useMemo(() => ({pending, setPending}), [pending]);
    return <SearchPendingContext.Provider value={value}>{children}</SearchPendingContext.Provider>;
}

export function useSearchPending() {
    return useContext(SearchPendingContext);
}

export function SearchPendingArea({className, children}: {className?: string; children: React.ReactNode}) {
    const {pending} = useSearchPending();
    return (
        <div
            aria-busy={pending}
            className={cn('transition-opacity duration-200 motion-reduce:transition-none', pending && 'opacity-60', className)}
        >
            {children}
        </div>
    );
}
