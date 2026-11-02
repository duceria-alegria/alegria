import { LanguageCode, Permission, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CAMPO_PRECIO_VARIANTE, LISTA_POR_DEFECTO } from './constants';
import { ListaPreciosService } from './lista-precios.service';
import { ListaPreciosStrategy } from './lista-precios.strategy';
import { SearchResultPriceResolver } from './search-result-price.resolver';

const es = (value: string) => [{ languageCode: LanguageCode.es, value }];

/**
 * Precios por lista: el precio de la variante es el de menudeo y hay tres listas de mayoreo.
 * Cada cliente tiene asignada una lista (campo `listaPrecios`); los visitantes sin sesión
 * y los clientes de menudeo ven siempre el precio base.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [ListaPreciosService],
    shopApiExtensions: { resolvers: [SearchResultPriceResolver] },
    configuration: config => {
        config.customFields.ProductVariant = [
            ...(config.customFields.ProductVariant ?? []),
            ...Object.entries(CAMPO_PRECIO_VARIANTE).map(([lista, name], i) => ({
                name,
                type: 'int' as const,
                label: es(`Precio mayoreo ${i + 1}`),
                description: es(`Precio de la lista ${lista}, en centavos. Si está vacío se usa el de menudeo.`),
                ui: { component: 'currency-form-input' },
            })),
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
                options: [
                    { value: 'menudeo', label: es('Menudeo') },
                    { value: 'mayoreo1', label: es('Mayoreo 1') },
                    { value: 'mayoreo2', label: es('Mayoreo 2') },
                    { value: 'mayoreo3', label: es('Mayoreo 3') },
                ],
            },
        ];
        config.catalogOptions.productVariantPriceCalculationStrategy = new ListaPreciosStrategy();
        return config;
    },
    compatibility: '^3.0.0',
})
export class PreciosPorListaPlugin {}
