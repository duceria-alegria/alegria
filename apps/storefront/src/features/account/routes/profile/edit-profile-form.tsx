'use client';

import { useActionState, useEffect } from 'react';
import { Loader2, Save, UserRound } from 'lucide-react';
import { updateCustomerAction } from './actions';
import { ProfileFormMessage, ProfileSection, profileButtonClass, profileFieldClass } from './profile-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {useTranslations} from 'next-intl';

interface EditProfileFormProps {
    customer: {
        firstName: string;
        lastName: string;
    } | null;
}

export function EditProfileForm({ customer }: EditProfileFormProps) {
    const t = useTranslations('Account');
    const [state, formAction, isPending] = useActionState(updateCustomerAction, undefined);

    useEffect(() => {
        if (state?.success) {
            const form = document.getElementById('edit-profile-form') as HTMLFormElement;
            form?.reset();
        }
    }, [state?.success]);

    return (
        <ProfileSection icon={UserRound} tone="lavender" title={t('personalInformation')} description={t('updatePersonalDetails')}>
            <form id="edit-profile-form" action={formAction} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="firstName" className="font-bold">{t('firstName')}</Label>
                        <Input
                            id="firstName"
                            name="firstName"
                            type="text"
                            autoComplete="given-name"
                            placeholder={t('firstNamePlaceholder')}
                            defaultValue={customer?.firstName || ''}
                            required
                            disabled={isPending}
                            className={profileFieldClass}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lastName" className="font-bold">{t('lastName')}</Label>
                        <Input
                            id="lastName"
                            name="lastName"
                            type="text"
                            autoComplete="family-name"
                            placeholder={t('lastNamePlaceholder')}
                            defaultValue={customer?.lastName || ''}
                            required
                            disabled={isPending}
                            className={profileFieldClass}
                        />
                    </div>
                </div>
                {state?.error && <ProfileFormMessage tone="error">{state.error}</ProfileFormMessage>}
                {state?.success && <ProfileFormMessage tone="success">{t('profileUpdated')}</ProfileFormMessage>}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isPending} className={profileButtonClass}>
                        {isPending
                            ? <Loader2 className="size-4 animate-spin" aria-hidden="true"/>
                            : <Save className="size-4" strokeWidth={2.4} aria-hidden="true"/>}
                        {isPending ? t('updating') : t('saveChanges')}
                    </Button>
                </div>
            </form>
        </ProfileSection>
    );
}
