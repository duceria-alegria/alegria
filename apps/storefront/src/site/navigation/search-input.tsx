'use client';

import './search-input.css';
import {useState, useEffect, useRef} from 'react';
import {useSearchParams} from 'next/navigation';
import {useRouter} from '@/platform/i18n/navigation';
import {Search, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {cn} from '@/lib/utils';

export function SearchInput() {
    const t = useTranslations('Navigation');
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const wasOpen = useRef(false);

    useEffect(() => {
        setSearchValue(searchParams.get('q') || '');
    }, [searchParams]);

    // Move focus once the panel (or the trigger) has become visible again after its transition.
    useEffect(() => {
        const target = open ? inputRef : wasOpen.current ? triggerRef : null;
        wasOpen.current = open;
        if (!target) return;
        const id = window.setTimeout(() => target.current?.focus(), open ? 200 : 520);
        return () => window.clearTimeout(id);
    }, [open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchValue.trim()) return;
        router.push(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    };

    return (
        <div className={cn('relative h-11 w-11', open && 'search-open')}>
            <button
                ref={triggerRef}
                type="button"
                aria-label={t('openSearch')}
                aria-expanded={open}
                aria-controls="site-search"
                onClick={() => setOpen(true)}
                className="search-trigger flex size-11 items-center justify-center rounded-full border-[1.5px] border-border bg-background text-primary transition-colors hover:bg-accent"
            >
                <Search className="size-5" aria-hidden="true" />
            </button>
            <form
                id="site-search"
                role="search"
                onSubmit={handleSubmit}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') setOpen(false);
                }}
                className="search-wrap absolute right-0 top-0 z-50 h-11"
            >
                <div className="search-panel flex h-full w-full items-center gap-2.5 rounded-full bg-background pl-[18px]">
                    <Search className="search-icon size-5 shrink-0 text-primary" aria-hidden="true" />
                    <label htmlFor="site-search-input" className="sr-only">{t('searchProducts')}</label>
                    <input
                        id="site-search-input"
                        ref={inputRef}
                        type="search"
                        placeholder={t('searchProducts')}
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="h-full min-w-0 flex-1 bg-transparent p-0 text-[15px] text-primary outline-none placeholder:text-muted-foreground"
                    />
                    <button
                        type="button"
                        aria-label={t('closeSearch')}
                        onClick={() => setOpen(false)}
                        className="search-close flex size-11 shrink-0 items-center justify-center rounded-full bg-clip-content p-1 text-primary hover:bg-accent"
                    >
                        <X className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
                    </button>
                </div>
            </form>
        </div>
    );
}
