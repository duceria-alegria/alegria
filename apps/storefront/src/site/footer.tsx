import Image from "next/image";
import {getRouteLocale} from '@/platform/i18n/server';
import {cacheLife, cacheTag} from 'next/cache';
import {getTopCollections} from '@/features/collections/data';
import {NavigationLink} from '@/site/navigation/navigation-link';
import {getTranslations} from 'next-intl/server';
import {SITE_NAME} from '@/config/metadata';
import {CONTACT} from '@/config/contact';
import {Copyright} from '@/site/copyright';


const headingClass = "mb-2 text-[13px] font-extrabold uppercase tracking-[0.08em] text-brand-yellow";
const linkClass = "inline-block py-2 text-[15px] text-white/90 transition-colors hover:text-brand-yellow";

export async function Footer() {
    'use cache'
    cacheLife('days');

    const locale = await getRouteLocale();
    cacheTag(`footer-${locale}`);

    const t = await getTranslations({locale, namespace: 'Footer'});
    const collections = await getTopCollections(locale);
    const contactLines = [
        CONTACT.phone && <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className={linkClass}>{CONTACT.phone}</a>,
        CONTACT.email && <a href={`mailto:${CONTACT.email}`} className={linkClass}>{CONTACT.email}</a>,
        CONTACT.address && <span className="inline-block py-2 text-[15px] text-white/90">{CONTACT.address}</span>,
        CONTACT.hours && <span className="inline-block py-2 text-[15px] text-white/90">{CONTACT.hours}</span>,
    ].filter(Boolean);

    return (
        <footer id="contacto" className="mt-auto bg-primary text-primary-foreground">
            <div className="container-page pb-7 pt-[clamp(40px,6vw,72px)]">
                <div className="flex flex-wrap gap-x-14 gap-y-10">
                    <div className="flex min-w-0 flex-[2_1_280px] flex-col items-start gap-4">
                        {/* Same logo file as the top bar, unaltered. The hairline white halo keeps its dark outline readable on the purple footer; the second shadow lifts it. */}
                        <NavigationLink href="/" className="block self-center sm:self-start">
                            <Image
                                src="/brand/logo.svg"
                                alt={SITE_NAME}
                                width={358}
                                height={352}
                                className="block h-40 w-auto sm:h-30[filter:drop-shadow(0_0_1.5px_#fff)_drop-shadow(0_8px_14px_rgb(0_0_0/0.45))]"
                            />
                        </NavigationLink>
                        <p className="max-w-[34ch] self-center text-center text-[15px] leading-relaxed text-white/80 sm:self-start sm:text-left">
                            {t('description')}
                        </p>
                    </div>

                    <div className="min-w-0 flex-[1_1_140px]">
                        <h2 className={headingClass}>{t('shop')}</h2>
                        <ul className="flex flex-col">
                            {collections.map((collection) => (
                                <li key={collection.id}>
                                    <NavigationLink href={`/collection/${collection.slug}`} className={linkClass}>
                                        {collection.name}
                                    </NavigationLink>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="min-w-0 flex-[1_1_140px]">
                        <h2 className={headingClass}>{t('customer')}</h2>
                        <ul className="flex flex-col">
                            <li>
                                <NavigationLink href="/search" className={linkClass}>{t('shopAll')}</NavigationLink>
                            </li>
                            <li>
                                <NavigationLink href="/account/orders" className={linkClass}>{t('orders')}</NavigationLink>
                            </li>
                            <li>
                                <NavigationLink href="/account/profile" className={linkClass}>{t('account')}</NavigationLink>
                            </li>
                        </ul>
                    </div>

                    {contactLines.length > 0 && (
                        <div className="min-w-0 flex-[1_1_140px]">
                            <h2 className={headingClass}>{t('contact')}</h2>
                            <ul className="flex flex-col">
                                {contactLines.map((line, index) => (
                                    <li key={index}>{line}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Bottom Section */}
                <div className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/20 pt-5 text-sm text-white/80">
                    <Copyright/>
                    <svg width="48" height="12" viewBox="0 0 64 12" aria-hidden="true" className="text-brand-yellow">
                        <path d="M3 3 Q32 13 61 3" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                    </svg>
                </div>
            </div>
        </footer>
    );
}
