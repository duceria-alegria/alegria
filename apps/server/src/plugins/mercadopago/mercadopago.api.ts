import { randomUUID } from 'node:crypto';
import { idPagoValido } from './referencia';

const BASE = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15_000;

export interface PreferenciaItem {
    id: string;
    title: string;
    quantity: number;
    /** Pesos con 2 decimales. */
    unit_price: number;
    currency_id: 'MXN';
}

export interface PreferenciaInput {
    items: PreferenciaItem[];
    payer?: { email: string; name?: string; surname?: string };
    external_reference: string;
    notification_url?: string;
    back_urls: { success: string; failure: string; pending: string };
    auto_return?: 'approved';
    statement_descriptor?: string;
    payment_methods: {
        excluded_payment_types: { id: string }[];
        installments?: number;
        default_installments?: number;
    };
    expires: boolean;
    expiration_date_to?: string;
}

export interface Preferencia {
    id: string;
    init_point: string;
}

/** Lo que usamos de un pago de Mercado Pago (la API devuelve mucho más). */
export interface PagoMp {
    id: number;
    status: string;
    status_detail?: string;
    external_reference?: string | null;
    /** Pesos. */
    transaction_amount: number;
    currency_id: string;
    payment_type_id?: string;
    payment_method_id?: string;
    date_approved?: string | null;
    fee_details?: { type: string; amount: number; fee_payer?: string }[];
}

export class MercadoPagoError extends Error {
    constructor(
        message: string,
        readonly status?: number,
    ) {
        super(message);
    }
}

/**
 * Cliente mínimo de la API de Mercado Pago (con `fetch`, sin SDK). El token solo viaja en la cabecera
 * `Authorization` y nunca se incluye en los mensajes de error.
 */
export class MercadoPagoApi {
    constructor(private readonly accessToken: string) {}

    crearPreferencia(preferencia: PreferenciaInput): Promise<Preferencia> {
        return this.llamar('POST', '/checkout/preferences', preferencia);
    }

    obtenerPago(id: string): Promise<PagoMp> {
        if (!idPagoValido(id)) {
            throw new MercadoPagoError('Id de pago inválido');
        }
        return this.llamar('GET', `/v1/payments/${id}`);
    }

    /** Pagos que Mercado Pago tiene para una referencia, el más reciente primero. */
    async buscarPagos(externalReference: string): Promise<PagoMp[]> {
        const ruta = `/v1/payments/search?sort=date_created&criteria=desc&external_reference=${encodeURIComponent(externalReference)}`;
        const respuesta = await this.llamar<{ results?: PagoMp[] }>('GET', ruta);
        return respuesta.results ?? [];
    }

    private async llamar<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
        };
        if (metodo === 'POST') {
            headers['X-Idempotency-Key'] = randomUUID();
        }
        let respuesta: Response;
        try {
            respuesta = await fetch(`${BASE}${ruta}`, {
                method: metodo,
                headers,
                body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
        } catch (error) {
            throw new MercadoPagoError(`No se pudo contactar a Mercado Pago: ${(error as Error).message}`);
        }
        const texto = await respuesta.text();
        if (!respuesta.ok) {
            throw new MercadoPagoError(
                `Mercado Pago respondió ${respuesta.status} en ${metodo} ${ruta.split('?')[0]}: ${texto.slice(0, 500)}`,
                respuesta.status,
            );
        }
        try {
            return JSON.parse(texto) as T;
        } catch {
            throw new MercadoPagoError(`Mercado Pago devolvió una respuesta que no es JSON en ${ruta.split('?')[0]}`);
        }
    }
}
