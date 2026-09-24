import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lluvia } from './Lluvia';

/**
 * CAEN.
 *
 * En jsdom no cae nada: no hay animaciones ni `getBoundingClientRect` de
 * verdad. Así que aquí NO se comprueba lo que se ve —eso se mira jugando— sino
 * las cuatro cosas que se romperían sin que nadie lo notara:
 *
 *   1. que al servidor le llegue una caída por palabra, incluidas las que se
 *      escapan, porque de eso depende que la racha que él cuenta sea la misma
 *      que se ve en pantalla;
 *   2. que la partida no se cierre antes de que esas caídas hayan llegado;
 *   3. que el fallo enseñe lo que significaba la palabra, que es lo único que
 *      convierte una partida perdida en algo aprendido;
 *   4. que quien pide menos movimiento tenga un juego entero y no un cartel.
 */

const RONDA = {
  code: 'CAEN',
  vidas: 3,
  olas: [
    {
      id: 'o1',
      cestas: [
        { id: 'o1c1', es: 'barato' },
        { id: 'o1c2', es: 'caro' },
        { id: 'o1c3', es: 'alto' },
        { id: 'o1c4', es: 'seguro' },
      ],
      palabras: [
        { id: 'o1p1', en: 'cheap', cestaId: 'o1c1' },
        { id: 'o1p2', en: 'expensive', cestaId: 'o1c2' },
        { id: 'o1p3', en: 'tall', cestaId: 'o1c3' },
      ],
    },
    {
      id: 'o2',
      cestas: [
        { id: 'o2c1', es: 'tranquilo' },
        { id: 'o2c2', es: 'simpático' },
        { id: 'o2c3', es: 'lleno de gente' },
        { id: 'o2c4', es: 'barrio' },
      ],
      palabras: [
        { id: 'o2p1', en: 'quiet', cestaId: 'o2c1' },
        { id: 'o2p2', en: 'friendly', cestaId: 'o2c2' },
        { id: 'o2p3', en: 'crowded', cestaId: 'o2c3' },
      ],
    },
  ],
};

/**
 * El final de la caída, a mano.
 *
 * jsdom no anima nada y tampoco trae `AnimationEvent`, así que el aviso de que
 * una palabra tocó el suelo hay que darlo desde aquí. Lo que se comprueba no es
 * que CSS funcione —eso se mira jugando— sino lo que pasa DESPUÉS de tocarlo.
 */
function tocarElSuelo(palabra: HTMLElement) {
  const cayendo = palabra.closest('div[style*="lluvia-caer"]')!;
  fireEvent.animationEnd(cayendo, { animationName: 'lluvia-caer', bubbles: true });
}

/** Con o sin movimiento, que es lo que decide a qué juego se está jugando. */
function conMovimiento(quieto: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: quieto && consulta.includes('reduced-motion'),
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function renderizar() {
  const onFin = vi.fn();
  const onSalir = vi.fn();
  const onResponder = vi.fn((_id: string, _respuesta: string) =>
    Promise.resolve({ isCorrect: true }),
  );

  render(
    <Lluvia
      ronda={RONDA}
      onResponder={(id, respuesta) => onResponder(id, respuesta)}
      onFin={onFin}
      onSalir={onSalir}
    />,
  );

  return { onFin, onSalir, onResponder };
}

const cesta = (texto: string) =>
  screen.getByRole('button', { name: new RegExp(`Cesta \\d: ${texto}$`) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Lluvia, la versión que se mueve', () => {
  beforeEach(() => conMovimiento(false));

  it('la primera palabra tarda en salir: antes hay que poder leer las cestas', async () => {
    renderizar();

    // Las cuatro cestas están desde el principio; la palabra todavía no.
    expect(screen.getAllByRole('button', { name: /^Cesta/ })).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /cayendo/ })).not.toBeInTheDocument();

    expect(
      await screen.findByRole('button', { name: 'cheap, cayendo' }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it('tocar la cesta buena apunta la caída en el servidor y sube los puntos', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await screen.findByRole('button', { name: 'cheap, cayendo' }, { timeout: 4000 });
    await usuario.click(cesta('barato'));

    // El aviso al servidor va en cola, o sea en un microtarea: por eso se
    // espera en vez de comprobarlo a bocajarro.
    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('o1p1', 'o1c1'));

    /*
      Diez por acierto más la racha al cuadrado por dos, que es exactamente la
      cuenta de `puntos.ts` y la que hará el servidor al cerrar. Si este número
      y el de la pantalla final no coincidieran, el juego se leería como una
      estafa, que es el motivo de que esta comprobación exista.
    */
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
  });

  it('la cesta equivocada enseña lo que significaba y no cuesta vida', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    const palabra = await screen.findByRole(
      'button',
      { name: 'cheap, cayendo' },
      { timeout: 4000 },
    );
    await usuario.click(cesta('caro'));

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('o1p1', 'o1c2'));
    // La traducción aparece en la propia palabra: es el único rato en el que se
    // aprende la que no te sabías.
    expect(within(palabra).getByText('barato')).toBeInTheDocument();
    // Y las tres vidas siguen puestas. Equivocarse rompe la racha y ya.
    expect(screen.getByText('3 vidas de 3')).toBeInTheDocument();
  });

  it('se puede jugar entero con el teclado, del 1 al 4', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await screen.findByRole('button', { name: 'cheap, cayendo' }, { timeout: 4000 });
    await usuario.keyboard('1');

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('o1p1', 'o1c1'));
  });

  it('lo que llega al suelo también se le cuenta al servidor, y cuesta vida', async () => {
    const { onResponder } = renderizar();

    const palabra = await screen.findByRole(
      'button',
      { name: 'cheap, cayendo' },
      { timeout: 4000 },
    );

    // Sin este aviso, la racha del servidor no se rompería jamás y pagaría un
    // bono al cuadrado de una partida que no existió.
    tocarElSuelo(palabra);

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('o1p1', 'suelo'));
    await waitFor(() => expect(screen.getByText('2 vidas de 3')).toBeInTheDocument());
  });

  /*
    La que ya nos mordió en otro juego: cerrar la partida antes de que el
    servidor tenga todas las respuestas hace que la puntuación final salga más
    baja que la que se acaba de ver subir.
  */
  it('no cierra la partida hasta que el servidor tiene la última caída', async () => {
    const usuario = userEvent.setup();

    // El servidor no contesta hasta que esta prueba lo diga.
    const enEspera: Array<() => void> = [];
    const onFin = vi.fn();
    const onResponder = vi.fn(
      (_id: string, _respuesta: string) =>
        new Promise<{ isCorrect: boolean }>((resolver) => {
          enEspera.push(() => resolver({ isCorrect: true }));
        }),
    );

    render(
      <Lluvia
        ronda={{ ...RONDA, olas: [RONDA.olas[0]!], vidas: 1 }}
        onResponder={(id, respuesta) => onResponder(id, respuesta)}
        onFin={onFin}
        onSalir={vi.fn()}
      />,
    );

    await screen.findByRole('button', { name: 'cheap, cayendo' }, { timeout: 4000 });
    await usuario.click(cesta('barato'));

    // Con una sola vida, dejar caer la siguiente acaba la partida.
    const segunda = await screen.findByRole(
      'button',
      { name: 'expensive, cayendo' },
      { timeout: 4000 },
    );
    tocarElSuelo(segunda);

    await new Promise((r) => setTimeout(r, 1800));
    // Las dos caídas están en cola y ninguna ha llegado: la partida no puede
    // cerrarse todavía.
    expect(enEspera.length).toBeGreaterThan(0);
    expect(onFin).not.toHaveBeenCalled();

    // Y en cuanto el servidor las acepta, se cierra.
    await waitFor(async () => {
      while (enEspera.length) enEspera.shift()!();
      await Promise.resolve();
      expect(onFin).toHaveBeenCalled();
    });
  }, 15000);
});

describe('Lluvia, por turnos', () => {
  beforeEach(() => conMovimiento(true));

  it('quien pide menos movimiento juega igual, sin que caiga nada', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    // Nada cayendo, y la palabra a la vista desde el primer momento.
    expect(screen.queryByRole('button', { name: /cayendo/ })).not.toBeInTheDocument();
    expect(screen.getByText('cheap')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Cesta/ })).toHaveLength(4);

    await usuario.click(cesta('barato'));

    expect(onResponder).toHaveBeenCalledWith('o1p1', 'o1c1');
    expect(screen.getByText('¡A la cesta!')).toBeInTheDocument();
  });

  it('se avanza a mano, que es lo contrario de un temporizador', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(cesta('barato'));
    // Nada se mueve solo: la siguiente palabra espera a que se pida.
    expect(screen.getByText('cheap')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'SIGUIENTE' }));
    expect(screen.getByText('expensive')).toBeInTheDocument();
  });

  it('aquí el fallo sí cuesta vida, porque no hay suelo que lo cobre', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(cesta('caro'));

    expect(screen.getByText('Era: barato')).toBeInTheDocument();
    expect(screen.getByText('2 vidas de 3')).toBeInTheDocument();
  });

  it('con las tres vidas gastadas se cierra la partida', async () => {
    const usuario = userEvent.setup();
    const { onFin } = renderizar();

    await usuario.click(cesta('caro'));
    await usuario.click(screen.getByRole('button', { name: 'SIGUIENTE' }));
    await usuario.click(cesta('barato'));
    await usuario.click(screen.getByRole('button', { name: 'SIGUIENTE' }));
    await usuario.click(cesta('barato'));

    await waitFor(() => expect(onFin).toHaveBeenCalled());
    expect(onFin.mock.calls[0]![0]).toMatchObject({ aciertos: 0, total: 3 });
  });
});
