import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HablarLibre } from './HablarLibre';

/**
 * El micrófono en hablar libre, cuando el intento NO acaba bien.
 *
 * Este componente no graba audio aparte: solo usa el reconocedor del navegador.
 * Aun así tenía el mismo agujero que leer en voz alta, y el agujero no está en
 * el camino bueno sino en los dos que fallan —el micrófono da error, o no se
 * entiende nada—, donde la escucha se quedaba viva mientras la pantalla decía
 * estar lista para otra.
 *
 * Importa porque dentro de una lección hay varios ejercicios de voz seguidos, y
 * una escucha que nadie cerró es un micrófono que el sistema no le da al
 * siguiente. En un iPhone no sale ningún error: simplemente deja de oír.
 */

interface Escucha {
  vivo: boolean;
}
const escuchas: Escucha[] = [];
let recon: ReconocedorFalso | null = null;
const vivas = () => escuchas.filter((e) => e.vivo).length;

/** El último reconocedor creado, para poder hablarle desde la prueba. */
function apuntar(nuevo: ReconocedorFalso) {
  recon = nuevo;
}

class ReconocedorFalso {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  private mia: Escucha | null = null;

  constructor() {
    apuntar(this);
  }

  start() {
    this.mia = { vivo: true };
    escuchas.push(this.mia);
  }

  private acabar() {
    if (!this.mia) return;
    this.mia.vivo = false;
    this.mia = null;
    this.onend?.();
  }

  stop() {
    this.acabar();
  }

  abort() {
    this.acabar();
  }

  fallar(motivo: string) {
    this.onerror?.({ error: motivo });
  }
}

vi.mock('@/lib/api', () => ({ api: { post: () => Promise.resolve({}) } }));

const EJERCICIO = {
  code: 'L9-U2-04-E01',
  prompt: {
    instruction_es: 'Habla durante quince segundos.',
    task_en: 'Describe your last holiday.',
    minSeconds: 15,
  },
};

beforeEach(() => {
  escuchas.length = 0;
  recon = null;
  vi.stubGlobal('webkitSpeechRecognition', ReconocedorFalso);
});

afterEach(() => vi.unstubAllGlobals());

describe('el micrófono en hablar libre', () => {
  it('si el micrófono falla, cierra la escucha en vez de dejarla viva', async () => {
    const usuario = userEvent.setup();
    render(<HablarLibre ejercicio={EJERCICIO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar|hablar|micr/i }));
    expect(vivas()).toBe(1);

    await act(async () => {
      recon?.fallar('audio-capture');
    });

    expect(vivas(), 'la escucha sigue abierta mientras se enseña el aviso').toBe(0);
    await screen.findByText(/micrófono no respondió/i);
  });

  it('volver a intentarlo no deja dos escuchas abiertas a la vez', async () => {
    const usuario = userEvent.setup();
    render(<HablarLibre ejercicio={EJERCICIO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar|hablar|micr/i }));
    await act(async () => {
      recon?.fallar('audio-capture');
    });
    await usuario.click(screen.getByRole('button', { name: /empezar|hablar|micr/i }));

    // Una sola: la nueva. Dos reconocedores no se reparten el micrófono.
    expect(vivas()).toBe(1);
  });
});
