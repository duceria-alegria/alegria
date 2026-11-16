import {MigrationInterface, QueryRunner} from "typeorm";

export class PiezasPorPaquete1794030000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsPiezasporpaquete" integer`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsPiezasporpaquete"`, undefined);
   }

}
