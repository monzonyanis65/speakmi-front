import { describe, expect, it } from 'vitest';
import {
  avisosDeRitmo,
  compararRitmo,
  loQueSuena,
  type PalabraDicha,
  type TiempoDePalabra,
} from './shadowing-ritmo';

/** «I get up at seven, but on weekends I sleep in», con aire antes de «I». */
const MODELO: TiempoDePalabra[] = [
  { word: 'but', startMs: 1750, endMs: 1900 },
  { word: 'on', startMs: 1900, endMs: 2020 },
  { word: 'weekends', startMs: 2020, endMs: 2520 },
  { word: 'I', startMs: 2820, endMs: 2940 },
  { word: 'sleep', startMs: 2940, endMs: 3260 },
];

/** Mover una palabra en el tiempo sin perder el resto de sus datos. */
function correr(palabra: PalabraDicha, ms: number): PalabraDicha {
  return { ...palabra, startMs: (palabra.startMs ?? 0) + ms, endMs: (palabra.endMs ?? 0) + ms };
}

/** Lo mismo que el modelo pero desplazado: misma forma, otro momento de arranque. */
function comoElModelo(desplazamiento: number): PalabraDicha[] {
  return MODELO.map((palabra) => ({
    word: palabra.word,
    heard: palabra.word,
    verdict: 'correct' as const,
    score: 0.95,
    startMs: palabra.startMs + desplazamiento,
    endMs: palabra.endMs + desplazamiento,
  }));
}

describe('qué palabra suena', () => {
  it('enciende la palabra que cubre ese milisegundo', () => {
    expect(loQueSuena(MODELO, 2100).indice).toBe(2);
    expect(loQueSuena(MODELO, 1750).indice).toBe(0);
  });

  /*
    Esta es la que se rompió a propósito.

    Lo natural al escribirlo es «la última palabra que ya empezó», y con eso la
    pantalla se ve perfecta: nunca parpadea. Pero deja «weekends» encendida
    durante los 300 ms de silencio que vienen después, y en shadowing ese
    silencio es justo lo que hay que copiar. Quien mira la pantalla entiende que
    ahí sigue diciendo «weekends» y alarga la palabra en vez de callarse.
  */
  it('en la pausa no deja encendida la palabra anterior', () => {
    const enLaPausa = loQueSuena(MODELO, 2700);
    expect(enLaPausa.indice).toBe(-1);
    expect(enLaPausa.pausa).toBe(true);
  });

  it('un hueco de nada entre dos palabras no es una pausa', () => {
    const pegadas: TiempoDePalabra[] = [
      { word: 'a', startMs: 0, endMs: 100 },
      { word: 'lot', startMs: 140, endMs: 300 },
    ];
    expect(loQueSuena(pegadas, 120)).toEqual({ indice: -1, pausa: false });
  });
});

describe('comparar el ritmo', () => {
  /*
    Y esta es la otra que se rompió a propósito.

    Entre darle al botón y soltar la primera sílaba pasa medio segundo largo.
    Comparando los tiempos tal cual llegan, esta imitación clavada sale con
    TODAS las palabras 500 ms tarde y la pantalla le dice a alguien que lo hizo
    bien que no acertó ni una.
  */
  it('arrancar medio segundo tarde no es descuadrarse', () => {
    const deslices = compararRitmo(MODELO, comoElModelo(500));

    expect(deslices.map((desliz) => desliz.desfaseMs)).toEqual([0, 0, 0, 0, 0]);
    expect(deslices.every((desliz) => desliz.cuando === 'a-tiempo')).toBe(true);
    expect(avisosDeRitmo(deslices)).toEqual([]);
  });

  it('señala la palabra que llegó tarde de verdad', () => {
    const tuyas = comoElModelo(500);
    tuyas[2] = correr(tuyas[2]!, 300);

    const deslices = compararRitmo(MODELO, tuyas);

    expect(deslices[2]!.cuando).toBe('tarde');
    expect(deslices[2]!.desfaseMs).toBe(300);
    expect(deslices[1]!.cuando).toBe('a-tiempo');
    // Retrasar «weekends» 300 ms es meter un silencio donde el modelo encadena,
    // y eso se dice como pausa: es lo accionable, respirar o no respirar.
    expect(avisosDeRitmo(deslices)[0]).toContain('Paraste de más antes de «weekends»');
  });

  it('avisa de la pausa que te comiste, con los dos números', () => {
    const tuyas = comoElModelo(500);
    // Entra en «I» sin respirar: pega el final de «weekends» con el principio.
    for (const i of [3, 4]) {
      tuyas[i] = correr(tuyas[i]!, -300);
    }

    const deslices = compararRitmo(MODELO, tuyas);

    expect(deslices[3]!.pausa).toBe('te-falto');
    expect(deslices[3]!.pausaModeloMs).toBe(300);
    expect(deslices[3]!.pausaTuyaMs).toBe(0);
    const avisos = avisosDeRitmo(deslices);
    expect(avisos.join(' ')).toContain('Te faltó la pausa antes de «I»');
    // Y solo eso: «sleep» va igual de pronto, pero solo porque «I» se adelantó.
    // Repetirlo en cada palabra de después son seis avisos para un único fallo.
    expect(avisos).toHaveLength(1);
  });

  it('una palabra que no dijiste se queda sin medida, no a cero', () => {
    const tuyas = comoElModelo(500);
    // Así la manda el servidor: sin veredicto y SIN HORA. El cero sería un
    // instante inventado, y encima el principio del audio.
    tuyas[2] = {
      ...tuyas[2]!,
      verdict: 'omitted',
      heard: null,
      score: 0,
      startMs: null,
      endMs: null,
    };

    const deslices = compararRitmo(MODELO, tuyas);

    expect(deslices[2]!.desfaseMs).toBeNull();
    expect(deslices[2]!.cuando).toBe('sin-medida');
    // Y las de después siguen comparándose: la omisión no descoloca la lista.
    expect(deslices[3]!.cuando).toBe('a-tiempo');
  });

  it('la primera palabra sin hora no arrastra el origen al principio del audio', () => {
    const tuyas = comoElModelo(500);
    // El proveedor no supo situar la primera. Si se tomara como cero, el origen
    // se iría al arranque del audio y todo lo demás saldría 500 ms tarde.
    tuyas[0] = { ...tuyas[0]!, startMs: null, endMs: null };

    const deslices = compararRitmo(MODELO, tuyas);

    expect(deslices[0]!.cuando).toBe('sin-medida');
    expect(deslices.slice(1).every((desliz) => desliz.cuando === 'a-tiempo')).toBe(true);
  });

  it('lo que te inventaste no se empareja con nada del modelo', () => {
    const tuyas = comoElModelo(500);
    tuyas.splice(1, 0, {
      word: 'the',
      heard: 'the',
      verdict: 'inserted',
      score: 0.4,
      startMs: 1880,
      endMs: 1940,
    });

    const deslices = compararRitmo(MODELO, tuyas);

    expect(deslices).toHaveLength(MODELO.length);
    expect(deslices.every((desliz) => desliz.cuando === 'a-tiempo')).toBe(true);
  });

  it('no da más de tres avisos: cinco cosas a la vez no se corrige ninguna', () => {
    const tuyas = comoElModelo(500).map((palabra, i) => correr(palabra, (i + 1) * 400));

    expect(avisosDeRitmo(compararRitmo(MODELO, tuyas)).length).toBeLessThanOrEqual(3);
  });
});
