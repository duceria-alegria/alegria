/**
 * Carga (o actualiza) el catálogo real a partir de la lista de precios del dueño: un producto de
 * una sola variante por artículo, con los 5 precios.
 *
 * Entrada: un JSON con un objeto por artículo, sacado de "productos con precios - revisado.xlsx"
 * (hoja "Productos con precio"), con los precios en pesos tal como vienen en el Excel:
 *   { linea, codigo, articulo, unidad, lista, mayoreo, medioMayoreo, superMayoreo, minimo }
 *
 * Qué precio va a cada lista:
 *   Precio 1 - Lista          → precio de la variante (menudeo, lo ven los visitantes)
 *   Precio 2 - Mayoreo        → precioMayoreo1
 *   Precio 3 - Medio mayoreo  → precioMayoreo2
 *   Precio 4 - Super mayoreo  → precioMayoreo3
 *   Precio 5 - Mínimo         → precioMayoreo4
 *
 * Reglas para no vender por debajo de lo debido (decididas con el usuario el 2026-11-12):
 *  - Un precio de mayoreo vacío, en 0 o menor a la mitad del de Lista NO se carga: se deja vacío y
 *    ese cliente paga el de Lista. Así un error del Excel (p. ej. Mínimo de $0.10) no se vende.
 *  - Un artículo con Lista vacía o en 0 se crea desactivado (no se ve en la tienda).
 * Lo que se dejó vacío o desactivado se escribe en `<entrada>.ajustes.csv` para revisarlo.
 *
 * SKU = el código del Excel; los artículos sin código reciben `ALG-<hash del nombre>` (estable, así
 * volver a correr el script encuentra el mismo artículo). Si el SKU ya existe se actualizan nombre,
 * precios, estado y facetas en vez de crear otro. La línea y la unidad de venta quedan como facetas
 * "Línea" y "Unidad". Igual que los productos de prueba: categoría de impuesto "Zero Tax" (los
 * precios del Excel ya traen impuesto) y sin control de inventario.
 *
 * Con `--borrar-prueba` también elimina (borrado suave) los productos de prueba con SKU `DA-…`.
 *
 * Uso (desde apps/server):  npx ts-node src/importar-productos.ts <archivo.json> [--borrar-prueba]
 * Al final completa los documentos del buscador propio y encola un reindexado de búsqueda de Vendure
 * (lo procesa el worker, que debe estar corriendo).
 *
 * En producción (sin ts-node), dentro del contenedor del server:  node dist/importar-productos.js <archivo.json>
 */
import {
    bootstrapWorker,
    Facet,
    FacetService,
    FacetValueService,
    LanguageCode,
    ProductService,
    ProductVariant,
    ProductVariantService,
    RequestContext,
    RequestContextService,
    runMigrations,
    SearchService,
    TaxCategory,
    TransactionalConnection,
} from '@vendure/core';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { IsNull, Like } from 'typeorm';
import { config } from './vendure-config';
import { ProductSearchDocumentService } from './plugins/busqueda-productos/product-search-document.service';
import { CAMPO_PRECIO_VARIANTE, ListaPrecios } from './plugins/precios-por-lista/constants';

interface Articulo {
    linea: string | null;
    codigo: string | null;
    articulo: string;
    unidad: string | null;
    lista: number | null;
    mayoreo: number | null;
    medioMayoreo: number | null;
    superMayoreo: number | null;
    minimo: number | null;
}

const COLUMNA_EXCEL: Record<Exclude<ListaPrecios, 'menudeo'>, keyof Articulo> = {
    mayoreo1: 'mayoreo',
    mayoreo2: 'medioMayoreo',
    mayoreo3: 'superMayoreo',
    mayoreo4: 'minimo',
};
const NOMBRE_COLUMNA: Record<string, string> = {
    mayoreo: 'Mayoreo',
    medioMayoreo: 'Medio mayoreo',
    superMayoreo: 'Super mayoreo',
    minimo: 'Mínimo',
};
/** Un precio de mayoreo por debajo de esta fracción del de Lista se toma como error del Excel. */
const FRACCION_MINIMA_DE_LISTA = 0.5;
const CATEGORIA_IMPUESTO = 'Zero Tax';
// `GlobalFlag` vive en @vendure/common, que no es dependencia directa del servidor.
type GlobalFlag = NonNullable<Parameters<ProductVariantService['create']>[1][number]['trackInventory']>;
const SIN_INVENTARIO = 'FALSE' as GlobalFlag;

const es = (name: string) => [{ languageCode: LanguageCode.es, name }];
const centavos = (pesos: number) => Math.round(pesos * 100);
const slug = (texto: string) =>
    texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
const skuDe = (a: Articulo) =>
    a.codigo ?? `ALG-${createHash('sha1').update(a.articulo).digest('hex').slice(0, 8).toUpperCase()}`;

async function main() {
    const [archivo, ...banderas] = process.argv.slice(2);
    if (!archivo) {
        throw new Error('Uso: npx ts-node src/importar-productos.ts <archivo.json> [--borrar-prueba]');
    }
    const articulos: Articulo[] = JSON.parse(readFileSync(archivo, 'utf8'));
    const skus = articulos.map(skuDe);
    if (new Set(skus).size !== skus.length) {
        throw new Error('Hay SKU repetidos en el archivo; no se cargó nada.');
    }

    await runMigrations(config);
    const { app } = await bootstrapWorker(config);
    const ctx = await app.get(RequestContextService).create({ apiType: 'admin', languageCode: LanguageCode.es });
    const connection = app.get(TransactionalConnection);
    const productService = app.get(ProductService);
    const variantService = app.get(ProductVariantService);
    const facetService = app.get(FacetService);
    const facetValueService = app.get(FacetValueService);

    if (banderas.includes('--borrar-prueba')) {
        const dePrueba = await connection.getRepository(ctx, ProductVariant).find({
            where: { sku: Like('DA-%'), deletedAt: IsNull() },
            relations: { product: true },
        });
        const ids = [...new Set(dePrueba.filter(v => !v.product.deletedAt).map(v => v.productId))];
        for (const id of ids) {
            await productService.softDelete(ctx, id);
        }
        console.log(`- ${ids.length} productos de prueba (SKU DA-…) eliminados`);
    }

    const taxCategory = await connection
        .getRepository(ctx, TaxCategory)
        .findOneOrFail({ where: { name: CATEGORIA_IMPUESTO } });
    const facetas = {
        linea: await valoresDeFaceta(ctx, 'linea', 'Línea', articulos.map(a => a.linea)),
        unidad: await valoresDeFaceta(ctx, 'unidad', 'Unidad', articulos.map(a => a.unidad)),
    };

    const ajustes: string[][] = [['SKU', 'Artículo', 'Lista', 'Precio', 'Valor en Excel', 'Qué se hizo']];
    let creados = 0;
    let actualizados = 0;
    for (const [i, a] of articulos.entries()) {
        const sku = skus[i];
        const activo = a.lista != null && a.lista > 0;
        if (!activo) {
            ajustes.push([sku, a.articulo, 'Lista', 'Lista', String(a.lista ?? ''), 'Producto desactivado (no se ve en la tienda)']);
        }
        const customFields: Record<string, number | null> = {};
        for (const [lista, columna] of Object.entries(COLUMNA_EXCEL)) {
            const valor = a[columna] as number | null;
            const valido = activo && valor != null && valor > 0 && valor >= a.lista! * FRACCION_MINIMA_DE_LISTA;
            customFields[CAMPO_PRECIO_VARIANTE[lista as Exclude<ListaPrecios, 'menudeo'>]] = valido ? centavos(valor) : null;
            if (activo && !valido) {
                ajustes.push([sku, a.articulo, lista, NOMBRE_COLUMNA[columna], String(valor ?? ''), 'Se dejó vacío: ese cliente paga el precio de Lista']);
            }
        }
        const facetValueIds = [
            a.linea && facetas.linea.get(a.linea),
            a.unidad && facetas.unidad.get(a.unidad),
        ].filter((id): id is NonNullable<typeof id> => !!id);
        const price = activo ? centavos(a.lista!) : 0;

        const existente = await connection
            .getRepository(ctx, ProductVariant)
            .findOne({ where: { sku, deletedAt: IsNull() }, relations: { product: true } });
        if (existente && !existente.product.deletedAt) {
            await productService.update(ctx, { id: existente.productId, enabled: activo, facetValueIds });
            await variantService.update(ctx, [
                { id: existente.id, enabled: activo, price, translations: es(a.articulo), customFields },
            ]);
            actualizados++;
        } else {
            const producto = await productService.create(ctx, {
                enabled: activo,
                facetValueIds,
                translations: [{ languageCode: LanguageCode.es, name: a.articulo, slug: slug(a.articulo), description: '' }],
            });
            await variantService.create(ctx, [
                {
                    productId: producto.id,
                    sku,
                    enabled: activo,
                    price,
                    taxCategoryId: taxCategory.id,
                    trackInventory: SIN_INVENTARIO,
                    translations: es(a.articulo),
                    customFields,
                },
            ]);
            creados++;
        }
        if ((i + 1) % 250 === 0) {
            console.log(`  ${i + 1}/${articulos.length}`);
        }
    }

    const archivoAjustes = archivo.replace(/\.json$/, '') + '.ajustes.csv';
    writeFileSync(archivoAjustes, ajustes.map(fila => fila.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n') + '\n');
    await app.get(SearchService).reindex(ctx);
    // Los documentos del buscador propio se actualizan por eventos y alguno puede quedar a medias al
    // cerrar el script; así quedan completos sin reiniciar el servidor.
    await app.get(ProductSearchDocumentService).syncMissing();
    console.log(
        `Listo: ${creados} creados, ${actualizados} actualizados, ${ajustes.length - 1} precios ajustados ` +
            `(ver ${archivoAjustes}); reindexado de búsqueda encolado.`,
    );
    await app.close();

    /** Asegura la faceta y un valor por cada texto distinto; devuelve texto → id del valor. */
    async function valoresDeFaceta(ctx: RequestContext, code: string, nombre: string, textos: Array<string | null>) {
        let facet = await connection
            .getRepository(ctx, Facet)
            .findOne({ where: { code }, relations: { values: { translations: true } } });
        if (!facet) {
            const creada = await facetService.create(ctx, { code, isPrivate: false, translations: es(nombre), values: [] });
            facet = await connection.getRepository(ctx, Facet).findOneOrFail({ where: { id: creada.id }, relations: { values: { translations: true } } });
        }
        const ids = new Map<string, Facet['id']>();
        for (const v of facet.values) {
            const t = v.translations.find(x => x.languageCode === LanguageCode.es) ?? v.translations[0];
            if (t) ids.set(t.name, v.id);
        }
        for (const texto of new Set(textos.filter((t): t is string => !!t))) {
            if (!ids.has(texto)) {
                const valor = await facetValueService.create(ctx, facet, { code: slug(texto) || code, translations: es(texto) });
                ids.set(texto, valor.id);
            }
        }
        return ids;
    }
}

main().then(
    () => process.exit(0),
    err => {
        console.error(err);
        process.exit(1);
    },
);
