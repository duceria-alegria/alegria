/**
 * `external_reference` que se manda a Mercado Pago: `<código del pedido>-<id del cobro>`. Así cada venta
 * en el panel de Mercado Pago se concilia con el pedido, y la notificación dice a qué intento de cobro
 * corresponde (un pedido puede tener varios si el cliente cambió de método o abandonó el pago).
 */
export function armarReferencia(orderCode: string, cobroId: number): string {
    return `${orderCode}-${cobroId}`;
}

export function analizarReferencia(referencia: unknown): { orderCode: string; cobroId: number } | undefined {
    if (typeof referencia !== 'string') return undefined;
    const guion = referencia.lastIndexOf('-');
    if (guion <= 0) return undefined;
    const orderCode = referencia.slice(0, guion);
    const cobro = referencia.slice(guion + 1);
    if (!/^[A-Za-z0-9]+$/.test(orderCode) || !/^[1-9]\d{0,9}$/.test(cobro)) return undefined;
    return { orderCode, cobroId: Number(cobro) };
}

/**
 * El id de pago llega del cliente (metadata de `addPaymentToOrder`) o de una notificación y se pone en la
 * URL de la API de Mercado Pago: solo dígitos, para que no pueda escaparse a otra ruta.
 */
export function idPagoValido(id: unknown): id is string {
    return typeof id === 'string' && /^\d{1,20}$/.test(id);
}
