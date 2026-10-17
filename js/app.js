/* ============================================================
   UTILIDADES
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (t, attrs = {}) => { const e = document.createElementNS(SVGNS, t); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const popcount = n => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };
const NOMBRES_PASOS = ['Diagrama', 'Tabla de estados', 'Codificación', 'Tabla de excitación', 'Funciones'];

/* ============================================================
   ESTADO DE LA APLICACIÓN
   ============================================================ */
let EJ = null;        // ejercicio activo
let nBits = 2;        // bits de estado
let VARS = [];        // ['y1','y0','x']
let S = null;         // progreso del usuario
let espacio = 'binary';
const sesiones = {};

function nuevoProgreso() {
  return { paso: 1, desbloqueado: 1, validado: {}, nodos: {}, trans: [], agruparTransiciones: false, tabla: {}, cod: {}, exc: {}, fx: {} };
}

function cargarEjercicio(ej, progreso) {
  EJ = ej;
  nBits = Math.max(1, Math.ceil(Math.log2(EJ.estados.length)));
  VARS = [];
  for (let i = nBits - 1; i >= 0; i--) VARS.push('y' + i);
  VARS.push(...variablesEntrada(EJ));
  S = progreso || nuevoProgreso();
  modo = 'mover'; origenSel = null; trSel = null; pend = null;
  $('#modoMover').setAttribute('aria-pressed', 'true');
  $('#modoConectar').setAttribute('aria-pressed', 'false');
  $('#modoHint').textContent = 'Arrastrá los estados para acomodarlos.';
  $('#connPanel').hidden = true;
  $('#btnBorrarTr').disabled = true;
  $('#resumen').innerHTML = '';
  $('#diagramExportMsg').textContent = '';
  $('#outputField').hidden = EJ.tipo === 'moore';
  $('#btnExample').hidden = espacio !== 'letters';
  $('#simulation').hidden = espacio !== 'letters';
  $('#diagramLead').textContent = EJ.tipo === 'moore'
    ? 'Arrastrá los estados al lienzo y conectalos: elegí origen, destino y letra de entrada. Las flechas muestran entrada/salida; en Moore, la salida corresponde al estado de origen. Cada estado necesita una transición por cada letra.'
    : 'Arrastrá cada estado al lienzo. En modo Conectar elegí origen, destino y etiqueta entrada/salida. Cada estado necesita una transición por cada valor de entrada.';
  $('#ejTitulo').textContent = EJ.titulo;
  $('#ejEnunciado').textContent = EJ.enunciado;
  $('#lead3').textContent = `Hay ${EJ.estados.length} estados, así que hacen falta ${nBits} bits para codificarlos (2^${nBits} = ${2 ** nBits}). Asigná un código binario distinto a cada estado; los pasos siguientes usan el que elijas acá.`;
  construirPaso1(); construirPaso2(); construirPaso3();
  prepararSimulacion();
  irA(S.paso || 1, true);
}

/* ---------- persistencia local (mejor esfuerzo) ---------- */
function guardar() {
  try { localStorage.setItem('csec:' + EJ.id, JSON.stringify({ ej: EJ, s: S })); } catch (e) { }
}
function recuperar(predeterminado = EJ_DEFAULT) {
  try {
    const raw = localStorage.getItem('csec:' + predeterminado.id);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d && d.ej && d.s) return d;
  } catch (e) { }
  return null;
}

/* ============================================================
   DATOS DERIVADOS DEL EJERCICIO
   ============================================================ */
const valoresEntrada = () => EJ.valoresEntrada || ['0', '1'];
const idsEstados = () => EJ.estados.map(e => e.id);
function trEsperada(estado, entrada) {
  return EJ.transiciones.find(t => t.desde === estado && String(t.entrada) === String(entrada));
}
function filasExcitacion() {
  const c2s = {}; Object.entries(S.cod).forEach(([st, c]) => c2s[c] = st);
  const filas = [];
  for (let v = 0; v < (1 << nBits); v++) {
    const code = v.toString(2).padStart(nBits, '0');
    for (const entrada of combinacionesEntrada(EJ)) {
      const { x, bits } = entrada;
      const st = c2s[code];
      let Y = null, sal = null;
      if (st && entrada.valida) { const t = trEsperada(st, x); Y = S.cod[t.hacia]; sal = String(t.salida); }
      filas.push({ idx: v * 2 ** bits.length + parseInt(bits, 2), code, x, bits, st, Y, sal, dc: !st || !entrada.valida });
    }
  }
  return filas;
}

/* ============================================================
   EXPRESIONES BOOLEANAS: tokenizar, parsear, evaluar
   ============================================================ */
function tokenizar(src) {
  const t = []; let i = 0;
  const low = VARS.map(v => v.toLowerCase());
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '+' || c === '|' || c === '∨') { t.push({ k: '+' }); i++; continue; }
    if (c === '*' || c === '·' || c === '&' || c === '.' || c === '∧') { t.push({ k: '*' }); i++; continue; }
    if (c === "'" || c === '’' || c === '`' || c === '´') { t.push({ k: "'" }); i++; continue; }
    if (c === '~' || c === '!' || c === '¬') { t.push({ k: '~' }); i++; continue; }
    if (c === '(' || c === '[') { t.push({ k: '(' }); i++; continue; }
    if (c === ')' || c === ']') { t.push({ k: ')' }); i++; continue; }
    const m = /^[A-Za-z]+\d*/.exec(src.slice(i));
    if (m) {
      const nombre = [...low].sort((a, b) => b.length - a.length).find(v => src.slice(i).toLowerCase().startsWith(v));
      const idx = low.indexOf(nombre);
      if (idx < 0) throw new Error(`No conozco la variable «${m[0]}». Usá ${VARS.join(', ')}.`);
      t.push({ k: 'var', i: idx }); i += nombre.length; continue;
    }
    if (c === '0' || c === '1') { t.push({ k: 'const', v: Number(c) }); i++; continue; }
    throw new Error(`No entiendo el símbolo «${c}».`);
  }
  return t;
}
function parsear(src) {
  const toks = tokenizar(src); let p = 0;
  const peek = () => toks[p];
  function expr() { let n = term(); while (peek() && peek().k === '+') { p++; n = { t: 'or', a: n, b: term() }; } return n; }
  function term() {
    let n = factor();
    for (; ;) {
      const t = peek(); if (!t) break;
      if (t.k === '*') { p++; n = { t: 'and', a: n, b: factor() }; continue; }
      if (t.k === 'var' || t.k === 'const' || t.k === '(' || t.k === '~') { n = { t: 'and', a: n, b: factor() }; continue; }
      break;
    }
    return n;
  }
  function factor() { let n = primary(); while (peek() && peek().k === "'") { p++; n = { t: 'not', a: n }; } return n; }
  function primary() {
    const t = peek();
    if (!t) throw new Error('La expresión queda incompleta.');
    if (t.k === '~') { p++; return { t: 'not', a: factor() }; }
    if (t.k === '(') { p++; const n = expr(); if (!peek() || peek().k !== ')') throw new Error('Falta cerrar un paréntesis.'); p++; return n; }
    if (t.k === 'var') { p++; return { t: 'var', i: t.i }; }
    if (t.k === 'const') { p++; return { t: 'const', v: t.v }; }
    if (t.k === '+') throw new Error('Hay un + sin término a la izquierda o a la derecha.');
    throw new Error('Esperaba una variable y encontré otra cosa.');
  }
  if (!toks.length) throw new Error('Escribí una expresión.');
  const n = expr();
  if (p < toks.length) throw new Error('Sobra algo al final de la expresión.');
  return n;
}
function evaluar(n, env) {
  switch (n.t) {
    case 'var': return env[n.i];
    case 'const': return n.v;
    case 'not': return evaluar(n.a, env) ? 0 : 1;
    case 'and': return (evaluar(n.a, env) && evaluar(n.b, env)) ? 1 : 0;
    case 'or': return (evaluar(n.a, env) || evaluar(n.b, env)) ? 1 : 0;
  }
}
function contarLiterales(n) {
  switch (n.t) {
    case 'var': return 1;
    case 'const': return 0;
    case 'not': return contarLiterales(n.a);
    default: return contarLiterales(n.a) + contarLiterales(n.b);
  }
}
/* mínima suma de productos (Quine–McCluskey + cobertura exhaustiva) */
function costoMinimo(nv, unos, indifs) {
  if (!unos.length) return 0;
  const todos = unos.concat(indifs);
  const clave = p => `${p.mask}|${p.val & p.mask}`;
  const dedup = arr => { const m = new Map(); arr.forEach(p => m.set(clave(p), p)); return [...m.values()]; };
  let actual = dedup(todos.map(m => ({ mask: (1 << nv) - 1, val: m })));
  const primos = [];
  while (actual.length) {
    const usado = new Array(actual.length).fill(false);
    const sig = [];
    for (let i = 0; i < actual.length; i++) for (let j = i + 1; j < actual.length; j++) {
      const a = actual[i], b = actual[j];
      if (a.mask !== b.mask) continue;
      const d = (a.val ^ b.val) & a.mask;
      if (d && (d & (d - 1)) === 0) { usado[i] = usado[j] = true; sig.push({ mask: a.mask & ~d, val: a.val & ~d }); }
    }
    for (let i = 0; i < actual.length; i++) if (!usado[i]) primos.push(actual[i]);
    actual = dedup(sig);
  }
  const pis = dedup(primos).map(p => ({ cost: popcount(p.mask), cov: unos.filter(m => (m & p.mask) === (p.val & p.mask)) }));
  const n = pis.length;
  let best = Infinity;
  if (n <= 18) {
    for (let s = 0; s < (1 << n); s++) {
      let cost = 0;
      for (let i = 0; i < n; i++) if (s & (1 << i)) cost += pis[i].cost;
      if (cost >= best) continue;
      const cov = new Set();
      for (let i = 0; i < n; i++) if (s & (1 << i)) pis[i].cov.forEach(m => cov.add(m));
      if (unos.every(m => cov.has(m))) best = cost;
    }
  } else {
    const pend = new Set(unos); let cost = 0;
    while (pend.size) {
      let mejor = null, score = -1;
      pis.forEach(p => { const g = p.cov.filter(m => pend.has(m)).length / (p.cost || .5); if (g > score) { score = g; mejor = p; } });
      mejor.cov.forEach(m => pend.delete(m)); cost += mejor.cost;
    }
    best = cost;
  }
  return best;
}

/* ============================================================
   PASO 2 — TABLA DE ESTADOS Y SALIDAS
   ============================================================ */
function selEstado(k, campo, valor) {
  const s = document.createElement('select');
  s.dataset.k = k; s.dataset.campo = campo;
  const ops = campo === 'hacia' ? idsEstados() : (EJ.valoresSalida || ['0', '1']);
  s.innerHTML = '<option value="">–</option>' + ops.map(o => `<option${o === valor ? ' selected' : ''}>${o}</option>`).join('');
  s.classList.toggle('vacio', !valor);
  return s;
}
function construirPaso2() {
  const vals = valoresEntrada();
  const t = document.createElement('table'); t.className = 'tbl';
  t.innerHTML = `<thead><tr><th rowspan="2" class="rowhead">Estado actual</th><th colspan="${vals.length}">Entrada ${EJ.entrada}</th></tr><tr>${vals.map(v => `<th>${v}</th>`).join('')}</tr></thead>`;
  const tb = document.createElement('tbody');
  idsEstados().forEach(st => {
    const tr = document.createElement('tr');
    const th = document.createElement('td'); th.className = 'rowhead'; th.textContent = st; tr.appendChild(th);
    vals.forEach(x => {
      const td = document.createElement('td');
      const k = st + '|' + x, cur = S.tabla[k] || {};
      const a = selEstado(k, 'hacia', cur.hacia), b = selEstado(k, 'salida', cur.salida);
      const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '/';
      td.append(a, sep, b); tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  const w = $('#t2'); w.innerHTML = ''; w.appendChild(t);
  w.onchange = e => {
    const s = e.target; if (s.tagName !== 'SELECT') return;
    const k = s.dataset.k; S.tabla[k] = S.tabla[k] || {};
    S.tabla[k][s.dataset.campo] = s.value;
    s.classList.toggle('vacio', !s.value);
    invalidar(2); guardar();
  };
}
function validarPaso2() {
  const errores = []; let vacios = 0;
  $$('#t2 td').forEach(td => td.classList.remove('bad'));
  idsEstados().forEach(st => valoresEntrada().forEach(x => {
    const k = st + '|' + x, v = S.tabla[k] || {}, esp = trEsperada(st, x);
    const celda = $(`#t2 select[data-k="${k}"]`)?.closest('td');
    if (!v.hacia || !v.salida) { vacios++; if (celda) celda.classList.add('bad'); return; }
    if (v.hacia !== esp.hacia || String(v.salida) !== String(esp.salida)) {
      if (celda) celda.classList.add('bad');
      errores.push(`Fila <b>${st}</b>, entrada <b>${x}</b>: no coincide con tu diagrama.`);
    }
  }));
  if (vacios) errores.unshift(`Quedan ${vacios} celdas sin completar.`);
  return { ok: !errores.length, errores, nota: errores.length ? 'Leé cada flecha del diagrama del paso 1: la etiqueta es entrada/salida y la punta indica el estado siguiente.' : '' };
}

/* ============================================================
   PASO 3 — CODIFICACIÓN DE ESTADOS
   ============================================================ */
function construirPaso3() {
  const t = document.createElement('table'); t.className = 'tbl';
  const cab = [];
  for (let i = nBits - 1; i >= 0; i--) cab.push('y' + i);
  t.innerHTML = `<thead><tr><th rowspan="2" class="rowhead">Estado</th><th colspan="${nBits}">Estado binario</th></tr><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
  const tb = document.createElement('tbody');
  idsEstados().forEach(st => {
    const tr = document.createElement('tr');
    const th = document.createElement('td'); th.className = 'rowhead'; th.textContent = st; tr.appendChild(th);
    const code = S.cod[st] || '';
    for (let i = 0; i < nBits; i++) {
      const td = document.createElement('td');
      const s = document.createElement('select');
      s.dataset.st = st; s.dataset.bit = i;
      const v = code[i] || '';
      s.innerHTML = '<option value="">–</option><option' + (v === '0' ? ' selected' : '') + '>0</option><option' + (v === '1' ? ' selected' : '') + '>1</option>';
      s.classList.toggle('vacio', !v);
      td.appendChild(s); tr.appendChild(td);
    }
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  const w = $('#t3'); w.innerHTML = ''; w.appendChild(t);
  w.onchange = e => {
    const s = e.target; if (s.tagName !== 'SELECT') return;
    const st = s.dataset.st, bit = Number(s.dataset.bit);
    const cur = (S.cod[st] || '-'.repeat(nBits)).padEnd(nBits, '-').split('');
    cur[bit] = s.value || '-';
    S.cod[st] = cur.join('');
    s.classList.toggle('vacio', !s.value);
    invalidar(3); guardar();
  };
}
function validarPaso3() {
  const errores = []; const usados = {};
  $$('#t3 td').forEach(td => td.classList.remove('bad'));
  idsEstados().forEach(st => {
    const c = S.cod[st] || '';
    const fila = $(`#t3 select[data-st="${st}"]`)?.closest('tr');
    if (c.length !== nBits || c.includes('-')) {
      errores.push(`El estado <b>${st}</b> está sin codificar.`);
      if (fila) Array.from(fila.children).forEach((td, i) => { if (i) td.classList.add('bad'); });
      return;
    }
    if (usados[c]) {
      errores.push(`<b>${st}</b> y <b>${usados[c]}</b> tienen el mismo código ${c}: cada estado necesita uno distinto.`);
      if (fila) Array.from(fila.children).forEach((td, i) => { if (i) td.classList.add('bad'); });
    } else usados[c] = st;
  });
  if (errores.length) return { ok: false, errores, nota: '' };
  let nota = '';
  const sug = EJ.codificacionSugerida;
  if (EJ.codificacionEstricta && sug) {
    const mal = idsEstados().filter(st => S.cod[st] !== sug[st]);
    if (mal.length) return { ok: false, errores: [`Este ejercicio pide la codificación indicada en el enunciado y no coincide en: ${mal.join(', ')}.`], nota: '' };
  } else if (sug && idsEstados().some(st => S.cod[st] !== sug[st])) {
    nota = 'Es una codificación válida, distinta de la del apunte. Los pasos 4 y 5 se evalúan con la tuya.';
  }
  construirPaso4();
  return { ok: true, errores: [], nota };
}

/* ============================================================
   PASO 4 — TABLA DE EXCITACIÓN
   ============================================================ */
function construirPaso4() {
  const yNames = []; for (let i = nBits - 1; i >= 0; i--) yNames.push('y' + i);
  const YNames = yNames.map(n => n.toUpperCase());
  const filas = filasExcitacion();
  const t = document.createElement('table'); t.className = 'tbl';
  t.innerHTML = `<thead><tr><th colspan="${nBits}">Qₙ</th><th rowspan="2">${variablesEntrada(EJ).join(' ')}</th><th colspan="${nBits}">Qₙ₊₁</th><th rowspan="2">${EJ.salida}</th></tr>
  <tr>${yNames.map(n => `<th>${n}</th>`).join('')}${YNames.map(n => `<th>${n}</th>`).join('')}</tr></thead>`;
  const tb = document.createElement('tbody');
  filas.forEach(f => {
    const tr = document.createElement('tr');
    f.code.split('').forEach(b => { const td = document.createElement('td'); td.className = 'rowhead'; td.textContent = b; tr.appendChild(td); });
    const tdx = document.createElement('td'); tdx.className = 'rowhead'; tdx.textContent = EJ.entradasOneHot ? `${f.bits} (${f.x})` : f.x; tr.appendChild(tdx);
    const campos = [];
    for (let i = nBits - 1; i >= 0; i--) campos.push('Y' + i);
    campos.push('S');
    campos.forEach(c => {
      const td = document.createElement('td');
      if (f.dc) { td.className = 'dc'; td.textContent = 'X'; }
      else {
        const s = document.createElement('select');
        s.dataset.idx = f.idx; s.dataset.c = c;
        const v = (S.exc[f.idx] || {})[c] || '';
        s.innerHTML = '<option value="">–</option><option' + (v === '0' ? ' selected' : '') + '>0</option><option' + (v === '1' ? ' selected' : '') + '>1</option>';
        s.classList.toggle('vacio', !v);
        td.appendChild(s);
      }
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  const w = $('#t4'); w.innerHTML = '';
  if (EJ.entradasOneHot) {
    const nota = document.createElement('p'); nota.className = 'hint';
    nota.textContent = `Orden de entradas: ${variablesEntrada(EJ).join(', ')}. Las combinaciones sin entrada activa o con varias activas son indiferencias (X), fuera del supuesto del ejercicio.`;
    w.appendChild(nota);
  }
  w.appendChild(t);
  w.onchange = e => {
    const s = e.target; if (s.tagName !== 'SELECT') return;
    const i = s.dataset.idx; S.exc[i] = S.exc[i] || {};
    S.exc[i][s.dataset.c] = s.value;
    s.classList.toggle('vacio', !s.value);
    invalidar(4); guardar();
  };
  // recap
  const body = $('#recap4body'); body.innerHTML = '';
  body.appendChild(tablaEstadosRO());
  body.appendChild(tablaCodRO());
}
function tablaEstadosRO() {
  const vals = valoresEntrada();
  const t = document.createElement('table'); t.className = 'tbl ro';
  t.innerHTML = `<thead><tr><th rowspan="2" class="rowhead">Estado</th><th colspan="${vals.length}">Entrada ${EJ.entrada}</th></tr><tr>${vals.map(v => `<th>${v}</th>`).join('')}</tr></thead><tbody>${idsEstados().map(st => `<tr><td class="rowhead">${st}</td>${vals.map(x => { const e = trEsperada(st, x); return `<td>${e.hacia} / ${e.salida}</td>`; }).join('')}</tr>`).join('')}</tbody>`;
  const w = document.createElement('div'); w.className = 'tw'; w.appendChild(t); return w;
}
function tablaCodRO() {
  const t = document.createElement('table'); t.className = 'tbl ro';
  t.innerHTML = `<thead><tr><th class="rowhead">Estado</th><th>código</th></tr></thead><tbody>${idsEstados().map(st => `<tr><td class="rowhead">${st}</td><td>${S.cod[st]}</td></tr>`).join('')}</tbody>`;
  const w = document.createElement('div'); w.className = 'tw'; w.appendChild(t); return w;
}
function validarPaso4() {
  const errores = []; let vacios = 0;
  $$('#t4 td').forEach(td => td.classList.remove('bad'));
  filasExcitacion().forEach(f => {
    if (f.dc) return;
    const v = S.exc[f.idx] || {};
    const campos = []; for (let i = nBits - 1; i >= 0; i--) campos.push('Y' + i); campos.push('S');
    campos.forEach(c => {
      const esperado = c === 'S' ? f.sal : f.Y[nBits - 1 - Number(c.slice(1))];
      const sel = $(`#t4 select[data-idx="${f.idx}"][data-c="${c}"]`);
      const td = sel?.closest('td');
      if (!v[c]) { vacios++; if (td) td.classList.add('bad'); return; }
      if (v[c] !== String(esperado)) {
        if (td) td.classList.add('bad');
        errores.push(`Fila ${f.code}${f.x} (estado ${f.st}), columna <b>${c}</b>: no coincide con tu tabla del paso 2.`);
      }
    });
  });
  if (vacios) errores.unshift(`Quedan ${vacios} celdas sin completar.`);
  if (!errores.length) construirPaso5();
  return { ok: !errores.length, errores: errores.slice(0, 8), nota: errores.length ? 'Cada fila es un estado actual: buscá qué estado tiene ese código, miralo en la tabla del paso 2 y codificá el estado siguiente.' : '' };
}

/* ============================================================
   PASO 5 — FUNCIONES BOOLEANAS
   ============================================================ */
function columnasObjetivo() {
  const filas = filasExcitacion();
  const cols = [];
  for (let i = nBits - 1; i >= 0; i--) {
    const nombre = 'Y' + i;
    cols.push({ campo: nombre, fn: 'f' + i, vals: filas.map(f => f.dc ? 'X' : f.Y[nBits - 1 - i]) });
  }
  cols.push({ campo: EJ.salida, fn: EJ.salida, vals: filas.map(f => f.dc ? 'X' : String(f.sal)) });
  return cols;
}
function construirPaso5() {
  const cont = $('#fns'); cont.innerHTML = '';
  const args = VARS.join(', ');
  columnasObjetivo().forEach(c => {
    const row = document.createElement('div'); row.className = 'fn-row';
    const lbl = document.createElement('span'); lbl.className = 'fn-lbl';
    lbl.innerHTML = `${c.fn}(${args}) &nbsp;=`;
    const inp = document.createElement('input'); inp.type = 'text'; inp.id = 'fn-' + c.fn;
    inp.value = S.fx[c.fn] || ''; inp.placeholder = `expresión para la columna ${c.campo}`;
    inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.addEventListener('input', () => { S.fx[c.fn] = inp.value; inp.classList.remove('bad', 'good'); invalidar(5); guardar(); });
    row.append(lbl, inp); cont.appendChild(row);
    const note = document.createElement('div'); note.className = 'fn-note';
    note.textContent = `columna ${c.campo}: ${c.vals.join(' ')}`;
    cont.appendChild(note);
    const kp = document.createElement('div'); kp.className = 'keypad';
    [...VARS, "'", '+', '(', ')', '0', '1'].forEach(tk => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = tk;
      b.onclick = () => {
        const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a;
        inp.value = inp.value.slice(0, a) + tk + inp.value.slice(z);
        inp.focus(); inp.setSelectionRange(a + tk.length, a + tk.length);
        S.fx[c.fn] = inp.value; inp.classList.remove('bad', 'good'); invalidar(5); guardar();
      };
      kp.appendChild(b);
    });
    cont.appendChild(kp);
  });
  const body = $('#recap5body'); body.innerHTML = ''; body.appendChild(tablaExcRO());
}
function tablaExcRO() {
  const yNames = []; for (let i = nBits - 1; i >= 0; i--) yNames.push('y' + i);
  const filas = filasExcitacion();
  const t = document.createElement('table'); t.className = 'tbl ro';
  t.innerHTML = `<thead><tr>${yNames.map(n => `<th>${n}</th>`).join('')}<th>${variablesEntrada(EJ).join(' ')}</th>${yNames.map(n => `<th>${n.toUpperCase()}</th>`).join('')}<th>${EJ.salida}</th></tr></thead><tbody>${filas.map(f => `<tr>${f.code.split('').map(b => `<td class="rowhead">${b}</td>`).join('')}<td class="rowhead">${EJ.entradasOneHot ? f.bits : f.x}</td>${f.dc ? yNames.map(() => '<td class="dc">X</td>').join('') + '<td class="dc">X</td>' : f.Y.split('').map(b => `<td>${b}</td>`).join('') + `<td>${f.sal}</td>`}</tr>`).join('')}</tbody>`;
  const w = document.createElement('div'); w.className = 'tw'; w.appendChild(t); return w;
}
function validarPaso5() {
  const errores = []; const nv = VARS.length; const filas = filasExcitacion();
  $('#resumen').innerHTML = '';
  columnasObjetivo().forEach(c => {
    const inp = $('#fn-' + c.fn); inp.classList.remove('bad', 'good');
    const src = (S.fx[c.fn] || '').trim();
    if (!src) { errores.push(`Falta la expresión de <b>${c.fn}</b>.`); inp.classList.add('bad'); return; }
    let ast;
    try { ast = parsear(src); } catch (err) { errores.push(`<b>${c.fn}</b>: ${err.message}`); inp.classList.add('bad'); return; }
    const unos = [], indifs = [], fallos = [];
    filas.forEach((f, i) => {
      const esperado = c.vals[i];
      const env = [];
      for (let b = 0; b < nBits; b++) env.push(Number(f.code[b]));
      env.push(...[...f.bits].map(Number));
      const got = evaluar(ast, env);
      if (esperado === 'X') { indifs.push(f.idx); return; }
      if (esperado === '1') unos.push(f.idx);
      if (got !== Number(esperado)) fallos.push(`${f.code}${f.x}`);
    });
    if (fallos.length) {
      inp.classList.add('bad');
      errores.push(`<b>${c.fn}</b>: no coincide con la columna ${c.campo} en ${fallos.length} fila(s): ${fallos.slice(0, 4).join(', ')}${fallos.length > 4 ? '…' : ''}.`);
      return;
    }
    const min = costoMinimo(nv, unos, indifs), usados = contarLiterales(ast);
    if (usados > min) {
      inp.classList.add('bad');
      errores.push(`<b>${c.fn}</b>: la función es correcta pero no está simplificada al máximo (usás ${usados} literales y alcanza con ${min}).`);
      return;
    }
    inp.classList.add('good');
  });
  if (!errores.length) mostrarResumen();
  return { ok: !errores.length, errores, nota: errores.length ? 'Agrupá los términos que comparten literales y aplicá complemento (a + a\' = 1) para eliminar variables.' : '' };
}
function mostrarResumen() {
  const d = $('#resumen');
  const args = VARS.join(', ');
  d.innerHTML = `<div class="resumen"><h3>Diseño completo</h3>
    ${columnasObjetivo().map(c => `<p>${c.fn}(${args}) = ${(S.fx[c.fn] || '').trim()}</p>`).join('')}
    <p style="font-family:var(--f-body);font-size:.85rem;color:var(--muted);margin-top:9px">Usá ${nBits} biestables D con reloj común y reset al código ${S.cod[EJ.estados.find(e => e.inicial)?.id] || 'inicial'}. Cada función fᵢ alimenta Dᵢ; las salidas Qᵢ se realimentan como yᵢ. ${EJ.tipo === 'moore' ? 'La salida depende del estado actual, no de la letra del próximo pulso.' : ''}</p></div>`;
  const cont = document.createElement('div'); cont.className = 'tw';
  const svg = svgEl('svg', { viewBox: '0 0 760 270', class: 'circuit', role: 'img', 'aria-label': 'Circuito secuencial con lógica combinacional, biestables D y realimentación' });
  const caja = (x, y, w, h, texto) => {
    svg.appendChild(svgEl('rect', { x, y, width: w, height: h, rx: 8, fill: 'var(--surface)', stroke: 'var(--wire)' }));
    const t = svgEl('text', { x: x + w / 2, y: y + h / 2, fill: 'var(--fg)', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 14 }); t.textContent = texto; svg.appendChild(t);
  };
  const linea = d => svg.appendChild(svgEl('path', { d, fill: 'none', stroke: 'var(--wire)', 'stroke-width': 2 }));
  caja(10, 75, 110, 50, variablesEntrada(EJ).join(', '));
  caja(160, 50, 220, 110, 'Lógica: fᵢ → Dᵢ');
  caja(440, 50, 170, 110, `${nBits} biestables D → Qᵢ`);
  caja(160, 205, 220, 45, `Salida ${EJ.salida}: ecuación indicada arriba`);
  linea('M120 100 H160 M380 100 H440 M610 100 H680 V180 H140 V130 H160 M680 180 V227 H380 M525 200 V160');
  if (EJ.tipo !== 'moore') linea('M125 100 V227 H160');
  const clk = svgEl('text', { x: 480, y: 220, fill: 'var(--fg)', 'font-size': 13 }); clk.textContent = 'CLK / reset'; svg.appendChild(clk);
  cont.appendChild(svg); d.appendChild(cont);
}

/* ============================================================
   NAVEGACIÓN Y COMPROBACIÓN
   ============================================================ */
const VALIDADORES = { 1: validarPaso1, 2: validarPaso2, 3: validarPaso3, 4: validarPaso4, 5: validarPaso5 };

function invalidar(p) {
  $('#resumen').innerHTML = '';
  if (p === 1) $('#diagramExportMsg').textContent = '';
  for (let i = p; i <= 5; i++) S.validado[i] = false;
  S.desbloqueado = Math.min(S.desbloqueado, p);
  $('#btnNext').disabled = true;
  pintarRail();
}
function pintarRail() {
  const r = $('#rail'); r.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.className = 'step-chip';
    b.dataset.st = i === S.paso ? 'actual' : (S.validado[i] ? 'ok' : (i <= S.desbloqueado ? 'libre' : 'bloq'));
    b.innerHTML = `<span class="n">${S.validado[i] && i !== S.paso ? '✓' : i}</span><span class="nm">${NOMBRES_PASOS[i - 1]}</span>`;
    b.disabled = i > S.desbloqueado;
    b.onclick = () => irA(i);
    r.appendChild(b);
  }
}
function irA(p, silencioso) {
  if (p > S.desbloqueado) return;
  S.paso = p;
  for (let i = 1; i <= 5; i++) $('#p' + i).hidden = i !== p;
  if (p === 2) construirPaso2();
  if (p === 4 && S.validado[3]) construirPaso4();
  if (p === 5 && S.validado[4]) {
    construirPaso5();
    if (S.validado[5]) mostrarResumen();
  }
  $('#btnPrev').disabled = p === 1;
  $('#btnNext').disabled = !(S.validado[p] && p < 5);
  if (!silencioso) feedback(null);
  else feedback(S.validado[p] ? { ok: true, errores: [], nota: '' } : null);
  pintarRail(); guardar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function feedback(res) {
  const fb = $('#fb');
  fb.className = 'fb';
  if (!res) { fb.innerHTML = 'Completá el paso y tocá <b>Comprobar</b>.'; return; }
  if (res.ok) {
    fb.classList.add('ok');
    fb.innerHTML = `<strong>Paso ${S.paso} correcto.</strong> ${res.nota || (S.paso < 5 ? 'Podés avanzar al siguiente paso.' : 'Terminaste el diseño: mirá el resumen con las ecuaciones.')}`;
  } else {
    fb.classList.add('err');
    fb.innerHTML = `<strong>Todavía no.</strong><ul>${res.errores.slice(0, 6).map(e => `<li>${e}</li>`).join('')}</ul>${res.errores.length > 6 ? `<div style="margin-top:4px">…y ${res.errores.length - 6} más.</div>` : ''}${res.nota ? `<div style="margin-top:5px;color:var(--muted)">${res.nota}</div>` : ''}`;
  }
}
function comprobar() {
  const res = VALIDADORES[S.paso]();
  S.validado[S.paso] = res.ok;
  if (res.ok) S.desbloqueado = Math.max(S.desbloqueado, Math.min(5, S.paso + 1));
  $('#btnNext').disabled = !(res.ok && S.paso < 5);
  feedback(res); pintarRail(); guardar();
}

/* ============================================================
   EVENTOS GLOBALES
   ============================================================ */
$('#btnCheck').onclick = comprobar;
$('#btnExportPng').onclick = () => exportarDiagrama(false);
$('#btnCopyDiagram').onclick = () => exportarDiagrama(true);
$('#btnNext').onclick = () => irA(Math.min(5, S.paso + 1));
$('#btnPrev').onclick = () => irA(Math.max(1, S.paso - 1));
$('#modoMover').onclick = () => { modo = 'mover'; origenSel = null; $('#modoMover').setAttribute('aria-pressed', 'true'); $('#modoConectar').setAttribute('aria-pressed', 'false'); $('#modoHint').textContent = 'Arrastrá los estados para acomodarlos.'; $('#connPanel').hidden = true; pintarDiagrama(); };
$('#modoConectar').onclick = () => { modo = 'conectar'; origenSel = null; $('#modoConectar').setAttribute('aria-pressed', 'true'); $('#modoMover').setAttribute('aria-pressed', 'false'); $('#modoHint').textContent = 'Tocá el estado de origen y después el de destino.'; pintarDiagrama(); };
$('#btnAddTr').onclick = () => {
  if (!pend) return;
  S.trans.push({ desde: pend.desde, hacia: pend.hacia, entrada: pend.entrada, salida: pend.salida });
  pend = null; $('#connPanel').hidden = true; trSel = null; $('#btnBorrarTr').disabled = true;
  invalidar(1); pintarDiagrama(); guardar();
};
$('#btnCancelTr').onclick = () => { pend = null; $('#connPanel').hidden = true; };
$('#btnBorrarTr').onclick = () => {
  if (trSel === null) return;
  const grupo = transicionesVisibles(S.trans, S.agruparTransiciones).find(t => t.indices.includes(trSel));
  eliminarTransiciones(grupo.indices);
};
$('#groupTransitions').onchange = e => {
  S.agruparTransiciones = e.target.checked;
  trSel = null; $('#btnBorrarTr').disabled = true;
  pintarDiagrama(); guardar();
};
$('#btnLimpiar').onclick = () => { S.nodos = {}; S.trans = []; trSel = null; origenSel = null; $('#btnBorrarTr').disabled = true; invalidar(1); pintarDiagrama(); guardar(); };
$('#svg').addEventListener('pointerdown', () => { if (trSel !== null) { trSel = null; $('#btnBorrarTr').disabled = true; pintarDiagrama(); } if (origenSel) { origenSel = null; pintarDiagrama(); } });
$('#btnReset').onclick = () => { S = nuevoProgreso(); trSel = null; origenSel = null; cargarEjercicio(EJ, S); feedback(null); guardar(); };

/* ---------- diálogo JSON ---------- */
$('#btnJson').onclick = () => { $('#jsonArea').value = JSON.stringify(EJ, null, 2); $('#jsonMsg').textContent = ''; $('#dlg').showModal(); };
$('#btnCerrar').onclick = () => $('#dlg').close();
$('#btnCopiar').onclick = async () => {
  try { await navigator.clipboard.writeText($('#jsonArea').value); $('#jsonMsg').textContent = 'JSON copiado.'; }
  catch (e) { $('#jsonArea').select(); $('#jsonMsg').textContent = 'Texto seleccionado: copialo con tu teclado.'; }
};
$('#fileJson').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const fr = new FileReader();
  fr.onload = () => { $('#jsonArea').value = fr.result; $('#jsonMsg').textContent = 'Archivo cargado. Tocá «Aplicar JSON».'; };
  fr.readAsText(f);
};
$('#btnAplicar').onclick = () => {
  let d;
  try { d = JSON.parse($('#jsonArea').value); } catch (err) { $('#jsonMsg').textContent = 'JSON inválido: ' + err.message; return; }
  const problema = validarEjercicio(d);
  if (problema) { $('#jsonMsg').textContent = problema; return; }
  cargarEjercicio(d, nuevoProgreso());
  feedback(null); guardar();
  $('#dlg').close();
};
function validarEjercicio(d) {
  if (!d || typeof d !== 'object') return 'El JSON debe ser un objeto.';
  if (!Array.isArray(d.estados) || d.estados.length < 2) return 'Falta la lista «estados» con al menos dos estados.';
  if (!Array.isArray(d.transiciones)) return 'Falta la lista «transiciones».';
  if (!d.entrada || !d.salida) return 'Faltan los nombres de «entrada» y «salida».';
  if (d.entradasOneHot) {
    try {
      crearEjercicioLetras((d.valoresEntrada || []).join(' '), d.secuencia || '');
    } catch (err) { return err.message; }
    if (d.tipo !== 'moore' || d.estados.some(e => !['0', '1'].includes(e.salida))) return 'Las entradas por letras requieren estados Moore con salida 0 o 1.';
  } else if (JSON.stringify(d.valoresEntrada || ['0', '1']) !== '["0","1"]') {
    return 'Para entradas no binarias usá el creador de letras (entradasOneHot).';
  }
  const ids = d.estados.map(e => e.id);
  const vals = d.valoresEntrada || ['0', '1'];
  for (const st of ids) for (const x of vals) {
    const t = d.transiciones.filter(t => t.desde === st && String(t.entrada) === String(x));
    if (t.length !== 1) return `Debe haber exactamente una transición desde ${st} con entrada ${x} (hay ${t.length}).`;
    if (!ids.includes(t[0].hacia)) return `La transición desde ${st} con entrada ${x} apunta a un estado inexistente.`;
    if (d.tipo === 'moore' && String(t[0].salida) !== d.estados.find(e => e.id === st).salida) return `La salida Moore desde ${st} debe coincidir con la salida del estado.`;
  }
  if (!d.id) d.id = 'ejercicio';
  if (!d.titulo) d.titulo = 'Ejercicio';
  if (!d.enunciado) d.enunciado = '';
  return null;
}

/* ---------- espacios y simulación del editor compartido ---------- */
function cambiarEspacio(destino) {
  guardar();
  sesiones[espacio] = { ej: EJ, s: S };
  espacio = destino;
  $('#spaceBinary').setAttribute('aria-pressed', destino === 'binary' ? 'true' : 'false');
  $('#spaceLetters').setAttribute('aria-pressed', destino === 'letters' ? 'true' : 'false');
  $('#sequenceSetup').hidden = destino !== 'letters';
  const defecto = destino === 'letters' ? EJ_LETRAS : EJ_DEFAULT;
  const previo = sesiones[destino] || recuperar(defecto);
  cargarEjercicio(previo ? previo.ej : defecto, previo ? previo.s : nuevoProgreso());
  if (destino === 'letters' && EJ.entradasOneHot) {
    $('#alphabet').value = EJ.valoresEntrada.join(' ');
    $('#sequence').value = EJ.secuencia;
  }
}
$('#spaceBinary').onclick = () => cambiarEspacio('binary');
$('#spaceLetters').onclick = () => cambiarEspacio('letters');
$('#sequenceForm').onsubmit = e => {
  e.preventDefault();
  let ejercicio;
  try { ejercicio = crearEjercicioLetras($('#alphabet').value, $('#sequence').value); }
  catch (err) { $('#sequenceMsg').textContent = err.message; return; }
  cargarEjercicio(ejercicio, nuevoProgreso());
  $('#sequenceMsg').textContent = 'Ejercicio creado. Armá el diagrama o abrí el resuelto para estudiarlo.';
};
$('#btnExample').onclick = () => {
  S.nodos = Object.fromEntries(EJ.estados.map((e, i) => [e.id, {
    x: 90 + (i % 4) * 205, y: i < 4 ? 145 : 325
  }]));
  S.trans = EJ.transiciones.map(t => ({ ...t }));
  trSel = null; origenSel = null; pend = null;
  $('#connPanel').hidden = true; $('#btnBorrarTr').disabled = true;
  invalidar(1); pintarDiagrama(); prepararSimulacion(); guardar();
  feedback(null);
  $('#fb').textContent = 'Diagrama resuelto cargado para estudiar. Tocá Comprobar para habilitar la tabla.';
};
let estadoSimulado = null;
let historialSimulado = '';
function prepararSimulacion() {
  estadoSimulado = EJ.estados.find(e => e.inicial)?.id || EJ.estados[0].id;
  historialSimulado = '';
  const cont = $('#simulationInputs'); cont.innerHTML = '';
  valoresEntrada().forEach(letra => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = letra;
    b.onclick = () => {
      const incompleto = EJ.estados.some(e => !S.nodos[e.id] || valoresEntrada().some(x => S.trans.filter(t => t.desde === e.id && t.entrada === x).length !== 1));
      if (incompleto) { $('#simulationResult').textContent = 'Completá el diagrama: debe haber exactamente una transición por letra y estado.'; return; }
      const t = S.trans.find(t => t.desde === estadoSimulado && t.entrada === letra);
      estadoSimulado = t.hacia; historialSimulado += letra;
      pintarSimulacion(EJ.tipo === 'moore' ? undefined : t.salida);
    };
    cont.appendChild(b);
  });
  pintarSimulacion();
}
function pintarSimulacion(salida) {
  const estado = EJ.estados.find(e => e.id === estadoSimulado);
  $('#simulationResult').textContent = `Entrada: ${historialSimulado || '—'} · Estado: ${estadoSimulado} · ${EJ.salida} = ${salida ?? estado.salida ?? '0'}`;
}
$('#simulationReset').onclick = prepararSimulacion;

/* ---------- arranque ---------- */
const prev = recuperar();
if (prev) cargarEjercicio(prev.ej, prev.s);
else cargarEjercicio(JSON.parse(JSON.stringify(EJ_DEFAULT)), nuevoProgreso());
feedback(S.validado[S.paso] ? { ok: true, errores: [], nota: '' } : null);
