import {MigrationInterface, QueryRunner} from "typeorm";

/**
 * Registro de lo que buscan los clientes (plugin `busqueda-productos`): una fila por búsqueda ya
 * asentada, con el término, cuántos productos dio y quién la hizo (id anónimo de visitante, y el
 * cliente si había iniciado sesión). No se guarda la IP. Se purga solo pasado el plazo de retención.
 */
export class RegistroBusquedas1793980000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "search_log" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "term" character varying(100) NOT NULL, "termNormalized" character varying(100) NOT NULL, "languageCode" character varying(10) NOT NULL, "resultCount" integer NOT NULL, "visitorId" character varying(64) NOT NULL, "customerId" integer, CONSTRAINT "PK_search_log" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_search_log_createdAt" ON "search_log" ("createdAt")`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_search_log_termNormalized" ON "search_log" ("termNormalized")`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_search_log_visitorId" ON "search_log" ("visitorId", "createdAt")`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_search_log_visitorId"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_search_log_termNormalized"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_search_log_createdAt"`, undefined);
        await queryRunner.query(`DROP TABLE "search_log"`, undefined);
   }

}
