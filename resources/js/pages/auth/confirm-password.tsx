import { Form, Head } from '@inertiajs/react';
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
import { store } from '@/routes/password/confirm';

export default function ConfirmPassword() {
    return (
        <>
            <Head title="Confirmare parolă" />

            <PasskeyVerify
                routes={{
                    options: confirmOptions(),
                    submit: confirmStore(),
                }}
                label="Confirmă cu passkey"
                loadingLabel="Se confirmă..."
                separator="Sau confirmă folosind parola"
            />

            <Form {...store.form()} resetOnSuccess={['password']}>
                {({ processing, errors }) => (
                    <div className="flex flex-col gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="password">Parolă</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                placeholder="Parola ta"
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
                                Confirmă parola
                            </Button>
                        </div>
                    </div>
                )}
            </Form>
        </>
    );
}

ConfirmPassword.layout = {
    title: 'Confirmă accesul',
    description:
        'Aceasta este o zonă securizată. Confirmă parola înainte de a continua.',
};
