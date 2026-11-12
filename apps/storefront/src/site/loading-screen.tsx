import type {CSSProperties} from 'react';
import Image from 'next/image';
import {useTranslations} from 'next-intl';
import {cn} from '@/lib/utils';

interface LoadingScreenProps {
    /** `page` fills the content area (top bar and footer stay visible); `fullscreen` covers the whole window. */
    variant?: 'page' | 'fullscreen';
    className?: string;
}

const ORBIT_RADIUS = 96;

const ORBS = [
    {angle: 0, color: '--color-brand-pink', size: 'size-7'},
    {angle: 60, color: '--color-brand-cyan', size: 'size-5'},
    {angle: 120, color: '--color-brand-orange', size: 'size-7'},
    {angle: 180, color: '--color-brand-blue', size: 'size-5'},
    {angle: 240, color: '--color-brand-yellow', size: 'size-7'},
    {angle: 300, color: '--color-brand-red', size: 'size-5'},
] as const;

const DOTS = ['bg-brand-pink', 'bg-brand-yellow-deep', 'bg-brand-cyan'] as const;

// Colourful wait screen: the logo bobs inside a rainbow ring while candy orbs circle it.
// Fades in after a short delay (see .loader-appear), so quick loads never flash it.
export function LoadingScreen({variant = 'page', className}: LoadingScreenProps) {
    const t = useTranslations('Loading');

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'loader-appear flex flex-col items-center justify-center gap-6',
                variant === 'fullscreen'
                    ? 'fixed inset-0 z-50 bg-background/70 backdrop-blur-md'
                    : 'min-h-[60vh] flex-1',
                className,
            )}
        >
            <span className="sr-only">{t('description')}</span>
            <div aria-hidden="true" className="relative size-56" style={{'--r': `${ORBIT_RADIUS}px`} as CSSProperties}>
                <div className="loader-ring absolute inset-2 rounded-full opacity-60"/>
                {ORBS.map(orb => (
                    <span
                        key={orb.angle}
                        className={cn('loader-orb hero-orb absolute left-1/2 top-1/2 rounded-full', orb.size)}
                        style={{'--a': `${orb.angle}deg`, '--orb': `var(${orb.color})`} as CSSProperties}
                    />
                ))}
                <div className="absolute inset-0 flex items-center justify-center">
                    <Image
                        src="/brand/logo.svg"
                        alt=""
                        width={1074}
                        height={1056}
                        preload
                        sizes="144px"
                        className="loader-logo size-36 drop-shadow-[0_14px_12px_rgba(43,19,64,0.3)]"
                    />
                </div>
            </div>
            <p aria-hidden="true" className="flex items-end gap-1 font-display text-xl font-extrabold text-primary">
                {t('title').replace('…', '')}
                <span className="mb-1.5 flex gap-1">
                    {DOTS.map((color, i) => (
                        <span
                            key={color}
                            className={cn('loader-dot size-2 rounded-full', color)}
                            style={{animationDelay: `${i * 0.15}s`}}
                        />
                    ))}
                </span>
            </p>
        </div>
    );
}
