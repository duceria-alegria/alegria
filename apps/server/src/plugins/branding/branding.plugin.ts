import { PluginCommonModule, VendurePlugin } from '@vendure/core';

/**
 * Plugin de personalización visual (branding) del Dashboard de Vendure para Dulcería Alegría.
 * Alinea la paleta de colores, tipografía (Nunito y Baloo 2), logotipo, pantalla de login,
 * barra de herramientas y estilos globales con el storefront de la tienda.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    dashboard: './dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class BrandingPlugin {}
