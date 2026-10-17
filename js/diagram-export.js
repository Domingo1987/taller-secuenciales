function motivoBloqueoExportacion(progreso) {
  return progreso.validado[1] === true ? '' :
    'No se hace la captura porque el diagrama no está comprobado como correcto. Tocá Comprobar y corregí los errores antes de exportar o copiar la imagen.';
}

function prepararImagenDiagrama() {
  const original = $('#svg');
  const copia = original.cloneNode(true);
  const fuentes = [original, ...original.querySelectorAll('*')];
  const destinos = [copia, ...copia.querySelectorAll('*')];
  const propiedades = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
    'stroke-linejoin', 'font-family', 'font-size', 'font-weight', 'text-anchor',
    'dominant-baseline', 'opacity', 'fill-opacity', 'stroke-opacity'
  ];
  const estilo = getComputedStyle(original);
  const wire = estilo.getPropertyValue('--wire').trim();
  fuentes.forEach((elemento, i) => {
    const calculado = getComputedStyle(elemento);
    propiedades.forEach(p => destinos[i].style.setProperty(p, calculado.getPropertyValue(p)));
    if (elemento.matches('.tr.sel .line, .node.sel circle')) {
      destinos[i].style.stroke = wire;
      destinos[i].style.strokeWidth = elemento.matches('circle') ? '2.2' : '1.8';
      if (elemento.matches('.line')) destinos[i].setAttribute('marker-end', 'url(#ar)');
    }
  });
  const cajas = [$('#gNodes').getBBox(), $('#gTrans').getBBox()];
  const x = Math.min(0, ...cajas.map(c => c.x - 24));
  const y = Math.min(0, ...cajas.map(c => c.y - 24));
  const ancho = Math.ceil(Math.max(820, ...cajas.map(c => c.x + c.width + 24)) - x);
  const alto = Math.ceil(Math.max(430, ...cajas.map(c => c.y + c.height + 24)) - y);
  copia.setAttribute('viewBox', `${x} ${y} ${ancho} ${alto}`);
  copia.setAttribute('width', ancho);
  copia.setAttribute('height', alto);
  copia.removeAttribute('id');
  copia.querySelector('#gTemp').remove();
  copia.insertBefore(svgEl('rect', { x, y, width: ancho, height: alto, fill: estilo.backgroundColor }), copia.firstChild);
  return { svg: new XMLSerializer().serializeToString(copia), ancho, alto };
}

async function crearPngDiagrama(imagen) {
  const url = URL.createObjectURL(new Blob([imagen.svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('No se pudo renderizar el diagrama.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = imagen.ancho * 2;
    canvas.height = imagen.alto * 2;
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('El navegador no permite generar imágenes con canvas.');
    contexto.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('No se pudo generar el archivo PNG.')), 'image/png'
    ));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function exportarDiagrama(copiar) {
  const mensaje = $('#diagramExportMsg');
  const bloqueo = motivoBloqueoExportacion(S);
  if (bloqueo) { mensaje.textContent = bloqueo; return; }
  if (copiar && (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')) {
    mensaje.textContent = 'Este navegador no permite copiar imágenes. Usá Exportar PNG para descargar el diagrama.';
    return;
  }
  const botones = [$('#btnExportPng'), $('#btnCopyDiagram')];
  botones.forEach(b => b.disabled = true);
  mensaje.textContent = copiar ? 'Copiando imagen…' : 'Generando PNG…';
  try {
    const imagen = prepararImagenDiagrama();
    if (copiar) {
      // The promised PNG keeps the clipboard call inside the user's click activation.
      const png = crearPngDiagrama(imagen);
      await Promise.all([png, navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])]);
      mensaje.textContent = 'Imagen copiada. Ya podés pegarla en otra aplicación.';
    } else {
      const png = await crearPngDiagrama(imagen);
      const url = URL.createObjectURL(png);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = (EJ.id || 'diagrama').replace(/[^a-zA-Z0-9_-]/g, '-') + '.png';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      mensaje.textContent = 'PNG generado y descarga solicitada.';
    }
  } catch (err) {
    mensaje.textContent = copiar
      ? `No se pudo copiar la imagen: ${err.message}. Revisá los permisos del portapapeles o usá Exportar PNG.`
      : `No se pudo exportar el diagrama: ${err.message}`;
  } finally {
    botones.forEach(b => b.disabled = false);
  }
}
