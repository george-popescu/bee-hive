import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';
import { isLocale, languageTag, translate } from '@/lib/i18n';
import type {
    Locale,
    TranslationKey,
    TranslationReplacements,
} from '@/lib/i18n';

type Translation = {
    locale: Locale;
    languageTag: string;
    t: (key: TranslationKey, replacements?: TranslationReplacements) => string;
};

export function useTranslations(): Translation {
    const page = usePage();
    const locale = isLocale(page.props.locale) ? page.props.locale : 'en';
    const t = useCallback(
        (key: TranslationKey, replacements: TranslationReplacements = {}) =>
            translate(locale, key, replacements),
        [locale],
    );

    return { locale, languageTag: languageTag(locale), t };
}
