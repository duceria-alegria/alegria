import {getActiveCustomer} from '@/features/account/customer';
import {getAuthToken} from '@/platform/vendure/auth-token';

/**
 * Token del cliente con sesión iniciada, o `undefined` para visitantes.
 *
 * Los precios de mayoreo dependen de la lista asignada al cliente, así que las consultas
 * de productos de un cliente con sesión se hacen con su token y NO deben pasar por un
 * `'use cache'` público (compartiría el precio de menudeo, o peor, el de otro cliente).
 * Los visitantes siguen usando las versiones cacheadas.
 */
export async function getPricingToken(): Promise<string | undefined> {
    const customer = await getActiveCustomer();
    return customer ? getAuthToken() : undefined;
}
