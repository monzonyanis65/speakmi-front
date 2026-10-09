import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Leccion } from './Leccion';

/**
 * Un ejercicio que suena, en un aparato que no puede sonar.
 *
 * El dictado y los pares mínimos empiezan por oír una frase. En un equipo sin
 * ninguna voz inglesa instalada —un Android en español, que es el caso para el
 * que se escribió todo el plan B del audio— el ejercicio enseña un aviso que
 * explica por qué no se puede y termina diciendo «mientras tanto, sáltalo».
 *
 * Y no se podía saltar. El botón de saltar solo salía en leer en voz alta y en
 * hablar libre, así que la única salida era la X: abandonar la lección entera
 * por un ejercicio que la propia pantalla reconocía imposible. Lo encontró el
 * recorrido en un navegador sin voces, parado en 5/9 sin nada que tocar.
 *
 * Esto vigila lo que no se puede probar mirando el aviso: que haya salida.
 */

const LECCION = {
  code: 'L2-U1-01',
  titleEs: 'Decir la hora',
  exercises: [
    {
      code: 'L2-U1-01-E01',
      type: 'listen_type',
      difficulty: 1,
      prompt: { instruction_es: 'Escucha y escribe lo que oyes.', speakText: 'Good morning' },
    },
    {
      code: 'L2-U1-01-E02',
      type: 'multiple_choice',
      difficulty: 1,
      prompt: {
        instruction_es: 'Elige.',
        question: '¿Cuál?',
        options: [{ text: 'a' }, { text: 'b' }],
      },
    },
  ],
};

/** Si el aparato tiene voz inglesa. Lo que decide todo este archivo. */
let hayVoz = false;

vi.mock('@/lib/voz', () => ({
  hayVozInglesa: () => Promise.resolve(hayVoz),
  vozInglesaYa: () => (hayVoz ? 'si' : 'no'),
  hayVoz: () => true,
  decir: () => Promise.resolve(),
  callar: () => {},
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: () => Promise.resolve(LECCION),
    post: () => Promise.resolve({ sessionId: 'sesion-1' }),
  },
  ApiError: class extends Error {},
}));

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/leccion/L2-U1-01']}>
        <Routes>
          <Route path="/leccion/:code" element={<Leccion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  hayVoz = false;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('un ejercicio que hay que oír, sin voz en el equipo', () => {
  it('se puede saltar en vez de dejar la lección sin salida', async () => {
    pintar();

    // El aviso que ya existía: explica por qué no se puede.
    await screen.findByText(/no hay ninguna voz en inglés/i);

    // Y lo que faltaba: una forma de obedecerlo.
    const salida = await screen.findByRole('button', { name: /saltar/i });
    expect(salida).toBeEnabled();
  });

  it('con voz en el equipo no aparece ese botón, que sería una puerta de atrás', async () => {
    hayVoz = true;
    pintar();

    await screen.findByText(/escucha y escribe/i);
    expect(screen.queryByRole('button', { name: /aquí no se puede oír/i })).not.toBeInTheDocument();
  });
});
