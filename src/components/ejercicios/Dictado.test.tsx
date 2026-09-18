import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ejercicio } from './Ejercicio';

/**
 * El dictado depende del sintetizador del navegador, que en las pruebas no
 * existe. Se sustituye por uno falso que apunta lo que se le pidió decir y a
 * qué velocidad: es justo lo que hay que comprobar, porque la frase no puede
 * aparecer nunca en pantalla.
 */
interface FraseDicha {
  texto: string;
  velocidad: number;
}

let dichas: FraseDicha[] = [];

function montarVozFalsa() {
  dichas = [];

  class UtteranceFalsa {
    lang = '';
    rate = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }

  vi.stubGlobal('SpeechSynthesisUtterance', UtteranceFalsa);
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [{ lang: 'en-US', name: 'Falsa', localService: true }],
    cancel: vi.fn(),
    speak: (frase: UtteranceFalsa) => {
      dichas.push({ texto: frase.text, velocidad: frase.rate });
      setTimeout(() => frase.onend?.(), 0);
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

const EJERCICIO = {
  code: 'L1-U1-01-E04',
  type: 'listen_type',
  difficulty: 1,
  prompt: {
    instruction_es: 'Escucha y escribe lo que oigas.',
    speakText: 'Good morning',
  },
};

beforeEach(montarVozFalsa);
afterEach(() => vi.unstubAllGlobals());

describe('escuchar y escribir', () => {
  it('lee la frase al entrar, sin enseñarla', async () => {
    const { container } = render(
      <Ejercicio ejercicio={EJERCICIO} bloqueado={false} onCambio={() => {}} />,
    );

    await waitFor(() => expect(dichas).toHaveLength(1));
    expect(dichas[0]!.texto).toBe('Good morning');

    // Lo importante: la frase no puede estar escrita en ninguna parte, o el
    // ejercicio se convierte en copiar.
    expect(container.textContent).not.toContain('Good morning');
  });

  it('el botón de tortuga la repite más despacio', async () => {
    const usuario = userEvent.setup();
    render(<Ejercicio ejercicio={EJERCICIO} bloqueado={false} onCambio={() => {}} />);

    await waitFor(() => expect(dichas).toHaveLength(1));
    const normal = dichas[0]!.velocidad;

    await usuario.click(screen.getByRole('button', { name: /más despacio/i }));

    await waitFor(() => expect(dichas).toHaveLength(2));
    expect(dichas[1]!.velocidad).toBeLessThan(normal);
  });

  it('avisa al padre de lo que se escribe, ya recortado', async () => {
    const usuario = userEvent.setup();
    const cambios: Array<unknown> = [];
    render(
      <Ejercicio
        ejercicio={EJERCICIO}
        bloqueado={false}
        onCambio={(valor) => cambios.push(valor)}
      />,
    );

    await usuario.type(screen.getByPlaceholderText(/escribe lo que oíste/i), 'Good morning');
    expect(cambios.at(-1)).toBe('Good morning');
  });

  it('un campo vacío no cuenta como respuesta', async () => {
    const usuario = userEvent.setup();
    const cambios: Array<unknown> = [];
    render(
      <Ejercicio
        ejercicio={EJERCICIO}
        bloqueado={false}
        onCambio={(valor) => cambios.push(valor)}
      />,
    );

    const campo = screen.getByPlaceholderText(/escribe lo que oíste/i);
    await usuario.type(campo, 'a');
    await usuario.clear(campo);

    // Si no, el botón de comprobar se quedaría activo con el campo en blanco.
    expect(cambios.at(-1)).toBeNull();
  });

  it('sin sintetizador lo dice, en vez de dejar un botón muerto', async () => {
    vi.unstubAllGlobals();
    const original = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
    // @ts-expect-error se borra a propósito para simular un navegador sin voz
    delete window.speechSynthesis;

    render(<Ejercicio ejercicio={EJERCICIO} bloqueado={false} onCambio={() => {}} />);
    expect(screen.getByText(/no puede leer en voz alta/i)).toBeTruthy();

    if (original) Object.defineProperty(window, 'speechSynthesis', original);
  });
});
