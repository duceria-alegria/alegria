export const LISTAS_PRECIOS = ['menudeo', 'mayoreo1', 'mayoreo2', 'mayoreo3'] as const;
export type ListaPrecios = (typeof LISTAS_PRECIOS)[number];

export const LISTA_POR_DEFECTO: ListaPrecios = 'menudeo';

/** Campo personalizado de ProductVariant que guarda el precio (en centavos) de cada lista de mayoreo. */
export const CAMPO_PRECIO_VARIANTE: Record<Exclude<ListaPrecios, 'menudeo'>, string> = {
    mayoreo1: 'precioMayoreo1',
    mayoreo2: 'precioMayoreo2',
    mayoreo3: 'precioMayoreo3',
};

export function esListaPrecios(value: unknown): value is ListaPrecios {
    return LISTAS_PRECIOS.includes(value as ListaPrecios);
}
