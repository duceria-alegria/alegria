/** Código del método de pago "Mercado Pago" (también lo usan el seed y la tienda). */
export const CODIGO_MERCADOPAGO = 'mercado-pago';

/** Ruta (sin dominio) a la que Mercado Pago avisa de cada pago. En el panel: `PUBLIC_URL` + esta ruta. */
export const RUTA_WEBHOOK = 'pagos/mercadopago/webhook';

/** Idioma de la tienda al que regresa el cliente desde Mercado Pago. */
export const LOCALE_TIENDA = 'es';

/** Cuánto vive el enlace de pago de Mercado Pago. */
export const VIGENCIA_PREFERENCIA_HORAS = 6;

/** Lista de precios que es el precio público: ahí la dulcería absorbe la comisión. */
export const LISTA_SIN_COMISION = 'menudeo';

/**
 * Cómo paga el cliente. Con Checkout Pro el método se elige en la página de Mercado Pago, pero cada uno
 * cuesta distinto; por eso la tienda lo pregunta antes y la preferencia se limita a ese grupo de métodos
 * (así la comisión que se muestra es la que realmente cobra Mercado Pago).
 */
export type OpcionPago = 'tarjeta' | 'transferencia' | 'efectivo';

export interface TarifaMercadoPago {
    /** Porcentaje que cobra Mercado Pago, sin IVA (3.49 = 3.49 %). */
    porcentaje: number;
    /** Cargo fijo por venta en pesos, sin IVA. */
    fijo: number;
}

export interface OpcionPagoDef {
    id: OpcionPago;
    nombre: string;
    descripcion: string;
    /** Tipos de pago de Mercado Pago (`payment_type_id`) que se dejan en la preferencia. */
    tiposPermitidos: readonly string[];
    tarifa: TarifaMercadoPago;
    /** Máximo de mensualidades; 1 = sin meses sin intereses (tienen otra tarifa). */
    mensualidades?: number;
    /**
     * Efectivo (OXXO) tarda días en acreditarse y el pedido seguiría abierto en el carrito todo ese tiempo:
     * apagado hasta decidir cómo manejar los pagos que tardan.
     */
    habilitada: boolean;
}

export const IVA = 0.16;

/**
 * Tarifas de Mercado Pago México. OJO: son las de sus páginas públicas, que se contradicen entre sí
 * (sobre todo SPEI y efectivo) y dependen de cuándo se libera el dinero. VERIFICAR en el panel
 * (Tu negocio → Costos) y corregir aquí. El monto real que cobra Mercado Pago de cada venta queda en
 * `mercadopago_cobro.mpComision` para compararlo con lo que se cobró al cliente.
 */
export const OPCIONES_PAGO: readonly OpcionPagoDef[] = [
    {
        id: 'tarjeta',
        nombre: 'Tarjeta de crédito o débito',
        descripcion: 'Pagas en una sola exhibición, sin meses sin intereses.',
        tiposPermitidos: ['credit_card', 'debit_card', 'prepaid_card', 'account_money'],
        tarifa: { porcentaje: 3.49, fijo: 4 },
        mensualidades: 1,
        habilitada: true,
    },
    {
        id: 'transferencia',
        nombre: 'Transferencia SPEI',
        descripcion: 'Mercado Pago te da una CLABE para transferir; se confirma en minutos.',
        tiposPermitidos: ['bank_transfer'],
        tarifa: { porcentaje: 3.49, fijo: 4 },
        habilitada: true,
    },
    {
        id: 'efectivo',
        nombre: 'Efectivo (OXXO y otras tiendas)',
        descripcion: 'Pagas en tienda con una ficha; tarda hasta 3 días en confirmarse.',
        tiposPermitidos: ['ticket', 'atm'],
        tarifa: { porcentaje: 3.79, fijo: 4 },
        habilitada: false,
    },
];

export function opcionPago(id: string): OpcionPagoDef | undefined {
    return OPCIONES_PAGO.find(opcion => opcion.id === id && opcion.habilitada);
}

/** Estado propio de cada intento de cobro (`mercadopago_cobro.estado`). */
export const ESTADO_COBRO = {
    /** Se creó el enlace de pago; aún no hay pago de Mercado Pago. */
    creado: 'creado',
    /** Mercado Pago tiene un pago que aún no se acredita (SPEI, en proceso). */
    pendiente: 'pendiente',
    /** El pago está aprobado y ya quedó registrado en el pedido. */
    aplicado: 'aplicado',
    /** Mercado Pago rechazó o canceló el pago. */
    rechazado: 'rechazado',
    /**
     * Mercado Pago cobró pero el pedido no pudo registrarlo (cambió el pedido, pagó dos veces, devolución…):
     * alguien debe revisarlo a mano; la `nota` dice por qué.
     */
    revision: 'revision',
} as const;
export type EstadoCobro = (typeof ESTADO_COBRO)[keyof typeof ESTADO_COBRO];

export const MENSAJE_PAGO_NO_VERIFICADO = 'No se pudo verificar el pago con Mercado Pago';
