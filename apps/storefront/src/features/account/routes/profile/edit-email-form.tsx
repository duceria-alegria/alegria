'use client';

import { useActionState, useEffect } from 'react';
import { AtSign, Loader2, Mail, Send } from 'lucide-react';
import { requestEmailUpdateAction } from './actions';
import { ProfileFormMessage, ProfileSection, profileButtonClass, profileFieldClass } from './profile-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {useTranslations} from 'next-intl';

interface EditEmailFormProps {
    currentEmail: string;
}

export function EditEmailForm({ currentEmail }: EditEmailFormProps) {
    const t = useTranslations('Account');
    const [state, formAction, isPending] = useActionState(requestEmailUpdateAction, undefined);

    useEffect(() => {
        if (state?.success) {
            const form = document.getElementById('edit-email-form') as HTMLFormElement;
            form?.reset();
        }
    }, [state?.success]);

    return (
        <ProfileSection icon={Mail} tone="cyan" title={t('emailAddress')} description={t('updateEmailDescription')}>
            <form id="edit-email-form" action={formAction} className="space-y-5">
                <div className="space-y-2">
                    <p className="text-sm font-bold">{t('currentEmail')}</p>
                    <p className="flex items-center gap-2.5 rounded-xl border border-dashed border-brand-cyan/50 bg-pastel-cyan/40 px-3.5 py-2.5 text-[15px] font-semibold">
                        <AtSign className="size-4 shrink-0 text-brand-blue" strokeWidth={2.4} aria-hidden="true"/>
                        <span className="truncate">{currentEmail}</span>
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="newEmailAddress" className="font-bold">{t('newEmailAddress')}</Label>
                    <Input
                        id="newEmailAddress"
                        name="newEmailAddress"
                        type="email"
                        autoComplete="email"
                        placeholder={t('newEmailPlaceholder')}
                        required
                        disabled={isPending}
                        className={profileFieldClass}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password" className="font-bold">{t('currentPassword')}</Label>
                    <PasswordInput
                        id="password"
                        name="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        required
                        disabled={isPending}
                        className={profileFieldClass}
                    />
                    <p className="text-xs text-muted-foreground">
                        {t('confirmPasswordChange')}
                    </p>
                </div>
                {state?.error && <ProfileFormMessage tone="error">{state.error}</ProfileFormMessage>}
                {state?.success && <ProfileFormMessage tone="success">{t('verificationEmailSent')}</ProfileFormMessage>}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isPending} className={profileButtonClass}>
                        {isPending
                            ? <Loader2 className="size-4 animate-spin" aria-hidden="true"/>
                            : <Send className="size-4" strokeWidth={2.4} aria-hidden="true"/>}
                        {isPending ? t('updating') : t('updateEmail')}
                    </Button>
                </div>
            </form>
        </ProfileSection>
    );
}
