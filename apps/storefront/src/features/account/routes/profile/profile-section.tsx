import type {ReactNode} from 'react';
import type {LucideIcon} from 'lucide-react';
import {CircleAlert, CircleCheck} from 'lucide-react';
import {cn} from '@/lib/utils';

/** Shared look for the profile forms' inputs: taller and rounder than the default shadcn field. */
export const profileFieldClass = 'h-11 rounded-xl bg-white px-3.5 text-[15px] md:text-[15px]';

/** Shared look for the profile forms' submit buttons. */
export const profileButtonClass = 'h-11 gap-2 rounded-full px-6 text-[15px] font-extrabold shadow-button hover:bg-brand-purple-deep';

const tones = {
    lavender: 'bg-pastel-lavender text-primary',
    cyan: 'bg-pastel-cyan text-brand-blue',
    pink: 'bg-pastel-pink text-brand-pink',
} as const;

interface ProfileSectionProps {
    icon: LucideIcon;
    tone: keyof typeof tones;
    title: string;
    description: string;
    children: ReactNode;
    className?: string;
}

export function ProfileSection({icon: Icon, tone, title, description, children, className}: ProfileSectionProps) {
    return (
        <section className={cn('rounded-3xl bg-card p-5 shadow-tile ring-1 ring-border/70 sm:p-7', className)}>
            <header className="mb-6 flex items-start gap-4">
                <span aria-hidden="true" className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', tones[tone])}>
                    <Icon className="size-[22px]" strokeWidth={2.2}/>
                </span>
                <div className="min-w-0 pt-0.5">
                    <h2 className="font-display text-xl font-extrabold leading-tight">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
            </header>
            {children}
        </section>
    );
}

export function ProfileFormMessage({tone, children}: {tone: 'success' | 'error'; children: ReactNode}) {
    const Icon = tone === 'success' ? CircleCheck : CircleAlert;
    return (
        <p
            role={tone === 'success' ? 'status' : 'alert'}
            className={cn(
                'flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold animate-fade-up',
                tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-pastel-red text-brand-red',
            )}
        >
            <Icon className="mt-px size-4 shrink-0" strokeWidth={2.4} aria-hidden="true"/>
            <span>{children}</span>
        </p>
    );
}
