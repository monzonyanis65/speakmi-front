import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JuegoDeEjercicios } from './JuegoDeEjercicios';
import type { RondaDeEjercicios } from './tipos';

function opcion(code: string, pregunta: string): RondaDeEjercicios['ejercicios'][number] {
  return {
    code,
    type: 'multiple_choice',
    difficulty: 2,
    prompt: {
      instruction_es: 'Elige la correcta',
      question: pregunta,
      options: [{ text: 'is' }, { text: 'are' }],
    },
  };
}

const RONDA: RondaDeEjercicios = {
  code: 'CADENA',
  segundos: 60,
  ejercicios: [opcion('e1', 'She ___ tall'), opcion('e2', 'They ___ here')],
};

function renderizar(
  modo: 'contrarreloj' | 'cadena',
  onResponder: (code: string, respuesta: unknown) => Promise<{ isCorrect: boolean }>,
) {
  const onFin = vi.fn();
  const onSalir = vi.fn();

  render(
    <JuegoDeEjercicios
      ronda={RONDA}
      modo={modo}
      onResponder={(code, respuesta) => onResponder(code, respuesta)}
      onFin={onFin}
      onSalir={onSalir}
    />,
  );

  return { onFin, onSalir };
}

describe('JuegoDeEjercicios', () => {
  it('los de un toque se mandan solos, sin botón de confirmar', async () => {
    const usuario = userEvent.setup();
    const responder = vi.fn(() => Promise.resolve({ isCorrect: true }));
    renderizar('contrarreloj', responder);

    await usuario.click(screen.getByRole('button', { name: /is/ }));

    await waitFor(() => expect(responder).toHaveBeenCalledWith('e1', 0));
    expect(screen.queryByRole('button', { name: 'RESPONDER' })).not.toBeInTheDocument();
  });

  it('la racha se ve crecer y los puntos son los que dará el servidor', async () => {
    const usuario = userEvent.setup();
    const responder = vi.fn(() => Promise.resolve({ isCorrect: true }));
    const { onFin } = renderizar('contrarreloj', responder);

    await usuario.click(screen.getByRole('button', { name: /is/ }));
    expect(await screen.findByText('¡Bien!')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'SEGUIR' }));
    await usuario.click(await screen.findByRole('button', { name: /is/ }));
    expect(await screen.findByText('¡Bien! 2 seguidas')).toBeInTheDocument();
    expect(screen.getByText('2 seguidas')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'SEGUIR' }));
    await waitFor(() => expect(onFin).toHaveBeenCalled());
    /*
      Veinte, diez por acierto: la misma cuenta que hace `puntosDe` en el
      servidor. Aquí ponía treinta, con un bonus de racha que solo existía en el
      navegador; eso es justo lo que hacía que la pantalla final dijera otra
      cosa.
    */
    expect(onFin.mock.calls[0]?.[0]).toMatchObject({ puntuacion: 28, aciertos: 2, total: 2 });
  });

  /*
    En cadena la escalera es de verdad: el acierto número n sube el marcador
    10n-5, igual que `puntosDe` allí. Se comprueba junto al cartel de «la
    siguiente vale +X», porque es una promesa que hay que cumplir.
  */
  it('en cadena promete lo que vale el siguiente acierto, y lo paga', async () => {
    const usuario = userEvent.setup();
    const responder = vi.fn(() => Promise.resolve({ isCorrect: true }));
    const { onFin } = renderizar('cadena', responder);

    expect(await screen.findByText('la siguiente vale +5')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /is/ }));
    await usuario.click(await screen.findByRole('button', { name: 'SEGUIR' }));
    expect(await screen.findByText('la siguiente vale +15')).toBeInTheDocument();

    await usuario.click(await screen.findByRole('button', { name: /is/ }));
    await usuario.click(await screen.findByRole('button', { name: 'SEGUIR' }));

    await waitFor(() => expect(onFin).toHaveBeenCalled());
    // 5 + 15 = 20, que es 2² × 5. CADENA no lleva el bono de racha de los otros
    // dos juegos: su puntuación ENTERA ya es la racha al cuadrado.
    expect(onFin.mock.calls[0]?.[0]).toMatchObject({ puntuacion: 20, aciertos: 2 });
  });

  it('en cadena, el primer fallo acaba la partida', async () => {
    const usuario = userEvent.setup();
    const responder = vi.fn(() => Promise.resolve({ isCorrect: false }));
    const { onFin } = renderizar('cadena', responder);

    await usuario.click(screen.getByRole('button', { name: /is/ }));

    expect(await screen.findByText('Se rompió la cadena')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'VER RESULTADO' }));

    await waitFor(() => expect(onFin).toHaveBeenCalled());
    expect(onFin.mock.calls[0]?.[0]).toMatchObject({ puntuacion: 0, aciertos: 0, total: 1 });
  });

  /*
    Mientras el servidor de juegos no exista, esto es lo que pasa siempre. Que se
    caiga la corrección no puede tirar la partida ni dejar la pantalla muda.
  */
  it('si no se puede corregir, lo dice en voz alta y deja seguir', async () => {
    const usuario = userEvent.setup();
    const responder = vi.fn(() => Promise.reject(new Error('sin servidor')));
    renderizar('contrarreloj', responder);

    await usuario.click(screen.getByRole('button', { name: /is/ }));

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/No pudimos corregir/);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Saltar' }));
    expect(await screen.findByText('They ___ here')).toBeInTheDocument();
  });
});
