import {
  PATRONES,
  normalizarSimbolo,
  sonidoDe,
  type IdPatron,
  type Patron,
  type Sonido,
} from '@/data/fonemas';

/**
 * Qué se hace con la puntuación por fonema que manda el servidor.
 *
 * El contrato de abajo está cerrado y lo escribe otro: aquí no se toca, se
 * consume. Lo que vive en este archivo es la decisión de QUÉ enseñar de todo lo
 * que llega, que es donde está el trabajo de verdad, y va aparte del componente
 * para poder probarla sin montar una pantalla.
 *
 * TRES ESTADOS, NO DOS. Es la regla que sostiene todo lo demás:
 *
 *   undefined → este servidor todavía no evalúa fonética. No se enseña nada, ni
 *               siquiera un hueco: no hay nada que contar.
 *   null      → se intentó medir y no se pudo (audio corto, proveedor caído, lo
 *               que sea). Se DICE que no se pudo, y no se enseña ningún número.
 *               Un cero aquí sería una mentira con cara de dato.
 *   []        → se midió y salió limpio. Es una buena noticia y se enseña como
 *               tal, que es justo lo contrario de «no se pudo medir».
 *
 * Confundir los tres es fácil en JavaScript y caro aquí: quien lee «0 %» de
 * enlaces cuando lo que pasó es que el micro no grabó nada se cree que lo hizo
 * fatal, y se pone a arreglar algo que a lo mejor ya hacía bien.
 */

/** Lo que puntúa el servidor de un sonido suelto. De 0 a 100. */
export interface FonemaPuntuado {
  simbolo: string;
  puntuacion: number;
}

export interface PalabraConFonemas {
  palabra: string;
  indicePalabra: number;
  fonemas: FonemaPuntuado[];
}

/**
 * Un sitio donde el encadenado no salió.
 *
 * `sobra` es un corte donde no tocaba: separaste dos palabras que van pegadas.
 * `falta` es al revés: se comió el enlace y las dos palabras se fundieron de más.
 */
export interface Corte {
  indicePalabra: number;
  tipo: 'sobra' | 'falta';
}

/** Los tres campos nuevos del contrato, tal cual llegan. */
export interface EvaluacionFonetica {
  fonemas?: PalabraConFonemas[] | null;
  cortes?: Corte[] | null;
  prosodia?: number | null;
}

/**
 * Por debajo de esto se considera que el sonido no salió.
 *
 * Setenta y no cincuenta: los alineadores fonéticos puntúan flojo hasta a los
 * nativos, y un umbral bajo solo dejaría pasar los desastres, que son los que ya
 * se oyen sin ayuda. Lo que enseña es el sonido que sale a medias muchas veces.
 */
export const UMBRAL_SONIDO = 70;

/**
 * Cuántos sonidos se explican por intento.
 *
 * DOS, y es la decisión más importante de toda la pantalla. Un desglose completo
 * de los sonidos que te han salido mal es, leído por una persona, una lista de
 * defectos: quien acaba de leer una frase en alto y recibe nueve rojos no vuelve
 * a darle al micrófono. Con dos, además, hay alguna posibilidad de acordarse de
 * ellos al hablar; con nueve no hay ninguna.
 */
export const CUANTOS_ENSENAR = 2;

export interface SonidoFlojo {
  /** El símbolo tal cual llegó, para poder enseñarlo. */
  simbolo: string;
  /**
   * La ficha del sonido, si tenemos una.
   *
   * Puede ser null y aun así haber tarjeta: la /s/ de «school» y la /d/ de «and»
   * no tienen ficha —un hispanohablante sabe hacer esos dos sonidos de sobra— y
   * sin embargo hay muchísimo que explicar sobre ellas, que es lo que cuenta el
   * patrón de al lado. Lo que nunca se enseña es un símbolo sin ficha NI patrón.
   */
  sonido: Sonido | null;
  /** Las palabras del texto donde pasó, sin repetir y en orden de aparición. */
  palabras: string[];
  /** Cuántas veces apareció por debajo del umbral. */
  veces: number;
  /** La puntuación más baja de todas sus apariciones. */
  peor: number;
  /**
   * Cuánto se gana arreglándolo: la suma de lo que le falta a cada aparición
   * para llegar al umbral.
   *
   * Es lo que ordena la lista, y no la peor nota, a propósito. Un sonido que se
   * queda en 65 cuatro veces cuesta más caro que uno que se hunde a 40 una sola
   * vez, porque sale en cuatro palabras y va a seguir saliendo. Ordenar por la
   * peor nota pondría siempre arriba el accidente puntual.
   */
  deuda: number;
  /** El patrón de posición que lo explica mejor que el sonido, si lo hay. */
  patron: Patron | null;
}

export interface Analisis {
  /** De más deuda a menos. Solo los que sabemos explicar. */
  flojos: SonidoFlojo[];
  /** Cuántos sonidos se midieron en total. */
  total: number;
  /** Cuántos llegaron al umbral. Se enseña porque es la mayoría, casi siempre. */
  limpios: number;
}

/**
 * Consonantes del inglés, para saber si un fonema cierra la palabra con
 * consonante sin tener que tener ficha de todas.
 *
 * Están en forma normalizada. La lista no pretende ser el inventario oficial:
 * pretende contestar «¿esto es una consonante?» sin equivocarse con una vocal.
 */
const CONSONANTES_IPA = new Set(
  [
    'p',
    'b',
    't',
    'd',
    'k',
    'g',
    'ɡ',
    'f',
    'v',
    'θ',
    'ð',
    's',
    'z',
    'ʃ',
    'ʒ',
    'h',
    'tʃ',
    'dʒ',
    'ʧ',
    'ʤ',
    'm',
    'n',
    'ŋ',
    'l',
    'r',
    'ɹ',
    'j',
    'w',
  ].map(normalizarSimbolo),
);

/** Letras que, detrás de una s inicial, forman el grupo que el español no sabe arrancar. */
const TRAS_LA_ESE = /^s[bcdfgklmnpqtvw]/i;

/**
 * Qué patrón de posición explica este fallo mejor que la ficha del sonido.
 *
 * Se mira la POSICIÓN, no la puntuación, porque el sonido en sí suele estar bien
 * hecho: la /s/ de «school» es la misma /s/ de «sol». Lo que falla es lo que la
 * boca añade delante o se come detrás, y eso no se arregla practicando el sonido.
 */
export function patronDe(
  palabra: string,
  indice: number,
  total: number,
  simbolo: string,
): Patron | null {
  const normal = normalizarSimbolo(simbolo);

  if (indice === 0 && normal === 's' && TRAS_LA_ESE.test(palabra)) {
    return PATRONES['ese-inicial'];
  }

  // Solo cuenta como final si de verdad hay algo delante: una palabra de un solo
  // sonido no tiene «final» que comerse.
  if (indice === total - 1 && total > 1 && CONSONANTES_IPA.has(normal)) {
    return PATRONES['consonante-final'];
  }

  return null;
}

/**
 * Reparte la culpa entre sonidos y los ordena por lo que cuesta cada uno.
 *
 * Los símbolos de los que no tenemos NADA que contar —ni ficha del sonido ni
 * patrón de posición— se cuentan en el total pero no entran en la lista. Enseñar
 * «/ɔɪ/ 43» sin nada debajo no le enseña a nadie a mover la lengua; es un
 * reproche con formato de dato, que es justo lo que esta pantalla no quiere ser.
 * Si un símbolo aparece mucho por aquí, la respuesta es escribirle una ficha en
 * `data/fonemas.ts`, no pintarlo pelado.
 */
export function analizar(fonemas: readonly PalabraConFonemas[]): Analisis {
  const porSonido = new Map<string, SonidoFlojo>();
  let total = 0;
  let limpios = 0;

  for (const palabra of fonemas) {
    palabra.fonemas.forEach((fonema, i) => {
      total += 1;
      if (fonema.puntuacion >= UMBRAL_SONIDO) {
        limpios += 1;
        return;
      }

      const patron = patronDe(palabra.palabra, i, palabra.fonemas.length, fonema.simbolo);
      const ficha = sonidoDe(fonema.simbolo);
      /*
        La ficha de /p/ /t/ /k/ habla del soplo de aire que va DETRÁS de ellas al
        empezar una palabra. En mitad o al final de la palabra ese consejo no
        aplica y mandaría a soplar donde no toca, así que ahí se descarta: lo que
        queda es el patrón de consonante final, que es lo que de verdad pasa.
      */
      const sonido = ficha && ficha.soloAlPrincipio && i !== 0 ? null : ficha;

      // Sin ficha y sin patrón no hay nada que enseñar. Pintar «/ɔɪ/ 43» a pelo
      // es un reproche con formato de dato, no una lección.
      if (!sonido && !patron) return;

      /*
        La clave junta el sonido y el patrón, no solo el sonido. Si la misma /d/
        se cae al final de «and» y además falla en medio de otra palabra, son dos
        consejos distintos —uno es «no te comas el final», el otro es sobre la d
        misma— y fundirlos en una tarjeta daría un consejo que no sirve para
        ninguno de los dos casos.
      */
      const clave = `${normalizarSimbolo(fonema.simbolo)}|${patron?.id ?? ''}`;
      const previo = porSonido.get(clave);
      const deuda = UMBRAL_SONIDO - fonema.puntuacion;

      if (previo) {
        previo.veces += 1;
        previo.deuda += deuda;
        previo.peor = Math.min(previo.peor, fonema.puntuacion);
        if (!previo.palabras.includes(palabra.palabra)) previo.palabras.push(palabra.palabra);
      } else {
        porSonido.set(clave, {
          simbolo: fonema.simbolo,
          sonido,
          palabras: [palabra.palabra],
          veces: 1,
          peor: fonema.puntuacion,
          deuda,
          patron,
        });
      }
    });
  }

  const flojos = [...porSonido.values()].sort(
    // Por deuda; y a igual deuda, primero el que se hundió más, para que el
    // orden no dependa de en qué orden llegaron las palabras.
    (a, b) => b.deuda - a.deuda || a.peor - b.peor || a.simbolo.localeCompare(b.simbolo),
  );

  return { flojos, total, limpios };
}

export type IdDePatron = IdPatron;

/**
 * Cuántos cortes de cada clase, para poder escribir la frase en español sin
 * hacer cuentas dentro del JSX.
 */
export function contarCortes(cortes: readonly Corte[]): { sobran: number; faltan: number } {
  let sobran = 0;
  let faltan = 0;
  for (const corte of cortes) {
    if (corte.tipo === 'sobra') sobran += 1;
    else faltan += 1;
  }
  return { sobran, faltan };
}

/** Cómo de bien sonó la música de la frase, en palabras. Nunca se llama a esto con null. */
export function bandaDeProsodia(prosodia: number): { titulo: string; detalle: string } {
  if (prosodia >= 80) {
    return {
      titulo: 'La frase tiene forma de frase inglesa',
      detalle:
        'Subes y bajas donde sube y baja un nativo. Esto es lo que cuesta años y ya lo tienes.',
    };
  }
  if (prosodia >= 60) {
    return {
      titulo: 'La música va bien encaminada',
      detalle:
        'Los acentos caen casi donde tocan. Lo que falta suele ser aplastar más las sílabas sin acento, no hablar más rápido.',
    };
  }
  return {
    titulo: 'La frase sale bastante plana',
    detalle:
      'Todas las sílabas pesan casi lo mismo, que es como funciona el español. El inglés pisa dos o tres palabras por frase y aplasta el resto: prueba a exagerar esas dos.',
  };
}
