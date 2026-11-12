import { LanguageCode, Permission, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CajasInterceptor } from './cajas.interceptor';
import { CajasService } from './cajas.service';
import { CAMPO_PIEZAS_POR_CAJA, CAMPO_PRECIO_VARIANTE, LISTA_POR_DEFECTO, LISTAS_PRECIOS, ListaPrecios, NOMBRE_LISTA } from './constants';
import { ListaPreciosService } from './lista-precios.service';
import { ListaPreciosStrategy } from './lista-precios.strategy';
import { ProductoCajasResolver } from './producto-cajas.resolver';
import { SearchResultPriceResolver } from './search-result-price.resolver';

const es = (value: string) => [{ languageCode: LanguageCode.es, value }];

/**
 * Precios por lista: el precio de la variante es el de menudeo ("Lista") y hay cuatro listas de mayoreo
 * (Mayoreo, Medio mayoreo, Super mayoreo y Mínimo).
 * Cada cliente tiene asignada una lista (campo `listaPrecios`); los visitantes sin sesión
 * y los clientes de menudeo ven siempre el precio base.
 *
 * Cajas: un producto se puede vender por Pieza y por Caja como dos variantes (cada una con su
 * precio por lista y su propio inventario). La variante con `piezasPorCaja` es la caja y solo la
 * ven y compran los clientes de mayoreo.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [ListaPreciosService, CajasService],
    shopApiExtensions: { resolvers: [SearchResultPriceResolver, ProductoCajasResolver] },
    configuration: config => {
        config.customFields.ProductVariant = [
            ...(config.customFields.ProductVariant ?? []),
            ...Object.entries(CAMPO_PRECIO_VARIANTE).map(([lista, name]) => ({
                name,
                type: 'int' as const,
                label: es(`Precio ${NOMBRE_LISTA[lista as ListaPrecios]}`),
                description: es(
                    `Precio de la lista ${NOMBRE_LISTA[lista as ListaPrecios]} (${lista}), en centavos. Si está vacío se usa el de Lista (menudeo).`,
                ),
                ui: { component: 'currency-form-input' },
                // Los precios de mayoreo no se exponen en la API de la tienda (ni a visitantes ni a
                // clientes de menudeo). El cálculo de precios los lee de la entidad y el Dashboard
                // (Admin API) los sigue viendo y editando.
                public: false,
            })),
            {
                name: CAMPO_PIEZAS_POR_CAJA,
                type: 'int' as const,
                min: 2,
                label: es('Piezas por caja'),
                description: es(
                    'Solo para la variante Caja: cuántas piezas trae. Con este dato la variante es una caja y solo la ven y compran los clientes de mayoreo. Déjalo vacío en la variante Pieza.',
                ),
            },
        ];
        config.customFields.Customer = [
            ...(config.customFields.Customer ?? []),
            {
                name: 'listaPrecios',
                type: 'string' as const,
                label: es('Lista de precios'),
                defaultValue: LISTA_POR_DEFECTO,
                // Solo quien puede editar clientes la ve y la cambia (el cliente no puede
                // elegir su propio precio, ni desde la API de la tienda).
                public: false,
                requiresPermission: [Permission.UpdateCustomer],
                options: LISTAS_PRECIOS.map(value => ({
                    value,
                    label: es(value === 'menudeo' ? 'Menudeo (Lista)' : NOMBRE_LISTA[value]),
                })),
            },
        ];
        config.catalogOptions.productVariantPriceCalculationStrategy = new ListaPreciosStrategy();
        config.orderOptions.orderInterceptors = [
            ...(config.orderOptions.orderInterceptors ?? []),
            new CajasInterceptor(),
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class PreciosPorListaPlugin {}
