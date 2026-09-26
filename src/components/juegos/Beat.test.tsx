import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Beat } from './Beat';
import type { Marcador, RondaDeBeat } from './tipos';

/**
 * AL COMPÁS.
 *
 * Lo que se prueba aquí son las cosas que, si se rompen, rompen el juego sin
 * que se note jugando una partida:
 *
 *   1. Que la tecla apunte a la PASTILLA del grupo y no a una posición fija.
 *      En el compás de oído las tres pastillas cambian en cada grupo; con una
 *      posición fija, la J acertaría o fallaría por motivos que no tienen nada
 *      que ver con lo que se oyó.
 *   2. Que aporrear las tres teclas dentro de la ventana no valga. Es la trampa
 *      obvia de un juego de tres teclas, y si funcionara no habría juego.
 *   3. Que una nota que pasa de largo SE MANDE al servidor. Si se callara, la
 *      racha del servidor no se rompería nunca y el bono al cuadrado —que aquí
 *      es el multiplicador de la fiebre— pagaría una partida en la que se dejó
 *      pasar la mitad de las notas sin tocar nada.
 *   4. Que la puntuación que se enseña en vivo sea EXACTAMENTE la que va a
 *      cerrar el servidor, multiplicador de fiebre incluido. Aquí ya hubo un
 *      juego que enseñaba puntos que el servidor no pagaba.
 *   5. Que sin voz inglesa el juego no se cierre: solo se cae la mitad.
 *
 * El tiempo va con relojes de mentira. En jsdom no hay `AudioContext`, así que
 * el juego se cae —a propósito— al reloj del sistema, que es el mismo camino
 * que sigue un teléfono con el sonido apagado o con `prefers-reduced-motion`.
 * O sea que estas pruebas recorren exactamente el modo sin sonido.
 */

const COMPAS = {
  msPorPulso: 600,
  msEntreNotas: 1200,
  msDeAnticipacion: 2400,
  msVentana: 400,
  msVentanaPerfecta: 120,
  pulsosDeCortesia: 8,
  pulsosTotales: 20,
  // Dos, para que la fiebre se pueda encender dentro de una prueba corta.
  rachaDeFiebre: 2,
};

/** El instante en el que se oye la nota del pulso `n`, en milisegundos. */
function instante(pulso: number): number {
  // El cuarto de segundo de respiro que `empezar` se da antes del pulso cero.
  return 250 + pulso * COMPAS.msPorPulso;
}

function rondaDe(): RondaDeBeat {
  return {
    code: 'BEAT',
    compas: COMPAS,
    frase: [
      {
        id: 'g1',
        modo: 'frase',
        nivel: 'A2',
        fraseEs: 'mi hermana estudia inglés',
        fraseEn: 'my sister studies English',
        ensena: 'Los idiomas van con mayúscula en inglés.',
        pastillas: [
          { id: 'quien', etiqueta: 'QUIÉN', pista: 'el sujeto' },
          { id: 'accion', etiqueta: 'ACCIÓN', pista: 'verbo entero' },
          { id: 'que', etiqueta: 'QUÉ', pista: 'lo demás' },
        ],
        notas: [
          { id: '1-1', pulso: 8, texto: 'my sister', pastillaId: 'quien' },
          { id: '1-2', pulso: 10, texto: 'studies', pastillaId: 'accion' },
          { id: '1-3', pulso: 12, texto: 'English', pastillaId: 'que' },
        ],
      },
    ],
    oido: [
      {
        id: 'g1',
        modo: 'oido',
        nivel: 'A2',
        contraste: 'La i larga de «sheep» contra la corta de «ship».',
        ensena: 'La i larga de «sheep» contra la corta de «ship».',
        pastillas: [
          { id: 'cheap', etiqueta: 'cheap', pista: 'barato' },
          { id: 'sheep', etiqueta: 'sheep', pista: 'oveja' },
          { id: 'ship', etiqueta: 'ship', pista: 'barco' },
        ],
        notas: [
          { id: '1-1', pulso: 8, diceEn: 'sheep', pastillaId: 'sheep' },
          { id: '1-2', pulso: 10, diceEn: 'ship', pastillaId: 'ship' },
          { id: '1-3', pulso: 12, diceEn: 'cheap', pastillaId: 'cheap' },
        ],
      },
    ],
  };
}

function renderizar(ronda = rondaDe()) {
  const onFin = vi.fn<(marcador: Marcador) => void>();
  const onSalir = vi.fn();
  const onAjustes = vi.fn();
  const onResponder = vi.fn((_id: string, _respuesta: string) =>
    Promise.resolve({ isCorrect: true }),
  );

  render(
    <Beat
      ronda={ronda}
      onResponder={(id, respuesta) => onResponder(id, respuesta)}
      onFin={onFin}
      onSalir={onSalir}
      onAjustes={onAjustes}
    />,
  );

  return { onFin, onSalir, onAjustes, onResponder };
}

/** Empieza el compás que se lee, que es el que no necesita voz ninguna. */
function empezar() {
  fireEvent.click(screen.getByRole('button', { name: /Compás de frase/ }));
}

/**
 * Deja correr el reloj. Todo el juego cuelga de un `requestAnimationFrame`.
 *
 * El `act` es ASÍNCRONO a propósito, y aquí hay media hora de depuración
 * metida: las respuestas al servidor no se mandan en el acto, van en una cola
 * de promesas para que la canción no se pare a esperar a la red (`avisar`, en
 * el componente). Con un `act` síncrono, la cola no llega a vaciarse antes de
 * comprobar nada y el espía sale sin llamadas aunque el juego esté haciendo lo
 * correcto.
 */
async function correr(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function teclear(tecla: string) {
  await act(async () => {
    fireEvent.keyDown(window, { key: tecla });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('la entrada', () => {
  it('ofrece los dos compases y dice cuál se juega sin voz', async () => {
    renderizar();

    expect(screen.getByRole('button', { name: /Compás de frase/ })).toBeEnabled();
    expect(screen.getByText(/Sin voz y sin sonido también/)).toBeInTheDocument();
  });

  /*
    LA PRUEBA QUE SEPARA ESTE JUEGO DE «ESCUCHA».

    Sin voz inglesa, ESCUCHA no se puede jugar y se sale con un toque. Aquí solo
    se cae una de las dos formas de jugar, así que cerrar el juego entero sería
    echar a alguien que puede jugar a la mitad. En jsdom no hay sintetizador, o
    sea que esta es exactamente la situación de un móvil pelado.
  */
  it('sin voz inglesa deshabilita el compás de oído y deja jugar el otro', async () => {
    renderizar();

    expect(screen.getByRole('button', { name: /Compás de oído/ })).toBeDisabled();
    expect(screen.getByText(/no necesita ninguna voz/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compás de frase/ })).toBeEnabled();
  });

  it('dice con qué teclas se juega antes de empezar', async () => {
    renderizar();
    expect(screen.getByText(/Se juega con J, K y L/)).toBeInTheDocument();
  });
});

describe('tocando', () => {
  it('enseña la frase en español y las tres pastillas con su tecla', async () => {
    renderizar();
    empezar();
    await correr(100);

    expect(screen.getByText('mi hermana estudia inglés')).toBeInTheDocument();
    for (const [etiqueta, tecla] of [
      ['QUIÉN', 'J'],
      ['ACCIÓN', 'K'],
      ['QUÉ', 'L'],
    ] as const) {
      const pastilla = screen.getByRole('button', { name: new RegExp(etiqueta) });
      expect(pastilla).toHaveAttribute('aria-keyshortcuts', tecla);
    }
  });

  it('la nota sale a tiempo y su ventana se abre dentro del margen', async () => {
    renderizar();
    empezar();

    // Todavía falta: la ventana se abre 400 ms antes del pulso 8.
    await correr(instante(8) - COMPAS.msVentana - 100);
    expect(document.querySelector('[data-nota-abierta]')).toHaveAttribute('data-nota-abierta', '');

    await correr(200);
    expect(document.querySelector('[data-nota-abierta]')).toHaveAttribute(
      'data-nota-abierta',
      '1-1',
    );
  });

  it('manda al servidor la pastilla que se pulsó, no la posición de la tecla', async () => {
    const { onResponder } = renderizar();
    empezar();
    await correr(instante(8) - 100);

    // J es la primera pastilla del grupo, que aquí es «quien».
    await teclear('j');
    expect(onResponder).toHaveBeenCalledWith('1-1', 'quien');

    // Y K la segunda, «accion», en la nota siguiente.
    await correr(COMPAS.msEntreNotas);
    await teclear('k');
    expect(onResponder).toHaveBeenCalledWith('1-2', 'accion');
  });

  it('fuera de la ventana no cuenta nada', async () => {
    const { onResponder } = renderizar();
    empezar();

    // Un segundo antes de la nota: la ventana solo abre 400 ms antes.
    await correr(instante(8) - 1000);
    await teclear('j');
    expect(onResponder).not.toHaveBeenCalled();
  });

  /*
    LA TRAMPA QUE HABÍA QUE TAPAR.

    Tres teclas y una ventana de 800 ms: aporreando J, K y L seguidas, una de
    las tres es siempre la buena. Lo que lo impide es que la PRIMERA pulsación
    resuelva la nota, se acierte o no.
  */
  it('aporrear las tres teclas no cuela: manda la primera y se acabó', async () => {
    const { onResponder } = renderizar();
    empezar();
    await correr(instante(8) - 100);

    await teclear('l');
    await teclear('j');
    await teclear('k');

    expect(onResponder).toHaveBeenCalledTimes(1);
    expect(onResponder).toHaveBeenCalledWith('1-1', 'que');
  });

  /*
    Una nota que pasa de largo se manda igual. Si se callara, la racha del
    servidor no se rompería nunca.
  */
  it('una nota que se escapa se le dice al servidor y rompe la racha', async () => {
    const { onResponder } = renderizar();
    empezar();

    await correr(instante(8) - 100);
    await teclear('j');
    expect(onResponder).toHaveBeenCalledWith('1-1', 'quien');

    // Y ahora se deja pasar la siguiente sin tocar nada: hasta bastante después
    // de que su ventana se haya cerrado del todo.
    await correr(COMPAS.msEntreNotas + COMPAS.msVentana * 2);
    expect(onResponder).toHaveBeenCalledWith('1-2', 'nada');
  });
});

describe('la puntuación', () => {
  /*
    LA PRUEBA MÁS IMPORTANTE DEL ARCHIVO.

    La fórmula del servidor para este juego es `aciertos * 10 + racha² * 2` (ver
    `puntosDe` en el catálogo del back). Lo que se enseña mientras se juega y lo
    que se entrega al cerrar tienen que salir de ahí y de ningún otro sitio. Un
    número en vivo que luego no cuadra con el final se lee como una estafa, y ya
    pasó tres veces en esta casa.
  */
  it('lo que se ve subir es la fórmula del servidor, no otra cosa', async () => {
    renderizar();
    empezar();

    await correr(instante(8) - 100);
    await teclear('j');
    // Un acierto, racha 1: 1*10 + 1*2 = 12.
    expect(screen.getByText('12')).toBeInTheDocument();

    await correr(COMPAS.msEntreNotas);
    await teclear('k');
    // Dos aciertos, racha 2: 2*10 + 4*2 = 28.
    expect(screen.getByText('28')).toBeInTheDocument();
  });

  /*
    Y el multiplicador de la fiebre sale de esa MISMA resta.

    Con racha 2 y la fiebre encendida, la nota siguiente vale
    (3*10 + 3²*2) − (2*10 + 2²*2) = 48 − 28 = 20, o sea ×2. No hay ningún factor
    inventado encima: si lo hubiera, el servidor no lo pagaría.
  */
  it('el multiplicador de la fiebre es el que el servidor va a pagar', async () => {
    renderizar();
    empezar();

    await correr(instante(8) - 100);
    await teclear('j');
    await correr(COMPAS.msEntreNotas);
    await teclear('k');

    expect(screen.getByText('FIEBRE ×2')).toBeInTheDocument();
  });

  it('entrega al final el mismo número que estaba enseñando', async () => {
    const { onFin } = renderizar();
    empezar();

    await correr(instante(8) - 100);
    await teclear('j');
    await correr(COMPAS.msEntreNotas);
    await teclear('k');
    await correr(COMPAS.msEntreNotas);
    await teclear('l');

    // Lo que se ve antes de que se acabe la canción.
    expect(screen.getByText('48')).toBeInTheDocument();

    // Y ahora se deja acabar. La partida no se cierra hasta que ha llegado la
    // última respuesta, así que hay que dejar que la cola se vacíe.
    await correr(instante(COMPAS.pulsosTotales) + 1000);
    await act(async () => {});

    expect(onFin).toHaveBeenCalledWith({ puntuacion: 48, aciertos: 3, total: 3 });
  });
});
