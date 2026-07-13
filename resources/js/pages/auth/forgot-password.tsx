// Components
import { Form, Head, setLayoutProps } from '@inertiajs/react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslations } from '@/hooks/use-translations';
import { login } from '@/routes';
import { email } from '@/routes/password';

export default function ForgotPassword({ status }: { status?: string }) {
    const { t } = useTranslations();

    setLayoutProps({
        title: t('Forgot password?'),
        description: t(
            'Enter the email address for your internal account and we will send you a password reset link.',
        ),
    });

    return (
        <>
            <Head title={t('Password recovery')} />

            {status && (
                <Alert>
                    <AlertDescription>{status}</AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col gap-6">
                <Form {...email.form()} className="flex flex-col gap-5">
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="email">
                                    {t('Email address')}
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    autoComplete="off"
                                    autoFocus
                                    placeholder="nume@beecoded.ro"
                                />

                                <InputError message={errors.email} />
                            </div>

                            <div className="flex items-center justify-start">
                                <Button
                                    className="w-full"
                                    disabled={processing}
                                    data-test="email-password-reset-link-button"
                                >
                                    {processing && (
                                        <Spinner data-icon="inline-start" />
                                    )}
                                    {t('Reset password link')}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                <div className="flex justify-center gap-1 text-center text-sm text-muted-foreground">
                    <span>{t('Back to')}</span>
                    <TextLink href={login()}>
                        {t('Log in').toLocaleLowerCase()}
                    </TextLink>
                </div>
            </div>
        </>
    );
}
