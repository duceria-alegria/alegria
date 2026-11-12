/**
 * Crea clientes de prueba, uno por lista de precios (menudeo y mayoreo 1 a 4).
 * Es idempotente: si el correo ya existe, se asegura de que tenga su lista asignada, la contraseña
 * de prueba y la cuenta verificada.
 *
 * Uso (desde apps/server):  npx ts-node src/seed-clientes-prueba.ts
 */
import {
    bootstrapWorker,
    CustomerService,
    isGraphQlErrorResult,
    NativeAuthenticationMethod,
    PasswordCipher,
    RequestContextService,
    TransactionalConnection,
    Customer,
    User,
} from '@vendure/core';
import { IsNull } from 'typeorm';
import { config } from './vendure-config';
import { ListaPrecios } from './plugins/precios-por-lista/constants';

// Solo para desarrollo local. No usar en producción.
const PASSWORD_PRUEBA = 'prueba123';

const CLIENTES_PRUEBA: Array<{ emailAddress: string; firstName: string; lastName: string; lista: ListaPrecios }> = [
    { emailAddress: 'menudeo@prueba.test', firstName: 'Cliente', lastName: 'Menudeo', lista: 'menudeo' },
    { emailAddress: 'mayoreo1@prueba.test', firstName: 'Cliente', lastName: 'Mayoreo 1', lista: 'mayoreo1' },
    { emailAddress: 'mayoreo2@prueba.test', firstName: 'Cliente', lastName: 'Mayoreo 2', lista: 'mayoreo2' },
    { emailAddress: 'mayoreo3@prueba.test', firstName: 'Cliente', lastName: 'Mayoreo 3', lista: 'mayoreo3' },
    { emailAddress: 'mayoreo4@prueba.test', firstName: 'Cliente', lastName: 'Mayoreo 4', lista: 'mayoreo4' },
];

async function main() {
    const { app } = await bootstrapWorker(config);
    const ctx = await app.get(RequestContextService).create({ apiType: 'admin' });
    const customerService = app.get(CustomerService);
    const connection = app.get(TransactionalConnection);
    const passwordCipher = app.get(PasswordCipher);

    const asegurarAcceso = async (emailAddress: string) => {
        const user = await connection
            .getRepository(ctx, User)
            .findOne({ where: { identifier: emailAddress }, relations: { authenticationMethods: true } });
        const metodo = user?.authenticationMethods.find(m => m instanceof NativeAuthenticationMethod);
        if (!user || !(metodo instanceof NativeAuthenticationMethod)) return;
        metodo.passwordHash = await passwordCipher.hash(PASSWORD_PRUEBA);
        await connection.getRepository(ctx, NativeAuthenticationMethod).save(metodo);
        if (!user.verified) {
            user.verified = true;
            await connection.getRepository(ctx, User).save(user, { reload: false });
        }
    };

    for (const { lista, ...datos } of CLIENTES_PRUEBA) {
        const existente = await connection
            .getRepository(ctx, Customer)
            .findOne({ where: { emailAddress: datos.emailAddress, deletedAt: IsNull() } });
        if (existente) {
            await customerService.update(ctx, { id: existente.id, customFields: { listaPrecios: lista } });
            await asegurarAcceso(datos.emailAddress);
            console.log(`= ${datos.emailAddress} ya existía -> ${lista}`);
            continue;
        }
        const result = await customerService.create(
            ctx,
            { ...datos, customFields: { listaPrecios: lista } },
            PASSWORD_PRUEBA,
        );
        if (isGraphQlErrorResult(result)) {
            throw new Error(`${datos.emailAddress}: ${result.message}`);
        }
        await asegurarAcceso(datos.emailAddress);
        console.log(`+ ${datos.emailAddress} creado -> ${lista}`);
    }
    await app.close();
}

main().then(
    () => process.exit(0),
    err => {
        console.error(err);
        process.exit(1);
    },
);
