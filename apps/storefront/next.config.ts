import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/site/i18n/request.ts');

const nextConfig: NextConfig = {
    cacheComponents: true,
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
            }
        ],
    }
};

export default withNextIntl(nextConfig);
