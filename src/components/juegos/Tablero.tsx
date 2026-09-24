import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar } from '@/lib/sonido';
import { NumeroVivo } from './efectos';

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
 * Bajo `prefers-reduced-motion` no late ni tictaquea: el color y la palabra
 * hacen el trabajo que hacía el latido. Un reloj que parpadea cuando alguien
 * pidió que nada se mueva es el peor sitio posible para saltarse esa
 * preferencia.
 *
 * Los últimos diez segundos suenan, uno a uno, y los últimos tres suenan más
 * arriba. El tic es lo que hace que se levante la vista del ejercicio sin tener
 * que mirar el número, que es justo lo que se necesita cuando quedan tres.
 */
export function Reloj({ restantes, total }: { restantes: number; total: number }) {
  const menosMovimiento = useMenosMovimiento();
  const apurado = restantes <= 10;
  const ahogado = restantes <= 3;
  const porcentaje = total > 0 ? Math.max(0, Math.min(100, (restantes / total) * 100)) : 0;

  /*
    Un tic por segundo, y solo si el segundo cambió de verdad.

    El reloj se refresca cuatro veces por segundo para no ir a saltos, así que
    sin acordarse del último segundo sonado esto pitaría cuatro veces seguidas.
  */
  const ultimoTic = useRef<number | null>(null);
  useEffect(() => {
    if (!apurado || restantes <= 0) return;
    if (ultimoTic.current === restantes) return;
    ultimoTic.current = restantes;
    sonar('tic', { urgente: restantes <= 3 });
  }, [apurado, restantes]);

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden
          className={cn(
            'font-extrabold tabular-nums transition-all duration-200',
            apurado ? 'text-[var(--texto-aviso)]' : 'text-[var(--texto)]',
            ahogado ? 'text-4xl' : 'text-2xl',
            apurado && !menosMovimiento && 'animate-latido',
          )}
        >
          {restantes}
        </span>
        <span
          aria-hidden
          className={cn(
            'text-xs',
            apurado ? 'font-bold text-[var(--texto-aviso)]' : 'text-[var(--texto-suave)]',
          )}
        >
          {ahogado ? '¡ya!' : apurado ? '¡se acaba!' : 'segundos'}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--superficie)]">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            ahogado ? 'bg-fallo' : apurado ? 'bg-aviso' : 'bg-marca-600',
            ahogado && !menosMovimiento && 'animate-latido',
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

/**
 * Un dato del marcador: puntos, racha, parejas que faltan.
 *
 * Con `vivo` el número pega un salto cada vez que cambia. Es opcional y no va
 * por defecto porque hay contadores que cambian solos —el tiempo de parejas
 * cambia cada segundo— y uno que bota sin parar deja de significar nada.
 */
export function Contador({
  etiqueta,
  valor,
  tono = 'normal',
  vivo = false,
  children,
}: {
  etiqueta: string;
  valor: string | number;
  tono?: 'normal' | 'acierto' | 'aviso';
  vivo?: boolean;
  /** Lo que flota sobre el contador al cambiar, si algo flota. */
  children?: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0 text-right">
      <p
        className={cn(
          'text-xl font-extrabold tabular-nums leading-none',
          tono === 'acierto' && 'text-[var(--texto-acierto)]',
          tono === 'aviso' && 'text-[var(--texto-aviso)]',
        )}
      >
        {vivo ? <NumeroVivo valor={valor} /> : valor}
      </p>
      {children}
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
        {etiqueta}
      </p>
    </div>
  );
}

/**
 * La racha: el contador de aciertos seguidos.
 *
 * Es lo único de la pantalla que sube solo por ir bien, y por eso está: ver el
 * número crecer y cambiar de color es lo que hace que apetezca encadenar otra.
 * Cuanto más alta, más grande y más caliente el color, y a partir de siete
 * lleva tres llamas en vez de una.
 *
 * No pone «×3».
 *
 * Un multiplicador escrito promete que el acierto siguiente vale el triple, y en
 * contrarreloj todos los aciertos valen diez, se venga de donde se venga. Lo que
 * de verdad vale el siguiente lo dice cada juego al lado, cuando lo sabe.
 */
export function Racha({ racha }: { racha: number }) {
  const menosMovimiento = useMenosMovimiento();
  if (racha < 2) return null;

  const tramo = racha >= 7 ? 2 : racha >= 4 ? 1 : 0;

  return (
    <span
      key={racha}
      className={cn(
        'inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 font-extrabold text-white',
        TRAMOS[tramo],
        !menosMovimiento && 'animate-crecer',
      )}
    >
      <span aria-hidden>{tramo === 2 ? '🔥🔥🔥' : '🔥'}</span>
      <span>{racha} seguidas</span>
    </span>
  );
}

/*
  Los tres tramos de la racha.

  El tamaño sube con el color: dos seguidas es una nota al pie, siete seguidas
  tiene que verse desde la otra punta de la mesa. Los tres fondos son oscuros
  porque la letra va en blanco.
*/
const TRAMOS = [
  'bg-acento-600 text-xs',
  'bg-orange-600 text-sm',
  'bg-gradient-to-r from-orange-600 to-red-600 text-base',
] as const;

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
