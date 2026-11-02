import { Injectable } from '@nestjs/common';
import { CustomerService, RequestContext, RequestContextCacheService } from '@vendure/core';
import { esListaPrecios, LISTA_POR_DEFECTO, ListaPrecios } from './constants';

@Injectable()
export class ListaPreciosService {
    constructor(
        private customerService: CustomerService,
        private requestCache: RequestContextCacheService,
    ) {}

    /**
     * Lista de precios que le corresponde a quien hace la petición. Sin sesión de cliente
     * (visitante, admin) siempre es menudeo.
     */
    async getLista(ctx: RequestContext): Promise<ListaPrecios> {
        if (ctx.apiType !== 'shop' || !ctx.activeUserId) {
            return LISTA_POR_DEFECTO;
        }
        const userId = ctx.activeUserId;
        return this.requestCache.get(ctx, `listaPrecios:${userId}`, async () => {
            const customer = await this.customerService.findOneByUserId(ctx, userId);
            const lista = (customer?.customFields as { listaPrecios?: unknown } | undefined)?.listaPrecios;
            return esListaPrecios(lista) ? lista : LISTA_POR_DEFECTO;
        });
    }
}
