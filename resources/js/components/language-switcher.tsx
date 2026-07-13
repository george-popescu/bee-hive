import { router } from '@inertiajs/react';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslations } from '@/hooks/use-translations';
import { isLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { update as updateLocale } from '@/routes/locale';

const localeLabels: Record<Locale, 'English' | 'Romanian'> = {
    en: 'English',
    ro: 'Romanian',
};

function useLocaleChange(): (value: string) => void {
    return (value: string): void => {
        if (!isLocale(value)) {
            return;
        }

        router.put(
            updateLocale().url,
            { locale: value },
            {
                preserveScroll: true,
                onSuccess: () => {
                    document.documentElement.lang = value;
                },
            },
        );
    };
}

function LanguageOptions() {
    const { locale, t } = useTranslations();
    const changeLocale = useLocaleChange();

    return (
        <DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
            <DropdownMenuGroup>
                {(['en', 'ro'] as const).map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                        {t(localeLabels[option])}
                    </DropdownMenuRadioItem>
                ))}
            </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
    );
}

export function LanguageSwitcher() {
    const { locale, t } = useTranslations();
    const language = t(localeLabels[locale]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('Current language: :language', { language })}
                >
                    <Languages data-icon="inline-start" />
                    {locale.toUpperCase()}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
                <LanguageOptions />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function LanguageMenuSub() {
    const { locale, t } = useTranslations();

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                <Languages />
                {t('Language')}
                <span className="ml-auto text-xs text-muted-foreground">
                    {locale.toUpperCase()}
                </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
                <LanguageOptions />
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
}
