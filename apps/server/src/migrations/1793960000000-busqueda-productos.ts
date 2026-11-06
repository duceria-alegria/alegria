import {MigrationInterface, QueryRunner} from "typeorm";

/**
 * Documento de búsqueda por producto e idioma (plugin `busqueda-productos`): texto ya normalizado
 * (sin acentos, minúsculas) más índices de trigramas para búsquedas por subcadena y con errores de
 * dedo. La tabla es un derivado: el plugin la reconstruye sola desde el catálogo.
 */
export class BusquedaProductos1793960000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`, undefined);
        await queryRunner.query(`CREATE TABLE "product_search_document" ("productId" integer NOT NULL, "languageCode" character varying NOT NULL, "nameNormalized" text NOT NULL, "skusNormalized" text NOT NULL, "documentNormalized" text NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_product_search_document" PRIMARY KEY ("productId", "languageCode"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_product_search_document_document_trgm" ON "product_search_document" USING GIN ("documentNormalized" gin_trgm_ops)`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_product_search_document_name_trgm" ON "product_search_document" USING GIN ("nameNormalized" gin_trgm_ops)`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_product_search_document_name_trgm"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_product_search_document_document_trgm"`, undefined);
        await queryRunner.query(`DROP TABLE "product_search_document"`, undefined);
   }

}
