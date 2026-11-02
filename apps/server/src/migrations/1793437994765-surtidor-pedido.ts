import {MigrationInterface, QueryRunner} from "typeorm";

export class SurtidorPedido1793437994765 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "order" ADD "customFields__fix_relational_custom_fields__" boolean`, undefined);
        await queryRunner.query(`COMMENT ON COLUMN "order"."customFields__fix_relational_custom_fields__" IS 'A work-around needed when only relational custom fields are defined on an entity'`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD "customFieldsSurtidorid" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD CONSTRAINT "FK_e62c51dc46946872bef0db5be86" FOREIGN KEY ("customFieldsSurtidorid") REFERENCES "administrator"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_e62c51dc46946872bef0db5be86"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "customFieldsSurtidorid"`, undefined);
        await queryRunner.query(`COMMENT ON COLUMN "order"."customFields__fix_relational_custom_fields__" IS 'A work-around needed when only relational custom fields are defined on an entity'`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "customFields__fix_relational_custom_fields__"`, undefined);
   }

}
