import { Injectable } from '@nestjs/common';
import {
    Administrator,
    AdministratorService,
    EntityNotFoundError,
    ID,
    idsAreEqual,
    isGraphQlErrorResult,
    Order,
    OrderHistoryEntry,
    OrderService,
    orderTotalIsCovered,
    Permission,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { IsNull } from 'typeorm';
import {
    asignarPedidos,
    ESTADO_PREPARANDO,
    ESTADOS_INICIABLES,
    ESTADOS_TRAS_MODIFICAR,
    MENSAJE_ASIGNADO_A_OTRO,
    MENSAJE_SIN_PERMISO_PARA_SURTIR,
    prepararPedidos,
} from './constants';
import { SurtidoNoPermitidoError } from './errores';

/** Forma del campo personalizado `Order.surtidor` (relación con Administrator). */
type CamposSurtidor = { surtidor?: Administrator | null; surtidorId?: ID | null };

const surtidorIdDe = (order: Order): ID | undefined =>
    (order.customFields as CamposSurtidor | undefined)?.surtidorId ?? undefined;

/** Motivo por el que alguien no puede iniciar el surtido de un pedido. */
export type ProblemaDeInicio = { tipo: 'permiso' | 'asignado'; mensaje: string };

@Injectable()
export class FlujoBodegaService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private administratorService: AdministratorService,
    ) {}

    /**
     * El trabajador que hace la petición empieza a surtir el pedido: pasa a `Preparing` y, si nadie lo
     * tenía, queda a su nombre (eso lo hace el proceso de pedidos, ver `flujo-bodega.process.ts`, para que
     * valga igual con `transitionOrderToState`). Solo se inicia desde `PaymentAuthorized` o `PaymentSettled`.
     * El historial del pedido registra quién lo inició.
     */
    async iniciarSurtido(ctx: RequestContext, orderId: ID): Promise<Order> {
        return this.connection.withTransaction(ctx, async txCtx => {
            // Bloquea la fila del pedido hasta que termine la transacción: si dos trabajadores lo
            // inician a la vez, el segundo espera, ve el estado nuevo y falla (Preparing -> Preparing
            // no existe), así que no hay dos inicios ni asignaciones que se pisen.
            await this.bloquearPedido(txCtx, orderId);
            const order = await this.obtenerPedido(txCtx, orderId);
            if (!ESTADOS_INICIABLES.includes(order.state)) {
                throw new UserInputError(
                    `No se puede iniciar el surtido porque el pedido está en estado ${order.state}; ` +
                        'solo se inicia con pago autorizado o confirmado',
                );
            }
            const problema = await this.evaluarInicio(txCtx, order);
            if (problema) {
                throw new SurtidoNoPermitidoError(problema.mensaje);
            }
            const resultado = await this.orderService.transitionToState(txCtx, order.id, ESTADO_PREPARANDO);
            if (isGraphQlErrorResult(resultado)) {
                // Se lanza (en vez de devolver el error) para que la transacción deshaga todo.
                throw new UserInputError(resultado.transitionError);
            }
            return this.obtenerPedidoCompleto(txCtx, order.id);
        });
    }

    /**
     * Asigna el pedido a un trabajador de bodega. `administratorId` es obligatorio en la práctica: con `null`
     * (o sin indicarlo) el pedido queda sin surtidor. El estado del pedido no cambia: reasignar un pedido en
     * surtido lo "libera" para otro trabajador.
     */
    async asignarSurtidor(ctx: RequestContext, orderId: ID, administratorId: ID | null): Promise<Order> {
        return this.connection.withTransaction(ctx, async txCtx => {
            // Mismo bloqueo que `iniciarSurtido`: si una transición a `Preparing` corre a la vez, una
            // espera a la otra y no hay asignaciones perdidas.
            await this.bloquearPedido(txCtx, orderId);
            const order = await this.obtenerPedido(txCtx, orderId);
            if (administratorId != null) {
                // Consulta directa y no `AdministratorService.findOne`: este último oculta a los administradores
                // con roles que el usuario activo no tiene, y respondería "no existe" para un destino válido.
                const administrador = await this.connection.getRepository(txCtx, Administrator).findOne({
                    where: { id: administratorId, deletedAt: IsNull() },
                    relations: { user: { roles: true } },
                });
                if (!administrador) {
                    throw new EntityNotFoundError('Administrator', administratorId);
                }
                const puedeSurtir = administrador.user.roles.some(
                    rol =>
                        rol.permissions.includes(Permission.SuperAdmin) ||
                        rol.permissions.includes(prepararPedidos.Permission),
                );
                if (!puedeSurtir) {
                    throw new UserInputError('Ese administrador no tiene permiso para surtir pedidos');
                }
            }
            await this.orderService.updateCustomFields(txCtx, order.id, { surtidorId: administratorId });
            return this.obtenerPedidoCompleto(txCtx, order.id);
        });
    }

    /**
     * Regla para iniciar el surtido (se usa en `iniciarSurtido` y en el proceso de pedidos, así que vale
     * también con `transitionOrderToState`): hace falta `PrepararPedidos`, y si el pedido tiene un surtidor
     * vigente que no es quien lo inicia, también `AsignarPedidos`. Un surtidor eliminado (borrado lógico)
     * cuenta como pedido sin asignar. Sin sesión (código interno, scripts) no se aplica.
     *
     * El `order` debe estar al día con la base de datos y la fila bloqueada: `iniciarSurtido` lo carga tras
     * bloquear, y el proceso de pedidos llama antes a `bloquearYRefrescarSurtidor`.
     */
    async evaluarInicio(ctx: RequestContext, order: Order): Promise<ProblemaDeInicio | undefined> {
        if (!ctx.activeUserId) {
            return undefined;
        }
        if (!ctx.userHasPermissions([prepararPedidos.Permission])) {
            return { tipo: 'permiso', mensaje: MENSAJE_SIN_PERMISO_PARA_SURTIR };
        }
        const surtidor = await this.surtidorVigente(ctx, order);
        if (!surtidor) {
            return undefined;
        }
        const administrador = await this.administradorActivo(ctx);
        if (administrador && idsAreEqual(administrador.id, surtidor.id)) {
            return undefined;
        }
        if (ctx.userHasPermissions([asignarPedidos.Permission])) {
            return undefined;
        }
        return { tipo: 'asignado', mensaje: MENSAJE_ASIGNADO_A_OTRO };
    }

    /**
     * Bloquea la fila del pedido (`FOR UPDATE`, el mismo bloqueo de `iniciarSurtido` y `asignarSurtidor`) y
     * actualiza en memoria el surtidor del `order` con el que hay en la base de datos.
     *
     * Hace falta porque `OrderService.transitionToState` carga el pedido antes de llamar al proceso: si otra
     * transacción confirmó una asignación mientras tanto, ese objeto trae el surtidor anterior y el
     * `save(order)` con el que termina la transición lo escribiría de vuelta, perdiendo la asignación en
     * silencio. Con el bloqueo, quien llega segundo espera a que el primero confirme y entonces relee.
     *
     * Devuelve el estado actual del pedido en la base de datos: si no coincide con el `fromState` de la
     * transición, esta partió de datos viejos (otra transacción lo cambió) y no debe continuar.
     *
     * El bloqueo usa el mismo `ctx` (misma transacción) que la transición, así que no se bloquea a sí mismo.
     */
    async bloquearYRefrescarSurtidor(ctx: RequestContext, order: Order): Promise<string> {
        await this.bloquearPedido(ctx, order.id);
        const fresco = await this.obtenerPedido(ctx, order.id);
        order.customFields = {
            ...order.customFields,
            // `surtidor` (la relación) se deja sin definir para que mande `surtidorId`, que es la columna.
            surtidor: undefined,
            surtidorId: surtidorIdDe(fresco) ?? null,
        } as Order['customFields'];
        return fresco.state;
    }

    /**
     * Si el pedido no tiene surtidor vigente, lo deja a nombre de quien lo inicia. Modifica el `order` en
     * memoria (no lo guarda con `updateCustomFields`): `OrderService.transitionToState` vuelve a guardar ese
     * mismo objeto al terminar y pisaría una asignación hecha por otro camino. Sin administrador (API key,
     * código interno) el pedido queda sin asignar.
     */
    async asignarAlQueInicia(ctx: RequestContext, order: Order): Promise<void> {
        const administrador = await this.administradorActivo(ctx);
        if (!administrador || (await this.surtidorVigente(ctx, order))) {
            return;
        }
        order.customFields = {
            ...order.customFields,
            surtidor: administrador,
            surtidorId: administrador.id,
        } as Order['customFields'];
    }

    /**
     * Estado en el que estaba el pedido antes de entrar a `Modifying`, para un pedido que está en
     * `Modifying` o en `ArrangingAdditionalPayment`. Es el mismo criterio que usa el Dashboard para devolver
     * el pedido a su estado (el último cambio de estado hacia `Modifying` del historial), con una precisión:
     * se recorre el historial de más nuevo a más viejo solo mientras sean pasos de la modificación.
     *
     * - `Preparing -> Modifying` (-> `ArrangingAdditionalPayment`): devuelve `Preparing`.
     * - `ArrangingAdditionalPayment` alcanzado sin pasar por `Modifying` (desde `PaymentAuthorized` o
     *   `PaymentSettled`): devuelve ese estado de origen. Si antes el pedido estuvo en surtido y salió de él
     *   con una modificación que terminó en `PaymentAuthorized`/`PaymentSettled`, esa salida fue explícita
     *   y no se cuenta como "viene de surtido": se comporta como un pedido normal de Vendure.
     */
    async estadoAnteriorAModificar(ctx: RequestContext, orderId: ID): Promise<string | undefined> {
        const entradas = await this.connection.getRepository(ctx, OrderHistoryEntry).find({
            where: { order: { id: orderId }, type: 'ORDER_STATE_TRANSITION' as OrderHistoryEntry['type'] },
            order: { createdAt: 'DESC', id: 'DESC' },
            take: 50,
        });
        for (const entrada of entradas) {
            const { from, to } = (entrada.data ?? {}) as { from?: string; to?: string };
            if (to === 'Modifying') {
                return from;
            }
            // Un paso `Modifying -> ArrangingAdditionalPayment` sigue siendo parte de la modificación; un
            // `X -> ArrangingAdditionalPayment` directo marca el origen. Cualquier otro destino es un estado
            // que no viene de una modificación, así que no hay estado previo que devolver.
            if (to !== 'ArrangingAdditionalPayment') {
                return undefined;
            }
            if (from !== 'Modifying') {
                return from;
            }
        }
        return undefined;
    }

    /** `true` si el pago del pedido todavía no está confirmado (`Settled`) por el total. */
    async pagoSinConfirmar(ctx: RequestContext, order: Order): Promise<boolean> {
        order.payments ??= await this.orderService.getOrderPayments(ctx, order.id);
        return !orderTotalIsCovered(order, 'Settled');
    }

    /**
     * `true` si el envío debe exigir pago confirmado: cuando el pedido sale de `Preparing`, o cuando
     * sale de `Modifying`/`ArrangingAdditionalPayment` pero antes de modificarse estaba en `Preparing`.
     * Un pedido que nunca pasó por la bodega mantiene el comportamiento normal de Vendure (por ejemplo,
     * un pedido ya enviado con un reembolso de cortesía no se bloquea).
     */
    async exigePagoConfirmado(ctx: RequestContext, order: Order, fromState: string): Promise<boolean> {
        if (fromState === ESTADO_PREPARANDO) {
            return true;
        }
        if (!ESTADOS_TRAS_MODIFICAR.includes(fromState)) {
            return false;
        }
        return (await this.estadoAnteriorAModificar(ctx, order.id)) === ESTADO_PREPARANDO;
    }

    /**
     * `true` si alguno de esos pedidos está en surtido (o en modificación tras el surtido) y su pago no
     * está confirmado. Se vuelve a cargar cada pedido completo porque los que recibe un
     * FulfillmentProcess no traen envíos ni cargos, y sin ellos el total no es el real.
     */
    async algunoEnSurtidoSinPago(ctx: RequestContext, orders: Order[]): Promise<boolean> {
        for (const parcial of orders) {
            const order = await this.orderService.findOne(ctx, parcial.id);
            if (!order) {
                continue;
            }
            if (!(await this.exigePagoConfirmado(ctx, order, order.state))) {
                continue;
            }
            if (await this.pagoSinConfirmar(ctx, order)) {
                return true;
            }
        }
        return false;
    }

    /** Surtidor del pedido, si sigue activo: un administrador eliminado (borrado lógico) no cuenta. */
    private async surtidorVigente(ctx: RequestContext, order: Order): Promise<Administrator | undefined> {
        const surtidorId = surtidorIdDe(order);
        if (surtidorId == null) {
            return undefined;
        }
        const administrador = await this.connection
            .getRepository(ctx, Administrator)
            .findOne({ where: { id: surtidorId, deletedAt: IsNull() } });
        return administrador ?? undefined;
    }

    /** Administrador de la sesión activa. Con una API key o sin sesión no hay ninguno. */
    private administradorActivo(ctx: RequestContext): Promise<Administrator | undefined> {
        return ctx.activeUserId
            ? this.administratorService.findOneByUserId(ctx, ctx.activeUserId)
            : Promise.resolve(undefined);
    }

    /** Pedido del canal activo, solo la fila (incluye el id del surtidor): basta para decidir. */
    private async obtenerPedido(ctx: RequestContext, orderId: ID): Promise<Order> {
        const order = await this.orderService.findOne(ctx, orderId, []);
        if (!order) {
            throw new EntityNotFoundError('Order', orderId);
        }
        return order;
    }

    /** Pedido con las relaciones por defecto de Vendure, que necesita la API para resolver sus campos. */
    private async obtenerPedidoCompleto(ctx: RequestContext, orderId: ID): Promise<Order> {
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new EntityNotFoundError('Order', orderId);
        }
        return order;
    }

    private async bloquearPedido(ctx: RequestContext, orderId: ID): Promise<void> {
        await this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .setLock('pessimistic_write')
            .where('order.id = :orderId', { orderId })
            .getOne();
    }
}
