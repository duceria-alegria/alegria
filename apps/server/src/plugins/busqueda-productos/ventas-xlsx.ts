import { inflateRawSync } from 'zlib';

/** Una fila del reporte "Mejores artículos" del punto de venta. */
export interface VentaArticulo {
    articulo: string;
    unidad: string | null;
    /** Lo vendido en pesos en el periodo del reporte. */
    venta: number;
    unidades: number;
}

/** Misma regla en el reporte y en el catálogo: mayúsculas y espacios simples. */
export const normalizarNombre = (nombre: string) => nombre.normalize('NFC').toUpperCase().replace(/\s+/g, ' ').trim();

// Lector mínimo de .xlsx (un zip de XML) para no agregar una dependencia solo para este reporte.
function leerEntradasZip(zip: Buffer): Map<string, Buffer> {
    let fin = zip.length - 22;
    while (fin >= 0 && zip.readUInt32LE(fin) !== 0x06054b50) fin--;
    if (fin < 0) throw new Error('El archivo no es un .xlsx válido (no es un zip).');
    const total = zip.readUInt16LE(fin + 10);
    let pos = zip.readUInt32LE(fin + 16);
    const entradas = new Map<string, Buffer>();
    for (let i = 0; i < total; i++) {
        if (zip.readUInt32LE(pos) !== 0x02014b50) throw new Error('Zip dañado.');
        const metodo = zip.readUInt16LE(pos + 10);
        const tamano = zip.readUInt32LE(pos + 20);
        const largoNombre = zip.readUInt16LE(pos + 28);
        const largoExtra = zip.readUInt16LE(pos + 30);
        const largoComentario = zip.readUInt16LE(pos + 32);
        const inicioLocal = zip.readUInt32LE(pos + 42);
        const nombre = zip.toString('utf8', pos + 46, pos + 46 + largoNombre);
        const datos = inicioLocal + 30 + zip.readUInt16LE(inicioLocal + 26) + zip.readUInt16LE(inicioLocal + 28);
        const crudo = zip.subarray(datos, datos + tamano);
        if (metodo !== 0 && metodo !== 8) throw new Error(`Compresión no soportada (${metodo}) en ${nombre}.`);
        entradas.set(nombre, metodo === 0 ? crudo : inflateRawSync(crudo));
        pos += 46 + largoNombre + largoExtra + largoComentario;
    }
    return entradas;
}

const desescapar = (texto: string) =>
    texto
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&amp;/g, '&');

const textoDe = (xml: string) =>
    desescapar([...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(m => m[1]).join(''));

/** Lee el reporte "Mejores artículos" (columnas Artículo, U. med., Venta, Unidades) de un .xlsx. */
export function leerVentasXlsx(archivo: Buffer): VentaArticulo[] {
    const entradas = leerEntradasZip(archivo);
    const hoja = entradas.get('xl/worksheets/sheet1.xml');
    if (!hoja) throw new Error('El .xlsx no tiene la hoja 1.');
    const compartidas = [...(entradas.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
        m => textoDe(m[1]),
    );

    const filas: Array<Record<string, string | number>> = [];
    for (const fila of hoja.toString('utf8').matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
        const celdas: Record<string, string | number> = {};
        for (const celda of (fila[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const columna = /\br="([A-Z]+)\d+"/.exec(celda[1])?.[1];
            const tipo = /\bt="(\w+)"/.exec(celda[1])?.[1];
            const valor = /<v>\s*([^<]*?)\s*<\/v>/.exec(celda[2] ?? '')?.[1];
            if (!columna) continue;
            if (tipo === 'inlineStr') celdas[columna] = textoDe(celda[2] ?? '');
            else if (valor !== undefined && valor !== '') celdas[columna] = tipo === 's' ? compartidas[Number(valor)] : Number(valor);
        }
        if (Object.keys(celdas).length) filas.push(celdas);
    }

    const encabezado = filas.find(f => Object.values(f).includes('Artículo') && Object.values(f).includes('Venta'));
    if (!encabezado) throw new Error('No encontré los encabezados "Artículo" y "Venta": ¿es el reporte "Mejores artículos"?');
    const columna = (titulo: string) => Object.entries(encabezado).find(([, v]) => v === titulo)?.[0];
    const [cArticulo, cUnidad, cVenta, cUnidades] = ['Artículo', 'U. med.', 'Venta', 'Unidades'].map(columna);
    if (!cArticulo || !cVenta) throw new Error('Faltan las columnas Artículo y Venta.');

    const resultado: VentaArticulo[] = [];
    for (const fila of filas.slice(filas.indexOf(encabezado) + 1)) {
        const articulo = fila[cArticulo];
        if (typeof articulo !== 'string' || /^Total\b/.test(articulo)) continue;
        const venta = fila[cVenta];
        if (typeof venta !== 'number') continue;
        const unidad = cUnidad ? fila[cUnidad] : undefined;
        const unidades = cUnidades ? fila[cUnidades] : undefined;
        resultado.push({
            articulo,
            unidad: typeof unidad === 'string' ? unidad : null,
            venta,
            unidades: typeof unidades === 'number' ? unidades : 0,
        });
    }
    return resultado;
}

/**
 * Lo vendido por nombre de artículo (junta las filas con el mismo nombre). Una venta neta negativa
 * (devoluciones) cuenta como 0.
 */
export function ventasPorNombre(filas: VentaArticulo[]): Map<string, number> {
    const porNombre = new Map<string, number>();
    for (const { articulo, venta } of filas) {
        const nombre = normalizarNombre(articulo);
        porNombre.set(nombre, (porNombre.get(nombre) ?? 0) + venta);
    }
    for (const [nombre, venta] of porNombre) porNombre.set(nombre, Math.max(0, Math.round(venta * 100) / 100));
    return porNombre;
}
