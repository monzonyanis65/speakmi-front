import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Perfil } from './Perfil';

const PERFIL = {
  email: 'yanis@ejemplo.com',
  displayName: 'Yanis',
  nativeLanguage: 'es',
  timezone: 'America/Caracas',
  dailyGoalMinutes: 15,
  createdAt: '2025-03-04T10:00:00.000Z',
  level: { code: 'L6', titleEs: 'Lo que hago y lo que hice', cefr: 'A2' },
};

const PROGRESO = {
  xpTotal: 1240,
  xpHoy: 30,
  leccionesCompletadas: 27,
  racha: { currentDays: 4, longestDays: 11 },
};

/**
 * Un `fetch` de mentira que contesta por ruta.
 *
 * Las rutas que no estén en el mapa devuelven el 404 del backend, que es justo
 * lo que responde hoy un endpoint que todavía no existe.
 */
function servidor(rutas: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const ruta = Object.keys(rutas).find((clave) => url.includes(clave));

    if (ruta === undefined) {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({ error: { code: 'SYS-003', message: 'Esa dirección no existe.' } }),
      });
    }

    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(rutas[ruta]) });
  });
}

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <Perfil />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // Los contadores animan con requestAnimationFrame; en jsdom basta con que el
  // número final esté, y para eso se pide menos movimiento.
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('perfil', () => {
  it('muestra el nombre, el correo, el nivel y las cifras', async () => {
    vi.stubGlobal('fetch', servidor({ '/me/profile': PERFIL, '/progress': PROGRESO }));
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Yanis' })).toBeInTheDocument();
    expect(screen.getByText('yanis@ejemplo.com')).toBeInTheDocument();
    expect(screen.getByText(/Lo que hago y lo que hice/)).toBeInTheDocument();
    expect(await screen.findByLabelText('1240 de experiencia')).toBeInTheDocument();
    expect(screen.getByLabelText('11 tu racha más larga')).toBeInTheDocument();
    expect(screen.getByLabelText('27 lecciones terminadas')).toBeInTheDocument();
  });

  it('guarda el nombre nuevo con PATCH', async () => {
    const llamadas = servidor({
      '/me/profile': { ...PERFIL, displayName: 'Yanis A.' },
      '/progress': PROGRESO,
    });
    vi.stubGlobal('fetch', llamadas);
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Cambiar' }));
    const campo = screen.getByLabelText('¿Cómo quieres que te llamemos?');
    await usuario.clear(campo);
    await usuario.type(campo, 'Yanis A.');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(llamadas).toHaveBeenCalledWith(
        expect.stringContaining('/me/profile'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('explica el fallo y no pierde lo escrito si el servidor rechaza el guardado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, opciones?: { method?: string }) => {
        if (opciones?.method === 'PATCH') {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () =>
              Promise.resolve({
                error: { code: 'SYS-001', message: 'Algo salió mal por nuestra parte.' },
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(url.includes('/progress') ? PROGRESO : PERFIL),
        });
      }),
    );
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Cambiar' }));
    const campo = screen.getByLabelText('¿Cómo quieres que te llamemos?');
    await usuario.clear(campo);
    await usuario.type(campo, 'Yanis A.');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/algo salió mal/i);
    expect(campo).toHaveValue('Yanis A.');
  });

  it('avisa sin romperse cuando el perfil todavía no existe en el servidor', async () => {
    vi.stubGlobal('fetch', servidor({ '/progress': PROGRESO }));
    renderizar();

    expect(await screen.findByText(/todavía no está disponible/i)).toBeInTheDocument();
    // Las cifras siguen ahí: las dos consultas se caen por separado.
    expect(await screen.findByLabelText('4 días de racha')).toBeInTheDocument();
  });

  it('no deja guardar una meta diaria fuera de 5 y 120', async () => {
    vi.stubGlobal('fetch', servidor({ '/me/profile': PERFIL, '/progress': PROGRESO }));
    const usuario = userEvent.setup();
    renderizar();

    const campo = await screen.findByLabelText('Minutos que quieres practicar cada día');
    await usuario.clear(campo);
    await usuario.type(campo, '300');
    await usuario.click(screen.getByRole('button', { name: 'Guardar meta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/entre 5 y 120/i);
  });
});
