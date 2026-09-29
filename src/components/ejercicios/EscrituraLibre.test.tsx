import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ejercicio } from './Ejercicio';
import type { Correccion, Respuesta } from './tipos';

/**
 * La pantalla de escribir libre.
 *
 * Se monta por `Ejercicio` y no por el componente directamente: lo que tiene
 * que seguir siendo verdad es que un `free_write` llegue a pintarse, y montando
 * el componente a mano eso no se comprueba nunca.
 */

const EJERCICIO = {
  code: 'L2-U2-05-E04',
  type: 'free_write',
  difficulty: 2,
  prompt: {
    instruction_es: 'Escribe el mensaje. Cuatro o cinco frases bastan.',
    situacion_es: 'Un compañero de tu clase de inglés te pregunta por tu hermana.',
    puntos_es: [
      'En qué trabaja tu hermana y dónde.',
      'Una cosa que hace ella en ese trabajo todos los días.',
      'Una pregunta para él sobre el trabajo de alguien de su familia.',
    ],
    apoyo: ['downtown', 'office'],
  },
};

function montar(extra: { bloqueado?: boolean; resultado?: Correccion | null } = {}) {
  const cambios: Array<Respuesta | null> = [];
  render(
    <Ejercicio
      ejercicio={EJERCICIO}
      bloqueado={extra.bloqueado ?? false}
      onCambio={(respuesta) => cambios.push(respuesta)}
      resultado={extra.resultado ?? null}
    />,
  );
  return cambios;
}

/** Una corrección con el punto del medio sin cubrir. */
const FALTA_EL_SEGUNDO: Correccion = {
  isCorrect: false,
  score: 2 / 3,
  feedback: {
    message_es: 'Te falta el punto 2.',
    correcta: 'My sister works downtown. Does your brother work?',
    errores: [],
    puntos: [
      { cubierto: true },
      { cubierto: false, porQue_es: 'No dice qué hace ella cada día.' },
      { cubierto: true },
    ],
  },
};

afterEach(cleanup);

describe('antes de escribir', () => {
  it('se ve la situación y las cosas que hay que contar', () => {
    montar();

    expect(screen.getByText(/te pregunta por tu hermana/)).toBeInTheDocument();
    for (const punto of EJERCICIO.prompt.puntos_es) {
      expect(screen.getByText(punto)).toBeInTheDocument();
    }
  });

  it('no hay contador de palabras ni tope de longitud', () => {
    // Un número subiendo en la esquina es una meta aunque nadie diga que lo es,
    // y la corrección no mira la longitud: estaría midiendo lo que no puntúa.
    montar();

    const campo = screen.getByLabelText('Tu texto en inglés');
    expect(campo).not.toHaveAttribute('maxlength');
    expect(campo).not.toHaveAttribute('minlength');
    expect(screen.queryByText(/palabras/i)).toBeNull();
  });
});

describe('mientras se escribe', () => {
  it('tres palabras ya cuentan como respuesta', async () => {
    // Quien dice lo que hay que decir en poco no puede quedarse con el botón
    // apagado: la longitud no decide nada aquí, ni en el servidor ni en esta
    // pantalla.
    const usuario = userEvent.setup();
    const cambios = montar();

    await usuario.type(screen.getByLabelText('Tu texto en inglés'), 'She works downtown');

    expect(cambios.at(-1)).toBe('She works downtown');
  });

  it('solo espacios no cuenta como respuesta', async () => {
    const usuario = userEvent.setup();
    const cambios = montar();

    await usuario.type(screen.getByLabelText('Tu texto en inglés'), '   ');

    expect(cambios.at(-1)).toBeNull();
  });

  it('una palabra de apoyo se añade al final y el cursor se queda dentro', async () => {
    /*
      Sin devolver el foco, en el móvil tocar una palabra cierra el teclado y
      hay que volver a tocar el recuadro: dos toques por palabra, y el apoyo
      acaba estorbando más de lo que ayuda.
    */
    const usuario = userEvent.setup();
    montar();

    const campo = screen.getByLabelText('Tu texto en inglés');
    await usuario.type(campo, 'She works');
    await usuario.click(screen.getByRole('button', { name: 'downtown' }));

    expect(campo).toHaveValue('She works downtown ');
    expect(campo).toHaveFocus();
  });
});

describe('cuando llega la corrección', () => {
  it('cada cosa que se pedía queda marcada en su sitio', () => {
    montar({ bloqueado: true, resultado: FALTA_EL_SEGUNDO });

    const lista = screen.getAllByRole('listitem');
    expect(within(lista[0]!).getByText('Dicho')).toBeInTheDocument();
    expect(within(lista[1]!).getByText('Te faltó esto')).toBeInTheDocument();
    expect(within(lista[2]!).getByText('Dicho')).toBeInTheDocument();
  });

  it('el punto que faltó dice por qué faltó', () => {
    montar({ bloqueado: true, resultado: FALTA_EL_SEGUNDO });

    expect(screen.getByText('No dice qué hace ella cada día.')).toBeInTheDocument();
  });

  it('el color no es lo único que lo dice', () => {
    // Quien no distingue el verde del ámbar tiene el símbolo y, debajo, el
    // texto para el lector de pantalla. La información no vive en el color.
    montar({ bloqueado: true, resultado: FALTA_EL_SEGUNDO });

    expect(screen.getAllByText('Dicho')).toHaveLength(2);
    expect(screen.getByText('Te faltó esto')).toBeInTheDocument();
  });

  it('el recuadro se bloquea y las palabras de apoyo se quitan', () => {
    // Ya no hay nada que escribir, y dejar los botones invita a tocarlos.
    montar({ bloqueado: true, resultado: FALTA_EL_SEGUNDO });

    expect(screen.getByLabelText('Tu texto en inglés')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'downtown' })).toBeNull();
  });

  it('sin corrección no se marca ningún punto', () => {
    montar();

    expect(screen.queryByText('Dicho')).toBeNull();
    expect(screen.queryByText('Te faltó esto')).toBeNull();
  });
});

describe('sin palabras de apoyo', () => {
  it('no se pinta el rótulo vacío', () => {
    // En los niveles altos la consigna va sin apoyo, y un «Por si te hacen
    // falta:» seguido de nada es ruido.
    const sinApoyo = {
      ...EJERCICIO,
      prompt: { ...EJERCICIO.prompt, apoyo: undefined },
    };
    render(
      <Ejercicio ejercicio={sinApoyo} bloqueado={false} onCambio={vi.fn()} resultado={null} />,
    );

    expect(screen.queryByText(/Por si te hacen falta/)).toBeNull();
  });
});
