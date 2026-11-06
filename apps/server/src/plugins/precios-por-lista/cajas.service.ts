import { Injectable } from '@nestjs/common';
import { ProductVariant, RequestContext, RequestContextCacheService, TransactionalConnection } from '@vendure/core';
import { CAMPO_PIEZAS_POR_CAJA, esCaja, LISTA_POR_DEFECTO } from './constants';
import { ListaPreciosService } from './lista-precios.service';

/**
 * Las cajas son variantes con `piezasPorCaja`: solo las ven y compran los clientes de mayoreo.
 * Fuera de la API de la tienda (Dashboard, scripts) no hay restricción.
 */
@Injectable()
export class CajasService {
    constructor(
        private connection: TransactionalConnection,
        private listaPreciosService: ListaPreciosService,
        private requestCache: RequestContextCacheService,
    ) {}

    async puedeVerCajas(ctx: RequestContext): Promise<boolean> {
        return ctx.apiType !== 'shop' || (await this.listaPreciosService.getLista(ctx)) !== LISTA_POR_DEFECTO;
    }

    /** Quita las cajas de la lista cuando quien pregunta no es de mayoreo. */
    async visibles<T extends { customFields?: unknown }>(ctx: RequestContext, variantes: T[]): Promise<T[]> {
        return (await this.puedeVerCajas(ctx)) ? variantes : variantes.filter(v => !esCaja(v));
    }

    /**
     * Ids de los productos que tienen alguna caja. Es una sola consulta por petición y sirve para
     * que el buscador solo recalcule los productos que sí tienen cajas.
     */
    productosConCajas(ctx: RequestContext): Promise<Set<string>> {
        return this.requestCache.get(ctx, 'productosConCajas', async () => {
            const filas = await this.connection
                .getRepository(ctx, ProductVariant)
                .createQueryBuilder('variant')
                .select('variant.productId', 'productId')
                .distinct(true)
                .where('variant.deletedAt IS NULL')
                .andWhere(`variant.customFields.${CAMPO_PIEZAS_POR_CAJA} IS NOT NULL`)
                .getRawMany<{ productId: number | string }>();
            return new Set(filas.map(fila => String(fila.productId)));
        });
    }
}
