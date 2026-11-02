import { FulfillmentProcess, Injector } from '@vendure/core';
import { MENSAJE_PAGO_SIN_CONFIRMAR } from './constants';
import { FlujoBodegaService } from './flujo-bodega.service';

let flujoBodega: FlujoBodegaService;

/**
 * Guarda de pago para los fulfillments: se puede crear el envío (estado `Pending`) con el pago autorizado,
 * pero pasarlo a `Shipped` o `Delivered` exige que el pedido en surtido tenga el pago confirmado. También
 * vale si el pedido está en `Modifying` o `ArrangingAdditionalPayment` tras haber estado en surtido.
 *
 * Esta guarda va antes que el cambio de estado del pedido: si se dejara solo la del proceso de pedidos,
 * `default-fulfillment-process` convertiría ese rechazo en un `InternalServerError` y el Dashboard mostraría
 * un error interno en vez de un mensaje claro. Aquí el rechazo llega como `FulfillmentStateTransitionError`,
 * antes de que se guarde o se haga cualquier cosa.
 */
export const flujoBodegaFulfillmentProcess: FulfillmentProcess<string> = {
    init(injector: Injector) {
        flujoBodega = injector.get(FlujoBodegaService);
    },

    async onTransitionStart(_fromState, toState, { ctx, orders }) {
        if (toState !== 'Shipped' && toState !== 'Delivered') {
            return;
        }
        // Solo importa si el pedido viene de surtido: así no se cambia el comportamiento de otros pedidos
        // (por ejemplo, un pedido ya enviado al que se le hace un reembolso de cortesía).
        if (await flujoBodega.algunoEnSurtidoSinPago(ctx, orders)) {
            return MENSAJE_PAGO_SIN_CONFIRMAR;
        }
    },
};
