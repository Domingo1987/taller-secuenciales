/* ============================================================
   PASO 1 — DIAGRAMA DE ESTADOS
   ============================================================ */
let modo = 'mover', origenSel = null, trSel = null, pend = null;
const R = 30;

function construirPaso1() {
  $('#groupTransitions').checked = !!S.agruparTransiciones;
  const g = $('#gGrid'); g.innerHTML = '';
  for (let x = 40; x < 820; x += 40) g.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: 430 }));
  for (let y = 40; y < 430; y += 40) g.appendChild(svgEl('line', { x1: 0, y1: y, x2: 820, y2: y }));
  const pal = $('#paleta'); pal.innerHTML = '';
  EJ.estados.forEach(e => {
    const d = document.createElement('div');
    d.className = 'chip-estado'; d.dataset.id = e.id;
    d.innerHTML = `<span class="ball">${e.id}</span><span><b>${e.id}</b>${e.inicial ? ' · inicial' : ''}<small>${e.descripcion || ''}</small></span>`;
    pal.appendChild(d);
    d.addEventListener('pointerdown', ev => iniciarArrastrePaleta(ev, e.id, d));
  });
  const mkSeg = (cont, vals, cb) => {
    cont.innerHTML = '';
    vals.forEach((v, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = v;
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.onclick = () => { Array.from(cont.children).forEach(c => c.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); cb(v); };
      cont.appendChild(b);
    });
  };
  mkSeg($('#segEnt'), valoresEntrada(), v => pend.entrada = v);
  mkSeg($('#segSal'), EJ.valoresSalida || ['0', '1'], v => pend.salida = v);
  pintarDiagrama();
}

function puntoSVG(clientX, clientY) {
  const r = $('#svg').getBoundingClientRect();
  return { x: (clientX - r.left) * 820 / r.width, y: (clientY - r.top) * 430 / r.height, dentro: clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom };
}

function iniciarArrastrePaleta(ev, id, chip) {
  if (S.nodos[id]) return;
  ev.preventDefault();
  const gh = document.createElement('div');
  gh.className = 'drag-ghost'; gh.textContent = id;
  gh.style.left = ev.clientX + 'px'; gh.style.top = ev.clientY + 'px';
  document.body.appendChild(gh);
  const mv = e => { gh.style.left = e.clientX + 'px'; gh.style.top = e.clientY + 'px'; };
  const up = e => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    gh.remove();
    const p = puntoSVG(e.clientX, e.clientY);
    if (p.dentro) {
      S.nodos[id] = { x: Math.min(790, Math.max(30, p.x)), y: Math.min(400, Math.max(30, p.y)) };
      invalidar(1); pintarDiagrama(); guardar();
    }
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}

function pintarDiagrama() {
  $$('#paleta .chip-estado').forEach(c => c.classList.toggle('puesto', !!S.nodos[c.dataset.id]));
  const faltan = idsEstados().filter(i => !S.nodos[i]).length;
  $('#paletaHint').textContent = faltan ? `Faltan ${faltan} por colocar.` : 'Todos los estados están en el lienzo.';
  const gn = $('#gNodes'); gn.innerHTML = '';
  idsEstados().forEach(id => {
    const n = S.nodos[id]; if (!n) return;
    const g = svgEl('g', { class: 'node' + (origenSel === id ? ' sel' : '') }); g.dataset.id = id;
    g.style.cursor = modo === 'mover' ? 'grab' : 'pointer';
    const est = EJ.estados.find(e => e.id === id);
    if (est && est.inicial) {
      g.appendChild(svgEl('path', { d: `M${n.x - R - 30},${n.y} L${n.x - R - 5},${n.y}`, stroke: 'var(--wire)', 'stroke-width': 1.8, fill: 'none', 'marker-end': 'url(#ar)' }));
    }
    g.appendChild(svgEl('circle', { cx: n.x, cy: n.y, r: R }));
    const t = svgEl('text', { x: n.x, y: n.y }); t.textContent = id; g.appendChild(t);
    gn.appendChild(g);
    g.addEventListener('pointerdown', ev => onNodoDown(ev, id));
  });
  pintarTransiciones();
  pintarLista();
}

function onNodoDown(ev, id) {
  ev.preventDefault(); ev.stopPropagation();
  if (modo === 'conectar') {
    if (!origenSel) { origenSel = id; pintarDiagrama(); $('#modoHint').textContent = `Origen ${id}. Ahora tocá el destino (puede ser el mismo estado).`; }
    else { abrirPanelConexion(origenSel, id); origenSel = null; pintarDiagrama(); }
    return;
  }
  const n = S.nodos[id];
  const p0 = puntoSVG(ev.clientX, ev.clientY);
  const dx = p0.x - n.x, dy = p0.y - n.y;
  const mv = e => {
    const p = puntoSVG(e.clientX, e.clientY);
    n.x = Math.min(800, Math.max(20, p.x - dx)); n.y = Math.min(410, Math.max(20, p.y - dy));
    pintarDiagrama();
  };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); guardar(); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}

function abrirPanelConexion(desde, hacia) {
  pend = { desde, hacia, entrada: valoresEntrada()[0], salida: (EJ.valoresSalida || ['0', '1'])[0] };
  if (EJ.tipo === 'moore') pend.salida = EJ.estados.find(e => e.id === desde).salida;
  Array.from($('#segEnt').children).forEach((c, i) => c.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'));
  Array.from($('#segSal').children).forEach((c, i) => c.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'));
  $('#connTxt').textContent = `${desde} → ${hacia}`;
  $('#connPanel').hidden = false;
}

function transicionesVisibles(transiciones, agrupar) {
  const grupos = new Map();
  transiciones.forEach((t, i) => {
    const clave = agrupar ? JSON.stringify([t.desde, t.hacia, String(t.salida)]) : i;
    if (!grupos.has(clave)) grupos.set(clave, { desde: t.desde, hacia: t.hacia, salida: String(t.salida), entradas: [], indices: [] });
    const grupo = grupos.get(clave);
    grupo.entradas.push(String(t.entrada));
    grupo.indices.push(i);
  });
  return [...grupos.values()].map(g => ({ ...g, etiqueta: `${g.entradas.slice().sort().join('')}/${g.salida}` }));
}

function eliminarTransiciones(indices) {
  const borradas = new Set(indices);
  S.trans = S.trans.filter((t, i) => !borradas.has(i));
  trSel = null; $('#btnBorrarTr').disabled = true;
  invalidar(1); pintarDiagrama(); guardar();
}

function pintarTransiciones() {
  const g = $('#gTrans'); g.innerHTML = '';
  const grupos = {};
  const visibles = transicionesVisibles(S.trans, S.agruparTransiciones);
  visibles.forEach((t, i) => { const k = t.desde + '>' + t.hacia; (grupos[k] = grupos[k] || []).push(i); });
  visibles.forEach((t, i) => {
    const a = S.nodos[t.desde], b = S.nodos[t.hacia];
    if (!a || !b) return;
    const k = t.desde + '>' + t.hacia, arr = grupos[k], pos = arr.indexOf(i);
    const hayVuelta = !!grupos[t.hacia + '>' + t.desde] && t.desde !== t.hacia;
    const seleccionada = t.indices.includes(trSel);
    const gg = svgEl('g', { class: 'tr' + (seleccionada ? ' sel' : '') });
    let d, lx, ly;
    if (t.desde === t.hacia) {
      const s = 1 + pos * 0.45, top = a.y - 24 * s - 60 * s;
      d = `M${a.x - 17},${a.y - 24} C${a.x - 46 * s},${top} ${a.x + 46 * s},${top} ${a.x + 17},${a.y - 24}`;
      lx = a.x; ly = top + 16 * s;
    } else {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const vx = b.x - a.x, vy = b.y - a.y, len = Math.hypot(vx, vy) || 1;
      const px = -vy / len, py = vx / len;
      const base = (hayVuelta ? 48 : 0) + pos * 58 - (hayVuelta ? 0 : (arr.length - 1) * 29);
      const cx = mx + px * base, cy = my + py * base;
      const n1 = Math.hypot(cx - a.x, cy - a.y) || 1, n2 = Math.hypot(cx - b.x, cy - b.y) || 1;
      const p0x = a.x + (cx - a.x) / n1 * R, p0y = a.y + (cy - a.y) / n1 * R;
      const p1x = b.x + (cx - b.x) / n2 * (R + 7), p1y = b.y + (cy - b.y) / n2 * (R + 7);
      d = `M${p0x},${p0y} Q${cx},${cy} ${p1x},${p1y}`;
      lx = .25 * p0x + .5 * cx + .25 * p1x; ly = .25 * p0y + .5 * cy + .25 * p1y;
    }
    gg.appendChild(svgEl('path', { class: 'line', d, 'marker-end': seleccionada ? 'url(#arSel)' : 'url(#ar)' }));
    const hit = svgEl('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 20, style: 'cursor:pointer' });
    gg.appendChild(hit);
    const txt = t.etiqueta;
    const ancho = Math.max(30, txt.length * 8 + 10);
    gg.appendChild(svgEl('rect', { class: 'lbl-bg', x: lx - ancho / 2, y: ly - 10, width: ancho, height: 17, rx: 3 }));
    const te = svgEl('text', { x: lx, y: ly + 3.5 }); te.textContent = txt; gg.appendChild(te);
    g.appendChild(gg);
    gg.addEventListener('pointerdown', ev => { ev.stopPropagation(); trSel = seleccionada ? null : t.indices[0]; $('#btnBorrarTr').disabled = trSel === null; pintarDiagrama(); });
  });
}

function pintarLista() {
  const ul = $('#tlist'); ul.innerHTML = '';
  if (!S.trans.length) { ul.innerHTML = '<li style="border-style:dashed;color:var(--muted)">Sin transiciones todavía</li>'; return; }
  transicionesVisibles(S.trans, S.agruparTransiciones).forEach(t => {
    const li = document.createElement('li');
    if (t.indices.some(i => S.trans[i]._mal)) li.classList.add('bad');
    const accion = t.indices.length > 1 ? 'Eliminar transiciones agrupadas' : 'Eliminar transición';
    li.innerHTML = `<span>${t.desde} —${t.etiqueta}→ ${t.hacia}</span><button title="${accion}" aria-label="${accion}">×</button>`;
    li.querySelector('button').onclick = () => eliminarTransiciones(t.indices);
    ul.appendChild(li);
  });
}

function validarPaso1() {
  const errores = [];
  S.trans.forEach(t => delete t._mal);
  const faltan = idsEstados().filter(i => !S.nodos[i]);
  if (faltan.length) errores.push(`Faltan estados en el lienzo: ${faltan.join(', ')}.`);
  idsEstados().forEach(st => {
    valoresEntrada().forEach(x => {
      const cand = S.trans.filter(t => t.desde === st && String(t.entrada) === x);
      if (cand.length === 0) { errores.push(`Falta la transición desde <b>${st}</b> con entrada <b>${x}</b>.`); return; }
      if (cand.length > 1) { cand.forEach(c => c._mal = true); errores.push(`Hay ${cand.length} transiciones desde <b>${st}</b> con entrada <b>${x}</b>: en un circuito determinista debe haber una sola.`); return; }
      const esp = trEsperada(st, x), t = cand[0];
      const malDest = t.hacia !== esp.hacia, malSal = String(t.salida) !== String(esp.salida);
      if (malDest || malSal) {
        t._mal = true;
        const q = [malDest ? 'el estado destino' : null, malSal ? 'la salida' : null].filter(Boolean).join(' y ');
        errores.push(`Desde <b>${st}</b> con entrada <b>${x}</b>: ${q} no es correcto.`);
      }
    });
  });
  pintarDiagrama();
  return { ok: !errores.length, errores, nota: errores.length && EJ.pista ? EJ.pista : '' };
}
