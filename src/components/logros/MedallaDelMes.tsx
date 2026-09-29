import { cn } from '@/lib/cn';

/**
 * La medalla de un mes: un escudo con las tres letras del mes dentro.
 *
 * POR QUÉ SE ENSEÑAN TAMBIÉN LOS MESES FLOJOS
 *
 * El calendario sale entero desde el alta, con los meses en los que se practicó
 * poco. Uno que solo enseñara los meses buenos sería un escaparate, y lo que se
 * pide aquí es un registro de lo que se ha hecho.
 *
 * Lo que no hace es llamarle fallado a nada. Un mes por debajo del umbral
 * enseña sus días —«8 días»— y ya. La diferencia entre «8 días» y «mes perdido»
 * es la diferencia entre contar algo y reprochárselo a alguien, y en una
 * pantalla que se abre para sentirse bien con lo hecho esa diferencia lo es
 * todo.
 *
 * POR QUÉ CADA MES TIENE SU COLOR
 *
 * Doce tonos que dan la vuelta al año. Sin ellos, doce escudos idénticos se
 * leen como una lista; con ellos, un año entero se reconoce de un vistazo, que
 * es lo que convierte una rejilla en un calendario. El color no dice nada que
 * no diga el texto: dentro de cada escudo está su mes escrito.
 *
 * Se evitan a propósito el rojo y el verde esmeralda, que en esta aplicación
 * significan fallar y acertar: una medalla de marzo en rojo se leería como un
 * mes malo.
 */

const NOMBRES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/**
 * El tono de cada mes, como clase de color de la paleta.
 *
 * Es una clase de TEXTO y no de relleno porque el escudo se pinta con un
 * degradado de `currentColor` a `currentColor` translúcido: así el color sale
 * de la paleta de Tailwind —y no de un hexadecimal suelto que nadie sabría de
 * dónde salió— y a la vez llega dentro del SVG, donde las utilidades de
 * degradado de CSS no entran.
 */
const TONOS = [
  'text-sky-500',
  'text-cyan-500',
  'text-teal-500',
  'text-lime-500',
  'text-amber-500',
  'text-orange-500',
  'text-rose-500',
  'text-pink-500',
  'text-fuchsia-500',
  'text-violet-500',
  'text-indigo-500',
  'text-blue-500',
];

export interface PropsMedalla {
  /** `YYYY-MM`. */
  mes: string;
  dias: number;
  hacenFalta: number;
  ganada: boolean;
  enCurso: boolean;
}

export function MedallaDelMes({ mes, dias, hacenFalta, ganada, enCurso }: PropsMedalla) {
  const numero = Number(mes.slice(5, 7)) - 1;
  const ano = mes.slice(0, 4);

  /*
    El texto completo va en una sola frase y no repartido en tres trocitos:
    quien escucha la página oye «septiembre de 2026, 18 días de práctica,
    medalla ganada» de una vez, y no «SEP», «18», «días» como tres cosas
    sueltas sin relación entre ellas.
  */
  const cuenta = `${dias} ${dias === 1 ? 'día' : 'días'} de práctica`;
  const remate = ganada
    ? 'medalla ganada'
    : enCurso
      ? `vas por ${dias} de los ${hacenFalta} que hacen falta`
      : `no llegó a los ${hacenFalta} que hacen falta`;
  const etiqueta = `${NOMBRES[numero]} de ${ano}: ${cuenta}, ${remate}`;

  // Cada mes sale una sola vez en el calendario, así que su número basta para
  // que el degradado tenga un identificador único: dos `id` iguales en la misma
  // página harían que todas las medallas se pintaran con el color de la primera.
  const degradado = `medalla-${mes}`;

  return (
    <li className="flex flex-col items-center gap-1 text-center" title={etiqueta}>
      <span className="sr-only">{etiqueta}</span>

      <span aria-hidden className={cn('relative block w-full max-w-14', TONOS[numero])}>
        <svg viewBox="0 0 64 72" className="w-full" focusable="false">
          <defs>
            <linearGradient id={degradado} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.68" />
            </linearGradient>
          </defs>

          {/*
            Un escudo, no un círculo. Las medallas van justo encima de insignias
            redondas, y dos formas distintas se separan de un vistazo mucho
            mejor que dos tamaños del mismo círculo.
          */}
          <path
            d="M32 3 59 12.5V40c0 15.5-11.5 25.5-27 29.5C16.5 65.5 5 55.5 5 40V12.5z"
            fill={ganada ? `url(#${degradado})` : 'var(--superficie)'}
            stroke={ganada ? 'none' : 'var(--hueco)'}
            strokeWidth="3"
          />
        </svg>

        <span
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center pb-1.5 text-[0.65rem] font-extrabold leading-tight',
            ganada ? 'text-white' : 'text-[var(--texto-suave)]',
          )}
        >
          {CORTOS[numero]}
          <span className="text-[0.55rem] font-bold opacity-80">{ano.slice(2)}</span>
        </span>
      </span>

      <span
        aria-hidden
        className={cn(
          'text-[0.65rem] font-bold tabular-nums',
          ganada ? 'text-[var(--texto)]' : 'text-[var(--texto-suave)]',
        )}
      >
        {dias} {dias === 1 ? 'día' : 'días'}
      </span>
    </li>
  );
}
