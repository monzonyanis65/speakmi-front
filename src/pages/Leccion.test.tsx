import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Leccion } from './Leccion';
import { repartoDeLeccion } from '@/lib/reparto';

/*
  Quién da estas dos lecciones NO se escribe a mano: se pregunta.

  Aquí ponía «PET_MILO» y «PET_GATO» porque cuando se escribió el reparto eran
  cinco y a L5-U1-03 le tocaba Milo. Al entrar cuatro personajes más, el sorteo
  cambió y se pusieron rojas seis pruebas que no vigilaban nada de eso: lo que
  comprueban es que la PANTALLA use el guion del reparto, no quién es el de
  turno. Preguntándolo siguen diciendo lo mismo y dejan de romperse cada vez que
  el elenco crece.
*/
const LECCION = 'L5-U1-03';
const QUIEN = repartoDeLeccion(LECCION).protagonista;
const EL_DE_LA_VECINA = repartoDeLeccion('L5-U1-02').protagonista;

/**
 * El reparto dentro de la lección.
 *
 * QUÉ SE APRIETA AQUÍ
 *
 * `reparto.test.ts` ya comprueba el guion: que Nala sea Nala y que el sorteo no
 * sea un sorteo. Lo que se mira aquí es lo otro, que es lo que de verdad se
 * puede perder sin enterarse: que la PANTALLA use ese guion.
 *
 *   - Que enseñe al personaje que le toca, y no al de siempre.
 *   - Que se lo tome como se lo toma ESE personaje, no con una cara genérica.
 *   - Que al terminar no felicite por haber llegado al final.
 *   - Que esté ahí cuando no pasa nada: que se duerma si tardas y se despierte
 *     al tocar.
 *   - Que no se ponga encima del ejercicio.
 *
 *
 * POR QUÉ LA MASCOTA VA FINGIDA
 *
 * El estado de la mascota no aparece por ninguna parte del marcado: se mueve
 * con resortes, y en jsdom no hay fotogramas, así que los once estados se
 * dibujan idénticos. Una prueba que mirara el SVG pasaría siempre.
 *
 * Fingiéndola, lo que se mira es exactamente la decisión de esta pantalla —a
 * quién pone y con qué ánimo—, que es lo suyo. Que ese ánimo luego se vea bien
 * es asunto de `Mascota.test.tsx` y de `mascotas/motor.test.ts`.
 */
interface Fingida {
  especie?: string;
  estado?: string;
  atuendo?: string | null;
}

/** Lo que el componente de verdad recibe, escrito donde se puede mirar. */
function comoSalio({ especie, estado, atuendo }: Fingida) {
  return {
    'data-testid': 'mascota',
    'data-personaje': especie ?? 'LA-EQUIPADA',
    'data-estado': estado,
    // `undefined` y `null` no significan lo mismo: sin decir nada es «la ropa
    // que lleve puesta la persona», y `null` expreso es «este va sin ropa».
    'data-ropa': atuendo === null ? 'ninguna' : 'la-de-tu-mascota',
  };
}

vi.mock('@/components/Mascota', () => ({
  Mascota: (props: Fingida) => <span {...comoSalio(props)} />,
  MascotaConMensaje: (props: Fingida & { mensaje: string }) => (
    <span {...comoSalio(props)}>{props.mensaje}</span>
  ),
}));

/*
  El ejercicio es de otro: aquí se finge con lo mínimo que hace falta para poder
  contestar. Montando el de verdad, esta prueba se pondría roja cada vez que
  alguien tocara un tipo de ejercicio, y entonces dejaría de decir nada sobre el
  reparto, que es lo único que viene a comprobar.
*/
vi.mock('@/components/ejercicios/Ejercicio', () => ({
  Ejercicio: ({ onCambio }: { onCambio: (r: string) => void }) => (
    <button type="button" onClick={() => onCambio('lo que sea')}>
      contestar
    </button>
  ),
}));
vi.mock('@/components/ejercicios/LeerEnVozAlta', () => ({ LeerEnVozAlta: () => null }));
vi.mock('@/components/ejercicios/HablarLibre', () => ({ HablarLibre: () => null }));
vi.mock('@/components/Confeti', () => ({ Confeti: () => null }));

const EJERCICIO = {
  code: 'EJ-1',
  type: 'fill_blank',
  difficulty: 1,
  prompt: { text: 'She ___ a doctor.' },
};

const BIEN = {
  isCorrect: true,
  score: 1,
  feedback: { message_es: 'Eso es.', errores: [] },
};

const MAL = {
  isCorrect: false,
  score: 0,
  feedback: { message_es: 'Ahí va «is».', correcta: 'She is a doctor.', errores: [] },
};

let corrigeComo: typeof BIEN | typeof MAL = BIEN;
let resultadoFinal = { score: 1, total: 2, accuracy: 0.5, xpEarned: 10 };

function respuesta(cuerpo: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) });
}

function servidor(cuantos = 1) {
  return vi.fn((url: unknown) => {
    const ruta = String(url);
    if (ruta.includes('/curriculum/lessons/')) {
      return respuesta({
        lesson: { code: 'L5-U1-03', titleEs: 'El verbo to be', type: 'grammar', xpReward: 10 },
        skills: [],
        exercises: Array.from({ length: cuantos }, (_, i) => ({
          ...EJERCICIO,
          code: `EJ-${i + 1}`,
        })),
      });
    }
    if (ruta.endsWith('/sessions/start')) return respuesta({ sessionId: 'ses-1' });
    if (ruta.endsWith('/answer')) return respuesta(corrigeComo);
    if (ruta.endsWith('/finish')) return respuesta(resultadoFinal);
    return respuesta({});
  });
}

function abrir(codigo: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[`/leccion/${codigo}`]}>
        <Routes>
          <Route path="/leccion/:code" element={<Leccion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** El de la tira de arriba: el único que no está dentro del panel de corrección. */
function elQueAcompana(): HTMLElement {
  const panel = screen.queryByRole('status');
  const todas = screen.getAllByTestId('mascota');
  const fuera = todas.filter((m) => !panel?.contains(m));
  return fuera[0]!;
}

async function contestar(quien: ReturnType<typeof userEvent.setup>) {
  await quien.click(screen.getByRole('button', { name: 'contestar' }));
  await quien.click(screen.getByRole('button', { name: 'COMPROBAR' }));
  await screen.findByRole('status');
}

beforeEach(() => {
  corrigeComo = BIEN;
  resultadoFinal = { score: 1, total: 2, accuracy: 0.5, xpEarned: 10 };
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('quién da la clase', () => {
  it('la misma lección enseña siempre al mismo, y otra lección a otro', async () => {
    /*
      Esto es lo que se rompe con el código de antes: la lección pintaba
      `<Mascota />` sin decir cuál, así que salía la que la persona lleva puesta
      —siempre la misma, entre por donde entre— y la lección no tenía a nadie.

      Los códigos están escritos a mano a propósito. Que L5-U1-03 sea Milo es
      justamente lo que hay que poder dar por hecho: si alguien cambia el
      revoltijo, se le baraja el profesor a las trescientas lecciones del curso
      y tiene que enterarse aquí.
    */
    vi.stubGlobal('fetch', servidor());

    const primera = abrir('L5-U1-03');
    await screen.findByRole('button', { name: 'contestar' });
    expect(elQueAcompana()).toHaveAttribute('data-personaje', QUIEN.especie);
    primera.unmount();

    // Y al volver, el mismo. No se sortea al entrar.
    const otraVez = abrir('L5-U1-03');
    await screen.findByRole('button', { name: 'contestar' });
    expect(elQueAcompana()).toHaveAttribute('data-personaje', QUIEN.especie);
    otraVez.unmount();

    const vecina = abrir('L5-U1-02');
    await screen.findByRole('button', { name: 'contestar' });
    expect(elQueAcompana()).toHaveAttribute('data-personaje', EL_DE_LA_VECINA.especie);
    vecina.unmount();
  });

  it('el personaje de la lección no lleva la ropa de tu mascota', async () => {
    /*
      El gorro se compra para la mascota que llevas puesta, que es tuya. Quien
      da la clase no lo es: vestirlo con tu ropa es ponerle tu gorro a otro, y
      encima confunde las dos cosas —la tuya y la de la lección— justo cuando
      por primera vez hay dos animales distintos en la misma pantalla.
    */
    vi.stubGlobal('fetch', servidor());
    abrir('L5-U1-03');
    await screen.findByRole('button', { name: 'contestar' });
    expect(elQueAcompana()).toHaveAttribute('data-ropa', 'ninguna');
  });
});

describe('cómo se lo toma', () => {
  it('al fallar ni riñe ni se compadece: pone SU cara, no una genérica', async () => {
    /*
      Antes, cualquiera que fallara veía a la mascota `triste`. Poner cara de
      pena es decir «pobre», y eso convierte una frase mal escrita en un
      suspenso, que es justo lo contrario de lo que hace el resto de la
      aplicación —el error se explica y se sigue, sin bloquear el avance—.

      Se comprueban las dos mitades: que no sea `triste`, y que sea la que ese
      personaje tiene escrita. Sin la segunda, valdría con cambiar `triste` por
      otra cara única para todos y el reparto seguiría sin existir.
    */
    corrigeComo = MAL;
    vi.stubGlobal('fetch', servidor());
    const quien = userEvent.setup();

    abrir('L5-U1-03');
    await screen.findByRole('button', { name: 'contestar' });
    await contestar(quien);

    const enElPanel = within(screen.getByRole('status')).getByTestId('mascota');
    expect(enElPanel).not.toHaveAttribute('data-estado', 'triste');
    expect(enElPanel).toHaveAttribute('data-estado', QUIEN.animo.fallo);
  });

  it('acertar algo fácil no se celebra igual que acertar algo difícil', async () => {
    // Reaccionar igual a lo fácil y a lo difícil deja la reacción sin valor: es
    // la versión con dibujos de felicitar por todo.
    vi.stubGlobal('fetch', servidor());
    const quien = userEvent.setup();

    abrir('L5-U1-03');
    await screen.findByRole('button', { name: 'contestar' });
    await contestar(quien);

    expect(within(screen.getByRole('status')).getByTestId('mascota')).toHaveAttribute(
      'data-estado',
      QUIEN.animo.acierto,
    );
    expect(QUIEN.animo.acierto).not.toBe(QUIEN.animo.racha);
  });
});

describe('estar ahí sin dar la turra', () => {
  it('se duerme si tardas y se despierta en cuanto tocas algo', async () => {
    /*
      Sin esto, el personaje respira y nada más, y a los dos minutos se lee como
      una ilustración con un efecto encima. Los tiempos los pone la `paciencia`
      de cada uno: Milo aguanta doce segundos antes de aburrirse y el triple
      antes de dormirse.
    */
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', servidor());
    const quien = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    abrir('L5-U1-03');
    await screen.findByRole('button', { name: 'contestar' });

    const paciencia = QUIEN.paciencia;
    await act(async () => {
      vi.advanceTimersByTime(paciencia * 1000 + 500);
    });
    expect(elQueAcompana()).toHaveAttribute('data-estado', QUIEN.animo.espera);

    await act(async () => {
      vi.advanceTimersByTime(paciencia * 2000 + 500);
    });
    expect(elQueAcompana()).toHaveAttribute('data-estado', QUIEN.animo.sopor);

    // Y al escribir, se entera.
    await quien.keyboard('a');
    expect(elQueAcompana()).toHaveAttribute('data-estado', QUIEN.animo.atento);
  });

  it('con movimiento reducido se queda quieto, pero sigue reaccionando', async () => {
    /*
      La regla es que con `prefers-reduced-motion` no puede faltar INFORMACIÓN,
      solo el baile. Que se aburra no es información: es compañía, y quien pide
      menos estímulo está pidiendo exactamente que eso no pase. Que se haya
      fallado un ejercicio sí lo es, así que la reacción se queda.
    */
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    corrigeComo = MAL;
    vi.stubGlobal('fetch', servidor());
    const quien = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    abrir('L5-U1-03');
    await screen.findByRole('button', { name: 'contestar' });

    await act(async () => {
      vi.advanceTimersByTime(QUIEN.paciencia * 4000);
    });
    expect(elQueAcompana()).toHaveAttribute('data-estado', QUIEN.animo.reposo);

    await contestar(quien);
    expect(within(screen.getByRole('status')).getByTestId('mascota')).toHaveAttribute(
      'data-estado',
      QUIEN.animo.fallo,
    );
  });

  it('el que acompaña está en el flujo, no encima del ejercicio', async () => {
    /*
      En 320 px el sitio es el que es. Un personaje flotando en una esquina es
      lo primero que se le ocurre a cualquiera y es lo que tapa el último
      renglón del enunciado justo en la pantalla donde más falta hace verlo.

      Se comprueba de dos maneras porque una sola se esquiva sin querer: que no
      esté DENTRO del ejercicio, y que su tira no esté sacada del flujo con
      posición fija o absoluta. Lo que ocupa de verdad se mide en el navegador;
      esto es lo que se puede afirmar aquí.
    */
    vi.stubGlobal('fetch', servidor());
    abrir('L5-U1-03');
    await screen.findByRole('button', { name: 'contestar' });

    const acompana = elQueAcompana();
    expect(screen.getByRole('main').contains(acompana)).toBe(false);

    for (let nodo = acompana.parentElement; nodo; nodo = nodo.parentElement) {
      expect(nodo.className, 'la tira se sacó del flujo').not.toMatch(/\b(fixed|absolute)\b/);
    }
  });

  it('no comenta cada acierto: habla cada tres', async () => {
    /*
      Un comentario por respuesta deja de ser un comentario y pasa a ser el
      ruido de fondo de la pantalla. Y además la corrección del servidor ya está
      escrita justo debajo: dos textos a la vez sobre lo mismo se leen a la
      mitad.
    */
    vi.stubGlobal('fetch', servidor(6));
    const quien = userEvent.setup();
    const { protagonista } = repartoDeLeccion('L5-U1-03');

    abrir('L5-U1-03');
    await screen.findByRole('button', { name: 'contestar' });

    // La de entrada, que es la única que se pone sola.
    await waitFor(() => {
      expect(protagonista.dice.entra).toContain(elQueAcompana().parentElement?.textContent);
    });

    for (let vuelta = 1; vuelta <= 3; vuelta += 1) {
      await contestar(quien);
      const dicho = elQueAcompana().parentElement?.textContent ?? '';
      if (vuelta < 3) {
        expect(protagonista.dice.racha, `habló en el acierto ${vuelta}`).not.toContain(dicho);
      } else {
        expect(protagonista.dice.racha).toContain(dicho);
      }
      await quien.click(screen.getByRole('button', { name: 'CONTINUAR' }));
    }
  });
});

describe('cómo se despide', () => {
  it('al terminar no felicita por haber llegado al final', async () => {
    /*
      El titular de antes era «¡Muy bien!», «Vas bien» o «Sigue practicando»
      según el porcentaje: felicitar por existir con tres adjetivos distintos, y
      el tercero encima con cara de consuelo. Es la misma regla que tiene
      escrita el tutor en el servidor y que en esta pantalla no se estaba
      cumpliendo.

      Lo que de verdad dice cómo ha ido son los dos números, que ya estaban.
    */
    vi.stubGlobal('fetch', servidor());
    const quien = userEvent.setup();
    const { protagonista, secundario } = repartoDeLeccion('L5-U1-03');

    abrir('L5-U1-03');
    await screen.findByRole('button', { name: 'contestar' });
    await contestar(quien);
    await quien.click(screen.getByRole('button', { name: 'TERMINAR' }));

    const titular = await screen.findByRole('heading', { level: 1 });
    expect(protagonista.dice.final).toContain(titular.textContent);

    for (const halago of ['¡Muy bien!', 'Vas bien', 'Sigue practicando']) {
      expect(screen.queryByText(halago), `sigue felicitando: «${halago}»`).toBeNull();
    }
    // El dato sí se queda: es lo único que dice cómo fue sin adjetivos.
    expect(screen.getByText('Acertaste 1 de 2')).toBeInTheDocument();

    // Y salen los dos: hasta que no ves a dos juntos con caras distintas, no
    // hay reparto, hay una mascota.
    const caras = screen.getAllByTestId('mascota').map((m) => m.getAttribute('data-personaje'));
    expect(caras).toContain(protagonista.especie);
    expect(caras).toContain(secundario.especie);
  });
});
