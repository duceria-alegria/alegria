import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';
import { Favorito } from './favorito.entity';
import { FavoritosResolver } from './favoritos.resolver';
import { FavoritosService } from './favoritos.service';

const shopApiSchema = gql`
    extend type Query {
        "Ids de los productos favoritos del cliente con sesión, el más reciente primero."
        misFavoritos: [ID!]!
    }

    extend type Mutation {
        "Marca un producto como favorito (si ya lo era no cambia nada). Devuelve todos los favoritos."
        agregarFavorito(productId: ID!): [ID!]!
        "Quita un producto de los favoritos. Devuelve los que quedan."
        quitarFavorito(productId: ID!): [ID!]!
    }
`;

/**
 * Favoritos de los clientes: cada cliente con sesión guarda una lista de productos para volver a
 * ellos rápido, y la ve en cualquier dispositivo. Se lee con `misFavoritos`; la tienda pinta las
 * tarjetas con `search(input: { productIds })` (filtro que agrega el plugin `busqueda-productos`).
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Favorito],
    providers: [FavoritosService],
    shopApiExtensions: { schema: shopApiSchema, resolvers: [FavoritosResolver] },
    compatibility: '^3.0.0',
})
export class FavoritosPlugin {}
