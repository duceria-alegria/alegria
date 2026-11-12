import {LoadingScreen} from '@/site/loading-screen';

// Fallback for shop pages that have no loading.tsx of their own (e.g. home); the rest keep their skeletons.
export default function ShopLoading() {
    return <LoadingScreen/>;
}
