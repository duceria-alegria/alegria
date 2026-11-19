import assert from 'node:assert/strict';
import test from 'node:test';
import {isUnpaidOrder, mercadoPagoCharge, paymentView} from '../../src/features/orders/payment-view.ts';

test('un pedido ya pagado siempre se ve confirmado', () => {
    for (const state of ['PaymentAuthorized', 'PaymentSettled', 'Preparing', 'Shipped', 'Delivered', 'Cancelled']) {
        assert.equal(paymentView(state, 'rechazado'), 'confirmed', state);
        assert.equal(paymentView(state), 'confirmed', state);
    }
});

test('un pedido abierto se ve según el estado del cobro de Mercado Pago', () => {
    assert.equal(paymentView('ArrangingPayment', 'pendiente'), 'confirming');
    assert.equal(paymentView('ArrangingPayment', 'aplicado'), 'confirming');
    assert.equal(paymentView('ArrangingPayment', 'rechazado'), 'rejected');
    assert.equal(paymentView('AddingItems', 'revision'), 'review');
});

test('si el cliente volvió sin pagar o no hay dato, no se da por pagado', () => {
    for (const status of ['creado', 'sin_pago', undefined, null, '', 'otra-cosa']) {
        assert.equal(paymentView('ArrangingPayment', status), 'notPaid', String(status));
    }
});

test('solo AddingItems y ArrangingPayment cuentan como sin pagar', () => {
    assert.equal(isUnpaidOrder('AddingItems'), true);
    assert.equal(isUnpaidOrder('ArrangingPayment'), true);
    assert.equal(isUnpaidOrder('PaymentSettled'), false);
});

test('la comisión cobrada se lee de metadata.public y solo si hubo comisión', () => {
    assert.deepEqual(mercadoPagoCharge({public: {comision: 1050, totalCobrado: 14470}}), {fee: 1050, total: 14470});
    assert.equal(mercadoPagoCharge({public: {comision: 0, totalCobrado: 13420}}), undefined);
    assert.equal(mercadoPagoCharge({public: {comision: '10', totalCobrado: 5}}), undefined);
    assert.equal(mercadoPagoCharge({}), undefined);
    assert.equal(mercadoPagoCharge(null), undefined);
});
