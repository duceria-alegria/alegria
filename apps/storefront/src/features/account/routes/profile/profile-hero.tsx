import {CalendarHeart, Heart, Mail} from 'lucide-react';
import {getTranslations} from 'next-intl/server';

interface ProfileHeroProps {
    locale: string;
    customer: {
        firstName: string;
        lastName: string;
        emailAddress: string;
        createdAt: string;
    } | null;
}

/** Candy-sprinkle confetti scattered over the banner (position, tilt and colour of each one). */
const sprinkles = [
    'top-[14%] right-[8%] rotate-[28deg] bg-brand-yellow',
    'top-[48%] right-[18%] -rotate-[18deg] bg-brand-pink',
    'top-[20%] right-[26%] rotate-[64deg] bg-brand-cyan',
    'bottom-[34%] right-[4%] -rotate-[40deg] bg-brand-orange',
    'top-[8%] right-[19%] rotate-[12deg] bg-brand-pink',
    'bottom-[30%] right-[30%] rotate-[80deg] bg-brand-yellow',
];

export async function ProfileHero({locale, customer}: ProfileHeroProps) {
    const t = await getTranslations({locale, namespace: 'Account'});
    const initials = [customer?.firstName, customer?.lastName]
        .map((name) => name?.trim().charAt(0) ?? '')
        .join('')
        .toUpperCase();
    const memberSince = customer?.createdAt
        ? new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'}).format(new Date(customer.createdAt))
        : null;

    return (
        <section className="relative overflow-hidden rounded-[28px] bg-primary text-primary-foreground shadow-card">
            {/* Soft colour washes and sprinkles; purely decorative. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute -right-16 -top-24 size-72 rounded-full bg-brand-pink/45 blur-3xl"/>
                <div className="absolute -bottom-28 right-1/3 size-64 rounded-full bg-brand-cyan/30 blur-3xl"/>
                <div className="absolute -left-20 -bottom-20 size-56 rounded-full bg-brand-yellow/20 blur-3xl"/>
                {sprinkles.map((position) => (
                    <span key={position} className={`absolute hidden h-2 w-6 rounded-full opacity-90 xl:block ${position}`}/>
                ))}
            </div>

            <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-7 sm:p-8">
                <div className="relative w-fit shrink-0">
                    <div className="grid size-20 -rotate-3 place-items-center rounded-[26px] bg-brand-yellow font-display text-3xl font-extrabold text-primary shadow-button ring-4 ring-white/25 sm:size-24 sm:text-4xl">
                        {initials || <span aria-hidden="true">🍭</span>}
                    </div>
                    <span aria-hidden="true" className="absolute -bottom-1.5 -right-1.5 grid size-8 place-items-center rounded-full bg-brand-pink text-white ring-4 ring-primary">
                        <Heart className="size-3.5 fill-current" strokeWidth={2.4}/>
                    </span>
                </div>

                <div className="min-w-0 space-y-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em]">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-yellow"/>
                        {t('heroBadge')}
                    </span>
                    <h1 className="font-display text-[length:clamp(28px,4vw,40px)] font-extrabold leading-[1.05] text-balance">
                        {t('hello', {name: customer?.firstName || t('profile')})}
                    </h1>
                    <p className="max-w-[52ch] text-[15px] text-white/80">{t('heroSubtitle')}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1 text-sm font-semibold text-white/90">
                        {customer?.emailAddress && (
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                                <Mail className="size-4 shrink-0 text-brand-yellow" strokeWidth={2.4} aria-hidden="true"/>
                                <span className="truncate">{customer.emailAddress}</span>
                            </span>
                        )}
                        {memberSince && (
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarHeart className="size-4 shrink-0 text-brand-yellow" strokeWidth={2.4} aria-hidden="true"/>
                                {t('memberSince', {date: memberSince})}
                            </span>
                        )}
                    </div>
                </div>
            </div>

        </section>
    );
}
