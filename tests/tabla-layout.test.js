// Pruebas de las funciones puras del bloque "Tabla" (story: e06s01 + e06s02).
// Sin framework: usa node:test (stdlib) y extrae las funciones del <script>
// de test-impresora-agente.html por nombre. Las constantes (PADDING_CELDA,
// MAX_FILAS_TABLA, ESTILOS_BORDE_TABLA) se inyectan como fixture con los valores
// fijados en spec-bloque-tabla.md, de modo que cualquier cambio en la lógica de
// las funciones rompe el test.
//
// Ejecutar: node --test tests/tabla-layout.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'test-impresora-agente.html');
const js = fs.readFileSync(HTML, 'utf8').split('<script>')[1].split('</script>')[0];

// Extrae el cuerpo de una función top-level por su nombre (balanceando llaves).
function extract(name) {
  const re = new RegExp('function ' + name + '\\([^)]*\\)\\s*\\{');
  const m = js.match(re);
  if (!m) throw new Error('falta la función ' + name);
  let depth = 0;
  for (let j = m.index; j < js.length; j++) {
    if (js[j] === '{') depth++;
    else if (js[j] === '}') { depth--; if (!depth) return js.slice(m.index, j + 1); }
  }
  throw new Error('no cierra la función ' + name);
}

const ESTILOS = {
  basico:     { esquina: '+', horizontal: '-', vertical: '|' },
  doble:      { esquina: '+', horizontal: '=', vertical: '|' },
  punteado:   { esquina: '+', horizontal: '.', vertical: ':' },
  asteriscos: { esquina: '*', horizontal: '-', vertical: '*' }
};

// Evalúa en un scope aislado las funciones indicadas con las constantes de fixture.
function cargar(...nombres) {
  const src = 'const PADDING_CELDA = 1;\n'
    + 'const MAX_FILAS_TABLA = 100;\n'
    + 'const ESTILOS_BORDE_TABLA = ' + JSON.stringify(ESTILOS) + ';\n'
    + nombres.map(extract).join('\n');
  return new Function(src + '\n;return {' + nombres.join(',') + '};')();
}

// ===== e06s01 — layout sin bordes =====

test('anchoColumnasTabla: autoajuste toma el texto más largo y el ancho fijo se respeta', () => {
  const { anchoColumnasTabla } = cargar('anchoColumnasTabla');
  const b = {
    columnas: 2,
    columnasConfig: [{ autoajuste: true, ancho: null }, { autoajuste: false, ancho: 3 }],
    filas: [[{ texto: 'AB' }, { texto: '12345' }], [{ texto: 'CDEF' }, { texto: '1' }]]
  };
  assert.deepStrictEqual(anchoColumnasTabla(b), [4, 3]);
});

test('anchoColumnasTabla: columna vacía con autoajuste queda en mínimo 1', () => {
  const { anchoColumnasTabla } = cargar('anchoColumnasTabla');
  const b = {
    columnas: 1,
    columnasConfig: [{ autoajuste: true, ancho: null }],
    filas: [[{ texto: '' }]]
  };
  assert.deepStrictEqual(anchoColumnasTabla(b), [1]);
});

test('celdaFormateada: alineación izquierda/centro/derecha y truncado', () => {
  const { celdaFormateada } = cargar('celdaFormateada');
  assert.strictEqual(celdaFormateada('AB', 4, 'left'), 'AB  ');
  assert.strictEqual(celdaFormateada('X', 3, 'center'), ' X ');
  assert.strictEqual(celdaFormateada('AB', 4, 'right'), '  AB');
  assert.strictEqual(celdaFormateada('12345', 3, 'left'), '123');
});

test('celdaFormateada: cuenta caracteres visuales (tildes/ñ), no bytes', () => {
  const { celdaFormateada } = cargar('celdaFormateada');
  assert.strictEqual(celdaFormateada('ñ', 3, 'left'), 'ñ  ');
});

test('anchoTotalTabla: sin bordes suma anchos + (columnas-1) espacios', () => {
  const { anchoColumnasTabla, anchoTotalTabla } = cargar('anchoColumnasTabla', 'anchoTotalTabla');
  const b = {
    columnas: 2,
    columnasConfig: [{ autoajuste: true, ancho: null }, { autoajuste: false, ancho: 3 }],
    filas: [[{ texto: 'AB' }, { texto: '12345' }], [{ texto: 'CDEF' }, { texto: '1' }]],
    bordes: false
  };
  assert.strictEqual(anchoColumnasTabla(b).join(), '4,3');
  assert.strictEqual(anchoTotalTabla(b), 8);
});

test('lineaFilaTabla: sin bordes une celdas con un espacio', () => {
  const { anchoColumnasTabla, celdaFormateada, lineaFilaTabla } = cargar('anchoColumnasTabla', 'celdaFormateada', 'lineaFilaTabla');
  const b = {
    columnas: 2,
    columnasConfig: [{ autoajuste: true, ancho: null }, { autoajuste: false, ancho: 3 }],
    filas: [[{ texto: 'AB' }, { texto: '12345' }], [{ texto: 'CDEF' }, { texto: '1' }]]
  };
  const anchos = anchoColumnasTabla(b);
  assert.strictEqual(lineaFilaTabla(b.filas[0], anchos, false), 'AB' + ' '.repeat(3) + '123');
});

// ===== e06s02 — bordes, encabezado y grilla =====

test('lineaBordeTabla: dibuja el borde con el estilo elegido', () => {
  const { lineaBordeTabla } = cargar('lineaBordeTabla');
  assert.strictEqual(lineaBordeTabla([4, 3], ESTILOS.basico), '+------+-----+');
  assert.strictEqual(lineaBordeTabla([4, 3], ESTILOS.doble), '+======+=====+');
  assert.strictEqual(lineaBordeTabla([4, 3], ESTILOS.punteado), '+......+.....+');
  assert.strictEqual(lineaBordeTabla([4, 3], ESTILOS.asteriscos), '*------*-----*');
});

test('lineaFilaTabla: con bordes añade padding y barras verticales', () => {
  const { lineaFilaTabla } = cargar('celdaFormateada', 'lineaFilaTabla');
  const fila = [{ texto: 'AB', alineacion: 'left' }, { texto: '123', alineacion: 'right' }];
  assert.strictEqual(lineaFilaTabla(fila, [4, 3], true, ESTILOS.basico), '| AB   | 123 |');
});

test('lineaSeparadorEncabezado: con bordes usa el borde; sin bordes usa el carácter horizontal', () => {
  const { lineaSeparadorEncabezado } = cargar('lineaSeparadorEncabezado');
  assert.strictEqual(lineaSeparadorEncabezado([4, 3], ESTILOS.basico, true), '+------+-----+');
  assert.strictEqual(lineaSeparadorEncabezado([4, 3], ESTILOS.basico, false), '--------');
});