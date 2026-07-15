import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';

type PeriodNavigationProps = {
    className?: string;
    label: string;
    onNext: () => void;
    onPrevious: () => void;
};

export function PeriodNavigation({
    className,
    label,
    onNext,
    onPrevious,
}: PeriodNavigationProps) {
    const { t } = useTranslations();

    return (
        <div
            className={cn(
                'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2',
                className,
            )}
            role="group"
            aria-label={t('Period')}
        >
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7 rounded-[10px] shadow-none"
                aria-label={t('Previous period')}
                onClick={onPrevious}
            >
                <ArrowLeft />
            </Button>
            <span
                className="truncate text-center text-xs font-medium tabular-nums"
                title={label}
            >
                {label}
            </span>
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7 rounded-[10px] shadow-none"
                aria-label={t('Next period')}
                onClick={onNext}
            >
                <ArrowRight />
            </Button>
        </div>
    );
}
