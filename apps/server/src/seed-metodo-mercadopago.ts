/**
 * Da de alta el método de pago "Mercado Pago" (handler `mercado-pago`). Es idempotente: si el método ya
 * existe no lo toca. Sin este método el webhook no puede registrar los pagos (Vendure responde
 * `payment-method-not-found` y Mercado Pago reintenta el aviso). Sirve en cualquier entorno; no crea cuentas
 * ni contraseñas. El token y la clave del webhook van en variables de entorno, no aquí.
 *
 * Uso (desde apps/server):  npx ts-node src/seed-metodo-mercadopago.ts
 */
import {
    bootstrapWorker,
    isGraphQlErrorResult,
    LanguageCode,
    PaymentMethod,
    PaymentMethodService,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import { config } from './vendure-config';
import { CODIGO_MERCADOPAGO } from './plugins/mercadopago/constants';

const NOMBRE = 'Mercado Pago';
const DESCRIPCION =
    'Pagas con tarjeta o transferencia SPEI en la página segura de Mercado Pago. Tu pedido se confirma en cuanto se acredita el pago.';

async function main() {
    const { app } = await bootstrapWorker(config);
    const ctx = await app.get(RequestContextService).create({ apiType: 'admin' });
    const metodos = app.get(PaymentMethodService);
    const connection = app.get(TransactionalConnection);

    const existente = await connection.getRepository(ctx, PaymentMethod).findOne({ where: { code: CODIGO_MERCADOPAGO } });
    if (existente) {
        console.log(`= el método ${CODIGO_MERCADOPAGO} ya existía (id ${existente.id}), sin cambios`);
    } else {
        // Un nombre en el idioma por defecto del canal (el de respaldo) y otro en español.
        const idiomas = [...new Set([ctx.channel.defaultLanguageCode, LanguageCode.es])];
        const resultado = await metodos.create(ctx, {
            code: CODIGO_MERCADOPAGO,
            enabled: true,
            handler: { code: CODIGO_MERCADOPAGO, arguments: [] },
            translations: idiomas.map(languageCode => ({ languageCode, name: NOMBRE, description: DESCRIPCION })),
        });
        if (isGraphQlErrorResult(resultado)) {
            throw new Error(`No se pudo crear el método de pago: ${(resultado as { message: string }).message}`);
        }
        console.log(`+ método ${CODIGO_MERCADOPAGO} creado (id ${resultado.id})`);
    }
    await app.close();
}

main().then(
    () => process.exit(0),
    error => {
        console.error(error);
        process.exit(1);
    },
);
