import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mercado } from './Mercado';
import type { RespuestaDeMercado, RondaDeMercado } from './tipos';

/**
 * EL MERCADO DE CONTRABANDO.
 *
 * Lo que se prueba aquí son las cosas que, si se rompen, rompen el juego sin
 * que se note jugando una partida:
 *
 *   1. Que el cajón traiga MÁS runas de las que caben y que ninguna venga con
 *      mayúscula. Son las dos cosas que permitirían montar el objeto sin
 *      entender el encargo: «úsalas todas» y «la que empieza en mayúscula va
 *      primera». El fallo gemelo está contado en `back/src/shared/barajar.ts`.
 *   2. Que al fallar se enseñe la frase buena, la que montaste y por qué no
 *      valía cada señuelo. Ese párrafo ES el juego; sin él esto dice «mal».
 *   3. Que la puntuación que se enseña en vivo sea la que va a cerrar el
 *      servidor. Ver subir 118 y que al final ponga 60 se lee como una estafa,
 *      y en esta aplicación ya ha pasado tres veces.
 *   4. Que se pueda jugar entero sin tocar la pantalla: colocar, mover, sacar,
 *      forjar y regatear.
 *   5. Que ofender cueste un sello y que tres ofensas cierren el puesto.
 */

function rondaDe(): RondaDeMercado {
  return {
    code: 'MERCADO',
    reputacion: 3,
    encargos: [
      {
        id: 'e1',
        clienteEs: 'La relojera del callejón',
        emoji: '⏰',
        demandaEs: 'Que el reloj lo estáis arreglando en este preciso momento.',
        // El banco llega revuelto y con señuelos dentro: `r2` y `r5` no valen.
        runas: [
          { id: 'r1', texto: 'we' },
          { id: 'r2', texto: 'fix' },
          { id: 'r3', texto: 'are fixing' },
          { id: 'r4', texto: 'your watch' },
          { id: 'r5', texto: 'every week' },
          { id: 'r6', texto: 'right now' },
        ],
        regateo: {
          contextoEs: 'El cliente quiere que le quites algo del precio.',
          clienteEn: "That's a bit steep.",
          opciones: [
            { id: 'o1', texto: 'put you off' },
            { id: 'o2', texto: 'knock a little off' },
            { id: 'o3', texto: 'take you on' },
            { id: 'o4', texto: 'run off with it' },
          ],
        },
        nivel: 'A2',
      },
      {
        id: 'e2',
        clienteEs: 'El anticuario del sótano',
        emoji: '🕯️',
        demandaEs: 'Que la lámpara ya está arreglada y sin decir cuándo.',
        runas: [
          { id: 'r1', texto: 'has already' },
          { id: 'r2', texto: 'we' },
          { id: 'r3', texto: 'repaired' },
          { id: 'r4', texto: 'have already' },
          { id: 'r5', texto: 'the lamp' },
        ],
        regateo: {
          contextoEs: 'Hay que proponer un punto medio.',
          clienteEn: "We're miles apart on this.",
          opciones: [
            { id: 'o1', texto: 'meet you halfway' },
            { id: 'o2', texto: 'see you off' },
            { id: 'o3', texto: 'hold out for more' },
            { id: 'o4', texto: 'go back on it' },
          ],
        },
        nivel: 'B1',
      },
    ],
  };
}

/** Las runas buenas de cada encargo de prueba, en el orden que las quiere. */
const SOLUCION: Record<string, string[]> = {
  e1: ['r1', 'r3', 'r4', 'r6'],
  e2: ['r2', 'r4', 'r3', 'r5'],
};

/** Las opciones que ofenden, para que el servidor de mentira pueda decirlo. */
const OFENDE: Record<string, string> = { e1: 'o1', e2: 'o2' };
const BUENA: Record<string, string> = { e1: 'o2', e2: 'o1' };

/**
 * Un servidor de mentira que corrige como el de verdad.
 *
 * Importa que corrija AQUÍ y no en el componente: la ronda llega sin soluciones
 * a propósito, así que si estas pruebas pudieran decidir el veredicto desde el
 * navegador estarían probando otro juego.
 */
function servidorDeMentira() {
  return vi.fn((rondaId: string, answer: string | string[]): Promise<RespuestaDeMercado> => {
    const [encargoId, fase] = rondaId.split('-');
    const esperada = SOLUCION[encargoId!]!;

    if (fase === 'forja') {
      const puestas = answer as string[];
      const acierto =
        puestas.length === esperada.length && puestas.every((id, i) => id === esperada[i]);

      return Promise.resolve({
        isCorrect: acierto,
        feedback: {
          message_es: acierto ? '¡Es justo lo que pedía!' : 'No es lo que pedía.',
          correcta: 'We are fixing your watch right now.',
          tuya: 'We fix your watch right now.',
          leccionEs: 'Presente continuo para lo que ocurre ahora mismo.',
          senuelos: acierto ? [] : [{ texto: 'fix', porQue: 'Eso es lo de todos los días.' }],
        },
      });
    }

    const ofende = answer === OFENDE[encargoId!];
    /*
      La respuesta se copia EXACTAMENTE como la manda el servidor: `ofende` va
      DENTRO del feedback y no en el primer nivel, porque el servicio de juegos
      devuelve siempre `{ isCorrect, feedback }` y esa forma la comparten los
      diez juegos. Poner aquí un `ofende` de más lo hacía pasar: jugando de
      verdad, la reputación no bajaba nunca y el marcador de sellos era un
      adorno.
    */
    return Promise.resolve({
      isCorrect: answer === BUENA[encargoId!],
      feedback: {
        message_es:
          answer === BUENA[encargoId!]
            ? '¡Trato hecho!'
            : ofende
              ? 'Le has ofendido.'
              : 'No era eso lo que había que decir.',
        correcta: 'knock a little off',
        significadoEs: 'rebajar un poco del precio',
        dijiste: 'put you off',
        dijisteSignificado: 'quitarle a alguien las ganas',
        ofende,
        leccionEs: 'Knock off es rebajar; put you off es quitarle las ganas.',
      },
    });
  });
}

function renderizar(ronda = rondaDe()) {
  const onFin = vi.fn();
  const onSalir = vi.fn();
  const onResponder = servidorDeMentira();

  render(<Mercado ronda={ronda} onResponder={onResponder} onFin={onFin} onSalir={onSalir} />);

  return { onFin, onSalir, onResponder };
}

/** Coloca en la mesa, tocando, las runas que se le digan. */
async function colocar(usuario: ReturnType<typeof userEvent.setup>, textos: string[]) {
  const cajon = screen.getByRole('list', { name: 'Runas disponibles' });
  for (const texto of textos) {
    await usuario.click(within(cajon).getByRole('button', { name: new RegExp(`${texto}$`) }));
  }
}

describe('El mercado de contrabando', () => {
  it('enseña quién pide, qué pide y el cajón de runas', () => {
    renderizar();

    expect(screen.getByText('La relojera del callejón')).toBeInTheDocument();
    expect(
      screen.getByText('«Que el reloj lo estáis arreglando en este preciso momento.»'),
    ).toBeInTheDocument();

    const cajon = screen.getByRole('list', { name: 'Runas disponibles' });
    expect(within(cajon).getAllByRole('button')).toHaveLength(6);
  });

  /*
    LA PRUEBA QUE DECIDE SI ESTO ENSEÑA. Si el cajón trajera justo las piezas de
    la frase, «colócalas todas» sería la estrategia ganadora y bastaría con
    saber el orden de las palabras inglesas, que no es lo que el encargo pide
    saber. Aquí sobran dos runas, y además de las que sobran ninguna es un
    disparate: `fix` y `every week` caben donde caben las buenas.
  */
  it('en el cajón sobran runas, así que usarlas todas no puede funcionar', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    const cajon = screen.getByRole('list', { name: 'Runas disponibles' });
    const runas = within(cajon).getAllByRole('button');
    for (const runa of runas) await usuario.click(runa);

    await usuario.click(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' }));

    const [, puestas] = onResponder.mock.calls[0]!;
    expect(puestas).toHaveLength(6);
    expect(await screen.findByText('No es lo que pedía.')).toBeInTheDocument();
  });

  /*
    Y la otra fuga: si una runa llegara con mayúscula, la primera posición
    estaría regalada sin saber una palabra de inglés. La mayúscula la pone esta
    pantalla al leer la frase, nunca el contenido.
  */
  it('ninguna runa lleva mayúscula, pero la frase montada sí', async () => {
    const usuario = userEvent.setup();
    renderizar();

    const cajon = screen.getByRole('list', { name: 'Runas disponibles' });
    for (const runa of within(cajon).getAllByRole('button')) {
      expect(runa.textContent?.replace(/^\d/, '').trim()).toMatch(/^[a-z]/);
    }

    await colocar(usuario, ['we', 'are fixing']);
    expect(screen.getByText('We are fixing.')).toBeInTheDocument();
  });

  it('manda al servidor las runas en el orden en que se montaron', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await colocar(usuario, ['we', 'are fixing', 'your watch', 'right now']);
    await usuario.click(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' }));

    expect(onResponder).toHaveBeenCalledWith('e1-forja', ['r1', 'r3', 'r4', 'r6']);
    expect(await screen.findByText('¡Es justo lo que pedía!')).toBeInTheDocument();
  });

  /*
    El párrafo del fallo ES el juego. Quien se equivoca de tiempo verbal tiene
    que irse sabiendo cuál era y por qué la runa que colocó no valía; si no,
    esto es un formulario que dice «mal».
  */
  it('al fallar enseña la frase buena, la tuya y por qué no valía el señuelo', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await colocar(usuario, ['we', 'fix', 'your watch']);
    await usuario.click(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' }));

    expect(await screen.findByText('No es lo que pedía.')).toBeInTheDocument();
    expect(screen.getByText('We are fixing your watch right now.')).toBeInTheDocument();
    expect(screen.getByText('We fix your watch right now.')).toBeInTheDocument();
    expect(screen.getByText(/Eso es lo de todos los días/)).toBeInTheDocument();
    // Y Milo se lleva la lección, que es lo que hay que recordar.
    expect(screen.getByText(/Presente continuo/)).toBeInTheDocument();
  });

  it('una runa puesta se puede sacar de la mesa sin vaciarla entera', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await colocar(usuario, ['we', 'fix', 'your watch']);
    expect(screen.getByText('We fix your watch.')).toBeInTheDocument();

    const objeto = screen.getByRole('list', { name: 'El objeto que forjas' });
    await usuario.click(within(objeto).getByRole('button', { name: 'fix' }));
    await usuario.click(screen.getByRole('button', { name: 'Sacar de la mesa' }));

    expect(screen.getByText('We your watch.')).toBeInTheDocument();
  });

  /*
    Reordenar sin sacar nada es lo que un arrastre haría bien y lo que un
    ordenar-palabras normal no deja hacer: allí, para colocar una pieza en
    medio, hay que sacar todas las de detrás.
  */
  it('y se puede mover de sitio con las flechas de la mesa', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await colocar(usuario, ['are fixing', 'we']);
    expect(screen.getByText('Are fixing we.')).toBeInTheDocument();

    const objeto = screen.getByRole('list', { name: 'El objeto que forjas' });
    await usuario.click(within(objeto).getByRole('button', { name: 'we' }));
    await usuario.click(screen.getByRole('button', { name: 'Mover la runa a la izquierda' }));

    expect(screen.getByText('We are fixing.')).toBeInTheDocument();
  });

  it('se juega entero con el teclado: colocar, quitar y forjar', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    // Los números van por el sitio de la runa en el cajón, y el cajón se
    // renumera al sacar una: por eso las teclas no son siempre las mismas.
    await usuario.keyboard('1'); // we
    await usuario.keyboard('2'); // fix
    await usuario.keyboard('{Backspace}'); // fuera el señuelo
    await usuario.keyboard('2'); // are fixing
    await usuario.keyboard('2'); // your watch
    await usuario.keyboard('3'); // right now

    expect(screen.getByText('We are fixing your watch right now.')).toBeInTheDocument();

    await usuario.keyboard('{Enter}');
    await waitFor(() =>
      expect(onResponder).toHaveBeenCalledWith('e1-forja', ['r1', 'r3', 'r4', 'r6']),
    );
  });

  it('el regateo se contesta con el número y se avisa al servidor', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await colocar(usuario, ['we', 'are fixing', 'your watch', 'right now']);
    await usuario.click(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' }));
    await usuario.click(await screen.findByRole('button', { name: 'A COBRAR' }));

    expect(screen.getByText("«That's a bit steep.»")).toBeInTheDocument();
    await usuario.keyboard('2');

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('e1-regateo', 'o2'));
    expect(await screen.findByText('¡Trato hecho!')).toBeInTheDocument();
  });

  /*
    Los dos fallos del regateo no cuestan lo mismo, igual que en CAEN no cuesta
    lo mismo la cesta equivocada que el suelo: equivocarse de verbo compuesto
    pierde la venta, ofender cuesta además un sello.
  */
  it('ofender al cliente cuesta un sello de reputación', async () => {
    const usuario = userEvent.setup();
    renderizar();

    expect(screen.getByText('Reputación: 3 sellos de 3')).toBeInTheDocument();

    await colocar(usuario, ['we']);
    await usuario.click(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' }));
    await usuario.click(await screen.findByRole('button', { name: 'A COBRAR' }));
    await usuario.click(screen.getByRole('button', { name: /put you off/ }));

    expect(await screen.findByText('Le has ofendido.')).toBeInTheDocument();
    expect(screen.getByText('Reputación: 2 sellos de 3')).toBeInTheDocument();
  });

  it('equivocarse de verbo compuesto sin ofender no cuesta sellos', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await colocar(usuario, ['we']);
    await usuario.click(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' }));
    await usuario.click(await screen.findByRole('button', { name: 'A COBRAR' }));
    await usuario.click(screen.getByRole('button', { name: /take you on/ }));

    expect(await screen.findByText('No era eso lo que había que decir.')).toBeInTheDocument();
    expect(screen.getByText('Reputación: 3 sellos de 3')).toBeInTheDocument();
  });

  it('sin sellos el mercado cierra el puesto antes de tiempo', async () => {
    const usuario = userEvent.setup();
    const ronda = rondaDe();
    ronda.reputacion = 1;
    const { onFin } = renderizar(ronda);

    await colocar(usuario, ['we']);
    await usuario.click(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' }));
    await usuario.click(await screen.findByRole('button', { name: 'A COBRAR' }));
    await usuario.click(screen.getByRole('button', { name: /put you off/ }));

    expect(await screen.findByText(/te cierra el puesto por hoy/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'VER EL RESULTADO' }));

    await waitFor(() => expect(onFin).toHaveBeenCalled());
    // Cerrar antes solo significa menos respuestas, o sea menos puntos: no hay
    // nada que ganar tirando la reputación.
    const marcador = onFin.mock.calls[0]?.[0] as { total: number };
    expect(marcador.total).toBe(2);
  });

  /*
    La puntuación que se ve subir tiene que ser EXACTAMENTE la que cierre el
    servidor. `puntosDelServidor` es la copia a mano de `puntosDe`, y si esta
    cuenta se desviara, la pantalla final pondría otro número.
  */
  it('la puntuación en vivo es la que va a cerrar el servidor', async () => {
    const usuario = userEvent.setup();
    const { onFin } = renderizar();

    for (const encargo of ['e1', 'e2'] as const) {
      const textos =
        encargo === 'e1'
          ? ['we', 'are fixing', 'your watch', 'right now']
          : ['we', 'have already', 'repaired', 'the lamp'];

      await colocar(usuario, textos);
      await usuario.click(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' }));
      await usuario.click(await screen.findByRole('button', { name: 'A COBRAR' }));
      await usuario.click(
        screen.getByRole('button', {
          name: new RegExp(encargo === 'e1' ? 'knock a little off' : 'meet you halfway'),
        }),
      );
      await usuario.click(
        await screen.findByRole('button', { name: /SIGUIENTE CLIENTE|CERRAR EL PUESTO/ }),
      );
    }

    await waitFor(() => expect(onFin).toHaveBeenCalled());

    /*
      Cuatro aciertos seguidos: 4 × 10 de base más la racha al cuadrado por dos,
      que es exactamente lo que calcula `puntosDe` en el servidor para todo lo
      que no sea CADENA ni PAREJAS.
    */
    const marcador = onFin.mock.calls[0]?.[0] as { aciertos: number; puntuacion: number };
    expect(marcador.aciertos).toBe(4);
    expect(marcador.puntuacion).toBe(4 * 10 + 4 * 4 * 2);
  });

  it('si la entrega no llega al servidor no se cuenta nada y se puede repetir', async () => {
    const usuario = userEvent.setup();
    const onResponder = vi
      .fn<(rondaId: string, answer: string | string[]) => Promise<RespuestaDeMercado>>()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValue({ isCorrect: true, feedback: { message_es: '¡Eso es!' } });

    render(
      <Mercado ronda={rondaDe()} onResponder={onResponder} onFin={vi.fn()} onSalir={vi.fn()} />,
    );

    await colocar(usuario, ['we', 'are fixing']);
    await usuario.click(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos entregarlo/);
    // La mesa sigue puesta: no se pierde lo que ya se montó.
    expect(screen.getByText('We are fixing.')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' }));
    expect(await screen.findByText('¡Eso es!')).toBeInTheDocument();
  });

  it('no se puede forjar con la mesa vacía', () => {
    renderizar();
    expect(screen.getByRole('button', { name: 'FORJAR Y ENTREGAR' })).toBeDisabled();
  });

  it('se puede salir a mitad de partida', async () => {
    const usuario = userEvent.setup();
    const { onSalir } = renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Salir del juego' }));
    expect(onSalir).toHaveBeenCalled();
  });
});
