import { normalizeSearchText } from './search-text';

/**
 * Una búsqueda de ejemplo con lo que debe pasar al ejecutarla. Los textos esperados se comparan sin
 * acentos ni mayúsculas, como "parte del nombre del producto" (p. ej. "skittles").
 */
export interface ConsultaDeOro {
    /** Qué se comprueba, en una frase. */
    label: string;
    /** Lo que escribe el cliente. */
    q: string;
    /** Idioma de la tienda (por defecto `es`). */
    lang?: 'es' | 'en' | 'de';
    /** Cuántos productos debe devolver: un número exacto o un rango. */
    total?: number | { min?: number; max?: number };
    /** El primer resultado debe contener este texto. */
    first?: string;
    /** Los primeros N resultados (N = largo de la lista) deben ser estos, en cualquier orden. */
    topSet?: string[];
    /** Deben aparecer entre los resultados. */
    include?: string[];
    /** No deben aparecer. */
    exclude?: string[];
    /**
     * Límite conocido: motivo por el que hoy NO cumple. No cuenta como falla; en cuanto empiece a
     * cumplir, el reporte avisa para que se quite esta marca (así la lista no se queda desactualizada).
     */
    pendiente?: string;
}

export type EstadoDeConsulta = 'ok' | 'falla' | 'pendiente' | 'resuelta';

export interface ResultadoDeBusqueda {
    /** Total que reporta la API (no solo los de la primera página). */
    total: number;
    /** Nombres de los productos devueltos, en orden. */
    nombres: string[];
}

/** Devuelve lo que no se cumplió (lista vacía = la consulta pasa). */
export function evaluarConsulta(consulta: ConsultaDeOro, resultado: ResultadoDeBusqueda): string[] {
    const fallas: string[] = [];
    const nombres = resultado.nombres.map(normalizeSearchText);
    const contiene = (nombre: string, texto: string) => nombre.includes(normalizeSearchText(texto));
    const listar = (lista: string[]) => (lista.length ? lista.map(n => `"${n}"`).join(', ') : '(nada)');

    const { total } = consulta;
    if (typeof total === 'number' && resultado.total !== total) {
        fallas.push(`esperaba ${total} resultados y obtuvo ${resultado.total}`);
    } else if (typeof total === 'object') {
        if (total.min !== undefined && resultado.total < total.min) {
            fallas.push(`esperaba al menos ${total.min} resultados y obtuvo ${resultado.total}`);
        }
        if (total.max !== undefined && resultado.total > total.max) {
            fallas.push(`esperaba como máximo ${total.max} resultados y obtuvo ${resultado.total}`);
        }
    }

    if (consulta.first !== undefined && !(nombres[0] && contiene(nombres[0], consulta.first))) {
        fallas.push(`el primero debía contener "${consulta.first}" y fue ${listar(resultado.nombres.slice(0, 1))}`);
    }

    if (consulta.topSet) {
        const top = nombres.slice(0, consulta.topSet.length);
        const usados = new Set<number>();
        const completo = consulta.topSet.every(esperado => {
            const posicion = top.findIndex((nombre, i) => !usados.has(i) && contiene(nombre, esperado));
            if (posicion >= 0) usados.add(posicion);
            return posicion >= 0;
        });
        if (!completo) {
            fallas.push(
                `los primeros ${consulta.topSet.length} debían ser ${listar(consulta.topSet)} y fueron ${listar(resultado.nombres.slice(0, consulta.topSet.length))}`,
            );
        }
    }

    for (const esperado of consulta.include ?? []) {
        if (!nombres.some(nombre => contiene(nombre, esperado))) {
            fallas.push(`faltó "${esperado}" entre los resultados`);
        }
    }
    for (const prohibido of consulta.exclude ?? []) {
        if (nombres.some(nombre => contiene(nombre, prohibido))) {
            fallas.push(`no debía aparecer "${prohibido}"`);
        }
    }
    return fallas;
}

/**
 * `falla` y `resuelta` son las que piden atención: una consulta normal que dejó de cumplir, y un
 * límite conocido (`pendiente`) que ya cumple y hay que quitarle la marca.
 */
export function estadoDeConsulta(
    consulta: ConsultaDeOro,
    resultado: ResultadoDeBusqueda,
): { estado: EstadoDeConsulta; fallas: string[] } {
    const fallas = evaluarConsulta(consulta, resultado);
    if (consulta.pendiente === undefined) {
        return { estado: fallas.length === 0 ? 'ok' : 'falla', fallas };
    }
    return { estado: fallas.length === 0 ? 'resuelta' : 'pendiente', fallas };
}
