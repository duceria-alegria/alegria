import { Injector, OrderProcess } from '@vendure/core';
import {
    ESTADO_PREPARANDO,
    ESTADOS_DE_ENVIO,
    ESTADOS_INICIABLES,
    MENSAJE_ESTADO_CAMBIO,
    MENSAJE_PAGO_SIN_CONFIRMAR,
    MENSAJE_VUELTA_A_SURTIDO_INVALIDA,
} from './constants';
import { FlujoBodegaService } from './flujo-bodega.service';

let flujoBodega: FlujoBodegaService;

/**
 * Agrega el estado `Preparing` al flujo de pedidos, entre el pago y el envío:
 *
 *   PaymentAuthorized / PaymentSettled -> Preparing -> (Partially)Shipped / (Partially)Delivered
 *
 * Vendure fusiona estas transiciones con las del proceso por defecto. Las reglas viven aquí (y no solo en la
 * mutación `iniciarSurtido`) para que valgan también con `transitionOrderToState`:
 *
 * - Para entrar a `Preparing` desde `PaymentAuthorized`/`PaymentSettled` hace falta `PrepararPedidos`, y si el
 *   pedido tiene otro surtidor, `AsignarPedidos`. Si no tiene, queda a nombre de quien lo inicia. Toda
 *   transición hacia `Preparing` bloquea la fila del pedido y relee el surtidor antes de decidir, para no
 *   pisar una asignación confirmada por otra transacción (`asignarSurtidor`) mientras corría esta.
 * - Desde `Modifying` solo se vuelve a `Preparing` si el pedido estaba en `Preparing` antes de modificarse
 *   (si no, un pedido enviado se podía "reabrir" como en surtido).
 * - De `Preparing` a los estados de envío solo se pasa con el pago confirmado: se puede surtir con el pago
 *   autorizado, pero no enviar ni entregar. Lo mismo vale desde `Modifying` o `ArrangingAdditionalPayment`
 *   cuando el pedido estaba en `Preparing` antes de modificarse (si no, bastaría modificar el pedido para
 *   saltarse la regla). Los fulfillments tienen su propia guarda (ver
 *   `flujo-bodega.fulfillment-process.ts`) para dar un mensaje claro en lugar de un error interno.
 * - A propósito NO existe `Preparing -> PaymentSettled/PaymentAuthorized`: al confirmar un pago, el proceso de
 *   pagos intenta pasar el pedido a `PaymentSettled` y, al no ser válido, lo ignora, así que el pedido sigue en
 *   `Preparing`.
 *
 * Las funciones devuelven un texto de error (no `false`): con `false` Vendure cancela la transición en silencio.
 */
export const flujoBodegaProcess: OrderProcess<typeof ESTADO_PREPARANDO> = {
    transitions: {
        PaymentAuthorized: { to: [ESTADO_PREPARANDO], mergeStrategy: 'merge' },
        PaymentSettled: { to: [ESTADO_PREPARANDO], mergeStrategy: 'merge' },
        [ESTADO_PREPARANDO]: {
            to: ['PartiallyShipped', 'Shipped', 'PartiallyDelivered', 'Delivered', 'Cancelled', 'Modifying'],
        },
        // Al terminar de modificar un pedido que estaba en surtido, puede volver a ese estado.
        Modifying: { to: [ESTADO_PREPARANDO], mergeStrategy: 'merge' },
    },

    init(injector: Injector) {
        flujoBodega = injector.get(FlujoBodegaService);
    },

    async onTransitionStart(fromState, toState, { ctx, order }) {
        if (toState === ESTADO_PREPARANDO) {
            // Bloquea el pedido y lo pone al día: el `order` que recibe el proceso se cargó antes y pudo cambiar
            // (otra transición, o `asignarSurtidor`) mientras esperaba. La vuelta desde `Modifying` no reasigna,
            // pero el `save` que cierra la transición tampoco debe pisar una asignación recién confirmada.
            const estadoActual = await flujoBodega.bloquearYRefrescarSurtidor(ctx, order);
            if (estadoActual !== fromState) {
                return MENSAJE_ESTADO_CAMBIO;
            }
            if (fromState === 'Modifying') {
                const estadoPrevio = await flujoBodega.estadoAnteriorAModificar(ctx, order.id);
                return estadoPrevio === ESTADO_PREPARANDO ? undefined : MENSAJE_VUELTA_A_SURTIDO_INVALIDA;
            }
            if (ESTADOS_INICIABLES.includes(fromState)) {
                const problema = await flujoBodega.evaluarInicio(ctx, order);
                return problema?.mensaje;
            }
        }
        if (ESTADOS_DE_ENVIO.includes(toState)) {
            if (!(await flujoBodega.exigePagoConfirmado(ctx, order, fromState))) {
                return;
            }
            return (await flujoBodega.pagoSinConfirmar(ctx, order)) ? MENSAJE_PAGO_SIN_CONFIRMAR : undefined;
        }
    },

    async onTransitionEnd(fromState, toState, { ctx, order }) {
        if (toState === ESTADO_PREPARANDO && ESTADOS_INICIABLES.includes(fromState)) {
            await flujoBodega.asignarAlQueInicia(ctx, order);
        }
    },
};
