import type { ParsedSearchQuery } from './search-text';

/**
 * SQL de la búsqueda sobre `product_search_document` (alias `doc`). Todos los valores del cliente
 * viajan como parámetros; solo palabras normalizadas (letras, dígitos y espacios) llegan a los LIKE.
 */
const DOC = '"doc"."documentNormalized"';
const NAME = '"doc"."nameNormalized"';
const PHON = '"doc"."documentPhonetic"';
const SKUS = '"doc"."skusNormalized"';

/** Parecido mínimo (word_similarity de pg_trgm, 0–1) para tolerar un error de dedo. */
export const FUZZY_THRESHOLD = 0.6;

export interface SearchSql {
    /** Condición completa: todas las palabras deben coincidir (o el término ser un SKU). */
    where: string;
    /** Puntaje por documento (mayor = más relevante). */
    score: string;
    params: Record<string, string | number>;
}

const anyLike = (expr: string, names: string[]) => names.map(name => `${expr} LIKE :${name}`).join(' OR ');

export function buildSearchSql(query: ParsedSearchQuery): SearchSql {
    const params: Record<string, string | number> = { bp_fz: FUZZY_THRESHOLD };
    const matches: string[] = [];
    const scores: string[] = [];

    query.tokens.forEach((token, i) => {
        const substring: string[] = [];
        const wordStart: string[] = [];
        token.variants.forEach((variant, j) => {
            params[`bp_s${i}_${j}`] = `%${variant}%`;
            params[`bp_w${i}_${j}`] = `% ${variant}%`;
            substring.push(`bp_s${i}_${j}`);
            wordStart.push(`bp_w${i}_${j}`);
        });
        // Lo que suena igual aunque se escriba distinto ("lukas" ≈ "lucas"): se compara la clave
        // fonética de la palabra con la del documento. Solo suma coincidencias, nunca quita.
        const phoneticSub: string[] = [];
        const phoneticWord: string[] = [];
        token.phonetic.forEach((key, j) => {
            params[`bp_h${i}_${j}`] = `%${key}%`;
            params[`bp_hw${i}_${j}`] = `% ${key}%`;
            phoneticSub.push(`bp_h${i}_${j}`);
            phoneticWord.push(`bp_hw${i}_${j}`);
        });
        // Una letra suelta solo cuenta como inicio de palabra; con 2+ basta con que aparezca.
        const allowSubstring = token.text.length >= 2;
        const alternatives = [allowSubstring ? anyLike(DOC, substring) : anyLike(`(' ' || ${DOC})`, wordStart)];
        if (phoneticSub.length > 0) {
            alternatives.push(anyLike(PHON, phoneticSub));
        }
        const fallbackScore = token.fuzzy ? `word_similarity(:bp_f${i}, ${DOC}) * 0.9` : '0';
        if (token.fuzzy) {
            params[`bp_f${i}`] = token.text;
            alternatives.push(`(:bp_f${i} <% ${DOC} AND word_similarity(:bp_f${i}, ${DOC}) >= :bp_fz)`);
        }
        matches.push(`(${alternatives.join(' OR ')})`);
        // Escritura exacta pesa más que sonido; el sonido más que un error de dedo.
        scores.push(`CASE
            WHEN ${anyLike(`(' ' || ${NAME})`, wordStart)} THEN 3
            WHEN ${anyLike(`(' ' || ${DOC})`, wordStart)} THEN 2
            ${phoneticWord.length > 0 ? `WHEN ${anyLike(`(' ' || ${PHON})`, phoneticWord)} THEN 1.8` : ''}
            ${allowSubstring ? `WHEN ${anyLike(DOC, substring)} THEN 1` : ''}
            ${phoneticSub.length > 0 ? `WHEN ${anyLike(PHON, phoneticSub)} THEN 0.95` : ''}
            ELSE ${fallbackScore}
        END`);
    });

    // Bono por la frase completa: nombre exacto > empieza con la frase > la contiene como palabras
    // > la contiene en parte > lo mismo dentro del documento.
    params.bp_p = query.phrase;
    params.bp_p0 = `${query.phrase}%`;
    params.bp_pw = `% ${query.phrase} %`;
    params.bp_ps = `%${query.phrase}%`;
    scores.push(`CASE
        WHEN ${NAME} = :bp_p THEN 12
        WHEN ${NAME} LIKE :bp_p0 THEN 8
        WHEN (' ' || ${NAME} || ' ') LIKE :bp_pw THEN 6
        WHEN ${NAME} LIKE :bp_ps THEN 4
        WHEN (' ' || ${DOC} || ' ') LIKE :bp_pw THEN 3
        WHEN ${DOC} LIKE :bp_ps THEN 2
        ELSE 0
    END`);

    let where = `(${matches.join(' AND ')})`;
    if (query.skuLike) {
        params.bp_sku_w = `%|${query.phrase}|%`;
        params.bp_sku_s = `%${query.phrase}%`;
        where = `(${where} OR ${SKUS} LIKE :bp_sku_s)`;
        scores.push(`CASE
            WHEN ('|' || ${SKUS} || '|') LIKE :bp_sku_w THEN 10
            WHEN ${SKUS} LIKE :bp_sku_s THEN 5
            ELSE 0
        END`);
    }

    return { where, score: `(${scores.join(' + ')})`, params };
}
