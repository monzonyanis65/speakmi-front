/**
 * Lo que el servidor manda de las misiones.
 *
 * Está aparte del componente porque lo leen tres sitios —el panel de la ruta,
 * la pantalla entera y el resumen del final de una lección— y una copia del
 * tipo en cada uno es la forma más fácil de que un día una se quede vieja.
 *
 * TODOS estos números los calcula el servidor, incluido el `terminaEl` de la
 * cuenta atrás. Aquí no se deduce ninguno: si el navegador decidiera qué día es
 * o cuánto se lleva hecho, bastaría con cambiar la hora del móvil para cobrar
 * las misiones de todo el mes.
 */

export interface MisionDiaria {
  codigo: string;
  tituloEs: string;
  icono: string;
  hecho: number;
  objetivo: number;
  xp: number;
  cumplida: boolean;
}

export interface DesafioDelMes {
  mes: string;
  tituloEs: string;
  hecho: number;
  objetivo: number;
  xp: number;
  congelados: number;
  cumplida: boolean;
  terminaEl: string;
  diasQueQuedan: number;
}

export interface Misiones {
  dia: string;
  /** La medianoche que viene, en ISO. */
  terminaEl: string;
  diarias: MisionDiaria[];
  mes: DesafioDelMes | null;
  /** Lo que se acaba de cumplir Y cobrar. Llega lleno una sola vez. */
  recienCumplidas: string[];
}

/**
 * Cuánto falta, en palabras.
 *
 * Se cuenta en horas y minutos hasta el final, y NO en segundos. Un contador
 * que baja de segundo en segundo en la pantalla de inicio es un reloj de bomba:
 * mete prisa a alguien que venía a estudiar tranquilo, y encima repinta la
 * pantalla sesenta veces por minuto para no decir nada nuevo. Por minutos dice
 * exactamente lo mismo.
 *
 * Por debajo de una hora se enseñan solo los minutos, porque «0 h 12 min» se
 * lee peor que «12 min» y en ese momento lo único que importa es que queda
 * poco.
 */
export function cuantoFalta(terminaEl: string, ahora: number = Date.now()): string {
  const restante = Date.parse(terminaEl) - ahora;
  if (!Number.isFinite(restante) || restante <= 0) return 'renovando…';

  const minutos = Math.floor(restante / 60_000);
  const horas = Math.floor(minutos / 60);

  if (horas >= 24) return `${Math.floor(horas / 24)} d ${horas % 24} h`;
  if (horas >= 1) return `${horas} h ${minutos % 60} min`;
  return `${Math.max(minutos, 1)} min`;
}

/** Cuánto se lleva, de 0 a 1. Topado, que una barra al 140 % no es una barra. */
export function avance(hecho: number, objetivo: number): number {
  if (objetivo <= 0) return 0;
  return Math.min(1, Math.max(0, hecho / objetivo));
}
