import { createHmac, timingSafeEqual } from 'node:crypto';

export interface DatosFirma {
    /** Cabecera `x-signature` completa: `ts=1704908010,v1=618c85…`. */
    firma: string | undefined;
    /** Cabecera `x-request-id`. */
    requestId: string | undefined;
    /** `data.id` de la notificación (el id del pago). */
    dataId: string | undefined;
    /** Clave secreta del webhook (panel de Mercado Pago → Webhooks). */
    secreto: string;
}

/**
 * Verifica la firma con la que Mercado Pago autentica cada notificación: HMAC-SHA256, con la clave secreta
 * del webhook, del texto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. El id va en minúsculas.
 *
 * Una notificación sin firma válida se descarta; aun con firma válida el pago se vuelve a consultar a la
 * API de Mercado Pago antes de creerle, la firma solo evita trabajo (y ruido) de quien no es Mercado Pago.
 */
export function firmaValida({ firma, requestId, dataId, secreto }: DatosFirma): boolean {
    if (!firma || !requestId || !dataId || !secreto) {
        return false;
    }
    let ts: string | undefined;
    let v1: string | undefined;
    for (const parte of firma.split(',')) {
        const igual = parte.indexOf('=');
        if (igual < 0) continue;
        const clave = parte.slice(0, igual).trim();
        const valor = parte.slice(igual + 1).trim();
        if (clave === 'ts') ts = valor;
        else if (clave === 'v1') v1 = valor;
    }
    if (!ts || !v1) {
        return false;
    }
    const manifiesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const esperada = createHmac('sha256', secreto).update(manifiesto).digest('hex');
    const recibida = Buffer.from(v1, 'utf8');
    const calculada = Buffer.from(esperada, 'utf8');
    return recibida.length === calculada.length && timingSafeEqual(recibida, calculada);
}
