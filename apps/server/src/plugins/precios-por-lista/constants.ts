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

export function esListaPrecios(value: unknown): value is ListaPrecios {
    return LISTAS_PRECIOS.includes(value as ListaPrecios);
}

/** Una variante es una caja cuando tiene definidas las piezas que trae. */
export function esCaja(variante: { customFields?: unknown }): boolean {
    const piezas = (variante.customFields as Record<string, unknown> | undefined)?.[CAMPO_PIEZAS_POR_CAJA];
    return typeof piezas === 'number' && piezas > 0;
}
