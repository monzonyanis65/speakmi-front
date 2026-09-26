import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decir, hayVozInglesa, vozInglesaYa } from './voz';
import { olvidarEstadoDelServidor } from './voz-servidor';

/**
 * Que el audio funcione en un móvil sin voces inglesas.
 *
 * Es el agujero que esto viene a tapar: hasta ahora todo el inglés que sonaba
 * dependía de las voces instaladas en el aparato, y en un Android en español no
 * hay ninguna. Aquí se comprueba lo que de verdad importa de la solución:
 *
 *   - que con voz inglesa en el aparato NO se toque la red, porque esa es
 *     gratis, va sin conexión y suena al instante;
 *   - que sin ella se use el servidor, y que no se cuele nunca una voz española
 *     leyendo inglés, que era lo único inaceptable;
 *   - que sin voz Y sin servidor la aplicación siga avisando igual de bien que
 *     antes, en vez de quedarse muda sin explicación.
 */

vi.mock('./auth', () => ({ getToken: () => 'un-token' }));

/** Lo que se le mandó decir al sintetizador del aparato. */
let dichas: string[] = [];
/** Lo que se le pidió al servidor. */
let pedidas: string[] = [];
/** Los audios que se llegaron a reproducir. */
let sonadas: string[] = [];

function montarSintetizador(voces: Array<{ lang: string; name: string }>) {
  class UtteranceFalsa {
    lang = '';
    rate = 1;
    pitch = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }

  vi.stubGlobal('SpeechSynthesisUtterance', UtteranceFalsa);
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => voces.map((voz) => ({ ...voz, voiceURI: voz.name, localService: true })),
    cancel: vi.fn(),
    speak: (frase: UtteranceFalsa) => {
      dichas.push(frase.text);
      setTimeout(() => frase.onend?.(), 0);
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

/**
 * Un servidor de mentira.
 *
 * @param puedeHablar lo que contesta `/providers`, que es lo que la aplicación
 * pregunta para saber si puede contar con audio.
 */
function montarServidor({ puedeHablar }: { puedeHablar: boolean }) {
  vi.stubGlobal('fetch', (url: string) => {
    if (url.includes('/api/speech/providers')) {
      return Promise.resolve(
        new Response(JSON.stringify({ ttsServidor: puedeHablar }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }

    if (url.includes('/api/speech/audio')) {
      const texto = decodeURIComponent(url.split('text=')[1] ?? '');
      pedidas.push(texto);

      if (!puedeHablar) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: 'SPC-007' } }), { status: 503 }),
        );
      }

      return Promise.resolve(new Response(new Blob(['mp3']), { status: 200 }));
    }

    return Promise.resolve(new Response('', { status: 404 }));
  });
}

/** jsdom no sabe reproducir nada, así que el reproductor también es de mentira. */
function montarReproductor() {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (blob: Blob) => `blob:${String(blob.size)}`,
    revokeObjectURL: () => undefined,
  });

  vi.stubGlobal(
    'Audio',
    class {
      playbackRate = 1;
      preservesPitch = false;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public src: string) {}
      pause() {}
      play() {
        sonadas.push(this.src);
        setTimeout(() => this.onended?.(), 0);
        return Promise.resolve();
      }
    },
  );
}

beforeEach(() => {
  dichas = [];
  pedidas = [];
  sonadas = [];
  // El reproductor primero: `olvidar…` libera los audios descargados y para eso
  // necesita el `URL` de mentira, que `unstubAllGlobals` acaba de retirar.
  montarReproductor();
  olvidarEstadoDelServidor();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('con una voz inglesa en el aparato', () => {
  beforeEach(() => {
    montarSintetizador([{ lang: 'en-US', name: 'Inglesa' }]);
    montarServidor({ puedeHablar: true });
  });

  it('habla el aparato y no se le pide nada al servidor', async () => {
    await decir('apple');

    expect(dichas).toEqual(['apple']);
    // Lo importante: la voz del aparato es gratis y no consume cuota de nadie.
    expect(pedidas).toEqual([]);
  });

  it('se sabe de inmediato que se puede oír, sin esperar a la red', () => {
    expect(vozInglesaYa()).toBe('si');
  });
});

describe('sin voz inglesa pero con servidor', () => {
  beforeEach(() => {
    // El caso real: un Android en español, con su voz y ninguna inglesa.
    montarSintetizador([{ lang: 'es-ES', name: 'Española' }]);
    montarServidor({ puedeHablar: true });
  });

  it('ahora sí se puede oír inglés', async () => {
    await expect(hayVozInglesa()).resolves.toBe(true);
  });

  it('lo dice el servidor, y nunca la voz española', async () => {
    await decir('beach');

    // Esto es lo que no puede pasar jamás: «beach» leído en español enseña una
    // palabra que no existe.
    expect(dichas).toEqual([]);
    expect(pedidas).toEqual(['beach']);
    expect(sonadas).toHaveLength(1);
  });

  it('la misma palabra no se descarga dos veces', async () => {
    await decir('beach');
    await decir('beach');

    expect(pedidas).toEqual(['beach']);
    expect(sonadas).toHaveLength(2);
  });

  it('la velocidad se aplica al reproducir, no se pide otro audio', async () => {
    await decir('good morning', { velocidad: 0.9 });
    await decir('good morning', { velocidad: 0.55 });

    // Un solo audio pagado para las dos velocidades del dictado.
    expect(pedidas).toEqual(['good morning']);
  });
});

describe('sin voz inglesa y sin servidor', () => {
  beforeEach(() => {
    montarSintetizador([{ lang: 'es-ES', name: 'Española' }]);
    montarServidor({ puedeHablar: false });
  });

  it('se sigue avisando, que es lo que había antes y sigue siendo lo honesto', async () => {
    await expect(hayVozInglesa()).resolves.toBe(false);
  });

  it('no suena nada, ni con la voz española', async () => {
    await decir('beach');

    expect(dichas).toEqual([]);
    expect(sonadas).toEqual([]);
  });
});
