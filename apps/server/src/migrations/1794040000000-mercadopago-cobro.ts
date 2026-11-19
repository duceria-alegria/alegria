import {MigrationInterface, QueryRunner} from "typeorm";

/**
 * Intentos de cobro con Mercado Pago (plugin `mercadopago`): una fila por enlace de pago generado. El índice
 * único de `mpPaymentId` impide usar un mismo pago de Mercado Pago en dos cobros (los NULL no chocan).
 */
export class MercadopagoCobro1794040000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "mercadopago_cobro" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "orderId" integer NOT NULL, "orderCode" character varying NOT NULL, "opcion" character varying NOT NULL, "lista" character varying NOT NULL, "montoPedido" integer NOT NULL, "comision" integer NOT NULL, "total" integer NOT NULL, "preferenciaId" character varying, "urlPago" text, "mpPaymentId" character varying, "mpEstado" character varying, "mpComision" integer, "estado" character varying NOT NULL DEFAULT 'creado', "nota" text, "respuestaMp" text, CONSTRAINT "PK_mercadopago_cobro" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_mercadopago_cobro_pedido" ON "mercadopago_cobro" ("orderCode")`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_mercadopago_cobro_pago" ON "mercadopago_cobro" ("mpPaymentId")`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_mercadopago_cobro_pago"`, undefined);
        await queryRunner.query(`DROP INDEX "IDX_mercadopago_cobro_pedido"`, undefined);
        await queryRunner.query(`DROP TABLE "mercadopago_cobro"`, undefined);
   }

}
