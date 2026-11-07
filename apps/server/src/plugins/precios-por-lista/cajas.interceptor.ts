import {
    Injector,
    Order,
    OrderInterceptor,
    RequestContext,
    WillAddItemToOrderInput,
    WillAdjustOrderLineInput,
} from '@vendure/core';
import { CajasService } from './cajas.service';
import { esCaja } from './constants';

const SOLO_MAYOREO = 'Las cajas solo están disponibles para clientes de mayoreo.';

/**
 * Evita que quien no es de mayoreo meta una caja al carrito, aunque llame a la API directamente
 * (ocultarla en la tienda no basta). Bajar la cantidad de una caja que ya estaba sí se permite.
 */
export class CajasInterceptor implements OrderInterceptor {
    private cajasService: CajasService;

    init(injector: Injector) {
        this.cajasService = injector.get(CajasService);
    }

    async willAddItemToOrder(ctx: RequestContext, _order: Order, { productVariant }: WillAddItemToOrderInput) {
        if (esCaja(productVariant) && !(await this.cajasService.puedeVerCajas(ctx))) {
            return SOLO_MAYOREO;
        }
    }

    async willAdjustOrderLine(
        ctx: RequestContext,
        _order: Order,
        { orderLine, quantity }: WillAdjustOrderLineInput,
    ) {
        if (
            quantity > orderLine.quantity &&
            esCaja(orderLine.productVariant) &&
            !(await this.cajasService.puedeVerCajas(ctx))
        ) {
            return SOLO_MAYOREO;
        }
    }
}
