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

/** Lo que devuelve `/logros` para alguien que ya lleva un tiempo. */
const LOGROS = {
  logros: [
    {
      code: 'CONSTANCIA',
      titulo: 'Día tras día',
      medida: 'Tu racha más larga.',
      cuenta: 11,
      grado: 2,
      gradoMaximo: 5,
      metaDelGrado: 7,
      metaSiguiente: 30,
      unidad: ['día', 'días'],
      conseguidoEn: '2025-04-02T09:00:00.000Z',
    },
    {
      code: 'LECCIONES',
      titulo: 'Lecciones terminadas',
      medida: 'Lecciones que llegaste a acabar.',
      cuenta: 27,
      grado: 3,
      gradoMaximo: 5,
      metaDelGrado: 25,
      metaSiguiente: 60,
      unidad: ['lección', 'lecciones'],
      conseguidoEn: '2025-05-11T09:00:00.000Z',
    },
    {
      code: 'VOZ',
      titulo: 'A viva voz',
      medida: 'Veces que hablaste en inglés.',
      cuenta: 0,
      grado: 0,
      gradoMaximo: 5,
      metaDelGrado: null,
      metaSiguiente: 1,
      unidad: ['vez', 'veces'],
      conseguidoEn: null,
    },
  ],
  medallas: [
    { mes: '2026-09', dias: 3, hacenFalta: 12, ganada: false, enCurso: true },
    { mes: '2026-08', dias: 18, hacenFalta: 12, ganada: true, enCurso: false },
    { mes: '2026-07', dias: 8, hacenFalta: 12, ganada: false, enCurso: false },
  ],
  diasPorMedalla: 12,
  rachasConAmigos: [
    { amistadId: 'a1', displayName: 'Marta', dias: 9, mejor: 14, viva: true },
    { amistadId: 'a2', displayName: 'Luis', dias: 0, mejor: 6, viva: false },
    { amistadId: 'a3', displayName: 'Noa', dias: 0, mejor: 0, viva: false },
  ],
  ventanaDias: 180,
  nuevos: [],
};

/** Lo que devuelve `/logros` el primer día: una cuenta con cero de todo. */
const LOGROS_VACIOS = {
  logros: LOGROS.logros.map((logro) => ({
    ...logro,
    cuenta: 0,
    grado: 0,
    metaDelGrado: null,
    metaSiguiente: logro.code === 'CONSTANCIA' ? 3 : 1,
    conseguidoEn: null,
  })),
  medallas: [{ mes: '2026-09', dias: 0, hacenFalta: 12, ganada: false, enCurso: true }],
  diasPorMedalla: 12,
  rachasConAmigos: [],
  ventanaDias: 180,
  nuevos: [],
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

const TODO = { '/me/profile': PERFIL, '/progress': PROGRESO, '/logros': LOGROS };

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

describe('el resumen de arriba', () => {
  it('muestra la racha, el nivel y la experiencia', async () => {
    vi.stubGlobal('fetch', servidor(TODO));
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Yanis' })).toBeInTheDocument();
    expect(await screen.findByLabelText('4 días de racha')).toBeInTheDocument();
    expect(await screen.findByLabelText('1240 de experiencia')).toBeInTheDocument();
    expect(
      await screen.findByLabelText('Tu nivel es Lo que hago y lo que hice, A2'),
    ).toBeInTheDocument();
  });
});

describe('los logros', () => {
  it('enseña la cifra, el grado y lo que falta para el siguiente', async () => {
    vi.stubGlobal('fetch', servidor(TODO));
    renderizar();

    expect(await screen.findByText('Lecciones terminadas')).toBeInTheDocument();
    expect(screen.getByText(/Grado 3 de 5/)).toBeInTheDocument();
    // 60 − 27: el texto dice exactamente cuánto falta, no solo un porcentaje.
    expect(screen.getByText(/faltan 33 lecciones/)).toBeInTheDocument();
  });

  /*
    Una insignia sin ganar también sale, y también dice qué hay que hacer. Si
    solo salieran las ganadas, un perfil nuevo estaría vacío y nadie sabría que
    hay algo que conseguir.
  */
  it('las que no están ganadas salen igual y dicen qué falta', async () => {
    vi.stubGlobal('fetch', servidor(TODO));
    renderizar();

    expect(await screen.findByText('A viva voz')).toBeInTheDocument();
    expect(screen.getByText(/falta 1 vez/)).toBeInTheDocument();
  });

  it('dice en qué mes se ganó cada grado', async () => {
    vi.stubGlobal('fetch', servidor(TODO));
    renderizar();

    expect(await screen.findByText(/mayo de 2025/)).toBeInTheDocument();
  });
});

describe('las medallas del mes', () => {
  it('marca el mes ganado y cuenta los días de los que no llegaron', async () => {
    vi.stubGlobal('fetch', servidor(TODO));
    renderizar();

    expect(
      await screen.findByText(/agosto de 2026: 18 días de práctica, medalla ganada/),
    ).toBeInTheDocument();
    /*
      Un mes flojo NO se llama fallado: dice sus días y cuántos hacían falta.
      Esta prueba existe para que nadie escriba «mes perdido» aquí sin tumbarla.
    */
    expect(
      await screen.findByText(/julio de 2026: 8 días de práctica, no llegó a los 12/),
    ).toBeInTheDocument();
  });
});

describe('las rachas con amigos', () => {
  it('enseña el número junto a quien lo comparte', async () => {
    vi.stubGlobal('fetch', servidor(TODO));
    renderizar();

    expect(await screen.findByText('Marta')).toBeInTheDocument();
    expect(screen.getByLabelText('9 días de racha con Marta')).toBeInTheDocument();
    expect(screen.getByText('9 días practicando los dos')).toBeInTheDocument();
  });

  /*
    LA PRUEBA IMPORTANTE. Cuando la racha se acaba, lo que queda es el récord y
    ni una palabra de culpa: ni quién faltó, ni cuánto queda, ni que se rompió.
    Si alguien añade mañana un «¡tu racha con Luis está en peligro!», esta
    prueba se cae.
  */
  it('cuando se acaba queda el récord, y no se culpa a nadie', async () => {
    vi.stubGlobal('fetch', servidor(TODO));
    renderizar();

    expect(await screen.findByText('Lo mejor que llevasteis: 6 días')).toBeInTheDocument();
    expect(screen.queryByLabelText(/racha con Luis/)).not.toBeInTheDocument();

    for (const palabra of [/peligro/i, /perdis/i, /rompi/i, /se acabó/i, /quedan .* horas/i]) {
      expect(screen.queryByText(palabra)).not.toBeInTheDocument();
    }
  });

  /*
    Quien todavía no coincidió ningún día sigue en la lista, con una invitación
    y no con un cero. Sacarlo sería señalarle con el silencio.
  */
  it('quien no ha coincidido nunca sigue en la lista', async () => {
    vi.stubGlobal('fetch', servidor(TODO));
    renderizar();

    expect(await screen.findByText('Noa')).toBeInTheDocument();
    expect(
      screen.getByText('Cuando practiquéis el mismo día empieza a contar'),
    ).toBeInTheDocument();
  });
});

describe('el perfil del primer día', () => {
  /*
    El caso más fácil de dejar feo: una cuenta recién hecha, con cero de todo.
    Tiene que enseñar las seis insignias apagadas con lo que falta, su mes en
    curso y una invitación a añadir a alguien; nunca un hueco.
  */
  it('con cero de todo sigue diciendo qué hacer', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({ '/me/profile': PERFIL, '/progress': PROGRESO, '/logros': LOGROS_VACIOS }),
    );
    renderizar();

    expect(await screen.findByText('Día tras día')).toBeInTheDocument();
    expect(screen.getByText(/faltan 3 días/)).toBeInTheDocument();
    expect(screen.getByText(/Cuando alguien de tu lista y tú practiquéis/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir a alguien' })).toBeInTheDocument();
    expect(screen.getByText(/septiembre de 2026: 0 días/)).toBeInTheDocument();
  });
});

describe('cuando algo falla', () => {
  /*
    Los bloques se caen por separado. Si `/logros` no contesta, la racha y los
    ajustes siguen ahí: una pantalla que se queda en blanco entera porque una de
    tres consultas falló no sirve nunca.
  */
  it('sin logros, el resto de la pantalla sigue en pie', async () => {
    vi.stubGlobal('fetch', servidor({ '/me/profile': PERFIL, '/progress': PROGRESO }));
    renderizar();

    expect(await screen.findByLabelText('4 días de racha')).toBeInTheDocument();
    expect(screen.getByText('yanis@ejemplo.com')).toBeInTheDocument();
    expect(await screen.findByText(/todavía no está disponible/i)).toBeInTheDocument();
  });

  it('avisa sin romperse cuando el perfil todavía no existe en el servidor', async () => {
    vi.stubGlobal('fetch', servidor({ '/progress': PROGRESO, '/logros': LOGROS }));
    renderizar();

    expect(await screen.findByText(/todavía no está disponible/i)).toBeInTheDocument();
    expect(await screen.findByLabelText('4 días de racha')).toBeInTheDocument();
  });
});

describe('los ajustes del perfil', () => {
  it('guarda el nombre nuevo con PATCH', async () => {
    const llamadas = servidor({
      '/me/profile': { ...PERFIL, displayName: 'Yanis A.' },
      '/progress': PROGRESO,
      '/logros': LOGROS,
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
        const cuerpo = url.includes('/progress')
          ? PROGRESO
          : url.includes('/logros')
            ? LOGROS
            : PERFIL;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) });
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

  it('no deja guardar una meta diaria fuera de 5 y 120', async () => {
    vi.stubGlobal('fetch', servidor(TODO));
    const usuario = userEvent.setup();
    renderizar();

    const campo = await screen.findByLabelText('Minutos que quieres practicar cada día');
    await usuario.clear(campo);
    await usuario.type(campo, '300');
    await usuario.click(screen.getByRole('button', { name: 'Guardar meta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/entre 5 y 120/i);
  });
});
