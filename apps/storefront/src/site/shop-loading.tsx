import {LoadingScreen} from '@/site/loading-screen';

// Pantalla de carga de marca. OJO: NO la pongas como loading.tsx de (shop) ni en páginas estáticas (inicio,
// recuperar contraseña...): con cacheComponents rompe el pre-renderizado de `next build` ("uncached or runtime
// data during prerendering" en LocaleLayout). Úsala solo en rutas dinámicas.
export default function ShopLoading() {
    return <LoadingScreen/>;
}
