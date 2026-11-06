/**
 * Reconstruye el índice de búsqueda de productos (`product_search_document`) desde el catálogo.
 * Normalmente no hace falta: el plugin lo mantiene solo y se repara al arrancar. Tras editar los
 * sinónimos o las reglas de texto (`plugins/busqueda-productos/search-text.ts`) basta subir
 * `SEARCH_TEXT_VERSION`: el servidor reconstruye solo al arrancar, también en producción. Este script
 * fuerza la reconstrucción en desarrollo (en producción no hay ts-node).
 *
 * Uso (desde apps/server):  npx ts-node src/reindex-busqueda.ts
 */
import { bootstrapWorker } from '@vendure/core';
import { ProductSearchDocumentService } from './plugins/busqueda-productos/product-search-document.service';
import { config } from './vendure-config';

async function main() {
    const { app } = await bootstrapWorker(config);
    const total = await app.get(ProductSearchDocumentService).reindexAll();
    console.log(`Listo: ${total} productos reindexados en la búsqueda.`);
    await app.close();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
