'use client'

import {ComponentProps, useTransition} from "react";
import {User} from 'lucide-react';
import {logoutAction} from '@/features/authentication/logout';
import {useRouter} from '@/platform/i18n/navigation';
import {useTranslations} from 'next-intl';

interface LoginButtonProps extends ComponentProps<'button'> {
    isLoggedIn: boolean;
}

export function LoginButton({isLoggedIn, ...props}: LoginButtonProps) {
    const t = useTranslations('Navigation');
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    return (
        <button {...props} aria-disabled={isPending}
                onClick={() => {
                    if (isLoggedIn) {
                        startTransition(async () => {
                            await logoutAction()
                        })
                    } else {
                        router.push('/sign-in')
                    }
                }}>
            {!isLoggedIn && <User className="size-5" aria-hidden="true" />}
            {isLoggedIn ? t('signOut') : t('signIn')}
        </button>
    )
}
