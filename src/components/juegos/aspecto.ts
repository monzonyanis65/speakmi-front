import type { CodigoJuego } from './tipos';

/**
 * De qué color es cada juego.
 *
 * POR QUÉ NO ESTÁ EN `tipos.ts`
 *
 * Allí vive el contrato: qué juegos hay, qué entrenan, qué icono llevan. Eso lo
 * lee todo el mundo, incluida la pantalla final. Esto de aquí es solo cómo se
 * pinta el escaparate, y se separa para que cambiar un degradado no obligue a
 * tocar el archivo del que cuelgan los cuatro juegos.
 *
 * POR QUÉ CADA UNO TIENE SU COLOR
 *
 * En `tipos.ts` dos de los cuatro son del mismo morado, y con cuatro tarjetas
 * iguales de forma y casi iguales de color, la única forma de saber cuál es cuál
 * es leer el título. Un escaparate se mira, no se lee: si el naranja es la
 * velocidad y el verde son tus fallos, a la tercera visita ya se toca sin leer.
 *
 * Los tonos de texto van en pareja claro/oscuro y todos pasan de 4.5 sobre su
 * fondo. El color nunca va solo: el título y el «entrena qué» dicen lo mismo en
 * palabras.
 */
export interface AspectoDeJuego {
  /** El degradado de la placa del icono. */
  degradado: string;
  /** El borde de la tarjeta, del color del juego pero apagado. */
  borde: string;
  /** El fondo de la tira del récord. */
  tinte: string;
  /** El color del «entrena qué» y del número del récord. */
  texto: string;
  /**
   * El lavado de color de la esquina de la tarjeta.
   *
   * Aquí hubo un icono gigante al 6 % asomando por la esquina. Puesto se veía
   * bien; con el texto encima, no: un reloj traslúcido detrás de «Contrarreloj»
   * no es textura, es suciedad. El degradado hace el mismo trabajo —que la
   * tarjeta se lea como un cartel— sin meterse debajo de ninguna palabra.
   */
  lavado: string;
}

export const ASPECTOS: Record<CodigoJuego, AspectoDeJuego> = {
  CONTRARRELOJ: {
    degradado: 'from-orange-400 to-orange-600',
    borde: 'border-orange-200 dark:border-orange-900',
    tinte: 'bg-orange-50 dark:bg-orange-950/50',
    texto: 'text-orange-700 dark:text-orange-300',
    lavado: 'from-orange-50 dark:from-orange-950/60',
  },
  PAREJAS: {
    degradado: 'from-marca-400 to-marca-600',
    borde: 'border-marca-200 dark:border-marca-800',
    tinte: 'bg-marca-50 dark:bg-marca-900/50',
    texto: 'text-marca-700 dark:text-marca-300',
    lavado: 'from-marca-50 dark:from-marca-900/50',
  },
  CADENA: {
    degradado: 'from-emerald-400 to-emerald-600',
    borde: 'border-emerald-200 dark:border-emerald-900',
    tinte: 'bg-emerald-50 dark:bg-emerald-950/50',
    texto: 'text-emerald-700 dark:text-emerald-300',
    lavado: 'from-emerald-50 dark:from-emerald-950/60',
  },
  ESCUCHA: {
    degradado: 'from-sky-400 to-sky-600',
    borde: 'border-sky-200 dark:border-sky-900',
    tinte: 'bg-sky-50 dark:bg-sky-950/50',
    texto: 'text-sky-700 dark:text-sky-300',
    lavado: 'from-sky-50 dark:from-sky-950/60',
  },
  /*
    Verde azulado, y no el verde del acierto.

    En este juego el verde SIGNIFICA algo —letra en su sitio— y usar el mismo
    tono para la tarjeta lo gastaría antes de entrar. El teal se distingue del
    esmeralda de CADENA a simple vista y no choca con los tres colores que el
    tablero usa para hablar.
  */
  CINCO_LETRAS: {
    degradado: 'from-teal-400 to-teal-600',
    borde: 'border-teal-200 dark:border-teal-900',
    tinte: 'bg-teal-50 dark:bg-teal-950/50',
    texto: 'text-teal-700 dark:text-teal-300',
    lavado: 'from-teal-50 dark:from-teal-950/60',
  },
  /*
    Fucsia, y no el azul de lluvia que pedía el nombre.

    Escucha ya es azul cielo, y en un escaparate de tarjetas del mismo tamaño
    dos azules vecinos se tocan por error: se elige por color antes de leer el
    título, que es justo lo que dice el comentario de arriba. El agua la pone el
    icono y el fondo del propio juego; la tarjeta solo tiene que ser
    inconfundible.
  */
  CAEN: {
    degradado: 'from-fuchsia-400 to-fuchsia-600',
    borde: 'border-fuchsia-200 dark:border-fuchsia-900',
    tinte: 'bg-fuchsia-50 dark:bg-fuchsia-950/50',
    texto: 'text-fuchsia-700 dark:text-fuchsia-300',
    lavado: 'from-fuchsia-50 dark:from-fuchsia-950/60',
  },
  /*
    Rosa, que es el vecino incómodo del fucsia de CAEN y aun así el que toca.

    Los seis colores libres que quedaban o chocaban con un significado —el rojo
    es fallar, el ámbar es avisar, el esmeralda es acertar— o eran el mismo tono
    que otra tarjeta: el cian se confunde con el azul de ESCUCHA y el teal de
    CINCO_LETRAS, el violeta es el índigo de la marca. El rosa se distingue del
    fucsia por ser más cálido, y de propina dice lo que el juego hace: es el
    color de la señal de peligro sin ser el del error.
  */
  FALSOS_AMIGOS: {
    degradado: 'from-rose-400 to-rose-600',
    borde: 'border-rose-200 dark:border-rose-900',
    tinte: 'bg-rose-50 dark:bg-rose-950/50',
    texto: 'text-rose-700 dark:text-rose-300',
    lavado: 'from-rose-50 dark:from-rose-950/60',
  },
  /*
    Índigo, que es el hueco que quedaba.

    Ya hay un morado de marca (PAREJAS), un azul cielo (ESCUCHA) y un fucsia
    (CAEN), y el índigo se distingue de los tres puesto al lado. Dentro del
    juego el color no significa nada: allí el verde y el rojo son el acierto y
    el fallo, y la barra que se vacía va de la marca al aviso.
  */
  PARTICULAS: {
    degradado: 'from-indigo-400 to-indigo-600',
    borde: 'border-indigo-200 dark:border-indigo-900',
    tinte: 'bg-indigo-50 dark:bg-indigo-950/50',
    texto: 'text-indigo-700 dark:text-indigo-300',
    lavado: 'from-indigo-50 dark:from-indigo-950/60',
  },
};
