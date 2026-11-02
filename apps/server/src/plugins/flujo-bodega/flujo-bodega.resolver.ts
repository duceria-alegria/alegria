import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Order, RequestContext, Transaction } from '@vendure/core';
import { asignarPedidos, prepararPedidos } from './constants';
import { FlujoBodegaService } from './flujo-bodega.service';

@Resolver()
export class FlujoBodegaResolver {
    constructor(private flujoBodegaService: FlujoBodegaService) {}

    @Transaction()
    @Mutation()
    @Allow(prepararPedidos.Permission)
    iniciarSurtido(@Ctx() ctx: RequestContext, @Args() args: { orderId: ID }): Promise<Order> {
        return this.flujoBodegaService.iniciarSurtido(ctx, args.orderId);
    }

    @Transaction()
    @Mutation()
    @Allow(asignarPedidos.Permission)
    asignarSurtidor(
        @Ctx() ctx: RequestContext,
        @Args() args: { orderId: ID; administratorId?: ID | null },
    ): Promise<Order> {
        return this.flujoBodegaService.asignarSurtidor(ctx, args.orderId, args.administratorId ?? null);
    }
}
