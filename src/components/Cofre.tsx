import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { faltan } from '@/lib/cuenta-atras';

export type EstadoCofre = 'abierto' | 'listo' | 'sin_practicar' | 'esperando' | 'perdido';

export interface CofreDelDia {
  franja: string;
  nombreEs: string;
  cuandoEs: string;
  estado: EstadoCofre;
  abreEnMinutos: number;
  cierraEnMinutos: number;
  monedas: number;
  piezas: number;
}

/**
 * Qué dice cada estado, en una frase que se pueda leer sola.
 *
 * Están juntas aquí y no repartidas por el JSX porque son el contenido de la
 * tarjeta: quien vuelva a tocar esto tiene que poder leer los cinco mensajes
 * seguidos y ver si alguno suena a regañina. Ninguno lo hace a propósito —
 * «hoy ya se cerró» no es «llegaste tarde»— y el que menos, el de la franja
 * perdida, que es el que le va a salir a quien tuvo un mal día.
 */
function mensaje(cofre: CofreDelDia): string {
  switch (cofre.estado) {
    case 'abierto':
      return 'Recogido. Mañana hay otro.';
    case 'listo':
      return `Ya practicaste en esta franja. Te quedan ${faltan(cofre.cierraEnMinutos)} para abrirlo.`;
    case 'sin_practicar':
      return `Practica un rato y se abre. La franja cierra en ${faltan(cofre.cierraEnMinutos)}.`;
    case 'esperando':
      return `Se abre en ${faltan(cofre.abreEnMinutos)}, ${cofre.cuandoEs}.`;
    case 'perdido':
      return `Hoy ya se cerró. Vuelve dentro de ${faltan(cofre.abreEnMinutos)}.`;
  }
}

/**
 * El dibujo del cofre.
 *
 * SVG a mano y sin librería, como todo lo demás de esta aplicación. Son dos
 * cajas y una cerradura: lo que hace que parezca un cofre no es el detalle, es
 * que la tapa se separe del cuerpo cuando está abierto.
 *
 * El movimiento va con `animate-latido`, que es una utilidad del tema, así que
 * con `prefers-reduced-motion` se congela sola por el bloque global de
 * `index.css`. No hace falta comprobarlo aquí: el estado —abierto o cerrado— se
 * ve igual sin un solo fotograma de animación, que es el requisito de verdad.
 */
function DibujoCofre({ abierto, apagado }: { abierto: boolean; apagado: boolean }) {
  return (
    <svg
      viewBox="0 0 64 56"
      className={cn('size-14 shrink-0', apagado && 'opacity-45 saturate-50')}
      aria-hidden="true"
    >
      {/* Cuerpo */}
      <rect x="6" y="24" width="52" height="28" rx="4" className="fill-acento-500" />
      <rect x="6" y="24" width="52" height="28" rx="4" className="fill-black/10" />
      <rect x="6" y="26" width="52" height="24" rx="3" className="fill-acento-500" />
      {/* Herrajes verticales */}
      <rect x="14" y="26" width="4" height="24" className="fill-acento-600" />
      <rect x="46" y="26" width="4" height="24" className="fill-acento-600" />

      {/* La tapa. Al abrirse gira hacia atrás sobre su bisagra. */}
      <g
        style={{
          transform: abierto ? 'rotate(-26deg)' : 'none',
          transformOrigin: '10px 26px',
          transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <path
          d="M6 26 A 26 18 0 0 1 58 26 L58 30 L6 30 Z"
          className={abierto ? 'fill-acento-400' : 'fill-acento-600'}
        />
        <rect x="6" y="28" width="52" height="4" rx="2" className="fill-acento-600" />
      </g>

      {/* La cerradura, que es lo que lo convierte en cofre y no en caja. */}
      <rect x="27" y="28" width="10" height="12" rx="2" className="fill-marca-700" />
      <circle cx="32" cy="34" r="2.2" className="fill-acento-300" />

      {/* Lo que sale al abrirlo: tres destellos y una moneda. */}
      {abierto && (
        <g className="animate-crecer">
          <circle cx="32" cy="18" r="6" className="fill-acento-300" />
          <path d="M20 12 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" className="fill-acento-400" />
          <path
            d="M46 10 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z"
            className="fill-acento-400"
          />
        </g>
      )}
    </svg>
  );
}

/**
 * Un cofre del día.
 *
 * La tarjeta dice siempre las cuatro cosas: de qué franja es, en qué horas cae,
 * en qué punto está y qué trae dentro. Lo último importa más de lo que parece:
 * un cofre que no dice qué paga es una caja de sorpresas, y una caja de
 * sorpresas es lo que hace que alguien lo abra por si acaso en vez de porque le
 * compensa. Aquí pone «10 monedas y 1 pieza» antes de abrirlo.
 */
export function Cofre({
  cofre,
  abriendo,
  error,
  alAbrir,
  retraso,
}: {
  cofre: CofreDelDia;
  abriendo: boolean;
  error: string | null;
  alAbrir: () => void;
  retraso: number;
}) {
  const abierto = cofre.estado === 'abierto';
  const listo = cofre.estado === 'listo';
  const apagado = cofre.estado === 'perdido' || cofre.estado === 'esperando';

  return (
    /*
      EL ANCHO DE 320 px ES LO QUE MANDA EN ESTA TARJETA.

      La primera versión ponía el dibujo, el texto y el botón en una sola fila.
      A 390 px se veía bien; a 320 el botón se quedaba con 90 px y al texto le
      sobraban dos palabras por línea: «Ya practicaste / en esta franja. / Te
      quedan 24 / min para / abrirlo.» Seis renglones para una frase.

      Así que el botón baja a su propia fila y ocupa el ancho entero, y a partir
      de 640 px vuelve al lado, que es donde cabe. Ganan las dos: el texto
      recupera los 320 px enteros y el botón pasa a ser el más fácil de acertar
      con el pulgar de toda la pantalla.
    */
    <article
      className={cn(
        'animate-entrada rounded-2xl border-2 border-b-4 bg-[var(--superficie)] p-4 sm:flex sm:items-start sm:gap-3',
        listo ? 'border-acento-500' : abierto ? 'border-marca-600' : 'border-[var(--borde)]',
      )}
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-start gap-3 sm:contents">
        <div className={cn('relative shrink-0', listo && 'animate-latido')}>
          <DibujoCofre abierto={abierto} apagado={apagado} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{cofre.nombreEs}</h3>
          <p className="mt-0.5 text-sm text-[var(--texto-suave)]">{mensaje(cofre)}</p>

          {/*
            Lo que trae, siempre a la vista y también cuando ya está abierto: así
            quien mira la tarjeta de mañana sabe por qué le conviene volver.
          */}
          <p className="mt-2 text-sm font-bold tabular-nums">
            <span aria-hidden>🪙 </span>
            {cofre.monedas} {cofre.monedas === 1 ? 'moneda' : 'monedas'}
            {cofre.piezas > 0 && (
              <>
                <span aria-hidden> · 🍂 </span>
                <span className="sr-only"> y </span>
                {cofre.piezas} {cofre.piezas === 1 ? 'pieza' : 'piezas'}
              </>
            )}
          </p>

          {error !== null && (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
        </div>
      </div>

      {/*
        El botón solo existe cuando se puede pulsar. Un botón apagado en los
        otros cuatro estados sería un botón que la mayoría de los días no hace
        nada, y el mensaje de al lado ya dice exactamente qué falta.
      */}
      {listo && (
        <Boton
          className="mt-3 min-h-12 shrink-0 sm:mt-0 sm:w-auto sm:self-center"
          disabled={abriendo}
          onClick={alAbrir}
          aria-label={`Abrir el cofre ${cofre.nombreEs.toLowerCase()}: ${cofre.monedas} monedas y ${cofre.piezas} pieza`}
        >
          {abriendo ? 'Abriendo…' : 'Abrir'}
        </Boton>
      )}

      {abierto && (
        <span
          className="mt-3 inline-flex shrink-0 rounded-full bg-marca-100 px-2.5 py-1 text-xs font-bold text-marca-800 sm:mt-0 sm:self-center dark:bg-marca-900/50 dark:text-marca-200"
          aria-label="Cofre ya recogido"
        >
          ✓ Hecho
        </span>
      )}
    </article>
  );
}
