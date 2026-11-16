import {graphql} from '@/platform/vendure/graphql';

export const GetFavoriteIdsQuery = graphql(`
    query GetFavoriteIds {
        misFavoritos
    }
`);

export const AddFavoriteMutation = graphql(`
    mutation AddFavorite($productId: ID!) {
        agregarFavorito(productId: $productId)
    }
`);

export const RemoveFavoriteMutation = graphql(`
    mutation RemoveFavorite($productId: ID!) {
        quitarFavorito(productId: $productId)
    }
`);
