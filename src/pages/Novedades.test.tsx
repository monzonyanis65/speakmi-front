import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Novedades } from './Novedades';

/**
 * El muro de novedades.
 *
 * Lo que más se prueba aquí es el caso de HOY: una cuenta sin amigos. Es el
 * único escenario garantizado el primer día y es donde esta pantalla se puede
 * torcer de dos formas distintas y las dos malas: enseñar un cartel de «aquí
 * saldrá lo que hagan tus amigos» con nada debajo, o rellenarlo con gente
 * inventada. Así que se comprueba explícitamente que sin amigos hay contenido,
 * que ese contenido es tuyo, y que cuando de verdad no hay nada lo que sale son
 * dos cosas que hacer y no una frase pidiendo paciencia.
 */

const ESCALERA = [
  { numero: 1, codigo: 'SUSURRO', nombre: 'Susurro' },
  { numero: 2, codigo: 'ECO', nombre: 'Eco' },
  { numero: 3, codigo: 'VOZ', nombre: 'Voz' },
  { numero: 4, codigo: 'CORO', nombre: 'Coro' },
  { numero: 5, codigo: 'PREGON', nombre: 'Pregón' },
];

const REACCIONES = ['👏', '🔥', '💪', '🎉'];

const BASE = {
  circulo: 0,
  soloEstoyYo: true,
  codigo: 'K7QM-3XRT',
  reacciones: REACCIONES,
  dias: 14,
  escalera: ESCALERA,
};

/** Un rato antes de ahora, para que la hora relativa no dependa del reloj. */
function haceUnRato(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000).toISOString();
}

const MURO_VACIO = { ...BASE, tarjetas: [] };

const SOLO_MIS_DIAS = {
  ...BASE,
  tarjetas: [
    {
      clave: 'dia:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      tipo: 'DIA',
      cuando: haceUnRato(90),
      quien: 'Yanis',
      soyYo: true,
      otro: null,
      esSobreMi: false,
      dato: 120,
      extra: 4,
      reacciones: [],
    },
  ],
};

const CON_GENTE = {
  ...BASE,
  circulo: 2,
  soloEstoyYo: false,
  tarjetas: [
    {
      clave: 'nov:11111111-1111-4111-8111-111111111111',
      tipo: 'TOQUE',
      cuando: haceUnRato(10),
      quien: 'Marta',
      soyYo: false,
      otro: null,
      esSobreMi: true,
      dato: null,
      extra: null,
      reacciones: [],
    },
    {
      clave: 'nov:22222222-2222-4222-8222-222222222222',
      tipo: 'SUBIO_DIVISION',
      cuando: haceUnRato(60 * 26),
      quien: 'Iván',
      soyYo: false,
      otro: null,
      esSobreMi: false,
      dato: 2,
      extra: null,
      reacciones: [{ emoji: '👏', cuantas: 2, mia: false }],
    },
    {
      clave: 'dia:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      tipo: 'DIA',
      cuando: haceUnRato(60 * 30),
      quien: 'Marta',
      soyYo: false,
      otro: null,
      esSobreMi: false,
      dato: 80,
      extra: 0,
      reacciones: [],
    },
  ],
};

function servidor(rutas: Record<string, unknown>) {
  return vi.fn((entrada: string, opciones?: { method?: string }) => {
    const clave = `${opciones?.method ?? 'GET'} ${new URL(entrada, 'http://x').pathname}`;
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
        <Novedades />
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

describe('sin nadie añadido, que es el caso del primer día', () => {
  /*
    La prueba que justifica toda la pantalla. Si el muro solo contara lo de los
    amigos, esto estaría vacío el día uno y esta pestaña no serviría para nada.
  */
  it('no está vacío: lo que sale son tus días', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/muro': SOLO_MIS_DIAS }));
    renderizar();

    expect(await screen.findByText('Sumaste 120 XP en 4 lecciones.')).toBeInTheDocument();
    expect(screen.getByText('Por ahora aquí solo estás tú')).toBeInTheDocument();
  });

  it('y el código para compartir, que es lo que trae a los demás', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/muro': SOLO_MIS_DIAS }));
    renderizar();

    expect(await screen.findByText('K7QM-3XRT')).toBeInTheDocument();
  });

  it('no se inventa a nadie para rellenar', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/muro': SOLO_MIS_DIAS }));
    renderizar();

    const tarjetas = await screen.findAllByRole('listitem');
    expect(tarjetas).toHaveLength(1);
    expect(screen.queryByText(/de ejemplo/i)).not.toBeInTheDocument();
  });
});

describe('cuando de verdad no ha pasado nada', () => {
  /*
    Una cuenta recién hecha que todavía no ha estudiado. Es el único vacío
    posible, y aquí no puede haber un «vuelve luego»: tienen que estar las dos
    cosas que cambian ese estado.
  */
  it('no dice «vuelve luego»: da las dos cosas que lo arreglan', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/muro': MURO_VACIO }));
    renderizar();

    expect(await screen.findByRole('button', { name: 'Empezar una lección' })).toBeInTheDocument();
    expect(screen.getByText('K7QM-3XRT')).toBeInTheDocument();
    expect(screen.queryByText(/vuelve/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pronto/i)).not.toBeInTheDocument();
  });
});

describe('con gente alrededor', () => {
  it('cuenta cada cosa con su frase y su hora', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/muro': CON_GENTE }));
    renderizar();

    // El toque nunca dice que no hayas estudiado: dice lo único que sabe.
    expect(await screen.findByText('Marta se acordó de ti.')).toBeInTheDocument();
    expect(screen.getByText('Iván subió a la División Eco.')).toBeInTheDocument();
    expect(screen.getByText('Marta sumó 80 XP.')).toBeInTheDocument();

    expect(screen.queryByText(/no has estudiado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/llevas \d+ días sin/i)).not.toBeInTheDocument();
  });

  it('ya no avisa de que estás solo', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/muro': CON_GENTE }));
    renderizar();

    await screen.findByText('Marta se acordó de ti.');
    expect(screen.queryByText('Por ahora aquí solo estás tú')).not.toBeInTheDocument();
  });

  it('se puede reaccionar, y el contador lo cuenta el servidor', async () => {
    const respondido = {
      ...CON_GENTE,
      tarjetas: CON_GENTE.tarjetas.map((tarjeta) =>
        tarjeta.tipo === 'SUBIO_DIVISION'
          ? { ...tarjeta, reacciones: [{ emoji: '👏', cuantas: 3, mia: true }] }
          : tarjeta,
      ),
    };

    const fetchDeMentira = servidor({
      'GET /api/social/muro': CON_GENTE,
      'POST /api/social/muro/reaccion': respondido,
    });
    vi.stubGlobal('fetch', fetchDeMentira);
    renderizar();

    await screen.findByText('Iván subió a la División Eco.');

    const aplausos = screen.getAllByRole('button', { name: 'Reaccionar con 👏' });
    await userEvent.click(aplausos[1]!);

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());

    // El número que se pinta es el que devolvió el servidor, no uno sumado aquí.
    expect(fetchDeMentira).toHaveBeenCalledWith(
      '/api/social/muro/reaccion',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('las reacciones se alcanzan con el teclado y dicen si están puestas', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/muro': CON_GENTE }));
    renderizar();

    await screen.findByText('Marta se acordó de ti.');

    for (const boton of screen.getAllByRole('button', { name: /^Reaccionar con/ })) {
      expect(boton).toHaveAttribute('aria-pressed');
      expect(boton.tagName).toBe('BUTTON');
    }
  });
});
