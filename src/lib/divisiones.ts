/**
 * Los colores de las divisiones.
 *
 * El servidor manda el código y el nombre; el color lo pone aquí la pantalla.
 * No es una separación por gusto: el color es una decisión de diseño que cambia
 * con el tema claro y oscuro, y meterlo en la respuesta de la API lo convertiría
 * en un dato que hay que versionar y que un navegador viejo pintaría mal.
 *
 * Los nombres son nuestros —Susurro, Eco, Voz, Coro, Pregón: cuánto lejos llega
 * tu voz— y los colores también. No hay metales ni piedras preciosas, que es lo
 * que usa todo el mundo y además es de quien lo usó primero.
 *
 * NINGÚN COLOR DICE NADA POR SÍ SOLO
 *
 * El nombre de la división va escrito siempre al lado de su color. Quien no
 * distingue el ámbar del fucsia tiene que poder saber en qué división está, y
 * la forma de conseguirlo no es elegir colores más separados: es escribirlo.
 */

export interface PinturaDeDivision {
  /** Fondo y texto de la pastilla con el nombre. */
  pastilla: string;
  /** El borde de la tarjeta grande. */
  borde: string;
  /** El relleno suave del fondo de la tarjeta. */
  fondo: string;
  /** El bloque del podio y la barra: es el color a pelo. */
  bloque: string;
}

const NEUTRA: PinturaDeDivision = {
  pastilla: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  borde: 'border-slate-300 dark:border-slate-600',
  fondo: 'bg-slate-50 dark:bg-slate-800/60',
  bloque: 'bg-slate-400 dark:bg-slate-500',
};

const PINTURAS: Record<string, PinturaDeDivision> = {
  SUSURRO: NEUTRA,
  ECO: {
    pastilla: 'bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-50',
    borde: 'border-sky-300 dark:border-sky-700',
    fondo: 'bg-sky-50 dark:bg-sky-950/50',
    bloque: 'bg-sky-400 dark:bg-sky-600',
  },
  VOZ: {
    pastilla: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-50',
    borde: 'border-emerald-300 dark:border-emerald-700',
    fondo: 'bg-emerald-50 dark:bg-emerald-950/50',
    bloque: 'bg-emerald-400 dark:bg-emerald-600',
  },
  CORO: {
    pastilla: 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-50',
    borde: 'border-amber-300 dark:border-amber-700',
    fondo: 'bg-amber-50 dark:bg-amber-950/50',
    bloque: 'bg-amber-400 dark:bg-amber-600',
  },
  PREGON: {
    pastilla: 'bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-800 dark:text-fuchsia-50',
    borde: 'border-fuchsia-300 dark:border-fuchsia-700',
    fondo: 'bg-fuchsia-50 dark:bg-fuchsia-950/50',
    bloque: 'bg-fuchsia-400 dark:bg-fuchsia-600',
  },
};

/** Un código que no conozcamos se pinta neutro, nunca en blanco. */
export function pinturaDe(codigo: string): PinturaDeDivision {
  return PINTURAS[codigo] ?? NEUTRA;
}
