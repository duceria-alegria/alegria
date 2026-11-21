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
            theme: {
                light: {
                    background: '#fbf9fd',
                    foreground: '#4b1d6e',
                    surface: '#ffffff',
                    'surface-raised': '#ffffff',
                    card: '#ffffff',
                    'card-foreground': '#4b1d6e',
                    popover: '#ffffff',
                    'popover-foreground': '#4b1d6e',
                    primary: '#4b1d6e',
                    'primary-foreground': '#ffffff',
                    brand: '#f0338f',
                    'brand-foreground': '#ffffff',
                    secondary: '#fff2b3',
                    'secondary-foreground': '#4b1d6e',
                    muted: '#f4ecfb',
                    'muted-foreground': '#6d5982',
                    accent: '#f4ecfb',
                    'accent-foreground': '#4b1d6e',
                    destructive: '#e0141b',
                    'destructive-foreground': '#ffffff',
                    'destructive-subtle': '#ffe4e6',
                    'destructive-subtle-foreground': '#9f1239',
                    'destructive-border': '#fecdd3',
                    success: '#10b981',
                    'success-foreground': '#ffffff',
                    'success-subtle': '#d1fae5',
                    'success-subtle-foreground': '#065f46',
                    'success-border': '#a7f3d0',
                    warning: '#f7941d',
                    'warning-foreground': '#ffffff',
                    'warning-subtle': '#fff4bf',
                    'warning-subtle-foreground': '#854d0e',
                    'warning-border': '#fde047',
                    info: '#22c5d9',
                    'info-foreground': '#ffffff',
                    'info-subtle': '#d8f5f9',
                    'info-subtle-foreground': '#0e7490',
                    'info-border': '#a5f3fc',
                    border: '#e6daf0',
                    input: '#e6daf0',
                    'control-border': '#d5c0e6',
                    ring: '#1b7fc4',
                    sidebar: '#fcfafc',
                    'sidebar-foreground': '#4b1d6e',
                    'sidebar-primary': '#4b1d6e',
                    'sidebar-primary-foreground': '#ffffff',
                    'sidebar-accent': '#f4ecfb',
                    'sidebar-accent-foreground': '#3a1556',
                    'sidebar-border': '#e6daf0',
                    'sidebar-ring': '#1b7fc4',
                    'font-sans': "'Nunito', sans-serif",
                    'font-heading': "'Baloo 2', 'Nunito', sans-serif",
                    'font-body': "'Nunito', sans-serif",
                    'dev-mode': '#ffe600',
                    'dev-mode-foreground': '#3a1556',
                },
                dark: {
                    background: '#1a0e26',
                    foreground: '#f6eefc',
                    surface: '#241434',
                    'surface-raised': '#2b193f',
                    card: '#241434',
                    'card-foreground': '#f6eefc',
                    popover: '#28163a',
                    'popover-foreground': '#f6eefc',
                    primary: '#ffd000',
                    'primary-foreground': '#28113b',
                    brand: '#f0338f',
                    'brand-foreground': '#ffffff',
                    secondary: '#361c4f',
                    'secondary-foreground': '#f6eefc',
                    muted: '#321848',
                    'muted-foreground': '#b5a0c7',
                    accent: '#3b1d55',
                    'accent-foreground': '#ffffff',
                    destructive: '#f87171',
                    'destructive-foreground': '#450a0a',
                    border: '#442261',
                    input: '#442261',
                    'control-border': '#5a307e',
                    ring: '#22c5d9',
                    sidebar: '#150b1f',
                    'sidebar-foreground': '#f6eefc',
                    'sidebar-primary': '#ffd000',
                    'sidebar-primary-foreground': '#28113b',
                    'sidebar-accent': '#2b163f',
                    'sidebar-accent-foreground': '#ffffff',
                    'sidebar-border': '#3a1b54',
                    'sidebar-ring': '#22c5d9',
                    'font-sans': "'Nunito', sans-serif",
                    'font-heading': "'Baloo 2', 'Nunito', sans-serif",
                    'font-body': "'Nunito', sans-serif",
                },
                additionalStylesheets: [
                    resolve(__dirname, './src/plugins/branding/dashboard/theme.css'),
                ],
            },
        }),
        {
            // Inyecta el título y personalización de marca en el HTML inicial
            name: 'alegria:dashboard-html-branding',
            transformIndexHtml(html) {
                let transformed = html;
                if (!transformed.includes('<title>')) {
                    transformed = transformed.replace(/<head>/, '<head>\n    <title>Dulcería Alegría · Admin</title>');
                } else {
                    transformed = transformed.replace(/<title>.*?<\/title>/, '<title>Dulcería Alegría · Admin</title>');
                }
                return transformed;
            },
        },
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
