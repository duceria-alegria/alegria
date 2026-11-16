/**
 * Transferencia bancaria: el pago queda `Authorized` hasta que el dueño confirma que llegó el dinero, y para
 * Vendure el pedido está en "Pago autorizado". Al cliente eso le suena a pago hecho, así que mientras la
 * transferencia espera confirmación se le muestra "Esperando transferencia".
 */

/** Código del método de pago por transferencia bancaria (lo define el servidor). */
export const BANK_TRANSFER_METHOD = 'transferencia-bancaria';

/** Estado que se muestra en lugar de `PaymentAuthorized` mientras la transferencia no está confirmada. */
export const AWAITING_TRANSFER_STATE = 'AwaitingTransfer';

interface PaymentLike {
    method: string;
    state: string;
}

export function isPendingBankTransfer(payment: PaymentLike): boolean {
    return payment.method === BANK_TRANSFER_METHOD && payment.state === 'Authorized';
}

/** El estado del pedido tal como se le muestra al cliente. */
export function displayOrderState(state: string, payments?: readonly PaymentLike[] | null): string {
    return state === 'PaymentAuthorized' && payments?.some(isPendingBankTransfer) ? AWAITING_TRANSFER_STATE : state;
}

/** Los datos de la cuenta que el servidor deja en `metadata.public` del pago (texto simple). */
export function bankTransferDetails(metadata: unknown): {reference?: string; instructions?: string} {
    const details = (metadata as {public?: {referencia?: unknown; instrucciones?: unknown}} | null)?.public;
    return {
        reference: typeof details?.referencia === 'string' ? details.referencia : undefined,
        instructions: typeof details?.instrucciones === 'string' ? details.instrucciones.trim() : undefined,
    };
}
