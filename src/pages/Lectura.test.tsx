import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Lectura } from './Lectura';
import type * as Lecturas from '@/lib/lecturas';
import { audioDeParrafo, crearLectura, olvidarServidorDeLecturas } from '@/lib/lecturas';

/*
  La voz va por párrafos y se pide al servidor. Aquí se controla lo que contesta:
  hoy siempre es «no hay» (204), y hay que probar las dos caras.
*/
vi.mock('@/lib/lecturas', async (original) => {
  const real = (await original()) as typeof Lecturas;
  return { ...real, audioDeParrafo: vi.fn(() => Promise.resolve(null)) };
});

/*
  La voz del aparato no pinta nada aquí y en jsdom no existe: se calla.
*/
vi.mock('@/lib/voz', () => ({
  hayVozInglesa: () => Promise.resolve(false),
  decir: () => Promise.resolve(),
}));

/**
 * El lector de un texto propio.
 *
 * QUÉ SE APRIETA AQUÍ
 *
 * Solo la promesa de la pantalla: que tocar una palabra no te saque de donde
 * ibas, y que marcarla diga la verdad. No cómo de bonita queda.
 *
 * Las tres cosas que se comprueban son las tres que se rompen solas:
 *
 *   1. abrir el panel NO desmonta el texto y NO desplaza la pantalla si la
 *      palabra ya se veía;
 *   2. sí la desplaza, y lo mínimo, cuando el panel la taparía;
 *   3. marcar cambia LAS TRES apariciones de la palabra, no la tocada.
 *
 * Y que cuando no hay voz no hay reproductor, que es lo que pasa hoy siempre.
 */

const TEXTO = 'Code is read more often than code is written. Good code explains itself.';

/** Lo que mide el panel. En jsdom todo mide cero y el ajuste no se probaría. */
function conAlturasDeMentira(altoPanel: number): () => void {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.getAttribute('role') === 'dialog' ? altoPanel : 0;
    },
  });
  return () => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original);
  };
}

/** Coloca una palabra en un sitio concreto de la ventana. */
function colocar(elemento: HTMLElement, arriba: number, alto = 44): void {
  elemento.getBoundingClientRect = () =>
    ({
      top: arriba,
      bottom: arriba + alto,
      left: 0,
      right: 100,
      width: 100,
      height: alto,
      x: 0,
      y: arriba,
      toJSON: () => ({}),
    }) as DOMRect;
}

async function abrirLectura(): Promise<string> {
  const { id } = await crearLectura({ titulo: 'Sobre revisiones', texto: TEXTO });
  return id;
}

function pintar(id: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[`/lecturas/${id}`]}>
        <Routes>
          <Route path="/lecturas/:id" element={<Lectura />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Todos los botones de palabra que dicen ese lema. */
function palabras(lema: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`button[data-lema="${lema}"]`));
}

let desplazar: ReturnType<typeof vi.fn>;
let restaurarAlturas: (() => void) | null = null;

beforeEach(() => {
  localStorage.clear();
  olvidarServidorDeLecturas();
  vi.mocked(audioDeParrafo).mockReset();
  vi.mocked(audioDeParrafo).mockResolvedValue(null);
  // jsdom no trae `createObjectURL`, y sin ella el reproductor entiende, con
  // razón, que ese audio no se puede reproducir y no pintaría el botón.
  URL.createObjectURL = () => 'blob:falso';
  URL.revokeObjectURL = () => undefined;
  // Sin servidor: todo cae en el respaldo local, que es el estado de hoy.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('todavía no hay servidor de lecturas'))),
  );
  desplazar = vi.fn();
  vi.stubGlobal('scrollBy', desplazar);
});

afterEach(() => {
  restaurarAlturas?.();
  restaurarAlturas = null;
  vi.unstubAllGlobals();
});

describe('tocar una palabra sin perder el sitio', () => {
  it('abre el panel sin desmontar el texto ni mover la pantalla', async () => {
    restaurarAlturas = conAlturasDeMentira(300);
    const id = await abrirLectura();
    pintar(id);

    const antes = await screen.findByRole('button', { name: /^Code,/ });
    // Arriba del todo de la ventana (768 de alto en jsdom): el panel de 300 no
    // llega a taparla, así que no hay ningún motivo para mover nada.
    colocar(antes, 150);

    await userEvent.click(antes);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // El texto sigue ahí, y es EL MISMO NODO: no se ha vuelto a montar.
    expect(palabras('code')[0]).toBe(antes);
    expect(palabras('written')).toHaveLength(1);
    expect(desplazar).not.toHaveBeenCalled();
  });

  it('baja lo justo cuando el panel taparía la palabra', async () => {
    restaurarAlturas = conAlturasDeMentira(300);
    const id = await abrirLectura();
    pintar(id);

    const boton = await screen.findByRole('button', { name: /^Good,/ });
    // Ventana de 768 menos 300 de panel: la banda libre acaba en 468. Esta
    // palabra acaba en 544, así que sobran 76, más 12 de margen.
    colocar(boton, 500);

    await userEvent.click(boton);

    await screen.findByRole('dialog');
    expect(desplazar).toHaveBeenCalledWith(0, 88);
  });

  it('al cerrar, el foco vuelve a la palabra', async () => {
    restaurarAlturas = conAlturasDeMentira(300);
    const id = await abrirLectura();
    pintar(id);

    const boton = await screen.findByRole('button', { name: /^often,/ });
    colocar(boton, 150);
    await userEvent.click(boton);

    const panel = await screen.findByRole('dialog');
    await userEvent.click(within(panel).getByRole('button', { name: /Cerrar y seguir leyendo/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(boton);
  });
});

describe('marcar una palabra', () => {
  it('cambia las tres apariciones del lema y no solo la tocada', async () => {
    restaurarAlturas = conAlturasDeMentira(300);
    const id = await abrirLectura();
    pintar(id);

    await screen.findByRole('button', { name: /^Code,/ });
    expect(palabras('code')).toHaveLength(3);
    expect(palabras('code').every((p) => p.dataset.estado === 'nueva')).toBe(true);

    const boton = palabras('code')[1];
    if (!boton) throw new Error('faltan las apariciones de «code»');
    colocar(boton, 150);
    await userEvent.click(boton);

    const panel = await screen.findByRole('dialog');
    await userEvent.click(within(panel).getByRole('button', { name: 'Ya la sé' }));

    await waitFor(() =>
      expect(palabras('code').every((p) => p.dataset.estado === 'sabida')).toBe(true),
    );
    // Y lo que no es «code» se queda como estaba.
    expect(palabras('read')[0]?.dataset.estado).toBe('nueva');
  });

  it('el panel se queda abierto: leer es tocar una palabra detrás de otra', async () => {
    restaurarAlturas = conAlturasDeMentira(300);
    const id = await abrirLectura();
    pintar(id);

    const boton = await screen.findByRole('button', { name: /^Code,/ });
    colocar(boton, 150);
    await userEvent.click(boton);

    const panel = await screen.findByRole('dialog');
    await userEvent.click(within(panel).getByRole('button', { name: 'Me suena' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('la voz, que va por párrafos', () => {
  it('sin voz no pinta un reproductor que no suena, y lo dice', async () => {
    // `audioDeParrafo` contesta `null`, que es lo que hoy devuelve el 204 del
    // servidor mientras no haya clave del sintetizador.
    const id = await abrirLectura();
    pintar(id);

    expect(await screen.findByText(/todavía no tiene voz/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Escuchar el texto/ })).not.toBeInTheDocument();
    // Y lo importante: el texto se lee igual.
    expect(screen.getByRole('button', { name: /^Code,/ })).toBeInTheDocument();
  });

  it('con voz pregunta UNA vez, por el primer párrafo, y enseña el reproductor', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:falso',
      revokeObjectURL: () => {},
    });
    vi.mocked(audioDeParrafo).mockResolvedValue({ base64: 'AAAA', mime: 'audio/mpeg' });

    const id = await abrirLectura();
    pintar(id);

    expect(await screen.findByRole('button', { name: /Escuchar el texto/ })).toBeInTheDocument();
    expect(screen.queryByText(/todavía no tiene voz/)).not.toBeInTheDocument();
    /*
      Una sola pregunta, y por el párrafo cero. Preguntar por los veinte para
      poder pintar un botón serían veinte peticiones al servidor para enterarse
      de un «no», que es la respuesta de hoy.
    */
    expect(vi.mocked(audioDeParrafo)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(audioDeParrafo)).toHaveBeenCalledWith(id, 0);
  });
});

describe('cuánto queda por saber', () => {
  it('un texto recién traído está al cero por ciento y no dice que hayas fallado', async () => {
    const id = await abrirLectura();
    pintar(id);

    const barra = await screen.findByRole('progressbar');
    expect(barra).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getAllByText(/por descubrir/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/fall/i)).not.toBeInTheDocument();
  });

  it('no se atribuye a quien lee las palabras que el servidor marca solo', async () => {
    /*
      El servidor manda las doscientas palabras funcionales ya marcadas como
      sabidas. Decir «Sabes 108 de 410» sería darle un trofeo a alguien por abrir
      la pantalla, y además haría que el número no significara nada.
    */
    const id = await abrirLectura();
    pintar(id);

    await screen.findByRole('progressbar');
    expect(screen.queryByText(/Sabes/)).not.toBeInTheDocument();
  });
});
