# Especificación técnica — Nuevo bloque "Tabla" (Editor Visual ESC/POS)

**Documento de entrada para IA/desarrollador implementador.**
Basado en `test-impresora-agente.html` (probador de impresora térmica con editor visual de bloques ESC/POS → exporta a PHP).

---

## 0. Resumen para quien implemente

Hoy el editor soporta 7 tipos de bloque: `texto`, `separador`, `salto`, `corte`, `barcode`, `qr`, `image`. Cada tipo toca **9-10 puntos del código** de forma consistente:

1. `<option>` en `#nuevoTipoBloque`
2. Bloque de campos propio en el formulario (`#camposXxx`)
3. `mostrarCamposDe(tipo)` — mostrar/ocultar ese bloque de campos
4. Estado "borrador" del formulario + función de reset (`resetearFormulario`)
5. Construcción del objeto `bloque` al pulsar **+ Agregar bloque**
6. Carga inversa en `cargarBloqueEnFormulario(idx)` (modo edición)
7. `resumenBloque(b)` — texto corto en el panel "Bloques del ticket"
8. `bloquesABytes(listaBloques)` — generación de bytes ESC/POS reales
9. `renderizarBloquesDirecto(listaBloques)` — vista previa HTML
10. `bloquesAPhpCodigo(listaBloques)` — generación del código PHP exportable

El bloque **Tabla** debe integrarse en los mismos 10 puntos. No existe ningún comando ESC/POS nativo de "tabla": se simula 100% con texto monoespaciado (igual que hace hoy el `separador`, que ya usa `cplSegunFuente()` para saber cuántos caracteres caben por línea).

---

## 1. Modelo de datos del bloque

```js
{
  tipo: 'tabla',

  // ---- Propiedades globales del bloque ----
  fuente: 'A' | 'B',        // Fuente ESC/POS única para toda la tabla (ver §2)
  columnas: 3,               // entero 1..4, default 3
  bordes: true,              // checkbox "¿la tabla tiene bordes?"
  estiloBorde: 'basico',     // 'basico' | 'doble' | 'punteado' | 'asteriscos' — ver §3
                              // OJO: se guarda SIEMPRE, aunque bordes=false (ver §3.1)
  encabezado: true,          // "Usar primera fila como encabezado"

  // ---- Configuración por columna (largo == columnas) ----
  columnasConfig: [
    { autoajuste: true,  ancho: null },   // col. 0: se ajusta al texto más largo
    { autoajuste: false, ancho: 8 },      // col. 1: ancho fijo de 8 caracteres
    { autoajuste: false, ancho: 8 }       // col. 2: ancho fijo de 8 caracteres
  ],

  // ---- Filas (largo >= 1, default 2 al crear el bloque) ----
  // cada fila es un array de celdas, largo == columnas
  filas: [
    [ // fila 0 (será encabezado si encabezado=true)
      { texto:'Producto', alineacion:'left',   negrita:true,  subrayado:false },
      { texto:'Cant.',    alineacion:'center', negrita:true,  subrayado:false },
      { texto:'Precio',   alineacion:'right',  negrita:true,  subrayado:false }
    ],
    [
      { texto:'Coca-Cola 500ml', alineacion:'left',   negrita:false, subrayado:false },
      { texto:'2',               alineacion:'center', negrita:false, subrayado:false },
      { texto:'$2400',           alineacion:'right',  negrita:false, subrayado:false }
    ]
  ]
}
```

### ⚠️ Decisión de diseño importante: autoajuste/ancho son por columna, no por celda

El enunciado original describe "autoajuste" y "ancho fijo" como propiedades de cada celda. En la práctica no pueden vivir en la celda, porque todas las celdas de una misma columna deben compartir el mismo ancho para que la grilla quede alineada (si la fila 2 tuviera ancho=6 y la fila 3 ancho=10 en la misma columna, la tabla se desalinea).

**Resolución propuesta:** `autoajuste` y `ancho` se configuran una vez por columna (`columnasConfig`), no en cada celda. Lo que sí queda por celda —porque tiene sentido que varíe fila a fila— es: `texto`, `alineacion`, `negrita`, `subrayado`.

Esto también simplifica la UI: en vez de repetir 2 checkboxes en cada una de las N×M celdas, se configuran una sola vez por columna (ver §5.3).

---

## 2. Fuente y caracteres por línea (referencia a bloque existente)

El bloque **separador** ya resuelve exactamente este problema y debe tomarse como referencia directa:

```js
// Caracteres que caben por línea según el tipo de fuente ESC/POS.
// Fuente A: 48 (80mm) / 32 (58mm). Fuente B (9x17, más estrecha): 64 (80mm) / 42 (58mm).
function cplSegunFuente(fuente, anchoPapel){
  const base = parseInt(anchoPapel, 10);
  return fuente === 'B' ? (base === 48 ? 64 : 42) : base;
}
```

El bloque Tabla debe reutilizar esta misma función, no reimplementarla. El tamaño de papel (32/58mm u 48/80mm) no se guarda en el bloque: se lee en el momento de renderizar/imprimir/exportar desde `el('anchoPapel').value` (pestaña Configuración), tal como hacen `separador`, `image` (`MAX_ANCHO_IMAGEN`) y `qr`. Esto es justamente lo que pide "tamaño del papel: solo referencial ya que se obtiene desde la configuración" — la tabla no lo persiste, lo consulta en cada cálculo, así si el usuario cambia el papel después, la tabla se recalcula sola.

**Fuente única por bloque:** a diferencia del bloque `texto`, la tabla tiene una sola fuente para toda la tabla completa (todas las filas). No tiene sentido mezclar Fuente A y B entre columnas de una misma tabla porque tienen distinto ancho de carácter y romperían la alineación vertical de las barras `|`.

---

## 3. Estilos de borde

| Estilo | Esquina/cruce | Horizontal | Vertical |
|---|---|---|---|
| Básico | `+` | `-` | `\|` |
| Doble refuerzo | `+` | `=` | `\|` |
| Punteado | `+` | `.` | `:` |
| Asteriscos | `*` | `-` | `*` |

```js
const ESTILOS_BORDE_TABLA = {
  basico:     { esquina:'+', horizontal:'-', vertical:'|' },
  doble:      { esquina:'+', horizontal:'=', vertical:'|' },
  punteado:   { esquina:'+', horizontal:'.', vertical:':' },
  asteriscos: { esquina:'*', horizontal:'-', vertical:'*' }
};
```

**Simplificación deliberada:** hay un solo carácter de "esquina/cruce" por estilo, usado tanto en las 4 esquinas como en cualquier intersección intermedia (no se distingue `┌┬┐├┼┤└┴┘` como en cajas Unicode). El borde superior de una tabla de 3 columnas se ve así:

```
+----------+--------+--------+
```

usando el mismo `+` en el borde y en cada cruce entre columnas.

### 3.1 Encabezado y su línea separadora (regla explícita del enunciado)

Si `encabezado = true`, la fila 0 se imprime en negrita (forzado visualmente al renderizar/exportar) y se agrega debajo una línea separadora horizontal que **reutiliza el carácter horizontal del `estiloBorde` elegido, incluso si `bordes = false`.**

Esto implica que `estiloBorde` debe persistir en el modelo de datos aunque el checkbox de bordes esté desmarcado — la UI solo oculta/deshabilita el selector de estilo cuando `bordes=false`, pero el valor previamente elegido (o el default `'basico'`) sigue viviendo en el bloque para poder dibujar esa línea de encabezado. Si nunca se marcó "bordes", el valor default de `estiloBorde` debe ser `'basico'` de todos modos.

---

## 4. Cálculo de anchos (núcleo del bloque)

Estas funciones deben ser **compartidas** entre `bloquesABytes`, `renderizarBloquesDirecto` y `bloquesAPhpCodigo` (JS) — no reimplementar 3 veces la misma lógica de layout.

```js
// Ancho de cada columna en caracteres de TEXTO (sin contar padding ni bordes).
function anchoColumnasTabla(b){
  const anchos = [];
  for(let c = 0; c < b.columnas; c++){
    const cfg = b.columnasConfig[c];
    if(cfg.autoajuste){
      let max = 0;
      for(const fila of b.filas){
        max = Math.max(max, [...(fila[c]?.texto || '')].length);
      }
      anchos.push(Math.max(1, max)); // mínimo 1 para no generar columnas de ancho 0
    } else {
      anchos.push(Math.max(1, parseInt(cfg.ancho, 10) || 1));
    }
  }
  return anchos;
}

// Trunca+alinea el texto de una celda al ancho de su columna.
function celdaFormateada(texto, ancho, alineacion){
  let chars = [...(texto || '')];
  if(chars.length > ancho) chars = chars.slice(0, ancho);   // truncado si excede
  const t = chars.join('');
  const espacio = ancho - t.length;
  if(alineacion === 'right')  return ' '.repeat(espacio) + t;
  if(alineacion === 'center'){
    const izq = Math.floor(espacio / 2), der = espacio - izq;
    return ' '.repeat(izq) + t + ' '.repeat(der);
  }
  return t + ' '.repeat(espacio); // left (default)
}

const PADDING_CELDA = 1; // espacio a cada lado del texto, solo cuando hay bordes: "| Texto  |"

// Ancho total de la tabla en caracteres de línea impresa (para validar contra cplSegunFuente).
function anchoTotalTabla(b){
  const anchos = anchoColumnasTabla(b);
  const relleno = b.bordes ? PADDING_CELDA * 2 : 0;
  const suma = anchos.reduce((acc, a) => acc + a + relleno, 0);
  return b.bordes
    ? suma + (b.columnas + 1)     // N columnas + (N+1) barras verticales
    : suma + (b.columnas - 1);    // N columnas + (N-1) espacios de separación
}

function lineaBordeTabla(anchos, estilo){
  const relleno = PADDING_CELDA * 2;
  const partes = anchos.map(a => estilo.horizontal.repeat(a + relleno));
  return estilo.esquina + partes.join(estilo.esquina) + estilo.esquina;
}

function lineaSeparadorEncabezado(anchos, estilo, bordesActivo){
  if(bordesActivo) return lineaBordeTabla(anchos, estilo);
  const anchoTotal = anchos.reduce((a, b2) => a + b2, 0) + (anchos.length - 1);
  return estilo.horizontal.repeat(anchoTotal);
}

function lineaFilaTabla(fila, anchos, bordesActivo, estilo){
  const celdas = fila.map((c, i) => celdaFormateada(c.texto, anchos[i], c.alineacion));
  return bordesActivo
    ? estilo.vertical + celdas.map(t => ` ${t} `).join(estilo.vertical) + estilo.vertical
    : celdas.join(' ');
}
```

### 4.1 Reglas resumidas

- **`autoajuste = true`** → ancho de columna = longitud del texto más largo entre todas las filas de esa columna (incluida la fila 0 si es encabezado). No hay truncado posible en este modo.
- **`autoajuste = false`** → el usuario indica una cantidad de caracteres; si el texto de una celda la excede, se corta (no hace wrap a una segunda línea — mantiene la tabla a una línea por fila, más simple y predecible en una impresora térmica).
- El padding de 1 espacio a cada lado del texto (`" Texto "`) solo aplica cuando `bordes = true`. Sin bordes, las columnas se separan con un único espacio entre ellas.
- El cálculo de "cabe o no cabe en la línea" (`anchoTotalTabla`) debe considerar si `bordes` está activo o no, tal como pide el enunciado — con bordes activos, cada columna suma 2 caracteres de padding + se agregan N+1 barras verticales; sin bordes, solo se agregan los espacios de separación entre columnas.

### 4.2 Validación de ancho contra el papel — recomendación

`anchoTotalTabla(b)` debe compararse contra `cplSegunFuente(b.fuente, anchoPapelActual)` antes de permitir agregar/guardar el bloque, igual que hoy se valida `datos` no vacío en `barcode`/`qr` o el ancho máximo en `image` (`if(ancho > maxW){ ... }`).

Sugerencia de UX: mostrar en vivo, mientras se edita el formulario, un indicador tipo:

> Ancho de la tabla: **52 / 48** caracteres disponibles (Fuente A, papel 80 mm) ⚠️

y bloquear el botón **+ Agregar bloque** (con `log('...', 'error')`, mismo patrón que el resto del formulario) si se excede, indicando qué reducir: cantidad de columnas, anchos fijos, o cambiar de Fuente A→B (o de papel, aunque el papel es global y no se cambia desde este formulario).

Con 4 columnas (el máximo permitido) el escenario más ajustado con bordes activos consume al menos `4×3 + 5 = 17` caracteres solo de estructura (columnas de 1 carácter + padding + barras), lo cual es razonable incluso en papel de 32/42 caracteres — por eso 4 es un tope sensato.

---

## 5. Formulario "Agregar bloque" — UI sugerida

### 5.1 Selector de tipo

Agregar `<option value="tabla">Tabla</option>` en `#nuevoTipoBloque`, y su bloque de campos `#camposTabla` (oculto por defecto), sumado a `mostrarCamposDe(tipo)`:

```js
el('camposTabla').style.display = tipo === 'tabla' ? 'block' : 'none';
```

### 5.2 Propiedades globales

- **Fuente** (toda la tabla): select A/B — igual al de `separador`.
- **Cantidad de columnas**: select o input numérico, rango 1–4, default 3. Al cambiar:
  - crecer: agregar una `columnaConfig` default (`{autoajuste:true, ancho:null}`) y una celda vacía al final de cada fila existente.
  - encoger: recortar `columnasConfig` y cada fila a la nueva cantidad (se pierde el dato de las columnas removidas — comportamiento simple, consistente con cómo ya se maneja hoy el toggle "multilínea" de segmentos, que reconstruye sin pedir confirmación).
- **Bordes**: checkbox. Al desmarcar, oculta (no borra) el selector de estilo.
- **Estilo de borde**: select con las 4 opciones de la tabla del §3, visible/habilitado solo si `bordes` está activo — pero su valor se conserva en el borrador aunque se oculte (ver §3.1).
- **Usar primera fila como encabezado**: checkbox.

### 5.3 Configuración por columna

Una fila de controles por columna (no por celda), con:

- checkbox **Autoajuste**
- input numérico **Ancho (caracteres)**, habilitado solo si Autoajuste está desmarcado

### 5.4 Grilla de filas/celdas

Por cada fila (mínimo 2 al crear el bloque, sin tope duro salvo el largo del papel):

- Un input de texto por celda
- Select de alineación (izquierda/centro/derecha) por celda
- Checkboxes **N** (negrita) / **S** (subrayado) por celda — mismo patrón visual que ya usan los segmentos de texto (`N = negrita · S = subrayado`)
- Botón **✕ Quitar fila** por fila (no está en el enunciado original pero se sugiere agregarlo — sin él, una vez que se agregan filas de más no hay forma de deshacer). Mínimo 1 fila permitida (mismo patrón que "siempre dejar al menos un segmento" en el bloque texto).

Botón **+ Agregar fila** al final de la grilla (pedido explícito del enunciado), que agrega una fila con celdas vacías (`{texto:'', alineacion:'left', negrita:false, subrayado:false}` por cada columna actual).

### 5.5 Estado "borrador" del formulario

Análogo a `segmentosBorrador`/`renderizarSegmentosBorrador()`/`resetearFormulario()` que ya existen para el bloque texto:

```js
let tablaBorrador = null; // se inicializa/resetea a la forma del §1 con 2 filas y 3 columnas

function columnaConfigVacia(){ return { autoajuste:true, ancho:null }; }
function celdaVacia(){ return { texto:'', alineacion:'left', negrita:false, subrayado:false }; }
function filaVacia(nCols){ return Array.from({length:nCols}, celdaVacia); }

function renderizarTablaBorrador(){ /* dibuja los controles de §5.2–§5.4 desde tablaBorrador */ }
```

- Al pulsar **+ Agregar bloque**: validar ancho total (§4.2), construir el objeto `{tipo:'tabla', ...tablaBorrador}` y agregarlo/reemplazarlo en `bloques[]` igual que el resto de los tipos.
- Al editar un bloque tabla existente (`cargarBloqueEnFormulario`): clonar sus datos hacia `tablaBorrador` y llamar a `renderizarTablaBorrador()`, agregando `'tabla'` a la lista de tipos editables:
  ```js
  if(['texto','separador','corte','barcode','qr','image','tabla'].includes(bloque.tipo)){ ... } // botón editar
  ```

---

## 6. `resumenBloque(b)` — texto para el panel "Bloques del ticket"

```js
if(b.tipo === 'tabla'){
  const partes = [`${b.columnas} col × ${b.filas.length} filas`];
  partes.push(b.bordes ? `bordes ${b.estiloBorde}` : 'sin bordes');
  if(b.encabezado) partes.push('con encabezado');
  if(b.fuente === 'B') partes.push('Fuente B');
  return `Tabla (${partes.join(', ')})`;
}
```

Ejemplo de salida: `Tabla (3 col × 4 filas, bordes basico, con encabezado)`

---

## 7. Vista previa (`renderizarBloquesDirecto`)

Como el `.receipt` ya usa una fuente monoespaciada (`--mono`) y ya soporta la clase `.fuente-b` para Fuente B (achicando el `font-size` al 75%, igual que hace `separador`/`texto`), la tabla se renderiza reutilizando las mismas funciones de layout del §4 para armar cada línea como texto plano, envolviendo en `<span>` con `font-weight:700` / `text-decoration:underline` únicamente el tramo de texto correspondiente a cada celda con `negrita`/`subrayado`, dejando las barras verticales y los espacios de relleno sin esos estilos.

```js
} else if(b.tipo === 'tabla'){
  const estilo = ESTILOS_BORDE_TABLA[b.estiloBorde] || ESTILOS_BORDE_TABLA.basico;
  const anchos = anchoColumnasTabla(b);

  function nuevaLineaTabla(texto){
    const linea = nuevaLineaEn('left');
    if(b.fuente === 'B') linea.classList.add('fuente-b');
    linea.textContent = texto;
  }

  if(b.bordes) nuevaLineaTabla(lineaBordeTabla(anchos, estilo));
  b.filas.forEach((fila, i) => {
    nuevaLineaTabla(lineaFilaTabla(fila, anchos, b.bordes, estilo)); // versión simple sin negrita visual
    if(i === 0 && b.encabezado){
      nuevaLineaTabla(lineaSeparadorEncabezado(anchos, estilo, b.bordes));
    }
  });
  if(b.bordes) nuevaLineaTabla(lineaBordeTabla(anchos, estilo));
}
```

> Nota: para que la vista previa muestre negrita/subrayado por celda de forma fiel (no solo como texto plano), conviene una segunda versión de `lineaFilaTabla` que en vez de devolver un `string` devuelva un array de `{texto, negrita, subrayado}` para poder crear un `<span>` por celda — recomendado para que el "WYSIWYG" del panel derecho coincida con el ticket impreso real.

---

## 8. Bytes ESC/POS (`bloquesABytes`)

Reglas obligatorias, con justificación:

- **Alineación siempre `left` a nivel de comando ESC/POS** (`ESC a 0`). El centrado/derecha se resuelve manualmente rellenando con espacios dentro de cada celda (§4). Si se usara `ESC a` en modo centro/derecha sobre la línea completa, se duplicaría/rompería el padding ya calculado.
- **Tamaño siempre `normal`** (`GS ! 0x00`). Los tamaños doble-ancho/doble-alto duplican el ancho físico de cada carácter en el cabezal de impresión, lo que invalida por completo los cálculos de `cplSegunFuente()`/`anchoColumnasTabla()`, que asumen 1 carácter = 1 celda de ancho fijo. Por eso la tabla no expone selector de "tamaño" (a diferencia del bloque `texto`) — es una limitación de alcance deliberada.
- **Fuente** (`ESC M`) se fija una vez al inicio del bloque según `b.fuente`.
- **Negrita/subrayado** se activan/desactivan por segmento de celda, igual que ya hace `bloquesABytes` para los segmentos del bloque `texto` (reutilizar `asegurarNegrita`/`asegurarSubrayado`), dejando en `false` los tramos de barras verticales/espacios de relleno.

```js
} else if(b.tipo === 'tabla'){
  asegurarAlineacion('left');
  asegurarTamano('normal');
  asegurarFuente(b.fuente);

  const estilo = ESTILOS_BORDE_TABLA[b.estiloBorde] || ESTILOS_BORDE_TABLA.basico;
  const anchos = anchoColumnasTabla(b);

  function emitirLineaPlana(str){
    asegurarNegrita(false);
    asegurarSubrayado(false);
    bytes.push(...textoABytes(str, modo));
    bytes.push(0x0A);
  }

  function emitirFila(fila){
    if(b.bordes){ asegurarNegrita(false); asegurarSubrayado(false); bytes.push(...textoABytes(estilo.vertical, modo)); }
    fila.forEach((celda, i) => {
      const texto = celdaFormateada(celda.texto, anchos[i], celda.alineacion);
      if(b.bordes) bytes.push(...textoABytes(' ', modo));
      asegurarNegrita(!!celda.negrita);
      asegurarSubrayado(!!celda.subrayado);
      bytes.push(...textoABytes(texto, modo));
      asegurarNegrita(false);
      asegurarSubrayado(false);
      if(b.bordes){
        bytes.push(...textoABytes(' ', modo));
        bytes.push(...textoABytes(estilo.vertical, modo));
      } else if(i < fila.length - 1){
        bytes.push(...textoABytes(' ', modo));
      }
    });
    bytes.push(0x0A);
  }

  if(b.bordes) emitirLineaPlana(lineaBordeTabla(anchos, estilo));
  b.filas.forEach((fila, i) => {
    emitirFila(fila);
    if(i === 0 && b.encabezado) emitirLineaPlana(lineaSeparadorEncabezado(anchos, estilo, b.bordes));
  });
  if(b.bordes) emitirLineaPlana(lineaBordeTabla(anchos, estilo));
}
```

---

## 9. Exportación a PHP — optimización para múltiples tablas en un mismo ticket

Este es el punto que el enunciado pide analizar explícitamente. Todos los demás tipos de bloque generan su código inline (repitiendo las mismas líneas de PHP por cada instancia), lo cual es aceptable porque son 3–8 líneas cada uno. La tabla, en cambio, requiere loops, cálculo de anchos y armado de bordes: si se generara inline y el ticket tuviera, por ejemplo, 3 bloques `tabla`, el PHP resultante triplicaría ~40–60 líneas de lógica casi idéntica.

**Enfoque recomendado:** generar una única vez (solo si `listaBloques` contiene al menos un bloque `tipo:'tabla'`) un set de funciones auxiliares PHP al principio del archivo generado, y por cada bloque tabla emitir únicamente la llamada con sus datos como array literal PHP. Esto es 100% compatible con el modelo actual (el PHP generado sigue siendo estático/autocontenido, solo que factoriza la lógica repetida).

```php
<?php
// Generado por el Editor Visual ESC/POS
$ESC = "\x1B";
$GS  = "\x1D";

$ticket  = $ESC . "@";
$ticket .= $ESC . "t" . "\x00";

// ---- Funciones auxiliares para bloques tipo Tabla ----
// Se agregan una sola vez aunque haya varios bloques de este tipo en el ticket.
function _tabla_estilo($nombre) {
  $estilos = [
    'basico'     => ['esquina' => '+', 'horizontal' => '-', 'vertical' => '|'],
    'doble'      => ['esquina' => '+', 'horizontal' => '=', 'vertical' => '|'],
    'punteado'   => ['esquina' => '+', 'horizontal' => '.', 'vertical' => ':'],
    'asteriscos' => ['esquina' => '*', 'horizontal' => '-', 'vertical' => '*'],
  ];
  return $estilos[$nombre] ?? $estilos['basico'];
}
function _tabla_anchos($columnasConfig, $filas) {
  $anchos = [];
  foreach ($columnasConfig as $c => $cfg) {
    if ($cfg['autoajuste']) {
      $max = 0;
      foreach ($filas as $fila) $max = max($max, mb_strlen($fila[$c]['texto']));
      $anchos[] = max(1, $max);
    } else {
      $anchos[] = max(1, (int)($cfg['ancho'] ?? 1));
    }
  }
  return $anchos;
}
function _tabla_celda($texto, $ancho, $alineacion) {
  $t = mb_substr($texto, 0, $ancho);           // truncado multibyte-safe (tildes, ñ)
  $espacio = $ancho - mb_strlen($t);
  if ($alineacion === 'right') return str_repeat(' ', $espacio) . $t;
  if ($alineacion === 'center') {
    $izq = (int) floor($espacio / 2);
    return str_repeat(' ', $izq) . $t . str_repeat(' ', $espacio - $izq);
  }
  return $t . str_repeat(' ', $espacio);
}
function _tabla_linea_borde($anchos, $estilo) {
  $partes = array_map(fn($a) => str_repeat($estilo['horizontal'], $a + 2), $anchos);
  return $estilo['esquina'] . implode($estilo['esquina'], $partes) . $estilo['esquina'];
}
// Agrega un bloque Tabla completo a $ticket. $ESC/$GS deben existir en el scope llamador.
function agregar_bloque_tabla(&$ticket, $ESC, $GS, $tabla) {
  $estilo = _tabla_estilo($tabla['estiloBorde']);
  $anchos = _tabla_anchos($tabla['columnasConfig'], $tabla['filas']);
  $bordes = $tabla['bordes'];

  $ticket .= $ESC . "a" . "\x00";  // alinear izquierda (obligatorio en tablas)
  $ticket .= $GS  . "!" . "\x00";  // tamaño normal (obligatorio en tablas)
  $ticket .= $ESC . "M" . ($tabla['fuente'] === 'B' ? "\x01" : "\x00");

  if ($bordes) $ticket .= _tabla_linea_borde($anchos, $estilo) . "\n";

  foreach ($tabla['filas'] as $i => $fila) {
    $piezas = [];
    foreach ($fila as $c => $celda) {
      $txt = _tabla_celda($celda['texto'], $anchos[$c], $celda['alineacion']);
      $seg = '';
      if ($celda['negrita'])   $seg .= $ESC . "E" . "\x01";
      if ($celda['subrayado']) $seg .= $ESC . "-" . "\x01";
      $seg .= $txt;
      if ($celda['negrita'])   $seg .= $ESC . "E" . "\x00";
      if ($celda['subrayado']) $seg .= $ESC . "-" . "\x00";
      $piezas[] = $seg;
    }
    $ticket .= $bordes
      ? ($estilo['vertical'] . implode($estilo['vertical'], array_map(fn($p) => " $p ", $piezas)) . $estilo['vertical'])
      : implode(' ', $piezas);
    $ticket .= "\n";

    if ($i === 0 && $tabla['encabezado']) {
      $ticket .= $bordes
        ? _tabla_linea_borde($anchos, $estilo)
        : str_repeat($estilo['horizontal'], array_sum($anchos) + (count($anchos) - 1));
      $ticket .= "\n";
    }
  }

  if ($bordes) $ticket .= _tabla_linea_borde($anchos, $estilo) . "\n";
}
// ---- Fin funciones auxiliares de Tabla ----

agregar_bloque_tabla($ticket, $ESC, $GS, [
  'fuente' => 'A',
  'bordes' => true,
  'estiloBorde' => 'basico',
  'encabezado' => true,
  'columnasConfig' => [
    ['autoajuste' => true,  'ancho' => null],
    ['autoajuste' => false, 'ancho' => 8],
    ['autoajuste' => false, 'ancho' => 8],
  ],
  'filas' => [
    [['texto'=>'Producto','alineacion'=>'left','negrita'=>true,'subrayado'=>false],
     ['texto'=>'Cant.','alineacion'=>'center','negrita'=>true,'subrayado'=>false],
     ['texto'=>'Precio','alineacion'=>'right','negrita'=>true,'subrayado'=>false]],
    [['texto'=>'Coca-Cola 500ml','alineacion'=>'left','negrita'=>false,'subrayado'=>false],
     ['texto'=>'2','alineacion'=>'center','negrita'=>false,'subrayado'=>false],
     ['texto'=>'$2400','alineacion'=>'right','negrita'=>false,'subrayado'=>false]],
  ],
]);

// ...si hubiera un segundo bloque tabla, solo se agrega otra llamada
// a agregar_bloque_tabla(...) aquí, SIN repetir las funciones auxiliares.

header('Content-Type: application/json');
echo json_encode(['data' => base64_encode($ticket)]);
```

### 9.1 Detalles de integración en `bloquesAPhpCodigo`

1. Antes de recorrer `listaBloques`, chequear `const hayTablas = listaBloques.some(b => b.tipo === 'tabla')`; si es `true`, emitir el bloque completo de funciones auxiliares una sola vez, inmediatamente después de las líneas de inicialización (`$ESC`, `$GS`, `$ticket = ...`).
2. Por cada bloque `tipo:'tabla'` en el loop principal, emitir solo la llamada `agregar_bloque_tabla($ticket, $ESC, $GS, [...])` con sus datos volcados como array PHP literal (mismo criterio de escapado de strings que ya usa `phpEscapeString` para las comillas dobles, aplicado a cada `texto` de celda).
3. **Importante:** después de emitir la llamada, actualizar las variables de tracking del generador (`alineacionActual = 'left'`, `tamanoActual = 'normal'`, `fuenteActual = tabla.fuente === 'B' ? '\\x01' : '\\x00'`, `negritaActual = false`, `subrayadoActual = false`), igual que ya se hace tras cada bloque existente — de lo contrario el siguiente bloque del ticket podría omitir por error un comando de alineación/fuente que en realidad sí necesita reenviarse, o reenviar uno innecesario.
4. Usar `mb_strlen`/`mb_substr` en PHP (no `strlen`/`substr`) porque el ticket puede contener tildes/ñ en UTF-8 y esas funciones son byte-based, no carácter-based — se rompería el cálculo de ancho con cualquier acento.

---

## 10. Ejemplo para el panel "Bloques del ticket"

El array `bloques` (definido alrededor de la línea 1191 de `test-impresora-agente.html`) es el ticket de demostración que se ve precargado en el panel. Agregar ahí una instancia de tabla, por ejemplo insertada después del bloque `TOTAL:` y antes de `GRACIAS`, para que quien pruebe el editor la vea funcionando junto al resto de bloques:

```js
// Tabla — atr: 3 columnas (1 autoajuste + 2 fijas), con bordes básico y encabezado
{
  tipo: 'tabla',
  fuente: 'A',
  columnas: 3,
  bordes: true,
  estiloBorde: 'basico',
  encabezado: true,
  columnasConfig: [
    { autoajuste: true,  ancho: null },
    { autoajuste: false, ancho: 4 },
    { autoajuste: false, ancho: 7 }
  ],
  filas: [
    [ { texto:'Producto',   alineacion:'left',   negrita:true,  subrayado:false },
      { texto:'Cant',       alineacion:'center', negrita:true,  subrayado:false },
      { texto:'Precio',     alineacion:'right',  negrita:true,  subrayado:false } ],
    [ { texto:'Empanada carne', alineacion:'left',   negrita:false, subrayado:false },
      { texto:'3',              alineacion:'center', negrita:false, subrayado:false },
      { texto:'$4500',          alineacion:'right',  negrita:false, subrayado:false } ],
    [ { texto:'Bebida 1.5L',    alineacion:'left',   negrita:false, subrayado:false },
      { texto:'1',              alineacion:'center', negrita:false, subrayado:false },
      { texto:'$2200',          alineacion:'right',  negrita:false, subrayado:false } ]
  ]
},
```

Actualizar también el array de tipos editables en `renderizarListaBloques` (§5.5) para que este bloque muestre el botón ✏ Editar.

---

## 11. Checklist de implementación

- [ ] `<option value="tabla">Tabla</option>` en `#nuevoTipoBloque`
- [ ] `#camposTabla` con: fuente, columnas (1–4), bordes, estiloBorde, encabezado, grilla de columnasConfig, grilla de filas/celdas, botón "+ Agregar fila", indicador de ancho usado/disponible
- [ ] `mostrarCamposDe(tipo)` actualizado
- [ ] Estado `tablaBorrador` + `renderizarTablaBorrador()` + reset en `resetearFormulario()`
- [ ] Funciones compartidas de layout: `anchoColumnasTabla`, `celdaFormateada`, `lineaBordeTabla`, `lineaSeparadorEncabezado`, `lineaFilaTabla` (usadas por bytes, preview y generador PHP-side en JS)
- [ ] Validación de ancho total vs `cplSegunFuente(fuente, anchoPapel)` antes de agregar/guardar (bloqueante, con `log(..., 'error')`)
- [ ] Construcción del objeto `bloque` en el handler de `#btnAgregarBloque`
- [ ] Carga inversa en `cargarBloqueEnFormulario` + inclusión de `'tabla'` en la lista de tipos editables
- [ ] Caso `'tabla'` en `resumenBloque`
- [ ] Caso `'tabla'` en `bloquesABytes` (alineación forzada a `left`, tamaño forzado a `normal`, fuente única)
- [ ] Caso `'tabla'` en `renderizarBloquesDirecto` (reusa las funciones de layout, respeta `.fuente-b`)
- [ ] Caso `'tabla'` en `bloquesAPhpCodigo`: helper PHP emitido una sola vez (`hayTablas`), llamada por instancia, tracking de estado actualizado tras cada llamada
- [ ] Persistencia de `estiloBorde` aunque `bordes=false` (comentar en el código el motivo, siguiendo el estilo de notas ya usado en el archivo)
- [ ] Bloque de ejemplo `tipo:'tabla'` agregado al array `bloques` inicial

---

## 12. Decisiones resueltas con el usuario

Resueltas el 2026-09-02, antes de implementar:

1. **Tope de filas:** máximo razonable **100 filas**, **parametrizable** — se define una constante nombrada en el JS (p. ej. `MAX_FILAS_TABLA = 100`) para cambiarla en un solo punto, nunca un número mágico incrustado.
2. **Confirmación al reducir columnas/filas:** **sin confirmación** — al bajar columnas o quitar una fila con datos, el dato se pierde sin avisar (consistente con el toggle "multilínea" actual).
3. **Bloqueo vs. advertencia por ancho excedido:** **solo advertencia visual** — no se bloquea "Agregar bloque"; se muestra el indicador de ancho usado/disponible (⚠️) y el usuario decide (no se auto-ajusta el ancho salvo en modo autoajuste natural).
4. **Separador entre filas de datos:** **sí, agregar opción** — se añade un checkbox "grilla completa" para dibujar línea horizontal entre todas las filas de datos, además del borde exterior y el separador de encabezado.
5. **Negrita forzada en encabezado:** **respetar lo guardado** — la negrita de la fila 0 depende solo del checkbox de cada celda, sin forzado automático.

> Nota: la opción 4 (grilla completa) añade un campo `grilla` al modelo del bloque; los criterios 1–5 están reflejados en las stories de `specs/epics/e06-tabla/`.

---

**Fin de la especificación.**
