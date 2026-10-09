import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
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

  /** Como si hubiera entendido una frase. */
  oir(texto: string) {
    this.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: texto, confidence: 0.9 }], { isFinal: true })],
    });
  }

  fallar(motivo: string) {
    this.onerror?.({ error: motivo });
  }
}

/** Si el aparato deja grabar. Sin grabación no hay servidor al que recurrir. */
let hayGrabacion = true;
/** Lo que el servidor oye de verdad en el audio grabado. */
let loQueOyeElServidor = '';
/** Lo que se mandó a evaluar, que es lo que el ejercicio acaba juzgando. */
const evaluadas: Array<Record<string, unknown>> = [];

vi.mock('@/lib/api', () => ({
  api: {
    post: (ruta: string, cuerpo?: unknown) => {
      if (ruta.startsWith('/speech/transcribe'))
        return Promise.resolve({ text: loQueOyeElServidor });
      evaluadas.push(cuerpo as Record<string, unknown>);
      return Promise.resolve({
        aprobado: true,
        score: 0.8,
        message_es: 'bien',
        logros_es: [],
        mejoras_es: [],
        faltaron: [],
        transcript: String((cuerpo as { transcript?: string })?.transcript ?? ''),
        seconds: 20,
      });
    },
  },
}));

/*
  La grabación y la medida del volumen. El audio de mentira lleva voz dentro:
  medir que NO la lleva es lo que impide puntuar un silencio, y eso ya tiene su
  propia prueba en `lib/wav.test.ts`.
*/
vi.mock('@/lib/grabacion', () => ({
  grabar: () =>
    Promise.resolve(
      hayGrabacion
        ? { terminar: () => Promise.resolve({ size: 50_000 } as Blob), cancelar: () => {} }
        : null,
    ),
}));

vi.mock('@/lib/wav', () => ({
  wavDesdeGrabacion: () => Promise.resolve({ wav: null, pico: 0.4 }),
  PICO_MINIMO: 0.01,
}));

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
  evaluadas.length = 0;
  loQueOyeElServidor = '';
  hayGrabacion = true;
  recon = null;
  vi.stubGlobal('webkitSpeechRecognition', ReconocedorFalso);
});

afterEach(() => vi.unstubAllGlobals());

describe('el micrófono en hablar libre', () => {
  /*
    Que el reconocedor se rinda ya NO es el final.

    Antes sí lo era: saltaba el error, se soltaba todo y el ejercicio se
    quedaba sin hacer. Ahora, si la grabación sigue viva, se sigue escuchando
    solo con ella y al parar transcribe el servidor. Es lo mismo que hace la
    llamada, y es lo que convierte un «el micrófono no respondió» en un
    ejercicio que se termina igual.
  */
  it('si el reconocedor se rinde pero se está grabando, el ejercicio se puede terminar', async () => {
    const usuario = userEvent.setup();
    loQueOyeElServidor = 'My father works in a school.';
    render(<HablarLibre ejercicio={EJERCICIO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar|hablar|micr/i }));
    await act(async () => {
      recon?.fallar('audio-capture');
    });

    // Ni aviso de avería ni vuelta atrás: se sigue grabando.
    expect(screen.queryByText(/micrófono no respondió/i)).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /termin|parar|listo/i }));

    await waitFor(() => expect(evaluadas).toHaveLength(1));
    expect(evaluadas[0]!.transcript).toBe('My father works in a school.');
  });

  it('si se rinde y encima no se graba, se suelta todo y se dice', async () => {
    const usuario = userEvent.setup();
    hayGrabacion = false;
    render(<HablarLibre ejercicio={EJERCICIO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar|hablar|micr/i }));
    await act(async () => {
      recon?.fallar('audio-capture');
    });

    // Aquí no queda nada a lo que agarrarse, así que se devuelve el micrófono
    // en vez de dejar la escucha viva detrás del aviso.
    await screen.findByText(/micrófono no respondió/i);
    expect(vivas(), 'la escucha sigue abierta mientras se enseña el aviso').toBe(0);
  });

  /*
    El «OK» que no dijiste.

    Este ejercicio solo usaba el reconocedor del navegador, y ese reconocedor,
    con habla libre y acento, se pierde: de una respuesta entera sacaba un «OK»
    y lo entregaba como si fuera todo. El ejercicio entonces te regañaba por no
    haber hablado, citando unas palabras que no eran las tuyas.

    Ahora se graba a la vez y manda el servidor, que para esto oye mucho mejor.
  */
  it('evalúa lo que oye el servidor, no el «OK» que entendió el navegador', async () => {
    const usuario = userEvent.setup();
    loQueOyeElServidor = 'My mother works in a hospital and she starts at seven.';
    render(<HablarLibre ejercicio={EJERCICIO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar|hablar|micr/i }));
    // El navegador entiende una miseria, que es justo lo que pasaba.
    await act(async () => {
      recon?.oir('OK');
    });
    await usuario.click(screen.getByRole('button', { name: /termin|parar|listo/i }));

    await waitFor(() => expect(evaluadas).toHaveLength(1));
    expect(evaluadas[0]!.transcript).toBe('My mother works in a hospital and she starts at seven.');
  });

  it('si el servidor no puede, se sigue con lo que entendió el navegador', async () => {
    const usuario = userEvent.setup();
    loQueOyeElServidor = '';
    render(<HablarLibre ejercicio={EJERCICIO} onTerminado={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /empezar|hablar|micr/i }));
    await act(async () => {
      recon?.oir('My mother works in a shop');
    });
    await usuario.click(screen.getByRole('button', { name: /termin|parar|listo/i }));

    await waitFor(() => expect(evaluadas).toHaveLength(1));
    expect(evaluadas[0]!.transcript).toBe('My mother works in a shop');
  });
});
