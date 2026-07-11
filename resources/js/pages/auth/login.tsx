import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    return (
        <>
            <Head title="Autentificare" />

            <PasskeyVerify />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="flex flex-col gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Adresă de email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="nume@beecoded.ro"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Parolă</Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="ml-auto text-sm"
                                            tabIndex={5}
                                        >
                                            Ai uitat parola?
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Parola ta"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                />
                                <Label htmlFor="remember">
                                    Păstrează sesiunea activă
                                </Label>
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && (
                                    <Spinner data-icon="inline-start" />
                                )}
                                Intră în Hive
                            </Button>
                        </div>
                    </>
                )}
            </Form>

            {status && (
                <Alert>
                    <AlertDescription>{status}</AlertDescription>
                </Alert>
            )}
        </>
    );
}

Login.layout = {
    title: 'Bine ai revenit',
    description:
        'Autentifică-te cu contul intern pentru a continua în BEE CODED HIVE.',
};
