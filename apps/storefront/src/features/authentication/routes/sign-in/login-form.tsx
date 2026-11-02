'use client';

import {useMemo, useState, useTransition} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import * as z from 'zod';
import {ArrowRight, Lock, Mail} from 'lucide-react';
import {loginAction} from './actions';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {PasswordInput} from '@/components/ui/password-input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Link } from '@/platform/i18n/navigation';
import {useTranslations} from 'next-intl';
import {fieldClassName, fieldIconClassName, fieldLabelClassName, fieldWrapperClassName} from '../../components/field-styles';

interface LoginFormProps {
    redirectTo?: string;
}

export function LoginForm({redirectTo}: LoginFormProps) {
    const t = useTranslations('Auth');
    const [isPending, startTransition] = useTransition();
    const [serverError, setServerError] = useState<string | null>(null);

    const loginSchema = useMemo(() => z.object({
        username: z.email(t('emailValidation')),
        password: z.string().min(1, t('passwordRequired')),
    }), [t]);

    type LoginFormData = z.infer<typeof loginSchema>;

    const form = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: '',
            password: '',
        },
    });

    const onSubmit = (data: LoginFormData) => {
        setServerError(null);

        startTransition(async () => {
            const formData = new FormData();
            formData.append('username', data.username);
            formData.append('password', data.password);
            if (redirectTo) {
                formData.append('redirectTo', redirectTo);
            }

            const result = await loginAction(undefined, formData);
            if (result?.error) {
                setServerError(result.error);
            }
        });
    };

    const registerHref = redirectTo
        ? `/register?redirectTo=${encodeURIComponent(redirectTo)}`
        : '/register';

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                <FormField
                    control={form.control}
                    name="username"
                    render={({field}) => (
                        <FormItem className="gap-2">
                            <FormLabel className={fieldLabelClassName}>{t('email')}</FormLabel>
                            <div className={fieldWrapperClassName}>
                                <Mail className={fieldIconClassName} aria-hidden="true"/>
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
                            <FormMessage/>
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({field}) => (
                        <FormItem className="gap-2">
                            <FormLabel className={fieldLabelClassName}>{t('password')}</FormLabel>
                            <div className={fieldWrapperClassName}>
                                <Lock className={fieldIconClassName} aria-hidden="true"/>
                                <FormControl>
                                    <PasswordInput
                                        autoComplete="current-password"
                                        placeholder={t('passwordPlaceholder')}
                                        disabled={isPending}
                                        className={`${fieldClassName} pr-14`}
                                        {...field}
                                    />
                                </FormControl>
                            </div>
                            <FormMessage/>
                        </FormItem>
                    )}
                />

                <div className="-mt-4 flex justify-end">
                    <Link
                        href="/forgot-password"
                        className="inline-flex min-h-11 items-center text-sm font-extrabold text-primary hover:underline"
                    >
                        {t('forgotPassword')}
                    </Link>
                </div>

                {serverError && (
                    <div role="alert" className="-mt-2 text-sm text-destructive">
                        {serverError}
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={isPending}
                    className="h-14 w-full gap-2.5 rounded-full text-base font-extrabold transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-purple-deep hover:shadow-lg hover:shadow-primary/35 active:translate-y-0 active:scale-[0.97] active:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
                >
                    {isPending ? t('signingIn') : t('signIn')}
                    {!isPending && <ArrowRight className="size-[18px] group-hover/button:animate-[arrow-nudge_0.9s_ease-in-out_infinite] group-active/button:animate-[arrow-launch_0.4s_ease-in-out] motion-reduce:animate-none" strokeWidth={2.4} aria-hidden="true"/>}
                </Button>

                <p className="text-center pt-1 text-[15px] text-muted-foreground">
                    {t('noAccount')}{' '}
                    <Link
                        href={registerHref}
                        className="font-extrabold text-primary underline decoration-brand-yellow decoration-[3px] underline-offset-[3px]"
                    >
                        {t('register')}
                    </Link>
                </p>
            </form>
        </Form>
    );
}
