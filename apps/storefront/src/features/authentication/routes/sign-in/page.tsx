import type {Metadata} from 'next';
import {Suspense} from 'react';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';
import {LoginForm} from "./login-form";
import {Skeleton} from "@/components/ui/skeleton";
import {AuthShell} from "../../components/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Auth'});
    return {
        title: t('pageTitle'),
    };
}

function LoginFormSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-4 w-32"/>
                <Skeleton className="h-14 w-full rounded-2xl"/>
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-24"/>
                <Skeleton className="h-14 w-full rounded-2xl"/>
            </div>
            <Skeleton className="h-14 w-full rounded-full"/>
        </div>
    );
}

async function SignInContent({searchParams}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const resolvedParams = await searchParams;
    const redirectTo = resolvedParams?.redirectTo as string | undefined;

    return <LoginForm redirectTo={redirectTo}/>;
}

export default async function SignInPage({searchParams}: PageProps<'/[locale]/sign-in'>) {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Auth'});

    return (
        <AuthShell variant="sign-in" heading={t('loginHeading')} subheading={t('loginSubheading')} backLabel={t('backToStore')}>
            <Suspense fallback={<LoginFormSkeleton/>}>
                <SignInContent searchParams={searchParams}/>
            </Suspense>
        </AuthShell>
    );
}
