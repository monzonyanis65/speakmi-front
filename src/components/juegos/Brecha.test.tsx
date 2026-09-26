import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Brecha } from './Brecha';
import type { RondaDeBrecha } from './tipos';

/*
  Sin voz inglesa, que es el modo determinista.

  En jsdom no hay sintetizador, así que la partida va por el camino del registro
  escrito: la orden aparece, se pulsa «listo» y empieza la ventana. Es además el
  camino que más falta hace probar, porque es el que evita que a quien no tiene
  voces instaladas se le quede el juego mudo y sin salida.
*/
vi.mock('@/lib/voz', () => ({
  decir: () => Promise.resolve(),
  hayVoz: () => false,
  hayVozInglesa: () => Promise.resolve(false),
  vozInglesaYa: () => 'no' as const,
}));

/**
 * PROTOCOLO DE BRECHA.
 *
 * Lo que se prueba aquí son las cinco cosas que, si se rompen, rompen el juego
 * sin que se note jugando una partida:
 *
 *   1. Que tocar el GEMELO —el aparato idéntico del otro lado del hito— sea una
 *      falla crítica. Si no lo fuera, la preposición sobraría y este juego sería
 *      un test de vocabulario con decorado espacial.
 *   2. Que ejecutar los dos gestos buenos EN EL ORDEN CONTRARIO falle. Es lo
 *      único que separa «X before Y» de «X after Y».
 *   3. Que quedarse sin tiempo se MANDE al servidor. Si se callara, la racha del
 *      servidor no se rompería nunca y pagaría el bono al cuadrado de una
 *      partida en la que se dejaron pasar las difíciles sin tocar nada.
 *   4. Que al fallar se enseñe la orden, lo que significaba y qué había que
 *      pillar. Ese rato ES el juego; sin él esto es un marcador.
 *   5. Que se pueda jugar entero con el teclado. En una ventana de cuatro
 *      segundos, tabular entre seis aparatos no es jugar.
 */

/** Una ventana larguísima: en las pruebas que no van del reloj, que no venza. */
const RELOJ_LARGO = { escalones: [600_000], pasosAtrasAlFallar: 3 };

function rondaDe(reloj: RondaDeBrecha['reloj'] = RELOJ_LARGO): RondaDeBrecha {
  return {
    code: 'BRECHA',
    vidas: 3,
    hitos: { izq: ['screen', 'lamp'], der: ['vent', 'pipe'] },
    reloj,
    ordenes: [
      {
        id: 'o1',
        nivel: 'A2',
        trampa: 'sitio',
        textoEn:
          'First turn the red valve under the screen clockwise. Then open the blue hatch above the pipe.',
        traduccionEs:
          'Primero gira la válvula roja de debajo de la pantalla en el sentido de las agujas del reloj. Luego abre la escotilla azul de encima del tubo.',
        ensena: 'Hay dos válvulas rojas iguales: la que vale es la de DEBAJO de la pantalla.',
        lecturaMs: 30_000,
        // El panel de verdad: la válvula roja está arriba Y en medio, y la
        // escotilla azul en medio Y abajo. Sin la preposición no hay forma de
        // elegir, que es justo lo que hay que probar.
        controles: [
          { id: 'c1', ranura: 'arriba-izq', color: 'red', tipo: 'valve', acciones: ['counter-clockwise', 'clockwise'] }, // prettier-ignore
          { id: 'c2', ranura: 'arriba-der', color: 'green', tipo: 'valve', acciones: ['counter-clockwise', 'clockwise'] }, // prettier-ignore
          { id: 'c3', ranura: 'medio-izq', color: 'red', tipo: 'valve', acciones: ['counter-clockwise', 'clockwise'] }, // prettier-ignore
          { id: 'c4', ranura: 'medio-der', color: 'blue', tipo: 'hatch', acciones: ['open', 'close'] }, // prettier-ignore
          { id: 'c5', ranura: 'abajo-izq', color: 'blue', tipo: 'pump', acciones: ['on', 'off'] },
          { id: 'c6', ranura: 'abajo-der', color: 'blue', tipo: 'hatch', acciones: ['open', 'close'] }, // prettier-ignore
        ],
        pasos: [
          { controlId: 'c3', accion: 'clockwise' },
          { controlId: 'c4', accion: 'open' },
        ],
      },
      {
        id: 'o2',
        nivel: 'A2',
        trampa: 'direccion',
        textoEn: 'Switch on the white pump above the vent.',
        traduccionEs: 'Enciende la bomba blanca de encima de la rejilla.',
        ensena: '«switch on» enciende; «switch off» apagaría.',
        lecturaMs: 30_000,
        controles: [
          { id: 'c1', ranura: 'arriba-izq', color: 'red', tipo: 'valve', acciones: ['counter-clockwise', 'clockwise'] }, // prettier-ignore
          { id: 'c2', ranura: 'arriba-der', color: 'white', tipo: 'pump', acciones: ['on', 'off'] },
          { id: 'c3', ranura: 'medio-izq', color: 'red', tipo: 'valve', acciones: ['counter-clockwise', 'clockwise'] }, // prettier-ignore
          { id: 'c4', ranura: 'medio-der', color: 'white', tipo: 'pump', acciones: ['on', 'off'] },
          { id: 'c5', ranura: 'abajo-izq', color: 'green', tipo: 'pump', acciones: ['on', 'off'] },
          {
            id: 'c6',
            ranura: 'abajo-der',
            color: 'white',
            tipo: 'lever',
            acciones: ['up', 'down'],
          },
        ],
        pasos: [{ controlId: 'c2', accion: 'on' }],
      },
    ],
  };
}

function renderizar(ronda = rondaDe()) {
  const onFin = vi.fn();
  const onSalir = vi.fn();
  const onResponder = vi.fn((_id: string, _secuencia: string[]) =>
    Promise.resolve({ isCorrect: true }),
  );

  render(
    <Brecha
      ronda={ronda}
      onResponder={(id: string, secuencia: string[]) => onResponder(id, secuencia)}
      onFin={onFin}
      onSalir={onSalir}
    />,
  );

  return { onFin, onSalir, onResponder };
}

/** Pasa del informe y del registro escrito a la maniobra. */
async function hastaElPanel(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(await screen.findByRole('button', { name: /ENTENDIDO/ }));
  await usuario.click(await screen.findByRole('button', { name: /LISTO/ }));
}

/** Toca un aparato por su etiqueta accesible y luego uno de sus gestos. */
async function gesto(usuario: ReturnType<typeof userEvent.setup>, aparato: RegExp, accion: RegExp) {
  await usuario.click(screen.getByRole('button', { name: aparato }));
  await usuario.click(await screen.findByRole('button', { name: accion }));
}

describe('Protocolo de brecha', () => {
  /*
    El informe no es ambientación: es donde se aprenden las cuatro palabras que
    anclan todas las preposiciones del juego. Descubrirlas fallando cuesta una
    vida por palabra.
  */
  it('antes de empezar explica el panel y avisa de que la orden irá escrita', async () => {
    renderizar();

    expect(await screen.findByText(/IA de la estación/i)).toBeInTheDocument();
    // Van en minúscula en el marcado y en mayúscula en pantalla: la versalita
    // la pone el CSS, así que buscarlas como se ven no las encontraría.
    for (const hito of ['screen', 'lamp', 'vent', 'pipe']) {
      expect(screen.getAllByText(hito).length).toBeGreaterThan(0);
    }
    // Sin voz inglesa NO se queda mudo: lo dice y sigue jugándose leyendo.
    expect(screen.getByText(/no tiene ninguna voz en inglés/i)).toBeInTheDocument();
  });

  it('dicta la orden, la borra y deja el panel con sus seis aparatos', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: /ENTENDIDO/ }));
    // Dos veces: la que se ve y la que se anuncia para quien no ve la pantalla.
    expect((await screen.findAllByText(/First turn the red valve/)).length).toBeGreaterThan(0);

    await usuario.click(await screen.findByRole('button', { name: /LISTO/ }));

    // Ya no se ve: hay que haberla retenido.
    expect(screen.queryAllByText(/First turn the red valve/)).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /valve|hatch|pump|lever/ }).length).toBe(6);
  });

  it('la secuencia buena estabiliza el sistema y se le manda entera al servidor', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();
    await hastaElPanel(usuario);

    await gesto(usuario, /red valve.*bajo la pantalla/i, /^\d?clockwise$/);
    await gesto(usuario, /blue hatch.*bajo la rejilla/i, /^\d?open$/);

    expect(onResponder).toHaveBeenCalledWith('o1', ['c3:clockwise', 'c4:open']);
    expect((await screen.findAllByText(/Sistema estable/i)).length).toBeGreaterThan(0);
  });

  /*
    LA PRUEBA QUE DECIDE SI EL JUEGO ENSEÑA.

    El gemelo es una válvula roja igual que la buena; lo único que las separa es
    que una está encima de la pantalla y la otra debajo. Si esto no fallara,
    «under the screen» no habría que entenderlo.
  */
  it('tocar el gemelo de enfrente con el gesto bueno es una falla crítica', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();
    await hastaElPanel(usuario);

    await gesto(usuario, /red valve.*sobre la pantalla/i, /^\d?clockwise$/);

    expect(onResponder).toHaveBeenCalledWith('o1', ['c1:clockwise']);
    expect((await screen.findAllByText(/Falla crítica en el paso 1/i)).length).toBeGreaterThan(0);
  });

  it('el aparato bueno con el gesto contrario también revienta', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await hastaElPanel(usuario);

    await gesto(usuario, /red valve.*bajo la pantalla/i, /counter-clockwise/i);

    expect((await screen.findAllByText(/Falla crítica en el paso 1/i)).length).toBeGreaterThan(0);
  });

  /* LA PRUEBA DEL ORDEN: los dos gestos son buenos, lo único mal es cuál va antes. */
  it('los dos gestos buenos al revés son una falla crítica', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await hastaElPanel(usuario);

    await gesto(usuario, /blue hatch.*bajo la rejilla/i, /^\d?open$/);

    expect((await screen.findAllByText(/Falla crítica en el paso 1/i)).length).toBeGreaterThan(0);
  });

  /*
    El rato que enseña. No dice «error»: dice la orden que solo se había leído
    una vez, lo que significaba y qué era exactamente lo que había que pillar.
  */
  it('al fallar enseña la orden, su traducción y qué había que entender', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await hastaElPanel(usuario);

    await gesto(usuario, /red valve.*sobre la pantalla/i, /^\d?clockwise$/);

    expect(await screen.findByText(/Primero gira la válvula roja/)).toBeInTheDocument();
    expect(screen.getByText(/DEBAJO de la pantalla/)).toBeInTheDocument();
    expect(screen.getAllByText(/First turn the red valve/).length).toBeGreaterThan(0);
  });

  /*
    Si quedarse sin tiempo no se mandara, la racha del servidor no se rompería
    nunca y pagaría el bono al cuadrado de una partida que no existió.
  */
  it('quedarse sin tiempo se le manda al servidor como lo que es: un fallo', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar(rondaDe({ escalones: [60], pasosAtrasAlFallar: 3 }));
    await hastaElPanel(usuario);

    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('o1', ['tiempo']));
    expect((await screen.findAllByText(/Se acabó el tiempo/i)).length).toBeGreaterThan(0);
  });

  /*
    El marcador en vivo tiene que ser EXACTAMENTE el que va a cerrar el
    servidor: diez por acierto más la racha al cuadrado por dos. Ver subir 118
    durante la partida y que al final ponga 60 se lee como una estafa.
  */
  it('la puntuación que se enseña es la que va a cerrar el servidor', async () => {
    const usuario = userEvent.setup();
    const { onFin } = renderizar();
    await hastaElPanel(usuario);

    await gesto(usuario, /red valve.*bajo la pantalla/i, /^\d?clockwise$/);
    await gesto(usuario, /blue hatch.*bajo la rejilla/i, /^\d?open$/);

    // Una acertada: 10 de base y 2 de racha (1² × 2).
    expect(await screen.findByText('12')).toBeInTheDocument();

    await usuario.click(await screen.findByRole('button', { name: /SEGUIR/ }));
    await usuario.click(await screen.findByRole('button', { name: /LISTO/ }));
    await gesto(usuario, /white pump.*sobre la rejilla/i, /^\d?on$/);

    // Dos seguidas: 20 de base y 8 de racha (2² × 2).
    expect(await screen.findByText('28')).toBeInTheDocument();

    // Se acabaron las dos órdenes: la partida se cierra con ese mismo número.
    await usuario.click(await screen.findByRole('button', { name: /SEGUIR/ }));
    await waitFor(() =>
      expect(onFin).toHaveBeenCalledWith({ puntuacion: 28, aciertos: 2, total: 2 }),
    );
  });

  it('una falla crítica cuesta una de las tres vidas', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await hastaElPanel(usuario);

    expect(screen.getByText(/Integridad: 3 de 3/)).toBeInTheDocument();

    await gesto(usuario, /red valve.*sobre la pantalla/i, /^\d?clockwise$/);

    expect(await screen.findByText(/Integridad: 2 de 3/)).toBeInTheDocument();
  });

  /*
    Sin teclado este juego no se puede jugar sin tocar la pantalla, y con una
    ventana de cuatro segundos tabular entre seis aparatos y dos gestos no es
    una alternativa: es otro juego, y uno imposible.
  */
  it('se juega entero con el teclado: 1-6 el aparato y 1-2 el gesto', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();
    await hastaElPanel(usuario);

    // c3 es el tercero del panel, o sea la tecla 3; `clockwise` es su segundo
    // gesto, o sea la tecla 2.
    await usuario.keyboard('32');
    await usuario.keyboard('41');

    expect(onResponder).toHaveBeenCalledWith('o1', ['c3:clockwise', 'c4:open']);
  });

  it('el registro de emergencia vuelve a enseñar la orden a mitad de la maniobra', async () => {
    const usuario = userEvent.setup();
    renderizar();
    await hastaElPanel(usuario);

    expect(screen.queryAllByText(/First turn the red valve/)).toHaveLength(0);
    await usuario.click(screen.getByRole('button', { name: /Registro/i }));
    expect(screen.getAllByText(/First turn the red valve/).length).toBeGreaterThan(0);
  });
});
