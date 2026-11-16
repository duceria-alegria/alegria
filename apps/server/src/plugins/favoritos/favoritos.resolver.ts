import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';
import { FavoritosService } from './favoritos.service';

@Resolver()
export class FavoritosResolver {
    constructor(private favoritosService: FavoritosService) {}

    @Query()
    @Allow(Permission.Owner)
    async misFavoritos(@Ctx() ctx: RequestContext): Promise<ID[]> {
        const cliente = await this.favoritosService.clienteActivo(ctx);
        return this.favoritosService.ids(ctx, cliente.id);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.Owner)
    async agregarFavorito(@Ctx() ctx: RequestContext, @Args('productId') productId: ID): Promise<ID[]> {
        const cliente = await this.favoritosService.clienteActivo(ctx);
        return this.favoritosService.agregar(ctx, cliente.id, productId);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.Owner)
    async quitarFavorito(@Ctx() ctx: RequestContext, @Args('productId') productId: ID): Promise<ID[]> {
        const cliente = await this.favoritosService.clienteActivo(ctx);
        return this.favoritosService.quitar(ctx, cliente.id, productId);
    }
}
