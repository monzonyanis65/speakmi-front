import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Particulas } from './Particulas';
import type { RondaDeParticulas } from './tipos';

/**
 * LA PARTÍCULA.
 *
 * Lo que se prueba aquí son las cuatro cosas que, si se rompen, rompen el juego
 * sin que se note jugando una partida:
 *
 *   1. Que al fallar se enseñe el compuesto bueno con su significado. Ese medio
 *      segundo ES el juego; sin él esto es un test de opción múltiple.
 *   2. Que quedarse sin tiempo se MANDE al servidor. Si se callara, la racha
 *      del servidor no se rompería nunca y pagaría el bono al cuadrado de una
 *      partida en la que se dejaron pasar las difíciles sin tocar nada.
 *   3. Que la puntuación que se enseña en vivo sea la misma que va a cerrar el
 *      servidor. Ver subir 118 y que al acabar ponga 60 se lee como una estafa.
 *   4. Que se pueda jugar con el teclado. Tabular entre seis botones en tres
 *      segundos no es jugar.
 */

/** Un reloj largo: en las pruebas que no van del reloj, que no venza. */
const RELOJ_LARGO = { lecturaMs: 10_000, barraMs: 60_000 };

function rondaDe(reloj = RELOJ_LARGO): RondaDeParticulas {
  // La pausa de lectura va en CADA situación, así que la del reloj se reparte a
  // todas: si no, una prueba que acorta el reloj no acortaría nada.
  const lecturaMs = reloj.lecturaMs;
  return {
    code: 'PARTICULAS',
    reloj,
    rondas: [
      {
        id: 'p1',
        verbo: 'look',
        situacionEs: 'Tus vecinos se van y te dejan el gato.',
        particulas: ['for', 'after', 'up', 'out', 'into', 'over'],
        correcta: 'after',
        compuesto: 'look after',
        significadoEs: 'cuidar de alguien o de algo',
        ejemploEn: 'Can you look after my cat?',
        separable: false,
        nivel: 'A2',
        lecturaMs,
      },
      {
        id: 'p2',
        verbo: 'give',
        situacionEs: 'Llevas media hora con el crucigrama.',
        particulas: ['in', 'up', 'back', 'away', 'out', 'off'],
        correcta: 'up',
        compuesto: 'give up',
        significadoEs: 'rendirse',
        ejemploEn: "Don't give up.",
        separable: false,
        nivel: 'A2',
        lecturaMs,
      },
    ],
  };
}

function renderizar(ronda = rondaDe()) {
  const onFin = vi.fn();
  const onSalir = vi.fn();
  const onResponder = vi.fn((_id: string, _respuesta: string) =>
    Promise.resolve({ isCorrect: true }),
  );

  render(
    <Particulas
      ronda={ronda}
      onResponder={(id: string, respuesta: string) => onResponder(id, respuesta)}
      onFin={onFin}
      onSalir={onSalir}
    />,
  );

  return { onFin, onSalir, onResponder };
}

describe('La partícula', () => {
  it('enseña el verbo del centro, la situación y las seis partículas', () => {
    renderizar();

    expect(screen.getByText('look')).toBeInTheDocument();
    expect(screen.getByText('Tus vecinos se van y te dejan el gato.')).toBeInTheDocument();
    for (const particula of ['for', 'after', 'up', 'out', 'into', 'over']) {
      expect(screen.getByRole('button', { name: new RegExp(`${particula}$`) })).toBeInTheDocument();
    }
  });

  it('al acertar lo dice y avisa al servidor de la partícula pulsada', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.click(screen.getByRole('button', { name: /after$/ }));

    expect(onResponder).toHaveBeenCalledWith('p1', 'after');
    expect(await screen.findByText('¡Esa!')).toBeInTheDocument();
    expect(screen.getByText('look after')).toBeInTheDocument();
  });

  /*
    La prueba del juego entero. Al fallar hay que ver el compuesto BUENO con su
    significado y una frase: lo que tiene que quedar es la asociación completa,
    no un «has fallado».
  */
  it('al fallar enseña cuál era el verbo compuesto y qué significa', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByRole('button', { name: /^1?up$/ }));

    expect(await screen.findByText('Esa no era')).toBeInTheDocument();
    expect(screen.getByText('look after')).toBeInTheDocument();
    expect(screen.getByText('= cuidar de alguien o de algo')).toBeInTheDocument();
    expect(screen.getByText('Can you look after my cat?')).toBeInTheDocument();
  });

  it('se juega con los números del 1 al 6, sin tocar la pantalla', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    // La primera del corro es `for`, que no es la buena.
    await usuario.keyboard('1');

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('p1', 'for'));
    expect(screen.getByText('Esa no era')).toBeInTheDocument();
  });

  /*
    Si la barra se vacía y no se dice nada, el servidor cree que esa ronda no se
    jugó: la racha no se rompe y el bono al cuadrado paga una partida que no
    existió.
  */
  it('quedarse sin tiempo se manda al servidor como una respuesta más', async () => {
    const { onResponder } = renderizar(rondaDe({ lecturaMs: 10, barraMs: 30 }));

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('p1', 'tiempo'));
    expect(screen.getByText('Se acabó el tiempo')).toBeInTheDocument();
    expect(screen.getByText('look after')).toBeInTheDocument();
  });

  it('la puntuación en vivo es la que va a cerrar el servidor', async () => {
    const usuario = userEvent.setup();
    const { onFin } = renderizar();

    await usuario.click(screen.getByRole('button', { name: /after$/ }));
    await usuario.click(await screen.findByRole('button', { name: 'SEGUIR' }));

    await usuario.click(await screen.findByRole('button', { name: /up$/ }));
    await usuario.click(await screen.findByRole('button', { name: 'SEGUIR' }));

    await waitFor(() => expect(onFin).toHaveBeenCalled());

    /*
      Dos aciertos seguidos: 2 × 10 de base más la racha al cuadrado por dos,
      que es exactamente `puntosDe` en el servidor. Si esta cuenta se desviara,
      el número de la partida y el de la pantalla final dejarían de cuadrar.
    */
    const marcador = onFin.mock.calls[0]?.[0] as { aciertos: number; puntuacion: number };
    expect(marcador.aciertos).toBe(2);
    expect(marcador.puntuacion).toBe(28);
  });

  it('no cierra la partida hasta que el servidor tiene la última respuesta', async () => {
    const usuario = userEvent.setup();
    const sueltas: Array<() => void> = [];
    const onFin = vi.fn();

    render(
      <Particulas
        ronda={rondaDe()}
        onResponder={(_id: string, _respuesta: string) =>
          new Promise((resolver) => {
            sueltas.push(() => resolver({ isCorrect: true }));
          })
        }
        onFin={onFin}
        onSalir={vi.fn()}
      />,
    );

    await usuario.click(screen.getByRole('button', { name: /after$/ }));
    await usuario.click(await screen.findByRole('button', { name: 'SEGUIR' }));
    await usuario.click(await screen.findByRole('button', { name: /up$/ }));
    await usuario.click(await screen.findByRole('button', { name: 'SEGUIR' }));

    expect(onFin).not.toHaveBeenCalled();

    /*
      Se sueltan según van llegando: la segunda respuesta no sale hasta que la
      primera ha vuelto, que es exactamente la fila india que se comprueba.
    */
    await waitFor(() => {
      for (const soltar of sueltas.splice(0)) soltar();
      expect(onFin).toHaveBeenCalled();
    });
  });

  /*
    Una ronda, una respuesta. Pulsar y que la barra se vacíe en el mismo
    fotograma mandaba la ronda dos veces: el servidor contestaba 409 pero el
    navegador ya había contado dos respuestas para una sola, y el marcador que
    se enseña dejaba de ser el que iba a cerrar la partida.
  */
  it('manda exactamente una respuesta por ronda', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.click(screen.getByRole('button', { name: /after$/ }));
    await usuario.keyboard('3');
    await usuario.click(await screen.findByRole('button', { name: 'SEGUIR' }));
    await usuario.click(await screen.findByRole('button', { name: /up$/ }));

    const ids = onResponder.mock.calls.map(([id]) => id);
    expect(ids).toEqual(['p1', 'p2']);
  });

  it('se puede salir a mitad de partida', async () => {
    const usuario = userEvent.setup();
    const { onSalir } = renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Salir del juego' }));
    expect(onSalir).toHaveBeenCalled();
  });
});
