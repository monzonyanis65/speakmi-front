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

const SUSURRO = { numero: 1, codigo: 'SUSURRO', nombre: 'Susurro' };
const ECO = { numero: 2, codigo: 'ECO', nombre: 'Eco' };

const ESCALERA = [
  SUSURRO,
  ECO,
  { numero: 3, codigo: 'VOZ', nombre: 'Voz' },
  { numero: 4, codigo: 'CORO', nombre: 'Coro' },
  { numero: 5, codigo: 'PREGON', nombre: 'Pregón' },
];

const SOLO_YO = {
  semana: SEMANA,
  estado: 'faltan',
  participantes: 1,
  participantesTotales: 1,
  minimo: 5,
  division: SUSURRO,
  divisionGanada: SUSURRO,
  faltanParaTuDivision: null,
  abiertas: 1,
  escalera: ESCALERA,
  tabla: [],
  miPuesto: null,
  miXp: 120,
  tuSemanaPasada: {
    xp: 80,
    puesto: null,
    participantes: null,
    monedas: null,
    division: null,
    divisionNueva: null,
  },
  podioAnterior: null,
  premioNuevo: null,
};

const CON_LIGA = {
  semana: SEMANA,
  estado: 'viva',
  participantes: 34,
  participantesTotales: 34,
  minimo: 5,
  division: SUSURRO,
  divisionGanada: SUSURRO,
  faltanParaTuDivision: null,
  abiertas: 1,
  escalera: ESCALERA,
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
  tuSemanaPasada: {
    xp: 410,
    puesto: 6,
    participantes: 28,
    monedas: 0,
    division: SUSURRO,
    divisionNueva: SUSURRO,
  },
  podioAnterior: {
    division: SUSURRO,
    participantes: 28,
    puestos: [
      { displayName: 'Lucía', xp: 1200, puesto: 1, soyYo: false },
      { displayName: 'Pablo', xp: 1100, puesto: 2, soyYo: false },
      { displayName: 'Sara', xp: 900, puesto: 3, soyYo: false },
    ],
  },
  premioNuevo: null,
};

const AMIGOS_VACIO = {
  codigo: 'K7QM-3XRT',
  maximo: 50,
  maximoSeguidos: 100,
  yo: { displayName: 'Yanis', xpSemana: 120, racha: 3 },
  amigos: [],
  seguidos: [],
  seguidores: [],
  toquesApagados: false,
  toquesQueMeQuedan: 3,
  monedasDelRegalo: 10,
};

/** Un amigo con todos los botones disponibles, que es el caso normal. */
function amigo(amistadId: string, displayName: string, xpSemana: number, racha: number) {
  return {
    amistadId,
    displayName,
    xpSemana,
    racha,
    toquesSilenciados: false,
    puedoTocar: true,
    motivoDelToque: 'puedes' as const,
    puedoRegalar: true,
  };
}

const AMIGOS = {
  ...AMIGOS_VACIO,
  amigos: [amigo('a1', 'Marta', 400, 12), amigo('a2', 'Iván', 60, 0)],
};

/** Sin desafío abierto: es lo que responde el servidor casi siempre. */
const SIN_DESAFIO = { desafio: null, cofre: 30, dias: 7 };

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
          participantesTotales: 0,
          miXp: 0,
          tuSemanaPasada: {
            ...SOLO_YO.tuSemanaPasada,
            xp: 0,
          },
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
    // Dos veces: la pastilla de arriba y el título de la tabla. Las dos hacen
    // falta, porque a media pantalla ya no se ve la de arriba.
    expect(screen.getAllByText('División Susurro')).toHaveLength(2);
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
        'GET /api/social/liga': {
          ...CON_LIGA,
          premioNuevo: { puesto: 2, monedas: 30, division: SUSURRO, divisionNueva: ECO },
        },
      }),
    );
    renderizar();

    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent(/acabaste 2\.º en la División Susurro y ganaste 30 monedas/);
    // Y se dice el ascenso, que es la mitad de la noticia.
    expect(aviso).toHaveTextContent(/Subes a la División Eco/);
  });

  /*
    El podio de la semana pasada. Tres alturas, los tres nombres y el puesto
    propio escrito con su número: «quedaste en el puesto n.º 4» es lo que
    esperaba ver quien no subió, y es lo que hace que el podio no sea una
    vitrina ajena.
  */
  it('enseña el podio de la semana pasada y dónde quedaste tú', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/liga': CON_LIGA }));
    renderizar();

    expect(await screen.findByText('Lucía')).toBeInTheDocument();
    expect(screen.getByText('Pablo')).toBeInTheDocument();
    expect(screen.getByText('Sara')).toBeInTheDocument();
    expect(screen.getByText(/puesto n\.º 6 de 28/)).toBeInTheDocument();
  });

  /*
    La regla entera de las divisiones, vista desde la pantalla: con una sola
    abierta se dice que es la única y por qué, en vez de enseñar «1 de 5» y
    prometer cuatro ascensos que hoy no se pueden dar.
  */
  it('no promete divisiones que todavía no existen', async () => {
    vi.stubGlobal('fetch', servidor({ 'GET /api/social/liga': CON_LIGA }));
    renderizar();

    expect((await screen.findAllByText('División Susurro')).length).toBeGreaterThan(0);
    expect(screen.getByText('la única abierta')).toBeInTheDocument();
    expect(screen.getByText(/una división vacía/)).toBeInTheDocument();
    expect(screen.queryByText('1 de 5 abiertas')).not.toBeInTheDocument();
  });

  /*
    Quien subió la semana pasada y esta compite otra vez abajo porque arriba no
    hay cinco personas. Es el caso donde las divisiones se tuercen si se
    callan: el ascenso parecería un error.
  */
  it('dice cuando tienes ganada una división que todavía no está abierta', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        'GET /api/social/liga': {
          ...CON_LIGA,
          division: SUSURRO,
          divisionGanada: ECO,
          faltanParaTuDivision: 2,
        },
      }),
    );
    renderizar();

    expect(
      await screen.findByText(/Tienes ganada la División Eco, pero todavía no está abierta/),
    ).toBeInTheDocument();
    expect(screen.getByText(/faltan 2 personas/)).toBeInTheDocument();
  });

  it('cuando sí hay varias divisiones, lo dice sin adornos', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        'GET /api/social/liga': { ...CON_LIGA, division: ECO, abiertas: 3 },
      }),
    );
    renderizar();

    expect(await screen.findByText('3 de 5 abiertas')).toBeInTheDocument();
    expect(screen.getAllByText('División Eco')).toHaveLength(2);
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
          // Quien se esconde tampoco recibe el podio: mirar una competición de
          // la que te has borrado es mirar por la ventana.
          podioAnterior: null,
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
      servidor({
        'GET /api/social/liga': SOLO_YO,
        'GET /api/social/desafio': SIN_DESAFIO,
        'GET /api/social/amigos': AMIGOS_VACIO,
      }),
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
      servidor({
        'GET /api/social/liga': SOLO_YO,
        'GET /api/social/desafio': SIN_DESAFIO,
        'GET /api/social/amigos': AMIGOS,
      }),
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
        {
          'GET /api/social/liga': SOLO_YO,
          'GET /api/social/desafio': SIN_DESAFIO,
          'GET /api/social/amigos': AMIGOS_VACIO,
        },
        { 'POST /api/social/amigos': 404 },
      ),
    );
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));
    await userEvent.type(await screen.findByLabelText('Código de esa persona'), 'ZZZZ-ZZZZ');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/No encontramos a nadie con ese código/),
    );
  });

  it('se puede quitar a alguien', async () => {
    const fetchDeMentira = servidor({
      'GET /api/social/liga': SOLO_YO,
      'GET /api/social/desafio': SIN_DESAFIO,
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

describe('los toques, que es lo que más fácil se tuerce', () => {
  /*
    La prueba que justifica el diseño entero del toque. En ningún sitio de esta
    pantalla puede aparecer que alguien lleve tiempo sin estudiar: eso es lo que
    convertiría «dar un toque» en «me he dado cuenta de que no estás
    cumpliendo», y es lo que hace falta para poder elegir a quién tocar por
    estar flojo.
  */
  it('no enseña en ningún sitio quién lleva sin estudiar', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        'GET /api/social/liga': SOLO_YO,
        'GET /api/social/desafio': SIN_DESAFIO,
        'GET /api/social/amigos': AMIGOS,
      }),
    );
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));
    await screen.findByText('Marta');

    expect(screen.queryByText(/sin practicar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no ha estudiado/i)).not.toBeInTheDocument();
    // El botón habla de acordarse, no de recordarle nada a nadie.
    expect(screen.getByRole('button', { name: 'Acordarte de Marta' })).toBeEnabled();
  });

  it('cuando no cabe otro toque, el motivo es siempre tuyo y nunca suyo', async () => {
    const gastados = {
      ...AMIGOS,
      toquesQueMeQuedan: 0,
      amigos: [
        { ...AMIGOS.amigos[0]!, puedoTocar: false, motivoDelToque: 'ya-le-toque' as const },
        { ...AMIGOS.amigos[1]!, puedoTocar: false, motivoDelToque: 'sin-toques-hoy' as const },
      ],
    };

    vi.stubGlobal(
      'fetch',
      servidor({
        'GET /api/social/liga': SOLO_YO,
        'GET /api/social/desafio': SIN_DESAFIO,
        'GET /api/social/amigos': gastados,
      }),
    );
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));

    expect(
      await screen.findByRole('button', { name: 'Ya te acordaste de Marta esta semana' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ya no te quedan toques hoy' })).toBeDisabled();

    // Nunca se dice que la otra persona te haya silenciado: si eso se notara,
    // silenciar costaría una conversación y casi nadie lo usaría.
    expect(screen.queryByText(/te ha silenciado/i)).not.toBeInTheDocument();
  });

  it('se pueden apagar del todo, y se dice que el otro no se entera', async () => {
    const fetchDeMentira = servidor({
      'GET /api/social/liga': SOLO_YO,
      'GET /api/social/desafio': SIN_DESAFIO,
      'GET /api/social/amigos': AMIGOS,
      'PUT /api/social/toques': { ...AMIGOS, toquesApagados: true },
    });
    vi.stubGlobal('fetch', fetchDeMentira);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'No quiero recibir toques' }));

    expect(
      await screen.findByText(/Quien te lo mande no se entera de que lo apagaste/),
    ).toBeInTheDocument();
  });

  it('un regalo cuesta monedas a quien lo manda, y se dice cuántas', async () => {
    const fetchDeMentira = servidor({
      'GET /api/social/liga': SOLO_YO,
      'GET /api/social/desafio': SIN_DESAFIO,
      'GET /api/social/amigos': AMIGOS,
      'POST /api/social/amigos/a1/regalo': { nombre: 'Marta' },
    });
    vi.stubGlobal('fetch', fetchDeMentira);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));
    const botones = await screen.findAllByRole('button', { name: /Regalar 10/ });
    await userEvent.click(botones[0]!);

    await waitFor(() =>
      expect(fetchDeMentira).toHaveBeenCalledWith(
        '/api/social/amigos/a1/regalo',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});

describe('seguir a alguien', () => {
  it('es otra cosa que ser amigos, y se explica antes de pulsar', async () => {
    const fetchDeMentira = servidor({
      'GET /api/social/liga': SOLO_YO,
      'GET /api/social/desafio': SIN_DESAFIO,
      'GET /api/social/amigos': AMIGOS_VACIO,
      'POST /api/social/seguir': { nombre: 'Marta' },
    });
    vi.stubGlobal('fetch', fetchDeMentira);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Solo seguir' }));

    expect(screen.getByText(/en un solo sentido/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Código de esa persona'), 'ABCD-EFGH');
    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));

    await waitFor(() =>
      expect(fetchDeMentira).toHaveBeenCalledWith(
        '/api/social/seguir',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('a quien te sigue se le puede quitar', async () => {
    const fetchDeMentira = servidor({
      'GET /api/social/liga': SOLO_YO,
      'GET /api/social/desafio': SIN_DESAFIO,
      'GET /api/social/amigos': {
        ...AMIGOS_VACIO,
        seguidores: [{ seguimientoId: 's1', displayName: 'Rosa' }],
      },
      'DELETE /api/social/seguidores/s1': {},
    });
    vi.stubGlobal('fetch', fetchDeMentira);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Quitar a Rosa de tus seguidores' }),
    );

    await waitFor(() =>
      expect(fetchDeMentira).toHaveBeenCalledWith(
        '/api/social/seguidores/s1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });
});

describe('el desafío entre dos', () => {
  it('enseña la barra, el objetivo y lo que ha puesto cada uno', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        'GET /api/social/liga': SOLO_YO,
        'GET /api/social/amigos': AMIGOS,
        'GET /api/social/desafio': {
          cofre: 30,
          dias: 7,
          desafio: {
            id: 'd1',
            estado: 'vivo',
            yoRete: true,
            otro: 'Marta',
            objetivo: 550,
            llevan: 165,
            loMio: 100,
            loSuyo: 65,
            cofre: 30,
            terminaEn: '2026-10-05T04:00:00.000Z',
            cofreNuevo: null,
          },
        },
      }),
    );
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));

    expect(await screen.findByText('165 / 550 XP')).toBeInTheDocument();
    expect(screen.getByText(/Tú has puesto 100 XP · Marta, 65 XP/)).toBeInTheDocument();
  });

  it('el cofre se abre solo, sin botón de reclamar', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        'GET /api/social/liga': SOLO_YO,
        'GET /api/social/amigos': AMIGOS,
        'GET /api/social/desafio': {
          cofre: 30,
          dias: 7,
          desafio: {
            id: 'd1',
            estado: 'logrado',
            yoRete: false,
            otro: 'Marta',
            objetivo: 550,
            llevan: 560,
            loMio: 300,
            loSuyo: 260,
            cofre: 30,
            terminaEn: '2026-10-05T04:00:00.000Z',
            cofreNuevo: 30,
          },
        },
      }),
    );
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'amigos' }));

    expect(await screen.findByText(/Llegasteis\. 30 monedas para cada uno/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reclamar/i })).not.toBeInTheDocument();
  });
});
