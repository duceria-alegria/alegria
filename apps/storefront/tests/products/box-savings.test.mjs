import assert from 'node:assert/strict';
import test from 'node:test';
import {getBoxSavings} from '../../src/features/products/box-savings.ts';

const piece = (priceWithTax) => ({id: 'piece', priceWithTax, customFields: {piezasPorCaja: null}});
const box = (priceWithTax, piezasPorCaja) => ({id: 'box', priceWithTax, customFields: {piezasPorCaja}});

test('there is nothing to compare when the customer does not get the box variant', () => {
    assert.equal(getBoxSavings([piece(7760)]), null);
    assert.equal(getBoxSavings([{id: 'piece', priceWithTax: 7760}]), null);
});

test('compares the box against the same number of loose pieces', () => {
    // 24 pieces at $75.60 = $1,814.40 loose, box at $1,632.96 -> saves $181.44 (10%).
    assert.deepEqual(getBoxSavings([piece(7560), box(163296, 24)]), {
        pieceVariantId: 'piece',
        boxVariantId: 'box',
        pieces: 24,
        piecePrice: 7560,
        boxPricePerPiece: 6804,
        saving: 18144,
        percent: 10,
    });
});

test('does not depend on the order of the variants', () => {
    assert.equal(getBoxSavings([box(163296, 24), piece(7560)])?.saving, 18144);
});

test('never advertises a saving when the box is not cheaper per piece', () => {
    assert.equal(getBoxSavings([piece(7560), box(181440, 24)]), null);
    assert.equal(getBoxSavings([piece(7560), box(200000, 24)]), null);
});
