const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function contexto() {
  const context = vm.createContext({});
  const root = join(__dirname, '..', 'js');
  vm.runInContext(readFileSync(join(root, 'exercises.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(root, 'diagram-editor.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(root, 'diagram-export.js'), 'utf8'), context);
  const app = readFileSync(join(root, 'app.js'), 'utf8');
  // Pure calculations are tested without executing the browser event bindings.
  const bindings = app.indexOf('const VALIDADORES');
  assert.ok(bindings > 0, 'Expected calculation section before UI bindings');
  vm.runInContext(app.slice(0, bindings), context);
  return context;
}

test('acd requires consecutive letters and preserves useful prefixes', () => {
  const c = contexto();
  const run = text => vm.runInContext(`(() => {
    const ej = EJ_LETRAS;
    let estado = 'S0';
    return [...${JSON.stringify(text)}].map(x => {
      estado = ej.transiciones.find(t => t.desde === estado && t.entrada === x).hacia;
      return ej.estados.find(e => e.id === estado).salida;
    }).join('');
  })()`, c);
  assert.equal(run('acd'), '001');
  assert.equal(run('abcd'), '0000');
  assert.equal(run('aacd'), '0001');
  assert.equal(run('acdd'), '0010');
  assert.equal(run('acdacd'), '001001');
});

test('overlapping sequence aba recognizes both matches in ababa', () => {
  const c = contexto();
  assert.equal(vm.runInContext(`(() => {
    const ej = crearEjercicioLetras('a b', 'aba');
    let estado = 'S0';
    return [...'ababa'].map(x => {
      estado = ej.transiciones.find(t => t.desde === estado && t.entrada === x).hacia;
      return ej.estados.find(e => e.id === estado).salida;
    }).join('');
  })()`, c), '00101');
});

test('one-hot rows have unique indices, valid environments and invalid-input dont-cares', () => {
  const c = contexto();
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    EJ = EJ_LETRAS; nBits = 2; S = nuevoProgreso();
    S.cod = { S0: '00', S1: '01', S2: '10', S3: '11' };
    const filas = filasExcitacion();
    return { total: filas.length, indices: filas.map(f => f.idx),
      validas: filas.filter(f => !f.dc).length,
      ejemplos: filas.filter(f => f.code === '10' && !f.dc),
      invalidas: filas.filter(f => f.dc).length };
  })())`, c));
  assert.equal(result.total, 64);
  assert.equal(new Set(result.indices).size, 64);
  assert.equal(result.validas, 16);
  assert.equal(result.invalidas, 48);
  const d = result.ejemplos.find(f => f.x === 'd');
  assert.equal(d.bits, '0001');
  assert.equal(d.Y, '11');
  assert.equal(d.sal, '0'); // Moore output before the clock edge.
});

test('binary detector retains its original eight excitation rows', () => {
  const c = contexto();
  const rows = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    EJ = EJ_DEFAULT; nBits = 2; S = nuevoProgreso();
    S.cod = EJ.codificacionSugerida;
    return filasExcitacion();
  })())`, c));
  assert.deepEqual(rows.map(f => f.idx), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(rows[5].Y, '11');
  assert.equal(rows[5].sal, '1');
  assert.ok(rows.every(f => !f.dc));
});

test('generated machines have a total deterministic transition function and Moore output', () => {
  const c = contexto();
  assert.equal(vm.runInContext(`['a', 'aaa', 'aba', 'abab', 'abacada'].every(text => {
    const ej = crearEjercicioLetras('a b c d', text);
    return ej.estados.every(e => ej.valoresEntrada.every(x => {
      const ts = ej.transiciones.filter(t => t.desde === e.id && t.entrada === x);
      return ts.length === 1 && ts[0].salida === e.salida && ej.estados.some(s => s.id === ts[0].hacia);
    }));
  })`, c), true);
});

test('invalid alphabets and sequences are rejected with explicit errors', () => {
  const c = contexto();
  for (const [alphabet, text] of [['a a', 'a'], ['a', 'a'], ['a b c d e', 'abc'], ['aa b', 'ab'], ['a b', 'ac'], ['a b', ''], ['a b', 'aaaaaaaa']]) {
    assert.throws(() => vm.runInContext(`crearEjercicioLetras(${JSON.stringify(alphabet)}, ${JSON.stringify(text)})`, c));
  }
  assert.equal(vm.runInContext("crearEjercicioLetras('A B C D', ' A C D ').secuencia", c), 'acd');
});

test('boolean expressions accept implicit products of letter and state variables', () => {
  const c = contexto();
  assert.equal(vm.runInContext(`(() => {
    VARS = ['y1', 'y0', 'a', 'b', 'c', 'd'];
    return evaluar(parsear("y1'y0a + cd"), [0, 1, 1, 0, 0, 0]);
  })()`, c), 1);
  assert.throws(() => vm.runInContext('parsear("q")', c));
});

test('simplification agrees with one-hot excitation columns for acd', () => {
  const c = contexto();
  assert.equal(vm.runInContext(`(() => {
    EJ = EJ_LETRAS; nBits = 2; S = nuevoProgreso();
    S.cod = { S0: '00', S1: '01', S2: '10', S3: '11' };
    VARS = ['y1', 'y0', 'a', 'b', 'c', 'd'];
    const filas = filasExcitacion();
    const formulas = ["y1'y0c + y1y0'd", "a + y1y0'd", "y1y0"];
    return columnasObjetivo().every((col, i) => {
      const ast = parsear(formulas[i]);
      const unos = [], indifs = [];
      filas.forEach((f, j) => {
        if (f.dc) indifs.push(f.idx);
        else if (col.vals[j] === '1') unos.push(f.idx);
      });

      return filas.every((f, j) => f.dc || evaluar(ast, [...f.code, ...f.bits].map(Number)) === Number(col.vals[j]))
        && costoMinimo(VARS.length, unos, indifs) === contarLiterales(ast);
    });
  })()`, c), true);
});

test('grouped arrows merge only matching source, destination and output without changing transitions', () => {
  const c = contexto();
  const result = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const trans = [
      { desde: 'A', hacia: 'B', entrada: 'c', salida: '0' },
      { desde: 'A', hacia: 'B', entrada: 'a', salida: '0' },
      { desde: 'A', hacia: 'B', entrada: 'b', salida: '0' },
      { desde: 'A', hacia: 'B', entrada: 'd', salida: '1' },
      { desde: 'A', hacia: 'A', entrada: 'a', salida: '0' },
      { desde: 'B', hacia: 'A', entrada: 'b', salida: '0' },
      { desde: 'A', hacia: 'A', entrada: 'c', salida: '0', _mal: true },
      { desde: 'A', hacia: 'A', entrada: 'd', salida: '1' }
    ];
    const antes = JSON.stringify(trans);
    return { agrupadas: transicionesVisibles(trans, true),
      individuales: transicionesVisibles(trans, false), sinCambios: antes === JSON.stringify(trans) };
  })())`, c));
  assert.equal(result.sinCambios, true);
  assert.equal(result.agrupadas.length, 5);
  assert.equal(result.agrupadas[0].etiqueta, 'abc/0');
  assert.deepEqual(result.agrupadas[0].indices, [0, 1, 2]);
  assert.equal(result.agrupadas[1].etiqueta, 'd/1');
  assert.equal(result.agrupadas[2].etiqueta, 'ac/0');
  assert.equal(result.agrupadas[4].etiqueta, 'd/1');
  assert.equal(result.individuales.length, 8);
  assert.equal(result.individuales[0].etiqueta, 'c/0');
  assert.deepEqual(result.individuales.map(t => t.indices.length), Array(8).fill(1));
});

test('grouping preserves duplicates for deterministic validation and handles empty diagrams', () => {
  const c = contexto();
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    vacio: transicionesVisibles([], true),
    duplicadas: transicionesVisibles([
      { desde: 'A', hacia: 'A', entrada: 'a', salida: '0' },
      { desde: 'A', hacia: 'A', entrada: 'a', salida: '0' }
    ], true)
  })`, c));
  assert.deepEqual(result.vacio, []);
  assert.equal(result.duplicadas[0].etiqueta, 'aa/0');
  assert.deepEqual(result.duplicadas[0].indices, [0, 1]);
});

test('image export requires an explicitly successful diagram check, not completion of other steps', () => {
  const c = contexto();
  for (const validado of [{}, { 1: false }, { 2: true, 5: true }, { 1: 'true' }]) {
    const message = vm.runInContext(`motivoBloqueoExportacion({ validado: ${JSON.stringify(validado)} })`, c);
    assert.match(message, /No se hace la captura/);
    assert.match(message, /Comprobar/);
  }
  assert.equal(vm.runInContext('motivoBloqueoExportacion({validado: {1: true}})', c), '');
});

test('download and copy do not prepare or rasterize an unchecked or incorrect diagram', async () => {
  const c = contexto();
  await vm.runInContext(`(async () => {
    globalThis.exportMessage = { textContent: '' };
    globalThis.document = { querySelector: () => exportMessage };
    globalThis.captureCalls = 0;
    prepararImagenDiagrama = () => { captureCalls++; throw new Error('Capture must not run'); };
    crearPngDiagrama = () => { captureCalls++; throw new Error('Rasterization must not run'); };
    for (const validado of [{}, { 1: false }]) {
      S = { validado };
      await exportarDiagrama(false);
      await exportarDiagrama(true);
    }
  })()`, c);
  assert.equal(vm.runInContext('captureCalls', c), 0);
  assert.match(vm.runInContext('exportMessage.textContent', c), /No se hace la captura/);
});
