import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConsultaDeOro, estadoDeConsulta, evaluarConsulta } from './evaluar-consulta';
import { esVisitorIdValido, prepararBusqueda, secretoCoincide } from './registro-busquedas';
import { buildSearchSql, FUZZY_THRESHOLD } from './search-sql';
import { buildSearchDocument, normalizeSearchText, parseSearchQuery, phoneticKey, resolveSynonyms, SEARCH_TEXT_VERSION, SYNONYM_GROUPS } from './search-text';

const parsed = (term: string) => {
    const query = parseSearchQuery(term);
    assert.ok(query, `"${term}" debería producir una consulta`);
    return query;
};

describe('normalizeSearchText', () => {
    it('quita acentos y ñ, y pasa a minúsculas', () => {
        assert.equal(normalizeSearchText('Piña'), 'pina');
        assert.equal(normalizeSearchText('ÁÉÍÓÚ Ü Ñ'), 'aeiou u n');
    });

    it('convierte signos en espacios y colapsa los repetidos', () => {
        assert.equal(normalizeSearchText('TAM LUCAS 24/10 PZS'), 'tam lucas 24 10 pzs');
        assert.equal(normalizeSearchText('  Hola,   mundo!!! '), 'hola mundo');
    });

    it('tolera valores que no son texto', () => {
        assert.equal(normalizeSearchText(null), '');
        assert.equal(normalizeSearchText(undefined), '');
        assert.equal(normalizeSearchText(42), '42');
        assert.equal(normalizeSearchText('🍬'), '');
    });
});

describe('parseSearchQuery', () => {
    it('devuelve null cuando no queda nada que buscar', () => {
        for (const term of ['', '   ', '!!!', '🍬', null, undefined]) {
            assert.equal(parseSearchQuery(term), null, `term=${String(term)}`);
        }
    });

    it('ignora las palabras de relleno, salvo que la consulta sea solo de ellas', () => {
        const withNoise = parsed('tam lucas');
        assert.deepEqual(withNoise.tokens.map(t => t.text), ['lucas']);
        assert.equal(withNoise.phrase, 'tam lucas');
        assert.deepEqual(parsed('tam pzs').tokens.map(t => t.text), ['tam', 'pzs']);
    });

    it('no repite palabras y limita su número y su largo', () => {
        assert.equal(parsed('lucas lucas LUCAS').tokens.length, 1);
        assert.equal(parsed('uno dos tres cuatro cinco seis siete ocho nueve diez').tokens.length, 8);
        assert.equal(parsed('a'.repeat(100)).tokens[0].text.length, 40);
    });

    it('acepta el singular de una palabra en plural', () => {
        assert.ok(parsed('gomitas').tokens[0].variants.includes('gomita'));
        assert.ok(parsed('dulces').tokens[0].variants.includes('dulce'));
        assert.deepEqual(parsed('mas').tokens[0].variants, ['mas']);
    });

    it('solo tolera errores de dedo en palabras de 4+ letras que no son números', () => {
        assert.equal(parsed('sk').tokens[0].fuzzy, false);
        assert.equal(parsed('skit').tokens[0].fuzzy, true);
        assert.equal(parsed('2024').tokens[0].fuzzy, false);
    });

    it('reconoce lo que puede ser un SKU: lleva un dígito y 3+ caracteres', () => {
        assert.equal(parsed('da-001').skuLike, true);
        assert.equal(parsed('001').skuLike, true);
        assert.equal(parsed('caja').skuLike, false);
        assert.equal(parsed('a1').skuLike, false);
    });
});

describe('resolveSynonyms', () => {
    it('agrega todo el grupo si el texto contiene un término como palabra completa', () => {
        const found = resolveSynonyms('tam vero pica goma 24 100 pzs');
        assert.ok(found.includes('gomita'));
        assert.ok(found.includes('picante'));
    });

    it('no dispara con coincidencias parciales ni sin coincidencia', () => {
        assert.deepEqual(resolveSynonyms('tam lucas panzon sandia'), []);
        assert.deepEqual(resolveSynonyms('manifiesto'), []);
    });

    it('los términos de los grupos ya están normalizados', () => {
        for (const term of SYNONYM_GROUPS.flat()) {
            assert.equal(term, normalizeSearchText(term), `"${term}" debe ir sin acentos ni mayúsculas`);
        }
    });
});

describe('buildSearchDocument', () => {
    const base = { facetValueNames: [], collectionNames: [], skus: [] };

    it('normaliza el nombre y agrega los sinónimos', () => {
        const doc = buildSearchDocument({ ...base, name: 'TAM VERO PICA GOMA 24/100 PZS' });
        assert.equal(doc.nameNormalized, 'tam vero pica goma 24 100 pzs');
        assert.ok(doc.documentNormalized.startsWith('tam vero pica goma 24 100 pzs'));
        assert.ok(doc.documentNormalized.includes('gomitas'));
    });

    it('limpia el HTML de la descripción y la recorta', () => {
        const doc = buildSearchDocument({ ...base, name: 'X', description: '<p>Con <b>chamoy</b>&nbsp;&amp; limón</p>' });
        assert.ok(doc.documentNormalized.includes('con chamoy limon'));
        const long = buildSearchDocument({ ...base, name: 'X', description: 'a '.repeat(5000) });
        assert.ok(long.documentNormalized.length < 700);
    });

    it('guarda los SKU aparte (sin repetirlos) para que "caja" no coincida con todo', () => {
        const doc = buildSearchDocument({ ...base, name: 'X', skus: ['DA-001', 'DA-001-CAJA', 'da-001'] });
        assert.equal(doc.skusNormalized, 'da 001|da 001 caja');
        assert.ok(!doc.documentNormalized.includes('caja'));
    });

    it('incluye facets y colecciones, y no deja espacios de sobra', () => {
        const doc = buildSearchDocument({ name: 'Mazapán', facetValueNames: ['De la Rosa'], collectionNames: ['Dulces Mexicanos'], skus: [], description: null });
        assert.equal(doc.documentNormalized, 'mazapan de la rosa dulces mexicanos');
    });
});

describe('buildSearchSql', () => {
    const placeholders = (sql: string) => [...sql.matchAll(/:(bp_\w+)/g)].map(match => match[1]);

    it('nunca mete el texto del cliente dentro del SQL, solo como parámetros', () => {
        const sql = buildSearchSql(parsed("o'brien; DROP TABLE product; --"));
        for (const text of [sql.where, sql.score]) {
            assert.ok(!/drop|brien|table/i.test(text), 'el SQL no debe contener el texto buscado');
        }
        assert.ok(Object.values(sql.params).some(value => String(value).includes('drop')));
    });

    it('define todos los parámetros que usa', () => {
        for (const term of ['skitles', 'lucas panzon', 'da-001', '24/10', 'a']) {
            const sql = buildSearchSql(parsed(term));
            for (const name of placeholders(`${sql.where} ${sql.score}`)) {
                assert.ok(name in sql.params, `"${term}": falta el parámetro ${name}`);
            }
        }
    });

    it('exige todas las palabras (AND)', () => {
        const sql = buildSearchSql(parsed('lucas panzon'));
        assert.match(sql.where, /\) AND \(/);
    });

    it('busca por SKU solo cuando el término puede serlo', () => {
        assert.ok(buildSearchSql(parsed('da-001')).where.includes('skusNormalized'));
        assert.ok(!buildSearchSql(parsed('caja')).where.includes('skusNormalized'));
    });

    it('una letra suelta solo cuenta como inicio de palabra', () => {
        const sql = buildSearchSql(parsed('a'));
        assert.ok(sql.where.includes(':bp_w0_0'));
        assert.ok(!sql.where.includes(':bp_s0_0'));
    });

    it('tolera errores de dedo solo en palabras largas, con el umbral configurado', () => {
        const typo = buildSearchSql(parsed('skitles'));
        assert.ok(typo.where.includes('<%'));
        assert.equal(typo.params.bp_fz, FUZZY_THRESHOLD);
        assert.ok(!buildSearchSql(parsed('24/10')).where.includes('<%'));
    });
});

describe('evaluarConsulta', () => {
    const resultado = { total: 3, nombres: ['TAM LUCAS PANZÓN SANDÍA 24/10 PZS', 'TAM LUCAS SKITTLES ORIGINAL 24/10 PZS', 'TAM VERO PICA GOMA 24/100 PZS'] };
    const consulta = (extra: Partial<ConsultaDeOro>): ConsultaDeOro => ({ label: 'x', q: 'x', ...extra });

    it('compara sin acentos ni mayúsculas', () => {
        assert.deepEqual(evaluarConsulta(consulta({ first: 'panzon sandia', include: ['pica goma'] }), resultado), []);
    });

    it('revisa el total, exacto o en rango', () => {
        assert.deepEqual(evaluarConsulta(consulta({ total: 3 }), resultado), []);
        assert.equal(evaluarConsulta(consulta({ total: 2 }), resultado).length, 1);
        assert.deepEqual(evaluarConsulta(consulta({ total: { min: 1, max: 3 } }), resultado), []);
        assert.equal(evaluarConsulta(consulta({ total: { min: 4 } }), resultado).length, 1);
        assert.equal(evaluarConsulta(consulta({ total: { max: 2 } }), resultado).length, 1);
    });

    it('detecta cuando el primer resultado no es el esperado, o no hay resultados', () => {
        assert.equal(evaluarConsulta(consulta({ first: 'skittles' }), resultado).length, 1);
        assert.equal(evaluarConsulta(consulta({ first: 'skittles' }), { total: 0, nombres: [] }).length, 1);
    });

    it('topSet acepta cualquier orden pero no que falte uno de los esperados', () => {
        assert.deepEqual(evaluarConsulta(consulta({ topSet: ['skittles', 'panzon'] }), resultado), []);
        assert.equal(evaluarConsulta(consulta({ topSet: ['panzon', 'pica goma'] }), resultado).length, 1);
        // Un mismo resultado no puede cubrir dos esperados.
        assert.equal(evaluarConsulta(consulta({ topSet: ['lucas', 'lucas', 'lucas'] }), resultado).length, 1);
    });

    it('revisa lo que debe y lo que no debe aparecer', () => {
        assert.equal(evaluarConsulta(consulta({ include: ['mazapan'] }), resultado).length, 1);
        assert.equal(evaluarConsulta(consulta({ exclude: ['pica goma'] }), resultado).length, 1);
        assert.deepEqual(evaluarConsulta(consulta({ exclude: ['mazapan'] }), resultado), []);
    });

    it('un límite conocido no cuenta como falla, pero avisa cuando ya se resolvió', () => {
        const falla = consulta({ total: 99, pendiente: 'motivo' });
        assert.equal(estadoDeConsulta(falla, resultado).estado, 'pendiente');
        assert.equal(estadoDeConsulta(consulta({ total: 3, pendiente: 'motivo' }), resultado).estado, 'resuelta');
        assert.equal(estadoDeConsulta(consulta({ total: 3 }), resultado).estado, 'ok');
        assert.equal(estadoDeConsulta(consulta({ total: 99 }), resultado).estado, 'falla');
    });
});

describe('phoneticKey', () => {
    const suenaIgual = (a: string, b: string) => assert.equal(phoneticKey(a), phoneticKey(b), `"${a}" debería sonar igual que "${b}"`);
    const suenaDistinto = (a: string, b: string) => assert.notEqual(phoneticKey(a), phoneticKey(b), `"${a}" no debería sonar igual que "${b}"`);

    it('junta lo que se confunde al escribir', () => {
        suenaIgual('lucas', 'lukas');
        suenaIgual('zumba', 'sumba');
        suenaIgual('cebra', 'zebra');
        suenaIgual('cebra', 'sebra');
        suenaIgual('queso', 'keso');
        suenaIgual('vero', 'bero');
        suenaIgual('pollo', 'poyo');
        suenaIgual('hola', 'ola');
        suenaIgual('patyleta', 'patileta');
        suenaIgual('gerra', 'jerra');
    });

    it('junta cómo lo dice la gente: "e" delante de sk/sc/st y "cu"/"qu" por "kw"', () => {
        for (const escrito of ['escuincles', 'esquincles', 'skwincles', 'squinkles', 'eskuinkles']) {
            suenaIgual('skwinkles', escrito);
        }
        suenaIgual('estrella', 'strella');
        suenaIgual('cuidado', 'quidado');
    });

    it('no junta lo que suena distinto', () => {
        suenaDistinto('guerra', 'gerra'); // /gerra/ vs /jerra/
        suenaDistinto('chamoy', 'camoy'); // "ch" no es "c" + "h"
        suenaDistinto('casa', 'cesa'); // /kasa/ vs /sesa/
        suenaDistinto('lucas', 'lucia');
        suenaDistinto('skwinkles', 'skittles');
        suenaDistinto('escuela', 'skwinkles');
        suenaDistinto('espejo', 'ejpejo'); // la "e" solo se pierde al inicio y antes de "s" + consonante
    });

    it('respeta números y espacios', () => {
        assert.equal(phoneticKey('tam vero 24 10 pzs'), 'tam bero 24 10 pss'); // "pzs" → "pss": igual en ambos lados
        assert.equal(phoneticKey(''), '');
    });

    it('se aplica a las palabras de la consulta y al documento', () => {
        assert.ok(parsed('lucas').tokens[0].phonetic.includes('lukas'));
        assert.deepEqual(parsed('sk').tokens[0].phonetic, []); // muy corta
        assert.deepEqual(parsed('2024').tokens[0].phonetic, []); // sin letras
        const doc = buildSearchDocument({ name: 'TAM LUCAS PANZÓN', facetValueNames: [], collectionNames: [], skus: [] });
        assert.equal(doc.documentPhonetic, phoneticKey(doc.documentNormalized));
        assert.ok(doc.documentPhonetic.includes('lukas'));
    });

    it('descarta las claves que las reglas dejan demasiado cortas para ser útiles', () => {
        assert.equal(phoneticKey('cue'), 'ke');
        assert.deepEqual(parsed('cue').tokens[0].phonetic, []);
    });

    it('la versión del texto indexado es un entero positivo (se sube al cambiar las reglas)', () => {
        assert.ok(Number.isInteger(SEARCH_TEXT_VERSION) && SEARCH_TEXT_VERSION > 0);
    });

    it('el SQL compara por sonido sin quitar las coincidencias por escritura', () => {
        const sql = buildSearchSql(parsed('lukas'));
        assert.ok(sql.where.includes('documentPhonetic'));
        assert.ok(sql.where.includes('"doc"."documentNormalized" LIKE :bp_s0_0'));
        assert.equal(sql.params.bp_h0_0, '%lukas%');
        assert.ok(!buildSearchSql(parsed('sk')).where.includes('documentPhonetic'));
    });
});

describe('prepararBusqueda (registro de búsquedas)', () => {
    it('guarda lo que escribió el cliente y su versión normalizada para agrupar', () => {
        assert.deepEqual(prepararBusqueda('  Piña   COLADA  '), { term: 'Piña COLADA', termNormalized: 'pina colada' });
    });

    it('descarta lo vacío, de una letra o que no es texto', () => {
        for (const term of ['', '   ', 'a', '!!', '🍬', null, undefined, 42]) {
            assert.equal(prepararBusqueda(term), null, `term=${String(term)}`);
        }
    });

    it('descarta lo que parece un dato personal pegado en el buscador', () => {
        for (const term of ['juan@correo.com', '55 1234 5678', '5512345678', '4111-1111-1111-1111', 'https://sitio.com/x', 'www.sitio.com']) {
            assert.equal(prepararBusqueda(term), null, `term=${term}`);
        }
    });

    it('acepta SKU, presentaciones y números cortos', () => {
        assert.ok(prepararBusqueda('DA-001'));
        assert.ok(prepararBusqueda('24/10'));
        assert.ok(prepararBusqueda('da 016'));
    });

    it('recorta lo larguísimo a 100 caracteres', () => {
        assert.equal(prepararBusqueda('a'.repeat(500))?.term.length, 100);
    });
});

describe('registro de búsquedas: visitante y secreto', () => {
    it('solo acepta ids de visitante con forma de UUID o similar', () => {
        assert.equal(esVisitorIdValido('3f2b8c1e-9a4d-4f6b-8e1a-0c5d7e9f1a2b'), true);
        for (const id of ['', 'corto', 'x y z w a b c d', "a'; DROP TABLE x; --", 'a'.repeat(65), null, 7]) {
            assert.equal(esVisitorIdValido(id), false, `id=${String(id)}`);
        }
    });

    it('el secreto debe coincidir exactamente; sin secreto configurado nadie pasa', () => {
        assert.equal(secretoCoincide('abc123', 'abc123'), true);
        assert.equal(secretoCoincide('abc123', 'abc124'), false);
        assert.equal(secretoCoincide('abc123', 'abc12'), false);
        assert.equal(secretoCoincide('abc123', undefined), false);
        assert.equal(secretoCoincide('abc123', ['abc123']), false);
        assert.equal(secretoCoincide(undefined, 'abc123'), false);
        assert.equal(secretoCoincide('', ''), false);
    });
});
