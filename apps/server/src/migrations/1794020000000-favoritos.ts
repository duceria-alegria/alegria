import {MigrationInterface, QueryRunner} from "typeorm";

/**
 * Favoritos de los clientes (plugin `favoritos`): una fila por cliente y producto. El índice único
 * evita repetidos y sirve para buscar los favoritos de un cliente.
 */
export class Favoritos1794020000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "favorito" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "customerId" integer NOT NULL, "productId" integer NOT NULL, CONSTRAINT "PK_favorito" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_favorito_cliente_producto" ON "favorito" ("customerId", "productId")`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_favorito_cliente_producto"`, undefined);
        await queryRunner.query(`DROP TABLE "favorito"`, undefined);
   }

}
