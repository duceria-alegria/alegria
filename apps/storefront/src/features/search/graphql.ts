import {graphql} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '@/features/products/graphql';

// Registra una búsqueda ya asentada (ver search-log-handler.ts). Solo la tienda la puede llamar.
export const RegisterSearchMutation = graphql(`
    mutation RegisterSearch($input: RegistrarBusquedaInput!) {
        registrarBusqueda(input: $input)
    }
`);

export const SearchProductsQuery = graphql(`
    query SearchProducts($input: SearchInput!) {
        search(input: $input) {
            totalItems
            items {
                ...ProductCard
            }
            facetValues {
                count
                facetValue {
                    id
                    name
                    facet {
                        id
                        name
                    }
                }
            }
        }
    }
`, [ProductCardFragment]);

// Todos los valores de filtro de una búsqueda/colección SIN aplicar los filtros elegidos, para poder
// seguir mostrando las opciones no marcadas (Vendure solo devuelve las que quedan en el resultado filtrado).
export const SearchFacetValuesQuery = graphql(`
    query SearchFacetValues($input: SearchInput!) {
        search(input: $input) {
            facetValues {
                count
                facetValue {
                    id
                    name
                    facet {
                        id
                        name
                    }
                }
            }
        }
    }
`);
