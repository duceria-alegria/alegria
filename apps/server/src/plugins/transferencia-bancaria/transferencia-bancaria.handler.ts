import { LanguageCode, PaymentMethodHandler, RequestContext } from '@vendure/core';
import { autorizarTransferencias, CODIGO_TRANSFERENCIA, MENSAJE_SIN_PERMISO_TRANSFERENCIA } from './constants';
import { TransferenciaNoPermitidaError } from './errores';

const es = (value: string) => [{ languageCode: LanguageCode.es, value }];

/**
 * Las acciones nativas del Dashboard ("Settle payment", "Cancel payment") solo piden `UpdateOrder`, que tiene
 * el Encargado. Se valida aquí, que es el único punto por el que pasan todas, y se lanza el error en lugar de
 * devolver `success: false`: Vendure movería el pago a `Error` y cualquier clic de alguien sin permiso lo
 * dejaría inservible.
 */
function exigirPermiso(ctx: RequestContext) {
    if (!ctx.userHasPermissions([autorizarTransferencias.Permission])) {
        throw new TransferenciaNoPermitidaError(MENSAJE_SIN_PERMISO_TRANSFERENCIA);
    }
}

/**
 * Transferencia bancaria sin pasarela: al hacer el pedido el pago queda `Authorized` (pedido en "Pago
 * autorizado") y alguien con `AutorizarTransferencias` lo confirma (`Settled`) tras revisar la cuenta, desde
 * "Transferencias por confirmar" o desde el pedido. Rechazarla cancela el pago y el pedido.
 *
 * Los datos de la cuenta se escriben una sola vez, en el argumento `instrucciones` del método de pago
 * (Configuración → Métodos de pago). Se copian a `metadata.public` del pago para que la tienda los muestre
 * al cliente al terminar el pedido; la Shop API no expone los argumentos del método.
 */
export const transferenciaBancariaHandler = new PaymentMethodHandler({
    code: CODIGO_TRANSFERENCIA,
    description: es('Transferencia bancaria (la confirma el dueño)'),
    args: {
        instrucciones: {
            type: 'string',
            required: false,
            label: es('Datos para transferir'),
            description: es(
                'Banco, titular, CLABE o cuenta e instrucciones. Se muestran al cliente al terminar el pedido, como texto simple.',
            ),
            ui: { component: 'textarea-form-input' },
        },
    },
    createPayment: (ctx, order, amount, args) => ({
        amount,
        state: 'Authorized',
        // El código del pedido es el concepto con el que el cliente debe transferir y con el que se concilia.
        transactionId: order.code,
        metadata: { public: { referencia: order.code, instrucciones: args.instrucciones ?? '' } },
    }),
    settlePayment: ctx => {
        exigirPermiso(ctx);
        return { success: true };
    },
    cancelPayment: ctx => {
        exigirPermiso(ctx);
        return { success: true };
    },
});
