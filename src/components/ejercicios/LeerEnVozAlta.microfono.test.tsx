import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeerEnVozAlta } from './LeerEnVozAlta';

/**
 * El micrófono entre un ejercicio de voz y el siguiente.
 *
 * Aquí se monta un navegador de mentira que lleva la cuenta de QUIÉN tiene
 * cogido el micrófono: cada `getUserMedia` y cada arranque del reconocedor
 * apunta un titular, y solo se borra al parar la pista o al terminar la
 * escucha. Es la única forma de ver desde jsdom lo que en un iPhone se nota
 * como «la app ya no me oye»: un flujo que se quedó abierto del ejercicio
 * anterior y que el sistema no le da a nadie más.
 */

interface Titular {
  quien: string;
  vivo: boolean;
}

const titulares: Titular[] = [];
const contextos: ContextoFalso[] = [];
let recon: ReconocedorFalso | null = null;
/** Qué sigue cogido, que es lo que el aparato no le puede dar a nadie más. */
const cogidos = () => titulares.filter((t) => t.vivo).map((t) => t.quien);

/** El último reconocedor que se creó, para poder hablarle desde la prueba. */
function apuntar(nuevo: ReconocedorFalso) {
  recon = nuevo;
}

class ContextoFalso {
  state = 'running';
  sampleRate = 16000;
  audioWorklet = { addModule: () => Promise.resolve() };
  constructor() {
    contextos.push(this);
  }
  createMediaStreamSource() {
    return { connect: () => {}, disconnect: () => {} };
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

const nodos: NodoFalso[] = [];

class NodoFalso {
  port: { onmessage: ((e: { data: Float32Array }) => void) | null } = { onmessage: null };
  constructor() {
    nodos.push(this);
  }
  connect() {}
  disconnect() {}
}

/**
 * Hablarle al micrófono de mentira.
 *
 * Sin esto la grabación sale vacía y `terminar()` devuelve null, así que no
 * habría audio que mandar a transcribir y la prueba pasaría por el motivo
 * equivocado: no porque el camino nuevo funcione, sino porque no se recorre.
 */
function hablarAlMicrofono(muestras = 2000) {
  const datos = new Float32Array(muestras);
  // Un tono, no un bloque de ceros. Los ceros SON silencio, y el silencio ahora
  // se rechaza a propósito: con ellos estas pruebas pasarían por el motivo
  // equivocado, o no pasarían en absoluto.
  for (let i = 0; i < muestras; i += 1) datos[i] = 0.4 * Math.sin((2 * Math.PI * 440 * i) / 16000);
  for (const nodo of nodos) nodo.port.onmessage?.({ data: datos });
}

/**
 * Lo contrario: el micrófono abierto y nadie hablando.
 *
 * Es el caso que puso una nota falsa. Un micrófono que no capta entrega un
 * archivo válido lleno de ceros, y quien transcribe eso se inventa una frase.
 */
function callarseAlMicrofono(muestras = 2000) {
  for (const nodo of nodos) nodo.port.onmessage?.({ data: new Float32Array(muestras) });
}

class ReconocedorFalso {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  private titular: Titular | null = null;

  constructor() {
    apuntar(this);
  }

  start() {
    this.titular = { quien: 'reconocedor', vivo: true };
    titulares.push(this.titular);
  }

  /** Lo que hace el navegador al parar: suelta el micro y avisa. */
  private acabar() {
    if (!this.titular) return;
    this.titular.vivo = false;
    this.titular = null;
    this.onend?.();
  }

  /**
   * Si este reconocedor se hace el muerto.
   *
   * Es lo que pasa en iOS cuando el micrófono lo tiene la grabación: `start()`
   * no protesta, pero no llega a arrancar nada, y entonces `stop()` tampoco
   * avisa de que terminó. Sin eso, nadie llama a `evaluar` nunca.
   */
  mudoDelTodo = false;

  stop() {
    if (this.mudoDelTodo) return;
    this.acabar();
  }

  abort() {
    this.acabar();
  }

  /** Como si hubiera entendido una frase entera. */
  oir(texto: string) {
    this.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: texto, confidence: 0.9 }], { isFinal: true })],
    });
  }

  /**
   * Como cuando el sistema no suelta el micrófono.
   *
   * No se inventa: `audio-capture` es lo que manda Safari en un iPhone cuando se
   * pide el micrófono y el aparato lo tiene ocupado, y por eso salta a partir del
   * SEGUNDO ejercicio y no en el primero.
   */
  fallar(motivo: string) {
    this.onerror?.({ error: motivo });
  }
}

/** Lo que se le mandó a `enviarLectura`, para ver con qué texto se corrigió. */
const corregidas: Array<Record<string, unknown>> = [];
/** Las veces que se le pidió al servidor que transcribiera el audio. */
let transcripciones = 0;
/** Lo que contesta Whisper en el servidor. Vacío = tampoco él oyó nada. */
let loQueOyeElServidor = '';

vi.mock('@/lib/api', () => ({
  api: {
    post: (ruta: string) => {
      if (ruta.startsWith('/speech/transcribe')) {
        transcripciones += 1;
        return Promise.resolve({ text: loQueOyeElServidor });
      }
      return Promise.resolve({});
    },
  },
  URL_API: 'https://servidor',
}));

vi.mock('@/lib/lectura', () => ({
  enviarLectura: (datos: Record<string, unknown>) => {
    corregidas.push(datos);
    return Promise.resolve({
      words: [{ wordIndex: 0, word: 'I', heard: 'I', score: 0.9, verdict: 'correct' }],
      accuracy: 1,
      completeness: 1,
      transcript: 'I think so',
      aprobado: true,
      palabrasParaTrabajar: [],
    });
  },
}));

const PRIMERO = {
  code: 'L6-U2-03-E04',
  prompt: { instruction_es: 'Lee la frase en voz alta.', referenceText: 'I think so' },
};

const SEGUNDO = {
  code: 'L6-U2-03-E07',
  prompt: { instruction_es: 'Lee la frase en voz alta.', referenceText: 'She works at home' },
};

/** El micrófono del aparato: lo que se reparte y lo que hay que devolver. */
function microfonoDeMentira(abrir: () => Promise<void> = () => Promise.resolve()) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        await abrir();
        const titular: Titular = { quien: 'getUserMedia', vivo: true };
        titulares.push(titular);
        const pista = {
          kind: 'audio',
          stop: () => {
            titular.vivo = false;
          },
        };
        return {
          getTracks: () => [pista],
          getAudioTracks: () => [pista],
        } as unknown as MediaStream;
      },
    },
  });
}

beforeEach(() => {
  titulares.length = 0;
  contextos.length = 0;
  nodos.length = 0;
  corregidas.length = 0;
  transcripciones = 0;
  loQueOyeElServidor = '';
  recon = null;

  vi.stubGlobal('AudioContext', ContextoFalso);
  vi.stubGlobal('AudioWorkletNode', NodoFalso);
  vi.stubGlobal('webkitSpeechRecognition', ReconocedorFalso);
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:falso', revokeObjectURL: () => {} });
  microfonoDeMentira();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** El ejercicio entero: tocar el micro, hablar y tocar el botón de parar. */
async function leer(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: /empezar a leer/i }));
  await act(async () => {
    recon?.oir('I think so');
  });
  await usuario.click(screen.getByRole('button', { name: /terminé de leer/i }));
  await screen.findByText(/bien dichas/i);
}

describe('el micrófono entre un ejercicio de voz y el siguiente', () => {
  it('al cambiar de ejercicio vuelve a pedir el micro desde cero', async () => {
    const usuario = userEvent.setup();
    /*
      El examen pinta este componente sin `key`: cambia el ejercicio y React
      reutiliza la misma instancia. Es el caso que rompía: el segundo ejercicio
      de voz se encontraba la pantalla del primero y ningún botón de micrófono.
    */
    const { rerender } = render(<LeerEnVozAlta ejercicio={PRIMERO} onTerminado={() => {}} />);
    await leer(usuario);

    await act(async () => {
      rerender(<LeerEnVozAlta ejercicio={SEGUNDO} onTerminado={() => {}} />);
    });

    expect(screen.getByRole('button', { name: /empezar a leer/i })).toBeInTheDocument();
    // Y la frase que toca leer es la nueva, no la corregida de antes.
    expect(screen.getByText('She works at home')).toBeInTheDocument();
    expect(screen.queryByText(/bien dichas/i)).not.toBeInTheDocument();
  });

  it('al cambiar de ejercicio a mitad de la grabación suelta el micrófono', async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(<LeerEnVozAlta ejercicio={PRIMERO} onTerminado={() => {}} />);
    await usuario.click(screen.getByRole('button', { name: /empezar a leer/i }));
    expect(cogidos()).not.toEqual([]);

    await act(async () => {
      rerender(<LeerEnVozAlta ejercicio={SEGUNDO} onTerminado={() => {}} />);
    });

    expect(cogidos()).toEqual([]);
    expect(contextos.filter((c) => c.state !== 'closed')).toHaveLength(0);
  });

  it('no deja el micrófono cogido si se sale mientras se estaba abriendo', async () => {
    let dejarPasar: (() => void) | null = null;
    microfonoDeMentira(
      () =>
        new Promise<void>((listo) => {
          dejarPasar = listo;
        }),
    );

    const { unmount } = render(<LeerEnVozAlta ejercicio={PRIMERO} onTerminado={() => {}} />);
    // Sin `userEvent`: hay que salir mientras el permiso sigue en el aire, y
    // `userEvent` espera a que se asienten las promesas antes de devolver.
    fireEvent.click(screen.getByRole('button', { name: /empezar a leer/i }));

    await act(async () => unmount());
    await act(async () => {
      dejarPasar?.();
    });

    expect(cogidos()).toEqual([]);
    expect(contextos.filter((c) => c.state !== 'closed')).toHaveLength(0);
  });

  /*
    Los dos caminos que NO acaban en una lectura corregida.

    Los tres de arriba comprueban lo que pasa al cambiar de ejercicio o al salir;
    estos dos comprueban que un intento que sale mal tampoco se queda el
    micrófono. Lo contó quien lo usa en un iPhone: «funciona una vez, y cuando me
    pide hacer algo más con la voz ya no lo detecta». No era permiso —Safari no
    vuelve a preguntar una vez concedido—, era que nadie devolvía el aparato.
  */
  it('si el reconocedor no entiende nada, devuelve el micrófono igual', async () => {
    const usuario = userEvent.setup();
    render(<LeerEnVozAlta ejercicio={PRIMERO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar a leer/i }));
    // Se para sin haber dicho nada que el reconocedor entendiera.
    await usuario.click(screen.getByRole('button', { name: /terminé de leer/i }));
    await screen.findByText(/no te escuchamos/i);

    expect(cogidos(), 'el aviso sale mientras el micrófono sigue cogido').toEqual([]);
    expect(contextos.filter((c) => c.state !== 'closed')).toHaveLength(0);
  });

  /*
    El caso del iPhone, que es el que dejaba la app inservible.

    En iOS la grabación y el reconocedor no se reparten el micrófono: lo coge la
    grabación y el reconocedor se queda mudo, sin dar ningún error. Lo contó
    quien lo probó: «la primera funciona, pero la siguiente no».

    Lo que se comprueba es que el ejercicio se resuelva igual, porque el audio
    SÍ se grabó: se manda a transcribir al servidor y la lectura se corrige con
    eso. Un reconocedor mudo deja de ser un ejercicio perdido.
  */
  it('con el reconocedor mudo, la lectura se corrige con lo que se grabó', async () => {
    const usuario = userEvent.setup();
    loQueOyeElServidor = 'I think so';
    render(<LeerEnVozAlta ejercicio={PRIMERO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar a leer/i }));
    hablarAlMicrofono();
    // Y el reconocedor no entrega NADA, ni texto ni error: solo termina.
    await usuario.click(screen.getByRole('button', { name: /terminé de leer/i }));

    await screen.findByText(/bien dichas/i);
    expect(transcripciones).toBe(1);
    expect(corregidas).toHaveLength(1);
    expect(corregidas[0]!.transcript).toBe('I think so');
    // Y el micrófono queda libre para el ejercicio siguiente.
    expect(cogidos()).toEqual([]);
    expect(contextos.filter((c) => c.state !== 'closed')).toHaveLength(0);
  });

  it('no le dice al servidor qué frase tocaba leer: sería regalarle el aprobado', async () => {
    const usuario = userEvent.setup();
    // El servidor oye algo DISTINTO de la frase de referencia. Si se colara la
    // frase esperada como pista, Whisper devolvería esa y la nota sería falsa.
    loQueOyeElServidor = 'I sink so';
    render(<LeerEnVozAlta ejercicio={PRIMERO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar a leer/i }));
    hablarAlMicrofono();
    await usuario.click(screen.getByRole('button', { name: /terminé de leer/i }));

    await screen.findByText(/bien dichas/i);
    expect(corregidas[0]!.transcript, 'se corrigió con la frase esperada, no con lo dicho').toBe(
      'I sink so',
    );
  });

  it('y si el reconocedor ni avisa de que terminó, la lectura sale igual', async () => {
    const usuario = userEvent.setup();
    loQueOyeElServidor = 'I think so';
    render(<LeerEnVozAlta ejercicio={PRIMERO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar a leer/i }));
    hablarAlMicrofono();
    // El peor caso de iOS: no arrancó, así que pararlo no dispara nada. Sin el
    // tope de `parar`, la pantalla se quedaba en «evaluando» para siempre y
    // había que salirse de la lección.
    recon!.mudoDelTodo = true;
    await usuario.click(screen.getByRole('button', { name: /terminé de leer/i }));

    await screen.findByText(/bien dichas/i);
    expect(corregidas[0]!.transcript).toBe('I think so');
    expect(cogidos()).toEqual([]);
  });

  /*
    La nota inventada, que es peor que no funcionar.

    Pasó de verdad y lo contó quien lo probó: «no hablé y me salió lo mismo».
    El micrófono se abría y no captaba nada, pero un micrófono mudo no entrega
    un archivo vacío: entrega uno lleno de ceros, perfectamente válido. Y quien
    transcribe ceros no devuelve vacío, se INVENTA una frase. Esa invención se
    corrigió y salió un «6 % bien dichas» de alguien que no abrió la boca.

    Una nota falsa no es un fallo menor que no tener nota: enseña algo que no
    ocurrió, y quien estudia se lo cree.
  */
  it('un micrófono que no capta nada no se puntúa, se dice', async () => {
    const usuario = userEvent.setup();
    // El servidor contestaría con una frase entera: es lo que hace Whisper con
    // el silencio. Si se le llega a preguntar, la nota sale, y es mentira.
    loQueOyeElServidor = 'He teaches English and he watches movies at night.';
    render(<LeerEnVozAlta ejercicio={PRIMERO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar a leer/i }));
    callarseAlMicrofono();
    await usuario.click(screen.getByRole('button', { name: /terminé de leer/i }));

    await screen.findByText(/no te escuchamos/i);
    expect(transcripciones, 'se mandó a transcribir un silencio').toBe(0);
    expect(corregidas, 'se puntuó algo que nadie dijo').toHaveLength(0);
    expect(screen.queryByText(/bien dichas/i)).not.toBeInTheDocument();
  });

  it('si tampoco el servidor oye nada, lo dice y deja reintentar', async () => {
    const usuario = userEvent.setup();
    loQueOyeElServidor = '';
    render(<LeerEnVozAlta ejercicio={PRIMERO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar a leer/i }));
    hablarAlMicrofono();
    await usuario.click(screen.getByRole('button', { name: /terminé de leer/i }));

    await screen.findByText(/no te escuchamos/i);
    expect(corregidas).toHaveLength(0);
    expect(cogidos()).toEqual([]);
    expect(screen.getByRole('button', { name: /empezar a leer/i })).toBeInTheDocument();
  });

  it('si el micrófono falla, suelta todo y deja volver a intentarlo', async () => {
    const usuario = userEvent.setup();
    render(<LeerEnVozAlta ejercicio={PRIMERO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar a leer/i }));
    await act(async () => {
      recon?.fallar('audio-capture');
    });

    expect(cogidos()).toEqual([]);
    expect(contextos.filter((c) => c.state !== 'closed')).toHaveLength(0);
    // Y la pantalla vuelve a ser usable: el botón de hablar, no el de parar una
    // escucha que ya no existe.
    expect(screen.getByRole('button', { name: /empezar a leer/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /terminé de leer/i })).not.toBeInTheDocument();
  });
});
