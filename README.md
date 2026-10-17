# taller-secuenciales

Abrí `index.html` en un navegador; no requiere instalación ni compilación.

- **Taller binario**: conserva el ejercicio original del detector 101.
- **Creador de diagramas · letras**: reutiliza el editor para alfabetos de 2 a 4
  letras y secuencias consecutivas de hasta 7 letras. Incluye el ejemplo `acd`,
  diagrama resuelto opcional y simulación por pulsos.
- Ambos espacios conservan su progreso por separado al alternar entre ellos.
  El almacenamiento local guarda cada ejercicio por su identificador; al abrir
  nuevamente la página se recuperan los ejercicios predeterminados de cada espacio.

El detector de letras es Moore: `z = 1` en el estado que reconoce la secuencia.
Las coincidencias pueden solaparse. A diferencia de la imagen de referencia,
no se ignoran letras intermedias: `abcd` no reconoce `acd`, pero `aacd` sí.
Cada entrada representa una línea independiente (one-hot); solo una puede
estar activa por pulso. Las otras combinaciones se consideran indiferencias
en la tabla de excitación y al simplificar las ecuaciones.

El recorrido incluye diagrama, tabla de estados/salidas, codificación, tabla
de excitación y funciones booleanas. El resumen muestra las ecuaciones y un
esquema de bloques del circuito con biestables D, reloj y realimentación.

En el editor, **Agrupar flechas por salida** reúne las transiciones con el mismo
origen, destino y salida: `abc/0` representa a, b o c con salida 0 en una sola
flecha. Las salidas distintas permanecen separadas, también en los bucles.
Los círculos contienen solo el nombre del estado; todas las flechas muestran
`entrada/salida`, incluso en Moore (salida del estado de origen).
La agrupación es visual: no cambia las tablas, la comprobación ni la simulación,
y se guarda con el progreso de cada ejercicio. Eliminar una flecha agrupada,
desde el lienzo o la lista, elimina todas sus transiciones; para borrar una
sola, desactivá la agrupación.

**Exportar PNG** descarga únicamente el diagrama, a doble resolución, con la
agrupación y los colores actuales. **Copiar imagen** permite pegar ese PNG en
otra aplicación si el navegador admite imágenes en el portapapeles y concede
el permiso correspondiente; de lo contrario, se muestra un aviso para usar la
descarga. Ambas acciones requieren haber aprobado **Comprobar** en el paso 1:
un diagrama sin comprobar, incorrecto o modificado desde la comprobación no
se captura. No hace falta completar los pasos de tablas y funciones.

## JavaScript

- `js/exercises.js`: ejercicio binario y generación de detectores de letras.
- `js/diagram-editor.js`: editor SVG compartido por ambos espacios.
- `js/diagram-export.js`: exportación PNG y copia al portapapeles de diagramas comprobados.
- `js/app.js`: navegación, tablas, funciones, persistencia y simulación.

Pruebas sin dependencias: `node --test`.