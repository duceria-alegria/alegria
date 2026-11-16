/**
 * Da de alta el método de pago "Transferencia bancaria" (handler `transferencia-bancaria`). Es idempotente:
 * si el método ya existe no lo toca, así que no pisa los datos de la cuenta que el dueño haya capturado en
 * Configuración → Métodos de pago. Sirve en cualquier entorno (no crea cuentas ni contraseñas).
 *
 * Los datos de la cuenta que se crean son de ejemplo: el dueño debe capturar los reales en el argumento
 * "Datos para transferir" del método antes de abrirlo a clientes.
 *
 * Uso (desde apps/server):  npx ts-node src/seed-metodo-transferencia.ts
 */
import {
    bootstrapWorker,
    isGraphQlErrorResult,
    LanguageCode,
    PaymentMethodService,
    RequestContextService,
    TransactionalConnection,
    PaymentMethod,
} from '@vendure/core';
import { config } from './vendure-config';
import { CODIGO_TRANSFERENCIA } from './plugins/transferencia-bancaria/constants';

const NOMBRE = 'Transferencia bancaria';
const DESCRIPCION =
    'Pagas por transferencia: al terminar el pedido verás los datos de la cuenta y el código de tu pedido para usarlo como concepto. Preparamos tu pedido en cuanto confirmemos el pago.';
const INSTRUCCIONES =
    'Banco: (capturar)\nTitular: (capturar)\nCLABE: (capturar)\nConcepto: el código de tu pedido\nEl monto debe ser exacto.';

async function main() {
    const { app } = await bootstrapWorker(config);
    const ctx = await app.get(RequestContextService).create({ apiType: 'admin' });
    const metodos = app.get(PaymentMethodService);
    const connection = app.get(TransactionalConnection);

    const existente = await connection.getRepository(ctx, PaymentMethod).findOne({ where: { code: CODIGO_TRANSFERENCIA } });
    if (existente) {
        console.log(`= el método ${CODIGO_TRANSFERENCIA} ya existía (id ${existente.id}), sin cambios`);
    } else {
        // Un nombre en el idioma por defecto del canal (el de respaldo) y otro en español.
        const idiomas = [...new Set([ctx.channel.defaultLanguageCode, LanguageCode.es])];
        const resultado = await metodos.create(ctx, {
            code: CODIGO_TRANSFERENCIA,
            enabled: true,
            handler: { code: CODIGO_TRANSFERENCIA, arguments: [{ name: 'instrucciones', value: INSTRUCCIONES }] },
            translations: idiomas.map(languageCode => ({ languageCode, name: NOMBRE, description: DESCRIPCION })),
        });
        if (isGraphQlErrorResult(resultado)) {
            throw new Error(`No se pudo crear el método de pago: ${(resultado as { message: string }).message}`);
        }
        console.log(`+ método ${CODIGO_TRANSFERENCIA} creado (id ${resultado.id}); captura los datos reales de la cuenta en el Dashboard`);
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
