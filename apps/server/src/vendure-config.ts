import {
    dummyPaymentHandler,
    DefaultJobQueuePlugin,
    DefaultSchedulerPlugin,
    DefaultSearchPlugin,
    VendureConfig,
} from '@vendure/core';
import {
    defaultEmailHandlers,
    EmailPlugin,
    FileBasedTemplateLoader,
    orderConfirmationHandler,
} from '@vendure/email-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import 'dotenv/config';
import path from 'path';
import { confirmacionPedidoHandler } from './plugins/flujo-bodega/correo-confirmacion';
import { FlujoBodegaPlugin } from './plugins/flujo-bodega/flujo-bodega.plugin';
import { ResendEmailSender } from './plugins/email/resend-email-sender';
import { PreciosPorListaPlugin } from './plugins/precios-por-lista/precios-por-lista.plugin';

const IS_DEV = process.env.APP_ENV === 'dev';
// PORT wins because hosting platforms inject it into the environment at runtime, and that
// must take precedence over any value baked into the .env file at scaffold time.
const serverPort = +process.env.PORT || +process.env.VENDURE_SERVER_PORT || 3000;

// Correos transaccionales (pedidos, verificación, reset, etc.) por Resend.
// Define RESEND_API_KEY para enviar correos reales; sin ella se conserva el
// comportamiento anterior (mailbox en dev, archivos en disco en prod).
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const EMAIL_FROM_ADDRESS =
    process.env.EMAIL_FROM_ADDRESS?.trim() || '"Dulcería Alegría" <noreply@example.com>';
const STOREFRONT_URL =
    process.env.STOREFRONT_URL?.trim().replace(/\/$/, '') || 'http://localhost:3002';
// URL pública de ESTE servidor (la que ven los navegadores), ej. https://api.mi-dominio.com.
// Se usa para las URLs de los assets y el enlace de reset de contraseña del Dashboard.
// Sin ella, los assets deducen su URL de la petición y el enlace apunta a localhost.
const PUBLIC_URL = process.env.PUBLIC_URL?.trim().replace(/\/$/, '');

export const config: VendureConfig = {
    apiOptions: {
        port: serverPort,
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        trustProxy: IS_DEV ? false : 1,
        // Which browser origins may make credentialed requests to the Shop and Admin APIs.
        // In dev any origin is reflected, so a storefront on any port works. In production set
        // CORS_ORIGINS to a comma-separated list of the origins you serve, for example
        // "https://example.com,https://admin.example.com". An unset value blocks all
        // cross-origin browser requests, which is the safe default.
        cors: {
            origin: IS_DEV ? true : (process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? []),
            credentials: true,
        },
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'],
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME,
            password: process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
          secret: process.env.COOKIE_SECRET,
        },
    },
    dbConnectionOptions: {
        type: 'postgres',
        // See the README.md "Migrations" section for an explanation of
        // the `synchronize` and `migrations` options.
        synchronize: false,
        migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
        logging: false,
        database: process.env.DB_NAME,
        schema: process.env.DB_SCHEMA,
        host: process.env.DB_HOST,
        port: +process.env.DB_PORT,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler],
    },
    // When adding or altering custom field definitions, the database will
    // need to be updated. See the "Migrations" section in README.md.
    customFields: {},
    plugins: [
        PreciosPorListaPlugin,
        FlujoBodegaPlugin,
        GraphiqlPlugin.init(),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(__dirname, '../static/assets'),
            // For local dev, the correct value for assetUrlPrefix should
            // be guessed correctly, but for production it will usually need
            // to be set manually to match your production url (PUBLIC_URL).
            assetUrlPrefix: !IS_DEV && PUBLIC_URL ? `${PUBLIC_URL}/assets/` : undefined,
        }),
        DefaultSchedulerPlugin.init(),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
        EmailPlugin.init({
            // Con RESEND_API_KEY todos los correos (pedidos, verificación,
            // reset, etc.) salen por la API de Resend. Sin ella se conserva
            // el comportamiento anterior: mailbox en dev, archivos en disco
            // en prod (no se envía nada).
            ...(RESEND_API_KEY
                ? {
                      transport: { type: 'none' as const },
                      emailSender: new ResendEmailSender(RESEND_API_KEY),
                  }
                : IS_DEV
                  ? {
                        devMode: true as const,
                        outputPath: path.join(__dirname, '../static/email/test-emails'),
                        route: 'mailbox',
                    }
                  : {
                        transport: {
                            type: 'file' as const,
                            outputPath: path.join(__dirname, '../static/email/test-emails'),
                        },
                    }),
            // La confirmación del pedido sale al hacerse el pedido y no al liquidarse el pago (ver correo-confirmacion.ts).
            handlers: [
                confirmacionPedidoHandler,
                ...defaultEmailHandlers.filter(handler => handler !== orderConfirmationHandler),
            ],
            templateLoader: new FileBasedTemplateLoader(
                path.join(__dirname, '../static/email/templates'),
            ),
            globalTemplateVars: {
                fromAddress: EMAIL_FROM_ADDRESS,
                verifyEmailAddressUrl: `${STOREFRONT_URL}/verify`,
                passwordResetUrl: `${STOREFRONT_URL}/reset-password`,
                changeEmailAddressUrl: `${STOREFRONT_URL}/account/verify-email`,
                // The URL of the password reset page of the Vendure Dashboard.
                adminPasswordResetUrl: `${PUBLIC_URL || `http://localhost:${serverPort}`}/dashboard/reset-password`,
            },
        }),
        DashboardPlugin.init({
            route: 'dashboard',
            appDir: IS_DEV
                ? path.join(__dirname, '../dist/dashboard')
                : path.join(__dirname, 'dashboard'),
        }),
    ],
};
