import {MigrationInterface, QueryRunner} from "typeorm";

/**
 * Versión de las reglas con que se generó cada documento de búsqueda (`SEARCH_TEXT_VERSION` en
 * `search-text.ts`). Al arrancar, el servidor reconstruye los documentos cuya versión ya no coincide,
 * así que cambiar sinónimos o reglas de texto no obliga a correr un comando (ni en producción, donde
 * los scripts de ts-node no están). Los documentos existentes quedan en 0 y se reconstruyen solos.
 */
export class BusquedaVersion1793990000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_search_document" ADD "textVersion" integer NOT NULL DEFAULT 0`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_search_document" DROP COLUMN "textVersion"`, undefined);
   }

}
