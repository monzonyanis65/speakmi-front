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
 * Escucha hasta que se le dice que pare.
 *
 * `onParcial` va llegando mientras se habla, para que la interfaz reaccione en
 * vivo. `onFinal` llega una sola vez al terminar, con todo lo entendido.
 */
export function escuchar(opciones: {
  idioma?: string;
  onParcial?: (texto: string) => void;
  onFinal: (texto: string) => void;
  onError?: (motivo: string) => void;
}): SesionEscucha | null {
  const Constructor = obtenerConstructor();
  if (!Constructor) return null;

  const reconocedor = new Constructor();
  reconocedor.lang = opciones.idioma ?? 'en-US';
  reconocedor.continuous = true;
  reconocedor.interimResults = true;
  reconocedor.maxAlternatives = 1;

  let acumulado = '';
  let cancelado = false;

  reconocedor.onresult = (evento) => {
    let parcial = '';

    for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
      const resultado = evento.results[i];
      if (!resultado) continue;
      const texto = resultado[0]?.transcript ?? '';
      if (resultado.isFinal) {
        acumulado += ` ${texto}`;
      } else {
        parcial += texto;
      }
    }

    opciones.onParcial?.(`${acumulado} ${parcial}`.trim());
  };

  reconocedor.onerror = (evento) => {
    // "no-speech" y "aborted" no son fallos: pasan al callar o al cancelar.
    if (evento.error === 'no-speech' || evento.error === 'aborted') return;
    opciones.onError?.(evento.error);
  };

  reconocedor.onend = () => {
    if (!cancelado) opciones.onFinal(acumulado.trim());
  };

  try {
    reconocedor.start();
  } catch {
    return null;
  }

  return {
    detener: () => reconocedor.stop(),
    cancelar: () => {
      cancelado = true;
      reconocedor.abort();
    },
  };
}
