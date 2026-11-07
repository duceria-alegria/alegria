import {MigrationInterface, QueryRunner} from "typeorm";

export class PiezasPorCaja1793890000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPiezasporcaja" integer`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPiezasporcaja"`, undefined);
   }

}
