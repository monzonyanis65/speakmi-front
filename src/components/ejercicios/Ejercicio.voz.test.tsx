import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ejercicio } from './Ejercicio';
import {
  CLAVE_DECIR_OPCIONES,
  encenderDecirOpciones,
  olvidarPreferenciaDeOpciones,
} from '@/lib/voz-opciones';
import type { EjercicioPublico } from './tipos';

/**
 * Que al tocar una opción se oiga cómo se pronuncia.
 *
 *
 * POR QUÉ ESTÁ EN UN ARCHIVO APARTE
 *
 * Los otros archivos de este directorio prueban cada tipo de ejercicio por
 * dentro: qué se pinta, qué se manda al padre, cómo se marca la corrección.
 * Esto es una pregunta que cruza tres tipos a la vez —opción múltiple, hueco y
 * emparejar— y tiene un solo motivo para ponerse rojo.
 *
 *
 * QUÉ SE APRIETA
 *
 * La parte fácil es que suene. La difícil, y la única que puede hacer daño, es
 * que NO suene cuando la opción está en español: una voz inglesa leyendo
 * «Porque todavía no ha encontrado apartamento» enseña una pronunciación que no
 * existe, que es justo lo que `voz.ts` lleva desde el principio negándose a
 * hacer al revés.
 *
 * Y que nada de esto estorbe: la respuesta se registra igual, y al salir del
 * ejercicio no se queda una frase sonando encima del siguiente.
 */

const decir = vi.fn((_texto: string) => Promise.resolve());
const callar = vi.fn();

vi.mock('@/lib/voz', () => ({
  decir: (texto: string) => decir(texto),
  callar: () => callar(),
  hayVoz: () => true,
  hayVozInglesa: () => Promise.resolve(true),
  vozInglesaYa: () => 'si',
}));

function pintar(ejercicio: EjercicioPublico, onCambio = vi.fn()) {
  return {
    onCambio,
    ...render(
      <Ejercicio ejercicio={ejercicio} bloqueado={false} onCambio={onCambio} resultado={null} />,
    ),
  };
}

/** Opción múltiple con opciones en inglés. Copiado de L6-U7-04-E01. */
const EN_INGLES: EjercicioPublico = {
  code: 'L6-U7-04-E01',
  type: 'multiple_choice',
  difficulty: 2,
  prompt: {
    instruction_es: 'Elige la correcta.',
    question: 'Which one is right?',
    options: [
      { text: 'I always drink some juice with breakfast.' },
      { text: 'Always I drink some juice with breakfast.' },
    ],
  },
};

/** Lo mismo, pero de comprensión lectora: las opciones van en español. */
const EN_ESPANOL: EjercicioPublico = {
  code: 'L6-U7-05-E01',
  type: 'multiple_choice',
  difficulty: 2,
  prompt: {
    instruction_es: 'Responde.',
    question: '¿Por qué está en casa de su prima?',
    options: [
      { text: 'Porque todavía no ha encontrado un apartamento fijo' },
      { text: 'Porque su prima da clases de cocina' },
    ],
  },
};

beforeEach(() => {
  decir.mockClear();
  callar.mockClear();
  localStorage.removeItem(CLAVE_DECIR_OPCIONES);
  olvidarPreferenciaDeOpciones();
});

afterEach(() => {
  localStorage.removeItem(CLAVE_DECIR_OPCIONES);
  olvidarPreferenciaDeOpciones();
});

describe('oír la opción al tocarla', () => {
  it('suena la opción elegida, que es lo que se pidió', async () => {
    const quien = userEvent.setup();
    pintar(EN_INGLES);

    await quien.click(screen.getByRole('button', { name: /always drink some juice/i }));

    expect(decir).toHaveBeenCalledWith('I always drink some juice with breakfast.');
  });

  it('no suena la que no se tocó', async () => {
    const quien = userEvent.setup();
    pintar(EN_INGLES);

    await quien.click(screen.getByRole('button', { name: /^I always drink/i }));

    expect(decir).toHaveBeenCalledTimes(1);
  });

  it('NO suena si la opción está en español', async () => {
    const quien = userEvent.setup();
    pintar(EN_ESPANOL);

    await quien.click(screen.getByRole('button', { name: /apartamento fijo/i }));

    expect(decir).not.toHaveBeenCalled();
  });

  it('la respuesta se registra igual, suene o no', async () => {
    const quien = userEvent.setup();
    const { onCambio } = pintar(EN_ESPANOL);

    await quien.click(screen.getByRole('button', { name: /apartamento fijo/i }));

    // Lo que no puede pasar nunca: que oírse la opción sea un requisito para
    // poder contestar. Aquí no ha sonado nada y la respuesta está puesta.
    expect(onCambio).toHaveBeenCalledWith(0);
  });

  it('se puede apagar', async () => {
    const quien = userEvent.setup();
    encenderDecirOpciones(false);
    pintar(EN_INGLES);

    await quien.click(screen.getByRole('button', { name: /^I always drink/i }));

    expect(decir).not.toHaveBeenCalled();
  });

  it('al salir del ejercicio se calla, para no sonar encima del siguiente', () => {
    const { unmount } = pintar(EN_INGLES);
    callar.mockClear();

    unmount();

    expect(callar).toHaveBeenCalled();
  });

  it('en los huecos suena la ficha, aunque sola no delate ningún idioma', async () => {
    const quien = userEvent.setup();
    pintar({
      code: 'L6-U7-02-E01',
      type: 'fill_blank',
      difficulty: 1,
      prompt: {
        instruction_es: 'Completa.',
        text: 'This is the box of tools ___ he never lends to anybody.',
        choices: ['that', 'who', 'what'],
      },
    });

    await quien.click(screen.getByRole('button', { name: 'that' }));

    expect(decir).toHaveBeenCalledWith('that');
  });

  it('al emparejar suena el inglés de un lado y se calla el español del otro', async () => {
    const quien = userEvent.setup();
    pintar({
      code: 'L6-U7-01-E01',
      type: 'match_pairs',
      difficulty: 1,
      prompt: {
        instruction_es: 'Empareja.',
        left: ['run out of', 'get stuck'],
        right: ['quedarse sin algo', 'quedarse atascado'],
      },
    });

    await quien.click(screen.getByRole('button', { name: /run out of/ }));
    expect(decir).toHaveBeenCalledWith('run out of');

    decir.mockClear();
    await quien.click(screen.getByRole('button', { name: /quedarse sin algo/ }));
    expect(decir).not.toHaveBeenCalled();
  });
});
