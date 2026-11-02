import {MigrationInterface, QueryRunner} from "typeorm";

export class PreciosMayoreo1793300000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPreciomayoreo1" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPreciomayoreo2" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPreciomayoreo3" integer`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPreciomayoreo3"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPreciomayoreo2"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPreciomayoreo1"`, undefined);
   }

}
