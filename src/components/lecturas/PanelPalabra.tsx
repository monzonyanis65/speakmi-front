import { useEffect, useLayoutEffect, useRef } from 'react';
import type { EstadoPalabra, Palabra } from '@/lib/lecturas';
import { ASPECTO, ORDEN } from '@/components/lecturas/aspecto';
import { cn } from '@/lib/cn';

interface Props {
  palabra: Palabra;
  /** Cuántas veces sale ese lema en todo el artículo. */
  veces: number;
  /** Frases del propio texto donde aparece. */
  frases: string[];
  /** Si el aparato tiene voz inglesa. Sin ella no se pinta el altavoz. */
  puedeSonar: boolean;
  onSonar: () => void;
  onEstado: (estado: EstadoPalabra) => void;
  onCerrar: () => void;
  /** Lo alto que ha quedado, para que la página sepa cuánto tapa. */
  onAltura: (px: number) => void;
}

/**
 * El panel de una palabra.
 *
 *
 * POR QUÉ ES UNA CAJA ABAJO Y NO UNA PANTALLA
 *
 * Porque leer un artículo son doscientos toques, y si cada uno abre una pantalla
 * y hay que volver, no se lee: se rellena un formulario. Lo que hay que
 * conseguir es que mirar una palabra cueste lo mismo que mirar una nota al pie.
 *
 * De ahí las tres decisiones que lo hacen posible, y ninguna es cosmética:
 *
 * 1. NO CAMBIA LA RUTA. El texto no se desmonta, así que no se vuelve a pedir,
 *    no se vuelve a pintar y no vuelve arriba del todo. Cerrar el panel deja
 *    exactamente lo que había.
 *
 * 2. NO ES MODAL (`aria-modal` no está puesto, y no hay fondo que tape). Un
 *    diálogo modal atrapa el foco y oscurece lo de detrás: aquí lo de detrás es
 *    justo lo que se quiere seguir leyendo, y se puede seguir desplazando el
 *    artículo con el panel abierto.
 *
 * 3. VIVE ABAJO y dice lo alto que es. La página usa esa altura para mover el
 *    texto SOLO si la palabra tocada se quedaba debajo del panel, y ni un píxel
 *    si ya se veía. Ver `desplazamientoParaVer`.
 *
 * Y al cerrarse, el foco vuelve a la palabra. Para quien navega con teclado o
 * con lector de pantalla, «dónde ibas» ES dónde está el foco: devolverlo es la
 * misma promesa que no mover el scroll, dicha en el otro idioma.
 *
 *
 * LO QUE NO HAY AQUÍ, Y ES A PROPÓSITO
 *
 * No hay traducción. El contrato con el servidor no trae diccionario, así que
 * inventarse una acepción sería escribir algo que puede estar mal en la pantalla
 * donde la gente viene a aprender la palabra. Lo que sí hay es mejor para leer
 * de corrido: las frases DEL PROPIO TEXTO donde sale, que es de donde se saca el
 * significado cuando se lee en serio, cuántas veces va a volver a aparecer, y un
 * enlace al diccionario que se abre aparte sin tocar esta pestaña.
 */
export function PanelPalabra({
  palabra,
  veces,
  frases,
  puedeSonar,
  onSonar,
  onEstado,
  onCerrar,
  onAltura,
}: Props) {
  const caja = useRef<HTMLDivElement>(null);

  // Antes de pintar, no después: la página necesita la altura para decidir si
  // mueve el texto, y medirla un fotograma tarde se ve como un salto.
  useLayoutEffect(() => {
    const alto = caja.current?.offsetHeight ?? 0;
    onAltura(alto);
  }, [onAltura, palabra.lema, frases.length]);

  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div
      ref={caja}
      role="dialog"
      aria-label={`Palabra: ${palabra.texto}`}
      className={
        'animate-subir fixed inset-x-0 bottom-0 z-30 max-h-[46vh] overflow-y-auto ' +
        // Sin `overscroll-contain`, llegar al final de la lista de frases sigue
        // desplazando el artículo de detrás, y eso sí pierde el sitio.
        'overscroll-contain border-t-2 border-[var(--borde)] bg-[var(--superficie)] ' +
        'pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.18)]'
      }
    >
      <div className="mx-auto w-full max-w-2xl px-4 pt-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p lang="en" className="font-lectura text-2xl leading-tight font-bold break-words">
              {palabra.texto}
            </p>
            <p className="mt-1 text-sm text-[var(--texto-suave)]">
              {palabra.lema !== palabra.texto.toLowerCase() && (
                <span lang="en">{palabra.lema}</span>
              )}
              {palabra.lema !== palabra.texto.toLowerCase() && ' · '}
              {veces === 1 ? 'sale una vez en este texto' : `sale ${veces} veces en este texto`}
            </p>
          </div>

          {puedeSonar && (
            <button
              type="button"
              onClick={onSonar}
              aria-label={`Escuchar ${palabra.texto}`}
              className="boton-3d flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--hueco)] bg-[var(--fondo)] text-xl"
            >
              <span aria-hidden>🔊</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar y seguir leyendo"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-[var(--texto-suave)] hover:bg-[var(--fondo)]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        {frases.length > 0 && (
          <div className="mt-3 rounded-xl bg-[var(--fondo)] p-3">
            <p className="text-xs font-bold tracking-wide text-[var(--texto-suave)] uppercase">
              Dónde sale
            </p>
            <ul className="mt-1.5 grid gap-1.5">
              {frases.map((frase) => (
                <li key={frase} lang="en" className="font-lectura text-sm leading-relaxed">
                  {frase}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/*
          Dos columnas y no cuatro: a 320 px, cuatro botones en fila dejan
          setenta píxeles por botón y el texto sale partido en tres renglones.
          Así cada uno mantiene los cuarenta y ocho de alto y se lee entero.
        */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ORDEN.map((estado) => {
            const aspecto = ASPECTO[estado];
            const puesto = palabra.estado === estado;
            return (
              <button
                key={estado}
                type="button"
                aria-pressed={puesto}
                onClick={() => onEstado(estado)}
                className={cn(
                  'boton-3d flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-bold',
                  puesto
                    ? 'border-marca-700 bg-marca-600 text-white'
                    : 'border-[var(--hueco)] bg-[var(--fondo)]',
                )}
              >
                <span aria-hidden className={cn('size-3 shrink-0 rounded-full', aspecto.punto)} />
                <span className="min-w-0">{aspecto.accion}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-xs text-[var(--texto-suave)]">{ASPECTO[palabra.estado].pista}</p>

        <a
          href={`https://www.wordreference.com/es/translation.asp?tranword=${encodeURIComponent(palabra.lema)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-marca-700 underline underline-offset-4 dark:text-marca-300"
        >
          Buscarla en el diccionario ↗
        </a>
      </div>
    </div>
  );
}
