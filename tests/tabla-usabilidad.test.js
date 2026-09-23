// Pruebas de usabilidad del panel "Filas y celdas" del bloque Tabla (story: e07s01).
// Sin framework: usa node:test (stdlib) y audita el CSS y el <script> de
// test-impresora-agente.html según spec.md §1–§2 (criterios de aceptación §4).
// Fijan: botón quitar discreto (rojo solo en hover/focus), cabecera flex sin
// wrap, checkboxes N/S en horizontal vía .tabla-celda-formato, y los selectores
// de los listeners delegados intactos (spec.md §3).
//
// Ejecutar: node --test tests/tabla-usabilidad.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'test-impresora-agente.html');
const html = fs.readFileSync(HTML, 'utf8');
const css = html.split('<style>')[1].split('</style>')[0];
const js = html.split('<script>')[1].split('</script>')[0];

// Devuelve el cuerpo (sin llaves) del primer bloque cuyo selector contiene `sel`.
function regla(sel) {
  const i = css.indexOf(sel);
  if (i < 0) throw new Error('falta la regla CSS: ' + sel);
  const a = css.indexOf('{', i);
  let depth = 0;
  for (let j = a; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') { depth--; if (!depth) return css.slice(a + 1, j); }
  }
  throw new Error('no cierra la regla CSS: ' + sel);
}

// ===== §1 — Botón "Quitar fila" discreto =====

test('§1 .tabla-fila-cab es flex con el botón a la derecha, sin wrap', () => {
  const r = regla('.tabla-fila-cab{');
  assert.match(r, /display:\s*flex/);
  assert.match(r, /justify-content:\s*space-between/);
  assert.match(r, /align-items:\s*center/);
});

test('§1 .tabla-fila-quitar en reposo es neutro (sin rojo sólido)', () => {
  const r = regla('.tabla-fila-quitar{');
  assert.doesNotMatch(r, /var\(--red\)/, 'el estado en reposo no debe ser rojo');
  assert.doesNotMatch(r, /btn-danger/, 'sin heredar el estilo destructivo');
  assert.match(r, /background:\s*#3a3a37/, 'mismo gris que los botones secundarios pequeños');
  assert.match(r, /color:\s*var\(--paper-light\)/);
});

test('§1 el énfasis destructivo (var(--red)) solo aparece en :hover/:focus no deshabilitado', () => {
  const i = css.search(/\.tabla-fila-quitar:not\(:disabled\):(hover|focus)/);
  assert.ok(i >= 0, 'falta la regla :hover/:focus de .tabla-fila-quitar');
  const a = css.indexOf('{', i);
  const b = css.indexOf('}', a);
  assert.match(css.slice(a, b), /var\(--red\)/);
});

test('§1 el botón JS es icono ✕ con title="Quitar fila" y clase tabla-fila-quitar (sin btn-danger)', () => {
  assert.match(js, /quitar\.className = 'tabla-fila-quitar'/);
  assert.doesNotMatch(js, /btn-danger tabla-fila-quitar/);
  assert.match(js, /quitar\.textContent = '✕'/);
  assert.match(js, /quitar\.title = 'Quitar fila'/);
});

test('§1 el botón sigue deshabilitado con una sola fila', () => {
  assert.match(js, /quitar\.disabled = tablaBorrador\.filas\.length <= 1/);
});

// ===== §2 — Checkboxes N/S en horizontal =====

test('§2 .tabla-celda-formato es flex horizontal y anula el label global solo dentro', () => {
  const caja = regla('.tabla-celda-formato{');
  assert.match(caja, /display:\s*flex/);
  assert.match(caja, /align-items:\s*center/);
  const label = regla('.tabla-celda-formato label{');
  assert.match(label, /display:\s*(inline-)?flex/);
  assert.match(label, /margin:\s*0/);
});

test('§2 la regla global label{display:block} queda intacta', () => {
  assert.match(regla('\n  label{'), /display:\s*block/);
});

test('§2 los checkboxes N/S se envuelven en .tabla-celda-formato con sus datos intactos', () => {
  assert.match(js, /formato\.className = 'tabla-celda-formato'/);
  assert.match(js, /cajaCelda\.append\(tx, sel, formato\)/);
  assert.match(js, /class="tabla-celda-check"[^>]*data-campo="negrita"/);
  assert.match(js, /class="tabla-celda-check"[^>]*data-campo="subrayado"/);
});

// ===== §3 — Fuera de alcance: listeners delegados intactos =====

test('§3 los selectores de los listeners delegados no cambian', () => {
  ['tabla-celda-texto', 'tabla-celda-alineacion', 'tabla-celda-check', 'tabla-fila-quitar']
    .forEach(sel => assert.ok(js.includes(`classList.contains('${sel}')`),
      'falta el listener delegado: ' + sel));
});
