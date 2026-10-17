/* ============================================================
   EJERCICIO POR DEFECTO (detector de la secuencia 101)
   ============================================================ */
const EJ_DEFAULT = {
  "id": "detector-101",
  "titulo": "Detector de la secuencia 101",
  "enunciado": "Diseñar un circuito secuencial que reconozca la entrada 101. La salida será 1 si y solo si la entrada toma los valores 101. Ante cualquier otra secuencia de valores de entrada la salida será 0.",
  "entrada": "x",
  "salida": "S",
  "valoresEntrada": ["0", "1"],
  "valoresSalida": ["0", "1"],
  "codificacionEstricta": false,
  "estados": [
    { "id": "A", "descripcion": "Búsqueda de una nueva secuencia.", "inicial": true },
    { "id": "B", "descripcion": "Se recibió el primer 1." },
    { "id": "C", "descripcion": "Se recibió un 1 seguido de un 0." },
    { "id": "D", "descripcion": "Se reconoce la secuencia 101." }
  ],
  "transiciones": [
    { "desde": "A", "entrada": "0", "hacia": "A", "salida": "0" },
    { "desde": "A", "entrada": "1", "hacia": "B", "salida": "0" },
    { "desde": "B", "entrada": "0", "hacia": "C", "salida": "0" },
    { "desde": "B", "entrada": "1", "hacia": "B", "salida": "0" },
    { "desde": "C", "entrada": "0", "hacia": "A", "salida": "0" },
    { "desde": "C", "entrada": "1", "hacia": "D", "salida": "1" },
    { "desde": "D", "entrada": "0", "hacia": "C", "salida": "0" },
    { "desde": "D", "entrada": "1", "hacia": "B", "salida": "0" }
  ],
  "codificacionSugerida": { "A": "00", "B": "01", "C": "10", "D": "11" },
  "pista": "Pensá qué parte de la secuencia 101 queda reconocida después de leer ese bit: nunca se pierde el progreso que ya sirve para empezar una nueva secuencia."
};

function crearEjercicioLetras(alfabeto, texto) {
  const letras = alfabeto.trim().toLowerCase().split(/\s+/);
  const secuencia = texto.toLowerCase().replace(/\s+/g, '');
  if (letras.length < 2 || letras.length > 4 || letras.some(l => !/^[a-z]$/.test(l)) || new Set(letras).size !== letras.length) {
    throw new Error('Ingresá entre 2 y 4 letras distintas (a-z), separadas por espacios.');
  }
  if (!secuencia.length || secuencia.length > 7 || [...secuencia].some(l => !letras.includes(l))) {
    throw new Error('La secuencia debe tener de 1 a 7 letras y usar solamente las entradas indicadas.');
  }
  const estados = Array.from({ length: secuencia.length + 1 }, (_, i) => ({
    id: 'S' + i,
    inicial: i === 0,
    salida: i === secuencia.length ? '1' : '0',
    descripcion: i === 0 ? 'Estado inicial: espero ' + secuencia[0] + '.' :
      i === secuencia.length ? `Se recibió ${secuencia}; z = 1.` :
        `Se recibió ${secuencia.slice(0, i)}; espero ${secuencia[i]}.`
  }));
  const transiciones = estados.flatMap((estado, i) => letras.map(entrada => {
    const recibido = secuencia.slice(0, i) + entrada;
    let prefijo = Math.min(secuencia.length, recibido.length);
    while (prefijo > 0 && !recibido.endsWith(secuencia.slice(0, prefijo))) prefijo--;
    return { desde: estado.id, entrada, hacia: 'S' + prefijo, salida: estado.salida };
  }));
  return {
    id: 'letras-' + letras.join('') + '-' + secuencia,
    titulo: 'Detector de la secuencia ' + [...secuencia].join(' '),
    enunciado: `Implementar un circuito de ${letras.length} entradas: ${letras.join(', ')} (solo una activa a la vez), que reconozca la secuencia consecutiva ${secuencia}. Determinar el diagrama de estados y el circuito secuencial. Salida Moore: z = 1 mientras el estado actual reconoce la secuencia. Se permiten coincidencias solapadas.`,
    entrada: 'letra', salida: 'z', tipo: 'moore', entradasOneHot: true,
    valoresEntrada: letras, valoresSalida: ['0', '1'], secuencia,
    estados, transiciones,
    pista: 'Ante una letra incorrecta, conservá el sufijo recibido que también sea un prefijo de la secuencia.'
  };
}

const EJ_LETRAS = crearEjercicioLetras('a b c d', 'acd');

function variablesEntrada(ej) {
  return ej.entradasOneHot ? ej.valoresEntrada : [ej.entrada];
}

function combinacionesEntrada(ej) {
  if (!ej.entradasOneHot) {
    return (ej.valoresEntrada || ['0', '1']).map(x => ({ x, bits: String(x), valida: true }));
  }
  const n = ej.valoresEntrada.length;
  return Array.from({ length: 2 ** n }, (_, valor) => {
    const bits = valor.toString(2).padStart(n, '0');
    const valida = [...bits].filter(b => b === '1').length === 1;
    return { bits, valida, x: valida ? ej.valoresEntrada[bits.indexOf('1')] : '—' };
  });
}
