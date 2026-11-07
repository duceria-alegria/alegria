import {MigrationInterface, QueryRunner} from "typeorm";

/**
 * Clave fonética del documento de búsqueda (plugin `busqueda-productos`): el mismo texto con las
 * confusiones del español colapsadas (c/k/qu, z/s, v/b, y/ll/i, h muda...) para que "lukas" encuentre
 * "lucas". Los documentos existentes quedan vacíos y el plugin los reconstruye solo al arrancar.
 */
export class BusquedaFonetica1793970000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_search_document" ADD "documentPhonetic" text NOT NULL DEFAULT ''`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_product_search_document_phonetic_trgm" ON "product_search_document" USING GIN ("documentPhonetic" gin_trgm_ops)`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_product_search_document_phonetic_trgm"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_search_document" DROP COLUMN "documentPhonetic"`, undefined);
   }

}
