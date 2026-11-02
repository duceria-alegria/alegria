'use client';

import { useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { registerAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Link } from '@/platform/i18n/navigation';
import {useTranslations} from 'next-intl';
import {fieldClassName, fieldIconClassName, fieldLabelClassName, fieldWrapperClassName} from '../../components/field-styles';

function createRegistrationSchema(t: ReturnType<typeof useTranslations<'Auth'>>) {
    return z.object({
        fullName: z.string().trim().min(1, t('fullNameRequired')),
        emailAddress: z.string().email(t('emailValidation')),
        password: z.string().min(8, t('passwordMinLength')),
        confirmPassword: z.string(),
    }).refine((data) => data.password === data.confirmPassword, {
        message: t('passwordsMismatch'),
        path: ["confirmPassword"],
    });
}

type RegistrationFormData = z.infer<ReturnType<typeof createRegistrationSchema>>;

interface RegistrationFormProps {
    redirectTo?: string;
}

/** Vendure stores first and last name separately: the first word is the first name, the rest the last name. */
function splitFullName(fullName: string) {
    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    return {firstName, lastName: rest.join(' ')};
}

export function RegistrationForm({ redirectTo }: RegistrationFormProps) {
    const t = useTranslations('Auth');
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);
    const [showPasswords, setShowPasswords] = useState(false);

    const registrationSchema = useMemo(() => createRegistrationSchema(t), [t]);
    const form = useForm<RegistrationFormData>({
        resolver: zodResolver(registrationSchema),
        defaultValues: {
            fullName: '',
            emailAddress: '',
            password: '',
            confirmPassword: '',
        },
    });

    const onSubmit = (data: RegistrationFormData) => {
        setServerError(null);

        startTransition(async () => {
            const {firstName, lastName} = splitFullName(data.fullName);
            const formData = new FormData();
            formData.append('emailAddress', data.emailAddress);
            formData.append('firstName', firstName);
            if (lastName) formData.append('lastName', lastName);
            formData.append('password', data.password);
            if (redirectTo) {
                formData.append('redirectTo', redirectTo);
            }

            const result = await registerAction(undefined, formData);
            if (result?.error) {
                setServerError(result.error);
            }
        });
    };

    const signInHref = redirectTo
        ? `/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`
        : '/sign-in';

    const passwordType = showPasswords ? 'text' : 'password';

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                        <FormItem className="gap-2">
                            <FormLabel className={fieldLabelClassName}>{t('fullNameLabel')}</FormLabel>
                            <div className={fieldWrapperClassName}>
                                <User className={fieldIconClassName} aria-hidden="true" />
                                <FormControl>
                                    <Input
                                        type="text"
                                        autoComplete="name"
                                        placeholder={t('fullNamePlaceholder')}
                                        disabled={isPending}
                                        className={fieldClassName}
                                        {...field}
                                    />
                                </FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="emailAddress"
                    render={({ field }) => (
                        <FormItem className="gap-2">
                            <FormLabel className={fieldLabelClassName}>{t('emailAddressLabel')}</FormLabel>
                            <div className={fieldWrapperClassName}>
                                <Mail className={fieldIconClassName} aria-hidden="true" />
                                <FormControl>
                                    <Input
                                        type="email"
                                        autoComplete="email"
                                        placeholder={t('emailPlaceholder')}
                                        disabled={isPending}
                                        className={fieldClassName}
                                        {...field}
                                    />
                                </FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem className="gap-2">
                            <FormLabel className={fieldLabelClassName}>{t('passwordLabel')}</FormLabel>
                            <div className={fieldWrapperClassName}>
                                <Lock className={fieldIconClassName} aria-hidden="true" />
                                <FormControl>
                                    <Input
                                        type={passwordType}
                                        autoComplete="new-password"
                                        placeholder={t('createPasswordPlaceholder')}
                                        disabled={isPending}
                                        className={`${fieldClassName} pr-14`}
                                        {...field}
                                    />
                                </FormControl>
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords((prev) => !prev)}
                                    aria-label={showPasswords ? t('hidePasswords') : t('showPasswords')}
                                    aria-pressed={showPasswords}
                                    disabled={isPending}
                                    className="absolute right-1.5 top-1.5 flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50"
                                >
                                    {showPasswords
                                        ? <EyeOff className="size-5" aria-hidden="true" />
                                        : <Eye className="size-5" aria-hidden="true" />}
                                </button>
                            </div>
                            <FormDescription className="text-[13px]">{t('passwordHint')}</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                        <FormItem className="gap-2">
                            <FormLabel className={fieldLabelClassName}>{t('confirmPasswordLabel')}</FormLabel>
                            <div className={fieldWrapperClassName}>
                                <Lock className={fieldIconClassName} aria-hidden="true" />
                                <FormControl>
                                    <Input
                                        type={passwordType}
                                        autoComplete="new-password"
                                        placeholder={t('confirmPasswordPlaceholder')}
                                        disabled={isPending}
                                        className={fieldClassName}
                                        {...field}
                                    />
                                </FormControl>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {serverError && (
                    <div role="alert" className="-mt-2 text-sm text-destructive">
                        {serverError}
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={isPending}
                    className="h-14 w-full gap-2.5 rounded-full text-base font-extrabold hover:bg-brand-purple-deep"
                >
                    {isPending ? t('creatingAccount') : t('createAccount')}
                    {!isPending && <ArrowRight className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />}
                </Button>

                <p className="text-center pt-1 text-[15px] text-muted-foreground">
                    {t('alreadyHaveAccount')}{' '}
                    <Link
                        href={signInHref}
                        className="font-extrabold text-primary underline decoration-brand-yellow decoration-[3px] underline-offset-[3px]"
                    >
                        {t('signInLink')}
                    </Link>
                </p>
            </form>
        </Form>
    );
}
