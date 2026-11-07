import { EntityId, ID } from '@vendure/core';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Una búsqueda de un cliente ya "asentada" (no cada letra tecleada). Sirve para saber qué buscan,
 * sobre todo lo que no encuentran (`resultCount` = 0). No guarda la IP: `visitorId` es un id
 * aleatorio de una cookie de la tienda, y `customerId` solo existe si había iniciado sesión.
 * Se registra con SQL directo desde `SearchLogService`; la entidad existe para que Vendure sepa de
 * la tabla (si no, una migración autogenerada la borraría). Los índices llevan nombre explícito
 * para coincidir con los de la migración.
 */
@Entity()
@Index('IDX_search_log_createdAt', ['createdAt'])
@Index('IDX_search_log_termNormalized', ['termNormalized'])
@Index('IDX_search_log_visitorId', ['visitorId', 'createdAt'])
export class SearchLog {
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'varchar', length: 100 })
    term: string;

    @Column({ type: 'varchar', length: 100 })
    termNormalized: string;

    @Column({ type: 'varchar', length: 10 })
    languageCode: string;

    @Column({ type: 'int' })
    resultCount: number;

    @Column({ type: 'varchar', length: 64 })
    visitorId: string;

    @EntityId({ nullable: true })
    customerId: ID | null;
}
