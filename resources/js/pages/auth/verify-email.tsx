// Components
import { Form, Head } from '@inertiajs/react';
import TextLink from '@/components/text-link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

export default function VerifyEmail({ status }: { status?: string }) {
    return (
        <>
            <Head title="Verificare email" />

            {status === 'verification-link-sent' && (
                <Alert>
                    <AlertDescription>
                        Un nou link de verificare a fost trimis la adresa
                        contului.
                    </AlertDescription>
                </Alert>
            )}

            <Form {...send.form()} className="flex flex-col gap-6 text-center">
                {({ processing }) => (
                    <>
                        <Button disabled={processing} variant="secondary">
                            {processing && <Spinner data-icon="inline-start" />}
                            Retrimite emailul de verificare
                        </Button>

                        <TextLink
                            href={logout()}
                            className="mx-auto block text-sm"
                        >
                            Deconectare
                        </TextLink>
                    </>
                )}
            </Form>
        </>
    );
}

VerifyEmail.layout = {
    title: 'Verifică adresa de email',
    description:
        'Pentru a continua, deschide linkul pe care tocmai l-am trimis pe email.',
};
