import { Injectable } from '@nestjs/common';
import {
    EntityNotFoundError,
    ID,
    isGraphQlErrorResult,
    Order,
    OrderService,
    Payment,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CODIGO_TRANSFERENCIA } from './constants';

/** Una transferencia que espera que alguien revise la cuenta bancaria y la confirme. */
export type TransferenciaPendiente = {
    paymentId: ID;
    orderId: ID;
    orderCode: string;
    orderState: string;
    cliente: string | null;
    correo: string | null;
    monto: number;
    currencyCode: string;
    creadoEn: Date;
};

const MOTIVO_POR_OMISION = 'Transferencia no recibida';

/** Texto del error de un resultado de Vendure (cada tipo de error trae el suyo). */
const textoDeError = (resultado: { message: string; transitionError?: string; paymentErrorMessage?: string }) =>
    resultado.transitionError || resultado.paymentErrorMessage || resultado.message;

@Injectable()
export class TransferenciaBancariaService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
    ) {}

    /** Transferencias sin confirmar del canal, las más antiguas primero. */
    async pendientes(ctx: RequestContext): Promise<TransferenciaPendiente[]> {
        const pagos = await this.connection.getRepository(ctx, Payment).find({
            where: {
                method: CODIGO_TRANSFERENCIA,
                state: 'Authorized',
                order: { channels: { id: ctx.channelId } },
            },
            relations: { order: { customer: true } },
            order: { createdAt: 'ASC', id: 'ASC' },
            take: 200,
        });
        return pagos.map(pago => {
            const cliente = pago.order.customer;
            return {
                paymentId: pago.id,
                orderId: pago.order.id,
                orderCode: pago.order.code,
                orderState: pago.order.state,
                cliente: cliente ? [cliente.firstName, cliente.lastName].filter(Boolean).join(' ') || null : null,
                correo: cliente?.emailAddress ?? null,
                monto: pago.amount,
                currencyCode: pago.order.currencyCode,
                creadoEn: pago.createdAt,
            };
        });
    }

    /** Confirma que el dinero llegó: el pago pasa a `Settled` y el pedido a "Pago confirmado". */
    async confirmar(ctx: RequestContext, paymentId: ID): Promise<Order> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const pago = await this.pagoPorConfirmar(txCtx, paymentId);
            const resultado = await this.orderService.settlePayment(txCtx, pago.id);
            if (isGraphQlErrorResult(resultado)) {
                // Se lanza (en vez de devolver el error) para que la transacción deshaga todo.
                throw new UserInputError(textoDeError(resultado));
            }
            return this.obtenerPedido(txCtx, pago.order.id);
        });
    }

    /**
     * El dinero no llegó: cancela el pago y el pedido (con lo que el inventario apartado se libera). Es lo
     * único coherente: un pedido en "Pago autorizado" sin su pago quedaría varado.
     */
    async rechazar(ctx: RequestContext, paymentId: ID, motivo?: string | null): Promise<Order> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const pago = await this.pagoPorConfirmar(txCtx, paymentId);
            const pagoCancelado = await this.orderService.cancelPayment(txCtx, pago.id);
            if (isGraphQlErrorResult(pagoCancelado)) {
                throw new UserInputError(textoDeError(pagoCancelado));
            }
            const pedidoCancelado = await this.orderService.cancelOrder(txCtx, {
                orderId: pago.order.id,
                reason: motivo?.trim() || MOTIVO_POR_OMISION,
                cancelShipping: true,
            });
            if (isGraphQlErrorResult(pedidoCancelado)) {
                throw new UserInputError(textoDeError(pedidoCancelado));
            }
            return this.obtenerPedido(txCtx, pago.order.id);
        });
    }

    /** El pago, si es una transferencia de este canal que todavía espera confirmación. */
    private async pagoPorConfirmar(ctx: RequestContext, paymentId: ID): Promise<Payment> {
        const pago = await this.connection.getRepository(ctx, Payment).findOne({
            where: { id: paymentId, order: { channels: { id: ctx.channelId } } },
            relations: { order: true },
        });
        if (!pago) {
            throw new EntityNotFoundError('Payment', paymentId);
        }
        if (pago.method !== CODIGO_TRANSFERENCIA) {
            throw new UserInputError('Ese pago no es una transferencia bancaria');
        }
        if (pago.state !== 'Authorized') {
            throw new UserInputError(`Esa transferencia ya no está pendiente (estado ${pago.state})`);
        }
        return pago;
    }

    private async obtenerPedido(ctx: RequestContext, orderId: ID): Promise<Order> {
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) {
            throw new EntityNotFoundError('Order', orderId);
        }
        return order;
    }
}
