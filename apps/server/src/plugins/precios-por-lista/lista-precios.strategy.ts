import {
    idsAreEqual,
    Injector,
    PriceCalculationResult,
    ProductVariantPriceCalculationArgs,
    ProductVariantPriceCalculationStrategy,
    roundMoney,
    TaxRateService,
} from '@vendure/core';
import { CAMPO_PRECIO_VARIANTE } from './constants';
import { ListaPreciosService } from './lista-precios.service';

/**
 * Cambia el precio base (menudeo) de la variante por el de la lista asignada al cliente
 * que inició sesión. Como Vendure usa esta estrategia para `price`/`priceWithTax` de las
 * variantes y para el precio de las líneas del carrito, el pedido queda con el mismo precio
 * que vio el cliente.
 *
 * El manejo de impuestos es el mismo que el de `DefaultProductVariantPriceCalculationStrategy`.
 */
export class ListaPreciosStrategy implements ProductVariantPriceCalculationStrategy {
    private taxRateService: TaxRateService;
    private listaPreciosService: ListaPreciosService;

    init(injector: Injector) {
        this.taxRateService = injector.get(TaxRateService);
        this.listaPreciosService = injector.get(ListaPreciosService);
    }

    async calculate(args: ProductVariantPriceCalculationArgs): Promise<PriceCalculationResult> {
        const { activeTaxZone, ctx, taxCategory } = args;
        const inputPrice = await this.precioDeLista(args);
        let price = inputPrice;
        let priceIncludesTax = false;
        if (ctx.channel.pricesIncludeTax) {
            if (idsAreEqual(activeTaxZone.id, ctx.channel.defaultTaxZone.id)) {
                priceIncludesTax = true;
            } else {
                const taxRateForDefaultZone = await this.taxRateService.getApplicableTaxRate(
                    ctx,
                    ctx.channel.defaultTaxZone,
                    taxCategory,
                );
                price = roundMoney(taxRateForDefaultZone.netPriceOf(inputPrice));
            }
        }
        return { price, priceIncludesTax };
    }

    private async precioDeLista({ ctx, inputPrice, productVariant }: ProductVariantPriceCalculationArgs) {
        const lista = await this.listaPreciosService.getLista(ctx);
        if (lista === 'menudeo') {
            return inputPrice;
        }
        const customFields = productVariant.customFields as Record<string, unknown> | undefined;
        const precio = customFields?.[CAMPO_PRECIO_VARIANTE[lista]];
        // Si la variante no tiene precio en esa lista se queda con el de menudeo.
        return typeof precio === 'number' ? precio : inputPrice;
    }
}
