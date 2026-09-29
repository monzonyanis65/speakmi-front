/**
 * Las cuentas del shadowing, fuera de la pantalla.
 *
 * Están aquí y no dentro del componente porque son justo lo que hay que poder
 * probar sin montar nada: si la palabra que se ilumina va media palabra por
 * delante, o si «llegaste tarde» sale a cualquiera que empiece a hablar medio
 * segundo después que el modelo, la pantalla se ve preciosa y enseña mal.
 */

export interface TiempoDePalabra {
  word: string;
  startMs: number;
  endMs: number;
}

export type Veredicto = 'correct' | 'mispronounced' | 'omitted' | 'inserted';

export interface PalabraDicha {
  word: string;
  heard: string | null;
  verdict: Veredicto;
  score: number;
  /**
   * Cuándo la dijiste TÚ, no el modelo. Null cuando no se dijo o cuando el
   * proveedor no marcó tiempos: el servidor manda null a propósito en vez de
   * cero, porque un cero aquí es un instante inventado que se pintaría como si
   * hubieras hablado antes de empezar.
   */
  startMs: number | null;
  endMs: number | null;
}

/**
 * Un hueco más corto que esto no es una pausa, es cómo se pegan las palabras al
 * hablar. En inglés «a lot of» sale sin aire por medio, y llamar pausa a esos
 * treinta milisegundos haría que la pantalla pidiera respirar donde nadie
 * respira. Se marca solo el silencio que de verdad se oye.
 */
export const PAUSA_MINIMA_MS = 150;

/**
 * Cuánto se puede desviar el ritmo sin que se note al oído.
 *
 * Por debajo de una décima nadie oye que llegaste tarde, y señalarlo sería
 * castigar el ruido de medición del alineador en vez de enseñar nada.
 */
export const TOLERANCIA_MS = 120;

export interface LoQueSuena {
  /** Qué palabra suena ahora. -1 cuando no suena ninguna. */
  indice: number;
  /** El silencio de ahora es una pausa de verdad del modelo. */
  pausa: boolean;
}

/**
 * Qué está sonando en el milisegundo `ms` del audio.
 *
 * Durante un silencio NO se deja encendida la palabra anterior, aunque
 * quedaría más bonito y sin parpadeos. En shadowing la pausa es contenido: es
 * donde el inglés coge aire y donde quien imita se adelanta. Dejar la palabra
 * anterior iluminada durante la pausa enseña que ahí sigues diciéndola, que es
 * exactamente el error que se viene a corregir.
 */
export function loQueSuena(palabras: readonly TiempoDePalabra[], ms: number): LoQueSuena {
  for (let i = 0; i < palabras.length; i += 1) {
    const palabra = palabras[i]!;
    if (ms >= palabra.startMs && ms < palabra.endMs) return { indice: i, pausa: false };
  }

  for (let i = 0; i + 1 < palabras.length; i += 1) {
    const fin = palabras[i]!.endMs;
    const siguiente = palabras[i + 1]!.startMs;
    if (ms >= fin && ms < siguiente)
      return { indice: -1, pausa: siguiente - fin >= PAUSA_MINIMA_MS };
  }

  return { indice: -1, pausa: false };
}

export interface Desliz {
  word: string;
  verdict: Veredicto;
  /** Milisegundos de diferencia con el modelo. Positivo = lo dijiste tarde. */
  desfaseMs: number | null;
  /** El silencio que hay ANTES de esta palabra, en el modelo y en lo tuyo. */
  pausaModeloMs: number | null;
  pausaTuyaMs: number | null;
  cuando: 'a-tiempo' | 'tarde' | 'pronto' | 'sin-medida';
  pausa: 'igual' | 'te-falto' | 'de-mas' | 'sin-medida';
}

/**
 * Pone lo tuyo al lado del modelo, palabra por palabra.
 *
 * EL ORIGEN DE CADA LADO ES EL SUYO, y esto es lo único importante de aquí.
 * Tu grabación empieza cuando le das al botón, y entre el botón y tu primera
 * sílaba pasa medio segundo largo. Comparando los tiempos tal cual llegan,
 * TODAS las palabras salen tarde por ese mismo medio segundo y la pantalla te
 * dice que no acertaste ni una, cuando puede que hayas clavado el ritmo. Lo que
 * se enseña en shadowing es la forma de la frase —qué va pegado, dónde hay
 * aire—, no a qué hora empezaste a hablar, así que cada lado se mide desde su
 * propia primera palabra.
 *
 * El emparejamiento es por posición y no por texto: el servidor devuelve una
 * entrada por cada palabra de referencia, incluidas las que no dijiste (con
 * `omitted`), así que las posiciones cuadran en cuanto se quitan las que te
 * inventaste, que no están en el modelo y no tienen con qué compararse.
 */
export function compararRitmo(
  modelo: readonly TiempoDePalabra[],
  dichas: readonly PalabraDicha[],
): Desliz[] {
  const tuyas = dichas.filter((palabra) => palabra.verdict !== 'inserted');

  /*
    Solo cuenta lo que trae hora. Una palabra omitida, o una que el proveedor
    no supo situar, llega con `startMs` en null: si se tomara como cero, el
    origen se iría al principio del audio y todo lo demás saldría tardísimo.
  */
  const conHora = (palabra: PalabraDicha | undefined) =>
    palabra && palabra.verdict !== 'omitted' && palabra.startMs !== null && palabra.endMs !== null
      ? (palabra as PalabraDicha & { startMs: number; endMs: number })
      : null;

  /*
    Los dos orígenes tienen que ser LA MISMA PALABRA.

    No vale «la primera del modelo» contra «la primera tuya que traiga hora»: si
    te saltaste la primera, estarías midiendo tu segunda palabra contra su
    primera y todo saldría corrido por lo que dura una palabra entera. El ancla
    es la primera posición donde los dos lados tienen algo que comparar.
  */
  const ancla = modelo.findIndex((_, i) => conHora(tuyas[i]) !== null);
  const origenModelo = ancla === -1 ? 0 : (modelo[ancla]?.startMs ?? 0);
  const origenTuyo = ancla === -1 ? 0 : (conHora(tuyas[ancla])?.startMs ?? 0);

  return modelo.map((palabraModelo, i) => {
    const tuya = tuyas[i];
    const dicha = conHora(tuya);

    const desfaseMs = dicha
      ? dicha.startMs - origenTuyo - (palabraModelo.startMs - origenModelo)
      : null;

    const anteriorModelo = modelo[i - 1];
    const anteriorTuya = conHora(tuyas[i - 1]);
    const pausaModeloMs = anteriorModelo ? palabraModelo.startMs - anteriorModelo.endMs : null;
    const pausaTuyaMs = dicha && anteriorTuya ? dicha.startMs - anteriorTuya.endMs : null;

    return {
      word: palabraModelo.word,
      verdict: tuya?.verdict ?? 'omitted',
      desfaseMs,
      pausaModeloMs,
      pausaTuyaMs,
      cuando:
        desfaseMs === null
          ? 'sin-medida'
          : Math.abs(desfaseMs) <= TOLERANCIA_MS
            ? 'a-tiempo'
            : desfaseMs > 0
              ? 'tarde'
              : 'pronto',
      pausa:
        pausaModeloMs === null || pausaTuyaMs === null
          ? 'sin-medida'
          : Math.abs(pausaTuyaMs - pausaModeloMs) <= TOLERANCIA_MS
            ? 'igual'
            : pausaTuyaMs < pausaModeloMs
              ? 'te-falto'
              : 'de-mas',
    };
  });
}

/** Cuántos avisos como mucho. Cinco cosas que corregir a la vez no se corrige ninguna. */
const AVISOS = 3;

/**
 * Lo mismo, dicho en cristiano.
 *
 * Un porcentaje no enseña a hablar: hay que poder leer «llegaste 240 ms tarde a
 * because» y volver a ese trozo.
 *
 * SE AVISA DONDE SE ROMPIÓ EL RITMO, NO DONDE SE NOTA. Un desfase no se arregla
 * solo: si entras tarde en una palabra, todas las que vienen detrás salen igual
 * de tarde, y listarlas una a una son seis avisos para un único fallo. Por eso
 * se mira cuánto CAMBIA el desfase de una palabra a la siguiente: eso señala el
 * sitio exacto donde se descuadró y calla el arrastre.
 *
 * Y cada palabra da un aviso como mucho: cuando el modelo hace un silencio de
 * verdad ahí, se cuenta como pausa —que es lo accionable, se respira o no se
 * respira—, y si no, como que llegaste tarde o pronto. Las dos frases dicen lo
 * mismo con otras palabras, y soltar las dos parece que fallaste dos veces.
 */
export function avisosDeRitmo(deslices: readonly Desliz[]): string[] {
  const avisos: Array<{ texto: string; gravedad: number }> = [];
  let anterior: number | null = null;

  for (const desliz of deslices) {
    if (desliz.desfaseMs === null) continue;
    const previo = anterior;
    anterior = desliz.desfaseMs;
    if (previo === null) continue;

    const deriva = desliz.desfaseMs - previo;
    if (Math.abs(deriva) <= TOLERANCIA_MS) continue;

    const huboSilencio =
      (desliz.pausaModeloMs ?? 0) >= PAUSA_MINIMA_MS ||
      (desliz.pausaTuyaMs ?? 0) >= PAUSA_MINIMA_MS;

    avisos.push({
      gravedad: Math.abs(deriva),
      texto: huboSilencio
        ? deriva < 0
          ? `Te faltó la pausa antes de «${desliz.word}»: el modelo para ${desliz.pausaModeloMs} ms y tú ${desliz.pausaTuyaMs} ms.`
          : `Paraste de más antes de «${desliz.word}»: ${desliz.pausaTuyaMs} ms donde el modelo para ${desliz.pausaModeloMs} ms.`
        : `Llegaste ${Math.abs(deriva)} ms ${deriva > 0 ? 'tarde' : 'pronto'} a «${desliz.word}».`,
    });
  }

  return avisos
    .sort((a, b) => b.gravedad - a.gravedad)
    .slice(0, AVISOS)
    .map((aviso) => aviso.texto);
}
