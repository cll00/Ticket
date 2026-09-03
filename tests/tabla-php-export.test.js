// Pruebas del export a PHP del bloque "Tabla" (story: e06s01).
// Verifica que phpValorTabla genera el array literal correcto y que el PHP
// resultante es sintácticamente válido y produce los bytes ESC/POS esperados.
// Ejecutar: node --test tests/tabla-php-export.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HTML = path.join(__dirname, '..', 'test-impresora-agente.html');
const js = fs.readFileSync(HTML, 'utf8').split('<script>')[1].split('</script>')[0];

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

// Extrae el contenido RAW de `const NAME = String.raw`...`;` (sin backticks en el cuerpo).
function extractRawConst(name) {
  const start = js.indexOf('const ' + name + ' = String.raw`');
  if (start < 0) throw new Error('falta ' + name);
  const open = js.indexOf('`', start);
  const close = js.indexOf('`', open + 1);
  if (close < 0) throw new Error('no cierra ' + name);
  return js.slice(open + 1, close);
}

function cargar() {
  const helper = JSON.stringify(extractRawConst('HELPER_TABLA_PHP'));
  const src = 'const HELPER_TABLA_PHP = ' + helper + ';'
    + extract('phpEscapeString') + extract('phpValorTabla');
  return new Function(src + '\n;return { phpValorTabla, HELPER_TABLA_PHP };')();
}

const muestra = {
  tipo: 'tabla', fuente: 'A', columnas: 2,
  columnasConfig: [{ autoajuste: true, ancho: null }, { autoajuste: false, ancho: 4 }],
  filas: [
    [{ texto: 'Producto', alineacion: 'left', negrita: true, subrayado: false },
     { texto: 'Cant', alineacion: 'center', negrita: false, subrayado: false }],
    [{ texto: 'Té', alineacion: 'left', negrita: false, subrayado: false },
     { texto: '2', alineacion: 'right', negrita: false, subrayado: true }]
  ]
};

test('phpValorTabla: genera el array literal con datos y formatos', () => {
  const { phpValorTabla } = cargar();
  const out = phpValorTabla(muestra);
  assert.match(out, /'fuente' => 'A'/);
  assert.match(out, /'bordes' => false/);
  assert.match(out, /'estiloBorde' => 'basico'/);
  assert.match(out, /'encabezado' => false/);
  assert.match(out, /'grilla' => false/);
  assert.match(out, /'autoajuste'=>true/);
  assert.match(out, /'autoajuste'=>false,'ancho'=>4/);
  assert.match(out, /'texto'=>"Producto"/);
  assert.match(out, /'texto'=>"Té"/);
  assert.match(out, /'negrita'=>true/);
  assert.match(out, /'subrayado'=>true/);
});

test('phpValorTabla: propaga bordes, estilo, encabezado y grilla', () => {
  const { phpValorTabla } = cargar();
  const conBordes = Object.assign({}, muestra, { bordes: true, estiloBorde: 'doble', encabezado: true, grilla: true });
  const out = phpValorTabla(conBordes);
  assert.match(out, /'bordes' => true/);
  assert.match(out, /'estiloBorde' => 'doble'/);
  assert.match(out, /'encabezado' => true/);
  assert.match(out, /'grilla' => true/);
});

test('PHP generado: sintaxis válida y bytes ESC/POS esperados', (t) => {
  let phpBin;
  try { phpBin = execFileSync('which', ['php'], { encoding: 'utf8' }).trim(); } catch { phpBin = ''; }
  if (!phpBin) { t.skip('php no disponible'); return; }

  const { phpValorTabla, HELPER_TABLA_PHP } = cargar();
  const codigo = [
    '<?php',
    '$ESC = "\\x1B"; $GS = "\\x1D";',
    '$ticket = $ESC . "@"; $ticket .= $ESC . "t" . "\\x00";',
    HELPER_TABLA_PHP,
    'agregar_bloque_tabla($ticket, $ESC, $GS, ' + phpValorTabla(muestra) + ');',
    "header('Content-Type: application/json');",
    "echo json_encode(['data' => base64_encode($ticket)]);"
  ].join('\n');

  const archivo = path.join(os.tmpdir(), 'tabla_gen_' + process.pid + '.php');
  fs.writeFileSync(archivo, codigo);
  try {
    // -l valida sintaxis sin ejecutar
    execFileSync(phpBin, ['-d', 'error_reporting=E_ERROR', '-l', archivo], { stdio: 'pipe' });
    // ejecuta y decodifica la base64 resultante
    const stdout = execFileSync(phpBin, ['-d', 'error_reporting=0', '-d', 'display_errors=0', archivo], { encoding: 'utf8' });
    const b64 = JSON.parse(stdout).data;
    const bytes = Buffer.from(b64, 'base64');
    assert.ok(bytes.includes(Buffer.from('Producto', 'utf8')), 'contiene la celda Producto');
    assert.ok(bytes.includes(Buffer.from('Cant', 'utf8')), 'contiene la celda Cant');
    assert.ok(bytes.includes(Buffer.from('Té', 'utf8')), 'contiene la celda Té');
    assert.ok(bytes.includes(0x0a), 'contiene saltos de línea');
  } finally {
    fs.unlinkSync(archivo);
  }
});