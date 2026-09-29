/**
 * ¿Se está oyendo el altavoz por el micrófono?
 *
 * En shadowing esto no es un detalle de confort: es lo que decide si la nota
 * significa algo. Si el modelo suena por el altavoz mientras grabas, el
 * micrófono recoge las dos voces, el reconocedor se queda con la que se entiende
 * —la del nativo— y te puntúa a él. Sales con un 95 % sin haber abierto la boca.
 *
 * No se pregunta si hay auriculares enchufados, se MIDE la fuga. Preguntarlo no
 * se puede: `enumerateDevices` solo da nombres de dispositivo, en el idioma del
 * sistema, vacíos hasta que hay permiso, y en iOS casi siempre inútiles; y unos
 * auriculares abiertos a todo volumen filtran igual que un altavoz. Lo que sí se
 * puede es sonar un pitido y mirar si vuelve.
 */

/** Qué salió de la medición. */
export type Fuga = 'sin-fuga' | 'con-fuga' | 'no-se-puede-saber';

export interface Sonda {
  fuga: Fuga;
  /** Cuánto subió el micrófono al sonar el pitido. Null si no se llegó a medir. */
  subidaDb: number | null;
  /** Por qué salió eso, en español y para leerlo tal cual en pantalla. */
  motivo: string;
}

/**
 * A partir de cuánto se considera que el micrófono está oyendo al altavoz.
 *
 * Diez decibelios es mucho más que el ruido de fondo de una habitación y mucho
 * menos que lo que devuelve un altavoz de móvil apuntando al micro, que sube
 * treinta o cuarenta. El hueco entre los dos casos es enorme, así que el umbral
 * no es fino: no hay que afinarlo para acertar.
 */
export const SUBIDA_SOSPECHOSA_DB = 10;

export function veredictoDeFuga(subidaDb: number): 'sin-fuga' | 'con-fuga' {
  return subidaDb >= SUBIDA_SOSPECHOSA_DB ? 'con-fuga' : 'sin-fuga';
}

/**
 * Frecuencia del pitido. Aguda para que no la tapen ni las voces ni el tráfico
 * de la calle, que viven mucho más abajo, y corta para que no moleste.
 */
const HERCIOS = 1000;
const PITIDO_MS = 500;
const SILENCIO_MS = 250;
/** Ni tan bajo que no se oiga ni tan alto que asuste con auriculares puestos. */
const VOLUMEN = 0.2;

type ConstructorAudio = new () => AudioContext;

function constructorDeAudio(): ConstructorAudio | null {
  if (typeof window === 'undefined') return null;
  const ventana = window as unknown as {
    AudioContext?: ConstructorAudio;
    webkitAudioContext?: ConstructorAudio;
  };
  return ventana.AudioContext ?? ventana.webkitAudioContext ?? null;
}

export function sePuedeSondar(): boolean {
  return constructorDeAudio() !== null && Boolean(navigator.mediaDevices?.getUserMedia);
}

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/**
 * Suena un pitido y mira cuánto vuelve por el micrófono.
 *
 * Tiene que salir de un toque de la persona: el navegador no deja sonar nada sin
 * gesto previo, y además hay que avisar antes de pitarle a alguien en la oreja.
 */
export async function sondarFugaDeAltavoz(): Promise<Sonda> {
  const Constructor = constructorDeAudio();
  if (!Constructor || !navigator.mediaDevices?.getUserMedia) {
    return {
      fuga: 'no-se-puede-saber',
      subidaDb: null,
      motivo: 'Este navegador no deja medir lo que entra por el micrófono.',
    };
  }

  let micro: MediaStream;
  try {
    micro = await navigator.mediaDevices.getUserMedia({
      /*
        Los tres filtros, apagados a propósito.

        Con la cancelación de eco puesta, el navegador borra del micrófono justo
        lo que acaba de salir por el altavoz: mediríamos el trabajo del filtro y
        no la fuga, y saldría «no hay fuga» con el altavoz a todo volumen. El
        control de ganancia haría lo suyo también, subiendo el silencio hasta
        dejarlo parecido al pitido.
      */
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    return {
      fuga: 'no-se-puede-saber',
      subidaDb: null,
      motivo: 'Sin permiso del micrófono no se puede comprobar.',
    };
  }

  const pista = micro.getAudioTracks()[0];
  const ajustes = pista?.getSettings() as { echoCancellation?: boolean } | undefined;
  /*
    Aquí es donde NO nos fiamos de `echoCancellation`.

    Se pidió apagada; si el navegador la devuelve encendida es que no obedece
    —pasa en algún Safari y en algún Android con el filtro del fabricante—. En
    ese aparato la medición no vale nada, y decirlo es mejor que dar un veredicto
    tranquilizador que no hemos medido.
  */
  if (ajustes?.echoCancellation === true) {
    micro.getTracks().forEach((track) => track.stop());
    return {
      fuga: 'no-se-puede-saber',
      subidaDb: null,
      motivo:
        'Tu navegador no deja apagar la cancelación de eco, así que la medición no sería fiable.',
    };
  }

  const ctx = new Constructor();
  const soltar = () => {
    micro.getTracks().forEach((track) => track.stop());
    void ctx.close();
  };

  try {
    // Con la pestaña recién abierta el contexto nace suspendido y no mediría nada.
    if (ctx.state === 'suspended') await ctx.resume();

    const analizador = ctx.createAnalyser();
    analizador.fftSize = 2048;
    analizador.smoothingTimeConstant = 0;
    ctx.createMediaStreamSource(micro).connect(analizador);

    const datos = new Float32Array(analizador.frequencyBinCount);
    const anchoDeBin = ctx.sampleRate / analizador.fftSize;
    const bin = Math.round(HERCIOS / anchoDeBin);

    /** El nivel en la frecuencia del pitido, mirando los bins de al lado por si el reloj del aparato desafina. */
    const nivel = (): number => {
      analizador.getFloatFrequencyData(datos);
      let mayor = -Infinity;
      for (let i = Math.max(0, bin - 1); i <= Math.min(datos.length - 1, bin + 1); i += 1) {
        mayor = Math.max(mayor, datos[i] ?? -Infinity);
      }
      return Number.isFinite(mayor) ? mayor : -120;
    };

    const muestrear = async (ms: number): Promise<number[]> => {
      const muestras: number[] = [];
      const hasta = Date.now() + ms;
      while (Date.now() < hasta) {
        muestras.push(nivel());
        await esperar(25);
      }
      return muestras;
    };

    const fondo = await muestrear(SILENCIO_MS);

    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();
    oscilador.frequency.value = HERCIOS;
    // Rampas cortas en vez de encender y apagar en seco: un corte brusco suena
    // como un chasquido y además ensucia todo el espectro, no solo estos 1000 Hz.
    volumen.gain.setValueAtTime(0, ctx.currentTime);
    volumen.gain.linearRampToValueAtTime(VOLUMEN, ctx.currentTime + 0.05);
    volumen.gain.setValueAtTime(VOLUMEN, ctx.currentTime + PITIDO_MS / 1000 - 0.05);
    volumen.gain.linearRampToValueAtTime(0, ctx.currentTime + PITIDO_MS / 1000);
    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start();
    oscilador.stop(ctx.currentTime + PITIDO_MS / 1000);

    // Se deja pasar la rampa de subida antes de medir, o el promedio se comería
    // los primeros fotogramas en los que el pitido todavía no sonaba entero.
    await esperar(100);
    const durante = await muestrear(PITIDO_MS - 150);

    soltar();

    if (fondo.length === 0 || durante.length === 0) {
      return {
        fuga: 'no-se-puede-saber',
        subidaDb: null,
        motivo: 'No dio tiempo a medir. Inténtalo otra vez.',
      };
    }

    /*
      Fondo por la mediana y pitido por el máximo, y no al revés.

      Las dos decisiones empujan hacia «hay fuga», que es el lado seguro: un
      falso «hay fuga» solo te hace ponerte los auriculares que ya tenías; un
      falso «no hay fuga» te deja practicar media hora con una nota inventada.
    */
    const subidaDb = Math.round(maximo(durante) - mediana(fondo));
    const fuga = veredictoDeFuga(subidaDb);

    return {
      fuga,
      subidaDb,
      motivo:
        fuga === 'con-fuga'
          ? 'El micrófono oyó el pitido: el sonido está saliendo por el altavoz.'
          : 'El micrófono casi no oyó el pitido: el sonido se queda en tus oídos.',
    };
  } catch {
    soltar();
    return {
      fuga: 'no-se-puede-saber',
      subidaDb: null,
      motivo: 'Se cortó la comprobación. Inténtalo otra vez.',
    };
  }
}

function mediana(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) return ordenados[medio] ?? 0;
  return ((ordenados[medio - 1] ?? 0) + (ordenados[medio] ?? 0)) / 2;
}

function maximo(valores: readonly number[]): number {
  return valores.reduce((mayor, valor) => Math.max(mayor, valor), -Infinity);
}
