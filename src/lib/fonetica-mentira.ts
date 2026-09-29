import type { EvaluacionFonetica, PalabraConFonemas } from '@/lib/fonetica';

/**
 * Una evaluación fonética inventada, mientras el servidor no la dé.
 *
 * El adaptador que puntúa fonema a fonema lo está escribiendo otro a la vez que
 * esta pantalla. Esto responde igual que él para poder terminar y mirar la
 * pantalla sin esperar a nadie, y NO se enseña nunca sin avisar en pantalla de
 * que es mentira: el mismo trato que `lib/shadowing.ts` tiene con su doble.
 *
 * No son números al azar. Son los fallos exactos de un hispanohablante de nivel
 * intermedio, elegidos para que la pantalla tenga que resolver los casos que de
 * otra forma no se ven nunca:
 *
 *   · Dos sonidos muy por debajo (/v/ y /iː/) y varios a medias, para comprobar
 *     que enseña dos y esconde el resto.
 *   · Una /z/ al final de «weekends», que cae en el patrón de consonante final:
 *     la tarjeta tiene que contar las dos cosas, el sonido y el sitio.
 *   · Una /d/ floja sin ficha y sin patrón, que tiene que contarse en el total y
 *     NO salir en ninguna lista.
 *   · Un corte que sobra y un enlace que falta, uno de cada.
 */

/**
 * Cómo se reparte cada palabra en sonidos, y qué nota saca cada uno.
 *
 * La transcripción está escrita a mano en inglés americano corriente. No es un
 * diccionario: es exactamente el vocabulario de la frase del doble del shadowing.
 */
const FONEMAS_POR_PALABRA: Record<string, ReadonlyArray<readonly [string, number]>> = {
  i: [['aɪ', 91]],
  usually: [
    ['j', 58],
    ['uː', 80],
    ['ʒ', 64],
    ['u', 85],
    ['ə', 55],
    ['l', 82],
    ['i', 88],
  ],
  get: [
    ['g', 90],
    ['ɛ', 86],
    ['t', 74],
  ],
  up: [
    ['ʌ', 63],
    ['p', 78],
  ],
  at: [
    ['æ', 57],
    ['t', 66],
  ],
  seven: [
    ['s', 86],
    ['ɛ', 88],
    ['v', 35],
    ['ə', 62],
    ['n', 84],
  ],
  but: [
    ['b', 89],
    ['ʌ', 81],
    ['t', 77],
  ],
  on: [
    ['ɑ', 84],
    ['n', 90],
  ],
  weekends: [
    ['w', 88],
    ['iː', 74],
    ['k', 80],
    ['ɛ', 85],
    ['n', 82],
    // Sin ficha y sin patrón: no es la última, así que no se enseña. Está para
    // comprobar que se cuenta en el total y desaparece de las listas.
    ['d', 58],
    ['z', 46],
  ],
  sleep: [
    ['s', 84],
    ['l', 86],
    ['iː', 41],
    ['p', 70],
  ],
  in: [
    ['ɪ', 66],
    ['n', 87],
  ],
};

/** Quita la puntuación de alrededor para poder buscar «seven,» en la tabla. */
function limpia(palabra: string): string {
  return palabra.toLowerCase().replace(/[^a-z']/g, '');
}

/**
 * La evaluación de mentira para unas palabras concretas.
 *
 * Se construye a partir de las palabras que de verdad hay en pantalla y no de
 * una lista fija, porque el shadowing corrige de trozo en trozo: con índices
 * fijos, los cortes señalarían palabras de otro trozo. Una palabra que no esté
 * en la tabla se queda fuera, que es lo mismo que haría un alineador de verdad
 * con algo que no supiera transcribir.
 */
export function foneticaDeMentira(palabras: readonly string[]): Required<EvaluacionFonetica> {
  const fonemas: PalabraConFonemas[] = [];

  palabras.forEach((palabra, indicePalabra) => {
    const receta = FONEMAS_POR_PALABRA[limpia(palabra)];
    if (!receta) return;
    fonemas.push({
      palabra,
      indicePalabra,
      fonemas: receta.map(([simbolo, puntuacion]) => ({ simbolo, puntuacion })),
    });
  });

  // «get up» va pegado y se cortó; «on weekends» se dijo sin enlazar.
  const cortes: EvaluacionFonetica['cortes'] = [];
  const up = palabras.findIndex((palabra) => limpia(palabra) === 'up');
  if (up > 0) cortes.push({ indicePalabra: up, tipo: 'sobra' });
  const weekends = palabras.findIndex((palabra) => limpia(palabra) === 'weekends');
  if (weekends > 0) cortes.push({ indicePalabra: weekends, tipo: 'falta' });

  return { fonemas, cortes, prosodia: 58 };
}
