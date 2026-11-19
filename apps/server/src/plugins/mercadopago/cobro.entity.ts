import { EntityId, ID } from '@vendure/core';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Un intento de cobro con Mercado Pago: una fila por cada enlace de pago que se genera para un pedido
 * (el cliente puede cambiar de método o abandonar el pago y volver a intentarlo). Guarda lo que se le
 * mostró al cliente (pedido, comisión, total), el pago de Mercado Pago que lo cubrió y la comisión real que
 * descontó Mercado Pago, para conciliar. El pago "oficial" sigue siendo el `Payment` de Vendure.
 *
 * El índice único de `mpPaymentId` impide que un mismo pago de Mercado Pago se use para dos cobros. Los
 * índices llevan nombre explícito para coincidir con los de la migración (si no, una migración
 * autogenerada borraría la tabla). Montos en centavos, como Vendure.
 */
@Entity('mercadopago_cobro')
@Index('IDX_mercadopago_cobro_pedido', ['orderCode'])
@Index('IDX_mercadopago_cobro_pago', ['mpPaymentId'], { unique: true })
export class MercadoPagoCobro {
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @EntityId()
    orderId: ID;

    @Column({ type: 'varchar' })
    orderCode: string;

    /** `tarjeta` | `transferencia` | `efectivo` (ver `OPCIONES_PAGO`). */
    @Column({ type: 'varchar' })
    opcion: string;

    /** Lista de precios del cliente al cobrar: define si lleva comisión. */
    @Column({ type: 'varchar' })
    lista: string;

    /** Total del pedido (`totalWithTax`) al generar el enlace. */
    @Column({ type: 'integer' })
    montoPedido: number;

    /** Comisión que se le sumó al cliente (0 en la lista pública). */
    @Column({ type: 'integer' })
    comision: number;

    /** Lo que se le cobra en Mercado Pago: `montoPedido + comision`. */
    @Column({ type: 'integer' })
    total: number;

    @Column({ type: 'varchar', nullable: true })
    preferenciaId: string | null;

    /** Enlace de pago de Mercado Pago, para reusarlo mientras siga vigente. */
    @Column({ type: 'text', nullable: true })
    urlPago: string | null;

    /** Id del pago en Mercado Pago (único). Si hubo varios intentos, el más reciente. */
    @Column({ type: 'varchar', nullable: true })
    mpPaymentId: string | null;

    /** Estado del pago en Mercado Pago: approved, pending, rejected… */
    @Column({ type: 'varchar', nullable: true })
    mpEstado: string | null;

    /** Comisión que Mercado Pago descontó en realidad (con IVA), en centavos. */
    @Column({ type: 'integer', nullable: true })
    mpComision: number | null;

    /** Ver `ESTADO_COBRO`. */
    @Column({ type: 'varchar', default: 'creado' })
    estado: string;

    /** Por qué un cobro quedó en revisión, u otra observación. */
    @Column({ type: 'text', nullable: true })
    nota: string | null;

    /** Últimos datos del pago de Mercado Pago (JSON), para soporte. Sin datos de tarjeta. */
    @Column({ type: 'text', nullable: true })
    respuestaMp: string | null;
}
