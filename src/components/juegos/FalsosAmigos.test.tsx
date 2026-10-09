import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FalsosAmigos } from './FalsosAmigos';
import type { RondaDeFalsosAmigos } from './tipos';

/**
 * FALSOS_AMIGOS.
 *
 * El reloj se prueba SIN relojes falsos, y eso no es pereza: el juego no se
 * inventa la duración de la carta, se la manda el servidor en
 * `reloj.escalones`. Así que aquí se le mandan escalones cortos y el tiempo de
 * verdad hace el resto. De paso queda probado lo que importa —que el reloj sale
 * del servidor y no de un número escrito en el navegador— que es justo lo que
 * evita que la calibración se desincronice entre los dos lados.
 */

const RONDA: RondaDeFalsosAmigos = {
  code: 'FALSOS_AMIGOS',
  cartas: [
    {
      id: 'c1',
      en: 'exit',
      parece: 'éxito',
      real: 'salida',
      verdadera: false,
      porQue: 'El éxito es «success».',
    },
    {
      id: 'c2',
      en: 'emotion',
      parece: 'emoción',
      real: 'emoción',
      verdadera: true,
      porQue: 'Esta sí. La que engaña es «exciting».',
    },
    {
      id: 'c3',
      en: 'carpet',
      parece: 'carpeta',
      real: 'alfombra',
      verdadera: false,
      porQue: 'La carpeta es «folder».',
    },
  ],
  // Holgados: estas pruebas miden qué pasa al pulsar, no contra el reloj.
  reloj: { escalones: [5000, 5000, 5000, 5000], pasosAtrasAlFallar: 3 },
};

function renderizar(ronda: RondaDeFalsosAmigos = RONDA) {
  const onFin = vi.fn();
  const onSalir = vi.fn();
  const onResponder = vi.fn((_id: string, _respuesta: string) =>
    Promise.resolve({ isCorrect: true }),
  );

  render(
    <FalsosAmigos
      ronda={ronda}
      onResponder={(id: string, respuesta: string) => onResponder(id, respuesta)}
      onFin={onFin}
      onSalir={onSalir}
    />,
  );

  return { onFin, onSalir, onResponder };
}

const falso = () => screen.getByRole('button', { name: /^FALSO/ });
const verdadero = () => screen.getByRole('button', { name: /^VERDADERO/ });

describe('FalsosAmigos', () => {
  it('enseña la palabra y lo que parece que significa', () => {
    renderizar();

    expect(screen.getByText('exit')).toBeInTheDocument();
    expect(screen.getByText('éxito')).toBeInTheDocument();
    expect(falso()).toBeInTheDocument();
    expect(verdadero()).toBeInTheDocument();
  });

  it('esquivar la trampa suma y avisa al servidor de lo que se pulsó', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.click(falso());

    expect(onResponder).toHaveBeenCalledWith('c1', 'falso');
    expect(await screen.findByText(/Trampa esquivada/)).toBeInTheDocument();
    /*
      Doce: diez del acierto más el bono por encadenar (1² × 2). Es la misma
      cuenta que hará `puntosDe` en el servidor, y por eso está copiada en
      `puntos.ts`: ver subir un número que luego no cuadra con el final es lo
      que hace que un juego se sienta trucado.
    */
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  /*
    Lo que de verdad enseña este juego. Fallar sin ver la respuesta buena es
    fallar dos veces: una ahora y otra la próxima vez que salga la palabra.
  */
  it('al fallar enseña qué significaba de verdad y por qué', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(verdadero());

    expect(await screen.findByText(/Esa era la trampa/)).toBeInTheDocument();
    expect(screen.getByText(/«exit» es salida/)).toBeInTheDocument();
    expect(screen.getByText(/El éxito es «success»/)).toBeInTheDocument();
  });

  it('las flechas del teclado deciden, que es como se pidió', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.keyboard('{ArrowLeft}');
    expect(onResponder).toHaveBeenCalledWith('c1', 'falso');

    // Y la siguiente carta, que sí es verdadera, con la flecha derecha.
    await waitFor(() => expect(screen.getByText('emotion')).toBeInTheDocument());
    await usuario.keyboard('{ArrowRight}');
    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('c2', 'verdadero'));
  });

  /*
    Quedarse en blanco TIENE que llegar al servidor. Si no llegara, la racha del
    servidor no se rompería nunca y el bono al cuadrado pagaría una partida en la
    que se dejaron pasar las difíciles sin tocar nada.
  */
  it('quedarse sin tiempo cuenta como fallo y se le dice al servidor', async () => {
    const { onResponder } = renderizar({
      ...RONDA,
      reloj: { escalones: [60, 60, 60, 60], pasosAtrasAlFallar: 3 },
    });

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('c1', 'tiempo'));
    expect(await screen.findByText(/Se acabó el tiempo/)).toBeInTheDocument();
  });

  it('el reloj aprieta al encadenar y afloja al fallar', async () => {
    const usuario = userEvent.setup();
    /*
      Escalones exagerados para que se vea el salto: la primera carta dura tres
      segundos y la segunda, con un acierto encima, medio. Los números de
      verdad los calibra el servidor —de 4 s a 1,6 s, con suelo— y lo que se
      comprueba aquí es que el navegador se los cree en vez de inventárselos.
    */
    renderizar({
      ...RONDA,
      reloj: { escalones: [3000, 500, 500, 500], pasosAtrasAlFallar: 3 },
    });

    expect(screen.getByText('3.0s')).toBeInTheDocument();

    await usuario.click(falso());
    await waitFor(() => expect(screen.getByText('emotion')).toBeInTheDocument());
    // Medio segundo, o lo que quede de él: el reloj ya está corriendo.
    await waitFor(() => expect(screen.getByText(/^0\.[0-5]s$/)).toBeInTheDocument());
  });

  it('al acabar las cartas cierra la partida con lo que contó el servidor', async () => {
    const usuario = userEvent.setup();
    const { onFin } = renderizar();

    await usuario.click(falso());
    await waitFor(() => expect(screen.getByText('emotion')).toBeInTheDocument());
    await usuario.click(verdadero());
    await waitFor(() => expect(screen.getByText('carpet')).toBeInTheDocument());
    await usuario.click(falso());

    await waitFor(() => expect(onFin).toHaveBeenCalled(), { timeout: 4000 });

    const marcador = onFin.mock.calls[0]?.[0] as { aciertos: number; puntuacion: number };
    /*
      Tres aciertos son 30 de base más el bono por encadenar: 3² × 2 = 18. Es
      exactamente lo que calculará `puntosDe` en el servidor, que es lo único
      que importa de este número.
    */
    expect(marcador.aciertos).toBe(3);
    expect(marcador.puntuacion).toBe(48);
  });

  /*
    Aporrear la flecha mientras se lee el veredicto.

    Es lo que hace cualquiera en un juego de reflejos con cartas de segundo y
    medio, y antes de este arreglo rompía la partida de tres formas a la vez:

      · la misma carta se contestaba otra vez, así que el marcador subía por un
        acierto que el servidor ya había apuntado —y rechazaba con un 409—;
      · el total crecía sin que creciera el número de cartas, de modo que una
        ronda de veinte podía cerrarse diciendo «20/40»;
      · y lo peor: el reloj que pasa a la carta siguiente se rearma con cada
        veredicto nuevo, así que pulsando más rápido que la revelación el juego
        se quedaba clavado en la carta 1 de 20 para siempre, sin salida.

    Medido con el navegador de verdad: 436 pulsaciones, 402 respuestas con 409 y
    el contador quieto en «1/20».
  */
  it('insistir mientras se lee el veredicto no vuelve a contestar la carta', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    // Falla a propósito: la revelación del fallo es la larga, que es cuando da
    // tiempo de sobra a seguir pulsando.
    await usuario.keyboard('{ArrowRight}');
    expect(await screen.findByText(/Esa era la trampa/)).toBeInTheDocument();

    await usuario.keyboard('{ArrowRight}{ArrowLeft}{ArrowRight}{ArrowLeft}');

    expect(onResponder).toHaveBeenCalledTimes(1);
    // Y sigue siendo la primera carta, no una ronda de veinte convertida en una
    // de cuarenta.
    expect(screen.getByText('1')).toBeInTheDocument();

    // Pasada la revelación, la carta avanza: el juego no se quedó clavado.
    await waitFor(() => expect(screen.getByText('emotion')).toBeInTheDocument(), { timeout: 4000 });
  });

  it('se puede salir en cualquier momento', async () => {
    const usuario = userEvent.setup();
    const { onSalir } = renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Salir del juego' }));
    expect(onSalir).toHaveBeenCalled();
  });
});
