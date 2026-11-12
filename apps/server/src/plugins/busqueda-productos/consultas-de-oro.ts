import type { ConsultaDeOro } from './evaluar-consulta';

/**
 * Consultas de oro: búsquedas de ejemplo con el resultado que esperamos. Sirven para comprobar, de
 * una vez, que un cambio a la búsqueda (sinónimos, umbrales, reglas de puntaje) no rompió nada:
 *
 *   npm run search:golden            (desde apps/server, con el servidor corriendo)
 *
 * Los nombres esperados son los del catálogo de DESARROLLO (productos "TAM …" con SKU DA-001…016);
 * contra otro catálogo hay que ajustarlos. Cada consulta nueva que un cliente intente y no encuentre
 * lo que buscaba debe agregarse aquí, con lo que esperaba encontrar.
 */
const grupo = (nombre: string, consultas: ConsultaDeOro[]) => consultas.map(c => ({ ...c, grupo: nombre }));

export const CONSULTAS_DE_ORO: Array<ConsultaDeOro & { grupo: string }> = [
    ...grupo('Acentos y mayúsculas', [
        { label: 'sin acento encuentra la palabra con acento', q: 'pina', total: 1, first: 'rellenos piña' },
        { label: 'con acento', q: 'piña', total: 1, first: 'rellenos piña' },
        { label: 'en mayúsculas', q: 'PIÑA', total: 1, first: 'rellenos piña' },
        { label: 'espacios sobrantes', q: '   skittles   ', total: 1, first: 'skittles original' },
    ]),

    ...grupo('Errores de dedo', [
        { label: 'letra de menos (antes: 0 resultados)', q: 'skitles', total: 1, first: 'skittles original' },
        { label: 'letra cambiada', q: 'panzom', first: 'panzon sandia' },
        { label: 'letra de más', q: 'forritoos', first: 'zumba forritos' },
        { label: 'palabra larga con una letra faltante', q: 'skwinkls', include: ['skwinkles clasico chamoy'], exclude: ['skittles'] },
        { label: 'sin ruido: algo que no existe', q: 'xyzxyz', total: 0 },
    ]),

    ...grupo('Plurales y singulares', [
        { label: 'plural encuentra el singular escrito en el nombre', q: 'forrito', first: 'zumba forritos' },
        { label: 'escrito igual que el nombre', q: 'rellenos', total: 2, include: ['rellenos piña', 'rellenos sandia'] },
        // "Rellerindos" también aparece (comparte "relle": parecido 0.625 ≥ 0.6 y es casi seguro lo que
        // un cliente quiere ver), pero al final. Lo que se exige es que los exactos vayan primero.
        { label: 'singular encuentra el plural; lo parecido va después', q: 'relleno', topSet: ['rellenos piña', 'rellenos sandia'], include: ['rellerindos'], total: 3 },
    ]),

    ...grupo('Palabras a medias (búsqueda al teclear)', [
        { label: 'tres letras', q: 'skw', total: 6, exclude: ['skittles'] },
        { label: 'dos letras ya no devuelve todo el catálogo (antes: 16)', q: 'sk', total: { min: 1, max: 8 } },
        { label: 'inicio de palabra', q: 'pan', total: 1, first: 'panzon' },
        { label: 'mitad de palabra', q: 'chamo', total: 1, first: 'chamoy' },
        { label: 'marca a medias', q: 'luc', total: 8 },
        { label: 'nombre largo a medias', q: 'tambor', total: 1, first: 'tamborines' },
    ]),

    ...grupo('Sinónimos (lista inicial, sin validar con el dueño)', [
        { label: 'gomitas encuentra "goma"', q: 'gomitas', include: ['pica goma'] },
        { label: 'gomita (singular)', q: 'gomita', include: ['pica goma'] },
        { label: 'picante encuentra la línea "pica"', q: 'picante', total: 3, exclude: ['skittles'] },
        { label: 'nucs (mal escrito) encuentra Nugs antes que Nucita', q: 'nucs', first: 'nugs' },
        { label: 'nuks (mal escrito) encuentra Nugs', q: 'nuks', first: 'nugs' },
        { label: 'nux (mal escrito) encuentra Nugs', q: 'nux', first: 'nugs' },
    ]),

    ...grupo('Presentación (números)', [
        { label: 'presentación exacta primero', q: '24/10', topSet: ['panzon sandia', 'skittles original'] },
        { label: 'otra presentación', q: '24/12', total: 3, include: ['clasico mango', 'rellenos piña', 'rellenos sandia'] },
        { label: 'con espacios en vez de diagonal', q: '20 12', total: 2, include: ['clasico chamoy', 'salsagti'] },
        { label: 'palabra + presentación', q: 'chamoy 20', total: 1, first: 'clasico chamoy' },
    ]),

    ...grupo('SKU', [
        { label: 'SKU completo', q: 'da-001', total: 1, first: 'zumba forritos' },
        { label: 'SKU en minúsculas y sin guion', q: 'da 016', total: 1, first: 'panzon sandia' },
        { label: 'SKU de la caja encuentra el producto', q: 'DA-016-CAJA', total: 1, first: 'panzon sandia' },
        { label: 'solo el número', q: '001', total: 1, first: 'zumba forritos' },
        { label: 'la palabra "caja" no coincide con todos los SKU -CAJA', q: 'caja', total: 0 },
    ]),

    ...grupo('Varias palabras', [
        { label: 'marca + producto', q: 'lucas panzon', total: 1, first: 'panzon sandia' },
        { label: 'orden distinto al del nombre', q: 'chamoy skwinkles', total: 1, first: 'clasico chamoy' },
        { label: 'palabras de relleno ("tam") no cuentan', q: 'tam lucas', total: 8 },
        { label: 'dos palabras que comparten varios productos', q: 'sandia lucas', total: 4 },
        { label: 'línea completa', q: 'vero pica', total: 3, exclude: ['rellerindos'] },
        { label: 'plural de la marca + sabor', q: 'skwinkles sandia', include: ['rellenos sandia', 'salsagti sandia'], exclude: ['skittles'] },
    ]),

    ...grupo('Nombres propios del catálogo', [
        { label: 'producto de una palabra', q: 'serpentina', total: 1, first: 'patyleta serpentina' },
        { label: 'parte del nombre', q: 'salsa', total: 1, first: 'salsagti' },
        { label: 'sabor', q: 'mango', total: 1, first: 'clasico mango' },
        { label: 'marca poco común', q: 'pigui', total: 1, first: 'cachepigui' },
    ]),

    ...grupo('Sin término útil (se lista el catálogo)', [
        { label: 'solo signos', q: '!!!', total: 16 },
        { label: 'solo un emoji', q: '🍬', total: 16 },
    ]),

    ...grupo('Otros idiomas de la tienda', [
        { label: 'inglés: sin acento', q: 'pina', lang: 'en', total: 1, first: 'rellenos piña' },
        { label: 'inglés: errores de dedo', q: 'skitles', lang: 'en', total: 1, first: 'skittles original' },
        { label: 'alemán: sinónimos', q: 'gomitas', lang: 'de', include: ['pica goma'] },
    ]),

    // Antes de la clave fonética: "lukas" → 0 resultados (parecido 0.33) y "patileta" → 0 (0.5).
    ...grupo('Suena igual, se escribe distinto', [
        { label: 'k en vez de c', q: 'lukas', total: 8 },
        { label: 'i en vez de y', q: 'patileta', total: 1, first: 'patyleta serpentina' },
        { label: 's en vez de z', q: 'sumba', total: 1, first: 'zumba forritos' },
        { label: 'b en vez de v y k en vez de c', q: 'bero pika', total: 3, exclude: ['skittles'] },
        { label: 'k en vez de c al inicio', q: 'kachepigui', total: 1, first: 'cachepigui' },
        { label: 'varias palabras con confusiones', q: 'lukas panson', total: 1, first: 'panzon sandia' },
        { label: 'gui se escribe "gi" al oírlo', q: 'pigi', total: 1, first: 'pigui' },
        { label: 'como lo dice la gente: "e" delante y "cu" por "kw"', q: 'escuincles', total: 6, exclude: ['skittles'] },
        { label: 'otra forma de escribirlo', q: 'esquincles', total: 6, exclude: ['skittles'] },
        { label: 'sin la "e" y con "qu"', q: 'squinkles', total: 6, exclude: ['skittles'] },
        { label: 'precisión: una palabra parecida que no es la marca', q: 'escuela', total: 0 },
        { label: 'precisión: lo que suena distinto NO coincide', q: 'lucia', total: 0 },
        { label: 'precisión: la h muda no hace coincidir palabras ajenas', q: 'hola', total: 0 },
    ]),

    ...grupo('Límites conocidos (hoy no se resuelven)', [
        {
            label: 'dos errores en la misma palabra',
            q: 'skitels',
            first: 'skittles original',
            pendiente: 'Falta una "t" y además van invertidas dos letras: el parecido por trigramas queda en 0.5 (< 0.6). Con uno solo ("skitles") sí lo encuentra.',
        },
    ]),

    // ── Búsquedas reales de clientes ────────────────────────────────────────────────────────────
    // PENDIENTE: agrega aquí lo que los clientes realmente escriben (y lo que esperaban encontrar).
    // Ejemplo:  { label: 'cliente: busca por marca y no la encontraba', q: '…', first: '…' },
];
