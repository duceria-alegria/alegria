import {ProductGridSkeleton} from '@/features/products/product-grid-skeleton';

export default function FavoritesLoading() {
    return (
        <div className="container mx-auto px-4 py-8 mt-16">
            <div className="mb-6 h-9 w-48 animate-pulse rounded bg-muted"/>
            <ProductGridSkeleton/>
        </div>
    );
}
