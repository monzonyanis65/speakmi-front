import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { escuchar, estaDisponible } from './reconocimiento';

/**
 * Un reconocedor de mentira que se puede conducir a mano.
 *
 * Reproduce las dos cosas que hacen sufrir al de verdad: que entrega varias
 * versiones de cada trozo, y que se para solo en cuanto hay un silencio, sin
 * que nadie se lo haya pedido.
 */
class ReconocedorFalso {
  static ultimo: ReconocedorFalso | null = null;

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  arranques = 0;
  abortado = false;
  parado = false;

  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    ReconocedorFalso.ultimo = this;
  }

  start() {
    this.arranques += 1;
  }
  stop() {
    this.parado = true;
    this.onend?.();
  }
  abort() {
    this.abortado = true;
    this.onend?.();
  }

  /** Entrega un trozo cerrado con todas sus versiones. */
  oye(...versiones: string[]) {
    const resultado = Object.assign(
      versiones.map((t) => ({ transcript: t, confidence: 0.9 })),
      { isFinal: true },
    );
    this.onresult?.({ resultIndex: 0, results: Object.assign([resultado], { length: 1 }) });
  }

  /** El motor se calla y se cierra por su cuenta, a mitad de frase. */
  seCortaSolo() {
    this.onend?.();
  }
}

beforeEach(() => {
  ReconocedorFalso.ultimo = null;
  vi.stubGlobal('SpeechRecognition', ReconocedorFalso);
});

afterEach(() => vi.unstubAllGlobals());

describe('escuchar', () => {
  it('está disponible cuando el navegador lo trae', () => {
    expect(estaDisponible()).toBe(true);
  });

  it('pide varias versiones al motor, no una sola', () => {
    escuchar({ onFinal: () => {} });
    expect(ReconocedorFalso.ultimo!.maxAlternatives).toBeGreaterThan(1);
  });

  it('no se da por terminado si el motor se corta solo', () => {
    const finales: unknown[] = [];
    escuchar({ onFinal: (r) => finales.push(r) });
    const motor = ReconocedorFalso.ultimo!;

    motor.oye('my father');
    // Esto es lo que pasa de verdad al pararse a pensar a mitad de frase.
    motor.seCortaSolo();

    expect(finales).toHaveLength(0);
    expect(motor.arranques).toBe(2);
  });

  it('sigue acumulando lo dicho después de un corte', () => {
    const finales: Array<{ texto: string }> = [];
    const sesion = escuchar({ onFinal: (r) => finales.push(r) })!;
    const motor = ReconocedorFalso.ultimo!;

    motor.oye('my father');
    motor.seCortaSolo();
    motor.oye('is working');
    sesion.detener();

    expect(finales[0]!.texto).toBe('my father is working');
  });

  it('termina cuando se le dice, no antes', () => {
    const finales: Array<{ texto: string }> = [];
    const sesion = escuchar({ onFinal: (r) => finales.push(r) })!;
    const motor = ReconocedorFalso.ultimo!;

    motor.oye('hello');
    expect(finales).toHaveLength(0);

    sesion.detener();
    expect(finales).toHaveLength(1);
  });

  it('ofrece frases alternativas cambiando una palabra cada vez', () => {
    const finales: Array<{ texto: string; alternativas: string[] }> = [];
    const sesion = escuchar({ onFinal: (r) => finales.push(r) })!;
    const motor = ReconocedorFalso.ultimo!;

    motor.oye('my father is', 'my father was');
    motor.oye('walking', 'working');
    sesion.detener();

    const { texto, alternativas } = finales[0]!;
    expect(texto).toBe('my father is walking');
    // La buena tiene que estar entre las opciones: es lo que permite al
    // servidor quedarse con ella al comparar con el texto de referencia.
    expect(alternativas).toContain('my father is working');
    expect(alternativas).toContain('my father was walking');
  });

  it('cancelar no entrega nada', () => {
    const finales: unknown[] = [];
    const sesion = escuchar({ onFinal: (r) => finales.push(r) })!;
    const motor = ReconocedorFalso.ultimo!;

    motor.oye('algo');
    sesion.cancelar();

    expect(finales).toHaveLength(0);
    expect(motor.abortado).toBe(true);
  });

  it('un fallo de verdad corta la escucha en vez de reintentar sin fin', () => {
    const motivos: string[] = [];
    escuchar({ onFinal: () => {}, onError: (m) => motivos.push(m) });
    const motor = ReconocedorFalso.ultimo!;

    motor.onerror!({ error: 'not-allowed' });
    motor.seCortaSolo();

    expect(motivos).toEqual(['not-allowed']);
    // No rearranca: sin permiso de micrófono reintentar no arregla nada.
    expect(motor.arranques).toBe(1);
  });

  it('callarse un momento no es un fallo', () => {
    const motivos: string[] = [];
    escuchar({ onFinal: () => {}, onError: (m) => motivos.push(m) });
    ReconocedorFalso.ultimo!.onerror!({ error: 'no-speech' });
    expect(motivos).toEqual([]);
  });
});
