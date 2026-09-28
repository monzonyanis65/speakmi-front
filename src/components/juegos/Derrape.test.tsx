import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Derrape } from './Derrape';
import type { RondaDeDerrape } from './tipos';

/**
 * DERRAPE.
 *
 * En jsdom no se mueve nada de verdad: no hay maquetación, el coche no tiene
 * anchura y `getBoundingClientRect` devuelve ceros. Así que aquí NO se comprueba
 * lo que se ve —eso se mira jugando, y está medido con un piloto simulado dentro
 * de la página— sino las seis cosas que se romperían sin que nadie lo notara:
 *
 *   1. que el crono que se enseña es EXACTAMENTE la fórmula del servidor. Es el
 *      número que este juego pone más grande, y si no cuadrara con lo que el
 *      servidor puede reconstruir sería la clase de mentira que ya costó cara
 *      aquí con un multiplicador que no multiplicaba;
 *   2. que al servidor le llega una respuesta por curva y ni una de más. Ya pasó
 *      en CARRERA: `React.StrictMode` llama dos veces a las funciones de
 *      actualizar estado y la carrera mandaba quince respuestas para catorce
 *      puertas;
 *   3. que lo que se ve en el marcador es la fórmula de la puntuación del
 *      servidor y no un número inventado;
 *   4. que al fallar aparece la regla, que es lo único que convierte una curva
 *      perdida en algo aprendido;
 *   5. que llegar a la bifurcación sin girar se manda igual y como `recto`, para
 *      que la racha del servidor se rompa de verdad;
 *   6. que quien pide menos movimiento tiene una contrarreloj entera, con su
 *      crono y su hoja de tiempos, y no un cartel.
 */

const CRONO = {
  salidaMs: 1300,
  derrapeBaseMs: 300,
  derrapePorEslabonMs: 90,
  eslabonesMaximos: 6,
  gravaMs: 1250,
  muroMs: 1900,
};

/**
 * Un circuito de una curva por vuelta.
 *
 * Una sola curva por vuelta y dos vueltas es el circuito más pequeño que sigue
 * siendo este juego: hay referencia contra la que correr y hay una segunda
 * pregunta sobre el mismo par. Con seis curvas, una carrera entera en jsdom
 * duraría más de un minuto de reloj de verdad.
 */
const RONDA: RondaDeDerrape = {
  code: 'DERRAPE',
  curvas: [
    {
      id: 'v1c1',
      vuelta: 1,
      curva: 1,
      pista: 'asegurarse de que pase',
      opciones: ['assure', 'ensure'],
      correcta: 'ensure',
      ensena: '«Assure» tranquiliza a una persona; «ensure» garantiza un resultado.',
      foco: 'precisión léxica',
      pistaMs: 1100,
      cartelesMs: 1200,
    },
    {
      id: 'v2c1',
      vuelta: 2,
      curva: 1,
      pista: 'asegurárselo a alguien',
      opciones: ['ensure', 'assure'],
      correcta: 'assure',
      ensena: '«Assure» tranquiliza a una persona; «ensure» garantiza un resultado.',
      foco: 'precisión léxica',
      pistaMs: 1100,
      cartelesMs: 1200,
    },
  ],
  circuito: { vueltas: 2, curvasPorVuelta: 1 },
  reloj: { escalones: [1500, 1400, 1300], pasosAtrasAlFallar: 3 },
  crono: CRONO,
};

/**
 * El mismo circuito con el reloj encogido, para la versión que corre.
 *
 * El circuito de verdad tarda setenta y tres segundos y aquí hay que esperarlo en
 * tiempo real: el bucle va con `performance.now()` y no hay forma honesta de
 * adelantarlo sin dejar de probar el bucle. Lo que NO se encoge por debajo de un
 * segundo es la ventana, porque el coche tarda unos trescientos milisegundos en
 * cruzar de rama y con una ventana más corta la prueba estaría midiendo que no da
 * tiempo a girar, que es otra cosa.
 */
const RAPIDA: RondaDeDerrape = {
  ...RONDA,
  curvas: RONDA.curvas.map((curva) => ({ ...curva, pistaMs: 150, cartelesMs: 150 })),
  reloj: { escalones: [700, 650, 600], pasosAtrasAlFallar: 3 },
  crono: { ...CRONO, salidaMs: 300, gravaMs: 200, muroMs: 250, derrapeBaseMs: 60, derrapePorEslabonMs: 20 }, // prettier-ignore
};

/** Con o sin movimiento, que es lo que decide a qué juego se está jugando. */
function conMovimiento(quieto: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: quieto && consulta.includes('reduced-motion'),
    media: consulta,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function renderizar(ronda: RondaDeDerrape = RONDA) {
  const onFin = vi.fn();
  const onSalir = vi.fn();
  const onResponder = vi.fn((_id: string, _respuesta: string) =>
    Promise.resolve({ isCorrect: true }),
  );

  render(
    <Derrape
      ronda={ronda}
      onResponder={(id, respuesta) => onResponder(id, respuesta)}
      onFin={onFin}
      onSalir={onSalir}
    />,
  );

  return { onFin, onSalir, onResponder };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ────────────────────────────  EL CIRCUITO  ──────────────────────────── */

describe('el circuito, que es la versión que se conduce', () => {
  beforeEach(() => conMovimiento(false));

  it('la primera curva tarda en llegar: antes hay que entender la pantalla', async () => {
    renderizar(RAPIDA);

    // Las dos ramas se pueden tocar desde el principio; los carteles todavía no
    // dicen nada, porque el coche está en la vuelta de formación.
    const ramas = screen.getAllByRole('button', { name: /^Rama/ });
    expect(ramas).toHaveLength(2);
    expect(ramas[0]).toHaveAccessibleName('Rama 1');

    await waitFor(() => expect(ramas[0]).toHaveAccessibleName('Rama 1: assure'), {
      timeout: 6000,
    });
  });

  it('el crono que se enseña es la fórmula del servidor, hasta la milésima', async () => {
    /*
      La prueba que sostiene la honestidad del juego entero.

      Con esta ronda, una carrera perfecta vale:
        curva 1: ventana 150+150+700 = 1000, salida 300 − 60 (primer derrape) = 240
        curva 2: ventana 150+150+650 =  950, salida 300 − 80 (segundo eslabón) = 220
      O sea 1,240 y 1,170 de vuelta, y 2,410 de total. Esos tres números salen de
      `milisegundosDeSector` en `back/src/modules/games/derrape.ts`, que es lo que
      el servidor puede reconstruir desde las respuestas que él mismo corrigió.

      Si alguien toca la fórmula de un lado y no del otro, aquí salta.
    */
    const usuario = userEvent.setup();
    renderizar(RAPIDA);

    await waitFor(() => expect(screen.getByText('asegurarse de que pase')).toBeInTheDocument(), {
      timeout: 6000,
    });
    // `ensure` está en la rama 2 en la vuelta 1 y en la 1 en la vuelta 2.
    await usuario.keyboard('2');

    await waitFor(() => expect(screen.getByText('asegurárselo a alguien')).toBeInTheDocument(), {
      timeout: 6000,
    });
    await usuario.keyboard('2');

    await waitFor(() => expect(screen.getByText('Bandera a cuadros')).toBeInTheDocument(), {
      timeout: 6000,
    });

    expect(screen.getByText('1.240')).toBeInTheDocument();
    expect(screen.getByText('1.170')).toBeInTheDocument();
    // El total sale dos veces: en la bandera y en el crono, que se paró ahí.
    expect(screen.getAllByText(/2\.410/)).not.toHaveLength(0);
  }, 20000);

  it('manda UNA respuesta por curva y ni una de más', async () => {
    /*
      En desarrollo React llama DOS VECES a las funciones que actualizan el
      estado, para cazar efectos escondidos. En CARRERA eso mandó quince
      respuestas para catorce puertas, porque el aviso al servidor vivía dentro de
      un `setEstado(anterior => …)`. Aquí `anotar` se llama una sola vez desde el
      bucle y lleva su propio espejo, así que esta cuenta tiene que ser exacta.
    */
    const { onResponder } = renderizar(RAPIDA);

    await waitFor(() => expect(onResponder).toHaveBeenCalledTimes(2), { timeout: 12000 });
    expect(onResponder.mock.calls.map((llamada) => llamada[0])).toEqual(['v1c1', 'v2c1']);
  }, 20000);

  it('quien llega a la bifurcación sin girar se come el bordillo, y se manda', async () => {
    /*
      Se manda como una respuesta más y no se calla, por el mismo motivo que en
      CAEN se manda lo que toca el suelo: si solo contaran las curvas tomadas, la
      racha del servidor no se rompería nunca y el bono al cuadrado pagaría una
      carrera en la que las difíciles se dejaron pasar de largo.
    */
    const { onResponder } = renderizar(RAPIDA);

    await waitFor(() => expect(onResponder).toHaveBeenCalledTimes(1), { timeout: 12000 });
    expect(onResponder).toHaveBeenCalledWith('v1c1', 'recto');
  }, 20000);

  it('al fallar enseña la palabra buena y la regla', async () => {
    const { onFin } = renderizar(RAPIDA);

    await waitFor(() => expect(screen.getByText(/garantiza un resultado/)).toBeInTheDocument(), {
      timeout: 12000,
    });
    expect(onFin).not.toHaveBeenCalled();
  }, 20000);
});

/* ────────────────────────────  SIN MOVIMIENTO  ──────────────────────────── */

describe('la hoja de tiempos, que es la versión sin movimiento', () => {
  beforeEach(() => conMovimiento(true));

  it('es una contrarreloj entera y no un cartel: tiene reloj, crono y hoja', () => {
    renderizar();

    expect(screen.getByText('asegurarse de que pase')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rama 1: assure/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rama 2: ensure/ })).toBeInTheDocument();

    // El reloj de la curva, que es lo que este juego NO puede quitar: lo que se
    // entrena es recuperar la palabra exacta deprisa.
    expect(screen.getByText('Segundos')).toBeInTheDocument();
    // Y la hoja, que es lo que sustituye al circuito sin mover nada.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Vuelta 1')).toBeInTheDocument();
  });

  it('el crono suma los mismos sectores que en el circuito', async () => {
    /*
      Con la ronda lenta: ventana 1100+1200+1500 = 3800 y salida 1300 − 300 = 1000.
      O sea 4,800 de sector. El mismo número que daría el circuito, porque la
      fórmula es la misma: la versión accesible no juega a otra cosa.
    */
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByRole('button', { name: /Rama 2: ensure/ }));

    // El mismo número sale dos veces: en el crono grande y en la fila de la hoja.
    await waitFor(() => expect(screen.getAllByText('4.800')).not.toHaveLength(0));
  }, 20000);

  it('el marcador en vivo es la fórmula de la puntuación del servidor', async () => {
    /*
      Un acierto con racha máxima 1: 1 × 10 + 1² × 2 = 12. Es la cuenta de
      `puntosDelServidor`, que es una copia a mano de la del servidor. Si se viera
      otro número, la pantalla final pondría uno más bajo y eso no se lee como un
      fallo: se lee como una estafa.
    */
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByRole('button', { name: /Rama 2: ensure/ }));
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
  }, 20000);

  it('al fallar enseña la palabra buena y la regla, que es cuando sirve', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByRole('button', { name: /Rama 1: assure/ }));

    await waitFor(() => expect(screen.getAllByText(/garantiza un resultado/)).not.toHaveLength(0));
    // La palabra buena, aparte de la regla, y en el color del acierto.
    expect(screen.getAllByText('ensure').length).toBeGreaterThan(0);
  }, 20000);

  it('la vuelta 2 pregunta la palabra gemela del mismo par', async () => {
    /*
      Es la diferencia con CARRERA que más pesa: allí una frase repetida se aparta
      porque se contestaría de memoria. Aquí la segunda vuelta es el método —el
      mismo par, cuarenta segundos después, con el reloj más apretado— y la
      pregunta va por el otro miembro o por el mismo, que lo decide el servidor.
    */
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.click(screen.getByRole('button', { name: /Rama 2: ensure/ }));

    await waitFor(() => expect(screen.getByText('asegurárselo a alguien')).toBeInTheDocument(), {
      timeout: 6000,
    });

    await usuario.click(screen.getByRole('button', { name: /Rama 2: assure/ }));
    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('v2c1', 'assure'));
  }, 20000);

  it('espera al servidor antes de cerrar la partida', async () => {
    /*
      Si el `/fin` adelantara a las últimas respuestas, el servidor cerraría
      contando menos aciertos de los que hubo y la pantalla final enseñaría una
      puntuación por debajo de la que se acaba de ver subir.
    */
    const usuario = userEvent.setup();
    const { onFin } = renderizar();

    await usuario.click(screen.getByRole('button', { name: /Rama 2: ensure/ }));
    await waitFor(() => expect(screen.getByText('asegurárselo a alguien')).toBeInTheDocument(), {
      timeout: 6000,
    });
    await usuario.click(screen.getByRole('button', { name: /Rama 2: assure/ }));

    await waitFor(() => expect(onFin).toHaveBeenCalledTimes(1), { timeout: 6000 });
    expect(onFin.mock.calls[0]![0]).toMatchObject({ aciertos: 2, total: 2 });
  }, 20000);
});
