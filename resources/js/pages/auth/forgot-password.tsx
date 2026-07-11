// Components
import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { email } from '@/routes/password';

export default function ForgotPassword({ status }: { status?: string }) {
    return (
        <>
            <Head title="Recuperare parolă" />

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
                                <Label htmlFor="email">Adresă de email</Label>
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
                                    Trimite linkul de resetare
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                <div className="flex justify-center gap-1 text-center text-sm text-muted-foreground">
                    <span>Înapoi la</span>
                    <TextLink href={login()}>autentificare</TextLink>
                </div>
            </div>
        </>
    );
}

ForgotPassword.layout = {
    title: 'Ai uitat parola?',
    description:
        'Introdu adresa contului intern și îți trimitem un link de resetare.',
};
