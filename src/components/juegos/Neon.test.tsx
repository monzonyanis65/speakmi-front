import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Neon } from './Neon';
import type { RondaDeNeon, VeredictoDeNeon } from './tipos';

/**
 * NEON.
 *
 * Lo que se examina aquí no es que se puedan pulsar botones, sino las cuatro
 * cosas de las que depende que este juego sea lo que dice ser:
 *
 *   1. que el expediente se pueda consultar SIEMPRE, porque si no es una
 *      prueba de memoria disfrazada de comprensión lectora;
 *   2. que fallar enseñe: la línea que desmiente lo que elegiste, no un «no»;
 *   3. que equivocarse de registro CIERRE al sospechoso de verdad y se pierdan
 *      sus preguntas, que es la consecuencia que se pidió;
 *   4. que el marcador que sube sea el que cierra el servidor, y que una
 *      respuesta que no llega no cuente ni para bien ni para mal.
 *
 * El servidor va de mentira, pero contesta lo mismo que contestaría el de
 * verdad: `corregirPaso` en `back/src/modules/games/neon.ts`.
 */

const RONDA: RondaDeNeon = {
  code: 'NEON',
  recelosParaCerrarse: 2,
  caso: {
    casoId: 'caso-prueba',
    titulo: 'Nueve bandejas',
    gancho: 'Alguien se llevó nueve bandejas y uno lo sabía antes de tiempo.',
    lugar: 'Torre de cultivo, planta 41',
    documentos: [
      {
        id: 'd1',
        tipo: 'correo',
        titulo: 'Correo interno',
        de: 'Dalia Reyk',
        cuando: '06:12',
        lineas: ['We lost part of the Amphora stock last night.'],
        glosario: [{ en: 'stock', es: 'las existencias' }],
      },
      {
        id: 'd2',
        tipo: 'registro',
        titulo: 'Registro de puertas',
        lineas: ['04:02 Rack C sealed.'],
        glosario: [],
      },
    ],
    personas: [
      {
        id: 'p2',
        nombre: 'Teodor Vasch',
        cargo: 'Técnico de noche',
        comoTratarle: 'Se abre con quien le habla de igual a igual y se cierra con el trato de empresa.', // prettier-ignore
      },
    ],
    pasos: [
      {
        id: 'e1',
        fase: 'expediente',
        tipo: 'cruce',
        enunciado: '¿Qué dos frases no pueden ser ciertas a la vez?',
        cita: { docId: 'd2', texto: '04:02 Rack C sealed.' },
        opciones: [
          { texto: 'La cifra y la hora en que se publicó.' },
          { texto: 'El correo de Reyk y su hora de llegada.' },
        ],
      },
      {
        id: 'i1t1',
        fase: 'interrogatorio',
        personaId: 'p2',
        enunciado: 'Que vuelva a hablar.',
        objetivo: 'Que vuelva a hablar.',
        dice: 'I already put everything in writing.',
        traduccion: 'Ya lo puse todo por escrito.',
        avisoDeMilo: 'Cuidado con este: se cierra en una frase.',
        opciones: [
          { texto: 'Nobody knows that floor like you do. Talk me through it.' },
          { texto: 'Mr Vasch, would you mind repeating the account for the record?' },
        ],
      },
      {
        id: 'i1t2',
        fase: 'interrogatorio',
        personaId: 'p2',
        enunciado: 'Que explique las seis horas.',
        objetivo: 'Que explique las seis horas.',
        dice: 'I counted at eleven and I went to the lock.',
        traduccion: 'Conté a las once y me fui a la esclusa.',
        opciones: [
          { texto: 'Six hours. What does a man do up here at two in the morning?' },
          { texto: 'Could you account for your whereabouts between 23:10 and 05:50?' },
        ],
      },
      {
        id: 'i1t3',
        fase: 'interrogatorio',
        personaId: 'p2',
        enunciado: 'Que diga cómo supo la cifra.',
        objetivo: 'Que diga cómo supo la cifra.',
        dice: 'One pallet. Sealed.',
        traduccion: 'Un palé. Precintado.',
        opciones: [
          { texto: 'Where does a man get a number like that?' },
          { texto: 'Would you be so kind as to clarify how you obtained the figure?' },
        ],
      },
      {
        id: 'acusacion',
        fase: 'acusacion',
        enunciado: '¿A quién acusas?',
        opciones: [{ texto: 'Teodor Vasch.' }, { texto: 'Dalia Reyk.' }],
      },
    ],
  },
};

/** El servidor de mentira: la opción 0 es siempre la buena. */
function servidorQueDaPorBuenaLaPrimera(): (id: string, r: string) => Promise<VeredictoDeNeon> {
  return (rondaId: string, respuesta: string) => {
    const acerto = respuesta === '0';
    const paso = RONDA.caso.pasos.find((uno) => uno.id === rondaId)!;

    return Promise.resolve({
      isCorrect: acerto,
      feedback: {
        message_es: acerto ? 'Ahí está la grieta.' : 'El expediente dice otra cosa.',
        porQue: 'Porque las horas no cuadran.',
        ...(acerto ? {} : { correcta: paso.opciones[0]!.texto, refuta: 'El registro empieza a las 04:02.' }), // prettier-ignore
        ...(paso.fase === 'interrogatorio'
          ? {
              reaccion: acerto ? 'He leans back.' : 'It is all in the email.',
              ...(acerto ? { revelacion: 'Hizo el recuento solo.' } : {}),
            }
          : {}),
        ...(paso.id === 'acusacion' ? { cierre: 'Vasch apuntó la estantería llena.' } : {}),
      },
    });
  };
}

async function empezar(
  onResponder = vi.fn(servidorQueDaPorBuenaLaPrimera()),
  ronda: RondaDeNeon = RONDA,
) {
  const usuario = userEvent.setup();
  const onFin = vi.fn();
  const onSalir = vi.fn();

  render(<Neon ronda={ronda} onResponder={onResponder} onFin={onFin} onSalir={onSalir} />);

  await usuario.click(screen.getByRole('button', { name: /ABRIR EL EXPEDIENTE/ }));

  return { usuario, onFin, onSalir, onResponder };
}

describe('Neon', () => {
  it('empieza por el caso y no por el expediente', async () => {
    const usuario = userEvent.setup();
    render(
      <Neon
        ronda={RONDA}
        onResponder={servidorQueDaPorBuenaLaPrimera()}
        onFin={vi.fn()}
        onSalir={vi.fn()}
      />,
    );

    expect(screen.getByText('Nueve bandejas')).toBeInTheDocument();
    expect(screen.getByText(/Alguien se llevó nueve bandejas/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /ABRIR EL EXPEDIENTE/ }));
    expect(screen.getByText('¿Qué dos frases no pueden ser ciertas a la vez?')).toBeInTheDocument();
  });

  /*
    Es la diferencia entre comprensión lectora y memoria. Si el expediente no
    está a mano mientras se contesta, lo que se mide es si te has aprendido
    cuatro documentos, que no es lo que este juego dice entrenar.
  */
  it('el expediente se consulta a media pregunta y se vuelve sin perder nada', async () => {
    const { usuario } = await empezar();

    await usuario.click(screen.getByRole('tab', { name: /Expediente/ }));
    expect(screen.getByText('We lost part of the Amphora stock last night.')).toBeInTheDocument();
    expect(screen.getByText('las existencias')).toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: /^Caso/ }));
    expect(screen.getByText('¿Qué dos frases no pueden ser ciertas a la vez?')).toBeInTheDocument();
  });

  it('la tecla E abre y cierra el expediente', async () => {
    const { usuario } = await empezar();

    await usuario.keyboard('e');
    expect(screen.getByText('We lost part of the Amphora stock last night.')).toBeInTheDocument();

    await usuario.keyboard('e');
    expect(screen.getByText('¿Qué dos frases no pueden ser ciertas a la vez?')).toBeInTheDocument();
  });

  it('se juega entero con el teclado: números para elegir e Intro para seguir', async () => {
    const { usuario, onResponder } = await empezar();

    await usuario.keyboard('1');
    await waitFor(() => expect(onResponder).toHaveBeenCalledWith('e1', '0'));
    expect(await screen.findByText('Ahí está la grieta.')).toBeInTheDocument();

    await usuario.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByText(/I already put everything in writing/)).toBeInTheDocument(),
    );
  });

  /*
    Lo único que este juego tiene que dar al fallar. Un «no era esa» deja a la
    persona igual que estaba; la línea del expediente que desmiente lo elegido
    es lo que convierte el fallo en una lectura que faltaba por hacer.
  */
  it('al fallar enseña la línea que desmiente lo elegido y cuál era la buena', async () => {
    const { usuario } = await empezar();

    await usuario.keyboard('2');

    expect(await screen.findByText('El expediente dice otra cosa.')).toBeInTheDocument();
    expect(screen.getByText('El registro empieza a las 04:02.')).toBeInTheDocument();
    /*
      Dos veces: marcada en verde entre las opciones y escrita en el veredicto.
      Las dos hacen falta, y por motivos distintos: la de arriba enseña dónde
      estaba y la de abajo se puede leer sin tener que buscarla.
    */
    expect(screen.getAllByText('La cifra y la hora en que se publicó.')).toHaveLength(2);
  });

  it('la ficha de cómo tratar al sospechoso está a la vista al interrogar', async () => {
    const { usuario } = await empezar();

    await usuario.keyboard('1');
    await usuario.keyboard('{Enter}');

    expect(await screen.findByText('Ficha de personal')).toBeInTheDocument();
    expect(screen.getByText(/se abre con quien le habla de igual a igual/i)).toBeInTheDocument();
    expect(screen.getByText(/Cuidado con este/)).toBeInTheDocument();
  });

  /*
    LA consecuencia del juego, y la que se pidió: errar el registro no resta
    puntos, cierra puertas. Dos deslices con la misma persona y se levanta,
    así que sus preguntas dejan de jugarse y sus puntos no se ganan.
  */
  it('dos errores de registro con el mismo sospechoso le cierran y saltan sus turnos', async () => {
    const { usuario, onResponder, onFin } = await empezar();

    // La deducción, bien, para llegar al interrogatorio.
    await usuario.keyboard('1');
    await usuario.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByText(/I already put everything in writing/)).toBeInTheDocument(),
    );

    // Primer desliz de registro.
    await usuario.keyboard('2');
    expect(await screen.findByText('El expediente dice otra cosa.')).toBeInTheDocument();
    await usuario.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText(/I counted at eleven/)).toBeInTheDocument());

    // Segundo: se levanta.
    await usuario.keyboard('2');
    expect(await screen.findByText(/Teodor Vasch se levanta/)).toBeInTheDocument();

    /*
      El contador, que tuvo un fallo que solo se veía jugando: al cerrarse un
      sospechoso, sus preguntas ya contestadas dejaban de contar y el número
      RETROCEDÍA. Aquí van tres contestadas de cuatro que quedan jugables —de
      las cinco del caso se pierde una—, y la tercera sigue siendo la tercera.
    */
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('/4')).toBeInTheDocument();

    // Y el tercer turno ya no se juega: se salta directo a la acusación.
    await usuario.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('¿A quién acusas?')).toBeInTheDocument());

    expect(onResponder).not.toHaveBeenCalledWith('i1t3', expect.anything());

    await usuario.keyboard('1');
    await usuario.keyboard('{Enter}');

    await waitFor(() => expect(onFin).toHaveBeenCalled());
    const marcador = onFin.mock.calls[0]![0] as { aciertos: number; total: number };
    // Cuatro contestadas de las cinco del caso: la que se perdió no cuenta ni
    // como acierto ni como fallo, porque no llegó a preguntarse.
    expect(marcador.total).toBe(4);
    expect(marcador.aciertos).toBe(2);
  });

  /*
    El marcador de la pantalla tiene que ser EXACTAMENTE el que cierra el
    servidor. Diez por acierto más la racha al cuadrado por dos, que es la misma
    fórmula de `puntosDe` en el servidor.
  */
  it('el marcador en vivo es el mismo que cierra la partida', async () => {
    const { usuario, onFin } = await empezar();

    for (const id of ['e1', 'i1t1', 'i1t2', 'i1t3', 'acusacion']) {
      await usuario.keyboard('1');
      await screen.findByRole('button', { name: /SEGUIR|CERRAR EL CASO/ });
      // Cinco aciertos seguidos: 5 × 10 + 5² × 2 = 100.
      if (id === 'acusacion') expect(screen.getByText('100')).toBeInTheDocument();
      await usuario.keyboard('{Enter}');
    }

    await waitFor(() => expect(onFin).toHaveBeenCalled());
    const marcador = onFin.mock.calls[0]![0] as { puntuacion: number; aciertos: number };
    expect(marcador.aciertos).toBe(5);
    expect(marcador.puntuacion).toBe(100);
  });

  /*
    Si la respuesta no llega al servidor, no cuenta. Es lo contrario de lo que
    hacen los juegos con reloj, que pintan el veredicto y mandan el aviso por
    detrás porque no pueden esperar. Aquí se puede esperar, así que el número de
    la pantalla no se despega nunca del que apunta el servidor.
  */
  it('una respuesta que no llega no cuenta, y se puede reintentar', async () => {
    const bueno = servidorQueDaPorBuenaLaPrimera();
    let falla = true;
    const onResponder = vi.fn((id: string, r: string) => {
      if (falla) {
        falla = false;
        return Promise.reject(new Error('sin red'));
      }
      return bueno(id, r);
    });

    const { usuario } = await empezar(onResponder);

    await usuario.keyboard('1');
    expect(await screen.findByText(/No pudimos mandar esa respuesta/)).toBeInTheDocument();
    // Ni un punto: el servidor no se ha enterado de nada.
    expect(screen.getByText('0')).toBeInTheDocument();

    await usuario.keyboard('1');
    expect(await screen.findByText('Ahí está la grieta.')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('lo que sueltan los sospechosos queda anotado en la libreta', async () => {
    const { usuario } = await empezar();

    await usuario.keyboard('1');
    await usuario.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByText(/I already put everything in writing/)).toBeInTheDocument(),
    );
    await usuario.keyboard('1');
    expect(await screen.findByText(/Hizo el recuento solo/)).toBeInTheDocument();

    await usuario.keyboard('{Enter}');
    await usuario.keyboard('e');

    expect(screen.getByText(/Libreta \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('Hizo el recuento solo.')).toBeInTheDocument();
  });

  it('la acusación cierra el caso contando qué pasó de verdad', async () => {
    const { usuario } = await empezar();

    for (const _ of [0, 1, 2, 3]) {
      await usuario.keyboard('1');
      await screen.findByRole('button', { name: /SEGUIR/ });
      await usuario.keyboard('{Enter}');
    }

    await waitFor(() => expect(screen.getByText('¿A quién acusas?')).toBeInTheDocument());
    await usuario.keyboard('1');

    expect(await screen.findByText('Vasch apuntó la estantería llena.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CERRAR EL CASO' })).toBeInTheDocument();
  });

  it('se puede salir en cualquier momento', async () => {
    const { usuario, onSalir } = await empezar();

    await usuario.click(screen.getByRole('button', { name: 'Salir del juego' }));
    expect(onSalir).toHaveBeenCalled();
  });
});
