import { EntityHydrator, OrderStateTransitionEvent } from '@vendure/core';
import {
    EmailEventListener,
    orderConfirmationHandler,
    shippingLinesWithMethod,
    transformOrderLineAssetUrls,
} from '@vendure/email-plugin';

/**
 * Correo de confirmación del pedido. Es el `orderConfirmationHandler` de `@vendure/email-plugin` (mismo
 * template, datos y asunto) con otro disparador: el original sale al pasar a `PaymentSettled`, pero con el
 * flujo de bodega un pedido puede ir `PaymentAuthorized -> Preparing -> ...` y liquidarse estando en
 * `Preparing`, así que nunca pasaría por `PaymentSettled` y el correo no saldría.
 *
 * Sale una sola vez por pedido, al hacerse el pedido (`ArrangingPayment` -> `PaymentAuthorized` o
 * `PaymentSettled`); la liquidación posterior (`PaymentAuthorized` -> `PaymentSettled`) ya no lo repite.
 *
 * Los pedidos que ya estaban en `PaymentAuthorized` antes de poner este handler no reciben confirmación:
 * su paso por `ArrangingPayment` ya ocurrió y el original solo habría enviado el correo al liquidarse.
 */
export const confirmacionPedidoHandler = new EmailEventListener('order-confirmation')
    .on(OrderStateTransitionEvent)
    .filter(
        event =>
            event.fromState === 'ArrangingPayment' &&
            (event.toState === 'PaymentAuthorized' || event.toState === 'PaymentSettled') &&
            !!event.order.customer,
    )
    .loadData(async ({ event, injector }) => {
        const entityHydrator = injector.get(EntityHydrator);
        await entityHydrator.hydrate(event.ctx, event.order, {
            relations: ['lines.featuredAsset', 'shippingLines.shippingMethod'],
        });
        transformOrderLineAssetUrls(event.ctx, event.order, injector);
        const shippingLines = shippingLinesWithMethod(event.order);
        return { shippingLines };
    })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .setRecipient(event => event.order.customer!.emailAddress)
    .setFrom('{{ fromAddress }}')
    .setSubject('Order confirmation for #{{ order.code }}')
    .setTemplateVars(event => ({ order: event.order, shippingLines: event.data.shippingLines }));

// Reutiliza el evento de ejemplo del original para la vista previa de plantillas del plugin de correo.
const eventoDeEjemplo = orderConfirmationHandler.mockEvent;
if (eventoDeEjemplo) {
    confirmacionPedidoHandler.setMockEvent(eventoDeEjemplo);
}
