import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ejercicio } from './Ejercicio';

/**
 * El rompecabezas: ordenar una frase con las fichas que se dan.
 *
 * Lo que se mira aquí es lo que no se ve mirando la pantalla una vez: CÓMO se
 * barajan las fichas, y que la respuesta que sale hacia el servidor sea la
 * frase montada y no otra cosa.
 */

const EJERCICIO = {
  code: 'L1-U1-02-E04',
  type: 'word_order',
  difficulty: 2,
  prompt: {
    instruction_es: 'Ordena la pregunta.',
    tokens: ['where', 'do', 'you', 'work', 'in', 'the', 'morning', 'always'],
  },
};

/** Las fichas que se ofrecen, de izquierda a derecha, tal como se pintan. */
function fichasOfrecidas(): string[] {
  return screen
    .getAllByRole('button')
    .map((b) => b.textContent ?? '')
    .filter((t) => EJERCICIO.prompt.tokens.includes(t));
}

afterEach(() => vi.restoreAllMocks());

describe('ordenar palabras', () => {
  /*
    EL BARAJADO NO PUEDE DEJAR LAS FICHAS COMO LLEGAN.

    Había un `sort(() => Math.random() - 0.5)`, que es el atajo de siempre y no
    baraja: el comparador tiene que ser consistente y ese no lo es, así que el
    resultado depende del algoritmo de ordenación. Con ocho fichas dejaba el
    orden de entrada intacto el 0,93 % de las veces en lugar del 0,0025 % que
    tocaría, trescientas setenta veces de más.

    La prueba lo coge por donde se nota: con un `Math.random` que siempre
    devuelve 0,5 el comparador da cero para cualquier par, así que un `sort`
    estable devuelve EXACTAMENTE el orden de entrada. Un barajado de verdad,
    con el mismo azar de pega, no puede devolverlo.
  */
  it('no deja las fichas en el orden en que llegan', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    render(<Ejercicio ejercicio={EJERCICIO} bloqueado={false} onCambio={() => {}} />);

    const pintadas = fichasOfrecidas();
    expect(pintadas).toHaveLength(EJERCICIO.prompt.tokens.length);
    // Están todas, ninguna de más y ninguna de menos.
    expect([...pintadas].sort()).toEqual([...EJERCICIO.prompt.tokens].sort());
    // Pero no en el orden en que venían.
    expect(pintadas).not.toEqual(EJERCICIO.prompt.tokens);
  });

  it('manda la frase montada, en el orden en el que se tocaron las fichas', async () => {
    const dichas: unknown[] = [];
    const persona = userEvent.setup();

    render(
      <Ejercicio
        ejercicio={EJERCICIO}
        bloqueado={false}
        onCambio={(valor) => dichas.push(valor)}
      />,
    );

    for (const ficha of ['where', 'do', 'you', 'work']) {
      await persona.click(screen.getAllByRole('button', { name: ficha })[0]!);
    }

    expect(dichas.at(-1)).toEqual(['where', 'do', 'you', 'work']);
  });

  it('una ficha colocada se puede devolver tocándola otra vez', async () => {
    const dichas: unknown[] = [];
    const persona = userEvent.setup();

    render(
      <Ejercicio
        ejercicio={EJERCICIO}
        bloqueado={false}
        onCambio={(valor) => dichas.push(valor)}
      />,
    );

    await persona.click(screen.getAllByRole('button', { name: 'where' })[0]!);
    await persona.click(screen.getAllByRole('button', { name: 'do' })[0]!);
    expect(dichas.at(-1)).toEqual(['where', 'do']);

    // La primera de las dos «where» que hay en pantalla es la ya colocada.
    await persona.click(screen.getAllByRole('button', { name: 'where' })[0]!);
    expect(dichas.at(-1)).toEqual(['do']);
  });

  /*
    Sin ninguna ficha puesta no hay respuesta que mandar, y eso es lo que
    mantiene «COMPROBAR» apagado: la pantalla no decide nada, se fía de que
    aquí llegue `null`.
  */
  it('sin fichas puestas no hay respuesta', async () => {
    const dichas: unknown[] = [];
    const persona = userEvent.setup();

    render(
      <Ejercicio
        ejercicio={EJERCICIO}
        bloqueado={false}
        onCambio={(valor) => dichas.push(valor)}
      />,
    );

    await persona.click(screen.getAllByRole('button', { name: 'where' })[0]!);
    await persona.click(screen.getAllByRole('button', { name: 'where' })[0]!);

    expect(dichas.at(-1)).toBeNull();
  });
});
