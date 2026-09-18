import { cn } from '@/lib/cn';

export type EstadoNodo = 'hecha' | 'actual' | 'porHacer';

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
export function NodoLeccion({
  titulo,
  tipo,
  icono,
  estado,
  desvio,
  retraso,
  onAbrir,
}: Props) {
  return (
    <li
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
        <span className="animate-flotar mb-2 rounded-xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-marca-600 dark:text-marca-400">
          Empezar
        </span>
      )}

      <button
        type="button"
        onClick={onAbrir}
        aria-label={`${titulo}. ${tipo}. ${ETIQUETA_ESTADO[estado]}`}
        className={cn(
          'boton-3d relative grid size-[68px] place-items-center rounded-full text-3xl',
          'border-b-[6px] transition-[filter]',
          estado === 'hecha' && 'border-emerald-800 bg-emerald-600 text-white',
          estado === 'actual' && 'border-marca-900 bg-marca-600 text-white',
          estado === 'porHacer' &&
            'border-[var(--hueco)] bg-[var(--superficie)] text-[var(--texto-suave)] opacity-80',
        )}
      >
        {/* El anillo late solo en el nodo actual: señala dónde retomar sin
            necesidad de leer nada. */}
        {estado === 'actual' && (
          <span
            aria-hidden
            className="animate-onda absolute -inset-2 rounded-full border-4 border-marca-500"
          />
        )}
        <span aria-hidden>{estado === 'hecha' ? '✓' : icono}</span>
      </button>

      <span className="mt-2 max-w-[9rem] text-center text-xs font-bold leading-tight">
        {titulo}
      </span>
    </li>
  );
}

const ETIQUETA_ESTADO: Record<EstadoNodo, string> = {
  hecha: 'Ya la hiciste',
  actual: 'Es la que toca',
  porHacer: 'Todavía no la has hecho',
};
