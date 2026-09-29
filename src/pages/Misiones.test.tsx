import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Misiones } from './Misiones';
import { avance, cuantoFalta } from '@/components/misiones/tipos';

/**
 * Los desafíos.
 *
 * QUÉ SE PRUEBA AQUÍ Y POR QUÉ ESTO Y NO OTRA COSA
 *
 * Esta pantalla tiene un solo trabajo: decir CUÁNTO FALTA sin mentir. Así que
 * lo que se aprieta es exactamente eso —que el número que se ve es el que mandó
 * el servidor, que la barra dice lo mismo que el número, y que la recompensa
 * escrita es la que el servidor va a pagar— y no cómo de bonita queda.
 *
 * Y se prueba lo que pasa el día que alguien NO cumple, que es el caso que más
 * veces va a ocurrir: que no se tacha nada, que no se quita nada y que la
 * pantalla lo dice con todas las letras.
 */

const MISIONES = {
  dia: '2026-09-28',
  terminaEl: '2026-09-29T04:00:00.000Z',
  diarias: [
    {
      codigo: 'UNA_LECCION',
      tituloEs: 'Termina una lección',
      icono: '📘',
      hecho: 1,
      objetivo: 1,
      xp: 10,
      cumplida: true,
    },
    {
      codigo: 'TRES_LECCIONES',
      tituloEs: 'Termina 3 lecciones',
      icono: '🎯',
      hecho: 1,
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

const NADA_HECHO = {
  ...MISIONES,
  diarias: MISIONES.diarias.map((m) => ({ ...m, hecho: 0, cumplida: false })),
};

const TODO_HECHO = {
  ...MISIONES,
  diarias: MISIONES.diarias.map((m) => ({ ...m, hecho: m.objetivo, cumplida: true })),
  mes: { ...MISIONES.mes, hecho: 20, cumplida: true },
  recienCumplidas: ['UNA_PARTIDA', 'MES'],
};

function servidor(cuerpo: unknown) {
  return vi.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) }),
  );
}

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <Misiones />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * El navegador de mentira responde a `prefers-reduced-motion`.
 *
 * jsdom no trae `matchMedia`, y sin él el contador de XP revienta. Se pone
 * aquí y no en el setup común porque estas pruebas necesitan contestar las dos
 * cosas: que SÍ se quiere movimiento y que NO.
 */
function conMovimiento(menos: boolean): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta.includes('prefers-reduced-motion') ? menos : false,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  // El 28 de septiembre a las 21:48: faltan 6 h 12 min para que se renueven. Se
  // fija la hora para que la cuenta atrás sea comprobable y no dependa de
  // cuándo se corran las pruebas.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-09-28T21:48:00.000Z'));
  conMovimiento(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('cuánto falta', () => {
  it('cuenta en horas y minutos, nunca en segundos', () => {
    const fin = '2026-09-29T04:00:00.000Z';
    expect(cuantoFalta(fin, Date.parse('2026-09-28T21:48:00.000Z'))).toBe('6 h 12 min');
  });

  it('por debajo de una hora deja de decir «0 h»', () => {
    const fin = '2026-09-29T04:00:00.000Z';
    expect(cuantoFalta(fin, Date.parse('2026-09-29T03:47:00.000Z'))).toBe('13 min');
  });

  it('nunca enseña cero: mientras quede algo, queda un minuto', () => {
    const fin = '2026-09-29T04:00:00.000Z';
    expect(cuantoFalta(fin, Date.parse('2026-09-29T03:59:50.000Z'))).toBe('1 min');
  });

  it('pasada la hora dice que se está renovando, no un número negativo', () => {
    const fin = '2026-09-29T04:00:00.000Z';
    expect(cuantoFalta(fin, Date.parse('2026-09-29T04:30:00.000Z'))).toBe('renovando…');
  });

  it('más de un día se cuenta en días, que es como se piensa un mes', () => {
    expect(cuantoFalta('2026-10-01T04:00:00.000Z', Date.parse('2026-09-28T04:00:00.000Z'))).toBe(
      '3 d 0 h',
    );
  });
});

describe('la barra nunca miente', () => {
  it('no se pasa del final aunque se haya hecho de más', () => {
    expect(avance(7, 3)).toBe(1);
    expect(avance(0, 3)).toBe(0);
    expect(avance(2, 4)).toBe(0.5);
  });

  it('un objetivo imposible de cero no pinta una barra llena', () => {
    expect(avance(5, 0)).toBe(0);
  });
});

describe('la pantalla', () => {
  it('enseña las tres del día con el número que mandó el servidor', async () => {
    vi.stubGlobal('fetch', servidor(MISIONES));
    renderizar();

    expect(await screen.findByText('Termina 3 lecciones')).toBeInTheDocument();
    expect(screen.getByText('Termina una lección')).toBeInTheDocument();
    expect(screen.getByText('Juega una partida')).toBeInTheDocument();

    // La barra dice lo mismo que el número, para quien la oye y para quien la ve.
    const barra = screen.getByRole('progressbar', { name: 'Termina 3 lecciones' });
    expect(barra).toHaveAttribute('aria-valuenow', '1');
    expect(barra).toHaveAttribute('aria-valuemax', '3');
    expect(barra).toHaveAttribute('aria-valuetext', '1 de 3');
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText(/1 de 3/)).toBeInTheDocument();
  });

  it('enseña la cuenta atrás que sale del final que puso el servidor', async () => {
    vi.stubGlobal('fetch', servidor(MISIONES));
    renderizar();

    // El minuto exacto ya lo aprieta la prueba de `cuantoFalta` de arriba, con
    // una hora puesta a mano. Aquí lo que se comprueba es que la cuenta sale
    // del `terminaEl` del servidor y no de una constante escrita en la pantalla.
    expect(await screen.findByText(/6 h \d+ min/)).toBeInTheDocument();
  });

  it('paga exactamente lo que el servidor dice que paga', async () => {
    vi.stubGlobal('fetch', servidor(MISIONES));
    renderizar();

    expect(await screen.findByText(/\+10 XP/)).toBeInTheDocument();
    expect(screen.getAllByText(/\+15 XP/)).toHaveLength(2);
  });

  it('el desafío del mes enseña su progreso, su premio y los días que quedan', async () => {
    vi.stubGlobal('fetch', servidor(MISIONES));
    renderizar();

    expect(await screen.findByText('Termina 20 lecciones este mes')).toBeInTheDocument();
    expect(screen.getByText('13/20')).toBeInTheDocument();

    const mes = screen.getByText('Desafío del mes').closest('section')!;
    expect(within(mes).getByText(/100 XP/)).toBeInTheDocument();
    expect(within(mes).getByText(/un congelado de racha/)).toBeInTheDocument();
    expect(within(mes).getByText(/3 días/)).toBeInTheDocument();
  });

  it('dice «1 día» y no «1 días» el último día del mes', async () => {
    vi.stubGlobal('fetch', servidor({ ...MISIONES, mes: { ...MISIONES.mes, diasQueQuedan: 1 } }));
    renderizar();

    expect(await screen.findByText(/1 día$/)).toBeInTheDocument();
  });
});

describe('con el teclado y sin tocar la pantalla', () => {
  /*
    Antes de esto, en esta pantalla lo único que se alcanzaba con el tabulador
    era el botón de volver: decía qué hacer y no dejaba ir a hacerlo. Se
    comprobó en el navegador, con cinco tabulaciones seguidas.
  */
  it('cada desafío pendiente es un enlace al sitio donde se cumple', async () => {
    vi.stubGlobal('fetch', servidor(MISIONES));
    renderizar();

    const aLeer = await screen.findByRole('link', { name: /Termina 3 lecciones/ });
    expect(aLeer).toHaveAttribute('href', '/ruta');

    const aJugar = screen.getByRole('link', { name: /Juega una partida/ });
    expect(aJugar).toHaveAttribute('href', '/juegos');
  });

  it('el nombre del enlace dice lo que falta, no la tarjeta entera de corrido', async () => {
    vi.stubGlobal('fetch', servidor(MISIONES));
    renderizar();

    // Sin `aria-label` propio, quien navega por voz oiría título, barra, «1 de
    // 3» y «+15 XP» seguidos cada vez que pasa por encima.
    expect(
      await screen.findByRole('link', {
        name: 'Termina 3 lecciones. Llevas 1 de 3. Ir a hacerlo.',
      }),
    ).toBeInTheDocument();
  });

  it('la que ya está hecha no es un enlace: no hay nada que ir a hacer', async () => {
    vi.stubGlobal('fetch', servidor(MISIONES));
    renderizar();

    await screen.findByText('Termina una lección');
    expect(screen.queryByRole('link', { name: /Termina una lección/ })).not.toBeInTheDocument();
  });
});

describe('el día que no se cumple nada', () => {
  /*
    Esta es la prueba que protege la regla de que fallar no castiga. Si algún
    día alguien añade un «has perdido» o pone en rojo lo que falta, salta.
  */
  it('no regaña, no tacha y dice que no se pierde nada', async () => {
    vi.stubGlobal('fetch', servidor(NADA_HECHO));
    renderizar();

    expect(await screen.findByText(/no se pierde nada por no cumplirlos/)).toBeInTheDocument();
    expect(screen.getByText(/mañana hay otros tres/)).toBeInTheDocument();

    // Las tres siguen ahí, enteras y con su premio a la vista.
    expect(screen.getAllByRole('progressbar')).toHaveLength(4);
    expect(screen.getByText(/\+10 XP/)).toBeInTheDocument();

    // Y Milo invita en vez de reprochar.
    expect(screen.getByText(/Con una ya empiezas/)).toBeInTheDocument();
    expect(screen.queryByText(/perdid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fallaste/i)).not.toBeInTheDocument();
  });

  it('con todo hecho lo celebra y abre el cofre', async () => {
    vi.stubGlobal('fetch', servidor(TODO_HECHO));
    renderizar();

    expect(await screen.findByText('¡Los tres de hoy, hechos!')).toBeInTheDocument();
    expect(screen.getByText(/Cofre abierto/)).toBeInTheDocument();
    expect(screen.getByText(/Ganaste 100 XP y un congelado de racha/)).toBeInTheDocument();
  });
});

describe('con movimiento reducido', () => {
  /*
    La regla es «sin animaciones de celebración, pero con TODA la información».
    Es fácil cumplir la primera mitad y romper la segunda sin darse cuenta:
    basta con envolver el premio en el mismo `if` que la animación. Esta prueba
    existe para que eso no pase.
  */
  it('no baila nada, y aun así está todo el dato', async () => {
    conMovimiento(true);
    vi.stubGlobal('fetch', servidor(TODO_HECHO));
    renderizar();

    // El número del premio, entero y sin contar: nada de un «+0 XP» a medias.
    expect(await screen.findByText(/\+10 XP/)).toBeInTheDocument();
    expect(screen.getAllByText(/\+15 XP/)).toHaveLength(2);

    // El progreso, el premio del mes y la cuenta atrás siguen todos ahí.
    expect(screen.getByRole('progressbar', { name: 'Termina 3 lecciones' })).toHaveAttribute(
      'aria-valuetext',
      '3 de 3',
    );
    expect(screen.getByText(/Ganaste 100 XP y un congelado de racha/)).toBeInTheDocument();
    expect(screen.getByText(/6 h \d+ min/)).toBeInTheDocument();
  });
});

describe('cuando el mes ya no da tiempo', () => {
  it('lo dice en vez de prometer un objetivo imposible', async () => {
    vi.stubGlobal('fetch', servidor({ ...MISIONES, mes: null }));
    renderizar();

    expect(await screen.findByText(/El desafío del mes empieza el día uno/)).toBeInTheDocument();
    // Y no se inventa ningún cofre ni ningún número.
    expect(screen.queryByText('Desafío del mes')).not.toBeInTheDocument();
  });
});

describe('si el servidor no contesta', () => {
  it('lo dice y no pinta desafíos inventados', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: () =>
            Promise.resolve({
              error: { code: 'SYS-002', message: 'La base de datos no está disponible.' },
            }),
        }),
      ),
    );
    renderizar();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
