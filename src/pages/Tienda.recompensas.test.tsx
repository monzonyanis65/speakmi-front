import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Tienda } from './Tienda';
import { faltan } from '@/lib/cuenta-atras';

/**
 * Los cofres del día, el festival y el techo de los protectores.
 *
 * Va aparte de `Tienda.test.tsx` a propósito: aquel comprueba comprar y
 * equipar, que es lo que la tienda hacía antes, y mezclarlos habría dejado un
 * archivo de ochocientas líneas donde ya no se encuentra nada.
 */

const CATALOGO = {
  items: [
    {
      code: 'POWER_FREEZE',
      kind: 'poder',
      nameEs: 'Protector de racha',
      descriptionEs: 'Guarda tu racha un día que no puedas estudiar.',
      price: 100,
      emoji: '❄️',
      origen: 'tienda',
    },
    {
      code: 'OUTFIT_GORRO',
      kind: 'atuendo',
      nameEs: 'Gorra',
      descriptionEs: 'Una gorra sencilla.',
      price: 120,
      emoji: '🧢',
      origen: 'tienda',
    },
    {
      code: 'OUTFIT_CAPA',
      kind: 'atuendo',
      nameEs: 'Capa de otoño',
      descriptionEs: 'El premio mayor del festival.',
      price: 0,
      emoji: '🧥',
      origen: 'temporada',
    },
  ],
};

interface Cartera {
  coins: number;
  items: Array<{ code: string; kind: string; quantity: number }>;
  equipped: { mascota: string; atuendo: string | null };
  protectores: { equipados: number; maximo: number };
}

const CARTERA_VACIA: Cartera = {
  coins: 0,
  items: [],
  equipped: { mascota: 'PET_MILO', atuendo: null },
  protectores: { equipados: 0, maximo: 4 },
};

interface Cofre {
  franja: string;
  nombreEs: string;
  cuandoEs: string;
  estado: string;
  abreEnMinutos: number;
  cierraEnMinutos: number;
  monedas: number;
  piezas: number;
}

const FRANJAS_POSIBLES = [
  {
    code: 'MADRUGADA',
    nombreEs: 'De madrugada',
    cuandoEs: 'entre las 12 de la noche y las 5 de la mañana',
    desde: 0,
    hasta: 300,
  },
  {
    code: 'TEMPRANO',
    nombreEs: 'Temprano',
    cuandoEs: 'entre las 5 y las 12 de la mañana',
    desde: 300,
    hasta: 720,
  },
  {
    code: 'TARDE',
    nombreEs: 'Por la tarde',
    cuandoEs: 'entre las 12 del mediodía y las 6 de la tarde',
    desde: 720,
    hasta: 1080,
  },
  {
    code: 'ANOCHECER',
    nombreEs: 'Al anochecer',
    cuandoEs: 'entre las 6 de la tarde y las 12 de la noche',
    desde: 1080,
    hasta: 1440,
  },
];

const TEMPORADA = {
  code: 'OTONO_2026',
  nameEs: 'Festival de otoño',
  descriptionEs: 'Cada cofre trae un trozo del árbol.',
  emoji: '🍂',
  piezas: 0,
  total: 12,
  columnas: 3,
  terminaEl: '2026-11-30',
  diasQueQuedan: 40,
  recompensas: [
    {
      at: 4,
      itemCode: 'OUTFIT_HOJAS',
      nameEs: 'Corona de hojas',
      descriptionEs: '',
      coins: 0,
      ganada: false,
    },
    {
      at: 12,
      itemCode: 'OUTFIT_CAPA',
      nameEs: 'Capa de otoño',
      descriptionEs: '',
      coins: 100,
      ganada: false,
    },
  ],
};

/**
 * El cofre de la mañana ya recogido y el del anochecer todavía por llegar.
 *
 * Es el escenario más informativo de todos, porque en él se ven a la vez los
 * dos extremos: el que ya no hace nada y el que enseña la cuenta atrás de las
 * capturas.
 */
type Temporada = typeof TEMPORADA;

interface Recompensas {
  zona: string;
  dia: string;
  minutos: number;
  franjas: [string, string];
  franjasNuevas: [string, string] | null;
  cofres: Cofre[];
  temporada: Temporada | null;
  franjasPosibles: typeof FRANJAS_POSIBLES;
}

function recompensasPorDefecto(
  cofres?: Cofre[],
  temporada: Temporada | null = TEMPORADA,
): Recompensas {
  return {
    zona: 'America/Caracas',
    dia: '2026-09-28',
    minutos: 11 * 60,
    franjas: ['TEMPRANO', 'ANOCHECER'] as [string, string],
    franjasNuevas: null,
    cofres: cofres ?? [
      {
        franja: 'TEMPRANO',
        nombreEs: 'Temprano',
        cuandoEs: 'entre las 5 y las 12 de la mañana',
        estado: 'listo',
        abreEnMinutos: 0,
        cierraEnMinutos: 60,
        monedas: 10,
        piezas: 1,
      },
      {
        franja: 'ANOCHECER',
        nombreEs: 'Al anochecer',
        cuandoEs: 'entre las 6 de la tarde y las 12 de la noche',
        estado: 'esperando',
        abreEnMinutos: 7 * 60,
        cierraEnMinutos: 0,
        monedas: 10,
        piezas: 1,
      },
    ],
    temporada,
    franjasPosibles: FRANJAS_POSIBLES,
  };
}

function servidor({
  cartera = CARTERA_VACIA,
  recompensas = recompensasPorDefecto(),
  hayRecompensas = true,
  fallaAbrir = null,
}: {
  cartera?: Cartera;
  recompensas?: Recompensas;
  hayRecompensas?: boolean;
  /** El código de error con el que contesta abrir un cofre, si es que falla. */
  fallaAbrir?: string | null;
} = {}) {
  let estadoCartera = structuredClone(cartera);
  let estadoRecompensas = structuredClone(recompensas) as ReturnType<typeof recompensasPorDefecto>;

  const noEncontrado = () =>
    Promise.resolve({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({ error: { code: 'SYS-003', message: 'Esa dirección no existe.' } }),
    });

  return vi.fn((url: string, opciones?: { method?: string; body?: string }) => {
    if (url.includes('/shop/catalog')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(CATALOGO) });
    }

    if (url.includes('/me/wallet')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(estadoCartera),
      });
    }

    if (url.includes('/shop/rewards')) {
      if (!hayRecompensas) return noEncontrado();
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(estadoRecompensas),
      });
    }

    if (url.includes('/shop/chests/') && url.includes('/open')) {
      if (fallaAbrir !== null) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: { code: fallaAbrir, message: 'No se pudo.' } }),
        });
      }

      // El servidor de mentira hace lo mismo que el de verdad: cobra, apunta la
      // pieza y deja el cofre marcado como abierto.
      estadoCartera = { ...estadoCartera, coins: estadoCartera.coins + 10 };
      estadoRecompensas = {
        ...estadoRecompensas,
        cofres: estadoRecompensas.cofres.map((cofre) =>
          cofre.franja === 'TEMPRANO' ? { ...cofre, estado: 'abierto' } : cofre,
        ),
        temporada: estadoRecompensas.temporada
          ? { ...estadoRecompensas.temporada, piezas: estadoRecompensas.temporada.piezas + 1 }
          : null,
      };

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            franja: 'TEMPRANO',
            monedas: 10,
            piezas: 1,
            saldo: estadoCartera.coins,
            premios: [],
          }),
      });
    }

    if (url.includes('/shop/chests') && opciones?.method === 'PUT') {
      const { franjas } = JSON.parse(opciones.body ?? '{}') as { franjas: [string, string] };
      estadoRecompensas = { ...estadoRecompensas, franjasNuevas: franjas };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(estadoRecompensas),
      });
    }

    if (url.includes('/shop/buy')) {
      return Promise.resolve({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            error: { code: 'SHOP-011', message: 'Esto no se compra: se gana en el evento.' },
          }),
      });
    }

    return noEncontrado();
  });
}

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <Tienda />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('la cuenta atrás se dice como la diría una persona', () => {
  it('redondea a horas y usa los minutos solo cuando falta poco', () => {
    expect(faltan(7 * 60)).toBe('7 horas');
    expect(faltan(60)).toBe('1 hora');
    expect(faltan(20)).toBe('20 min');
    expect(faltan(0)).toBe('ahora');
  });
});

describe('los cofres de hoy', () => {
  it('enseña los dos, y la cuenta atrás del que todavía no toca', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Tus cofres de hoy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Temprano' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Al anochecer' })).toBeInTheDocument();

    // La frase de las capturas, con las horas de quien mira y no las del servidor.
    expect(screen.getByText(/Se abre en 7 horas/)).toBeInTheDocument();
  });

  it('solo se puede pulsar el que está listo', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    expect(await screen.findByRole('button', { name: /Abrir el cofre temprano/ })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: /Abrir el cofre al anochecer/ }),
    ).not.toBeInTheDocument();
  });

  it('dice lo que trae antes de abrirlo', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    await screen.findByRole('heading', { name: 'Temprano' });
    expect(screen.getAllByText(/10 monedas/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 pieza/).length).toBeGreaterThan(0);
  });

  it('al abrirlo dice lo que salió y el saldo sube', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    const boton = await screen.findByRole('button', { name: /Abrir el cofre temprano/ });
    await userEvent.click(boton);

    expect(await screen.findByText(/Cofre abierto: 10 monedas/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Tienes 10 monedas')).toBeInTheDocument());
  });

  it('sin haber practicado, lo dice y no ofrece botón', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        recompensas: recompensasPorDefecto([
          {
            franja: 'TEMPRANO',
            nombreEs: 'Temprano',
            cuandoEs: 'entre las 5 y las 12 de la mañana',
            estado: 'sin_practicar',
            abreEnMinutos: 0,
            cierraEnMinutos: 45,
            monedas: 10,
            piezas: 1,
          },
        ]),
      }),
    );
    renderizar();

    expect(await screen.findByText(/Practica un rato y se abre/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Abrir el cofre/ })).not.toBeInTheDocument();
  });

  it('la franja que ya pasó no regaña: dice cuándo vuelve', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        recompensas: recompensasPorDefecto([
          {
            franja: 'MADRUGADA',
            nombreEs: 'De madrugada',
            cuandoEs: 'entre las 12 de la noche y las 5 de la mañana',
            estado: 'perdido',
            abreEnMinutos: 13 * 60,
            cierraEnMinutos: 0,
            monedas: 10,
            piezas: 1,
          },
        ]),
      }),
    );
    renderizar();

    expect(await screen.findByText(/Vuelve dentro de 13 horas/)).toBeInTheDocument();
  });

  it('si el servidor todavía no tiene cofres, la tienda sigue funcionando', async () => {
    vi.stubGlobal('fetch', servidor({ hayRecompensas: false }));
    renderizar();

    // Sin cofres ni festival, pero con la tienda entera.
    expect(await screen.findByRole('heading', { name: 'Poderes' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tus cofres de hoy' })).not.toBeInTheDocument();
  });
});

describe('elegir tus horas es lo que hace que el cofre no castigue a nadie', () => {
  it('ofrece las cuatro franjas, que cubren el día entero', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar mis horas' }));

    for (const franja of FRANJAS_POSIBLES) {
      expect(screen.getByRole('button', { name: new RegExp(franja.nombreEs) })).toBeInTheDocument();
    }
    expect(screen.getByText(/Cualquier hora del día vale/)).toBeInTheDocument();
  });

  it('avisa de que el cambio es para mañana ANTES de guardarlo', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar mis horas' }));
    expect(screen.getByText(/El cambio empieza mañana/)).toBeInTheDocument();
  });

  it('con una sola franja marcada dice por qué no se puede guardar', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar mis horas' }));
    // Se desmarca una de las dos: queda una sola.
    await userEvent.click(screen.getByRole('button', { name: /Temprano/ }));

    expect(screen.getByText(/Elige dos franjas para poder guardar. Llevas 1./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar para mañana/ })).toBeDisabled();
  });

  it('marcar una tercera suelta la más antigua y se puede guardar', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar mis horas' }));

    const guardar = screen.getByRole('button', { name: /Guardar para mañana/ });
    // De serie está TEMPRANO + ANOCHECER, así que no hay nada que guardar.
    expect(guardar).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /De madrugada/ }));

    // TEMPRANO salió y quedan ANOCHECER + MADRUGADA: ya es un cambio.
    expect(screen.getByRole('button', { name: /Temprano/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(guardar).toBeEnabled();

    await userEvent.click(guardar);

    // El panel se cierra al guardar, así que la confirmación tiene que quedarse
    // fuera de él: si no, guardar se vería exactamente igual que no guardar.
    expect(
      await screen.findByText(/Desde mañana tus cofres serán Al anochecer y De madrugada/),
    ).toBeInTheDocument();
  });
});

describe('el festival', () => {
  it('enseña el mosaico, cuánto llevas y que no se compra', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Festival de otoño' })).toBeInTheDocument();
    expect(screen.getByText('0 / 12 piezas')).toBeInTheDocument();
    expect(screen.getByText(/Nada de esto se compra/)).toBeInTheDocument();

    const barra = screen.getByRole('progressbar', { name: /Piezas del festival/ });
    expect(barra).toHaveAttribute('aria-valuenow', '0');
    expect(barra).toHaveAttribute('aria-valuemax', '12');
  });

  it('el dibujo se anuncia entero, no casilla por casilla', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({ recompensas: recompensasPorDefecto(undefined, { ...TEMPORADA, piezas: 5 }) }),
    );
    renderizar();

    expect(
      await screen.findByRole('img', { name: 'El árbol del festival: 5 de 12 piezas colocadas' }),
    ).toBeInTheDocument();
  });

  it('los disfraces del festival NO salen entre lo que se compra', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    await screen.findByRole('heading', { name: 'Poderes' });

    // La gorra sí se vende; la capa del festival no puede tener botón de comprar.
    expect(screen.getByRole('button', { name: /Comprar Gorra/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Comprar Capa de otoño/ })).not.toBeInTheDocument();
  });

  it('el premio mayor sale con su umbral y sus monedas', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    await screen.findByRole('heading', { name: 'Festival de otoño' });
    expect(screen.getByText('Con 12 piezas y 100 monedas')).toBeInTheDocument();
  });
});

describe('el protector de racha se equipa y tiene techo', () => {
  it('enseña el contador con su máximo', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    expect(await screen.findByText('0 / 4 equipados')).toBeInTheDocument();
  });

  it('con los cuatro puestos no deja comprar otro y lo explica', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        cartera: {
          ...CARTERA_VACIA,
          coins: 900,
          items: [{ code: 'POWER_FREEZE', kind: 'poder', quantity: 4 }],
          protectores: { equipados: 4, maximo: 4 },
        },
      }),
    );
    renderizar();

    expect(await screen.findByText('4 / 4 equipados')).toBeInTheDocument();
    expect(screen.getByText(/Están todos puestos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ya llevas los 4 que caben/ })).toBeDisabled();
  });
});

describe('quien acaba de empezar', () => {
  it('ve la tienda con cero monedas, cero piezas y qué hacer para tener', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Festival de otoño' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tienes 0 monedas')).toBeInTheDocument();
    expect(screen.getByText('0 / 12 piezas')).toBeInTheDocument();

    // Lo que no alcanza se queda a la vista, con cuánto falta.
    expect(screen.getByText('Te faltan 100 monedas')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Comprar Gorra: te faltan 120 monedas/ }),
    ).toBeDisabled();
  });

  it('en «Tus cosas» le dice que los disfraces del festival se ganan', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    await screen.findByRole('heading', { name: 'Poderes' });
    await userEvent.click(screen.getByRole('tab', { name: 'Tus cosas' }));

    expect(
      await screen.findByText(/los disfraces del festival se ganan abriendo cofres/),
    ).toBeInTheDocument();
  });

  it('un disfraz ya ganado sale marcado como del festival', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        cartera: {
          ...CARTERA_VACIA,
          items: [{ code: 'OUTFIT_CAPA', kind: 'atuendo', quantity: 1 }],
        },
      }),
    );
    renderizar();

    await screen.findByRole('heading', { name: 'Poderes' });
    await userEvent.click(screen.getByRole('tab', { name: 'Tus cosas' }));

    expect(
      await screen.findByRole('button', { name: /Ponerle Capa de otoño, del festival/ }),
    ).toBeInTheDocument();
  });
});
