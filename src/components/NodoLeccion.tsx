import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

export type EstadoNodo = 'hecha' | 'actual' | 'bloqueada';

interface Props {
  titulo: string;
  tipo: string;
  icono: string;
  estado: EstadoNodo;
  /** Cuánto se desplaza del centro, de -1 a 1. Es lo que dibuja la serpiente. */
  desvio: number;
  retraso: number;
  onAbrir: () => void;
}

/**
 * Una lección, como nodo de un camino.
 *
 * Es una lista, pero no se ve como una lista. Un camino que serpentea se lee
 * como un recorrido con un antes y un después, y eso es exactamente lo que es
 * el curso. Una columna de tarjetas iguales no dice nada de eso.
 *
 * Los tres estados se distinguen sin leer nada: lo hecho está relleno, lo
 * siguiente lleva anillo y cartel, y lo que queda está apagado.
 */
export function NodoLeccion({ titulo, tipo, icono, estado, desvio, retraso, onAbrir }: Props) {
  const nodo = useRef<HTMLLIElement>(null);

  // Al abrir la ruta se baja sola hasta donde toca seguir. Con veinte lecciones
  // por nivel, empezar siempre arriba obliga a buscar cada vez por dónde ibas.
  useEffect(() => {
    if (estado !== 'actual') return;
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Se espera a que entren los nodos; si no, se desplaza hacia una posición
    // que aún está cambiando y acaba en otro sitio.
    const t = setTimeout(() => {
      nodo.current?.scrollIntoView({
        behavior: quieto ? 'auto' : 'smooth',
        block: 'center',
      });
    }, 600);
    return () => clearTimeout(t);
  }, [estado]);

  return (
    <li
      ref={nodo}
      className="flex animate-crecer flex-col items-center"
      style={{
        // Desplazamiento en rem, no en porcentaje: el porcentaje se mide sobre
        // el ancho del propio nodo, que cambia con el largo del título, y la
        // curva salía distinta en cada fila.
        transform: `translateX(${(desvio * 4.5).toFixed(2)}rem)`,
        animationDelay: `${retraso}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {estado === 'actual' && (
        <span className="mb-2 animate-flotar rounded-xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-marca-600 dark:text-marca-400">
          Empezar
        </span>
      )}

      {/*
        El título va dentro del botón, no al lado. Si queda fuera, la mitad de
        lo que parece un nodo no responde al toque, y en un móvil eso se nota
        enseguida: se pulsa el nombre y no pasa nada.
      */}
      <button
        type="button"
        onClick={onAbrir}
        // Bloqueada se deshabilita de verdad, no se esconde: se ve que existe y
        // que llegará, que es lo que da sentido a un camino. Y el lector de
        // pantalla oye que está cerrada en vez de intentar abrirla.
        disabled={estado === 'bloqueada'}
        aria-label={`${titulo}. ${tipo}. ${ETIQUETA_ESTADO[estado]}`}
        className={cn(
          'group flex w-32 flex-col items-center gap-2 rounded-2xl p-1 transition-[filter]',
          estado === 'bloqueada'
            ? 'cursor-not-allowed'
            : 'hover:brightness-105 active:brightness-95',
        )}
      >
        <span className="relative grid size-[68px] place-items-center">
          {/* El anillo late solo en el nodo actual: señala dónde retomar sin
              necesidad de leer nada. */}
          {estado === 'actual' && (
            <span
              aria-hidden
              className="absolute -inset-2 animate-onda rounded-full border-4 border-marca-500"
            />
          )}

          <span
            aria-hidden
            className={cn(
              'boton-3d grid size-full place-items-center rounded-full border-b-[6px] text-3xl',
              estado !== 'bloqueada' &&
                'group-active:translate-y-[3px] group-active:border-b-[1px]',
              estado === 'hecha' && 'border-emerald-800 bg-emerald-600 text-white',
              estado === 'actual' && 'border-marca-900 bg-marca-600 text-white',
              estado === 'bloqueada' &&
                'border-[var(--hueco)] bg-[var(--fondo)] text-[var(--texto-suave)] opacity-60',
            )}
          >
            {estado === 'hecha' ? '✓' : estado === 'bloqueada' ? '🔒' : icono}
          </span>
        </span>

        <span aria-hidden className="text-center text-xs font-bold leading-tight">
          {titulo}
        </span>
      </button>
    </li>
  );
}

const ETIQUETA_ESTADO: Record<EstadoNodo, string> = {
  hecha: 'Ya la hiciste',
  actual: 'Es la que toca',
  bloqueada: 'Cerrada. Termina la anterior para abrirla',
};
