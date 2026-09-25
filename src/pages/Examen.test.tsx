import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Examen } from './Examen';

/**
 * La pantalla del examen de nivel.
 *
 * Lo que se comprueba aquí son las tres cosas que la distinguen de una lección,
 * y que son justo las que se pierden si alguien la copia de `Leccion.tsx`:
 *
 *   1. que NO se dice si se acertó hasta el final. Un examen que corrige al
 *      momento deja de medir: se aprende del gesto de la pantalla;
 *   2. que el botón de saltar solo sale donde hace falta un aparato. En una
 *      pregunta de escribir no hay avería posible, y un botón de saltar ahí es
 *      la puerta para aprobar esquivando lo que cuesta;
 *   3. que al suspender se dice cuánto hacía falta y por dónde volver.
 */

const PREGUNTAS = [
  {
    code: 'EX-L1-U1-GRA',
    unitCode: 'L1-U1',
    skill: 'gramatica',
    type: 'multiple_choice',
    difficulty: 2,
    saltable: false,
    prompt: {
      instruction_es: 'Elige la forma correcta del verbo.',
      question: 'My sister ____ eleven years old.',
      options: [{ text: 'am' }, { text: 'is' }, { text: 'are' }],
    },
  },
  {
    code: 'EX-L1-U1-PRON',
    unitCode: 'L1-U1',
    skill: 'pronunciacion',
    type: 'read_aloud',
    difficulty: 2,
    saltable: true,
    prompt: { instruction_es: 'Léelo en voz alta.', referenceText: 'Hello! My name is Sofia.' },
  },
];

const SUSPENSO = {
  aprobado: false,
  score: 6,
  answered: 9,
  total: 12,
  minimo: 7,
  levelCode: 'L1',
  siguienteNivel: null,
  cursoTerminado: false,
  xpEarned: 0,
  coinsEarned: 0,
  porDestreza: [
    { skill: 'gramatica', aciertos: 2, total: 3 },
    { skill: 'pronunciacion', aciertos: 0, total: 0 },
  ],
  porUnidad: [
    { unitCode: 'L1-U1', aciertos: 3, total: 3 },
    { unitCode: 'L1-U4', aciertos: 0, total: 3 },
  ],
  flojas: ['L1-U4'],
};

const APROBADO = {
  ...SUSPENSO,
  aprobado: true,
  score: 11,
  answered: 12,
  minimo: 9,
  siguienteNivel: 'L2',
  xpEarned: 100,
  coinsEarned: 50,
  flojas: [],
};

/** Un servidor de mentira que apunta lo que se le manda. */
function servidor(final: unknown = SUSPENSO, { empezarFallaDespues = false } = {}) {
  const enviado: Array<Record<string, unknown>> = [];
  let aperturas = 0;

  const fetch = vi.fn((url: string, opciones?: { body?: string }) => {
    if (url.includes('/exam/empezar')) {
      aperturas += 1;
      // Al aprobar se cambia de nivel, y el examen del nivel nuevo está cerrado
      // hasta hacer sus lecciones: la segunda apertura responde 403.
      if (empezarFallaDespues && aperturas > 1) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () =>
            Promise.resolve({
              error: { code: 'EXA-002', message: 'Termina las lecciones del nivel.' },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ intento: 1, preguntas: PREGUNTAS, respondidas: [] }),
      });
    }

    if (url.includes('/exam/respuesta')) {
      enviado.push(JSON.parse(opciones?.body ?? '{}') as Record<string, unknown>);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ respondidas: enviado.length, total: PREGUNTAS.length }),
      });
    }

    if (url.includes('/exam/terminar')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(final) });
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: { code: 'SYS-003', message: 'No existe.' } }),
    });
  });

  return { fetch, enviado };
}

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <Examen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('la pantalla del examen', () => {
  it('no dice si acertaste al responder', async () => {
    const { fetch } = servidor();
    vi.stubGlobal('fetch', fetch);

    pintar();
    await screen.findByText('My sister ____ eleven years old.');

    await userEvent.click(screen.getByRole('button', { name: 'is' }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    /*
      Ni «correcto» ni «incorrecto» ni verde ni rojo: se pasa a la siguiente. Se
      comprueba por el contador, y no por el texto del ejercicio, porque en un
      navegador sin reconocimiento de voz la lectura en voz alta se pinta con un
      aviso en lugar de con la frase.
    */
    await screen.findByText('2/2');
    expect(screen.queryByText(/correct/i)).toBeNull();
    expect(screen.queryByText(/te equivocaste/i)).toBeNull();
  });

  it('solo deja saltar las preguntas que necesitan micrófono', async () => {
    const { fetch } = servidor();
    vi.stubGlobal('fetch', fetch);

    pintar();
    await screen.findByText('My sister ____ eleven years old.');

    // La de gramática no lleva botón de saltar: no hay avería que lo justifique.
    expect(screen.queryByRole('button', { name: /saltar/i })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'is' }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await screen.findByText('2/2');
    expect(screen.getByRole('button', { name: /saltar/i })).toBeInTheDocument();
  });

  it('al suspender dice cuánto hacía falta y por dónde volver', async () => {
    const { fetch } = servidor(SUSPENSO);
    vi.stubGlobal('fetch', fetch);

    pintar();
    await screen.findByText('My sister ____ eleven years old.');

    await userEvent.click(screen.getByRole('button', { name: 'is' }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await screen.findByText('2/2');
    await userEvent.click(screen.getByRole('button', { name: /saltar/i }));

    await screen.findByText('Casi');
    expect(screen.getByText(/Hacían falta 7 de 9/)).toBeInTheDocument();
    expect(screen.getByText(/Te faltaron 1/)).toBeInTheDocument();
    // La unidad floja, con su salida a la guía.
    expect(screen.getByRole('button', { name: /Guía de la unidad L1 · U4/ })).toBeInTheDocument();
    // Y se puede repetir en el momento.
    expect(screen.getByRole('button', { name: 'Intentarlo otra vez' })).toBeInTheDocument();

    /*
      Lo que no se midió se dice con palabras. Con una barra a cero, quien no
      tiene micrófono ve la fila de pronunciación como un suspenso cuando es
      exactamente lo contrario: no se midió.
    */
    expect(screen.getByText('no la hiciste, no cuenta')).toBeInTheDocument();
  });

  it('al aprobar dice a qué nivel se pasa', async () => {
    const { fetch, enviado } = servidor(APROBADO);
    vi.stubGlobal('fetch', fetch);

    pintar();
    await screen.findByText('My sister ____ eleven years old.');

    await userEvent.click(screen.getByRole('button', { name: 'is' }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await screen.findByText('2/2');
    await userEvent.click(screen.getByRole('button', { name: /saltar/i }));

    await screen.findByText('¡Aprobado!');
    expect(screen.getByText(/nivel 2/)).toBeInTheDocument();
    expect(screen.getByText(/\+100 XP/)).toBeInTheDocument();

    // Saltar se manda como respuesta vacía, no como un fallo inventado.
    await waitFor(() => expect(enviado).toHaveLength(2));
    expect(enviado[1]).toMatchObject({ code: 'EX-L1-U1-PRON', answer: null });
  });

  /**
   * Una regresión encontrada jugando, no leyendo.
   *
   * Al aprobar se cambia de nivel, y al principio la pantalla invalidaba la
   * consulta que abre el examen. Esa consulta se volvía a lanzar contra el nivel
   * NUEVO —cuyas lecciones no están hechas—, recibía un 403 y borraba el parte
   * de notas para enseñar «no pudimos abrir el examen». Aprobabas y la pantalla
   * te decía que algo había fallado.
   */
  it('el parte de notas no lo tapa un error al reabrir el examen', async () => {
    const { fetch } = servidor(APROBADO, { empezarFallaDespues: true });
    vi.stubGlobal('fetch', fetch);

    pintar();
    await screen.findByText('My sister ____ eleven years old.');

    await userEvent.click(screen.getByRole('button', { name: 'is' }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await screen.findByText('2/2');
    await userEvent.click(screen.getByRole('button', { name: /saltar/i }));

    await screen.findByText('¡Aprobado!');
    // Y sigue ahí un momento después, cuando ya se han resuelto las recargas.
    await waitFor(() => expect(screen.getByText('¡Aprobado!')).toBeInTheDocument());
    expect(screen.queryByText(/No pudimos abrir el examen/)).toBeNull();
  });

  it('cuando se acaba el curso lo dice', async () => {
    const { fetch } = servidor({
      ...APROBADO,
      siguienteNivel: null,
      cursoTerminado: true,
    });
    vi.stubGlobal('fetch', fetch);

    pintar();
    await screen.findByText('My sister ____ eleven years old.');

    await userEvent.click(screen.getByRole('button', { name: 'is' }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await screen.findByText('2/2');
    await userEvent.click(screen.getByRole('button', { name: /saltar/i }));

    await screen.findByText('Terminaste el curso');
    // Y no se promete un nivel nuevo que no existe.
    expect(screen.getByRole('button', { name: 'Volver a mi ruta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Empezar el nivel nuevo' })).toBeNull();
  });
});
