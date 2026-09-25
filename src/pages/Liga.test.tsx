import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Liga } from './Liga';

/**
 * La liga y los amigos.
 *
 * Lo que más se prueba aquí es el caso de HOY: una sola persona registrada. Es
 * el único escenario garantizado el primer día y es donde esta pantalla se
 * puede torcer, porque la tentación es enseñar una tabla de una fila o —peor—
 * rellenarla. Así que se comprueba explícitamente que no hay tabla, que se dice
 * cuánta gente falta y que aun así la pantalla tiene algo que decir.
 */

const SEMANA = {
  empiezaEn: '2026-09-21T04:00:00.000Z',
  // Lunes a las 00:00 de Caracas: el domingo a las 23:59 de allí.
  terminaEn: '2026-09-28T04:00:00.000Z',
};

const SOLO_YO = {
  semana: SEMANA,
  estado: 'faltan',
  participantes: 1,
  minimo: 5,
  tabla: [],
  miPuesto: null,
  miXp: 120,
  tuSemanaPasada: { xp: 80, puesto: null, participantes: null, monedas: null },
  premioNuevo: null,
};

const CON_LIGA = {
  semana: SEMANA,
  estado: 'viva',
  participantes: 34,
  minimo: 5,
  tabla: [
    { displayName: 'Marta', xp: 900, puesto: 1, soyYo: false },
    { displayName: 'Iván', xp: 850, puesto: 2, soyYo: false },
    { displayName: 'Rosa', xp: 700, puesto: 3, soyYo: false },
    { displayName: 'Luis', xp: 300, puesto: 11, soyYo: false },
    { displayName: 'Yanis', xp: 280, puesto: 12, soyYo: true },
    { displayName: 'Ana', xp: 250, puesto: 13, soyYo: false },
  ],
  miPuesto: 12,
  miXp: 280,
  tuSemanaPasada: { xp: 410, puesto: 6, participantes: 28, monedas: 0 },
  premioNuevo: null,
};

const AMIGOS_VACIO = {
  codigo: 'K7QM-3XRT',
  maximo: 50,
  yo: { displayName: 'Yanis', xpSemana: 120, racha: 3 },
  amigos: [],
};

const AMIGOS = {
  ...AMIGOS_VACIO,
  amigos: [
    { amistadId: 'a1', displayName: 'Marta', xpSemana: 400, racha: 12 },
    { amistadId: 'a2', displayName: 'Iván', xpSemana: 60, racha: 0 },
  ],
};

/**
 * Un servidor de mentira que responde por ruta.
 *
 * Se mira `url` y no el orden de las llamadas porque la pestaña de amigos se
 * pide solo al abrirla: encadenar respuestas por turnos haría que la prueba
 * dependiera de en qué momento React decide refrescar.
 */
function servidor(rutas: Record<string, unknown>, fallos: Record<string, number> = {}) {
  return vi.fn((entrada: string, opciones?: { method?: string }) => {
    const clave = `${opciones?.method ?? 'GET'} ${new URL(entrada, 'http://x').pathname}`;
    const estado = fallos[clave];

    if (estado !== undefined) {
      return Promise.resolve({
        ok: false,
        status: estado,
        json: () =>
          Promise.resolve({
            error: { code: 'SOC-001', message: 'No encontramos a nadie con ese código. Revísalo.' },
          }),
      });
    }

    const cuerpo = rutas[clave];
    if (cuerpo === undefined) {
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
        <Liga />
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

describe('el primer día, con una sola persona', () => {
  /*
    La prueba que justifica toda la pantalla. Con una tabla de una fila, o con
    nombres inventados para rellenarla, esto pasaría igual de no existir.
  */
  it('no enseña ninguna clasificación y dice cuánta gente falta', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/liga': SOLO_YO }));
    renderizar();

    expect(await screen.findByText('La liga aún no ha arrancado')).toBeInTheDocument();
    expect(screen.getByText(/ha sumado XP una persona/)).toBeInTheDocument();
    expect(screen.getByText(/faltan 4/)).toBeInTheDocument();

    // Nada de tabla: ni una fila, ni un puesto.
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText(/compitiendo/)).not.toBeInTheDocument();
  });

  it('aun así hay contra quién competir: tú mismo', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/liga': SOLO_YO }));
    renderizar();

    expect(await screen.findByText('120')).toBeInTheDocument();
    expect(
      screen.getByText(/40 XP más que a estas alturas la semana pasada \(80\)/),
    ).toBeInTheDocument();
  });

  it('una cuenta recién hecha no ve ceros que parezcan un fracaso', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        'GET /api/social/liga': {
          ...SOLO_YO,
          participantes: 0,
          miXp: 0,
          tuSemanaPasada: { xp: 0, puesto: null, participantes: null, monedas: null },
        },
      }),
    );
    renderizar();

    expect(
      await screen.findByText('Todavía no has sumado nada esta semana. Una lección y empiezas.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/todavía no ha sumado XP nadie/)).toBeInTheDocument();
  });
});

describe('la clasificación cuando hay gente', () => {
  it('enseña los puestos y marca el tuyo', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/liga': CON_LIGA }));
    renderizar();

    expect(await screen.findByText('Marta')).toBeInTheDocument();
    expect(screen.getByText('34 compitiendo')).toBeInTheDocument();
    expect(screen.getByText('tú')).toBeInTheDocument();
    expect(screen.getByText('280 XP')).toBeInTheDocument();
  });

  /*
    El servidor manda la cabeza y tus vecinos, no la lista entera. Sin los
    puntos suspensivos, el 3.º y el 11.º parecerían seguidos y el número del
    puesto dejaría de significar nada.
  */
  it('marca el hueco entre la cabeza y tus vecinos', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/liga': CON_LIGA }));
    renderizar();

    await screen.findByText('Marta');
    expect(screen.getByText('···')).toBeInTheDocument();
  });

  it('cuenta cómo acabó la semana pasada', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/liga': CON_LIGA }));
    renderizar();

    expect(await screen.findByText(/quedaste 6\.º de 28/)).toBeInTheDocument();
  });

  it('celebra el premio solo cuando el servidor dice que es nuevo', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        'GET /api/social/liga': { ...CON_LIGA, premioNuevo: { puesto: 2, monedas: 30 } },
      }),
    );
    renderizar();

    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent(/acabaste 2\.º y ganaste 30 monedas/);
  });
});

describe('estar fuera de la liga', () => {
  it('quien se esconde no ve la tabla y puede volver', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        'GET /api/social/liga': {
          ...CON_LIGA,
          estado: 'fuera',
          tabla: [],
          miPuesto: null,
        },
      }),
    );
    renderizar();

    expect(await screen.findByText('Estás fuera de la liga')).toBeInTheDocument();
    expect(screen.queryByText('Marta')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a la liga' })).toBeInTheDocument();
    // Y ya no se ofrece salir de algo de lo que ya se salió.
    expect(screen.queryByText('No quiero aparecer en la liga')).not.toBeInTheDocument();
  });
});

describe('los amigos', () => {
  it('enseñan tu código y explican qué ve quien lo tenga', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({ 'GET /api/social/liga': SOLO_YO, 'GET /api/social/amigos': AMIGOS_VACIO }),
    );
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));

    expect(await screen.findByText('K7QM-3XRT')).toBeInTheDocument();
    expect(screen.getByText(/Nadie ve tu correo/)).toBeInTheDocument();
    expect(screen.getByText('Todavía no tienes a nadie')).toBeInTheDocument();
  });

  it('te ponen a ti dentro de la lista, ordenada por la XP de la semana', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({ 'GET /api/social/liga': SOLO_YO, 'GET /api/social/amigos': AMIGOS }),
    );
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));
    await screen.findByText('Marta');

    const nombres = screen
      .getAllByRole('listitem')
      .map((fila) => fila.textContent?.split(' XP')[0]?.trim());

    // Marta (400), tú (120), Iván (60).
    expect(nombres?.[0]).toContain('Marta');
    expect(nombres?.[1]).toContain('Tú');
    expect(nombres?.[2]).toContain('Iván');

    expect(screen.getByText(/12 días de racha/)).toBeInTheDocument();
    // Racha de cero días no se enseña: un cero no es una racha.
    expect(screen.queryByText(/0 días de racha/)).not.toBeInTheDocument();
  });

  it('un código que no existe se dice con palabras, sin dejar la app a medias', async () => {
    vi.stubGlobal(
      'fetch',
      servidor(
        { 'GET /api/social/liga': SOLO_YO, 'GET /api/social/amigos': AMIGOS_VACIO },
        { 'POST /api/social/amigos': 404 },
      ),
    );
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));
    await userEvent.type(await screen.findByLabelText('Añadir a alguien'), 'ZZZZ-ZZZZ');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/No encontramos a nadie con ese código/),
    );
  });

  it('se puede quitar a alguien', async () => {
    const fetchDeMentira = servidor({
      'GET /api/social/liga': SOLO_YO,
      'GET /api/social/amigos': AMIGOS,
      'DELETE /api/social/amigos/a1': {},
    });
    vi.stubGlobal('fetch', fetchDeMentira);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar a Marta' }));

    await waitFor(() =>
      expect(fetchDeMentira).toHaveBeenCalledWith(
        '/api/social/amigos/a1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });
});
