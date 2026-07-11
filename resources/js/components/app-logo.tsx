import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <AppLogoIcon className="size-5" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-wide">
                    BEE CODED HIVE
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                    Capacity & Delivery
                </span>
            </div>
        </>
    );
}
