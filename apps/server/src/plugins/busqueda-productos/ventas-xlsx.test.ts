import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { leerVentasXlsx, normalizarNombre, ventasPorNombre } from './ventas-xlsx';

/** Arma un .xlsx mínimo (zip sin comprimir; el lector no revisa el CRC). */
function zipSinComprimir(archivos: Record<string, string>): Buffer {
    const locales: Buffer[] = [];
    const centrales: Buffer[] = [];
    let posicion = 0;
    for (const [nombre, texto] of Object.entries(archivos)) {
        const n = Buffer.from(nombre);
        const datos = Buffer.from(texto);
        const local = Buffer.alloc(30 + n.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt32LE(datos.length, 18);
        local.writeUInt32LE(datos.length, 22);
        local.writeUInt16LE(n.length, 26);
        n.copy(local, 30);
        const central = Buffer.alloc(46 + n.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt32LE(datos.length, 20);
        central.writeUInt32LE(datos.length, 24);
        central.writeUInt16LE(n.length, 28);
        central.writeUInt32LE(posicion, 42);
        n.copy(central, 46);
        locales.push(local, datos);
        centrales.push(central);
        posicion += local.length + datos.length;
    }
    const directorio = Buffer.concat(centrales);
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50, 0);
    fin.writeUInt16LE(centrales.length, 10);
    fin.writeUInt32LE(directorio.length, 12);
    fin.writeUInt32LE(posicion, 16);
    return Buffer.concat([...locales, directorio, fin]);
}

const textos = ['Artículo', 'U. med.', 'Venta', 'Unidades', 'DULCE &amp; CHILE  1 KG', 'PIEZA', 'Total 1 artículos', 'MAZAPAN'];
const compartidas = `<sst>${textos.map(t => `<si>    <t>${t}</t></si>`).join('')}</sst>`;
const hoja = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="2"/>
<row r="6"><c r="A6" t="s"><v>0</v></c><c r="G6" t="s"><v>1</v></c><c r="J6" t="s"><v>2</v></c><c r="P6" t="s"><v>3</v></c></row>
<row r="8"><c r="A8" t="s"><v>4</v></c><c r="G8" t="s"><v>5</v></c><c r="J8" t="n">   <v>1500.5</v></c><c r="P8" t="n"><v>12</v></c></row>
<row r="9"><c r="A9" t="s"><v>7</v></c><c r="J9" t="n"><v>-3</v></c></row>
<row r="10"><c r="A10" t="s"><v>6</v></c><c r="J10" t="n"><v>1497.5</v></c></row>
</sheetData></worksheet>`;

describe('leerVentasXlsx', () => {
    const xlsx = zipSinComprimir({ 'xl/sharedStrings.xml': compartidas, 'xl/worksheets/sheet1.xml': hoja });

    it('lee artículo, unidad, venta y unidades por el título de la columna, sin el total', () => {
        assert.deepEqual(leerVentasXlsx(xlsx), [
            { articulo: 'DULCE & CHILE  1 KG', unidad: 'PIEZA', venta: 1500.5, unidades: 12 },
            { articulo: 'MAZAPAN', unidad: null, venta: -3, unidades: 0 },
        ]);
    });

    it('avisa cuando no es el reporte esperado', () => {
        const otro = zipSinComprimir({ 'xl/worksheets/sheet1.xml': '<worksheet><sheetData/></worksheet>' });
        assert.throws(() => leerVentasXlsx(otro), /Mejores artículos/);
        assert.throws(() => leerVentasXlsx(Buffer.from('no es un zip')), /zip/);
    });
});

describe('ventasPorNombre', () => {
    it('junta los nombres repetidos sin importar mayúsculas ni espacios, y una venta negativa cuenta 0', () => {
        const ventas = ventasPorNombre([
            { articulo: 'Rollo  camiseta', unidad: null, venta: 10.1, unidades: 1 },
            { articulo: 'ROLLO CAMISETA ', unidad: null, venta: 20.2, unidades: 1 },
            { articulo: 'DEVUELTO', unidad: null, venta: -5, unidades: 0 },
        ]);
        assert.equal(ventas.get('ROLLO CAMISETA'), 30.3);
        assert.equal(ventas.get('DEVUELTO'), 0);
        assert.equal(normalizarNombre(' a   b '), 'A B');
    });
});
