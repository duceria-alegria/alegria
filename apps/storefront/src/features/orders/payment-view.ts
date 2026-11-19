/**
 * Qué ve el cliente en la página del pedido cuando paga con Mercado Pago. Lo normal es que regrese de
 * Mercado Pago antes de que el servidor registre el pago, así que el pedido todavía no está pagado y hay
 * que distinguir "estamos confirmando" de "no se completó" o "fue rechazado".
 */

/** Estados del pedido en los que todavía no hay un pago registrado (el carrito sigue abierto). */
const UNPAID_STATES = ['AddingItems', 'ArrangingPayment'];

export function isUnpaidOrder(state: string): boolean {
    return UNPAID_STATES.includes(state);
}

export type PaymentView = 'confirmed' | 'confirming' | 'notPaid' | 'rejected' | 'review';

/**
 * `mercadoPagoStatus` es el estado del cobro que devuelve el servidor (`verificarPagoMercadoPago`):
 * sin_pago, creado, pendiente, aplicado, rechazado o revision. Un pedido ya pagado siempre está confirmado.
 */
export function paymentView(orderState: string, mercadoPagoStatus?: string | null): PaymentView {
    if (!isUnpaidOrder(orderState)) return 'confirmed';
    switch (mercadoPagoStatus) {
        // Mercado Pago tiene el pago (o ya se aprobó y el pedido aún no se refleja): se espera un momento.
        case 'pendiente':
        case 'aplicado':
            return 'confirming';
        case 'rechazado':
            return 'rejected';
        case 'revision':
            return 'review';
        // creado / sin_pago / desconocido: el cliente volvió sin pagar.
        default:
            return 'notPaid';
    }
}

/** Cada cuánto se vuelve a consultar mientras se confirma el pago, y cuántas veces antes de avisar que tarda. */
export const CONFIRMING_POLL_MS = 5_000;
export const CONFIRMING_POLL_MAX = 36;

/** Comisión y total cobrado que el servidor deja en `metadata.public` del pago de Mercado Pago (solo mayoreo). */
export function mercadoPagoCharge(metadata: unknown): {fee: number; total: number} | undefined {
    const details = (metadata as {public?: {comision?: unknown; totalCobrado?: unknown}} | null)?.public;
    return typeof details?.comision === 'number' && details.comision > 0 && typeof details.totalCobrado === 'number'
        ? {fee: details.comision, total: details.totalCobrado}
        : undefined;
}
