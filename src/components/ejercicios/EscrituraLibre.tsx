import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { PropsEjercicio } from './tipos';

/**
 * Escribir libre: una consigna y unas cuantas frases tuyas.
 *
 * Es el único ejercicio donde no hay nada que elegir ni nada con lo que
 * comparar, y eso cambia lo que la pantalla tiene que hacer. En los demás, la
 * información sube DESPUÉS de responder: cuál era la buena, qué palabra falló.
 * Aquí la mitad tiene que estar ANTES y quedarse ahí mientras se escribe,
 * porque lo que se pide —tres cosas concretas— es justo lo que se olvida en
 * cuanto uno empieza a pelearse con la segunda frase.
 *
 * LO QUE NO LLEVA, Y ES A PROPÓSITO
 *
 * No hay contador de palabras. Un número subiendo en la esquina es una meta
 * aunque nadie diga que lo es: quien lo ve escribe hasta que le parece
 * bastante, y lo que se está enseñando es lo contrario, decir las tres cosas y
 * callarse. La corrección tampoco mira la longitud, así que un contador estaría
 * midiendo algo que no puntúa.
 *
 * Tampoco hay ejemplo resuelto. Un ejemplo se copia, y entonces esto vuelve a
 * ser un ejercicio de cambiar tres palabras. Lo que sí hay, cuando la unidad lo
 * pide, son palabras sueltas de apoyo: quien empieza se bloquea por no
 * acordarse de una palabra y abandona el ejercicio entero, y eso no mide si
 * sabe escribir.
 */
export function EscrituraLibre({ ejercicio, bloqueado, onCambio, resultado }: PropsEjercicio) {
  const [texto, setTexto] = useState('');
  const campo = useRef<HTMLTextAreaElement>(null);

  const prompt = ejercicio.prompt as {
    instruction_es: string;
    situacion_es: string;
    puntos_es: string[];
    apoyo?: string[];
  };

  useEffect(() => setTexto(''), [ejercicio.code]);

  function fijar(nuevo: string) {
    setTexto(nuevo);
    onCambio(nuevo.trim() ? nuevo : null);
  }

  /*
    Meter una palabra de apoyo devuelve el cursor al campo.

    Sin esto, en el móvil, tocar una palabra cierra el teclado y hay que volver
    a tocar el recuadro para seguir: dos toques por palabra, y el apoyo acaba
    estorbando más de lo que ayuda. Se inserta al final y no donde estaba el
    cursor porque aquí se escribe hacia delante, no se edita.
  */
  function anadirApoyo(palabra: string) {
    const separador = texto.length > 0 && !texto.endsWith(' ') ? ' ' : '';
    fijar(`${texto}${separador}${palabra} `);
    campo.current?.focus();
  }

  const puntos = resultado?.feedback.puntos;

  return (
    <div>
      <p className="text-sm text-[var(--texto-suave)]">{prompt.instruction_es}</p>

      <p className="mt-3 font-[var(--font-lectura)] text-lg leading-relaxed">
        {prompt.situacion_es}
      </p>

      {/*
        La lista se queda en pantalla mientras se escribe y también después de
        corregir, cuando cada punto se marca con lo que pasó con él. Es el mismo
        sitio: se comprueba lo que se pedía contra lo que se contó sin mover la
        vista, que es lo único que enseña a no dejarse cosas.
      */}
      <ol className="mt-4 grid gap-2">
        {prompt.puntos_es.map((punto, i) => {
          const juicio = puntos?.[i];

          return (
            <li
              key={punto}
              className={cn(
                'flex gap-2.5 rounded-xl border px-3 py-2.5 text-sm',
                juicio === undefined
                  ? 'border-[var(--borde)]'
                  : juicio.cubierto
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'shrink-0 font-bold tabular-nums',
                  juicio === undefined
                    ? 'text-[var(--texto-suave)]'
                    : juicio.cubierto
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300',
                )}
              >
                {juicio === undefined ? `${i + 1}.` : juicio.cubierto ? '✓' : '✗'}
              </span>
              <span className="min-w-0">
                {/*
                  Lo que se pedía, sin tachar ni atenuar cuando sale bien: se
                  sigue leyendo igual de fácil al repasar por qué aprobó.
                */}
                {punto}
                {juicio && !juicio.cubierto && juicio.porQue_es && (
                  <span className="mt-1 block text-[var(--texto-suave)]">{juicio.porQue_es}</span>
                )}
              </span>
              {/* Lo mismo, dicho para quien no ve los colores ni el símbolo. */}
              {juicio && (
                <span className="sr-only">{juicio.cubierto ? 'Dicho' : 'Te faltó esto'}</span>
              )}
            </li>
          );
        })}
      </ol>

      <textarea
        ref={campo}
        value={texto}
        disabled={bloqueado}
        onChange={(e) => fijar(e.target.value)}
        rows={5}
        aria-label="Tu texto en inglés"
        /*
          La mayúscula automática sí, el corrector del teclado no. Empezar la
          frase en mayúscula es una costumbre del teclado y no se puntúa en
          ningún nivel; que el teléfono le arregle las palabras en inglés sí
          borraría justo lo que hay que corregir.
        */
        autoCapitalize="sentences"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        placeholder="Escríbelo en inglés. No importa que sea corto."
        className="mt-5 w-full resize-y rounded-xl border border-[var(--borde)] bg-[var(--superficie)] px-4 py-3 text-base leading-relaxed outline-none focus:border-marca-500 disabled:opacity-60"
      />

      {prompt.apoyo && prompt.apoyo.length > 0 && !bloqueado && (
        <>
          <p className="mt-3 text-xs text-[var(--texto-suave)]">Por si te hacen falta:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {prompt.apoyo.map((palabra) => (
              <button
                key={palabra}
                type="button"
                onClick={() => anadirApoyo(palabra)}
                className="inline-flex min-h-11 items-center rounded-lg border border-[var(--borde)] px-3 text-sm transition hover:border-marca-400"
              >
                {palabra}
              </button>
            ))}
          </div>
        </>
      )}

      {/*
        Lo que escribió, después de corregir. El recuadro queda desactivado y en
        gris, y la versión buena la pinta la hoja de corrección de abajo: verlas
        una encima de otra es lo que deja ver qué cambió. Repetirla aquí sería
        leer dos veces lo mismo.
      */}
    </div>
  );
}
