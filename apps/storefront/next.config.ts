import path from 'node:path';
import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/site/i18n/request.ts');

// Host de los assets del backend (su PUBLIC_URL). next/image solo optimiza imágenes de hosts autorizados.
const assetsHost = process.env.ASSETS_URL ? new URL(process.env.ASSETS_URL).hostname : undefined;

const nextConfig: NextConfig = {
    cacheComponents: true,
    // Solo `next dev`: permite abrir el sitio desde el celular por la IP de la red local o por Tailscale.
    // Sin esto Next bloquea /_next/* para orígenes que no son localhost y la página nunca se hidrata
    // (los links funcionan, pero la búsqueda, los menús y demás controles de JS no).
    allowedDevOrigins: ['192.168.*.*', '100.105.126.59'],
    // Imagen Docker: server.js autocontenido. Se rastrea desde la raíz del monorepo porque
    // pnpm guarda las dependencias en el node_modules de la raíz.
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname, '../../'),
    // Spanish-only for now (see platform/i18n/routing.ts): old or typed-in /en and /de URLs land on /es.
    async redirects() {
        return [
            {source: '/:locale(en|de)/:path*', destination: '/es/:path*', permanent: false},
        ];
    },
    images: {
        // This is necessary to display images from your local Vendure instance
        dangerouslyAllowLocalIP: true,
        remotePatterns: [
            {
                hostname: 'readonlydemo.vendure.io',
            },
            {
                hostname: 'demo.vendure.io'
            },
            {
                hostname: 'localhost'
            },
            ...(assetsHost ? [{hostname: assetsHost}] : []),
        ],
    }
};

export default withNextIntl(nextConfig);
