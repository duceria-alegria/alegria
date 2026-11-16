export const LISTAS_PRECIOS = ['menudeo', 'mayoreo1', 'mayoreo2', 'mayoreo3', 'mayoreo4'] as const;
export type ListaPrecios = (typeof LISTAS_PRECIOS)[number];

export const LISTA_POR_DEFECTO: ListaPrecios = 'menudeo';

/** Nombre de cada lista como viene en la lista de precios del dueño (Precio 1 … Precio 5). */
export const NOMBRE_LISTA: Record<ListaPrecios, string> = {
    menudeo: 'Lista',
    mayoreo1: 'Mayoreo',
    mayoreo2: 'Medio mayoreo',
    mayoreo3: 'Super mayoreo',
    mayoreo4: 'Mínimo',
};

/** Campo personalizado de ProductVariant que guarda el precio (en centavos) de cada lista de mayoreo. */
export const CAMPO_PRECIO_VARIANTE: Record<Exclude<ListaPrecios, 'menudeo'>, string> = {
    mayoreo1: 'precioMayoreo1',
    mayoreo2: 'precioMayoreo2',
    mayoreo3: 'precioMayoreo3',
    mayoreo4: 'precioMayoreo4',
};

/** Campo personalizado de ProductVariant: si tiene valor, la variante es una caja con esas piezas. */
export const CAMPO_PIEZAS_POR_CAJA = 'piezasPorCaja';

/**
 * Campo personalizado de ProductVariant: cuántas piezas trae UN paquete de los que se venden como
 * "pieza" (en `24/40 PZ`, 40). Con él la tienda muestra el precio por pieza; vacío = no se muestra.
 * No confundir con `piezasPorCaja`, que marca a la variante Caja y cuenta paquetes.
 */
export const CAMPO_PIEZAS_POR_PAQUETE = 'piezasPorPaquete';

export function esListaPrecios(value: unknown): value is ListaPrecios {
    return LISTAS_PRECIOS.includes(value as ListaPrecios);
}

/** Una variante es una caja cuando tiene definidas las piezas que trae. */
export function esCaja(variante: { customFields?: unknown }): boolean {
    const piezas = (variante.customFields as Record<string, unknown> | undefined)?.[CAMPO_PIEZAS_POR_CAJA];
    return typeof piezas === 'number' && piezas > 0;
}
