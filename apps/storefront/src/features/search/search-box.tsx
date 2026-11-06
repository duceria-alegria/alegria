'use client';

import {useEffect, useRef, useState, useTransition} from 'react';
import {useSearchParams} from 'next/navigation';
import {usePathname, useRouter} from '@/platform/i18n/navigation';
import {Search, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput} from '@/components/ui/input-group';
import {Spinner} from '@/components/ui/spinner';
import {useSearchPending} from '@/features/search/search-pending';

// Results update while typing: after a short pause, and not for a single letter.
const LIVE_SEARCH_DELAY_MS = 300;
const LIVE_SEARCH_MIN_CHARS = 2;

export function SearchBox() {
    const t = useTranslations('Search');
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [isPending, startTransition] = useTransition();
    const {setPending} = useSearchPending();
    const currentTerm = searchParams.get('q') || '';
    const [value, setValue] = useState(currentTerm);

    useEffect(() => {
        setPending(isPending);
    }, [isPending, setPending]);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    // The term can also change from the navbar search or the back button. While this field has the
    // focus the URL only echoes what is being typed, and a slow response must not overwrite
    // keystrokes that came after it.
    useEffect(() => {
        const input = inputRef.current;
        if (input && document.hasFocus() && document.activeElement === input) return;
        setValue(currentTerm);
    }, [currentTerm]);

    const applyTerm = (term: string, history: 'push' | 'replace') => {
        const trimmed = term.trim();
        if (trimmed === currentTerm) return;
        const params = new URLSearchParams(searchParams);
        if (trimmed) {
            params.set('q', trimmed);
        } else {
            params.delete('q');
        }
        // Keep sort and filters, but go back to page 1 since the result set changed.
        params.delete('page');
        const query = params.toString();
        const url = query ? `${pathname}?${query}` : pathname;
        startTransition(() => {
            if (history === 'push') {
                router.push(url);
            } else {
                router.replace(url);
            }
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setValue(next);
        clearTimeout(timerRef.current);
        const length = next.trim().length;
        if (length === 0) {
            applyTerm(next, 'replace');
        } else if (length >= LIVE_SEARCH_MIN_CHARS) {
            // `replace`: the back button should not walk through every partial word.
            timerRef.current = setTimeout(() => applyTerm(next, 'replace'), LIVE_SEARCH_DELAY_MS);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        clearTimeout(timerRef.current);
        applyTerm(value, 'push');
    };

    const handleClear = () => {
        clearTimeout(timerRef.current);
        setValue('');
        applyTerm('', 'push');
        inputRef.current?.focus();
    };

    return (
        <form role="search" onSubmit={handleSubmit}>
            <InputGroup className="h-11 rounded-full border-[1.5px] border-border bg-background shadow-none">
                <InputGroupAddon>
                    <Search className="size-5 text-primary" aria-hidden="true"/>
                </InputGroupAddon>
                <label htmlFor="shop-search-input" className="sr-only">{t('searchLabel')}</label>
                <InputGroupInput
                    id="shop-search-input"
                    ref={inputRef}
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    placeholder={t('searchPlaceholder')}
                    value={value}
                    onChange={handleChange}
                    className="h-full text-[15px] text-primary placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                />
                {(value || isPending) && (
                    <InputGroupAddon align="inline-end">
                        {isPending && <Spinner aria-label={t('searching')} className="text-muted-foreground"/>}
                        {value && (
                            <InputGroupButton
                                aria-label={t('clearSearch')}
                                size="icon-xs"
                                className="rounded-full text-primary"
                                onClick={handleClear}
                            >
                                <X className="size-4" strokeWidth={2.4} aria-hidden="true"/>
                            </InputGroupButton>
                        )}
                    </InputGroupAddon>
                )}
            </InputGroup>
        </form>
    );
}
