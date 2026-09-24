import { cn } from '@/lib/cn';
import { useMenosMovimiento } from './movimiento';

/**
 * Las piezas que se repiten en los cuatro juegos: la cabecera con la salida, el
 * reloj, los contadores y el aviso de que algo falló.
 *
 * Están juntas aquí porque lo que las hace un juego y no un formulario es que se
 * vean SIEMPRE igual: el reloj en el mismo sitio, la puntuación en el mismo
 * sitio. Si cada juego se lo pinta a su manera, cada uno parece otra aplicación.
 */

export function CabeceraJuego({
  onSalir,
  children,
}: {
  onSalir: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSalir}
        aria-label="Salir del juego"
        className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
      >
        ✕
      </button>
      {children}
    </header>
  );
}

/**
 * El reloj.
 *
 * Los segundos van en cifra grande y con `tabular-nums`, porque si no el número
 * baila de ancho al cambiar y parece que tiembla la pantalla. La barra está
 * debajo para poder mirar de reojo sin leer.
 *
 * Bajo `prefers-reduced-motion` no late: el color y la palabra hacen el trabajo
 * que hacía el latido. Un reloj que parpadea cuando alguien pidió que nada se
 * mueva es el peor sitio posible para saltarse esa preferencia.
 */
export function Reloj({ restantes, total }: { restantes: number; total: number }) {
  const menosMovimiento = useMenosMovimiento();
  const apurado = restantes <= 10;
  const porcentaje = total > 0 ? Math.max(0, Math.min(100, (restantes / total) * 100)) : 0;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden
          className={cn(
            'text-2xl font-extrabold tabular-nums',
            apurado ? 'text-[var(--texto-aviso)]' : 'text-[var(--texto)]',
            apurado && !menosMovimiento && 'animate-latido',
          )}
        >
          {restantes}
        </span>
        <span aria-hidden className="text-xs text-[var(--texto-suave)]">
          {apurado ? '¡se acaba!' : 'segundos'}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--superficie)]">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            apurado ? 'bg-aviso' : 'bg-marca-600',
          )}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      {/*
        El número no se anuncia cada segundo: un lector de pantalla leyendo
        «cincuenta y nueve, cincuenta y ocho…» tapa el ejercicio y hace el juego
        imposible. Solo se avisa en los dos momentos que cambian la decisión.
      */}
      <p role="status" className="sr-only">
        {restantes === 30 ? 'Media vuelta, treinta segundos.' : ''}
        {restantes === 10 ? 'Quedan diez segundos.' : ''}
      </p>
    </div>
  );
}

/** Un dato del marcador: puntos, racha, parejas que faltan. */
export function Contador({
  etiqueta,
  valor,
  tono = 'normal',
}: {
  etiqueta: string;
  valor: string | number;
  tono?: 'normal' | 'acierto' | 'aviso';
}) {
  return (
    <div className="shrink-0 text-right">
      <p
        className={cn(
          'text-xl font-extrabold tabular-nums leading-none',
          tono === 'acierto' && 'text-[var(--texto-acierto)]',
          tono === 'aviso' && 'text-[var(--texto-aviso)]',
        )}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
        {etiqueta}
      </p>
    </div>
  );
}

/**
 * El multiplicador de la racha.
 *
 * Es lo único de la pantalla que sube solo por ir bien, y por eso está: ver el
 * «×3» crecer es lo que hace que apetezca encadenar otra.
 */
export function Racha({ racha, multiplicador }: { racha: number; multiplicador: number }) {
  const menosMovimiento = useMenosMovimiento();
  if (racha < 2) return null;

  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-1 rounded-full bg-acento-600 px-2.5 text-xs font-extrabold text-white',
        !menosMovimiento && 'animate-crecer',
      )}
    >
      <span aria-hidden>🔥</span>
      <span>
        ×{multiplicador} · {racha} seguidas
      </span>
    </span>
  );
}

/**
 * Algo salió mal y hay que decirlo en voz alta.
 *
 * `role="alert"` para que un lector de pantalla lo lea sin que haya que ir a
 * buscarlo: quien no ve la pantalla, si no se anuncia, se queda esperando.
 */
export function Aviso({
  children,
  tono = 'fallo',
}: {
  children: React.ReactNode;
  tono?: 'fallo' | 'aviso';
}) {
  return (
    <p
      role="alert"
      className={cn(
        'rounded-2xl px-4 py-3 text-sm',
        tono === 'fallo'
          ? 'bg-red-50 text-[var(--texto-fallo)] dark:bg-red-950/30'
          : 'bg-amber-50 text-[var(--texto-aviso)] dark:bg-amber-950/30',
      )}
    >
      {children}
    </p>
  );
}
