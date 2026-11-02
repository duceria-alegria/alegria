import type {Metadata} from 'next';
import {Suspense} from 'react';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';
import { RegistrationForm } from "./registration-form";
import { Skeleton } from "@/components/ui/skeleton";
import {AuthShell} from "../../components/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Auth'});
    return {
        title: t('createAccount'),
    };
}

function RegistrationFormSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-14 w-full rounded-full" />
        </div>
    );
}

async function RegisterContent({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
    const resolvedParams = await searchParams;
    const redirectTo = resolvedParams?.redirectTo as string | undefined;

    return <RegistrationForm redirectTo={redirectTo} />;
}

export default async function RegisterPage({searchParams}: PageProps<'/[locale]/register'>) {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Auth'});

    return (
        <AuthShell variant="register" heading={t('registerHeading')} subheading={t('registerSubheading')} backLabel={t('backToStore')}>
            <Suspense fallback={<RegistrationFormSkeleton />}>
                <RegisterContent searchParams={searchParams} />
            </Suspense>
        </AuthShell>
    );
}
