import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { Ctx, ProductVariantService, RequestContext } from '@vendure/core';
import { ListaPreciosService } from './lista-precios.service';

type PrecioBusqueda = { value: number } | { min: number; max: number };
type ResultadoBusqueda = {
    productId: string;
    productVariantId: string;
    price: PrecioBusqueda;
    priceWithTax: PrecioBusqueda;
};

/**
 * El índice del buscador guarda un solo precio (menudeo) para todos, así que para los
 * clientes con otra lista se recalcula con los precios de sus variantes.
 */
@Resolver('SearchResult')
export class SearchResultPriceResolver {
    constructor(
        private listaPreciosService: ListaPreciosService,
        private productVariantService: ProductVariantService,
    ) {}

    @ResolveField()
    price(@Ctx() ctx: RequestContext, @Parent() result: ResultadoBusqueda) {
        return this.precioDeLista(ctx, result, 'price');
    }

    @ResolveField()
    priceWithTax(@Ctx() ctx: RequestContext, @Parent() result: ResultadoBusqueda) {
        return this.precioDeLista(ctx, result, 'priceWithTax');
    }

    private async precioDeLista(
        ctx: RequestContext,
        result: ResultadoBusqueda,
        campo: 'price' | 'priceWithTax',
    ): Promise<PrecioBusqueda> {
        const original = result[campo];
        if ((await this.listaPreciosService.getLista(ctx)) === 'menudeo') {
            return original;
        }
        if ('value' in original) {
            const variante = await this.productVariantService.findOne(ctx, result.productVariantId);
            return variante ? { value: variante[campo] } : original;
        }
        const { items } = await this.productVariantService.getVariantsByProductId(ctx, result.productId);
        const precios = items.filter(v => v.enabled).map(v => v[campo]);
        return precios.length ? { min: Math.min(...precios), max: Math.max(...precios) } : original;
    }
}
