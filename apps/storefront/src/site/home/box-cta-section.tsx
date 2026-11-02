import {ArrowRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Link} from '@/platform/i18n/navigation';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';

export async function BoxCtaSection() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Home'});

    return (
        <section id="caja" className="container-page pb-[clamp(56px,7vw,104px)]">
            <div className="flex flex-wrap items-center gap-x-12 gap-y-7 overflow-hidden rounded-[32px] bg-brand-yellow p-[clamp(28px,5vw,56px)]">
                <div className="flex min-w-0 flex-[1_1_300px] flex-col items-start gap-4">
                    <h2 className="font-display text-[length:clamp(28px,4vw,44px)] font-extrabold leading-[1.08] text-balance">
                        {t('buildBox.title')}
                    </h2>
                    <p className="max-w-[42ch] text-[17px] leading-relaxed">{t('buildBox.description')}</p>
                    <Button
                        render={<Link href="/search" />}
                        nativeButton={false}
                        className="mt-2 h-[52px] gap-2.5 rounded-full px-[26px] text-base font-extrabold hover:bg-brand-purple-deep"
                    >
                        {t('buildBox.cta')}
                        <ArrowRight className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
                    </Button>
                </div>
                <div className="flex min-w-0 flex-[1_1_280px] justify-center">
                    <svg viewBox="0 0 320 200" aria-hidden="true" className="block h-auto w-full max-w-[380px]">
                        <g className="stroke-brand-outline" strokeWidth="4" strokeLinejoin="round">
                            <circle cx="70" cy="128" r="46" className="fill-brand-pink"/>
                            <circle cx="160" cy="146" r="38" className="fill-brand-cyan"/>
                            <circle cx="246" cy="112" r="48" className="fill-brand-orange"/>
                            <circle cx="118" cy="52" r="34" className="fill-brand-blue"/>
                            <circle cx="206" cy="46" r="28" className="fill-primary"/>
                        </g>
                        <g className="fill-white">
                            <ellipse cx="52" cy="110" rx="9" ry="5" transform="rotate(-45 52 110)"/>
                            <ellipse cx="145" cy="131" rx="7.5" ry="4.5" transform="rotate(-45 145 131)"/>
                            <ellipse cx="226" cy="92" rx="9.5" ry="5.5" transform="rotate(-45 226 92)"/>
                            <ellipse cx="104" cy="38" rx="7" ry="4" transform="rotate(-45 104 38)"/>
                            <ellipse cx="195" cy="35" rx="5.5" ry="3.5" transform="rotate(-45 195 35)"/>
                        </g>
                    </svg>
                </div>
            </div>
        </section>
    );
}
