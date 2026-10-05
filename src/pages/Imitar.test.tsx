import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Imitar } from './Imitar';

/**
 * La pantalla de imitar el ritmo, ya fuera de la lección.
 *
 * Dentro de una lección el shadowing recibía el código del ejercicio que tenías
 * delante. Aquí no hay ninguno, así que lo que esta pantalla hace de verdad es
 * ELEGIR la frase, y es ahí donde puede fallar en silencio: una pantalla que
 * sale con una frase cualquiera se ve igual de bien que una que sale con la
 * tuya.
 *
 * El componente de shadowing va fingido a propósito. De verdad pediría
 * micrófono, montaría un `<audio>` y sondaría los auriculares, y nada de eso es
 * lo que se viene a mirar: eso ya está probado en `Shadowing.test.tsx`. Lo que
 * se mira es QUÉ código recibe.
 */

vi.mock('@/components/ejercicios/Shadowing', () => ({
  Shadowing: ({ ejercicio }: { ejercicio: { code: string } }) => (
    <div data-testid="shadowing" data-code={ejercicio.code} />
  ),
}));

const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (ruta: string) => get(ruta) } }));

const NIVEL = {
  units: [
    {
      lessons: [
        { code: 'L6-U5-05', titleEs: 'Léelo en voz alta', type: 'speaking', completed: true },
        { code: 'L6-U5-07', titleEs: 'Repaso de unidad', type: 'checkpoint', completed: false },
      ],
    },
  ],
};

/** Qué contesta el servidor a cada ruta, por lección. */
function servidor(porLeccion: Record<string, unknown[]>, nivel: unknown = NIVEL) {
  get.mockImplementation((ruta: string) => {
    if (ruta === '/me/level') return Promise.resolve({ level: { levelCode: 'L6' } });
    if (ruta.startsWith('/curriculum/levels/')) return Promise.resolve(nivel);
    const code = ruta.replace('/curriculum/lessons/', '');
    return Promise.resolve({ exercises: porLeccion[code] ?? [] });
  });
}

function leer(code: string, texto: string) {
  return { code, type: 'read_aloud', prompt: { referenceText: texto } };
}

function abrir() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/imitar']}>
        <Imitar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => get.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('imitar el ritmo con su propia puerta', () => {
  it('saca la frase de una lección del nivel, no de ninguna parte', async () => {
    servidor({ 'L6-U5-05': [leer('L6-U5-05-E01', 'My father studied medicine.')] });
    abrir();

    const pantalla = await screen.findByTestId('shadowing');
    expect(pantalla).toHaveAttribute('data-code', 'L6-U5-05-E01');
  });

  it('dice de dónde viene la frase, porque cambia lo que se espera de ella', async () => {
    /*
      «De algo que ya hiciste» quiere decir que el vocabulario no es el reto y
      que lo único que se mide es cómo suena. Sin esta línea la frase aparecería
      de la nada, que es como se siente un ejercicio al azar.
    */
    servidor({ 'L6-U5-05': [leer('L6-U5-05-E01', 'My father studied medicine.')] });
    abrir();

    expect(await screen.findByText(/ya hiciste/i)).toBeInTheDocument();
    expect(screen.getByText(/Léelo en voz alta/)).toBeInTheDocument();
  });

  it('«otra frase» cambia de frase sin volver a la red', async () => {
    /*
      Las otras frases de la misma lección son gratis: ya se descargaron. Pedir
      la lección otra vez por cada frase sería un viaje por cada toque.
    */
    const quien = userEvent.setup();
    servidor({
      'L6-U5-05': [leer('L6-U5-05-E01', 'Uno.'), leer('L6-U5-05-E02', 'Dos.')],
    });
    abrir();

    const primera = (await screen.findByTestId('shadowing')).getAttribute('data-code');
    const peticiones = get.mock.calls.length;

    await quien.click(screen.getByRole('button', { name: /otra frase/i }));

    expect(screen.getByTestId('shadowing')).not.toHaveAttribute('data-code', primera);
    expect(get.mock.calls.length).toBe(peticiones);
  });

  it('al agotar una lección pasa a la siguiente', async () => {
    const quien = userEvent.setup();
    servidor({
      'L6-U5-05': [leer('L6-U5-05-E01', 'Uno.')],
      'L6-U5-07': [leer('L6-U5-07-E03', 'Tres.')],
    });
    abrir();

    await screen.findByTestId('shadowing');
    await quien.click(screen.getByRole('button', { name: /otra frase/i }));

    expect(await screen.findByTestId('shadowing')).toHaveAttribute('data-code', 'L6-U5-07-E03');
  });

  it('una lección sin frases se salta en vez de dar la pantalla por vacía', async () => {
    /*
      Las candidatas se eligen por el TIPO de lección, que es lo único que el
      temario dice sin pedir cada lección entera, y un `checkpoint` puede no
      traer ninguna frase hablada. Sin el salto, caer en una de esas diría «no
      hay frases» teniéndolas dos lecciones más allá.
    */
    const quien = userEvent.setup();
    servidor({
      'L6-U5-05': [leer('L6-U5-05-E01', 'Uno.')],
      'L6-U5-07': [],
    });
    abrir();

    await screen.findByTestId('shadowing');
    await quien.click(screen.getByRole('button', { name: /otra frase/i }));

    expect(await screen.findByText(/no hay frases que imitar/i)).toBeInTheDocument();
  });

  it('sin ninguna frase lo dice y no se inventa una de relleno', async () => {
    // Imitar el ritmo de algo que no sale de tu curso es practicar sobre nada.
    servidor({}, { units: [] });
    abrir();

    expect(await screen.findByText(/no hay frases que imitar/i)).toBeInTheDocument();
    expect(screen.queryByTestId('shadowing')).toBeNull();
  });
});
