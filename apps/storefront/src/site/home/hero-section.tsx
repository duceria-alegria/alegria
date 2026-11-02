import {ArrowRight} from "lucide-react";
import {Button} from "@/components/ui/button";
import { Link } from '@/platform/i18n/navigation';
import {getTranslations} from 'next-intl/server';
import {getRouteLocale} from '@/platform/i18n/server';
import {HeroStage} from '@/site/home/hero-stage';

export async function HeroSection() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Hero'});
    return (
        <section id="inicio" className="container-page overflow-x-clip pb-[clamp(40px,6vw,88px)] pt-[clamp(28px,5vw,64px)]">
            <div className="flex flex-wrap items-center gap-[clamp(28px,5vw,64px)]">
                <div className="flex min-w-0 flex-[1_1_340px] flex-col items-start gap-5">
                    <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-1.5 text-[13px] font-extrabold uppercase tracking-[0.06em]">
                        <span aria-hidden="true" className="size-2 rounded-full bg-brand-pink" />
                        {t('badge')}
                    </span>
                    <h1 className="font-display text-[length:clamp(38px,6vw,68px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-balance">
                        {t('title')}{" "}
                        <span className="underline decoration-brand-yellow decoration-[0.16em] underline-offset-[0.06em] [text-decoration-skip-ink:none]">
                            {t('titleHighlight')}
                        </span>
                    </h1>
                    <p className="max-w-[46ch] text-[length:clamp(16px,1.6vw,19px)] leading-relaxed text-muted-foreground">
                        {t('subtitle')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                        <Button
                            render={<Link href="/search" />}
                            nativeButton={false}
                            className="h-[52px] gap-2.5 rounded-full px-[26px] text-base font-extrabold hover:bg-brand-purple-deep"
                        >
                            {t('shopNow')}
                            <ArrowRight className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
                        </Button>
                        <Button
                            render={<Link href="/#caja" />}
                            nativeButton={false}
                            variant="outline"
                            className="h-[52px] rounded-full border-2 border-primary px-[26px] text-base font-extrabold hover:bg-accent"
                        >
                            {t('buildBox')}
                        </Button>
                    </div>
                </div>
                <div className="mx-auto min-w-0 max-w-[560px] flex-[1_1_340px] pt-4 sm:pt-2">
                    <HeroStage alt={t('imageAlt')} />
                </div>
            </div>
        </section>
    );
}
