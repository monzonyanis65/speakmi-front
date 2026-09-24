import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Juegos } from './Juegos';
import { CODIGOS } from '@/components/juegos/tipos';

/*
  La voz se finge porque el listado la consulta para avisar de que ESCUCHA no se
  puede jugar. En jsdom no hay sintetizador, así que sin esto la comprobación se
  quedaría colgada y el aviso nunca aparecería.
*/
const hayVozInglesa = vi.fn(() => Promise.resolve(true));
vi.mock('@/lib/voz', () => ({
  hayVozInglesa: () => hayVozInglesa(),
}));

const CATALOGO = {
  games: [
    {
      code: 'CONTRARRELOJ',
      titleEs: 'Contrarreloj',
      descripcionEs: 'Cuántas aciertas en un minuto.',
      mejorPuntuacion: 240,
      jugadasHoy: 2,
    },
    {
      code: 'PAREJAS',
      titleEs: 'Parejas',
      descripcionEs: 'Junta cada palabra con su traducción.',
      mejorPuntuacion: null,
      jugadasHoy: 0,
    },
    {
      code: 'CADENA',
      titleEs: 'Cadena',
      descripcionEs: 'Sigue acertando.',
      mejorPuntuacion: 90,
      jugadasHoy: 0,
    },
    {
      code: 'ESCUCHA',
      titleEs: 'Escucha',
      descripcionEs: 'Oyes una palabra y eliges cuál era.',
      mejorPuntuacion: null,
      jugadasHoy: 0,
    },
  ],
};

function servidor({ hayJuegos = true } = {}) {
  return vi.fn(() => {
    if (!hayJuegos) {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({ error: { code: 'SYS-003', message: 'Esa dirección no existe.' } }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(CATALOGO) });
  });
}

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <Juegos />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  hayVozInglesa.mockResolvedValue(true);
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Juegos', () => {
  it('enseña los cuatro juegos y para qué sirve cada uno', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    for (const titulo of ['Contrarreloj', 'Parejas', 'Cadena', 'Escucha']) {
      expect(await screen.findByText(titulo)).toBeInTheDocument();
    }

    // Lo que justifica que el juego exista. Sin esto son cuatro botones de
    // colores, y a un botón de colores no se vuelve.
    expect(screen.getByText('entrena la velocidad')).toBeInTheDocument();
    expect(screen.getByText('entrena el vocabulario')).toBeInTheDocument();
    expect(screen.getByText('entrena justo tus fallos')).toBeInTheDocument();
    expect(screen.getByText('entrena el oído')).toBeInTheDocument();
  });

  it('enseña la mejor marca, y dice que no la hay cuando no la hay', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    expect(await screen.findByText(/240 puntos/)).toBeInTheDocument();
    expect(screen.getByText('2 partidas hoy')).toBeInTheDocument();
    expect(screen.getAllByText('Sin marca todavía. Pon la primera.')).toHaveLength(2);
  });

  /*
    El caso de hoy: el servidor de juegos todavía no existe. La pantalla no puede
    quedarse en blanco ni mentir diciendo que la marca es cero.
  */
  it('sin servidor, sigue enseñando los juegos y lo dice en voz alta', async () => {
    vi.stubGlobal('fetch', servidor({ hayJuegos: false }));
    renderizar();

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/no verás tu récord/i);

    expect(screen.getByText('Contrarreloj')).toBeInTheDocument();
    /*
      Se cuenta contra `CODIGOS` y no contra un número escrito.

      El catálogo crece —van seis juegos— y una cifra a mano obliga a tocar esta
      prueba cada vez que se añade uno, que es justo cuando dos personas están
      trabajando a la vez en el mismo archivo. Lo que se quiere comprobar es que
      no se queda ninguna tarjeta sin marca, no que sean cuatro.
    */
    expect(screen.getAllByText('Marca no disponible')).toHaveLength(CODIGOS.length);
  });

  it('avisa en la tarjeta de escucha cuando no hay voz inglesa instalada', async () => {
    hayVozInglesa.mockResolvedValue(false);
    vi.stubGlobal('fetch', servidor());
    renderizar();

    await waitFor(() =>
      expect(
        screen.getByText('Necesita una voz en inglés y tu equipo no tiene ninguna'),
      ).toBeInTheDocument(),
    );
  });
});
