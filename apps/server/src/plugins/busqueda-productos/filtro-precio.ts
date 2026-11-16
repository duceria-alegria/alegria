import { Query, Resolver } from '@nestjs/graphql';
import { Allow, applyLanguageConstraints, Ctx, Permission, ProductVariant, RequestContext, TransactionalConnection } from '@vendure/core';
// La entidad del índice no está en la API pública de Vendure (@vendure/core está fijado en 3.8.1).
import { SearchIndexItem } from '@vendure/core/dist/plugin/default-search-plugin/entities/search-index-item.entity';
import { SelectQueryBuilder } from 'typeorm';
import { CajasService } from '../precios-por-lista/cajas.service';
import { CAMPO_PIEZAS_POR_CAJA, CAMPO_PRECIO_VARIANTE, ListaPrecios } from '../precios-por-lista/constants';
import { ListaPreciosService } from '../precios-por-lista/lista-precios.service';

/** Con qué precios se compara: los de la lista del cliente y sin cajas si no puede verlas. */
export interface ContextoPrecio {
    lista: ListaPrecios;
    puedeVerCajas: boolean;
}

/** Columna de `product_variant` de un campo personalizado ("precioMayoreo1" → customFieldsPreciomayoreo1). */
const columnaDeVariante = (campo: string) => `"pv"."customFields${campo[0].toUpperCase()}${campo.slice(1).toLowerCase()}"`;

/**
 * Precio con impuestos, en centavos, que ve el cliente en cada variante. El índice solo guarda el de
 * menudeo; para las listas de mayoreo se toma el precio de la lista (o el de menudeo si la variante
 * no lo tiene) con la misma proporción de impuestos que el índice. Requiere el join `pv` de
 * `unirVariante` cuando la lista no es menudeo.
 */
export function expresionPrecio(lista: ListaPrecios): string {
    if (lista === 'menudeo') {
        return '"si"."priceWithTax"';
    }
    const precioLista = columnaDeVariante(CAMPO_PRECIO_VARIANTE[lista]);
    return `COALESCE(ROUND(COALESCE(${precioLista}, "si"."price")::numeric * "si"."priceWithTax" / NULLIF("si"."price", 0)), "si"."priceWithTax")`;
}

/** Une la variante (`pv`) a la fila del índice y deja fuera las cajas si quien consulta no las puede ver. */
export function unirVariante(qb: SelectQueryBuilder<SearchIndexItem>, { puedeVerCajas }: ContextoPrecio) {
    qb.innerJoin(ProductVariant, 'pv', '"pv"."id" = "si"."productVariantId"');
    if (!puedeVerCajas) {
        qb.andWhere(`${columnaDeVariante(CAMPO_PIEZAS_POR_CAJA)} IS NULL`);
    }
    return qb;
}

export async function contextoDePrecio(
    listaPreciosService: ListaPreciosService,
    cajasService: CajasService,
    ctx: RequestContext,
): Promise<ContextoPrecio> {
    return { lista: await listaPreciosService.getLista(ctx), puedeVerCajas: await cajasService.puedeVerCajas(ctx) };
}

/**
 * El precio más bajo y el más alto del catálogo a la venta (en centavos, con impuestos), según la
 * lista de quien consulta. Son los extremos de la barra del filtro de precio de la tienda; no
 * dependen de la búsqueda ni de los filtros elegidos para que la barra no cambie de escala.
 */
@Resolver()
export class RangoPreciosResolver {
    constructor(
        private connection: TransactionalConnection,
        private listaPreciosService: ListaPreciosService,
        private cajasService: CajasService,
    ) {}

    @Query()
    @Allow(Permission.Public)
    async rangoPrecios(@Ctx() ctx: RequestContext): Promise<{ min: number; max: number }> {
        const contexto = await contextoDePrecio(this.listaPreciosService, this.cajasService, ctx);
        const precio = expresionPrecio(contexto.lista);
        const qb = this.connection
            .getRepository(ctx, SearchIndexItem)
            .createQueryBuilder('si')
            .select(`MIN(${precio})`, 'min')
            .addSelect(`MAX(${precio})`, 'max')
            .where('"si"."enabled" = :enabled', { enabled: true })
            .andWhere('"si"."channelId" = :channelId', { channelId: ctx.channelId });
        unirVariante(qb, contexto);
        applyLanguageConstraints(qb, ctx.languageCode, ctx.channel.defaultLanguageCode);
        const fila = await qb.getRawOne<{ min: string | null; max: string | null }>();
        return { min: Math.floor(Number(fila?.min ?? 0)), max: Math.ceil(Number(fila?.max ?? 0)) };
    }
}
