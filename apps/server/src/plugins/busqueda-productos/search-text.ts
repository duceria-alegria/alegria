/**
 * Texto de búsqueda: normalización, sinónimos y tokenización de la consulta. Es código puro (sin
 * Vendure ni base de datos) para poder probarlo aislado. La MISMA normalización se usa al indexar
 * y al consultar; si cambia, sube `SEARCH_TEXT_VERSION` para que el servidor reconstruya el índice.
 */

const DIACRITICS = /[̀-ͯ]/g;
const NON_WORD = /[^\p{L}\p{N}\s]+/gu;

/** Minúsculas, sin acentos ni ñ ("Piña" → "pina") y sin signos ("24/10" → "24 10"). */
export function normalizeSearchText(value: unknown): string {
    const text = typeof value === 'string' ? value : value == null ? '' : String(value);
    return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase().replace(NON_WORD, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Versión de las reglas que producen el texto indexado (`normalizeSearchText`, `phoneticKey`,
 * `SYNONYM_GROUPS` y lo que entra al documento). SÚBELA cada vez que cambies alguna: al arrancar, el
 * servidor reconstruye solo los documentos guardados con otra versión (no hace falta correr nada a
 * mano, tampoco en producción).
 */
export const SEARCH_TEXT_VERSION = 1;

/**
 * Clave fonética en español: colapsa las letras que suenan igual para que "lukas" coincida con
 * "lucas" ("zumba"/"sumba", "vero"/"bero", "poyo"/"pollo", "hola"/"ola"...) y con cómo lo dice la
 * gente ("escuincles" ≈ "skwinkles"). Se aplica UNA vez a texto ya normalizado, a los dos lados
 * (documento y consulta); no es idempotente a propósito ("guerra" → "gerra" suena distinto de
 * "gerra" → "jerra"). Es una aproximación latinoamericana (seseo y yeísmo): no necesita ser
 * lingüísticamente perfecta, solo igual en ambos lados.
 */
export function phoneticKey(normalizedText: string): string {
    return normalizedText
        // "e" protética: se dice "escuincles"/"estrella" pero la marca es "skwinkles" ("strella").
        .replace(/(^| )e(?=s[bcdfghjklmnpqrstvwxz])/g, '$1')
        .replace(/ch/g, 'H') // dígrafo: que la "c" no se vuelva "k" ni la "h" se pierda
        .replace(/gu([ei])/g, 'G$1') // "gue"/"gui" suenan /ge/ /gi/ (g dura)
        .replace(/qu([ei])/g, 'k$1')
        .replace(/q/g, 'k')
        .replace(/c([ei])/g, 's$1')
        .replace(/c/g, 'k')
        .replace(/g([ei])/g, 'j$1') // "ge"/"gi" suenan /je/ /ji/
        .replace(/z/g, 's')
        .replace(/v/g, 'b')
        .replace(/w/g, 'u') // "skwinkles" se pronuncia "skuinkles"
        .replace(/ku([ei])/g, 'k$1') // "kui"/"kue" suenan /ki/ /ke/: "skwinkles" ≈ "squinkles" ("cuidado" ≈ "quidado")
        .replace(/ll|y/g, 'i')
        .replace(/h/g, '') // h muda (la del dígrafo ya está protegida como "H")
        .replace(/G/g, 'g')
        .replace(/H/g, 'ch');
}

/**
 * Grupos de sinónimos. Si el documento de un producto contiene (como palabra completa) cualquier
 * término del grupo, se le agregan todos: así "gomitas" encuentra "PICA GOMA" sin lógica extra en
 * la consulta. Los términos van normalizados (sin acentos).
 *
 * OJO: es una lista inicial con vocabulario genérico de dulcería, NO validada con el dueño. Edítala
 * con las palabras que sus clientes realmente usan y reindexa.
 */
export const SYNONYM_GROUPS: ReadonlyArray<readonly string[]> = [
    ['goma', 'gomas', 'gomita', 'gomitas', 'gummy', 'gummies'],
    ['paleta', 'paletas', 'chupa', 'chupas'],
    ['pica', 'picante', 'picoso', 'enchilado', 'enchilada'],
    ['tamarindo', 'tamarind'],
    ['cacahuate', 'cacahuates', 'mani'],
    ['chocolate', 'chocolates', 'choco'],
];

/**
 * Palabras que casi todos los nombres comparten ("TAM LUCAS … 24/10 PZS") o que no aportan. Se
 * ignoran al exigir coincidencias de la consulta, salvo que la consulta sea solo de estas palabras.
 */
const QUERY_STOPWORDS = new Set([
    'tam', 'pzs', 'pz', 'pza', 'pzas',
    'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'con', 'sin', 'para', 'por', 'en', 'y', 'a',
]);

const MAX_QUERY_TOKENS = 8;
const MAX_TOKEN_LENGTH = 40;
const MIN_FUZZY_LENGTH = 4;
const MIN_PHONETIC_LENGTH = 3;
const MAX_DESCRIPTION_LENGTH = 600;

export interface SearchToken {
    /** Palabra normalizada tal como la escribió el cliente. */
    text: string;
    /** Formas que cuentan como coincidencia: la palabra y su singular ("gomitas" → "gomita"). */
    variants: string[];
    /** Si se tolera un error de dedo (pg_trgm). Solo palabras de 4+ letras, nunca números. */
    fuzzy: boolean;
    /**
     * Claves fonéticas de `variants` (sin repetir), para coincidir con lo que suena igual aunque se
     * escriba distinto ("lukas" ≈ "lucas"). Vacío si es muy corta (< 3) o no tiene letras.
     */
    phonetic: string[];
}

export interface ParsedSearchQuery {
    /** Consulta completa normalizada, para premiar nombres que la contienen tal cual. */
    phrase: string;
    /** Todas deben coincidir (AND). */
    tokens: SearchToken[];
    /** Si puede ser un SKU: lleva algún dígito y 3+ caracteres. */
    skuLike: boolean;
}

function variantsOf(token: string): string[] {
    const variants = [token];
    if (token.length >= 4 && token.endsWith('s') && !token.endsWith('ss')) {
        variants.push(token.slice(0, -1));
        if (token.length >= 5 && token.endsWith('es')) {
            variants.push(token.slice(0, -2));
        }
    }
    return variants;
}

/** Devuelve null si no queda nada que buscar (vacío o solo signos): se lista todo el catálogo. */
export function parseSearchQuery(term: string | null | undefined): ParsedSearchQuery | null {
    const phrase = normalizeSearchText(term);
    if (!phrase) {
        return null;
    }
    const words = phrase.split(' ').map(word => word.slice(0, MAX_TOKEN_LENGTH));
    const meaningful = words.filter(word => !QUERY_STOPWORDS.has(word));
    const tokens = (meaningful.length > 0 ? meaningful : words)
        .filter((word, index, all) => all.indexOf(word) === index)
        .slice(0, MAX_QUERY_TOKENS)
        .map(text => {
            const variants = variantsOf(text);
            const phonetic =
                text.length >= MIN_PHONETIC_LENGTH && /\p{L}/u.test(text)
                    ? // Las reglas pueden acortar la clave ("cue" → "ke"): una clave tan corta coincidiría con todo.
                      [...new Set(variants.map(phoneticKey))].filter(key => key.length >= MIN_PHONETIC_LENGTH)
                    : [];
            return { text, variants, fuzzy: text.length >= MIN_FUZZY_LENGTH && !/^\d+$/.test(text), phonetic };
        });
    return { phrase, tokens, skuLike: phrase.length >= 3 && /\d/.test(phrase) };
}

/** Sinónimos que corresponden al texto normalizado dado (palabras completas). */
export function resolveSynonyms(normalizedText: string): string[] {
    const padded = ` ${normalizedText} `;
    const found = new Set<string>();
    for (const group of SYNONYM_GROUPS) {
        if (group.some(term => padded.includes(` ${term} `))) {
            group.forEach(term => found.add(term));
        }
    }
    return [...found];
}

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .slice(0, MAX_DESCRIPTION_LENGTH);
}

export interface SearchDocumentSource {
    name: string;
    description?: string | null;
    facetValueNames: string[];
    collectionNames: string[];
    skus: string[];
}

export interface SearchDocument {
    /** Solo el nombre del producto: la coincidencia aquí pesa más que en el resto del documento. */
    nameNormalized: string;
    /** SKUs normalizados separados por "|" (no entran al documento: ver `skusNormalized` en el SQL). */
    skusNormalized: string;
    /** Nombre, facets, colecciones, descripción y sinónimos. */
    documentNormalized: string;
    /** `documentNormalized` con la clave fonética aplicada (ver `phoneticKey`). */
    documentPhonetic: string;
}

export function buildSearchDocument(source: SearchDocumentSource): SearchDocument {
    const nameNormalized = normalizeSearchText(source.name);
    const facets = source.facetValueNames.map(normalizeSearchText).filter(Boolean);
    const collections = source.collectionNames.map(normalizeSearchText).filter(Boolean);
    const description = normalizeSearchText(stripHtml(source.description ?? ''));
    const synonyms = resolveSynonyms([nameNormalized, ...facets].join(' '));
    const documentNormalized = [nameNormalized, ...facets, ...collections, description, ...synonyms]
        .filter(Boolean)
        .join(' ');
    const skusNormalized = [...new Set(source.skus.map(normalizeSearchText).filter(Boolean))].join('|');
    return { nameNormalized, skusNormalized, documentNormalized, documentPhonetic: phoneticKey(documentNormalized) };
}
