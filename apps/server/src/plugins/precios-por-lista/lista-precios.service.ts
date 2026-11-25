import { Injectable } from '@nestjs/common';
import { CustomerService, ID, RequestContext, RequestContextCacheService } from '@vendure/core';
import { esListaPrecios, LISTA_POR_DEFECTO, ListaPrecios } from './constants';

const CLAVE_LISTA_FIJA = 'listaPrecios:fija';

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
        if (ctx.apiType !== 'shop') {
            return LISTA_POR_DEFECTO;
        }
        const fija = this.requestCache.get<ListaPrecios | undefined>(ctx, CLAVE_LISTA_FIJA);
        if (fija) {
            return fija;
        }
        return ctx.activeUserId ? this.getListaDeUsuario(ctx, ctx.activeUserId) : LISTA_POR_DEFECTO;
    }

    /** Lista asignada al cliente de ese usuario (menudeo si no tiene o no es válida). */
    async getListaDeUsuario(ctx: RequestContext, userId: ID): Promise<ListaPrecios> {
        return this.requestCache.get(ctx, `listaPrecios:${userId}`, async () => {
            const customer = await this.customerService.findOneByUserId(ctx, userId);
            const lista = (customer?.customFields as { listaPrecios?: unknown } | undefined)?.listaPrecios;
            return esListaPrecios(lista) ? lista : LISTA_POR_DEFECTO;
        });
    }

    /**
     * Fuerza la lista para el resto de esta petición. Se usa en el login, donde la petición todavía es
     * anónima (`ctx.activeUserId` vacío) pero ya se sabe quién entró.
     */
    fijarLista(ctx: RequestContext, lista: ListaPrecios) {
        this.requestCache.set(ctx, CLAVE_LISTA_FIJA, lista);
    }
}
