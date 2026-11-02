import {MigrationInterface, QueryRunner} from "typeorm";

export class ListaPreciosCliente1793300100000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "customer" ADD "customFieldsListaprecios" character varying(255) DEFAULT 'menudeo'`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "customFieldsListaprecios"`, undefined);
   }

}
