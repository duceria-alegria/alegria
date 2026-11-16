import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import {
    EventBus,
    Order,
    OrderEvent,
    OrderStateTransitionEvent,
    PaymentStateTransitionEvent,
    RefundStateTransitionEvent,
    TransactionalConnection,
} from '@vendure/core';

/** Lo mínimo de `express.Request` / `express.Response` que se usa aquí (express no es dependencia directa). */
export interface Peticion {
    on(evento: 'close', escucha: () => void): unknown;
}
export interface Respuesta {
    status(codigo: number): unknown;
    setHeader(nombre: string, valor: string): unknown;
    flushHeaders?(): void;
    write(texto: string): boolean;
    end(): void;
}

export interface EventoPedido {
    orderId: string;
    code: string;
    state: string;
    /** Cliente dueño del pedido (solo se usa para filtrar; nunca se envía). */
    customerId?: string;
}

interface Conexion {
    res: Respuesta;
    recibir(evento: EventoPedido): void;
    cerrar(): void;
}

/** Mientras el pedido es un carrito nadie lo ve en una lista, y cada producto agregado dispararía un evento. */
const ESTADOS_DE_CARRITO = ['AddingItems', 'ArrangingPayment'];

/** Se juntan los eventos que llegan casi a la vez (un cambio de estado suele publicar varios) en un solo aviso. */
const JUNTAR_EVENTOS_MS = 50;
/** Los proxies (Cloudflare, nginx) cierran las conexiones sin tráfico; un comentario SSE las mantiene vivas. */
const LATIDO_MS = 25_000;
/** Cuánto espera el navegador antes de reconectar si se cae la conexión. */
const REINTENTO_MS = 3_000;

/**
 * Avisa en el momento en que cambia un pedido (estado, pago, reembolso, surtidor...). Se suscribe al
 * `EventBus` de Vendure y reparte cada cambio a las conexiones SSE abiertas. Solo avisa "el pedido X
 * cambió": quien lo recibe vuelve a pedir los datos con su propia sesión, así que aquí no sale información
 * del pedido más allá del código y el estado.
 *
 * Funciona en memoria dentro del proceso del servidor: todos los cambios de pedidos ocurren ahí (el worker
 * no los hace). Si algún día hay varias réplicas del servidor, haría falta un canal compartido (Postgres
 * LISTEN/NOTIFY o Redis) para que un cambio hecho en una réplica llegue a las conexiones de las otras.
 */
@Injectable()
export class PedidosEnVivoService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly conexiones = new Set<Conexion>();
    private readonly suscripciones: Array<{ unsubscribe(): void }> = [];

    constructor(
        private eventBus: EventBus,
        private connection: TransactionalConnection,
    ) {}

    onApplicationBootstrap() {
        this.suscripciones.push(
            this.eventBus
                .ofType(OrderStateTransitionEvent)
                .subscribe(evento => this.publicar(evento.order, evento.toState)),
            this.eventBus.ofType(OrderEvent).subscribe(evento => this.publicar(evento.order)),
            this.eventBus.ofType(PaymentStateTransitionEvent).subscribe(evento => this.publicar(evento.order)),
            this.eventBus.ofType(RefundStateTransitionEvent).subscribe(evento => this.publicar(evento.order)),
        );
    }

    /** Al apagar, se cierran las conexiones: si no, el servidor HTTP espera para siempre a que terminen. */
    onModuleDestroy() {
        this.suscripciones.forEach(suscripcion => suscripcion.unsubscribe());
        [...this.conexiones].forEach(conexion => conexion.cerrar());
    }

    /**
     * Abre un flujo SSE en `res`. Solo salen los eventos que cumplan `aceptar`, ya convertidos con `formato`.
     * La conexión se cierra sola cuando el cliente se va.
     */
    abrir(
        req: Peticion,
        res: Respuesta,
        aceptar: (evento: EventoPedido) => boolean,
        formato: (evento: EventoPedido) => object,
    ) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        // nginx no debe guardar la respuesta en un búfer: el aviso tiene que salir al instante.
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();
        res.write(`retry: ${REINTENTO_MS}\n\n: conectado\n\n`);

        const pendientes = new Map<string, EventoPedido>();
        let temporizador: NodeJS.Timeout | undefined;
        const enviarPendientes = () => {
            temporizador = undefined;
            for (const evento of pendientes.values()) {
                res.write(`event: pedido\ndata: ${JSON.stringify(formato(evento))}\n\n`);
            }
            pendientes.clear();
        };
        const latido = setInterval(() => res.write(': latido\n\n'), LATIDO_MS);

        const conexion: Conexion = {
            res,
            recibir: evento => {
                if (!aceptar(evento)) {
                    return;
                }
                pendientes.set(evento.orderId, evento);
                temporizador ??= setTimeout(enviarPendientes, JUNTAR_EVENTOS_MS);
            },
            cerrar: () => {
                clearInterval(latido);
                clearTimeout(temporizador);
                this.conexiones.delete(conexion);
                res.end();
            },
        };
        this.conexiones.add(conexion);
        req.on('close', conexion.cerrar);
    }

    private async publicar(order: Order, estado = order.state) {
        if (this.conexiones.size === 0 || ESTADOS_DE_CARRITO.includes(estado)) {
            return;
        }
        const evento: EventoPedido = {
            orderId: String(order.id),
            code: order.code,
            state: estado,
            customerId: await this.idDelCliente(order),
        };
        this.conexiones.forEach(conexion => conexion.recibir(evento));
    }

    /** Según el evento, el pedido viene con o sin el cliente cargado; si no, se consulta. */
    private async idDelCliente(order: Order): Promise<string | undefined> {
        const conocido = order.customerId ?? order.customer?.id;
        if (conocido != null) {
            return String(conocido);
        }
        const fila = await this.connection.rawConnection
            .getRepository(Order)
            .createQueryBuilder('pedido')
            .select('pedido.customerId', 'customerId')
            .where('pedido.id = :id', { id: order.id })
            .getRawOne<{ customerId: string | number | null }>();
        return fila?.customerId != null ? String(fila.customerId) : undefined;
    }
}
