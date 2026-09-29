import { cn } from '@/lib/cn';
import { ASPECTOS, type CodigoLogro } from './aspecto';

/**
 * Una insignia: el anillo que se llena, el disco y el dibujo.
 *
 * CÓMO SE LEE SIN LEER
 *
 * Tres cosas a la vez, de fuera adentro. El anillo dice cuánto falta para el
 * siguiente grado; el disco dice si el logro está ganado —en color— o todavía
 * no —en gris—; y el número de abajo a la derecha dice en qué grado va.
 *
 * El anillo ES el número que hay escrito debajo de la insignia, dibujado. No
 * lleva ninguna información que no esté también en palabras, que es la regla
 * que hace que esto funcione para quien no ve los colores y para quien escucha
 * la página: todo lo que este dibujo dice, la tarjeta lo dice también escrito.
 *
 * Por eso el SVG entero va `aria-hidden`. Un lector de pantalla que anunciara
 * «gráfico, anillo al 48 %» justo antes de leer «19 de 25 lecciones» estaría
 * diciendo dos veces lo mismo y una de ellas mal.
 *
 * SIN MOVIMIENTO
 *
 * El anillo se dibuja ya lleno, no se llena animándose. Una animación aquí no
 * añadiría información y sí obligaría a un segundo camino para quien pidió
 * menos movimiento; y sobre todo, en una rejilla de seis, seis anillos
 * llenándose a la vez es un fuego artificial, no una pantalla.
 */

/** El radio del anillo dentro del lienzo de 100×100. */
const RADIO = 44;
const VUELTA = 2 * Math.PI * RADIO;

export interface PropsInsignia {
  code: CodigoLogro;
  /** Grados ganados. 0 dibuja la insignia apagada. */
  grado: number;
  /** Cuánto del siguiente grado se lleva, de 0 a 1. */
  avance: number;
  /** El lado en píxeles. 64 en la rejilla del perfil. */
  tamano?: number;
  className?: string;
}

export function Insignia({ code, grado, avance, tamano = 64, className }: PropsInsignia) {
  const aspecto = ASPECTOS[code];
  const ganada = grado > 0;
  const lleno = Math.max(0, Math.min(1, avance));

  // El degradado necesita un identificador único en todo el documento: si dos
  // insignias comparten el mismo, la segunda pinta con los colores de la
  // primera. El código del logro lo es, porque no se repite en la rejilla.
  const degradado = `insignia-${code}`;

  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: tamano, height: tamano }}
    >
      <svg viewBox="0 0 100 100" width={tamano} height={tamano} aria-hidden focusable="false">
        {/*
          El degradado va DENTRO del grupo que lleva el color, y no suelto en un
          `defs` arriba. En SVG, un `currentColor` dentro de una parada de
          degradado se resuelve contra el color heredado por el propio
          degradado, no contra el del elemento que lo usa: con el `defs` fuera,
          las seis insignias salían del color del texto de la página —o sea,
          casi negras— por muy bien puesta que estuviera la clase de color.
        */}
        <g className={aspecto.color}>
          <defs>
            <linearGradient id={degradado} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.72" />
            </linearGradient>
          </defs>
        </g>

        {/* El carril del anillo. Siempre entero, para que se vea cuánto falta. */}
        <circle
          cx="50"
          cy="50"
          r={RADIO}
          fill="none"
          stroke="var(--hueco)"
          strokeWidth="7"
          className={ganada ? undefined : 'opacity-70'}
        />

        {/*
          Lo llenado. Empieza arriba —de ahí el giro de un cuarto— porque un
          anillo que empieza a las tres en punto no se lee como un progreso.
          La punta redonda es para que un avance pequeño se vea: con punta
          cuadrada, un 2 % es un píxel que parece suciedad.
        */}
        <g className={aspecto.color}>
          {lleno > 0 && (
            <circle
              cx="50"
              cy="50"
              r={RADIO}
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${VUELTA * lleno} ${VUELTA}`}
              transform="rotate(-90 50 50)"
            />
          )}

          <circle
            cx="50"
            cy="50"
            r="33"
            fill={ganada ? `url(#${degradado})` : 'var(--superficie)'}
            stroke={ganada ? 'none' : 'var(--hueco)'}
            strokeWidth="2"
          />
        </g>

        {/*
          El dibujo va blanco sobre el disco de color y apagado sobre el gris.
          En el apagado se usa `--texto-suave`, que pasa el contraste mínimo en
          los dos temas: una insignia sin ganar tiene que poder reconocerse,
          porque es justo la que hay que mirar para saber qué falta por hacer.
        */}
        <Dibujo code={code} tinta={ganada ? '#ffffff' : 'var(--texto-suave)'} />
      </svg>

      {/*
        El grado, como una chapita. Va fuera del SVG para que use la tipografía
        de la aplicación y escale con el tamaño de letra del sistema, que dentro
        de un `viewBox` no haría.
      */}
      {ganada && (
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full border-2 border-[var(--fondo)] bg-[var(--texto)] font-extrabold tabular-nums text-[var(--fondo)]',
            'size-[38%] text-[0.6rem]',
          )}
        >
          {grado}
        </span>
      )}
    </span>
  );
}

/**
 * El dibujo de cada logro.
 *
 * Todos caben en un círculo de radio 22 alrededor del centro, que es lo que
 * deja el disco. Son formas planas y sin detalle fino a propósito: a 64 px en
 * un móvil, un dibujo con líneas de un píxel se convierte en una mancha.
 */
function Dibujo({ code, tinta }: { code: CodigoLogro; tinta: string }) {
  switch (code) {
    // Una llama. Es la racha, y la racha ya es una llama en toda la aplicación.
    case 'CONSTANCIA':
      return (
        <path
          fill={tinta}
          d="M50 30c8 9 13 15 13 23a13 13 0 0 1-26 0c0-5 3-9 6-13 1 4 3 6 5 7 1-6 1-12 2-17z"
        />
      );

    // Un libro abierto: las dos páginas y el lomo en medio.
    case 'LECCIONES':
      return (
        <path
          fill={tinta}
          d="M31 36h13c3 0 5 2 5 4v24c0-2-2-4-5-4H31zm38 0H56c-3 0-5 2-5 4v24c0-2 2-4 5-4h13z"
        />
      );

    /*
      Cinco barras de sonido. Se dibujan con rectángulos y no con un trazo
      ondulado porque una onda fina desaparece a este tamaño, y porque las
      barras ya son cómo esta aplicación enseña que está escuchando.
    */
    case 'VOZ':
      return (
        <>
          {[
            { x: 32, alto: 14 },
            { x: 40, alto: 26 },
            { x: 48, alto: 38 },
            { x: 56, alto: 24 },
            { x: 64, alto: 12 },
          ].map((barra) => (
            <rect
              key={barra.x}
              fill={tinta}
              x={barra.x}
              y={50 - barra.alto / 2}
              width="5"
              height={barra.alto}
              rx="2.5"
            />
          ))}
        </>
      );

    // Dos bocadillos, uno detrás de otro: conversar es que hablen los dos.
    case 'CONVERSACION':
      return (
        <>
          <path
            fill={tinta}
            d="M30 32h28a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H43l-9 7v-7h-4a5 5 0 0 1-5-5V37a5 5 0 0 1 5-5z"
          />
          <path
            fill={tinta}
            d="M46 58h24a4 4 0 0 0 4-4V42a4 4 0 0 0-4-4h-2v12a6 6 0 0 1-6 6z"
            className="opacity-75"
          />
        </>
      );

    /*
      Una flecha que da la vuelta: lo que se falló vuelve. Es la misma idea que
      el repaso espaciado, dibujada.
    */
    case 'REPASO':
      return (
        <>
          <path
            d="M50 31a19 19 0 1 1-18 25"
            fill="none"
            stroke={tinta}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path fill={tinta} d="M50 22l11 9-11 9z" />
        </>
      );

    // Una estrella. Es la forma que ya significa «perfecto» en todas partes.
    case 'IMPECABLE':
      return (
        <path
          fill={tinta}
          d="M50 28l6.5 13.2 14.5 2.1-10.5 10.2 2.5 14.5L50 61.2l-13 6.8 2.5-14.5L29 43.3l14.5-2.1z"
        />
      );
  }
}
