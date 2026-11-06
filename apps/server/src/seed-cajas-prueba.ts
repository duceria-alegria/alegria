/**
 * Convierte los productos de una sola variante en productos con Pieza y Caja (dos variantes del
 * grupo de opciones "Presentación"), para probar la venta por caja a clientes de mayoreo sin armar
 * cada producto a mano en el Dashboard.
 *
 * Qué hace por cada producto con una sola variante y sin caja:
 *  - Enlaza el grupo "Presentación" (Pieza / Caja; se crea si no existe y es compartido).
 *  - La variante actual pasa a ser Pieza (conserva precios y SKU; solo se le agrega la opción y
 *    el sufijo " - Pieza" al nombre).
 *  - Crea la variante Caja: SKU `<sku>-CAJA`, `piezasPorCaja` y precio de cada lista =
 *    piezas × precio de la pieza en esa lista × (1 − DESCUENTO_CAJA). Así la caja sale más barata
 *    por pieza en todas las listas, como pidió el dueño.
 *
 * Son DATOS DE PRUEBA: las piezas por caja se toman del primer número del nombre ("24/5 PZS" → 24)
 * y el descuento es fijo. Ajusta ambos en el Dashboard cuando el dueño dé los reales.
 *
 * Es idempotente: un producto que ya tiene una variante con `piezasPorCaja` se omite. Al final
 * encola un reindexado de búsqueda (lo procesa el worker, que debe estar corriendo).
 *
 * Uso (desde apps/server):  npx ts-node src/seed-cajas-prueba.ts
 */
import {
    bootstrapWorker,
    LanguageCode,
    Product,
    ProductOptionGroup,
    ProductOptionGroupService,
    ProductOptionService,
    ProductService,
    ProductVariant,
    ProductVariantPrice,
    ProductVariantService,
    RequestContext,
    RequestContextService,
    SearchService,
    TransactionalConnection,
} from '@vendure/core';
import { IsNull } from 'typeorm';
import { config } from './vendure-config';
import { CAMPO_PIEZAS_POR_CAJA, CAMPO_PRECIO_VARIANTE, esCaja } from './plugins/precios-por-lista/constants';

// Solo para desarrollo local. No usar en producción.
const DESCUENTO_CAJA = 0.1;
const CODIGO_GRUPO = 'presentacion';
const OPCIONES = { pieza: 'Pieza', caja: 'Caja' } as const;

const traduccion = (name: string) => [{ languageCode: LanguageCode.es, name }];

async function main() {
    const { app } = await bootstrapWorker(config);
    const ctx = await app.get(RequestContextService).create({ apiType: 'admin' });
    const connection = app.get(TransactionalConnection);
    const grupoService = app.get(ProductOptionGroupService);
    const opcionService = app.get(ProductOptionService);
    const productService = app.get(ProductService);
    const variantService = app.get(ProductVariantService);

    const buscarGrupo = () =>
        connection
            .getRepository(ctx, ProductOptionGroup)
            .findOne({ where: { code: CODIGO_GRUPO, deletedAt: IsNull() }, relations: { options: true } });

    let grupo = await buscarGrupo();
    if (!grupo) {
        const creado = await grupoService.create(ctx, {
            code: CODIGO_GRUPO,
            translations: [{ languageCode: LanguageCode.es, name: 'Presentación' }],
        });
        console.log(`+ grupo "Presentación" creado (id ${creado.id})`);
        grupo = await buscarGrupo();
    }
    for (const [code, name] of Object.entries(OPCIONES)) {
        if (!grupo!.options.some(o => o.code === code && !o.deletedAt)) {
            await opcionService.create(ctx, grupo!.id, { code, translations: traduccion(name) });
            console.log(`+ opción "${name}" creada`);
        }
    }
    grupo = await buscarGrupo();
    const idOpcion = (code: string) => grupo!.options.find(o => o.code === code)!.id;

    const productos = await connection.getRepository(ctx, Product).find({
        where: { deletedAt: IsNull() },
        relations: { variants: { options: true }, translations: true, optionGroups: true },
        order: { id: 'ASC' },
    });

    let creadas = 0;
    for (const producto of productos) {
        const nombre = (producto.translations.find(t => t.languageCode === LanguageCode.es) ?? producto.translations[0]).name;
        const variantes = producto.variants.filter(v => !v.deletedAt);
        if (variantes.some(esCaja)) {
            console.log(`= ${nombre}: ya tiene caja`);
            continue;
        }
        if (variantes.length !== 1) {
            console.log(`- ${nombre}: se omite (${variantes.length} variantes, se esperaba 1)`);
            continue;
        }
        const piezasPorCaja = Number(/(\d+)\s*\/\s*\d+/.exec(nombre)?.[1]);
        if (!(piezasPorCaja >= 2)) {
            console.log(`- ${nombre}: se omite (no se pudo sacar las piezas por caja del nombre)`);
            continue;
        }

        const pieza = variantes[0];
        const precioBase = await precioDe(ctx, connection, pieza.id);
        const listas = Object.fromEntries(
            Object.values(CAMPO_PRECIO_VARIANTE).map(campo => [
                campo,
                Math.round(piezasPorCaja * ((pieza.customFields as Record<string, number | null>)[campo] ?? precioBase) * (1 - DESCUENTO_CAJA)),
            ]),
        );

        await productService.addOptionGroupToProduct(ctx, producto.id, grupo!.id);
        if (!pieza.options.some(o => o.id === idOpcion('pieza'))) {
            await variantService.update(ctx, [
                { id: pieza.id, optionIds: [idOpcion('pieza')], translations: traduccion(`${nombre} - ${OPCIONES.pieza}`) },
            ]);
        }
        await variantService.create(ctx, [
            {
                productId: producto.id,
                sku: `${pieza.sku}-CAJA`,
                translations: traduccion(`${nombre} - ${OPCIONES.caja}`),
                optionIds: [idOpcion('caja')],
                price: Math.round(piezasPorCaja * precioBase * (1 - DESCUENTO_CAJA)),
                taxCategoryId: pieza.taxCategoryId,
                trackInventory: pieza.trackInventory,
                featuredAssetId: pieza.featuredAssetId ?? undefined,
                customFields: { [CAMPO_PIEZAS_POR_CAJA]: piezasPorCaja, ...listas },
            },
        ]);
        creadas++;
        console.log(`+ ${nombre}: caja de ${piezasPorCaja} (${pieza.sku}-CAJA)`);
    }
    // Los eventos de cada variante ya encolan su indexado, pero el seed termina enseguida y alguno
    // puede perderse; el reindexado completo (lo que hace la mutación `reindex`) lo garantiza.
    await app.get(SearchService).reindex(ctx);
    console.log(`Listo: ${creadas} cajas creadas; reindexado de búsqueda encolado.`);
    await app.close();
}

async function precioDe(ctx: RequestContext, connection: TransactionalConnection, variantId: ProductVariant['id']) {
    const precio = await connection
        .getRepository(ctx, ProductVariantPrice)
        .findOneOrFail({ where: { variant: { id: variantId }, channelId: ctx.channelId, currencyCode: ctx.currencyCode } });
    return precio.price;
}

main().then(
    () => process.exit(0),
    err => {
        console.error(err);
        process.exit(1);
    },
);
