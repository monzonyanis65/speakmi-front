import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ejercicio } from './Ejercicio';

/**
 * El par mínimo vive del sintetizador, que en las pruebas no existe. Se
 * sustituye por uno falso que apunta qué se dijo y a qué velocidad: es lo único
 * que se puede comprobar, porque las palabras no pueden aparecer en pantalla.
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
  code: 'L6-U1-03-E07',
  type: 'minimal_pair',
  difficulty: 2,
  prompt: {
    instruction_es: '¿Suenan igual o distinto?',
    speakA: 'sheep',
    speakB: 'ship',
    // Escrito a propósito con las palabras dentro: es el caso peligroso, porque
    // enseñarlo antes de responder sería regalar la respuesta.
    focus_es: 'la i larga de sheep frente a la corta de ship',
  },
};

beforeEach(montarVozFalsa);
afterEach(() => vi.unstubAllGlobals());

/**
 * Mientras suena algo, los botones de escuchar están apagados para que dos
 * palabras no se solapen. Hay que esperar a que callen antes de pulsar otra vez.
 */
async function esperarSilencio() {
  await waitFor(() => {
    const boton = screen.getByRole('button', { name: /las dos seguidas/i });
    expect((boton as HTMLButtonElement).disabled).toBe(false);
  });
}

describe('par mínimo', () => {
  it('el primer botón dice la primera palabra', async () => {
    const usuario = userEvent.setup();
    render(<Ejercicio ejercicio={EJERCICIO} bloqueado={false} onCambio={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /primera palabra/i }));

    await waitFor(() => expect(dichas).toHaveLength(1));
    expect(dichas[0]!.texto).toBe('sheep');

    // Y el segundo la segunda, no otra vez la primera.
    await esperarSilencio();
    await usuario.click(screen.getByRole('button', { name: /segunda palabra/i }));
    await waitFor(() => expect(dichas).toHaveLength(2));
    expect(dichas[1]!.texto).toBe('ship');
  });

  it('el botón de las dos seguidas las dice en orden', async () => {
    const usuario = userEvent.setup();
    render(<Ejercicio ejercicio={EJERCICIO} bloqueado={false} onCambio={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /las dos seguidas/i }));

    await waitFor(() => expect(dichas).toHaveLength(2));
    expect(dichas.map((frase) => frase.texto)).toEqual(['sheep', 'ship']);
  });

  it('el botón de tortuga las repite más despacio', async () => {
    const usuario = userEvent.setup();
    render(<Ejercicio ejercicio={EJERCICIO} bloqueado={false} onCambio={() => {}} />);

    await usuario.click(screen.getByRole('button', { name: /primera palabra/i }));
    await waitFor(() => expect(dichas).toHaveLength(1));
    const normal = dichas[0]!.velocidad;

    await esperarSilencio();
    await usuario.click(screen.getByRole('button', { name: /más despacio/i }));

    await waitFor(() => expect(dichas).toHaveLength(3));
    expect(dichas[1]!.texto).toBe('sheep');
    expect(dichas[1]!.velocidad).toBeLessThan(normal);
  });

  it('las palabras no se enseñan escritas en ninguna parte', async () => {
    const usuario = userEvent.setup();
    const { container } = render(
      <Ejercicio ejercicio={EJERCICIO} bloqueado={false} onCambio={() => {}} />,
    );

    // Ni al entrar, ni después de oírlas, ni en un aria-label: si se vieran,
    // esto dejaría de ser un ejercicio de oído.
    expect(container.innerHTML).not.toContain('sheep');
    expect(container.innerHTML).not.toContain('ship');

    await usuario.click(screen.getByRole('button', { name: /las dos seguidas/i }));
    await waitFor(() => expect(dichas).toHaveLength(2));

    expect(container.innerHTML).not.toContain('sheep');
    expect(container.innerHTML).not.toContain('ship');
  });

  it('elegir una opción avisa al padre con 0 o 1', async () => {
    const usuario = userEvent.setup();
    const cambios: Array<unknown> = [];
    render(
      <Ejercicio
        ejercicio={EJERCICIO}
        bloqueado={false}
        onCambio={(valor) => cambios.push(valor)}
      />,
    );

    const misma = screen.getByRole('button', { name: /la misma palabra/i });
    const distintas = screen.getByRole('button', { name: /dos palabras distintas/i });

    await usuario.click(misma);
    expect(cambios.at(-1)).toBe(0);
    expect(misma.getAttribute('aria-pressed')).toBe('true');

    await usuario.click(distintas);
    expect(cambios.at(-1)).toBe(1);
    expect(distintas.getAttribute('aria-pressed')).toBe('true');
    expect(misma.getAttribute('aria-pressed')).toBe('false');
  });

  it('al corregir marca la buena aunque se hubiera elegido la otra', async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(
      <Ejercicio ejercicio={EJERCICIO} bloqueado={false} onCambio={() => {}} />,
    );

    await usuario.click(screen.getByRole('button', { name: /la misma palabra/i }));

    rerender(
      <Ejercicio
        ejercicio={EJERCICIO}
        bloqueado
        onCambio={() => {}}
        resultado={{
          isCorrect: false,
          score: 0,
          feedback: {
            message_es: 'No es así.',
            correcta: 'Eran dos palabras distintas',
            errores: [],
          },
        }}
      />,
    );

    // El color no puede ser la única señal, así que cada una lleva su icono.
    expect(screen.getByRole('button', { name: /dos palabras distintas/i }).textContent).toContain(
      '✓',
    );
    expect(screen.getByRole('button', { name: /la misma palabra/i }).textContent).toContain('✕');
  });

  it('sin sintetizador lo dice, en vez de dejar un botón muerto', () => {
    vi.unstubAllGlobals();
    const original = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
    // @ts-expect-error se borra a propósito para simular un navegador sin voz
    delete window.speechSynthesis;

    render(<Ejercicio ejercicio={EJERCICIO} bloqueado={false} onCambio={() => {}} />);
    expect(screen.getByText(/no puede leer en voz alta/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /primera palabra/i })).toBeNull();

    if (original) Object.defineProperty(window, 'speechSynthesis', original);
  });
});
