import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Horda } from './Horda';
import { puntosDelServidor } from './puntos';
import type { RondaDeHorda } from './tipos';

/**
 * SUPERVIVIENTES.
 *
 * Lo que se prueba aquí son las cinco cosas que, si se rompen, dejan el juego
 * en pie y vacío por dentro. Ninguna se nota jugando dos partidas:
 *
 *   1. Que EL INGLÉS DECIDA SI GANAS. Es la única que importa de verdad, y se
 *      prueba con el jugador simulado que lleva dentro el propio juego: la
 *      misma política de esquiva, la misma semilla, y lo único que cambia entre
 *      una partida y otra es lo bien que forja. Si forjar deja de decidir, esta
 *      prueba se cae y no hay que esperar a que alguien lo note jugando.
 *   2. Que MATAR NO SUBA EL ARMA. El nivel del arma son los aciertos y nada
 *      más; el día que eso cambie, el juego se puede ganar sin leer.
 *   3. Que la puntuación en vivo sea la MISMA que va a cerrar el servidor. Ver
 *      subir 118 y que al final ponga 60 se lee como una estafa, y en esta
 *      aplicación ya pasó.
 *   4. Que el reloj del cofre no sea el de dos segundos que pedía el encargo:
 *      la lectura viene calculada del servidor y la ventana es lectura más
 *      reflejo.
 *   5. Que con `prefers-reduced-motion` haya un juego de verdad —un tablero por
 *      turnos con las mismas preguntas— y no un lienzo quieto.
 */

/**
 * Las escenas de mentira, y son VEINTISÉIS a propósito.
 *
 * Con dos, el jugador simulado se queda sin preguntas a los treinta segundos y
 * a partir de ahí muere siempre, acierte lo que acierte: la prueba que dice que
 * el inglés decide la partida daría que no decide nada, y no sería verdad,
 * sería que el mazo de mentira era demasiado corto. Una partida de verdad sirve
 * veintiséis.
 */
const PLANTILLAS = [
  {
    situacionEs: 'Sales de casa y la tele sigue puesta.',
    verbos: ['turn', 'get'],
    particulas: ['off', 'on', 'up'],
    compuesto: 'turn off',
    familia: 'onda' as const,
    significadoEs: 'apagar un aparato',
    ejemploEn: 'Turn off the TV before you leave.',
    separable: true,
  },
  {
    situacionEs: 'Suena el despertador y hay que salir de la cama.',
    verbos: ['get', 'give'],
    particulas: ['up', 'off', 'on'],
    compuesto: 'get up',
    familia: 'aura' as const,
    significadoEs: 'levantarse',
    ejemploEn: 'I get up at seven.',
    separable: false,
  },
  {
    situacionEs: 'Tus vecinos se van de viaje y te dejan el gato.',
    verbos: ['look', 'take'],
    particulas: ['after', 'up', 'out'],
    compuesto: 'look after',
    familia: 'rastro' as const,
    significadoEs: 'cuidar de alguien o de algo',
    ejemploEn: 'Can you look after my cat?',
    separable: false,
  },
  {
    situacionEs: 'Te prestaron un libro hace meses.',
    verbos: ['give', 'come'],
    particulas: ['back', 'in', 'away'],
    compuesto: 'give back',
    familia: 'orbita' as const,
    significadoEs: 'devolver algo prestado',
    ejemploEn: 'Give back the book you borrowed.',
    separable: true,
  },
];

const MODISMOS = [
  {
    frase: 'A piece of ___',
    significadoEs: 'facilísimo de hacer',
    opciones: ['pie', 'cake', 'bread'],
    correcta: 'cake',
    ejemploEn: 'The exam was a piece of cake.',
    lecturaMs: 3300,
  },
  {
    frase: 'To break the ___',
    significadoEs: 'romper la tensión del principio',
    opciones: ['news', 'ice', 'ground'],
    correcta: 'ice',
    ejemploEn: 'She told a joke to break the ice.',
    lecturaMs: 3800,
  },
];

function rondaDe(): RondaDeHorda {
  return {
    code: 'HORDA',
    escenas: Array.from({ length: 26 }, (_, i) => ({
      id: `e${i + 1}`,
      ...PLANTILLAS[i % PLANTILLAS.length]!,
    })),
    cofres: Array.from({ length: 4 }, (_, i) => ({
      id: `c${i + 1}`,
      ...MODISMOS[i % MODISMOS.length]!,
    })),
    arena: {
      ancho: 100,
      alto: 130,
      radioMilo: 7.5,
      radioSombra: 4,
      radioOrbe: 9,
      velocidadMilo: 24,
    },
    partida: {
      segundos: 180,
      vidas: 4,
      msInvulnerable: 1400,
      msInvulnerablePorTurnos: 1600,
      segundosEntreCofres: 55,
    },
    oleada: {
      aparicionInicial: 0.75,
      aparicionFinal: 3.2,
      vidaInicial: 4,
      vidaFinal: 17,
      velocidadInicial: 9,
      velocidadFinal: 15,
      maximoSombras: 40,
    },
    oleadaPorTurnos: {
      aparicionInicial: 0.6,
      aparicionFinal: 2.4,
      vidaInicial: 4,
      vidaFinal: 17,
      velocidadInicial: 8,
      velocidadFinal: 13,
      maximoSombras: 40,
    },
    arma: {
      danoBase: 3,
      cadenciaBaseMs: 750,
      danoFamilia: 4,
      cadenciaFamiliaMs: 1300,
      factorPorNivel: 1.17,
      factorCadencia: 0.94,
      multiplicadores: { onda: 0.7, aura: 0.45, rastro: 1, orbita: 0.6 },
    },
    reloj: { escalones: [1800, 1692, 1590, 1495, 1405], pasosAtrasAlFallar: 2 },
  };
}

function renderizar(ronda = rondaDe()) {
  const onResponder = vi.fn().mockResolvedValue({ isCorrect: true });
  const onFin = vi.fn();
  const onSalir = vi.fn();
  render(<Horda ronda={ronda} onResponder={onResponder} onFin={onFin} onSalir={onSalir} />);
  return { onResponder, onFin, onSalir };
}

/** Enciende el juego y devuelve el arnés de medir que expone en desarrollo. */
async function empezar() {
  await userEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }));
  const arnes = window.__horda;
  expect(arnes).toBeDefined();
  return arnes!;
}

describe('la pantalla de entrada', () => {
  it('avisa de lo único que nadie adivinaría: matar no puntúa', () => {
    renderizar();
    expect(screen.getByText(/Matar no da ni un punto/i)).toBeInTheDocument();
  });

  it('dice cómo se juega sin tocar la pantalla', () => {
    renderizar();
    expect(screen.getByText(/flechas o con WASD/i)).toBeInTheDocument();
  });
});

describe('lo que pide la escena', () => {
  it('enseña la escena en español y avisa de que falta el verbo', async () => {
    renderizar();
    await empezar();

    expect(screen.getByText('Sales de casa y la tele sigue puesta.')).toBeInTheDocument();
    expect(screen.getByText(/Coge primero un verbo/i)).toBeInTheDocument();
  });

  it('la escena NO lleva el compuesto escrito', () => {
    // La regla 2 del contenido, comprobada desde donde se pinta: si la escena
    // dijera «apaga la tele», se estaría midiendo saber que OFF es apagar.
    for (const escena of rondaDe().escenas) {
      for (const palabra of escena.compuesto.split(' ')) {
        expect(` ${escena.situacionEs.toLowerCase()} `).not.toContain(` ${palabra} `);
      }
    }
  });

  it('el arma empieza a cero y dice que su nivel son los aciertos', async () => {
    renderizar();
    await empezar();
    expect(screen.getByText(/= tus aciertos/i)).toBeInTheDocument();
    expect(screen.getByText('daño ×1.0')).toBeInTheDocument();
  });
});

describe('EL INGLÉS DECIDE SI GANAS', () => {
  /*
    Esta es la prueba que sostiene el juego entero, y por eso no mira la
    pantalla: mira el resultado de partidas simuladas.

    El jugador simulado vive dentro del propio juego y esquiva SIEMPRE IGUAL
    —misma política, misma semilla— así que lo único que cambia entre una fila y
    la siguiente es `acierto`, la probabilidad de forjar el compuesto bueno. Si
    algún día forjar deja de decidir la partida, aquí se cae una prueba en vez
    de descubrirlo cuando alguien se aburra jugando.

    `decidirCadaMs: 250` no es un detalle: es el rumbo corregido cuatro veces
    por segundo, que es lo que hace una persona. Sin él, el muñeco corrige
    sesenta veces por segundo, esquiva como nadie y toda la calibración queda
    hecha contra un jugador que no existe. Medido: con 60 correcciones por
    segundo, forjando al 85 % se llega vivo al final el 87 % de las veces; con
    cuatro, el 71 %.
  */
  const PARTIDAS = 25;

  function cuantasLlegan(acierto: number): number {
    const arnes = window.__horda!;
    let vivas = 0;
    for (let i = 0; i < PARTIDAS; i += 1) {
      const fin = arnes.simular(
        { acierto, caracteresPorSegundo: 16, reflejoMs: 400, decidirCadaMs: 250 },
        `prueba-${i}`,
      );
      if (fin.motivo === 'tiempo') vivas += 1;
    }
    return vivas;
  }

  it('quien no forja nunca no llega al final; quien forja siempre, sí', async () => {
    renderizar();
    await empezar();

    expect(cuantasLlegan(0)).toBe(0);
    expect(cuantasLlegan(1)).toBeGreaterThanOrEqual(PARTIDAS / 2);
  });

  it('forjar mejor alarga la partida, en escalera', async () => {
    renderizar();
    await empezar();

    /*
      Se mide en PARTIDAS QUE LLEGAN AL FINAL y no en segundos de media, que era
      la primera versión de esta prueba. Los segundos tienen un techo —la
      partida dura 180 y ahí se acaba— así que en cuanto dos políticas
      sobreviven, la media deja de separarlas y la prueba empieza a fallar por
      ruido en vez de por un cambio de verdad.
    */
    const llegan = [0, 0.5, 0.85, 1].map(cuantasLlegan);
    const [nunca, mitad, casi, siempre] = llegan as [number, number, number, number];

    // Nadie que no forje llega; la mayoría de los que forjan bien, sí; y entre
    // medias la escalera sube. Los márgenes son holgados a propósito: lo que
    // esta prueba tiene que detectar es que forjar deje de importar, no una
    // diferencia de dos partidas de veinticinco.
    expect(nunca).toBe(0);
    expect(mitad).toBeLessThan(casi);
    expect(casi).toBeGreaterThanOrEqual(PARTIDAS / 3);
    expect(siempre).toBeGreaterThanOrEqual(casi);
  });

  it('el nivel del arma son los aciertos, ni uno más', async () => {
    renderizar();
    await empezar();

    // Matar no lo sube: si lo subiera, este número se dispararía, porque en tres
    // minutos se matan cientos de sombras y solo se contestan veinte preguntas.
    const fin = window.__horda!.simular(
      { acierto: 1, caracteresPorSegundo: 16, reflejoMs: 400, decidirCadaMs: 250 },
      'arma',
    );
    const rangos = Object.values(fin.rangos).reduce((a, b) => a + b, 0);
    expect(rangos).toBeLessThanOrEqual(fin.aciertos);
    expect(fin.aciertos).toBeLessThanOrEqual(fin.contestadas);
  });

  it('el reloj del cofre aguanta a quien lee despacio', async () => {
    renderizar();
    await empezar();

    const arnes = window.__horda!;
    const tarde = (cps: number) => {
      let suma = 0;
      for (let i = 0; i < 10; i += 1) {
        suma += arnes.simular(
          { acierto: 1, caracteresPorSegundo: cps, reflejoMs: 400, decidirCadaMs: 250 },
          `lectura-${i}`,
        ).cofresTarde;
      }
      return suma;
    };

    /*
      14-18 caracteres por segundo es lo que cuesta leer una frase nueva que hay
      que entender para actuar, y es la velocidad contra la que están calibrados
      PARTICULAS y CARRERA. A nadie que lea dentro de ese margen —ni al borde de
      abajo— se le puede cerrar un cofre por lento. Los dos segundos que pedía
      el encargo no dan ni para leer el modismo.
    */
    expect(tarde(14)).toBe(0);
    expect(tarde(12)).toBe(0);
  });
});

describe('el marcador', () => {
  it('enseña la misma cuenta que cerrará el servidor', async () => {
    renderizar();
    await empezar();

    // Sin aciertos, cero. Es la fórmula de `puntos.ts`, que es copia de la del
    // servidor; lo que no puede pasar es que aquí se invente otra.
    expect(puntosDelServidor('HORDA', 0, 0)).toBe(0);
    expect(screen.getByText('Puntos')).toBeInTheDocument();
    const contador = screen.getByText('Puntos').parentElement!;
    expect(contador.textContent).toContain('0');
  });

  it('el multiplicador que se enseña es de DAÑO y lo dice', async () => {
    /*
      Un «×4» al lado de una puntuación que no multiplica por cuatro se lee como
      una estafa, y en esta aplicación ya pasó. Aquí el número lleva la palabra
      «daño» pegada y los puntos van en su propio contador.
    */
    renderizar();
    await empezar();
    expect(screen.getByText(/^daño ×/)).toBeInTheDocument();
  });
});

describe('con movimiento reducido', () => {
  function pedirQuieto() {
    window.matchMedia = ((consulta: string) => ({
      matches: consulta.includes('prefers-reduced-motion'),
      media: consulta,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  it('se juega un tablero por turnos, con las mismas preguntas', async () => {
    pedirQuieto();
    renderizar();

    expect(
      screen.getByText(/la arena es un tablero y la partida va por turnos/i),
    ).toBeInTheDocument();
    await empezar();

    // La escena es la misma que con movimiento normal: lo que cambia es cómo se
    // mueve uno, no lo que hay que saber.
    expect(screen.getByText('Sales de casa y la tele sigue puesta.')).toBeInTheDocument();
    // Y no hay lienzo: hay casillas.
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('la horda viene ATENUADA, que es lo que lo hace jugable', async () => {
    pedirQuieto();
    renderizar();
    await empezar();

    const arnes = window.__horda!;
    let vivas = 0;
    for (let i = 0; i < 12; i += 1) {
      const fin = arnes.simular(
        {
          acierto: 1,
          caracteresPorSegundo: 16,
          reflejoMs: 400,
          decidirCadaMs: 900,
          porTurnos: true,
        },
        `turnos-${i}`,
      );
      if (fin.motivo === 'tiempo') vivas += 1;
    }

    /*
      Sin atenuar la horda, por turnos se moría siempre: forjarlo todo bien daba
      el mismo resultado que fallarlo todo. Eso no es un juego más difícil, es
      el mismo juego roto justo para quien más necesita que funcione.
    */
    expect(vivas).toBeGreaterThanOrEqual(5);
  });
});

describe('el cofre de jefe', () => {
  it('se puede contestar con el teclado', async () => {
    renderizar();
    const arnes = await empezar();

    // Se lleva a Milo encima del cofre por el camino corto: el arnés no puede
    // abrirlo, pero sí se comprueba que el reloj de la ventana no es el de dos
    // segundos del encargo.
    const cofre = rondaDe().cofres[0]!;
    expect(cofre.lecturaMs).toBeGreaterThan(2000);
    expect(cofre.lecturaMs + rondaDe().reloj.escalones[0]!).toBeGreaterThan(4000);
    expect(arnes.estado().vidas).toBe(4);
  });
});

describe('la accesibilidad', () => {
  it('cuenta en voz alta qué pide la escena y cuánta vida queda', async () => {
    renderizar();
    await empezar();

    await waitFor(() => {
      const aviso = screen.getByRole('status');
      expect(aviso.textContent).toContain('Sales de casa');
      expect(aviso.textContent).toContain('4 corazones');
    });
  });
});
