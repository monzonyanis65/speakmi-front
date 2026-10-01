import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Ruta } from './Ruta';
import { useSesion } from '@/store/sesion';

/**
 * La pantalla de inicio.
 *
 * QUÉ SE PRUEBA AQUÍ Y POR QUÉ ESTO
 *
 * Esta pantalla tiene un solo trabajo: enseñar POR DÓNDE SIGUES. Todo lo demás
 * —saludo, acciones, cifras— es decoración alrededor de eso. Llegó a tener
 * delante nueve bloques del mismo tamaño y había que bajar pantalla y media
 * para ver la primera lección, que es como decirle a alguien que para entrar a
 * su casa pase antes por el salón del vecino.
 *
 * Así que lo que se aprieta aquí es CUÁNTO HAY QUE PASAR ANTES DEL CAMINO, y no
 * cómo de bonito queda. jsdom no mide píxeles, de modo que el número de píxeles
 * lo comprueba la prueba de navegador; lo que se guarda aquí es lo que sí se
 * puede contar sin pintar: cuántas cosas pulsables quedan por delante del
 * primer nodo y qué bloques dejaron de estar.
 *
 * Y se prueba lo contrario con el mismo cuidado: que quitar no fue esconder.
 * Repaso, llamada, conversación, tienda, guía y menú siguen saliendo de aquí.
 */

const NIVEL = {
  level: { code: 'L6', titleEs: 'Lo que hago y lo que hice', cefr: 'A2' },
  units: [
    {
      code: 'L6-U1',
      titleEs: 'Nos conocemos',
      titleEn: 'Nice to meet you',
      canDoStatements: ['Puedo saludar y despedirme', 'Puedo decir de dónde soy'],
      lessons: [
        {
          code: 'L6-U1-L1',
          titleEs: 'Saludos',
          type: 'vocab',
          estMinutes: 5,
          xpReward: 10,
          exercisesCount: 8,
          completed: false,
        },
        {
          code: 'L6-U1-L2',
          titleEs: 'De dónde eres',
          type: 'grammar',
          estMinutes: 6,
          xpReward: 10,
          exercisesCount: 8,
          completed: false,
        },
      ],
    },
  ],
};

const EXAMEN = {
  levelCode: 'L6',
  leccionesHechas: 0,
  leccionesTotales: 2,
  desbloqueado: false,
  hayExamen: true,
  aprobado: false,
  intentos: 0,
  enCurso: false,
  ultimo: null,
  cursoTerminado: false,
};

const PROGRESO = {
  xpTotal: 1240,
  xpHoy: 30,
  leccionesCompletadas: 27,
  racha: { currentDays: 4, longestDays: 11, freezesAvailable: 1 },
  repasosPendientes: 3,
  dominio: [{ skillCode: 'PRESENTE', titleEs: 'Presente simple', mastery: 0.4, attempts: 6 }],
  debilidades: [
    { category: 'ORDEN', veces: 5, ultimoEjemplo: 'I go never', ultimoEsperado: 'I never go' },
  ],
};

const MISIONES = {
  dia: '2026-09-28',
  terminaEl: '2026-09-29T04:00:00.000Z',
  diarias: [
    {
      codigo: 'UNA_LECCION',
      tituloEs: 'Termina una lección',
      icono: '📘',
      hecho: 0,
      objetivo: 1,
      xp: 10,
      cumplida: false,
    },
    {
      codigo: 'TRES_LECCIONES',
      tituloEs: 'Termina 3 lecciones',
      icono: '🎯',
      hecho: 0,
      objetivo: 3,
      xp: 15,
      cumplida: false,
    },
    {
      codigo: 'UNA_PARTIDA',
      tituloEs: 'Juega una partida',
      icono: '🎮',
      hecho: 0,
      objetivo: 1,
      xp: 15,
      cumplida: false,
    },
  ],
  mes: {
    mes: '2026-09',
    tituloEs: 'Termina 20 lecciones este mes',
    hecho: 13,
    objetivo: 20,
    xp: 100,
    congelados: 1,
    cumplida: false,
    terminaEl: '2026-10-01T04:00:00.000Z',
    diasQueQuedan: 3,
  },
  recienCumplidas: [] as string[],
};

function servidor() {
  return vi.fn((entrada: string) => {
    const ruta = String(entrada);
    const cuerpo = ruta.endsWith('/me/level')
      ? { level: { levelCode: 'L6' } }
      : ruta.includes('/curriculum/levels/')
        ? NIVEL
        : ruta.endsWith('/exam')
          ? EXAMEN
          : ruta.endsWith('/progress')
            ? PROGRESO
            : ruta.endsWith('/me/wallet')
              ? { coins: 120 }
              : ruta.endsWith('/misiones')
                ? MISIONES
                : null;

    if (cuerpo === null) {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({ error: { code: 'SYS-003', message: 'Esa dirección no existe.' } }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) });
  });
}

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <Ruta />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** El botón del primer nodo del camino, que es lo que se viene a ver. */
function primeraLeccion(): HTMLElement {
  return screen.getByRole('button', { name: /^Saludos\./ });
}

/**
 * Cuántas cosas pulsables hay DELANTE del primer nodo, en orden de documento.
 *
 * Es el sustituto honesto de «cuántos píxeles hay que bajar» mientras se prueba
 * en jsdom, que no pinta nada. No es una medida perfecta —una tarjeta alta
 * cuenta lo mismo que un botón bajo— pero sí detecta lo que pasó de verdad:
 * cada vez que se añadía algo a la portada, se añadía delante del camino.
 */
function pulsablesAntesDelCamino(contenedor: HTMLElement): number {
  const pulsables = [...contenedor.querySelectorAll('button, a')];
  const nodo = primeraLeccion();
  const indice = pulsables.indexOf(nodo);
  expect(indice).toBeGreaterThanOrEqual(0);
  return indice;
}

/*
  jsdom no trae ninguna de las dos y la ruta usa las dos: la mascota pregunta por
  el movimiento y el nodo actual se desplaza solo hasta ponerse a la vista.

  Se ponen una vez para todo el archivo y NO con `stubGlobal`, porque el nodo
  pregunta por el movimiento dentro de un temporizador de 600 ms: con un doble
  que se retira al acabar cada prueba, ese temporizador caía fuera y reventaba
  la suite entera desde una prueba que ya había terminado bien.
*/
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (consulta: string) => ({
    matches: false,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  }),
});
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  useSesion.setState({
    usuario: { id: 'u1', email: 'yanis@ejemplo.com', displayName: 'Yanis', role: 'student' },
  });
  vi.stubGlobal('fetch', servidor());
});

afterEach(() => {
  vi.unstubAllGlobals();
  useSesion.setState({ usuario: null });
});

describe('la portada pone el camino primero', () => {
  it('deja como mucho seis cosas pulsables por delante del primer nodo', async () => {
    const { container } = renderizar();
    await screen.findByRole('button', { name: /^Saludos\./ });

    /*
      Seis: el menú, las monedas, las tres acciones del día y la guía de la
      unidad. Si este número sube es que algo nuevo se coló DELANTE del camino,
      que es exactamente la avería que esta pantalla ya tuvo una vez.
    */
    expect(pulsablesAntesDelCamino(container)).toBeLessThanOrEqual(6);
  });

  it('no despliega los objetivos de la unidad: para eso está el botón de guía', async () => {
    renderizar();
    await screen.findByRole('button', { name: /^Saludos\./ });

    expect(screen.queryByText('Puedo saludar y despedirme')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guía/i })).toBeInTheDocument();
  });

  it('no repite los subtítulos de las acciones, que se leen una vez y estorban siempre', async () => {
    renderizar();
    await screen.findByRole('button', { name: /^Saludos\./ });

    expect(screen.queryByText(/Una conversación hablada, en inglés/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Si ahora no puedes hablar en voz alta/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cosas que fallaste y toca volver a ver/)).not.toBeInTheDocument();
  });

  it('manda los desafíos y las debilidades a su pantalla, no a la portada', async () => {
    renderizar();
    await screen.findByRole('button', { name: /^Saludos\./ });

    expect(screen.queryByText('Desafíos de hoy')).not.toBeInTheDocument();
    expect(screen.queryByText('Desafío del mes')).not.toBeInTheDocument();
    expect(screen.queryByText('En lo que más fallas')).not.toBeInTheDocument();
  });

  it('dice los repasos pendientes con un número al lado del icono, sin una fila propia', async () => {
    renderizar();
    const repasar = await screen.findByRole('button', { name: /repaso/i });

    // El número está dentro del propio botón de repasar: eso es la chapa.
    expect(repasar).toHaveAccessibleName(/3 repasos/);
    expect(repasar).toHaveTextContent('3');

    // Y no late. Un aviso que se mueve en bucle es una notificación gritando.
    expect(repasar.querySelector('.animate-latido')).toBeNull();
  });
});

describe('quitar no fue esconder', () => {
  it('sigue saliendo de aquí todo lo que salía: repaso, llamada, conversación, tienda, guía y menú', async () => {
    renderizar();
    await screen.findByRole('button', { name: /^Saludos\./ });

    expect(screen.getByRole('button', { name: /repaso/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /llamar a milo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /conversar escribiendo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /monedas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guía/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tu cuenta/i })).toBeInTheDocument();
  });

  it('las cuatro cifras siguen estando, en una tira y no en cuatro casillas', async () => {
    renderizar();
    await screen.findByRole('button', { name: /^Saludos\./ });

    await waitFor(() => {
      // Con el congelado contado dentro de la racha: era un renglón suelto más.
      expect(screen.getByText(/^4 días de racha, con un congelado/)).toBeInTheDocument();
    });
    expect(screen.getByText('1240 de experiencia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '120 monedas' })).toBeInTheDocument();
    expect(screen.getByText('27 lecciones hechas')).toBeInTheDocument();
  });

  it('Milo sigue saludando y diciendo qué toca hoy', async () => {
    renderizar();
    // La lección por la que se sigue, no la unidad: la unidad ya está escrita
    // en la tarjeta morada que viene justo debajo.
    expect(await screen.findByText(/Hola, Yanis\. Hoy toca «Saludos»/)).toBeInTheDocument();
  });
});
