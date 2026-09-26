import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Carrera } from './Carrera';
import type { RondaDeCarrera } from './tipos';

/**
 * CARRERA.
 *
 * En jsdom no se mueve nada: ni animaciones, ni `getBoundingClientRect` de
 * verdad. Así que aquí NO se comprueba lo que se ve —eso se mira jugando— sino
 * las cinco cosas que se romperían sin que nadie lo notara:
 *
 *   1. que el carril en el que está Milo AL LLEGAR la puerta es el que decide,
 *      y no el que había cuando la puerta salió;
 *   2. que al servidor le llega una respuesta por puerta y ni una de más. Ya
 *      pasó: `React.StrictMode` llama dos veces a las funciones de actualizar
 *      estado, y con los efectos dentro la carrera mandaba quince respuestas
 *      para catorce puertas;
 *   3. que lo que se ve subir en el marcador es la fórmula del servidor, porque
 *      un número en vivo que no cuadre con el final se lee como una estafa;
 *   4. que al fallar aparece la regla, que es lo único que convierte una puerta
 *      perdida en algo aprendido;
 *   5. que quien pide menos movimiento tiene un juego entero, con su reloj, y
 *      no un cartel.
 */

const RONDA: RondaDeCarrera = {
  code: 'CARRERA',
  puertas: [
    {
      id: 'p1',
      frase: 'She has already ___ the email.',
      opciones: ['send', 'sent', 'sending'],
      correcta: 'sent',
      ensena: 'Detrás de «has» va el participio: sent.',
      foco: 'presente perfecto',
      lecturaMs: 1875,
      portalesMs: 1537,
    },
    {
      id: 'p2',
      frase: 'They ___ my classmates.',
      opciones: ['are', 'is', 'am'],
      correcta: 'are',
      ensena: 'You, we y they van con «are».',
      foco: 'verbo be',
      lecturaMs: 1500,
      portalesMs: 1100,
    },
  ],
  reloj: { escalones: [2600, 2444, 2297], pasosAtrasAlFallar: 3 },
  cazador: {
    ventajaInicial: 55,
    ventajaMaxima: 100,
    impulsoPorAcierto: 6,
    frenazoPorFallo: 26,
    tramosDeCombo: [
      { desde: 0, multiplicador: 1 },
      { desde: 3, multiplicador: 2 },
      { desde: 6, multiplicador: 4 },
      { desde: 9, multiplicador: 8 },
    ],
  },
};

/**
 * La llegada de la puerta, a mano.
 *
 * jsdom no anima nada, así que el aviso de que la puerta llegó al plano de Milo
 * hay que darlo desde aquí. Lo que se comprueba no es que CSS funcione —eso se
 * mira jugando— sino lo que pasa DESPUÉS de llegar, que es todo el juego.
 *
 * Se busca la capa del portal del MEDIO porque es la única que escucha el final
 * de la animación: los tres terminan a la vez y sin ese filtro la puerta se
 * resolvería tres veces.
 */
function llegarLaPuerta() {
  const capas = document.querySelectorAll('div[style*="carrera-puerta-mover"]');
  fireEvent.animationEnd(capas[1]!, { animationName: 'carrera-puerta-mover', bubbles: true });
}

/** Con o sin movimiento, que es lo que decide a qué juego se está jugando. */
function conMovimiento(quieto: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: quieto && consulta.includes('reduced-motion'),
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function renderizar(ronda: RondaDeCarrera = RONDA) {
  const onFin = vi.fn();
  const onSalir = vi.fn();
  const onResponder = vi.fn((_id: string, _respuesta: string) =>
    Promise.resolve({ isCorrect: true }),
  );

  render(
    <Carrera
      ronda={ronda}
      onResponder={(id, respuesta) => onResponder(id, respuesta)}
      onFin={onFin}
      onSalir={onSalir}
    />,
  );

  return { onFin, onSalir, onResponder };
}

const carril = (numero: number) =>
  screen.getByRole('button', { name: new RegExp(`^Carril ${numero}`) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('la pista, que es la versión que corre', () => {
  beforeEach(() => conMovimiento(false));

  it('la primera puerta tarda en salir: antes hay que entender la pantalla', async () => {
    renderizar();

    // Los tres carriles están desde el principio; la puerta todavía no.
    expect(screen.getAllByRole('button', { name: /^Carril/ })).toHaveLength(3);
    expect(carril(1)).toHaveAccessibleName('Carril 1');

    await waitFor(() => expect(carril(1)).toHaveAccessibleName('Carril 1: send'), {
      timeout: 4000,
    });
  });

  it('decide el carril en el que está Milo AL LLEGAR la puerta', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await waitFor(() => expect(carril(2)).toHaveAccessibleName('Carril 2: sent'), {
      timeout: 4000,
    });

    // Milo arranca en el del medio, se va al tercero y vuelve al segundo. Lo que
    // cuenta es dónde está cuando la puerta llega, no por dónde pasó antes.
    await usuario.keyboard('3');
    await usuario.keyboard('2');
    llegarLaPuerta();

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('p1', 'sent'));
  });

  it('manda UNA respuesta por puerta y ni una de más', async () => {
    const { onResponder } = renderizar();

    await waitFor(() => expect(carril(1)).toHaveAccessibleName('Carril 1: send'), {
      timeout: 4000,
    });

    /*
      Dos avisos de llegada de la misma puerta: pasa de verdad cuando el
      navegador dispara el final de las tres capas. Y sobre todo pasaba con
      `StrictMode`, que llama dos veces a las funciones de actualizar estado.
      Una respuesta de más le rompe la racha al servidor o se la infla, y
      entonces el número del final no es el que se vio subir.
    */
    llegarLaPuerta();
    llegarLaPuerta();

    await waitFor(() => expect(onResponder).toHaveBeenCalledTimes(1));
  });

  it('lo que sube el marcador es la cuenta del servidor', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await waitFor(() => expect(carril(2)).toHaveAccessibleName('Carril 2: sent'), {
      timeout: 4000,
    });
    await usuario.keyboard('2');
    llegarLaPuerta();

    /*
      Diez por acierto más la racha al cuadrado por dos: doce. Es exactamente la
      cuenta de `puntos.ts` y la que hará el servidor al cerrar. Si este número
      y el de la pantalla final no coincidieran, el juego se leería como una
      estafa, que es el motivo de que esta comprobación exista.
    */
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
  });

  it('al fallar enseña la palabra buena y la regla, y el cazador se acerca', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await waitFor(() => expect(carril(1)).toHaveAccessibleName('Carril 1: send'), {
      timeout: 4000,
    });
    await usuario.keyboard('1');
    llegarLaPuerta();

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('p1', 'send'));

    // La regla en una línea: es el único rato en el que este juego enseña algo.
    expect(screen.getByText('Detrás de «has» va el participio: sent.')).toBeInTheDocument();
    // Y la ventaja baja de 55 a 29, que es lo que cuesta un fallo.
    await waitFor(() => expect(screen.getByText('29%')).toBeInTheDocument());
  });

  it('no enseña un multiplicador sin decir qué multiplica', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await waitFor(() => expect(carril(2)).toHaveAccessibleName('Carril 2: sent'), {
      timeout: 4000,
    });
    await usuario.keyboard('2');
    llegarLaPuerta();

    /*
      El combo multiplica el IMPULSO y no los puntos, y en pantalla lo dice con
      esas palabras. Un «×2» suelto al lado de una puntuación promete que el
      acierto siguiente vale el doble, y aquí no lo vale: en esta aplicación ya
      hubo un juego que enseñaba un multiplicador que el servidor no pagaba.
    */
    expect(screen.queryByText(/^×\d/)).not.toBeInTheDocument();
  });
});

describe('la versión sin movimiento', () => {
  beforeEach(() => conMovimiento(true));

  it('es la misma carrera, con sus portales y su reloj', async () => {
    renderizar();

    // Los tres portales, con su texto y su número de tecla.
    expect(await screen.findByRole('button', { name: /^Portal 1: send$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Portal 2: sent$/ })).toBeInTheDocument();

    // Y el reloj sigue estando: lo que este juego entrena es leer a tiempo, y
    // sin reloj sería un ejercicio de rellenar huecos.
    const reloj = screen.getByText('Segundos').closest('div')!;
    await waitFor(() =>
      expect(Number(within(reloj).getByText(/^\d+$/).textContent)).toBeGreaterThan(0),
    );
  });

  it('se juega entera y le cuenta cada puerta al servidor', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.click(await screen.findByRole('button', { name: /^Portal 2: sent$/ }));
    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('p1', 'sent'));
  });

  it('enseña la regla al fallar, igual que en la pista', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: /^Portal 1: send$/ }));

    await waitFor(() =>
      expect(screen.getByText('Detrás de «has» va el participio: sent.')).toBeInTheDocument(),
    );
  });
});
