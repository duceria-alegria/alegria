import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { Ctx, idsAreEqual, ProductVariantService, RequestContext, RequestContextCacheService } from '@vendure/core';
import { CajasService } from './cajas.service';
import { esCaja, LISTA_POR_DEFECTO } from './constants';
import { ListaPreciosService } from './lista-precios.service';

type PrecioBusqueda = { value: number } | { min: number; max: number };
type ResultadoBusqueda = {
    productId: string | number;
    productVariantId: string | number;
    price: PrecioBusqueda;
    priceWithTax: PrecioBusqueda;
};

/**
 * El índice del buscador guarda un solo precio (menudeo) para todos, así que para los
 * clientes con otra lista se recalcula con los precios de sus variantes.
 *
 * Quien no es de mayoreo tampoco debe ver las cajas: en los productos que las tienen se recalcula
 * el rango de precios (y la variante del botón de agregar) sin contarlas, para que la tarjeta se
 * vea igual que la de un producto que solo se vende por pieza.
 */
@Resolver('SearchResult')
export class SearchResultPriceResolver {
    constructor(
        private listaPreciosService: ListaPreciosService,
        private productVariantService: ProductVariantService,
        private cajasService: CajasService,
        private requestCache: RequestContextCacheService,
    ) {}

    @ResolveField()
    price(@Ctx() ctx: RequestContext, @Parent() result: ResultadoBusqueda) {
        return this.precioDeLista(ctx, result, 'price');
    }

    @ResolveField()
    priceWithTax(@Ctx() ctx: RequestContext, @Parent() result: ResultadoBusqueda) {
        return this.precioDeLista(ctx, result, 'priceWithTax');
    }

    @ResolveField()
    async productVariantId(@Ctx() ctx: RequestContext, @Parent() result: ResultadoBusqueda) {
        const original = result.productVariantId;
        if (!(await this.ocultaCajas(ctx, result))) {
            return original;
        }
        const variantes = await this.variantesDelProducto(ctx, result, true);
        if (variantes.some(v => idsAreEqual(v.id, original))) {
            return original;
        }
        return variantes[0]?.id ?? original;
    }

    private async precioDeLista(
        ctx: RequestContext,
        result: ResultadoBusqueda,
        campo: 'price' | 'priceWithTax',
    ): Promise<PrecioBusqueda> {
        const original = result[campo];
        const ocultaCajas = await this.ocultaCajas(ctx, result);
        if ((await this.listaPreciosService.getLista(ctx)) === LISTA_POR_DEFECTO && !ocultaCajas) {
            return original;
        }
        if ('value' in original && !ocultaCajas) {
            const variante = await this.productVariantService.findOne(ctx, result.productVariantId);
            return variante ? { value: variante[campo] } : original;
        }
        const variantes = await this.variantesDelProducto(ctx, result, ocultaCajas);
        const precios = variantes.map(v => v[campo]);
        return precios.length ? { min: Math.min(...precios), max: Math.max(...precios) } : original;
    }

    /** El producto del resultado tiene cajas y quien consulta no puede verlas. */
    private async ocultaCajas(ctx: RequestContext, result: ResultadoBusqueda) {
        if (await this.cajasService.puedeVerCajas(ctx)) {
            return false;
        }
        return (await this.cajasService.productosConCajas(ctx)).has(String(result.productId));
    }

    /** Variantes activas del producto; se consultan una sola vez por petición aunque se pidan varios campos. */
    private async variantesDelProducto(ctx: RequestContext, result: ResultadoBusqueda, sinCajas: boolean) {
        const activas = await this.requestCache.get(ctx, `variantesBusqueda:${result.productId}`, async () => {
            const { items } = await this.productVariantService.getVariantsByProductId(ctx, result.productId);
            return items.filter(v => v.enabled);
        });
        return sinCajas ? activas.filter(v => !esCaja(v)) : activas;
    }
}
