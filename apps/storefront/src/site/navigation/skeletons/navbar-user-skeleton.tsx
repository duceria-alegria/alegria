import { Skeleton } from '@/components/ui/skeleton';

export function NavbarUserSkeleton() {
    return (
        <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-36 rounded-full" />
        </div>
    );
}
