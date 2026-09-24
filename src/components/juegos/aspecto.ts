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
};
