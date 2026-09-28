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
 * las cosas que se romperían sin que nadie lo notara:
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
 *      no un cartel;
 *   6. y, desde que hay eje vertical, que el GESTO decide de verdad: que en una
 *      puerta doble saltar y rodar mandan formas distintas, que cruzarla
 *      corriendo es chocar y que el reloj de esas puertas cobra el gesto.
 *
 * SOBRE EL TIEMPO EN ESTAS PRUEBAS. El salto no cuenta hasta 60 ms después de
 * empezar —antes Milo todavía no ha despegado— y eso obliga a esperar de
 * verdad antes de hacer llegar la puerta. Es esperar poco y es esperar bien: si
 * la prueba se saltara ese rato estaría comprobando un salto instantáneo, que
 * es justo lo que el juego no tiene.
 */

/** Un rato de reloj de verdad, para que el arco del gesto haya avanzado. */
const esperar = (ms: number) => new Promise((seguir) => setTimeout(seguir, ms));

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
      gestoMs: 0,
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
      gestoMs: 0,
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
 * Una carrera de una sola puerta, para probar el eje vertical.
 *
 * Se arma aparte y no se le añade a `RONDA` porque lo que hay que mirar de una
 * puerta doble es la PRIMERA: si fuera la segunda habría que resolver antes la
 * de arriba, y entonces la prueba estaría midiendo también la pausa que enseña.
 */
function rondaDeUnaPuerta(puerta: Partial<RondaDeCarrera['puertas'][number]>): RondaDeCarrera {
  return {
    ...RONDA,
    puertas: [
      {
        id: 'u1',
        frase: 'She ___ to Lima two years ago.',
        opciones: ['go', 'come', 'take'],
        correcta: 'went',
        ensena: 'Con «two years ago» va el pasado.',
        foco: 'pasado irregular',
        lecturaMs: 1875,
        portalesMs: 2000,
        gestoMs: 450,
        ...puerta,
      },
    ],
  };
}

/** La misma puerta, partida en dos filas: arriba el pasado y abajo el presente. */
const PUERTA_DOBLE = rondaDeUnaPuerta({
  altas: ['went', 'came', 'took'],
  ejes: { arriba: 'pasado', abajo: 'presente' },
});

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

/**
 * EL EJE VERTICAL.
 *
 * Estas son las pruebas del encargo nuevo y conviene decir qué vigilan, porque
 * no es «que se pueda saltar»: es que el salto SIGNIFIQUE algo. Un juego en el
 * que saltar y rodar existen pero la respuesta sigue saliendo solo del carril
 * es un runner con subtítulos, y eso compilaría igual de bien.
 */
describe('la puerta doble: el gesto es media respuesta', () => {
  beforeEach(() => conMovimiento(false));

  it('saltar manda la forma de arriba y rodar la de abajo', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar(PUERTA_DOBLE);

    await waitFor(
      () => expect(carril(1)).toHaveAccessibleName('Carril 1: saltando went, rodando go'),
      { timeout: 4000 },
    );

    // Mismo carril, mismo instante, dos respuestas distintas: la diferencia la
    // pone el gesto y nada más. Si esto pasara con el código viejo, es que el
    // gesto no decide.
    await usuario.keyboard('1');
    await usuario.keyboard('{ArrowUp}');
    await esperar(120);
    llegarLaPuerta();

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('u1', 'went'));
  });

  it('rodando por el mismo carril se coge la otra forma', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar(PUERTA_DOBLE);

    await waitFor(() => expect(carril(1)).toHaveAccessibleName(/rodando go/), { timeout: 4000 });

    await usuario.keyboard('1');
    await usuario.keyboard('{ArrowDown}');
    await esperar(120);
    llegarLaPuerta();

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('u1', 'go'));
  });

  it('cruzar una puerta doble corriendo es chocarse con el travesaño', async () => {
    const { onResponder } = renderizar(PUERTA_DOBLE);

    await waitFor(() => expect(carril(1)).toHaveAccessibleName(/saltando went/), { timeout: 4000 });

    /*
      Sin gesto no se cruza. Es lo que impide que la puerta doble se resuelva
      ignorando la mitad de la pregunta: si de pie se cogiera la fila de abajo,
      la forma de jugar sería no saltar nunca y acertar la mitad de las veces
      por no hacer nada.
    */
    llegarLaPuerta();

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('u1', 'choque'));
    expect(screen.getByText(/^Chocaste\./)).toBeInTheDocument();
  });

  it('el salto que llegó tarde no cuenta, y el que ya acabó tampoco', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar(PUERTA_DOBLE);

    await waitFor(() => expect(carril(1)).toHaveAccessibleName(/saltando went/), { timeout: 4000 });

    // El arco entero dura 640 ms: a los 700 Milo ya volvió al suelo y el
    // travesaño le pilla de pie. Un gesto que dura para siempre sería un botón
    // de «modo saltando», y entonces no habría nada que cronometrar.
    await usuario.keyboard('{ArrowUp}');
    await esperar(700);
    llegarLaPuerta();

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('u1', 'choque'));
  });

  it('rodar en el aire corta el salto: la caída rápida cambia la respuesta', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar(PUERTA_DOBLE);

    await waitFor(() => expect(carril(1)).toHaveAccessibleName(/rodando go/), { timeout: 4000 });

    /*
      Se salta y, a media subida, se rueda. Sin la caída rápida el segundo
      gesto se perdería —hay uno en marcha— y la puerta se cruzaría por arriba:
      o sea que un salto lanzado antes de terminar de leer sería una respuesta
      dada sin querer y sin forma de retirarla.
    */
    await usuario.keyboard('1');
    await usuario.keyboard('{ArrowUp}');
    await esperar(100);
    await usuario.keyboard('{ArrowDown}');
    await esperar(120);
    llegarLaPuerta();

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('u1', 'go'));
  });

  it('dice qué afirma cada fila, que es lo que la separa de un volado', async () => {
    renderizar(PUERTA_DOBLE);

    // Sin esta etiqueta la fila no se puede razonar: se vería «went» arriba y
    // «go» abajo sin saber qué se está diciendo al saltar, y media respuesta
    // saldría del azar.
    expect(await screen.findByText(/▲ pasado/, undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/▼ presente/)).toBeInTheDocument();
  });
});

describe('la reja de una puerta sencilla', () => {
  beforeEach(() => conMovimiento(false));

  it('la valla se salta, y cruzarla corriendo es chocar', async () => {
    const { onResponder } = renderizar(rondaDeUnaPuerta({ correcta: 'go', estorbo: 'valla' }));

    await waitFor(() => expect(carril(1)).toHaveAccessibleName('Carril 1: saltando go'), {
      timeout: 4000,
    });

    llegarLaPuerta();
    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('u1', 'choque'));
  });

  it('con la barra hay que rodar: saltarla no vale', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar(rondaDeUnaPuerta({ correcta: 'go', estorbo: 'barra' }));

    await waitFor(() => expect(carril(1)).toHaveAccessibleName('Carril 1: rodando go'), {
      timeout: 4000,
    });

    // Saltar por encima de un travesaño alto es chocárselo. Los dos gestos
    // tienen que ser distinguibles o el eje vertical sería un solo botón.
    await usuario.keyboard('{ArrowUp}');
    await esperar(120);
    llegarLaPuerta();
    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('u1', 'choque'));
  });

  it('una puerta despejada no castiga saltar por gusto', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await waitFor(() => expect(carril(2)).toHaveAccessibleName('Carril 2: sent'), {
      timeout: 4000,
    });

    // Es lo que permite practicar el gesto sin miedo en las diez puertas de
    // cada carrera que no lo piden.
    await usuario.keyboard('2');
    await usuario.keyboard('{ArrowUp}');
    await esperar(120);
    llegarLaPuerta();

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('p1', 'sent'));
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

  it('la puerta doble conserva las SEIS formas, con su etiqueta de fila', async () => {
    renderizar(PUERTA_DOBLE);

    /*
      Aquí no se salta —quien pidió menos movimiento no puede tener un gesto que
      depende de un arco animado—, pero la PREGUNTA no se recorta: las seis
      formas siguen estando y siguen agrupadas por lo que afirman. El gesto era
      la forma de contestar, no la pregunta, y es lo único que se quita.
    */
    /*
      El nombre de cada botón lleva la forma Y su fila: «Portal 1: went,
      pasado». Eso es lo que sustituye aquí a la altura del portal, que es como
      se dice en la pista, y sin ello quien juega de oído tendría seis palabras
      sueltas y ninguna forma de saber qué afirma al elegir una.
    */
    for (const forma of ['went', 'came', 'took']) {
      expect(
        await screen.findByRole('button', { name: new RegExp(`: ${forma}, pasado$`) }),
      ).toBeInTheDocument();
    }
    for (const forma of ['go', 'come', 'take']) {
      expect(
        screen.getByRole('button', { name: new RegExp(`: ${forma}, presente$`) }),
      ).toBeInTheDocument();
    }
    // Los nombres de los ejes encabezan sus dos columnas. Van `aria-hidden`
    // porque para quien no ve la pantalla la fila ya viaja dentro del nombre de
    // cada botón; ahí arriba serían dos palabras sueltas sin sujeto.
    expect(screen.getByText('pasado')).toBeInTheDocument();
    expect(screen.getByText('presente')).toBeInTheDocument();
  });

  it('las teclas contestan de verdad, y llegan hasta la sexta', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar(PUERTA_DOBLE);

    await screen.findByRole('button', { name: /: went, pasado$/ });

    /*
      La cabecera prometía «Teclas 1, 2 y 3» desde el principio y no había nadie
      escuchándolas: se llegaba a los portales tabulando, pero el dígito no
      hacía nada. Con seis opciones el atajo tiene que existir y tiene que
      contar hasta seis, porque la cuarta forma no está a una tecla de distancia
      de ninguna otra manera.
    */
    await usuario.keyboard('4');
    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('u1', 'go'));
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
