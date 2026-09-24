import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Parejas } from './Parejas';

/*
  El tablero se baraja, así que aquí se le quita el azar.

  Con `Math.random()` siempre en 0, el barajado es una permutación conocida y
  las cartas caen en un sitio fijo. Sin esto no habría forma de escribir «toca la
  carta de apple» sin ir levantándolas todas primero, que es justo lo que la
  prueba no puede hacer: levantar una carta ES parte del juego.
*/
function sinAzar() {
  vi.spyOn(Math, 'random').mockReturnValue(0);
}

/*
  Dos palabras de verdad del curso, y elegidas a propósito: `apple` tiene dibujo
  y `yesterday` no. Así la prueba cubre las cartas con emoji y el respaldo de las
  que se quedan sin él en la misma partida.
*/
const RONDA = {
  code: 'PAREJAS',
  parejas: [
    { id: 'p1', en: 'apple', es: 'manzana' },
    { id: 'p2', en: 'yesterday', es: 'ayer' },
  ],
};

/** Con `Math.random()` en 0 el tablero queda así, por sitios. */
const SITIO = { manzana: 0, yesterday: 1, ayer: 2, apple: 3 } as const;

function tablero() {
  return within(screen.getByRole('list')).getAllByRole('button');
}

function carta(cual: keyof typeof SITIO) {
  return tablero()[SITIO[cual]]!;
}

function renderizar(extra: Partial<Parameters<typeof Parejas>[0]> = {}) {
  const onFin = vi.fn();
  const onResponder = vi.fn();
  const onSalir = vi.fn();

  render(
    <Parejas ronda={RONDA} onResponder={onResponder} onFin={onFin} onSalir={onSalir} {...extra} />,
  );

  return { onFin, onResponder, onSalir };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Parejas', () => {
  it('una carta boca abajo dice lo que es, y al levantarla enseña la palabra', async () => {
    sinAzar();
    const usuario = userEvent.setup();
    renderizar();

    // Boca abajo no hay nada que leer: el nombre lo tiene que poner la carta.
    expect(carta('apple')).toHaveAccessibleName('Carta 4, boca abajo, inglés');
    expect(carta('manzana')).toHaveAccessibleName('Carta 1, boca abajo, español');

    await usuario.click(carta('apple'));

    expect(carta('apple')).toHaveAccessibleName('apple');
    // El dibujo llega con la palabra, no antes: es lo que hace memorable el sitio.
    expect(screen.getByText('🍎')).toBeInTheDocument();
  });

  it('la palabra sin dibujo se levanta igual, con su letra y sin invento', async () => {
    sinAzar();
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(carta('yesterday'));

    expect(carta('yesterday')).toHaveAccessibleName('yesterday');
    // Nada de un emoji de relleno donde no había uno que no mintiera.
    expect(within(carta('yesterday')).getByText('yesterday')).toBeInTheDocument();
  });

  it('marca la pareja buena en el acto, sin esperar al servidor', async () => {
    sinAzar();
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.click(carta('apple'));
    await usuario.click(carta('manzana'));

    // Las dos se quedan puestas y ya no se pueden volver a tocar.
    expect(carta('apple')).toBeDisabled();
    expect(carta('manzana')).toBeDisabled();
    expect(carta('apple')).toHaveAccessibleName(/apple.*pareja hecha/);

    // Al servidor se le avisa, pero la pantalla no lo esperó para pintarlo.
    expect(onResponder).toHaveBeenCalledWith('p1', 'manzana');
  });

  it('las dos que no eran pareja se dan la vuelta solas', async () => {
    sinAzar();
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.click(carta('apple'));
    await usuario.click(carta('ayer'));

    // Un momento arriba para poder leerlas, y abajo otra vez sin tocar nada.
    expect(carta('apple')).toHaveAccessibleName('apple');

    await waitFor(
      () => expect(carta('apple')).toHaveAccessibleName('Carta 4, boca abajo, inglés'),
      { timeout: 3000 },
    );
    expect(carta('ayer')).toHaveAccessibleName('Carta 3, boca abajo, español');
    expect(onResponder).not.toHaveBeenCalled();
  });

  it('dos del mismo lado no son un fallo: cambia la carta levantada', async () => {
    sinAzar();
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(carta('apple'));
    await usuario.click(carta('yesterday'));

    expect(carta('yesterday')).toHaveAccessibleName('yesterday');
    expect(carta('apple')).toHaveAccessibleName('Carta 4, boca abajo, inglés');
  });

  it('al juntarlas todas termina la partida con su puntuación', async () => {
    sinAzar();
    const usuario = userEvent.setup();
    const { onFin } = renderizar();

    await usuario.click(carta('apple'));
    await usuario.click(carta('manzana'));
    await usuario.click(carta('yesterday'));
    await usuario.click(carta('ayer'));

    await waitFor(() => expect(onFin).toHaveBeenCalled(), { timeout: 3000 });

    const marcador = onFin.mock.calls[0]?.[0] as {
      aciertos: number;
      total: number;
      puntuacion: number;
    };
    expect(marcador.aciertos).toBe(2);
    expect(marcador.total).toBe(2);
    // Veinte de las parejas más lo que quede de bonus por tiempo, que nunca
    // resta. La puntuación que vale es la que cierre el servidor.
    expect(marcador.puntuacion).toBeGreaterThanOrEqual(20);
  });
});
