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
