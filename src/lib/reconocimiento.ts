/**
 * Reconocimiento de voz del navegador.
 *
 * Es gratis, ilimitado y no necesita ninguna clave: usa el motor del sistema.
 * Funciona en Chrome, Edge y Android. En Safari el soporte es irregular, así que
 * `estaDisponible` existe para poder ofrecer otra cosa en vez de fallar.
 */

interface ResultadoReconocimiento {
  transcript: string;
  confidence: number;
}

interface EventoReconocimiento {
  resultIndex: number;
  results: ArrayLike<ArrayLike<ResultadoReconocimiento> & { isFinal: boolean }>;
}

interface Reconocedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((evento: EventoReconocimiento) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type ConstructorReconocedor = new () => Reconocedor;

function obtenerConstructor(): ConstructorReconocedor | null {
  const ventana = window as unknown as {
    SpeechRecognition?: ConstructorReconocedor;
    webkitSpeechRecognition?: ConstructorReconocedor;
  };
  return ventana.SpeechRecognition ?? ventana.webkitSpeechRecognition ?? null;
}

export function estaDisponible(): boolean {
  return obtenerConstructor() !== null;
}

export interface SesionEscucha {
  detener: () => void;
  cancelar: () => void;
}

/**
 * Cuántas versiones distintas se le piden al reconocedor por cada trozo.
 *
 * Con una sola, lo que entiende mal se queda mal. Pidiendo varias, la buena
 * suele estar en la segunda o la tercera, y quien sabe cuál era la frase (el
 * servidor, que tiene el texto de referencia) puede quedarse con la que encaja.
 * Cinco es donde deja de mejorar y empieza a devolver ruido.
 */
const ALTERNATIVAS = 5;

/**
 * Cuántas veces se vuelve a arrancar solo tras un corte.
 *
 * El motor del navegador se para por su cuenta en cuanto detecta un silencio de
 * un par de segundos. Para quien está aprendiendo eso es constante: se para a
 * pensar cómo se decía una palabra y el reconocedor da la frase por terminada a
 * media frase. El tope evita que un micrófono averiado deje esto girando.
 */
const REARRANQUES = 20;

export interface Escuchado {
  /** Lo que entendió como más probable. */
  texto: string;
  /**
   * Todas las versiones completas que se pudieron formar, la primera es la más
   * probable. Sirven para que quien conoce la frase esperada elija la que encaja.
   */
  alternativas: string[];
}

/**
 * Escucha hasta que se le dice que pare.
 *
 * `onParcial` va llegando mientras se habla, para que la interfaz reaccione en
 * vivo. `onFinal` llega una sola vez al terminar, con todo lo entendido.
 */
export function escuchar(opciones: {
  idioma?: string;
  onParcial?: (texto: string) => void;
  onFinal: (resultado: Escuchado) => void;
  onError?: (motivo: string) => void;
}): SesionEscucha | null {
  const Constructor = obtenerConstructor();
  if (!Constructor) return null;

  const reconocedor = new Constructor();
  reconocedor.lang = opciones.idioma ?? 'en-US';
  reconocedor.continuous = true;
  reconocedor.interimResults = true;
  reconocedor.maxAlternatives = ALTERNATIVAS;

  /**
   * Cada trozo cerrado, con todas sus versiones.
   *
   * Se guardan por separado en vez de ir pegando una cadena: para poder ofrecer
   * frases completas alternativas hay que combinar las versiones de cada trozo,
   * y eso ya no se puede hacer si se ha aplanado todo en un texto.
   */
  const trozos: string[][] = [];
  let parado = false;
  let cancelado = false;
  let rearranques = 0;

  const unir = (elegir: (versiones: string[]) => string) =>
    trozos.map(elegir).join(' ').replace(/\s+/g, ' ').trim();

  reconocedor.onresult = (evento) => {
    let parcial = '';

    for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
      const resultado = evento.results[i];
      if (!resultado) continue;

      if (resultado.isFinal) {
        const versiones: string[] = [];
        for (let j = 0; j < resultado.length; j += 1) {
          const texto = resultado[j]?.transcript?.trim();
          if (texto && !versiones.includes(texto)) versiones.push(texto);
        }
        if (versiones.length) trozos.push(versiones);
      } else {
        parcial += resultado[0]?.transcript ?? '';
      }
    }

    const hastaAhora = unir((versiones) => versiones[0] ?? '');
    opciones.onParcial?.(`${hastaAhora} ${parcial}`.trim());
  };

  reconocedor.onerror = (evento) => {
    // "no-speech" y "aborted" no son fallos: pasan al callar o al cancelar.
    if (evento.error === 'no-speech' || evento.error === 'aborted') return;
    // Un fallo de verdad sí termina la escucha, o se quedaría reintentando.
    parado = true;
    opciones.onError?.(evento.error);
  };

  reconocedor.onend = () => {
    if (cancelado) return;

    // Se paró solo, no porque se le dijera: se vuelve a arrancar y se sigue
    // acumulando. Esto es lo que permite pensar a mitad de frase sin que la dé
    // por terminada.
    if (!parado && rearranques < REARRANQUES) {
      rearranques += 1;
      try {
        reconocedor.start();
        return;
      } catch {
        // Si no deja rearrancar, se cierra con lo que haya.
      }
    }

    opciones.onFinal(construir(trozos));
  };

  try {
    reconocedor.start();
  } catch {
    return null;
  }

  return {
    detener: () => {
      parado = true;
      reconocedor.stop();
    },
    cancelar: () => {
      cancelado = true;
      parado = true;
      reconocedor.abort();
    },
  };
}

/**
 * Arma las frases completas a partir de las versiones de cada trozo.
 *
 * La primera es la más probable de punta a punta. Las demás se sacan cambiando
 * las versiones de UN trozo cada vez, no combinándolo todo con todo: cinco
 * versiones por cinco trozos serían tres mil frases, y el error casi siempre
 * está en una palabra suelta, no repartido por toda la frase.
 */
function construir(trozos: string[][]): Escuchado {
  const mejor = trozos.map((versiones) => versiones[0] ?? '');
  const limpiar = (partes: string[]) => partes.join(' ').replace(/\s+/g, ' ').trim();

  const alternativas = [limpiar(mejor)];

  for (let i = 0; i < trozos.length; i += 1) {
    const versiones = trozos[i] ?? [];
    for (let j = 1; j < versiones.length; j += 1) {
      const variante = [...mejor];
      variante[i] = versiones[j] ?? '';
      const frase = limpiar(variante);
      if (frase && !alternativas.includes(frase)) alternativas.push(frase);
    }
  }

  return { texto: alternativas[0] ?? '', alternativas };
}
