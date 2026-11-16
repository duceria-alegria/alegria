import { EntityId, ID } from '@vendure/core';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Un producto que un cliente marcó como favorito. Un cliente no puede repetir el mismo producto
 * (índice único). Se lee y escribe con `FavoritosService`; la entidad existe para que Vendure sepa
 * de la tabla (si no, una migración autogenerada la borraría). El índice lleva nombre explícito
 * para coincidir con el de la migración.
 */
@Entity()
@Index('IDX_favorito_cliente_producto', ['customerId', 'productId'], { unique: true })
export class Favorito {
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    createdAt: Date;

    @EntityId()
    customerId: ID;

    @EntityId()
    productId: ID;
}
