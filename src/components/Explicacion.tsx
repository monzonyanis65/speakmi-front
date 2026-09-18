import type { ReactNode } from 'react';

/**
 * Pinta la explicación de una regla.
 *
 * Las explicaciones vienen en Markdown, pero solo usan tres cosas: párrafos,
 * **negrita** y *cursiva*. Traer una librería de Markdown entera para eso
 * serían cien kilobytes por tres marcas, y además habría que sanear su salida.
 * Aquí se parte el texto y se devuelven nodos de React, así que no hay HTML
 * suelto que pueda inyectar nada.
 *
 * La cursiva se usa siempre para los ejemplos en inglés, así que se pinta con
 * la tipografía de lectura y en color de marca: se distingue de un vistazo qué
 * es explicación y qué es inglés.
 */
export function Explicacion({ texto }: { texto: string }) {
  const bloques = texto.split(/\n{2,}/).filter((b) => b.trim());

  return (
    <div className="grid gap-3">
      {bloques.map((bloque, i) => {
        const lineas = bloque
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const esLista = lineas.length > 1 && lineas.every((l) => l.startsWith('- '));

        // Una lista puesta en fila con guiones no se lee: parece una frase con
        // rayas en medio. Una por línea se recorre con la vista, que es para lo
        // que sirve una lista de equivalencias.
        if (esLista) {
          return (
            <ul key={i} className="grid gap-1.5 text-sm leading-relaxed">
              {lineas.map((linea, j) => (
                <li key={j} className="flex gap-2">
                  <span aria-hidden className="text-[var(--texto-suave)]">
                    ·
                  </span>
                  <span>{conMarcas(linea.slice(2))}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="text-sm leading-relaxed">
            {conMarcas(bloque.replace(/\n/g, ' '))}
          </p>
        );
      })}
    </div>
  );
}

/** Convierte `**negrita**` y `*cursiva*` en nodos, sin pasar por HTML. */
function conMarcas(texto: string): ReactNode[] {
  const trozos: ReactNode[] = [];
  // El orden importa: la negrita lleva dos asteriscos y hay que reconocerla
  // antes, o la cursiva se comería el primero y quedaría un asterisco suelto.
  const patron = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let ultimo = 0;
  let encaje: RegExpExecArray | null;

  while ((encaje = patron.exec(texto)) !== null) {
    if (encaje.index > ultimo) trozos.push(texto.slice(ultimo, encaje.index));

    const marcado = encaje[0];
    if (marcado.startsWith('**')) {
      trozos.push(
        <strong key={encaje.index} className="font-bold">
          {marcado.slice(2, -2)}
        </strong>,
      );
    } else {
      trozos.push(
        <em
          key={encaje.index}
          className="font-[var(--font-lectura)] not-italic text-marca-700 dark:text-marca-300"
        >
          {marcado.slice(1, -1)}
        </em>,
      );
    }
    ultimo = encaje.index + marcado.length;
  }

  if (ultimo < texto.length) trozos.push(texto.slice(ultimo));
  return trozos;
}
