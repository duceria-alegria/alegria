/**
 * Crea los roles de bodega (Surtidor y Encargado) y tres administradores de prueba:
 * surtidor1, surtidor2 y encargado, con una contraseña de prueba conocida. Es idempotente: si el rol o el
 * correo ya existen, se actualizan los permisos del rol y se asegura que la cuenta tenga su rol; la
 * contraseña de una cuenta que ya existe no se toca.
 *
 * Solo corre con APP_ENV=dev: crea cuentas con contraseña conocida y no debe ejecutarse contra datos reales.
 *
 * - Surtidor: ve pedidos y catálogo, e inicia el surtido (`PrepararPedidos`).
 * - Encargado: lo del Surtidor, más `UpdateOrder` (cerrar el pedido con Fulfill, confirmar pagos, cambiar
 *   el estado), `AsignarPedidos` y `ReadAdministrator` (para elegir a quién asignar).
 *
 * Uso (desde apps/server):  npx ts-node src/seed-roles-bodega.ts
 */
import {
    Administrator,
    AdministratorService,
    bootstrapWorker,
    Permission,
    RequestContextService,
    Role,
    RoleService,
    TransactionalConnection,
    User,
} from '@vendure/core';
import { IsNull } from 'typeorm';
import { config } from './vendure-config';
import { asignarPedidos, prepararPedidos } from './plugins/flujo-bodega/constants';

// Solo para desarrollo local. No usar en producción.
const PASSWORD_PRUEBA = 'prueba123';

const PERMISOS_SURTIDOR: string[] = [Permission.ReadOrder, Permission.ReadCatalog, prepararPedidos.Permission];
const PERMISOS_ENCARGADO: string[] = [
    ...PERMISOS_SURTIDOR,
    Permission.UpdateOrder,
    asignarPedidos.Permission,
    Permission.ReadAdministrator,
];

const ROLES_BODEGA = [
    {
        code: 'surtidor',
        description: 'Surtidor de bodega: inicia el surtido de los pedidos',
        permissions: PERMISOS_SURTIDOR,
    },
    {
        code: 'encargado',
        description: 'Encargado de bodega: asigna pedidos, cierra los envíos y confirma pagos',
        permissions: PERMISOS_ENCARGADO,
    },
];

const ADMINS_PRUEBA = [
    { emailAddress: 'surtidor1@prueba.test', firstName: 'Surtidor', lastName: '1', rol: 'surtidor' },
    { emailAddress: 'surtidor2@prueba.test', firstName: 'Surtidor', lastName: '2', rol: 'surtidor' },
    { emailAddress: 'encargado@prueba.test', firstName: 'Encargado', lastName: 'Bodega', rol: 'encargado' },
];

async function main() {
    if (process.env.APP_ENV !== 'dev') {
        throw new Error('Este seed crea cuentas con contraseña de prueba y solo corre con APP_ENV=dev');
    }
    const { app } = await bootstrapWorker(config);
    const connection = app.get(TransactionalConnection);
    const roleService = app.get(RoleService);
    const administratorService = app.get(AdministratorService);

    // Crear roles y administradores exige un usuario con los permisos que se van a otorgar (regla de
    // Vendure: nadie puede dar permisos que no tiene), así que el script actúa como el superadmin.
    const rolSuperadmin = await roleService.getSuperAdminRole();
    const superadmin = await connection.rawConnection.getRepository(User).findOne({
        where: { roles: { id: rolSuperadmin.id } },
        relations: { roles: { channels: true } },
    });
    if (!superadmin) {
        throw new Error('No se encontró el usuario superadmin');
    }
    const ctx = await app.get(RequestContextService).create({ apiType: 'admin', user: superadmin });

    const rolesPorCodigo = new Map<string, Role>();
    for (const { code, description, permissions } of ROLES_BODEGA) {
        const existente = await connection.getRepository(ctx, Role).findOne({ where: { code } });
        if (existente) {
            const rol = await roleService.update(ctx, {
                id: existente.id,
                description,
                permissions: permissions as Permission[],
            });
            rolesPorCodigo.set(code, rol);
            console.log(`= rol ${code} ya existía -> permisos actualizados`);
        } else {
            const rol = await roleService.create(ctx, {
                code,
                description,
                permissions: permissions as Permission[],
            });
            rolesPorCodigo.set(code, rol);
            console.log(`+ rol ${code} creado`);
        }
    }

    for (const { rol, ...datos } of ADMINS_PRUEBA) {
        const roleId = rolesPorCodigo.get(rol)!.id;
        const existente = await connection
            .getRepository(ctx, Administrator)
            .findOne({ where: { emailAddress: datos.emailAddress, deletedAt: IsNull() } });
        if (existente) {
            await administratorService.update(ctx, { id: existente.id, roleIds: [roleId] });
            console.log(`= ${datos.emailAddress} ya existía -> ${rol} (contraseña sin cambios)`);
            continue;
        }
        await administratorService.create(ctx, { ...datos, password: PASSWORD_PRUEBA, roleIds: [roleId] });
        console.log(`+ ${datos.emailAddress} creado -> ${rol}`);
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
