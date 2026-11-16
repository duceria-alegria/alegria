import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Order, RequestContext, Transaction } from '@vendure/core';
import { autorizarTransferencias } from './constants';
import { TransferenciaBancariaService, TransferenciaPendiente } from './transferencia-bancaria.service';

@Resolver()
export class TransferenciaBancariaResolver {
    constructor(private transferenciaService: TransferenciaBancariaService) {}

    @Query()
    @Allow(autorizarTransferencias.Permission)
    transferenciasPendientes(@Ctx() ctx: RequestContext): Promise<TransferenciaPendiente[]> {
        return this.transferenciaService.pendientes(ctx);
    }

    @Transaction()
    @Mutation()
    @Allow(autorizarTransferencias.Permission)
    confirmarTransferencia(@Ctx() ctx: RequestContext, @Args() args: { paymentId: ID }): Promise<Order> {
        return this.transferenciaService.confirmar(ctx, args.paymentId);
    }

    @Transaction()
    @Mutation()
    @Allow(autorizarTransferencias.Permission)
    rechazarTransferencia(
        @Ctx() ctx: RequestContext,
        @Args() args: { paymentId: ID; motivo?: string | null },
    ): Promise<Order> {
        return this.transferenciaService.rechazar(ctx, args.paymentId, args.motivo);
    }
}
