'use client';

import { useActionState, useEffect } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { updatePasswordAction } from './actions';
import { ProfileFormMessage, ProfileSection, profileButtonClass, profileFieldClass } from './profile-section';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {useTranslations} from 'next-intl';

export function ChangePasswordForm() {
    const t = useTranslations('Account');
    const [state, formAction, isPending] = useActionState(updatePasswordAction, undefined);

    useEffect(() => {
        if (state?.success) {
            const form = document.getElementById('change-password-form') as HTMLFormElement;
            form?.reset();
        }
    }, [state?.success]);

    return (
        <ProfileSection icon={ShieldCheck} tone="pink" title={t('changePassword')} description={t('changePasswordDescription')}>
            <form id="change-password-form" action={formAction} className="space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="font-bold">{t('currentPassword')}</Label>
                    <PasswordInput
                        id="currentPassword"
                        name="currentPassword"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        required
                        disabled={isPending}
                        className={profileFieldClass}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="newPassword" className="font-bold">{t('newPassword')}</Label>
                    <PasswordInput
                        id="newPassword"
                        name="newPassword"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        required
                        disabled={isPending}
                        className={profileFieldClass}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="font-bold">{t('confirmNewPassword')}</Label>
                    <PasswordInput
                        id="confirmPassword"
                        name="confirmPassword"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        required
                        disabled={isPending}
                        className={profileFieldClass}
                    />
                </div>
                {state?.error && <ProfileFormMessage tone="error">{state.error}</ProfileFormMessage>}
                {state?.success && <ProfileFormMessage tone="success">{t('passwordUpdated')}</ProfileFormMessage>}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isPending} className={profileButtonClass}>
                        {isPending
                            ? <Loader2 className="size-4 animate-spin" aria-hidden="true"/>
                            : <KeyRound className="size-4" strokeWidth={2.4} aria-hidden="true"/>}
                        {isPending ? t('updating') : t('updatePassword')}
                    </Button>
                </div>
            </form>
        </ProfileSection>
    );
}
