import 'dotenv/config';
import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/dashboard',
    build: {
        outDir: join(__dirname, 'dist/dashboard'),
    },
    plugins: [
        vendureDashboardPlugin({
            // The vendureDashboardPlugin will scan your configuration in order
            // to find any plugins which have dashboard extensions, as well as
            // to introspect the GraphQL schema based on any API extensions
            // and custom fields that are configured.
            vendureConfigPath: pathToFileURL('./src/vendure-config.ts'),
            // Points to the location of your Vendure server.
            // In production, 'auto' lets the dashboard derive the API URL from the
            // server that serves it. In development, we use explicit defaults so that
            // the Vite dev server can reach the Vendure backend.
            api: process.env.NODE_ENV === 'production'
                ? { host: 'auto', port: 'auto' }
                : { host: 'http://localhost', port: +process.env.PORT || +process.env.VENDURE_SERVER_PORT || 3000 },
            // When you start the Vite server, your Admin API schema will
            // be introspected and the types will be generated in this location.
            // These types can be used in your dashboard extensions to provide
            // type safety when writing queries and mutations.
            gqlOutputPath: './src/gql',
        }),
        {
            // Las extensiones del Dashboard (src/plugins/**/dashboard) y `src/gql/graphql.ts` importan
            // `react`, `@tanstack/react-query` y `gql.tada`, que no son dependencias de este paquete (con
            // pnpm no se resuelven desde aquí). Con `dedupe` se resuelven desde la raíz de Vite, que es el
            // paquete del Dashboard, y así usan la misma copia que la app.
            // Va como plugin aparte porque `vendureDashboardPlugin` reemplaza `resolve` en su hook.
            name: 'alegria:dashboard-dedupe',
            config: () => ({
                resolve: { dedupe: ['react', 'react-dom', '@tanstack/react-query', 'gql.tada'] },
            }),
        },
    ],
    resolve: {
        alias: {
            // This allows all plugins to reference a shared set of
            // GraphQL types.
            '@/gql': resolve(__dirname, './src/gql/graphql.ts'),
        },
    },
});
