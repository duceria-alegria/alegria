import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { calcularComision, centavosAPesos, cobraComision, pesosACentavos } from './comision';
import { OPCIONES_PAGO, opcionPago } from './constants';
import { firmaValida } from './firma';
import { analizarReferencia, idPagoValido } from './referencia';

const tarjeta = { porcentaje: 3.49, fijo: 4 };

describe('calcularComision', () => {
    it('el precio de lista (menudeo) no paga comisión', () => {
        assert.deepEqual(calcularComision(100_000, 'menudeo', tarjeta), { comision: 0, total: 100_000 });
        assert.equal(cobraComision('menudeo'), false);
    });

    it('cualquier lista de mayoreo sí la paga', () => {
        for (const lista of ['mayoreo1', 'mayoreo2', 'mayoreo3', 'mayoreo4']) {
            assert.equal(cobraComision(lista), true);
            assert.ok(calcularComision(100_000, lista, tarjeta).comision > 0);
        }
    });

    it('a la dulcería le llega el monto del pedido después de lo que descuenta Mercado Pago', () => {
        const p = 0.0349 * 1.16;
        const fijo = 4 * 1.16 * 100;
        for (const pedido of [1_00, 99_99, 123_456, 1_000_00, 25_000_00]) {
            const { comision, total } = calcularComision(pedido, 'mayoreo1', tarjeta);
            assert.equal(total, pedido + comision);
            const neto = total * (1 - p) - fijo;
            // Nunca de menos, y a lo mucho un centavo de más por el redondeo hacia arriba.
            assert.ok(neto >= pedido - 1e-6, `pedido ${pedido}: neto ${neto}`);
            assert.ok(neto - pedido < 1.5, `pedido ${pedido}: neto ${neto}`);
        }
    });

    it('ejemplo: $1,000 de pedido de mayoreo con tarjeta', () => {
        // p = 3.49 % · 1.16 = 4.0484 %; fijo = 4.64 → (1000 · 0.040484 + 4.64) / (1 − 0.040484) = 47.03
        assert.deepEqual(calcularComision(1_000_00, 'mayoreo2', tarjeta), { comision: 4_703, total: 104_703 });
    });

    it('rechaza montos que no son centavos enteros positivos', () => {
        assert.throws(() => calcularComision(0, 'mayoreo1', tarjeta));
        assert.throws(() => calcularComision(-5, 'mayoreo1', tarjeta));
        assert.throws(() => calcularComision(10.5, 'mayoreo1', tarjeta));
    });
});

describe('conversión de montos', () => {
    it('va y viene entre centavos y pesos sin errores de coma flotante', () => {
        assert.equal(centavosAPesos(104_649), 1046.49);
        assert.equal(pesosACentavos(1046.49), 104_649);
        assert.equal(pesosACentavos(0.29), 29);
        assert.equal(pesosACentavos(1.1 + 2.2), 330);
    });
});

describe('opciones de pago', () => {
    it('efectivo está apagado y no se puede elegir', () => {
        assert.equal(opcionPago('efectivo'), undefined);
        assert.ok(OPCIONES_PAGO.find(o => o.id === 'efectivo'));
    });

    it('tarjeta y transferencia no comparten tipos de pago de Mercado Pago', () => {
        const tarjetaTipos = opcionPago('tarjeta')!.tiposPermitidos;
        const transferenciaTipos = opcionPago('transferencia')!.tiposPermitidos;
        assert.ok(!tarjetaTipos.some(tipo => transferenciaTipos.includes(tipo)));
    });
});

describe('firmaValida', () => {
    const secreto = 'clave-secreta-de-prueba';
    const firmar = (dataId: string, requestId: string, ts: string) =>
        createHmac('sha256', secreto).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');

    it('acepta una firma bien calculada', () => {
        const v1 = firmar('123456', 'req-1', '1704908010');
        assert.equal(firmaValida({ firma: `ts=1704908010,v1=${v1}`, requestId: 'req-1', dataId: '123456', secreto }), true);
    });

    it('el id alfanumérico se firma en minúsculas', () => {
        const v1 = firmar('abc123', 'req-1', '1');
        assert.equal(firmaValida({ firma: `ts=1,v1=${v1}`, requestId: 'req-1', dataId: 'ABC123', secreto }), true);
    });

    it('rechaza otra clave, otro id, otro request o un ts alterado', () => {
        const v1 = firmar('123456', 'req-1', '1704908010');
        const firma = `ts=1704908010,v1=${v1}`;
        assert.equal(firmaValida({ firma, requestId: 'req-1', dataId: '123456', secreto: 'otra' }), false);
        assert.equal(firmaValida({ firma, requestId: 'req-1', dataId: '999999', secreto }), false);
        assert.equal(firmaValida({ firma, requestId: 'req-2', dataId: '123456', secreto }), false);
        assert.equal(firmaValida({ firma: `ts=1704908011,v1=${v1}`, requestId: 'req-1', dataId: '123456', secreto }), false);
    });

    it('rechaza firmas ausentes, mal formadas o sin secreto', () => {
        assert.equal(firmaValida({ firma: undefined, requestId: 'r', dataId: '1', secreto }), false);
        assert.equal(firmaValida({ firma: 'basura', requestId: 'r', dataId: '1', secreto }), false);
        assert.equal(firmaValida({ firma: 'ts=1', requestId: 'r', dataId: '1', secreto }), false);
        assert.equal(firmaValida({ firma: 'ts=1,v1=', requestId: 'r', dataId: '1', secreto }), false);
        assert.equal(firmaValida({ firma: `ts=1,v1=${firmar('1', 'r', '1')}`, requestId: 'r', dataId: '1', secreto: '' }), false);
    });
});

describe('referencia del pedido', () => {
    it('separa el código del pedido y el id del cobro', () => {
        assert.deepEqual(analizarReferencia('ABCD1234EFGH-17'), { orderCode: 'ABCD1234EFGH', cobroId: 17 });
    });

    it('rechaza referencias que no son nuestras', () => {
        for (const ref of [undefined, null, '', 'sin-guion-numero', 'ABC', 'ABC-', 'ABC-x', '-5', 'ABC-0', 'ABC--3']) {
            assert.equal(analizarReferencia(ref), undefined, String(ref));
        }
    });

    it('el id de pago solo acepta dígitos (va dentro de la URL de la API)', () => {
        assert.equal(idPagoValido('123456789'), true);
        for (const malo of ['', '12 3', '../x', '1/2', '12?x=1', 'abc', '1'.repeat(25)]) {
            assert.equal(idPagoValido(malo), false, malo);
        }
        assert.equal(idPagoValido(123 as unknown), false);
    });
});
