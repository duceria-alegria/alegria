import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { Ctx, ProductAsset, RequestContext, TransactionalConnection } from '@vendure/core';

/** Con más fotos que esto el carrusel de la tarjeta se vuelve estorbo; la ficha del producto las muestra todas. */
const MAX_FOTOS_TARJETA = 6;

/**
 * Todas las fotos del producto para el carrusel de la tarjeta. El índice del buscador solo guarda
 * la principal (`productAsset`), así que las demás se leen del catálogo y solo cuando la consulta
 * pide el campo. La principal va siempre primera, igual que en la ficha.
 */
@Resolver('SearchResult')
export class SearchResultAssetsResolver {
    constructor(private connection: TransactionalConnection) {}

    @ResolveField()
    async productAssets(@Ctx() ctx: RequestContext, @Parent() result: { productId: string | number }) {
        const filas = await this.connection.getRepository(ctx, ProductAsset).find({
            where: { productId: result.productId },
            relations: { asset: true },
            order: { position: 'ASC' },
            take: MAX_FOTOS_TARJETA,
        });
        return filas.map(fila => fila.asset);
    }
}
