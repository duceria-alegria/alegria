import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizePhone, PHONE_PATTERN} from '../../src/lib/phone.ts';

test('deja solo dígitos y corta en 10', () => {
    assert.equal(normalizePhone('871 251 0098'), '8712510098');
    assert.equal(normalizePhone('(871) 251-0098'), '8712510098');
    assert.equal(normalizePhone('87125100981234'), '8712510098');
    assert.equal(normalizePhone('abc'), '');
    assert.equal(normalizePhone(''), '');
});

test('al teclear no pasa de 10 dígitos', () => {
    let escrito = '';
    for (const tecla of '87125100981') {
        escrito = normalizePhone(escrito + tecla);
    }
    assert.equal(escrito, '8712510098');
});

test('quita la clave de país de un número pegado completo', () => {
    assert.equal(normalizePhone('+52 871 251 0098'), '8712510098');
    assert.equal(normalizePhone('52 871 251 0098'), '8712510098');
    assert.equal(normalizePhone('+52 1 871 251 0098'), '8712510098');
    assert.equal(normalizePhone('+521 871 251 0098'), '8712510098');
});

test('no confunde un número que empieza con 52 mientras se teclea', () => {
    assert.equal(normalizePhone('5212345678'), '5212345678');
    assert.equal(normalizePhone('52123456789'), '5212345678');
});

test('el patrón acepta exactamente 10 dígitos', () => {
    assert.equal(PHONE_PATTERN.test('8712510098'), true);
    for (const malo of ['871251009', '87125100981', '871 251 0098', '+528712510098', 'abcdefghij', '']) {
        assert.equal(PHONE_PATTERN.test(malo), false, malo);
    }
});
