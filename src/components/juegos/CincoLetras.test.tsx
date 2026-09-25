import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CincoLetras } from './CincoLetras';
import type {
  EstadoLetra,
  IntentoCorregido,
  IntentoDeCincoLetras,
  RondaDeCincoLetras,
} from './tipos';

/**
 * Cinco letras, por fuera.
 *
 * Aquí NO se comprueba el color de las letras: eso lo decide el servidor y está
 * probado allí, que es justo el reparto que hace que el juego exista. Lo que se
 * comprueba aquí es lo otro:
 *
 *   - que la palabra no esté en ninguna parte mientras se juega;
 *   - que el color no viaje solo, sino con una marca y con palabras;
 *   - que se pueda jugar entero con el teclado físico;
 *   - y el caso de las letras repetidas donde SÍ decide la pantalla: una tecla
 *     que ya salió amarilla y luego verde tiene que quedarse verde.
 */

/** Una fila coloreada, escrita corto: `fila('APPLE', 'sonoo')`. */
function fila(palabra: string, colores: string): IntentoDeCincoLetras {
  const mapa: Record<string, EstadoLetra> = { s: 'sitio', o: 'otra', n: 'no' };
  return {
    palabra,
    letras: [...palabra].map((letra, i) => ({ letra, estado: mapa[colores[i]!]! })),
  };
}

const RONDA: RondaDeCincoLetras = {
  code: 'CINCO_LETRAS',
  dia: '2026-09-24',
  numero: 267,
  largo: 5,
  intentosMaximos: 6,
  intentos: [],
  estado: 'jugando',
  restantes: 6,
  cerrada: false,
  esDelDia: true,
};

function renderizar(ronda: Partial<RondaDeCincoLetras> = {}, respuestas: IntentoCorregido[] = []) {
  let siguiente = 0;
  const onIntentar = vi.fn((_palabra: string) => {
    const respuesta = respuestas[siguiente];
    siguiente += 1;
    return respuesta
      ? Promise.resolve(respuesta)
      : Promise.reject(new Error('sin respuesta preparada'));
  });
  const onTerminar = vi.fn(() =>
    Promise.resolve({ puntuacion: 50, mejorPuntuacion: 50, monedas: 6, recordNuevo: true }),
  );
  const onSalir = vi.fn();
  const onOtra = vi.fn();

  render(
    <CincoLetras
      ronda={{ ...RONDA, ...ronda }}
      onIntentar={onIntentar}
      onTerminar={onTerminar}
      onSalir={onSalir}
      onOtra={onOtra}
    />,
  );

  return { onIntentar, onTerminar, onSalir, onOtra };
}

/*
  Se juega con menos movimiento puesto.

  Dos motivos, y los dos buenos: el volteo escalonado tarda más de un segundo y
  dejaría cada prueba esperando, y sobre todo es el modo en el que el juego TIENE
  que seguir entendiéndose. Si las pruebas pasan aquí, pasan sin animación
  ninguna, que es el caso que más fácil se rompe.
*/
beforeEach(() => {
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

describe('Cinco letras', () => {
  it('enseña seis filas de cinco y el número del día', () => {
    renderizar();

    expect(screen.getByText(/#267/)).toBeInTheDocument();
    expect(screen.getByText('6 intentos')).toBeInTheDocument();
    // Las teclas de las 26 letras más ENVIAR y borrar.
    expect(screen.getByRole('button', { name: 'Enviar la palabra' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar la última letra' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Q' })).toBeInTheDocument();
  });

  it('se juega entero con el teclado físico', async () => {
    const usuario = userEvent.setup();
    const { onIntentar } = renderizar({}, [
      {
        isCorrect: false,
        letras: fila('CHAIR', 'nnonn').letras,
        estado: 'jugando',
        restantes: 5,
        intentos: [fila('CHAIR', 'nnonn')],
      },
    ]);

    await usuario.keyboard('chair');
    // Lo escrito se ve antes de enviarlo, sin color todavía.
    expect(screen.getByRole('img', { name: 'Casilla 1, C' })).toBeInTheDocument();

    await usuario.keyboard('{Backspace}');
    expect(screen.queryByRole('img', { name: 'Casilla 5, R' })).not.toBeInTheDocument();

    await usuario.keyboard('r{Enter}');

    await waitFor(() => expect(onIntentar).toHaveBeenCalledWith('CHAIR'));
    expect(await screen.findByRole('img', { name: 'A, en otro sitio' })).toBeInTheDocument();
  });

  /*
    Lo que hace que el color no sea la única señal.

    Cada casilla dice en palabras qué significa su color, y además hay una marca
    dibujada y una leyenda que la explica. Sin esto, este juego —que es entero
    verde contra amarillo, el par que justamente no se distingue— no se puede
    jugar con la forma más común de daltonismo.
  */
  it('cada color va dicho también con palabras', async () => {
    const usuario = userEvent.setup();
    renderizar({}, [
      {
        isCorrect: false,
        letras: fila('APPLE', 'ossnn').letras,
        estado: 'jugando',
        restantes: 5,
        intentos: [fila('APPLE', 'ossnn')],
      },
    ]);

    await usuario.keyboard('apple{Enter}');

    expect(await screen.findByRole('img', { name: 'A, en otro sitio' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'P, en su sitio' })).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'E, no está' })).toBeInTheDocument();

    // Y la leyenda, que es lo que enseña a leer las marcas.
    expect(screen.getByText('en su sitio')).toBeInTheDocument();
    expect(screen.getByText('en otro sitio')).toBeInTheDocument();
    expect(screen.getByText('no está')).toBeInTheDocument();
  });

  /*
    EL CASO DE LAS LETRAS REPETIDAS, por el lado de la pantalla.

    El reparto de colores lo hace el servidor. Lo que decide el navegador es el
    teclado, y ahí la misma letra puede llegar de dos colores distintos en dos
    intentos: la E sale amarilla en el primero y verde en el segundo. La tecla
    se queda con el mejor.

    Si se quedara con el último, la tecla volvería de verde a amarillo y estaría
    diciendo que la letra ya no está donde acabas de encontrarla, que es
    exactamente la información que se usa para deducir la palabra.
  */
  it('una tecla no retrocede de verde a amarillo', async () => {
    const usuario = userEvent.setup();
    renderizar({}, [
      {
        isCorrect: false,
        letras: fila('TEACH', 'nonnn').letras,
        estado: 'jugando',
        restantes: 5,
        intentos: [fila('TEACH', 'nonnn')],
      },
      {
        isCorrect: false,
        letras: fila('SPELL', 'nnsnn').letras,
        estado: 'jugando',
        restantes: 4,
        intentos: [fila('TEACH', 'nonnn'), fila('SPELL', 'nnsnn')],
      },
      {
        isCorrect: false,
        letras: fila('QUIET', 'nnnon').letras,
        estado: 'jugando',
        restantes: 3,
        intentos: [fila('TEACH', 'nonnn'), fila('SPELL', 'nnsnn'), fila('QUIET', 'nnnon')],
      },
    ]);

    await usuario.keyboard('teach{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'E, en otro sitio' })).toBeInTheDocument(),
    );

    await usuario.keyboard('spell{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'E, en su sitio' })).toBeInTheDocument(),
    );

    // Y una tercera vez amarilla no la hace bajar.
    await usuario.keyboard('quiet{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'T, no está' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'E, en su sitio' })).toBeInTheDocument();
  });

  it('con menos de cinco letras no se manda nada y se dice por qué', async () => {
    const usuario = userEvent.setup();
    const { onIntentar } = renderizar();

    await usuario.keyboard('cat{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Faltan letras');
    expect(onIntentar).not.toHaveBeenCalled();
  });

  it('si el envío falla no se gasta el intento y lo escrito sigue ahí', async () => {
    const usuario = userEvent.setup();
    const { onIntentar } = renderizar();

    await usuario.keyboard('chair{Enter}');

    await waitFor(() => expect(onIntentar).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Las letras no se han perdido: se puede volver a mandar sin reescribirlas.
    expect(screen.getByRole('img', { name: 'Casilla 1, C' })).toBeInTheDocument();
  });

  it('al acertar enseña la palabra, cierra la partida y ofrece compartir', async () => {
    const usuario = userEvent.setup();
    const { onTerminar } = renderizar({}, [
      {
        isCorrect: false,
        letras: fila('CHAIR', 'nnnnn').letras,
        estado: 'jugando',
        restantes: 5,
        intentos: [fila('CHAIR', 'nnnnn')],
      },
      {
        isCorrect: true,
        letras: fila('APPLE', 'sssss').letras,
        estado: 'ganada',
        restantes: 4,
        intentos: [fila('CHAIR', 'nnnnn'), fila('APPLE', 'sssss')],
        palabra: 'APPLE',
      },
    ]);

    await usuario.keyboard('chair{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'C, no está' })).toBeInTheDocument(),
    );

    await usuario.keyboard('apple{Enter}');

    expect(await screen.findByText('APPLE')).toBeInTheDocument();
    // Dos intentos son cincuenta puntos, la misma cuenta que hace el servidor.
    await waitFor(() =>
      expect(onTerminar).toHaveBeenCalledWith({ puntuacion: 50, aciertos: 1, total: 2 }),
    );

    expect(await screen.findByText('+6')).toBeInTheDocument();
    // Y ya no se puede seguir escribiendo.
    expect(screen.queryByRole('button', { name: 'Enviar la palabra' })).not.toBeInTheDocument();
  });

  /*
    Los cuadraditos son lo que se enseña a quien todavía no ha jugado, así que no
    pueden llevar ni una letra de la palabra. Es literalmente la razón de que el
    original se comparta y no destripe nada.
  */
  it('los cuadraditos cuentan cómo fue sin decir cuál era', async () => {
    renderizar({
      intentos: [fila('CHAIR', 'nnonn'), fila('APPLE', 'sssss')],
      estado: 'ganada',
      restantes: 4,
      cerrada: true,
      palabra: 'APPLE',
    });

    const cuadraditos = await screen.findByLabelText('Tu resultado en cuadraditos, para compartir');

    expect(cuadraditos).toHaveTextContent('🟩🟩🟩🟩🟩');
    expect(cuadraditos.textContent).not.toMatch(/[A-Z]/);
  });

  it('acabada la del día se puede pedir otra palabra, no «vuelve mañana»', async () => {
    const usuario = userEvent.setup();
    const { onOtra } = renderizar({
      intentos: [fila('APPLE', 'sssss')],
      estado: 'ganada',
      restantes: 5,
      cerrada: true,
      palabra: 'APPLE',
    });

    expect(await screen.findByText('¡A la primera!')).toBeInTheDocument();
    // El teclado desaparece: ESTA partida se acabó.
    expect(screen.queryByRole('button', { name: 'Q' })).not.toBeInTheDocument();
    // Pero el juego no. Antes aquí solo se podía salir.
    await usuario.click(screen.getByRole('button', { name: 'OTRA PALABRA' }));
    expect(onOtra).toHaveBeenCalled();
  });

  it('una palabra extra no se comparte, porque cada cual tuvo la suya', async () => {
    renderizar({
      esDelDia: false,
      intentos: [fila('APPLE', 'sssss')],
      estado: 'ganada',
      restantes: 5,
      cerrada: true,
      palabra: 'APPLE',
    });

    expect(await screen.findByText('¡A la primera!')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Tu resultado en cuadraditos, para compartir'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /COMPARTIR/ })).not.toBeInTheDocument();
    // Y sigue habiendo por dónde seguir.
    expect(screen.getByRole('button', { name: 'OTRA PALABRA' })).toBeInTheDocument();
  });

  it('al perder también se enseña cuál era', async () => {
    renderizar({
      intentos: [
        fila('CHAIR', 'nnnnn'),
        fila('QUIET', 'nnnnn'),
        fila('NURSE', 'nnnnn'),
        fila('WHITE', 'nnnnn'),
        fila('SPICY', 'nnnnn'),
        fila('DRUMS', 'nnnnn'),
      ],
      estado: 'perdida',
      restantes: 0,
      cerrada: false,
      palabra: 'APPLE',
    });

    expect(await screen.findByText('Hoy no salió')).toBeInTheDocument();
    expect(screen.getByText('APPLE')).toBeInTheDocument();
    expect(screen.getByText('X/6')).toBeInTheDocument();
  });

  it('mientras se juega, la palabra no está en ninguna parte de la pantalla', async () => {
    const usuario = userEvent.setup();
    const { container } = render(
      <CincoLetras
        ronda={{ ...RONDA, intentos: [fila('CHAIR', 'nnonn')], restantes: 5 }}
        onIntentar={() => Promise.reject(new Error('no'))}
        onTerminar={() =>
          Promise.resolve({ puntuacion: 0, mejorPuntuacion: 0, monedas: 0, recordNuevo: false })
        }
        onSalir={() => undefined}
        onOtra={() => undefined}
      />,
    );

    await usuario.keyboard('a');

    // Lo único en inglés que puede haber en pantalla es lo que se ha escrito.
    expect(container.textContent).not.toContain('APPLE');
    expect(screen.queryByText(/La palabra era/)).not.toBeInTheDocument();
  });
});
