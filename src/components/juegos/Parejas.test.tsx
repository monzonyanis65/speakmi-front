import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Parejas } from './Parejas';

const RONDA = {
  code: 'PAREJAS',
  parejas: [
    { id: 'p1', en: 'cat', es: 'gato' },
    { id: 'p2', en: 'dog', es: 'perro' },
  ],
};

function renderizar(extra: Partial<Parameters<typeof Parejas>[0]> = {}) {
  const onFin = vi.fn();
  const onResponder = vi.fn();
  const onSalir = vi.fn();

  render(
    <Parejas ronda={RONDA} onResponder={onResponder} onFin={onFin} onSalir={onSalir} {...extra} />,
  );

  return { onFin, onResponder, onSalir };
}

describe('Parejas', () => {
  it('marca la pareja buena en el acto, sin esperar al servidor', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.click(screen.getByRole('button', { name: 'cat' }));
    await usuario.click(screen.getByRole('button', { name: 'gato' }));

    // Las dos mitades quedan hechas y ya no se pueden volver a tocar.
    expect(screen.getByRole('button', { name: /cat/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /gato/ })).toBeDisabled();

    // Al servidor se le avisa, pero la pantalla no lo esperó para pintarlo.
    expect(onResponder).toHaveBeenCalledWith('p1', 'gato');
  });

  it('una pareja mal no se queda hecha', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.click(screen.getByRole('button', { name: 'cat' }));
    await usuario.click(screen.getByRole('button', { name: 'perro' }));

    // Las dos vuelven a estar libres: el fallo se deshace solo y no hay que
    // tocar otra vez para quitarlo.
    await waitFor(() => expect(screen.getByRole('button', { name: 'cat' })).not.toBeDisabled());
    expect(screen.getByRole('button', { name: 'perro' })).not.toBeDisabled();
    expect(onResponder).not.toHaveBeenCalled();
  });

  it('al juntarlas todas termina la partida con su puntuación', async () => {
    const usuario = userEvent.setup();
    const { onFin } = renderizar();

    await usuario.click(screen.getByRole('button', { name: 'cat' }));
    await usuario.click(screen.getByRole('button', { name: 'gato' }));
    await usuario.click(screen.getByRole('button', { name: 'dog' }));
    await usuario.click(screen.getByRole('button', { name: 'perro' }));

    await waitFor(() => expect(onFin).toHaveBeenCalled());

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
