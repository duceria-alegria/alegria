import Image from 'next/image';
import type {ReactNode} from 'react';
import {ArrowLeft} from 'lucide-react';
import {Link} from '@/platform/i18n/navigation';

type AuthShellVariant = 'sign-in' | 'register';

interface AuthShellProps {
    variant: AuthShellVariant;
    heading: string;
    subheading: string;
    backLabel: string;
    children: ReactNode;
}

const shapesByVariant: Record<AuthShellVariant, string[]> = {
    'sign-in': [
        '-left-36 -top-36 size-[340px] bg-brand-yellow-soft',
        '-bottom-40 -right-40 size-[400px] bg-pastel-pink',
        'bottom-[12%] left-[7%] size-[150px] bg-pastel-cyan',
        'right-[9%] top-[18%] size-[90px] bg-pastel-lavender',
        'left-[16%] top-[30%] size-[22px] border-[3px] border-brand-outline bg-brand-pink',
        'bottom-[24%] right-[20%] size-[18px] border-[3px] border-brand-outline bg-brand-orange',
        'right-[28%] top-[12%] size-4 border-[3px] border-brand-outline bg-brand-cyan',
    ],
    register: [
        '-left-36 -top-36 size-[340px] bg-pastel-pink',
        '-bottom-40 -right-40 size-[400px] bg-brand-yellow-soft',
        'right-[7%] top-[14%] size-[150px] bg-pastel-cyan',
        'bottom-[14%] left-[8%] size-[90px] bg-pastel-lavender',
        'right-[17%] top-[38%] size-[22px] border-[3px] border-brand-outline bg-brand-pink',
        'bottom-[30%] left-[19%] size-[18px] border-[3px] border-brand-outline bg-brand-orange',
        'left-[26%] top-[14%] size-4 border-[3px] border-brand-outline bg-brand-cyan',
    ],
};

/** Branded page frame shared by the sign-in and register routes: candy shapes, mascot and white card. */
export function AuthShell({variant, heading, subheading, backLabel, children}: AuthShellProps) {
    return (
        <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 pb-16 pt-28 sm:px-10 sm:pt-32">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                {shapesByVariant[variant].map((shape) => (
                    <span key={shape} className={`absolute rounded-full ${shape}`}/>
                ))}
            </div>

            <Link
                href="/"
                className="group absolute left-5 top-5 z-20 inline-flex min-h-11 items-center gap-2 text-[15px] font-extrabold text-primary transition-colors hover:text-brand-purple-deep sm:left-10 sm:top-8"
            >
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.4} aria-hidden="true" />
                <span className="underline decoration-brand-yellow decoration-[3px] underline-offset-[3px] transition-[text-decoration-thickness] group-hover:decoration-[5px]">
                    {backLabel}
                </span>
            </Link>

            <div className="relative w-full max-w-[480px]">
                <Image
                    src="/brand/mascot.png"
                    alt=""
                    width={305}
                    height={240}
                    className="absolute bottom-[calc(100%-16px)] right-[clamp(20px,6vw,36px)] z-0 block h-[84px] w-auto"
                />
                <section
                    className="relative z-10 flex flex-col gap-7 rounded-[28px] border border-[#efe8f6] bg-card px-6 py-9 shadow-[0_25px_50px_-12px_rgba(75,29,110,0.25)] sm:px-11 sm:py-14">
                    <div className="space-y-3">
                        <h1 className="font-display text-[clamp(28px,4vw,34px)] font-extrabold leading-[1.1] tracking-[-0.01em] text-primary">
                            {heading}
                        </h1>
                        <p className="text-base leading-relaxed text-muted-foreground">
                            {subheading}
                        </p>
                    </div>
                    {children}
                </section>
            </div>
        </main>
    );
}
