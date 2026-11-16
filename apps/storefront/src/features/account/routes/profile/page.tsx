import type {Metadata} from 'next';
import {getActiveCustomer} from '@/features/account/customer';
import { ChangePasswordForm } from './change-password-form';
import { EditProfileForm } from './edit-profile-form';
import { EditEmailForm } from './edit-email-form';
import { ProfileHero } from './profile-hero';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Account'});
    return {
        title: t('profilePageTitle'),
    };
}

export default async function ProfilePage() {
    const customer = await getActiveCustomer();
    const locale = await getRouteLocale();

    return (
        <div className="space-y-6">
            <ProfileHero locale={locale} customer={customer} />

            <EditProfileForm customer={customer} />

            <div className="grid items-start gap-6 xl:grid-cols-2">
                <EditEmailForm currentEmail={customer?.emailAddress || ''} />
                <ChangePasswordForm />
            </div>
        </div>
    );
}
