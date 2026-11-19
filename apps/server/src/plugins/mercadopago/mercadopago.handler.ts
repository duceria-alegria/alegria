import { LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';
import { CODIGO_MERCADOPAGO } from './constants';
import { MercadoPagoService } from './mercadopago.service';

const es = (value: string) => [{ languageCode: LanguageCode.es, value }];

let servicio: MercadoPagoService;

/**
 * Mercado Pago (Checkout Pro). El cliente paga en la página de Mercado Pago y el pago se registra en el
 * pedido cuando Mercado Pago confirma que está aprobado (webhook, o al regresar el cliente). No hay nada que
 * configurar aquí: el token y la clave del webhook van en variables de entorno.
 *
 * SEGURIDAD: `addPaymentToOrder` es público en la Shop API, así que cualquiera podría llamarlo con este
 * método y darse el pedido por pagado. Por eso `createPayment` NO confía en nada de lo que recibe: consulta el
 * pago a la API de Mercado Pago y exige que esté aprobado, que sea de este pedido, por el monto que se mostró
 * y que no se haya usado antes (`MercadoPagoService.validarParaPedido`). Si algo no cuadra devuelve
 * `Declined` y el pedido no cambia. El pago queda directamente `Settled`: Mercado Pago ya cobró.
 *
 * Reembolsos: el handler no define `createRefund`, así que un reembolso en Vendure queda pendiente y se
 * devuelve a mano en el panel de Mercado Pago.
 */
export const mercadoPagoHandler = new PaymentMethodHandler({
    code: CODIGO_MERCADOPAGO,
    description: es('Mercado Pago (tarjeta o transferencia SPEI)'),
    args: {},
    init(injector) {
        servicio = injector.get(MercadoPagoService);
    },
    createPayment: async (ctx, order, amount, _args, metadata) => {
        try {
            const validacion = await servicio.validarParaPedido(ctx, order, amount, metadata?.mpPaymentId);
            if (!validacion.ok) {
                Logger.warn(`Pago rechazado en el pedido ${order.code}: ${validacion.motivo}`, 'MercadoPago');
                return { amount, state: 'Declined', errorMessage: validacion.motivo };
            }
            const { cobro, pago } = validacion;
            return {
                amount,
                state: 'Settled',
                transactionId: String(pago.id),
                metadata: {
                    mpPaymentId: String(pago.id),
                    cobroId: cobro.id,
                    opcion: cobro.opcion,
                    lista: cobro.lista,
                    comision: cobro.comision,
                    totalCobrado: cobro.total,
                    // La Shop API solo expone `metadata.public`.
                    public: { referencia: order.code, comision: cobro.comision, totalCobrado: cobro.total },
                },
            };
        } catch (error) {
            // Mercado Pago no respondió o falló algo inesperado: no se da por pagado.
            Logger.error(`No se pudo verificar el pago del pedido ${order.code}: ${(error as Error).message}`, 'MercadoPago');
            return { amount, state: 'Error', errorMessage: 'No se pudo verificar el pago con Mercado Pago' };
        }
    },
    // El pago nace `Settled`: no hay nada que confirmar ni cancelar desde Vendure.
    settlePayment: () => ({ success: true }),
    cancelPayment: () => ({ success: true }),
});
