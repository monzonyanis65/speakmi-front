import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Tienda } from './Tienda';

const CATALOGO = {
  items: [
    {
      code: 'poder-vida',
      kind: 'poder',
      nameEs: 'Vida extra',
      descriptionEs: 'Un fallo más antes de repetir la lección.',
      price: 20,
      emoji: '❤️',
    },
    {
      code: 'mascota-tucan',
      kind: 'mascota',
      nameEs: 'Tuki el tucán',
      descriptionEs: 'Otro pájaro para acompañarte.',
      price: 80,
      emoji: '🦜',
    },
    {
      code: 'atuendo-gorro',
      kind: 'atuendo',
      nameEs: 'Gorro de lana',
      descriptionEs: 'Para los días fríos.',
      price: 40,
      emoji: '🧢',
    },
    {
      code: 'atuendo-capa',
      kind: 'atuendo',
      nameEs: 'Capa de superhéroe',
      descriptionEs: 'Roja y con vuelo.',
      price: 500,
      emoji: '🦸',
    },
  ],
};

interface Cartera {
  coins: number;
  items: Array<{ code: string; kind: string; quantity: number }>;
  equipped: { mascota: string; atuendo: string | null };
}

const CARTERA: Cartera = {
  coins: 120,
  items: [{ code: 'atuendo-gorro', kind: 'atuendo', quantity: 1 }],
  equipped: { mascota: 'milo', atuendo: 'atuendo-gorro' },
};

/**
 * Un servidor de mentira con memoria.
 *
 * Guarda la cartera y la cambia al comprar, que es lo único que permite
 * comprobar que la pantalla se refresca de verdad y no solo que se llamó al
 * endpoint. Lo que no esté en el mapa contesta 404, que es exactamente lo que
 * responde hoy un endpoint que todavía no existe.
 */
function servidor({
  cartera = CARTERA,
  hayCatalogo = true,
  hayCartera = true,
  saldoViejo = false,
}: {
  cartera?: Cartera;
  hayCatalogo?: boolean;
  hayCartera?: boolean;
  /** Simula que las monedas se gastaron en otro sitio: la pantalla enseña un saldo viejo. */
  saldoViejo?: boolean;
} = {}) {
  let actual: Cartera = structuredClone(cartera);

  function noEncontrado(code: string, message: string) {
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: { code, message } }),
    });
  }

  return vi.fn((url: string, opciones?: { method?: string; body?: string }) => {
    if (url.includes('/shop/catalog')) {
      if (!hayCatalogo) return noEncontrado('SYS-003', 'Esa dirección no existe.');
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(CATALOGO) });
    }

    if (url.includes('/shop/buy')) {
      const { code } = JSON.parse(opciones?.body ?? '{}') as { code: string };
      const articulo = CATALOGO.items.find((item) => item.code === code);
      if (!articulo) return noEncontrado('SHOP-001', 'Ese artículo no existe.');

      if (saldoViejo) {
        actual = { ...actual, coins: 5 };
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () =>
            Promise.resolve({ error: { code: 'SHOP-002', message: 'Saldo insuficiente.' } }),
        });
      }

      if (articulo.price > actual.coins) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () =>
            Promise.resolve({ error: { code: 'SHOP-002', message: 'Saldo insuficiente.' } }),
        });
      }

      const previos = actual.items.find((item) => item.code === code);
      actual = {
        ...actual,
        coins: actual.coins - articulo.price,
        items: previos
          ? actual.items.map((item) =>
              item.code === code ? { ...item, quantity: item.quantity + 1 } : item,
            )
          : [...actual.items, { code, kind: articulo.kind, quantity: 1 }],
      };
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(actual) });
    }

    if (url.includes('/me/equipped')) {
      const cambio = JSON.parse(opciones?.body ?? '{}') as {
        mascota?: string;
        atuendo?: string | null;
      };
      actual = { ...actual, equipped: { ...actual.equipped, ...cambio } };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ equipped: actual.equipped }),
      });
    }

    if (url.includes('/me/wallet')) {
      if (!hayCartera) return noEncontrado('SYS-003', 'Esa dirección no existe.');
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(actual) });
    }

    return noEncontrado('SYS-003', 'Esa dirección no existe.');
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
  // Las monedas suben con requestAnimationFrame; en jsdom basta con que el
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

describe('tienda', () => {
  it('pinta los artículos agrupados por tipo y las monedas que tienes', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Poderes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mascotas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atuendos' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Vida extra' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tuki el tucán' })).toBeInTheDocument();
    expect(screen.getByText('Un fallo más antes de repetir la lección.')).toBeInTheDocument();

    expect(await screen.findByLabelText('Tienes 120 monedas')).toBeInTheDocument();
  });

  it('marca como tuyo lo que ya tienes y no lo vuelve a ofrecer', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    expect(await screen.findByText('Ya es tuyo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Comprar Gorro de lana/ })).not.toBeInTheDocument();

    // El poder es consumible: aunque lo tengas, se puede comprar otro.
    expect(
      screen.getByRole('button', { name: 'Comprar Vida extra por 20 monedas' }),
    ).toBeInTheDocument();
  });

  it('deja ver lo que no te alcanza, con el botón apagado y el motivo escrito', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    // Sigue en pantalla: esconder lo caro quita la razón para seguir.
    expect(await screen.findByRole('heading', { name: 'Capa de superhéroe' })).toBeInTheDocument();
    // El rojo no es la única señal: el motivo va escrito.
    expect(screen.getByText('Te faltan 380 monedas')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Comprar Capa de superhéroe: te faltan 380 monedas' }),
    ).toBeDisabled();
  });

  it('compra llamando al endpoint, confirma y deja el saldo al día', async () => {
    const llamadas = servidor();
    vi.stubGlobal('fetch', llamadas);
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(
      await screen.findByRole('button', { name: 'Comprar Tuki el tucán por 80 monedas' }),
    );

    await waitFor(() => {
      expect(llamadas).toHaveBeenCalledWith(
        expect.stringContaining('/shop/buy'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ code: 'mascota-tucan' }),
        }),
      );
    });

    expect(await screen.findByRole('status')).toHaveTextContent(/Tuki el tucán es tuyo/);
    expect(await screen.findByLabelText('Tienes 40 monedas')).toBeInTheDocument();
    // Se refrescó la cartera: el tucán ya no se ofrece, es tuyo.
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /Comprar Tuki el tucán/ }),
      ).not.toBeInTheDocument();
    });
  });

  it('explica en monedas, y no en códigos, que el servidor rechazó la compra', async () => {
    // El saldo de la pantalla alcanzaba, pero el servidor dice que no: las
    // monedas se gastaron en otro sitio. Ni «error 409» ni una cifra inventada.
    vi.stubGlobal('fetch', servidor({ saldoViejo: true }));
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(
      await screen.findByRole('button', { name: 'Comprar Vida extra por 20 monedas' }),
    );

    // El saldo se recarga solo, y con el saldo de verdad el aviso ya puede dar
    // la cifra: 20 de la vida extra menos las 5 monedas que quedaban.
    expect(await screen.findByLabelText('Tienes 5 monedas')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Te faltan 15 monedas');
    expect(screen.queryByText(/409|SHOP-/)).not.toBeInTheDocument();
  });

  it('avisa sin quedarse en blanco cuando la tienda todavía no existe en el servidor', async () => {
    vi.stubGlobal('fetch', servidor({ hayCatalogo: false }));
    renderizar();

    expect(await screen.findByText(/todavía no está disponible/i)).toBeInTheDocument();
    // La pantalla sigue en pie y las monedas, que son otra consulta, también.
    expect(screen.getByRole('heading', { name: 'Tienda' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Tienes 120 monedas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('tus cosas', () => {
  it('deja elegir mascota y quitar el atuendo, y marca lo puesto', async () => {
    const llamadas = servidor({
      cartera: {
        coins: 120,
        items: [
          { code: 'atuendo-gorro', kind: 'atuendo', quantity: 1 },
          { code: 'mascota-tucan', kind: 'mascota', quantity: 1 },
          { code: 'poder-vida', kind: 'poder', quantity: 2 },
        ],
        equipped: { mascota: 'milo', atuendo: 'atuendo-gorro' },
      },
    });
    vi.stubGlobal('fetch', llamadas);
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('tab', { name: 'Tus cosas' }));

    expect(await screen.findByText('×2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gorro de lana, es lo que llevas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await usuario.click(screen.getByRole('button', { name: 'Llevar Tuki el tucán' }));
    await waitFor(() => {
      expect(llamadas).toHaveBeenCalledWith(
        expect.stringContaining('/me/equipped'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
    expect(
      await screen.findByRole('button', { name: 'Tuki el tucán, es la que llevas' }),
    ).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Quitar el atuendo' }));
    expect(
      await screen.findByRole('button', { name: 'Sin atuendo, es lo que llevas' }),
    ).toBeInTheDocument();
  });

  it('no deja la pestaña vacía cuando solo tienes lo de serie', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        cartera: { coins: 10, items: [], equipped: { mascota: 'milo', atuendo: null } },
      }),
    );
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('tab', { name: 'Tus cosas' }));

    expect(await screen.findByText(/llevas a Milo tal como vino/i)).toBeInTheDocument();

    // Y el camino de vuelta a la tienda está en la misma pantalla.
    await usuario.click(screen.getByRole('button', { name: 'Ver la tienda' }));
    expect(await screen.findByRole('heading', { name: 'Poderes' })).toBeInTheDocument();
  });

  it('avisa sin quedarse en blanco si la cartera todavía no existe', async () => {
    vi.stubGlobal('fetch', servidor({ hayCartera: false }));
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('tab', { name: 'Tus cosas' }));

    expect(
      await screen.findByText(/Ver tus cosas todavía no está disponible/i),
    ).toBeInTheDocument();
  });
});
