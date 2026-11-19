import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { MercadoPagoService, OpcionCobro, PagoCreado } from './mercadopago.service';

@Resolver()
export class MercadoPagoResolver {
    constructor(private servicio: MercadoPagoService) {}

    @Query()
    @Allow(Permission.Public)
    opcionesPagoMercadoPago(@Ctx() ctx: RequestContext): Promise<OpcionCobro[]> {
        return this.servicio.opciones(ctx);
    }

    @Mutation()
    @Allow(Permission.Public)
    crearPagoMercadoPago(@Ctx() ctx: RequestContext, @Args('opcion') opcion: string): Promise<PagoCreado> {
        return this.servicio.crearPago(ctx, opcion);
    }

    @Mutation()
    @Allow(Permission.Public)
    async verificarPagoMercadoPago(@Args('codigoPedido') codigoPedido: string): Promise<{ estado: string }> {
        return { estado: await this.servicio.verificarPedido(codigoPedido) };
    }
}
