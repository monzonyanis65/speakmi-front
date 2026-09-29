import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Leccion } from './Leccion';

/**
 * Que se pueda imitar el ritmo, y no solo leer la frase.
 *
 *
 * POR QUÉ ESTÁ EN UN ARCHIVO APARTE
 *
 * `Leccion.test.tsx` mira el reparto de personajes y monta su escenario para
 * eso. Esto es otra pregunta —qué ejercicio se enseña en los de voz— y mezclar
 * las dos dejaría un archivo que se pone rojo por dos motivos distintos sin que
 * el nombre diga cuál.
 *
 *
 * QUÉ SE APRIETA
 *
 * Leer en voz alta y hacer shadowing NO son lo mismo, y esa diferencia es todo
 * el asunto: leer mide QUÉ palabras dijiste, imitar mide CÓMO las dijiste. El
 * ritmo es lo que de verdad separa a un hispanohablante —el inglés aplasta las
 * sílabas débiles para llegar a tiempo a las fuertes y el español las reparta
 * por igual— y era lo único que esta app no medía en ninguna parte.
 *
 * El motor y la pantalla del shadowing estaban construidos y probados, pero
 * colgando de una dirección suelta: desde la lección no había forma de llegar.
 * Esto es lo que comprueba que siga habiéndola.
 *
 * Y comprueba también lo que NO debe cambiar: que se entre leyendo. Quien ya
 * usaba la app no tiene que encontrarse otra cosa por sorpresa.
 */

vi.mock('@/components/Mascota', () => ({
  Mascota: () => <span data-testid="mascota" />,
  MascotaConMensaje: ({ mensaje }: { mensaje: string }) => (
    <span data-testid="mascota">{mensaje}</span>
  ),
}));

vi.mock('@/components/ejercicios/Ejercicio', () => ({ Ejercicio: () => null }));
vi.mock('@/components/Confeti', () => ({ Confeti: () => null }));

/*
  Los dos de voz van fingidos y cada uno dice quién es. Montando los de verdad
  esto pediría micrófono y audio, y lo que se viene a mirar es cuál de los dos
  se pone, no cómo funciona cada uno por dentro: eso ya está probado en sus
  propios archivos.
*/
vi.mock('@/components/ejercicios/LeerEnVozAlta', () => ({
  LeerEnVozAlta: () => <div data-testid="leer-en-voz-alta" />,
}));
vi.mock('@/components/ejercicios/HablarLibre', () => ({ HablarLibre: () => null }));
vi.mock('@/components/ejercicios/Shadowing', () => ({
  Shadowing: ({ ejercicio }: { ejercicio: { code: string } }) => (
    <div data-testid="shadowing" data-code={ejercicio.code} />
  ),
}));

const LEER = {
  code: 'L5-U1-03-E02',
  type: 'read_aloud',
  difficulty: 2,
  prompt: { referenceText: 'I usually get up at seven.' },
};

function respuesta(cuerpo: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) });
}

function servidor(ejercicio: Record<string, unknown>) {
  return vi.fn((url: unknown) => {
    const ruta = String(url);
    if (ruta.includes('/curriculum/lessons/')) {
      return respuesta({
        lesson: { code: 'L5-U1-03', titleEs: 'Mi rutina', type: 'speaking', xpReward: 10 },
        skills: [],
        exercises: [ejercicio],
      });
    }
    if (ruta.endsWith('/sessions/start')) return respuesta({ sessionId: 'ses-1' });
    return respuesta({});
  });
}

function abrir() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/leccion/L5-U1-03']}>
        <Routes>
          <Route path="/leccion/:code" element={<Leccion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('imitar el ritmo dentro de la lección', () => {
  it('se entra leyendo: quien ya usaba la app no se encuentra otra cosa', async () => {
    vi.stubGlobal('fetch', servidor(LEER));
    abrir();

    expect(await screen.findByTestId('leer-en-voz-alta')).toBeInTheDocument();
    expect(screen.queryByTestId('shadowing')).toBeNull();
  });

  it('desde un ejercicio de leer en voz alta se puede pasar a imitar', async () => {
    const quien = userEvent.setup();
    vi.stubGlobal('fetch', servidor(LEER));
    abrir();

    await screen.findByTestId('leer-en-voz-alta');
    await quien.click(screen.getByRole('button', { name: /imitar el ritmo/i }));

    expect(screen.getByTestId('shadowing')).toBeInTheDocument();
    expect(screen.queryByTestId('leer-en-voz-alta')).toBeNull();
  });

  it('imita LA MISMA frase, no otra cualquiera', async () => {
    /*
      Es el detalle que haría inútil todo lo demás sin que se notara: una
      pantalla de shadowing que sale con una frase distinta de la que estabas
      haciendo se ve perfecta y no practica lo que tenías delante.
    */
    const quien = userEvent.setup();
    vi.stubGlobal('fetch', servidor(LEER));
    abrir();

    await screen.findByTestId('leer-en-voz-alta');
    await quien.click(screen.getByRole('button', { name: /imitar el ritmo/i }));

    expect(screen.getByTestId('shadowing')).toHaveAttribute('data-code', LEER.code);
  });

  it('se puede volver a leerlo uno mismo', async () => {
    const quien = userEvent.setup();
    vi.stubGlobal('fetch', servidor(LEER));
    abrir();

    await screen.findByTestId('leer-en-voz-alta');
    await quien.click(screen.getByRole('button', { name: /imitar el ritmo/i }));
    await quien.click(screen.getByRole('button', { name: /mejor lo leo yo/i }));

    expect(screen.getByTestId('leer-en-voz-alta')).toBeInTheDocument();
    expect(screen.queryByTestId('shadowing')).toBeNull();
  });

  it('en los ejercicios escritos no se ofrece, porque no hay nada que imitar', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        code: 'L5-U1-03-E01',
        type: 'fill_blank',
        difficulty: 1,
        prompt: { text: 'She ___ a doctor.' },
      }),
    );
    abrir();

    await screen.findByRole('button', { name: /saltar|comprobar/i });
    expect(screen.queryByRole('button', { name: /imitar el ritmo/i })).toBeNull();
  });
});
