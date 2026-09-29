/**
 * De qué color es cada logro y con qué dibujo.
 *
 * Es el mismo archivo que `components/juegos/aspecto.ts` para los juegos, y
 * existe por el mismo motivo: separar cómo se pinta de qué significa, para que
 * cambiar un tono no obligue a tocar la pantalla del perfil.
 *
 * POR QUÉ LOS DIBUJOS SON NUESTROS
 *
 * Las insignias son SVG dibujados aquí con la paleta que ya hay. No se copia
 * ninguna insignia de nadie: lo que se copia de las aplicaciones que hacen esto
 * bien es el oficio —el anillo que se llena, el número grande, la insignia
 * apagada que se enciende— y eso no es de nadie. Los personajes de esta
 * aplicación son Milo y las otras cuatro mascotas.
 *
 * POR QUÉ CADA UNO TIENE SU COLOR
 *
 * Seis insignias del mismo tamaño y la misma forma solo se distinguen leyendo
 * el título, y una rejilla se mira antes que se lee. Los seis tonos están
 * elegidos para que se separen entre sí puestos en una cuadrícula de dos
 * columnas en un móvil, y ninguno pisa un significado que la aplicación ya
 * tenga: el rojo es fallar y el esmeralda es acertar, así que ninguno de los
 * dos es aquí el color de un logro.
 *
 * El color nunca va solo. Cada tarjeta dice en palabras qué mide, cuántos
 * grados lleva y cuánto le falta, así que quien no distinga el ámbar del rosa
 * tiene toda la información igual.
 */

export type CodigoLogro =
  'CONSTANCIA' | 'LECCIONES' | 'VOZ' | 'CONVERSACION' | 'REPASO' | 'IMPECABLE';

export interface AspectoDeLogro {
  /** El color del disco y del anillo, en claro y en oscuro. */
  color: string;
  /** El fondo suave de la tarjeta cuando el logro ya tiene algún grado. */
  tinte: string;
  /** El borde de la tarjeta ganada. */
  borde: string;
}

export const ASPECTOS: Record<CodigoLogro, AspectoDeLogro> = {
  /* Naranja de fuego: es la racha, y la racha ya es una llama en toda la app. */
  CONSTANCIA: {
    color: 'text-orange-500 dark:text-orange-400',
    tinte: 'bg-orange-50 dark:bg-orange-950/40',
    borde: 'border-orange-200 dark:border-orange-900',
  },
  /* El morado de la marca, porque las lecciones SON la aplicación. */
  LECCIONES: {
    color: 'text-marca-600 dark:text-marca-400',
    tinte: 'bg-marca-50 dark:bg-marca-900/40',
    borde: 'border-marca-200 dark:border-marca-800',
  },
  /* Azul cielo, el mismo que ya identifica todo lo que se oye y se habla. */
  VOZ: {
    color: 'text-sky-600 dark:text-sky-400',
    tinte: 'bg-sky-50 dark:bg-sky-950/40',
    borde: 'border-sky-200 dark:border-sky-900',
  },
  /*
    Verde azulado. Es vecino del azul de VOZ y va justo a su lado en la rejilla,
    así que conviene decir por qué se elige igualmente: hablar y conversar son
    parientes —las dos son usar el idioma en vivo— y que sus insignias se
    parezcan un poco dice algo verdadero. Se separan porque el teal es más
    verde y porque los dibujos no se parecen en nada.
  */
  CONVERSACION: {
    color: 'text-teal-600 dark:text-teal-400',
    tinte: 'bg-teal-50 dark:bg-teal-950/40',
    borde: 'border-teal-200 dark:border-teal-900',
  },
  /* Índigo: el repaso es lo que sostiene todo lo demás sin verse. */
  REPASO: {
    color: 'text-indigo-600 dark:text-indigo-400',
    tinte: 'bg-indigo-50 dark:bg-indigo-950/40',
    borde: 'border-indigo-200 dark:border-indigo-900',
  },
  /*
    Ámbar, que es el color del acento de la aplicación y por tanto el que más
    se parece a una medalla. Se le da al logro más difícil de todos a propósito.
  */
  IMPECABLE: {
    color: 'text-acento-600 dark:text-acento-400',
    tinte: 'bg-acento-300/20 dark:bg-amber-950/40',
    borde: 'border-acento-300 dark:border-amber-900',
  },
};
