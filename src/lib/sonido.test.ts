import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Las pruebas del sonido.
 *
 * No se puede oír nada en una prueba, así que lo que se comprueba es lo único
 * que de verdad importa de esta capa: CUÁNDO suena y cuándo no. Un
 * `AudioContext` de mentira cuenta los osciladores que se crean y apunta a qué
 * frecuencias; cero osciladores es silencio.
 *
 * Lo que más se prueba es el silencio: que apagado no suene, que sin gesto no se
 * cree ni el contexto —crearlo sin gesto es lo que llena la consola de avisos— y
 * que con `prefers-reduced-motion` no suene aunque esté encendido.
 */

interface Espia {
  contextos: number;
  osciladores: number;
  frecuencias: number[];
  reanudaciones: number;
  ultimo: ContextoFalso | null;
}

let espia: Espia;

class OsciladorFalso {
  type = 'sine';
  frequency = {
    setValueAtTime: (valor: number) => {
      espia.frecuencias.push(valor);
    },
    exponentialRampToValueAtTime: () => undefined,
  };
  connect = () => undefined;
  start = () => undefined;
  stop = () => undefined;
}

class GananciaFalsa {
  gain = {
    value: 0,
    setValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  };
  connect = () => undefined;
}

class ContextoFalso {
  currentTime = 0;
  state: 'running' | 'suspended' = 'running';
  destination = {};

  constructor() {
    espia.contextos += 1;
    espia.ultimo = this;
  }

  createOscillator() {
    espia.osciladores += 1;
    return new OsciladorFalso();
  }

  createGain() {
    return new GananciaFalsa();
  }

  resume() {
    espia.reanudaciones += 1;
    this.state = 'running';
    return Promise.resolve();
  }
}

function ponerMenosMovimiento(activo: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (consulta: string) => ({
      matches: consulta.includes('prefers-reduced-motion') ? activo : false,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

/** Cada prueba estrena módulo, que es donde vive el contexto único. */
async function cargar() {
  vi.resetModules();
  return import('./sonido');
}

beforeEach(() => {
  espia = { contextos: 0, osciladores: 0, frecuencias: [], reanudaciones: 0, ultimo: null };
  localStorage.clear();
  ponerMenosMovimiento(false);
  Object.defineProperty(window, 'AudioContext', {
    writable: true,
    configurable: true,
    value: ContextoFalso,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  // Por si una prueba la puso y se cayó antes de quitarla.
  Reflect.deleteProperty(navigator, 'userActivation');
});

describe('sonido', () => {
  it('sin ningún gesto no crea el contexto ni suena', async () => {
    const { sonar } = await cargar();

    sonar('acierto');
    sonar('combo', { racha: 4 });

    // Lo importante es el cero de contextos: crear uno sin gesto deja el aviso
    // de «The AudioContext was not allowed to start» en la consola de todo el
    // mundo.
    expect(espia.contextos).toBe(0);
    expect(espia.osciladores).toBe(0);
  });

  /*
    El caso del tic del reloj: se entra al juego pulsando en la pantalla
    anterior, así que cuando el juego monta sus oyentes el gesto ya pasó. Si
    nadie vuelve a tocar, el reloj tiene que poder sonar igual.
  */
  it('vale el toque con el que se entró al juego, aunque ya no se toque más', async () => {
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { hasBeenActive: true },
    });

    const { sonar } = await cargar();
    sonar('tic', { urgente: true });

    expect(espia.osciladores).toBe(1);

    Reflect.deleteProperty(navigator, 'userActivation');
  });

  it('tras un gesto suena, y con un solo contexto para todo', async () => {
    const { despertarSonido, sonar } = await cargar();

    despertarSonido();
    sonar('acierto');
    sonar('fallo');
    sonar('record');

    expect(espia.contextos).toBe(1);
    expect(espia.osciladores).toBeGreaterThan(3);
  });

  it('apagado no suena, y se acuerda la próxima vez', async () => {
    const primera = await cargar();
    primera.encenderSonido(false);
    primera.despertarSonido();

    primera.sonar('acierto');
    primera.sonar('record');
    // Apagado no se crea ni el contexto: no hay nada que reanudar ni que ocupe
    // memoria mientras se juega en silencio.
    expect(espia.contextos).toBe(0);
    expect(espia.osciladores).toBe(0);
    expect(localStorage.getItem(primera.CLAVE_SONIDO)).toBe('no');

    // Otra visita: el módulo se carga de cero y sigue apagado.
    const segunda = await cargar();
    expect(segunda.sonidoEncendido()).toBe(false);
    segunda.despertarSonido();
    segunda.sonar('acierto');

    expect(espia.contextos).toBe(0);
    expect(espia.osciladores).toBe(0);
  });

  it('apagado en marcha: lo que ya sonaba deja de sonar', async () => {
    const { despertarSonido, encenderSonido, sonar } = await cargar();

    despertarSonido();
    sonar('acierto');
    const antes = espia.osciladores;
    expect(antes).toBeGreaterThan(0);

    encenderSonido(false);
    sonar('acierto');
    sonar('combo', { racha: 9 });
    sonar('tic');

    expect(espia.osciladores).toBe(antes);
  });

  it('vuelve a sonar al encenderlo otra vez', async () => {
    const { despertarSonido, encenderSonido, sonar, sonidoEncendido } = await cargar();

    despertarSonido();
    encenderSonido(false);
    encenderSonido(true);
    sonar('acierto');

    expect(sonidoEncendido()).toBe(true);
    expect(espia.osciladores).toBeGreaterThan(0);
  });

  it('con «menos movimiento» no suena nada, aunque esté encendido', async () => {
    ponerMenosMovimiento(true);
    const { despertarSonido, sonar, sonidoEncendido } = await cargar();

    despertarSonido();
    sonar('acierto');
    sonar('fin');

    expect(sonidoEncendido()).toBe(true);
    expect(espia.contextos).toBe(0);
    expect(espia.osciladores).toBe(0);
  });

  it('la racha sube de tono: cuanto más larga, más agudo', async () => {
    const { despertarSonido, sonar } = await cargar();
    despertarSonido();

    sonar('combo', { racha: 2 });
    const baja = espia.frecuencias[0]!;

    espia.frecuencias = [];
    sonar('combo', { racha: 8 });
    const alta = espia.frecuencias[0]!;

    expect(alta).toBeGreaterThan(baja);
    // Y no se dispara al infinito: una racha de cincuenta no puede sonar a
    // silbato de perro.
    espia.frecuencias = [];
    sonar('combo', { racha: 50 });
    expect(espia.frecuencias[0]!).toBeLessThan(alta * 4);
  });

  it('si el navegador durmió el contexto, lo reanuda en vez de crear otro', async () => {
    const { despertarSonido, sonar } = await cargar();

    despertarSonido();
    sonar('acierto');
    expect(espia.contextos).toBe(1);

    // Cambiar de pestaña lo suspende.
    espia.ultimo!.state = 'suspended';

    sonar('acierto');
    expect(espia.contextos).toBe(1);
    expect(espia.reanudaciones).toBeGreaterThan(0);
  });

  it('un navegador sin audio no rompe la partida', async () => {
    Object.defineProperty(window, 'AudioContext', {
      writable: true,
      configurable: true,
      value: undefined,
    });

    const { despertarSonido, sonar } = await cargar();

    expect(() => {
      despertarSonido();
      sonar('acierto');
      sonar('record');
    }).not.toThrow();
  });
});
