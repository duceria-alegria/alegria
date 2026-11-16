import {cacheLife, cacheTag} from 'next/cache';
import {query} from '@/platform/vendure/api';
import {GetLineasQuery} from './graphql';

const CODIGO_FILTRO_LINEA = 'linea';

/** Las líneas de producto (valores del filtro "Línea") que tienen productos a la venta, por código. */
export async function getLineas(locale: string) {
    'use cache';
    cacheLife('days');
    cacheTag(`lineas-${locale}`);

    const result = await query(GetLineasQuery, undefined, {languageCode: locale});
    return result.data.search.facetValues
        .filter(({facetValue}) => facetValue.facet.code === CODIGO_FILTRO_LINEA)
        .map(({count, facetValue}) => ({id: facetValue.id, code: facetValue.code, name: facetValue.name, count}));
}
