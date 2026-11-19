import { Inject, Injectable } from '@nestjs/common';
import {
    ActiveOrderService,
    isGraphQlErrorResult,
    Logger,
    Order,
    OrderService,
    RequestContext,
    RequestContextService,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { ListaPreciosService } from '../precios-por-lista/lista-precios.service';
import { calcularComision, centavosAPesos, cobraComision, pesosACentavos } from './comision';
import { MercadoPagoCobro } from './cobro.entity';
import {
    CODIGO_MERCADOPAGO,
    ESTADO_COBRO,
    LOCALE_TIENDA,
    OPCIONES_PAGO,
    opcionPago,
    RUTA_WEBHOOK,
    VIGENCIA_PREFERENCIA_HORAS,
} from './constants';
import { MercadoPagoApi, MercadoPagoError, PagoMp, PreferenciaInput } from './mercadopago.api';
import { MERCADOPAGO_OPTIONS, MercadoPagoOptions } from './options';
import { analizarReferencia, armarReferencia, idPagoValido } from './referencia';

const loggerCtx = 'MercadoPago';
const HORA_MS = 3_600_000;
/** Tiempo mínimo entre dos consultas a Mercado Pago por el mismo pedido (la tienda consulta al volver). */
const ESPERA_VERIFICACION_MS = 4_000;
/** Un pago pendiente (SPEI) se sigue buscando este tiempo. */
const VIGENCIA_PENDIENTE_MS = 3 * 24 * HORA_MS;

export interface OpcionCobro {
    id: string;
    nombre: string;
    descripcion: string;
    montoPedido: number;
    comision: number;
    total: number;
    cobraComision: boolean;
}

export interface PagoCreado {
    urlPago: string;
    montoPedido: number;
    comision: number;
    total: number;
}

export type ValidacionPago = { ok: true; cobro: MercadoPagoCobro; pago: PagoMp } | { ok: false; motivo: string };

@Injectable()
export class MercadoPagoService {
    private readonly api?: MercadoPagoApi;
    private readonly ultimaVerificacion = new Map<string, number>();

    constructor(
        @Inject(MERCADOPAGO_OPTIONS) private readonly options: MercadoPagoOptions,
        private readonly connection: TransactionalConnection,
        private readonly orderService: OrderService,
        private readonly activeOrderService: ActiveOrderService,
        private readonly requestContextService: RequestContextService,
        private readonly listaPrecios: ListaPreciosService,
    ) {
        if (options.accessToken) {
            this.api = new MercadoPagoApi(options.accessToken);
        } else {
            Logger.warn('MERCADOPAGO_ACCESS_TOKEN no está definido: Mercado Pago queda apagado', loggerCtx);
        }
        if (!options.webhookSecret) {
            Logger.warn('MERCADOPAGO_WEBHOOK_SECRET no está definido: se rechazarán los avisos de Mercado Pago', loggerCtx);
        }
    }

    get webhookSecret(): string | undefined {
        return this.options.webhookSecret;
    }

    get configurado(): boolean {
        return !!this.api;
    }

    // ---------------------------------------------------------------------------------------------
    // Tienda: opciones de pago y enlace de pago
    // ---------------------------------------------------------------------------------------------

    /** Formas de pago con Mercado Pago para el carrito activo, con la comisión de cada una. */
    async opciones(ctx: RequestContext): Promise<OpcionCobro[]> {
        if (!this.api) return [];
        const order = await this.activeOrderService.getActiveOrder(ctx, undefined);
        if (!order || order.totalWithTax <= 0) return [];
        const lista = await this.listaPrecios.getLista(ctx);
        return OPCIONES_PAGO.filter(opcion => opcion.habilitada).map(opcion => ({
            id: opcion.id,
            nombre: opcion.nombre,
            descripcion: opcion.descripcion,
            montoPedido: order.totalWithTax,
            ...calcularComision(order.totalWithTax, lista, opcion.tarifa),
            cobraComision: cobraComision(lista),
        }));
    }

    /**
     * Genera (o reutiliza) el enlace de pago de Mercado Pago para el pedido activo, que debe estar en
     * `ArrangingPayment`. Guarda el intento en `mercadopago_cobro`; el pedido NO cambia hasta que Mercado Pago
     * avise que el pago se aprobó.
     */
    async crearPago(ctx: RequestContext, opcionId: string): Promise<PagoCreado> {
        if (!this.api) {
            throw new UserInputError('El pago con Mercado Pago no está disponible por ahora');
        }
        const def = opcionPago(opcionId);
        if (!def) {
            throw new UserInputError('Elige una forma de pago válida');
        }
        const activa = await this.activeOrderService.getActiveOrder(ctx, undefined);
        if (!activa) {
            throw new UserInputError('No hay un pedido activo');
        }
        const order = await this.orderService.findOne(ctx, activa.id, ['customer']);
        if (!order || order.state !== 'ArrangingPayment') {
            throw new UserInputError('El pedido todavía no está listo para pagar');
        }
        if (order.totalWithTax <= 0) {
            throw new UserInputError('El pedido no tiene nada que pagar');
        }
        const lista = await this.listaPrecios.getLista(ctx);
        const { comision, total } = calcularComision(order.totalWithTax, lista, def.tarifa);
        const repo = this.connection.getRepository(ctx, MercadoPagoCobro);

        // Si el cliente regresa y vuelve a elegir lo mismo, se reusa el enlace mientras siga vigente.
        const vigente = new Date(Date.now() - (VIGENCIA_PREFERENCIA_HORAS - 1) * HORA_MS);
        const previos = await repo.find({
            where: { orderCode: order.code, opcion: def.id, estado: ESTADO_COBRO.creado },
            order: { id: 'DESC' },
            take: 3,
        });
        const reusable = previos.find(c => c.total === total && c.montoPedido === order.totalWithTax && c.urlPago && c.createdAt > vigente);
        if (reusable?.urlPago) {
            return { urlPago: reusable.urlPago, montoPedido: reusable.montoPedido, comision: reusable.comision, total: reusable.total };
        }

        const cobro = await repo.save(
            repo.create({
                orderId: order.id,
                orderCode: order.code,
                opcion: def.id,
                lista,
                montoPedido: order.totalWithTax,
                comision,
                total,
                estado: ESTADO_COBRO.creado,
            }),
        );
        try {
            const preferencia = await this.api.crearPreferencia(
                this.armarPreferencia(order, cobro, def.tiposPermitidos, def.mensualidades),
            );
            cobro.preferenciaId = preferencia.id;
            cobro.urlPago = preferencia.init_point;
            await repo.save(cobro);
            return { urlPago: preferencia.init_point, montoPedido: cobro.montoPedido, comision, total };
        } catch (error) {
            Logger.error(`No se pudo crear la preferencia del pedido ${order.code}: ${(error as Error).message}`, loggerCtx);
            cobro.nota = `No se pudo crear el enlace de pago: ${(error as Error).message}`.slice(0, 1000);
            cobro.estado = ESTADO_COBRO.rechazado;
            await repo.save(cobro);
            throw new UserInputError('No pudimos iniciar el pago con Mercado Pago, intenta de nuevo en un momento');
        }
    }

    private armarPreferencia(
        order: Order,
        cobro: MercadoPagoCobro,
        tiposPermitidos: readonly string[],
        mensualidades: number | undefined,
    ): PreferenciaInput {
        const tienda = this.options.storefrontUrl;
        const retorno = `${tienda}/${LOCALE_TIENDA}/order-confirmation/${order.code}`;
        const items: PreferenciaInput['items'] = [
            {
                id: order.code,
                title: `Pedido ${order.code} - Dulcería Alegría`,
                quantity: 1,
                unit_price: centavosAPesos(cobro.montoPedido),
                currency_id: 'MXN',
            },
        ];
        if (cobro.comision > 0) {
            items.push({
                id: `comision-${order.code}`,
                title: 'Comisión por pago con Mercado Pago',
                quantity: 1,
                unit_price: centavosAPesos(cobro.comision),
                currency_id: 'MXN',
            });
        }
        const todos = new Set(OPCIONES_PAGO.flatMap(o => o.tiposPermitidos));
        // Mercado Pago solo sabe excluir: se excluye todo lo que no sea del grupo elegido.
        const excluidos = [...todos].filter(tipo => !tiposPermitidos.includes(tipo)).map(id => ({ id }));
        const preferencia: PreferenciaInput = {
            items,
            external_reference: armarReferencia(order.code, cobro.id),
            back_urls: { success: retorno, failure: retorno, pending: retorno },
            statement_descriptor: 'DULCERIA ALEGRIA',
            payment_methods: {
                excluded_payment_types: excluidos,
                ...(mensualidades ? { installments: mensualidades, default_installments: mensualidades } : {}),
            },
            expires: true,
            expiration_date_to: new Date(Date.now() + VIGENCIA_PREFERENCIA_HORAS * HORA_MS).toISOString().replace('Z', '+00:00'),
        };
        if (order.customer?.emailAddress) {
            preferencia.payer = { email: order.customer.emailAddress };
        }
        // Mercado Pago rechaza `auto_return` y los avisos con direcciones que no sean https públicas (localhost en dev).
        if (tienda.startsWith('https://')) {
            preferencia.auto_return = 'approved';
        }
        if (this.options.publicUrl?.startsWith('https://')) {
            preferencia.notification_url = `${this.options.publicUrl}/${RUTA_WEBHOOK}`;
        }
        return preferencia;
    }

    // ---------------------------------------------------------------------------------------------
    // Handler de pago: verificación contra Mercado Pago
    // ---------------------------------------------------------------------------------------------

    /**
     * Comprueba contra la API de Mercado Pago (nunca contra lo que mande el cliente) que `mpPaymentId` es un
     * pago aprobado de ESTE pedido, por el monto que se mostró al cliente, y que no se había usado. Si todo
     * cuadra marca el cobro como aplicado. Lo llama el handler al registrar el pago, venga el
     * `addPaymentToOrder` del webhook o de la Shop API: por eso un cliente no puede darse por pagado solo
     * llamando a esa mutación.
     *
     * Debe correr dentro de la transacción de `addPaymentToOrder` (toma el candado del cobro).
     */
    async validarParaPedido(ctx: RequestContext, order: Order, monto: number, mpPaymentId: unknown): Promise<ValidacionPago> {
        if (!this.api) return { ok: false, motivo: 'Mercado Pago no está configurado' };
        if (!idPagoValido(mpPaymentId)) return { ok: false, motivo: 'Falta el pago de Mercado Pago' };
        const pago = await this.api.obtenerPago(mpPaymentId);
        const ref = analizarReferencia(pago.external_reference);
        if (!ref || ref.orderCode !== order.code) {
            return { ok: false, motivo: 'El pago no corresponde a este pedido' };
        }
        const cobro = await this.cobroConCandado(ctx, ref.cobroId);
        if (!cobro || cobro.orderCode !== order.code) {
            return { ok: false, motivo: 'El pago no corresponde a este pedido' };
        }
        if (cobro.estado === ESTADO_COBRO.aplicado) {
            return { ok: false, motivo: 'Este pago ya se había registrado' };
        }
        if (pago.status !== 'approved') {
            return { ok: false, motivo: `El pago no está aprobado (${pago.status})` };
        }
        if (pago.currency_id !== 'MXN' || pesosACentavos(pago.transaction_amount) !== cobro.total) {
            return { ok: false, motivo: 'El monto pagado no coincide con el que se mostró al cliente' };
        }
        if (monto !== cobro.montoPedido) {
            return { ok: false, motivo: 'El total del pedido cambió después de generar el pago' };
        }
        this.anotarPago(cobro, pago);
        cobro.estado = ESTADO_COBRO.aplicado;
        await this.connection.getRepository(ctx, MercadoPagoCobro).save(cobro);
        return { ok: true, cobro, pago };
    }

    // ---------------------------------------------------------------------------------------------
    // Webhook, regreso del cliente y conciliación
    // ---------------------------------------------------------------------------------------------

    /**
     * Pone al día un pago de Mercado Pago: lo consulta a la API, actualiza su cobro y, si está aprobado y el
     * pedido sigue esperando el pago, lo registra (el handler lo vuelve a verificar). Es idempotente: se
     * puede llamar las veces que haga falta, desde el webhook (que Mercado Pago reintenta) o al conciliar.
     * Lanza error si no pudo consultar a Mercado Pago, para que el aviso se reintente.
     */
    async sincronizarPago(mpPaymentId: string): Promise<{ estado: string } | undefined> {
        if (!this.api) throw new MercadoPagoError('Mercado Pago no está configurado');
        const pago = await this.api.obtenerPago(mpPaymentId);
        const ref = analizarReferencia(pago.external_reference);
        if (!ref) {
            // Un pago de esa cuenta que no es de la tienda (otra venta, un link de pago…).
            return undefined;
        }
        const ctx = await this.ctxAdmin();
        return this.connection.withTransaction(ctx, async txCtx => {
            const cobro = await this.cobroConCandado(txCtx, ref.cobroId);
            if (!cobro || cobro.orderCode !== ref.orderCode) {
                Logger.warn(`Pago ${pago.id} con referencia ${pago.external_reference} sin cobro conocido`, loggerCtx);
                return undefined;
            }
            const repo = this.connection.getRepository(txCtx, MercadoPagoCobro);
            const id = String(pago.id);
            const mismoPago = cobro.mpPaymentId === id;

            if (cobro.estado === ESTADO_COBRO.aplicado || cobro.estado === ESTADO_COBRO.revision) {
                if (!mismoPago && pago.status === 'approved') {
                    // Pagó dos veces el mismo enlace, o dos pagos aprobados: el dueño debe devolver uno.
                    this.marcarRevision(cobro, `Hay otro pago aprobado en Mercado Pago (${id}) para este mismo cobro: devolver el que sobre.`);
                } else if (mismoPago && (pago.status === 'refunded' || pago.status === 'charged_back')) {
                    this.marcarRevision(cobro, `Mercado Pago marcó el pago ${id} como ${pago.status}: revisar el pedido en Vendure.`);
                } else {
                    return { estado: cobro.estado };
                }
                await repo.save(cobro);
                return { estado: cobro.estado };
            }

            this.anotarPago(cobro, pago);
            switch (pago.status) {
                case 'approved':
                    await this.aplicarAprobado(txCtx, cobro, pago);
                    break;
                case 'rejected':
                case 'cancelled':
                case 'refunded':
                case 'charged_back':
                    cobro.estado = ESTADO_COBRO.rechazado;
                    break;
                default:
                    // pending, in_process, authorized, in_mediation…
                    cobro.estado = ESTADO_COBRO.pendiente;
            }
            await repo.save(cobro);
            return { estado: cobro.estado };
        });
    }

    private async aplicarAprobado(ctx: RequestContext, cobro: MercadoPagoCobro, pago: PagoMp) {
        if (pago.currency_id !== 'MXN' || pesosACentavos(pago.transaction_amount) !== cobro.total) {
            return this.marcarRevision(cobro, `Mercado Pago cobró ${pago.transaction_amount} ${pago.currency_id} y se esperaba ${centavosAPesos(cobro.total)} MXN.`);
        }
        const order = await this.orderService.findOneByCode(ctx, cobro.orderCode);
        if (!order) {
            return this.marcarRevision(cobro, 'El pedido ya no existe.');
        }
        if (order.state !== 'ArrangingPayment') {
            return this.marcarRevision(cobro, `El pedido ya estaba en estado ${order.state} cuando llegó el pago.`);
        }
        if (order.totalWithTax !== cobro.montoPedido) {
            return this.marcarRevision(
                cobro,
                `El pedido cambió después de generar el pago: ahora vale ${centavosAPesos(order.totalWithTax)} y se cobró ${centavosAPesos(cobro.montoPedido)}.`,
            );
        }
        cobro.estado = ESTADO_COBRO.pendiente;
        await this.connection.getRepository(ctx, MercadoPagoCobro).save(cobro);
        const resultado = await this.orderService.addPaymentToOrder(ctx, order.id, {
            method: CODIGO_MERCADOPAGO,
            metadata: { mpPaymentId: String(pago.id) },
        });
        if (isGraphQlErrorResult(resultado)) {
            return this.marcarRevision(cobro, `Vendure no pudo registrar el pago: ${resultado.message} (${resultado.errorCode}).`);
        }
        cobro.estado = ESTADO_COBRO.aplicado;
    }

    private marcarRevision(cobro: MercadoPagoCobro, nota: string) {
        cobro.estado = ESTADO_COBRO.revision;
        cobro.nota = [cobro.nota, nota].filter(Boolean).join(' | ').slice(0, 2000);
        Logger.error(`Cobro ${cobro.id} del pedido ${cobro.orderCode} requiere revisión: ${nota}`, loggerCtx);
    }

    /** Guarda lo que dice Mercado Pago del pago (solo los datos que sirven para conciliar). */
    private anotarPago(cobro: MercadoPagoCobro, pago: PagoMp) {
        cobro.mpPaymentId = String(pago.id);
        cobro.mpEstado = pago.status;
        const comisiones = (pago.fee_details ?? []).filter(f => f.fee_payer === undefined || f.fee_payer === 'collector');
        cobro.mpComision = comisiones.length ? comisiones.reduce((suma, f) => suma + pesosACentavos(f.amount), 0) : null;
        cobro.respuestaMp = JSON.stringify({
            id: pago.id,
            status: pago.status,
            status_detail: pago.status_detail,
            payment_type_id: pago.payment_type_id,
            payment_method_id: pago.payment_method_id,
            transaction_amount: pago.transaction_amount,
            currency_id: pago.currency_id,
            date_approved: pago.date_approved,
            fee_details: pago.fee_details,
        });
    }

    private cobroConCandado(ctx: RequestContext, id: number): Promise<MercadoPagoCobro | null> {
        return this.connection
            .getRepository(ctx, MercadoPagoCobro)
            .createQueryBuilder('cobro')
            .setLock('pessimistic_write')
            .where('cobro.id = :id', { id })
            .getOne();
    }

    /**
     * Cuando el cliente regresa de Mercado Pago el aviso del webhook puede no haber llegado todavía (o no
     * poder llegar, como en desarrollo): se buscan sus pagos directo en Mercado Pago. Devuelve el estado del
     * cobro más relevante del pedido. No requiere sesión: no cambia nada que Mercado Pago no haya
     * confirmado y solo devuelve un estado, pero se limita a una consulta cada pocos segundos por pedido.
     */
    async verificarPedido(orderCode: string): Promise<string> {
        const ctx = await this.ctxAdmin();
        const repo = this.connection.getRepository(ctx, MercadoPagoCobro);
        const cobros = await repo.find({ where: { orderCode }, order: { id: 'DESC' }, take: 10 });
        if (!cobros.length) return 'sin_pago';

        const ahora = Date.now();
        const pendientes = cobros.filter(c => c.estado === ESTADO_COBRO.creado || c.estado === ESTADO_COBRO.pendiente);
        if (this.api && pendientes.length && ahora - (this.ultimaVerificacion.get(orderCode) ?? 0) > ESPERA_VERIFICACION_MS) {
            this.ultimaVerificacion.set(orderCode, ahora);
            if (this.ultimaVerificacion.size > 5000) this.ultimaVerificacion.clear();
            for (const cobro of pendientes) {
                await this.buscarYSincronizar(cobro);
            }
        }
        const actuales = await repo.find({ where: { orderCode }, order: { id: 'DESC' }, take: 10 });
        // Si alguno se aplicó, el pedido está pagado; si no, el intento más reciente cuenta.
        return (actuales.find(c => c.estado === ESTADO_COBRO.aplicado) ?? actuales[0]).estado;
    }

    /** Tarea programada: respaldo por si un aviso del webhook se perdió. */
    async conciliar(): Promise<{ revisados: number; cambiados: number }> {
        if (!this.api) return { revisados: 0, cambiados: 0 };
        const ctx = await this.ctxAdmin();
        const cobros = await this.connection
            .getRepository(ctx, MercadoPagoCobro)
            .createQueryBuilder('cobro')
            .where('cobro.estado IN (:...estados)', { estados: [ESTADO_COBRO.creado, ESTADO_COBRO.pendiente] })
            .andWhere('cobro.createdAt > :desde', { desde: new Date(Date.now() - VIGENCIA_PENDIENTE_MS) })
            .orderBy('cobro.id', 'DESC')
            .take(100)
            .getMany();
        let cambiados = 0;
        for (const cobro of cobros) {
            // Un enlace sin pago ya vencido no se vuelve a buscar.
            if (cobro.estado === ESTADO_COBRO.creado && Date.now() - cobro.createdAt.getTime() > VIGENCIA_PREFERENCIA_HORAS * HORA_MS) {
                continue;
            }
            if (await this.buscarYSincronizar(cobro)) cambiados++;
        }
        return { revisados: cobros.length, cambiados };
    }

    /** Busca los pagos de un cobro en Mercado Pago y los sincroniza. `true` si el estado del cobro cambió. */
    private async buscarYSincronizar(cobro: MercadoPagoCobro): Promise<boolean> {
        try {
            const pagos = await this.api!.buscarPagos(armarReferencia(cobro.orderCode, cobro.id));
            let cambio = false;
            // Del más viejo al más nuevo: si hubo un rechazo y luego un pago aprobado, gana el aprobado.
            for (const pago of [...pagos].reverse().slice(-5)) {
                const resultado = await this.sincronizarPago(String(pago.id));
                if (resultado && resultado.estado !== cobro.estado) cambio = true;
            }
            return cambio;
        } catch (error) {
            Logger.warn(`No se pudo conciliar el cobro ${cobro.id} (${cobro.orderCode}): ${(error as Error).message}`, loggerCtx);
            return false;
        }
    }

    private ctxAdmin(): Promise<RequestContext> {
        return this.requestContextService.create({ apiType: 'admin' });
    }
}
