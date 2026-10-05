import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Leccion } from './Leccion';
import { Menu } from './Menu';

/**
 * Dónde vive el shadowing, y dónde ya no.
 *
 *
 * QUÉ CAMBIÓ Y POR QUÉ ESTE ARCHIVO SIGUE AQUÍ
 *
 * Antes esto comprobaba lo contrario: que desde un ejercicio de leer en voz
 * alta se pudiera pasar a imitar el ritmo con un botón debajo. La pregunta es
 * la misma —qué se enseña en los ejercicios de voz de una lección— y lo que
 * cambió es la respuesta, así que el archivo se queda y las afirmaciones se
 * dan la vuelta.
 *
 * El motivo del cambio: el shadowing no es un paso de una lección, es una
 * sesión entera. Pide auriculares, sonda el micrófono para ver si el altavoz se
 * cuela en la grabación y parte la frase en trozos que se repiten uno a uno.
 * Ofrecer eso en medio de una lección era interrumpir la lección.
 *
 *
 * QUÉ SE APRIETA
 *
 * Las dos mitades del cambio, porque por separado no valen nada. Quitarlo de la
 * lección sin darle puerta propia es perder el ejercicio; darle puerta sin
 * quitarlo de la lección es tenerlo en dos sitios. Por eso las dos cosas se
 * comprueban en el mismo archivo:
 *
 *   1. En la lección se lee en voz alta y no se ofrece nada más.
 *   2. Desde el menú se llega a imitar el ritmo.
 *
 * Y sigue comprobándose lo que NO debe cambiar: que leer en voz alta se quede
 * exactamente donde estaba.
 */

vi.mock('@/components/Mascota', () => ({
  Mascota: () => <span data-testid="mascota" />,
  MascotaConMensaje: ({ mensaje }: { mensaje: string }) => (
    <span data-testid="mascota">{mensaje}</span>
  ),
}));

vi.mock('@/components/ejercicios/Ejercicio', () => ({ Ejercicio: () => null }));
vi.mock('@/components/Confeti', () => ({ Confeti: () => null }));

/*
  Los dos de voz van fingidos y cada uno dice quién es. Montando los de verdad
  esto pediría micrófono y audio, y lo que se viene a mirar es cuál de los dos
  se pone, no cómo funciona cada uno por dentro: eso ya está probado en sus
  propios archivos.
*/
vi.mock('@/components/ejercicios/LeerEnVozAlta', () => ({
  LeerEnVozAlta: () => <div data-testid="leer-en-voz-alta" />,
}));
vi.mock('@/components/ejercicios/HablarLibre', () => ({ HablarLibre: () => null }));
vi.mock('@/components/ejercicios/Shadowing', () => ({
  Shadowing: ({ ejercicio }: { ejercicio: { code: string } }) => (
    <div data-testid="shadowing" data-code={ejercicio.code} />
  ),
}));

vi.mock('@/store/sesion', () => ({
  useSesion: (selector: (estado: unknown) => unknown) =>
    selector({ usuario: { displayName: 'Yanis' } }),
}));

const LEER = {
  code: 'L5-U1-03-E02',
  type: 'read_aloud',
  difficulty: 2,
  prompt: { referenceText: 'I usually get up at seven.' },
};

function respuesta(cuerpo: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) });
}

function servidor(ejercicio: Record<string, unknown>) {
  return vi.fn((url: unknown) => {
    const ruta = String(url);
    if (ruta.includes('/curriculum/lessons/')) {
      return respuesta({
        lesson: { code: 'L5-U1-03', titleEs: 'Mi rutina', type: 'speaking', xpReward: 10 },
        skills: [],
        exercises: [ejercicio],
      });
    }
    if (ruta.endsWith('/sessions/start')) return respuesta({ sessionId: 'ses-1' });
    return respuesta({});
  });
}

function conRutas(entrada: string, elemento: React.ReactNode, ruta: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route path={ruta} element={elemento} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const abrirLeccion = () => conRutas('/leccion/L5-U1-03', <Leccion />, '/leccion/:code');

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

describe('el shadowing ya no vive dentro de la lección', () => {
  it('en un ejercicio de voz se lee en voz alta, como siempre', async () => {
    vi.stubGlobal('fetch', servidor(LEER));
    abrirLeccion();

    expect(await screen.findByTestId('leer-en-voz-alta')).toBeInTheDocument();
  });

  it('no se ofrece cambiar a imitar el ritmo', async () => {
    /*
      Este es el botón que se quitó. La lección tiene que poder terminarse de
      principio a fin sin que aparezca otra actividad por el medio.
    */
    vi.stubGlobal('fetch', servidor(LEER));
    abrirLeccion();

    await screen.findByTestId('leer-en-voz-alta');
    expect(screen.queryByRole('button', { name: /imitar el ritmo/i })).toBeNull();
  });

  it('y el shadowing no se monta en ningún momento de la lección', async () => {
    /*
      No basta con que no haya botón: lo que no puede quedar es el componente
      montado por otro camino. Monta un `<audio>`, pide permiso de micrófono y
      sonda los auriculares, y nada de eso tiene por qué pasar dentro de una
      lección.
    */
    vi.stubGlobal('fetch', servidor(LEER));
    abrirLeccion();

    await screen.findByTestId('leer-en-voz-alta');
    expect(screen.queryByTestId('shadowing')).toBeNull();
  });

  it('en los ejercicios escritos tampoco se ofrece, como antes', async () => {
    vi.stubGlobal(
      'fetch',
      servidor({
        code: 'L5-U1-03-E01',
        type: 'fill_blank',
        difficulty: 1,
        prompt: { text: 'She ___ a doctor.' },
      }),
    );
    abrirLeccion();

    await screen.findByRole('button', { name: /saltar|comprobar/i });
    expect(screen.queryByRole('button', { name: /imitar el ritmo/i })).toBeNull();
  });
});

describe('pero se llega a él desde el menú', () => {
  it('«Más cosas que hacer» lleva a imitar el ritmo', () => {
    /*
      La otra mitad del cambio. Sin esto, lo de arriba solo demostraría que el
      ejercicio desapareció de la aplicación.

      En el menú y no en la barra de abajo porque en la barra no cabe: son cinco
      destinos y a 320 px un sexto los bajaría de los 44 px de zona pulsable.
      Ver `barra-inferior.ts`.
    */
    conRutas('/menu', <Menu />, '/menu');

    const entrada = screen.getByRole('button', { name: /imitar el ritmo/i });
    expect(entrada).toBeInTheDocument();
  });
});
