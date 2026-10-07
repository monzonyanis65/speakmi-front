import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bytesWav,
  construirWav,
  grabarWav,
  juntar,
  leerCabeceraWav,
  MUESTREO,
  PICO_MINIMO,
  remuestrear,
  wavDesdeGrabacion,
} from './wav';

/**
 * La cabecera del WAV es un contrato con el servidor, no un detalle de formato.
 *
 * El evaluador rechaza lo que no sea PCM mono a 16 kHz, y lo rechaza porque Azure
 * NO lo rechaza: un WAV a 48 kHz lo procesa y devuelve notas bajas. Quien estudia
 * leería que pronuncia fatal cuando lo que estaba mal era el audio. Por eso estos
 * cuatro números se comprueban aquí uno a uno en vez de fiarse de que el servidor
 * ya avisará.
 */

/** Un tono de prueba, que es más honesto que un bloque de ceros. */
function tono(muestras: number, muestreo: number): Float32Array {
  const datos = new Float32Array(muestras);
  for (let i = 0; i < muestras; i += 1) datos[i] = Math.sin((2 * Math.PI * 440 * i) / muestreo);
  return datos;
}

describe('la cabecera que mira el servidor', () => {
  it('sale PCM, mono, 16 kHz y 16 bits', () => {
    const cabecera = leerCabeceraWav(bytesWav(tono(MUESTREO, MUESTREO), MUESTREO));

    expect(cabecera).toEqual({
      formato: 1,
      canales: 1,
      muestreo: 16000,
      bits: 16,
      segundos: 1,
    });
  });

  it('un audio grabado a 48 kHz sale igualmente a 16 kHz, y dura lo mismo', () => {
    /*
      El caso que de verdad pasa: muchos navegadores no dejan fijar la frecuencia
      del contexto y entregan 48 kHz. Si eso se mandara tal cual, Azure lo
      aceptaría y devolvería notas malas de un audio que estaba bien.
    */
    const cabecera = leerCabeceraWav(bytesWav(tono(48000 * 2, 48000), 48000));

    expect(cabecera?.muestreo).toBe(16000);
    expect(cabecera?.segundos).toBeCloseTo(2, 2);
  });

  it('el tamaño del bloque de datos cuadra con lo que dice la cabecera', () => {
    // Una cabecera que miente sobre cuántos bytes hay detrás es peor que ninguna:
    // el lector se pasa de largo y decodifica basura como si fuera voz.
    const bytes = bytesWav(tono(MUESTREO, MUESTREO), MUESTREO);

    expect(bytes.byteLength).toBe(44 + MUESTREO * 2);
    expect(new DataView(bytes).getUint32(4, true)).toBe(bytes.byteLength - 8);
    // Y el tipo, que es lo que el servidor mira primero en el multipart.
    expect(construirWav(tono(10, MUESTREO), MUESTREO).type).toBe('audio/wav');
  });

  it('una muestra saturada se recorta en vez de dar la vuelta', () => {
    // Sin el recorte, un 1,5 se sale del entero de 16 bits y aparece como un
    // valor negativo: un chasquido justo donde el micro saturó, que el evaluador
    // puntúa como si fuera parte de la voz.
    const bytes = bytesWav(new Float32Array([1.5, -1.5]), MUESTREO);
    const vista = new DataView(bytes);

    expect(vista.getInt16(44, true)).toBe(32767);
    expect(vista.getInt16(46, true)).toBe(-32768);
  });
});

describe('remuestreo', () => {
  it('no toca nada cuando ya está a la frecuencia buena', () => {
    const datos = tono(100, MUESTREO);
    expect(remuestrear(datos, MUESTREO, MUESTREO)).toBe(datos);
  });

  it('deja el número de muestras que toca', () => {
    expect(remuestrear(tono(48000, 48000), 48000, 16000)).toHaveLength(16000);
    expect(remuestrear(tono(8000, 8000), 8000, 16000)).toHaveLength(16000);
  });
});

describe('juntar los trozos del worklet', () => {
  it('los pega en orden', () => {
    const juntos = juntar([new Float32Array([1, 2]), new Float32Array([3, 4])], 4);
    expect([...juntos]).toEqual([1, 2, 3, 4]);
  });

  it('recorta al tope sin dejar el final a medias', () => {
    // El tope son los treinta segundos de Azure. Se corta aquí para que el
    // servidor no tenga que rechazar una grabación entera por dos segundos.
    const juntos = juntar([new Float32Array([1, 2]), new Float32Array([3, 4])], 3);
    expect([...juntos]).toEqual([1, 2, 3]);
  });
});

/**
 * Abrir el micrófono en un iPhone.
 *
 * Esto no es el formato, es el paso de antes: conseguir que llegue una sola
 * muestra. Se prueba aquí porque en Safari fallaba de tres maneras distintas y
 * las tres terminaban igual —una grabación vacía, sin ningún error— y aguas
 * abajo eso se ve como «la app no me oye», que es lo que contó quien lo usa.
 */

interface ContextoDeMentira {
  state: string;
  sampleRate: number;
  resumes: number;
}

/** El último contexto que se llegó a crear, para mirarlo desde la prueba. */
let ultimo: ContextoDeMentira | null = null;

/**
 * Un navegador de mentira.
 *
 * @param aceptaFrecuencia si deja pedirle 16 kHz. Safari no: lanza error.
 * @param empiezaDormido si nace suspendido, que es lo que pasa cuando el
 * contexto se crea después de un `await` y ya no cuenta como parte del toque.
 */
function montarNavegador({
  aceptaFrecuencia,
  empiezaDormido,
}: {
  aceptaFrecuencia: boolean;
  empiezaDormido: boolean;
}) {
  ultimo = null;

  class ContextoFalso {
    state = empiezaDormido ? 'suspended' : 'running';
    sampleRate: number;
    resumes = 0;
    audioWorklet = { addModule: () => Promise.resolve() };

    constructor(opciones?: { sampleRate?: number }) {
      if (opciones?.sampleRate !== undefined && !aceptaFrecuencia) {
        throw new Error('NotSupportedError: sample rate no soportado');
      }
      this.sampleRate = opciones?.sampleRate ?? 48000;
      ultimo = this as unknown as ContextoDeMentira;
    }

    resume() {
      this.resumes += 1;
      this.state = 'running';
      return Promise.resolve();
    }

    createMediaStreamSource() {
      return { connect: () => {}, disconnect: () => {} };
    }

    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  vi.stubGlobal('AudioContext', ContextoFalso);
  vi.stubGlobal(
    'AudioWorkletNode',
    class {
      port: { onmessage: ((e: { data: Float32Array }) => void) | null } = { onmessage: null };
      connect() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:falso', revokeObjectURL: () => {} });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: () => {
        const pista = { stop: () => {}, muted: false };
        return Promise.resolve({
          getTracks: () => [pista],
          getAudioTracks: () => [pista],
        } as unknown as MediaStream);
      },
    },
  });
}

describe('abrir el micrófono en un iPhone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('si el navegador no acepta 16 kHz, se graba igual a la suya', async () => {
    montarNavegador({ aceptaFrecuencia: false, empiezaDormido: false });

    const grabacion = await grabarWav();

    // Lo que hacía antes era rendirse aquí y devolver null, y entonces no había
    // audio que mandar a ningún sitio: el ejercicio no se podía terminar.
    expect(grabacion, 'se rindió porque Safari no acepta pedirle la frecuencia').not.toBeNull();
    expect(ultimo?.sampleRate).toBe(48000);
    grabacion?.cancelar();
  });

  it('si el contexto nace dormido, se despierta antes de grabar', async () => {
    montarNavegador({ aceptaFrecuencia: true, empiezaDormido: true });

    const grabacion = await grabarWav();

    // Un contexto suspendido no ejecuta el worklet: se grababan cero muestras,
    // la grabación salía vacía y nada avisaba de nada.
    expect(ultimo?.resumes, 'nadie despertó el contexto').toBeGreaterThan(0);
    expect(ultimo?.state).toBe('running');
    grabacion?.cancelar();
  });
});

/**
 * Grabar normal y convertir después, que es el camino que debería haber sido
 * el primero.
 *
 * Capturar PCM en vivo con un AudioWorklet pide un AudioContext despierto
 * mientras se habla, y es lo que un iPhone hace peor: cuando falla no da error,
 * entrega ceros. `MediaRecorder` es lo que todos los navegadores soportan bien,
 * y que dé mp4 en vez de PCM deja de importar si se convierte al terminar.
 */
describe('convertir lo que graba el teléfono', () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Un navegador que sabe decodificar lo que grabó, como cualquier teléfono.
   *
   * `pico` es lo alto que llega la onda decodificada: 0 es un micrófono que se
   * abrió y no captó nada, que es la avería que hay que poder distinguir.
   */
  function montarDecodificador({ pico }: { pico: number }) {
    vi.stubGlobal(
      'AudioContext',
      class {
        close() {
          return Promise.resolve();
        }
        decodeAudioData() {
          // Medio segundo a 48 kHz, que es lo que graba un móvil de verdad.
          const muestras = 24000;
          const datos = new Float32Array(muestras);
          for (let i = 0; i < muestras; i += 1) {
            datos[i] = pico * Math.sin((2 * Math.PI * 440 * i) / 48000);
          }
          return Promise.resolve({
            duration: 0.5,
            sampleRate: 48000,
            getChannelData: () => datos,
          } as unknown as AudioBuffer);
        }
      },
    );
  }

  /** Lo que entrega `MediaRecorder`. Su contenido da igual: lo decodifica el de arriba. */
  const grabado = () => ({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(5000)) }) as Blob;

  it('un mp4 a 48 kHz sale como WAV a 16 kHz, que es lo que pide el evaluador', async () => {
    montarDecodificador({ pico: 0.4 });

    const convertido = await wavDesdeGrabacion(grabado());

    /*
      Se mira el tamaño y no los bytes, porque el Blob de jsdom no deja volver a
      leerlos. Vale igual: medio segundo a 16 kHz y 16 bits son 8000 muestras,
      16000 bytes, más los 44 de cabecera. A 48 kHz serían 48044, así que este
      número solo sale si el remuestreo ocurrió.
    */
    expect(convertido?.wav.size).toBe(44 + 8000 * 2);
  });

  it('mide el volumen, que es lo que evita puntuar un silencio', async () => {
    montarDecodificador({ pico: 0.4 });

    const convertido = await wavDesdeGrabacion(grabado());

    expect(convertido!.pico).toBeGreaterThan(PICO_MINIMO);
  });

  it('un micrófono que se abrió y no captó nada se nota en el pico', async () => {
    // Ceros es exactamente lo que entrega una pista viva y muda.
    montarDecodificador({ pico: 0 });

    const convertido = await wavDesdeGrabacion(grabado());

    expect(convertido!.pico).toBeLessThan(PICO_MINIMO);
  });

  it('si no se puede decodificar, lo dice en vez de inventarse un pico', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        close() {
          return Promise.resolve();
        }
        decodeAudioData() {
          return Promise.reject(new Error('formato que no entiende'));
        }
      },
    );

    // Null significa «no se sabe», y quien llama manda el audio tal cual para
    // transcribirlo. Devolver un pico inventado aquí sería decidir si hubo voz
    // sin haber mirado.
    await expect(wavDesdeGrabacion(grabado())).resolves.toBeNull();
  });
});
