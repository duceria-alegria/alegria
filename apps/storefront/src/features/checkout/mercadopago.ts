/** Código del método de pago "Mercado Pago" (lo define el servidor, plugin `mercadopago`). */
export const MERCADOPAGO_METHOD = 'mercado-pago';

/** Una forma de pagar dentro de Mercado Pago (tarjeta, SPEI…) con lo que cuesta; montos en centavos. */
export interface MercadoPagoOption {
    id: string;
    nombre: string;
    descripcion: string;
    /** Total del pedido, sin comisión. */
    montoPedido: number;
    /** Comisión de Mercado Pago que se suma al pedido; 0 con precio de lista. */
    comision: number;
    /** Lo que se cobra en Mercado Pago: pedido + comisión. */
    total: number;
    cobraComision: boolean;
}

/**
 * Mercado Pago solo se ofrece si el servidor devuelve formas de pago: sin ellas (apagado por falta de
 * credenciales, o servidor sin el plugin) el método existe pero no serviría, y el cliente no debe verlo.
 */
export function visiblePaymentMethods<T extends {code: string}>(methods: T[], options: readonly MercadoPagoOption[]): T[] {
    return options.length ? methods : methods.filter((method) => method.code !== MERCADOPAGO_METHOD);
}

/** Lo que se cobra de más en Mercado Pago por la opción elegida (comisión y total), o `null` si no hay comisión. */
export function mercadoPagoFee(
    paymentMethodCode: string | null,
    option: MercadoPagoOption | null,
): {fee: number; total: number} | null {
    if (paymentMethodCode !== MERCADOPAGO_METHOD || !option || option.comision <= 0) return null;
    return {fee: option.comision, total: option.total};
}
