import { timingSafeEqual } from 'node:crypto';
import { normalizeSearchText } from './search-text';

/**
 * Reglas de lo que se registra de una búsqueda (código puro, para poder probarlo sin base de datos).
 */

const MAX_TERM_LENGTH = 100;
const VISITOR_ID = /^[A-Za-z0-9-]{8,64}$/;

export interface BusquedaPreparada {
    /** Lo que escribió el cliente (espacios colapsados, máx. 100 caracteres). */
    term: string;
    /** Para agrupar: sin acentos ni mayúsculas ni signos. */
    termNormalized: string;
}

/**
 * Devuelve null si la búsqueda no debe guardarse: vacía, de una sola letra, o con pinta de dato
 * personal que alguien pegó en el buscador (correo, teléfono o tarjeta, URL).
 */
export function prepararBusqueda(term: unknown): BusquedaPreparada | null {
    if (typeof term !== 'string') {
        return null;
    }
    const clean = term.replace(/\s+/g, ' ').trim().slice(0, MAX_TERM_LENGTH);
    const termNormalized = normalizeSearchText(clean).slice(0, MAX_TERM_LENGTH);
    if (termNormalized.length < 2) {
        return null;
    }
    const digits = clean.replace(/[\s-]/g, '');
    if (clean.includes('@') || /\d{7,}/.test(digits) || /https?:\/\/|www\./i.test(clean)) {
        return null;
    }
    return { term: clean, termNormalized };
}

/** El id anónimo de visitante lo genera la tienda (UUID); aquí solo se acepta algo con esa forma. */
export function esVisitorIdValido(value: unknown): value is string {
    return typeof value === 'string' && VISITOR_ID.test(value);
}

/** Compara el secreto compartido sin filtrar por tiempo cuántos caracteres coincidieron. */
export function secretoCoincide(esperado: string | undefined, recibido: unknown): boolean {
    if (!esperado || typeof recibido !== 'string') {
        return false;
    }
    const a = Buffer.from(esperado);
    const b = Buffer.from(recibido);
    return a.length === b.length && timingSafeEqual(a, b);
}
