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

class NodoFalso {
  port: { onmessage: ((e: { data: Float32Array }) => void) | null } = { onmessage: null };
  connect() {}
  disconnect() {}
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

  stop() {
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
}

vi.mock('@/lib/lectura', () => ({
  enviarLectura: () =>
    Promise.resolve({
      words: [{ wordIndex: 0, word: 'I', heard: 'I', score: 0.9, verdict: 'correct' }],
      accuracy: 1,
      completeness: 1,
      transcript: 'I think so',
      aprobado: true,
      palabrasParaTrabajar: [],
    }),
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
});
