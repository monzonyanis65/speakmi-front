import type { Especie } from '@/components/mascotas';
import { ESPECIES } from '@/components/mascotas';

/**
 * Las reglas de una escena de diálogo, sin nada que se pinte.
 *
 * Aquí viven las dos decisiones que se pueden equivocar en silencio —cuánto se
 * queda cada réplica en pantalla y qué animal hace cada papel— y por eso viven
 * fuera del componente: son las únicas dos cosas de toda la escena que se
 * pueden comprobar sin montar un navegador.
 */

/** Un papel del guion. No es una especie: quién lo interpreta se decide aquí. */
export type Papel = 'A' | 'B';

export interface Turno {
  quien: Papel;
  en: string;
  es: string;
  animo?: string;
}

// --- Cuánto dura un turno ----------------------------------------------------

/**
 * Caracteres por segundo de quien lee una frase INGLESA que tiene que entender.
 *
 * Catorce, no veintiocho. Veintiocho es la velocidad de quien repasa algo que ya
 * sabe; catorce a dieciocho es la de quien todavía está descifrando, que es
 * exactamente el que mira esta escena. En esta casa ya hubo un juego injugable
 * por suponer veintiocho, y el precio de equivocarse aquí es peor que allí: una
 * réplica que se va antes de tiempo no se puede volver a mirar más despacio, se
 * pierde y con ella se pierde el hilo de la conversación.
 *
 * Se coge el suelo del rango y no la media, porque esto es un mínimo: quien lee
 * a dieciocho tiene el botón de siguiente y se adelanta cuando quiera. Quien lee
 * a catorce no tiene forma de pedir más tiempo si la escena ya pasó de página.
 */
export const CPS_INGLES = 14;

/**
 * Y de la traducción, que va en su idioma y solo se enseña si la piden.
 *
 * Veinte y no catorce porque leer español no es descifrarlo: se reconoce la
 * frase entera de un vistazo. Es el mismo número que usan las glosas de los
 * juegos, y conviene que siga siendo el mismo en los dos sitios.
 */
export const CPS_GLOSA = 20;

/**
 * El respiro del final de la réplica.
 *
 * No es margen de seguridad: es el rato en que el personaje ya ha terminado de
 * hablar y se queda con la cara que le toca. Sin ese silencio las réplicas se
 * pisan y la escena se lee como una lista de frases en vez de como dos
 * personas hablando.
 */
export const COLA_TURNO = 700;

/**
 * Lo que aguanta en pantalla la réplica más corta.
 *
 * «Half?» son cinco caracteres, o sea un tercio de segundo. Hay un suelo porque
 * lo que cuesta un turno no es solo leerlo: es darse cuenta de que ha cambiado
 * quién habla, mirar al otro lado y volver a leer.
 */
export const MINIMO_TURNO = 1600;

/** Cuánto se queda esta réplica antes de pasar a la siguiente, en milisegundos. */
export function msDeTurno(turno: Pick<Turno, 'en' | 'es'>, conGlosa: boolean): number {
  const ingles = (turno.en.trim().length / CPS_INGLES) * 1000;
  // La traducción solo cuesta tiempo cuando está puesta. Presupuestarla siempre
  // dejaría la escena arrastrándose para quien ni la ha abierto.
  const glosa = conGlosa ? (turno.es.trim().length / CPS_GLOSA) * 1000 : 0;
  return Math.max(MINIMO_TURNO, Math.round(ingles + glosa) + COLA_TURNO);
}

/**
 * En qué momento del turno el personaje deja de hablar y se queda con su cara.
 *
 * Es el mismo número que la cola, mirado desde el otro lado. Va aparte porque el
 * componente necesita los dos instantes y calcularlos por separado en el efecto
 * sería el sitio perfecto para que un día dejaran de cuadrar.
 */
export function msHablando(turno: Pick<Turno, 'en' | 'es'>, conGlosa: boolean): number {
  return Math.max(600, msDeTurno(turno, conGlosa) - COLA_TURNO);
}

// --- Quién hace cada papel ---------------------------------------------------

/**
 * El elenco, en un orden fijo.
 *
 * Se escribe aquí en vez de leer las claves de `ESPECIES` porque el reparto
 * tiene que salir SIEMPRE igual: el orden de las claves de un objeto es estable
 * en la práctica, pero depende de cómo se construyó, y basta con reordenar el
 * catálogo de un agente para que a media escena cambien los dos actores.
 *
 * Que estén todas lo comprueba una prueba contra `ESPECIES`: si alguien añade
 * un animal sexto, se entera de que también hay que meterlo aquí.
 */
const ELENCO: Especie[] = [
  'PET_MILO',
  'PET_GATO',
  'PET_PERRO',
  'PET_BUHO',
  'PET_ZORRO',
  // Los cuatro del reparto entran DETRÁS, sin tocar el orden de los cinco de
  // arriba. Aun así los actores de las escenas que ya existían cambian, porque
  // el sorteo reparte entre nueve y antes repartía entre cinco: eso no se puede
  // evitar al crecer el elenco, y es preferible a que un personaje nuevo no
  // actúe nunca.
  'CHAR_ZOE',
  'CHAR_LIAM',
  'CHAR_BARNABY',
  'CHAR_BEEPER',
];

/** Qué animal interpreta cada papel. */
export type Reparto = Record<Papel, Especie>;

/**
 * Un número a partir de un texto, siempre el mismo. Es FNV-1a de 32 bits.
 *
 * Hace falta que sea una función y no un azar porque el reparto tiene que
 * aguantar: si se sorteara al montar, salir de la lección y volver cambiaría los
 * dos actores a media escena y ya no se sabría quién era A.
 */
function numeroDe(texto: string): number {
  let n = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    n ^= texto.charCodeAt(i);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}

/**
 * De qué lección es este ejercicio.
 *
 * Los códigos son `L5-U3-03-E04`, o sea lección más ejercicio. El reparto cuelga
 * de la LECCIÓN y no del ejercicio a propósito: dos escenas seguidas de la misma
 * lección son la misma conversación continuada, y si el papel A cambiara de
 * animal entre una y otra nadie sabría que es la misma persona.
 */
export function codigoDeLeccion(codigoEjercicio: string): string {
  return codigoEjercicio.replace(/-E\d+$/, '');
}

/**
 * Quién actúa en esta lección.
 *
 * El contenido solo dice «A» y «B». El reparto lo pone la pantalla, y esa
 * separación es la que permite cambiar de animales, añadir uno o dejar que actúe
 * la mascota de cada uno sin tocar ni una de las 96 unidades.
 */
export function repartoDe(codigoLeccion: string): Reparto {
  const a = numeroDe(codigoLeccion) % ELENCO.length;
  /*
    El segundo se elige entre los CUATRO que quedan, no entre los cinco.
    Sumando al menos uno, A y B no pueden salir el mismo animal, y así no hace
    falta sortear hasta que salgan distintos —que es lo mismo pero sin garantía
    de terminar—. Dos personajes idénticos hablando entre ellos sería la única
    forma de romper del todo una escena: no se distingue quién dice qué.
  */
  const b = (a + 1 + (numeroDe(`${codigoLeccion}:B`) % (ELENCO.length - 1))) % ELENCO.length;
  return { A: ELENCO[a]!, B: ELENCO[b]! };
}

/**
 * Cambia `{A}` y `{B}` por el nombre del animal que hace cada papel.
 *
 * Hace falta porque el contenido no puede nombrar a nadie: escribe papeles, y
 * los papeles no se ven en pantalla. Una pregunta que dijera «¿qué le corrige B
 * a A?» sería ilegible delante de dos bichos que se llaman Milo y Tuco, y
 * escribir «Milo» en el JSON ataría la escena a un reparto concreto, que es
 * justo lo que se quiere evitar.
 *
 * Solo se usa en lo que pinta esta pantalla —la pregunta y las opciones—. En la
 * explicación no, porque esa la pinta la corrección y allí no hay reparto: una
 * llave sin sustituir se leería tal cual. El validador lo comprueba.
 */
export function conNombres(
  texto: string,
  reparto: Reparto,
  nombre: (e: Especie) => string,
): string {
  return texto.replace(/\{([AB])\}/g, (_, papel: Papel) => nombre(reparto[papel]));
}

/** Solo para las pruebas: el elenco tal como lo ve el reparto. */
export function elencoDelReparto(): Especie[] {
  return [...ELENCO];
}

/** Las especies que existen, para poder comprobar que el elenco no se deja ninguna. */
export function especiesDelCatalogo(): Especie[] {
  return Object.keys(ESPECIES) as Especie[];
}
