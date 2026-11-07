import { Args, Resolver, ResolveField, Parent } from '@nestjs/graphql';
import {
    Ctx,
    ListQueryOptions,
    Product,
    ProductVariant,
    ProductVariantService,
    RelationPaths,
    Relations,
    RequestContext,
} from '@vendure/core';
import { CajasService } from './cajas.service';
import { CAMPO_PIEZAS_POR_CAJA } from './constants';

/**
 * Reemplaza `Product.variants` y `Product.variantList` de la tienda para que quien no es de mayoreo
 * no vea las cajas. La tienda arma el selector de presentación con estas variantes, así que sin
 * cajas solo aparece Pieza.
 */
@Resolver('Product')
export class ProductoCajasResolver {
    constructor(
        private productVariantService: ProductVariantService,
        private cajasService: CajasService,
    ) {}

    @ResolveField()
    async variants(
        @Ctx() ctx: RequestContext,
        @Parent() product: Product,
        @Relations({ entity: ProductVariant, omit: ['assets'] }) relations: RelationPaths<ProductVariant>,
    ) {
        const { items } = await this.productVariantService.getVariantsByProductId(ctx, product.id, {}, relations);
        return this.cajasService.visibles(ctx, items);
    }

    @ResolveField()
    async variantList(
        @Ctx() ctx: RequestContext,
        @Parent() product: Product,
        @Args() args: { options?: ListQueryOptions<ProductVariant> },
        @Relations({ entity: ProductVariant, omit: ['assets'] }) relations: RelationPaths<ProductVariant>,
    ) {
        // Se filtra en la consulta (no después) para que `totalItems` y la paginación sigan correctos.
        const options = (await this.cajasService.puedeVerCajas(ctx))
            ? args.options
            : {
                  ...args.options,
                  filter: { ...args.options?.filter, [CAMPO_PIEZAS_POR_CAJA]: { isNull: true } },
              };
        return this.productVariantService.getVariantsByProductId(ctx, product.id, options, relations);
    }
}
