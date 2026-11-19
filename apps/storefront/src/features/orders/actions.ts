'use server';

import {updateTag} from 'next/cache';

/**
 * Tras pagar con Mercado Pago el cliente regresa por su cuenta (no por una acción de la tienda), así que el
 * carrito del encabezado sigue en caché con el pedido ya cerrado. Se invalida igual que al hacer el pedido.
 */
export async function refreshCartCache() {
    updateTag('cart');
    updateTag('active-order');
}
