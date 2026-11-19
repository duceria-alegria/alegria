export const MERCADOPAGO_OPTIONS = Symbol('MERCADOPAGO_OPTIONS');

export interface MercadoPagoOptions {
    /** Access Token de la aplicación (de prueba o de producción). Sin él Mercado Pago queda apagado. */
    accessToken?: string;
    /** Clave secreta del webhook (panel de Mercado Pago → Webhooks). Sin ella se rechazan los avisos. */
    webhookSecret?: string;
    /** URL pública de este servidor: a ella avisa Mercado Pago. Solo https. */
    publicUrl?: string;
    /** URL pública de la tienda, a la que regresa el cliente. */
    storefrontUrl: string;
}
