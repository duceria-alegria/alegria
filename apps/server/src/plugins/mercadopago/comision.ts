import { IVA, LISTA_SIN_COMISION, TarifaMercadoPago } from './constants';

export interface Comision {
    /** Lo que se suma al pedido, en centavos. 0 si no se cobra comisión. */
    comision: number;
    /** Lo que paga el cliente en Mercado Pago (pedido + comisión), en centavos. */
    total: number;
}

/** Quien paga con la lista pública (menudeo) no paga comisión: la absorbe la dulcería. */
export function cobraComision(lista: string): boolean {
    return lista !== LISTA_SIN_COMISION;
}

/**
 * Comisión que se carga a un pedido de mayoreo para que, después de lo que descuenta Mercado Pago
 * (porcentaje + cargo fijo, ambos con IVA), a la dulcería le llegue exactamente el monto del pedido.
 *
 * Si `C` es la comisión y `p`, `F` el porcentaje y el cargo fijo ya con IVA:
 *   (pedido + C) · (1 − p) − F = pedido   →   C = (pedido · p + F) / (1 − p)
 * Se redondea hacia arriba al centavo, así nunca llega de menos.
 *
 * Montos en centavos (como Vendure).
 */
export function calcularComision(montoPedido: number, lista: string, tarifa: TarifaMercadoPago): Comision {
    if (!Number.isInteger(montoPedido) || montoPedido <= 0) {
        throw new Error('El monto del pedido debe ser un entero positivo de centavos');
    }
    if (!cobraComision(lista)) {
        return { comision: 0, total: montoPedido };
    }
    const p = (tarifa.porcentaje / 100) * (1 + IVA);
    const fijoCentavos = Math.round(tarifa.fijo * (1 + IVA) * 100);
    // El redondeo a 6 decimales evita que el ruido de coma flotante (…0000001) cuente como un centavo más.
    const comision = Math.ceil(Number(((montoPedido * p + fijoCentavos) / (1 - p)).toFixed(6)));
    return { comision, total: montoPedido + comision };
}

/** Centavos de Vendure → pesos para la API de Mercado Pago (siempre con 2 decimales exactos). */
export function centavosAPesos(centavos: number): number {
    return Math.round(centavos) / 100;
}

/** Pesos de la API de Mercado Pago → centavos de Vendure. */
export function pesosACentavos(pesos: number): number {
    return Math.round(pesos * 100);
}
