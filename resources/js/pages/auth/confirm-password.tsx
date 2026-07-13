import { Form, Head, setLayoutProps } from '@inertiajs/react';
import {
    index as confirmOptions,
    store as confirmStore,
} from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslations } from '@/hooks/use-translations';
import { store } from '@/routes/password/confirm';

export default function ConfirmPassword() {
    const { t } = useTranslations();

    setLayoutProps({
        title: t('Confirm access'),
        description: t(
            'This is a secure area. Confirm your password before continuing.',
        ),
    });

    return (
        <>
            <Head title={t('Confirm password')} />

            <PasskeyVerify
                routes={{
                    options: confirmOptions(),
                    submit: confirmStore(),
                }}
                label={t('Confirm with a passkey')}
                loadingLabel={t('Confirming...')}
                separator={t('Use a password instead')}
            />

            <Form {...store.form()} resetOnSuccess={['password']}>
                {({ processing, errors }) => (
                    <div className="flex flex-col gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="password">{t('Password')}</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                placeholder={t('Your password')}
                                autoComplete="current-password"
                                autoFocus
                            />

                            <InputError message={errors.password} />
                        </div>

                        <div className="flex items-center">
                            <Button
                                className="w-full"
                                disabled={processing}
                                data-test="confirm-password-button"
                            >
                                {processing && (
                                    <Spinner data-icon="inline-start" />
                                )}
                                {t('Confirm password')}
                            </Button>
                        </div>
                    </div>
                )}
            </Form>
        </>
    );
}
