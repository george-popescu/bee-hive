// Components
import { Form, Head, setLayoutProps } from '@inertiajs/react';
import TextLink from '@/components/text-link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTranslations } from '@/hooks/use-translations';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

export default function VerifyEmail({ status }: { status?: string }) {
    const { t } = useTranslations();

    setLayoutProps({
        title: t('Verify email address'),
        description: t(
            'To continue, open the link we just sent to your email address.',
        ),
    });

    return (
        <>
            <Head title={t('Email verification')} />

            {status === 'verification-link-sent' && (
                <Alert>
                    <AlertDescription>
                        {t(
                            'A new verification link has been sent to your account email address.',
                        )}
                    </AlertDescription>
                </Alert>
            )}

            <Form {...send.form()} className="flex flex-col gap-6 text-center">
                {({ processing }) => (
                    <>
                        <Button disabled={processing} variant="secondary">
                            {processing && <Spinner data-icon="inline-start" />}
                            {t('Resend verification email')}
                        </Button>

                        <TextLink
                            href={logout()}
                            className="mx-auto block text-sm"
                        >
                            {t('Log out')}
                        </TextLink>
                    </>
                )}
            </Form>
        </>
    );
}
