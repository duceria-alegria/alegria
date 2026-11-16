import {Skeleton} from '@/components/ui/skeleton';

function SectionSkeleton({fields}: {fields: number}) {
    return (
        <div className="rounded-3xl bg-card p-5 shadow-tile ring-1 ring-border/70 sm:p-7">
            <div className="mb-6 flex items-start gap-4">
                <Skeleton className="size-12 rounded-2xl"/>
                <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-5 w-48"/>
                    <Skeleton className="h-4 w-64 max-w-full"/>
                </div>
            </div>
            <div className="space-y-5">
                {Array.from({length: fields}, (_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-28"/>
                        <Skeleton className="h-11 w-full rounded-xl"/>
                    </div>
                ))}
                <div className="flex justify-end">
                    <Skeleton className="h-11 w-40 rounded-full"/>
                </div>
            </div>
        </div>
    );
}

export default function ProfileLoading() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-7 rounded-[28px] bg-primary/90 p-6 sm:p-8">
                <Skeleton className="size-20 rounded-[26px] bg-white/20 sm:size-24"/>
                <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-24 rounded-full bg-white/20"/>
                    <Skeleton className="h-9 w-64 max-w-full bg-white/20"/>
                    <Skeleton className="h-4 w-80 max-w-full bg-white/20"/>
                </div>
            </div>
            <SectionSkeleton fields={2}/>
            <div className="grid items-start gap-6 xl:grid-cols-2">
                <SectionSkeleton fields={3}/>
                <SectionSkeleton fields={3}/>
            </div>
        </div>
    );
}
