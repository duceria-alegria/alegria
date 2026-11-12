import {MigrationInterface, QueryRunner} from "typeorm";

export class PrecioMinimo1794000000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPreciomayoreo4" integer`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPreciomayoreo4"`, undefined);
   }

}
