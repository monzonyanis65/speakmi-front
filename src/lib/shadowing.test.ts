import { describe, expect, it } from 'vitest';
import { palabrasDelTrozo, rangoDeAudio, textoDelTrozo } from './shadowing';
import type { TiempoDePalabra } from './shadowing-ritmo';

const PALABRAS: TiempoDePalabra[] = [
  { word: 'I', startMs: 0, endMs: 140 },
  { word: 'usually', startMs: 140, endMs: 560 },
  { word: 'get', startMs: 560, endMs: 720 },
  { word: 'up', startMs: 720, endMs: 880 },
  { word: 'at', startMs: 880, endMs: 980 },
  { word: 'seven', startMs: 980, endMs: 1420 },
  { word: 'but', startMs: 1750, endMs: 1900 },
];

const TROZO = { desde: 0, hasta: 6, texto: 'I usually get up at seven,' };

describe('los trozos', () => {
  /*
    Esta es la que se rompió a propósito, y venía de un fallo de verdad.

    `desde` y `hasta` parecen milisegundos porque todo lo demás del contrato lo
    es, pero son ÍNDICES sobre `palabras[]`. Filtrando por tiempo, el trozo
    0..6 se quedaba con las palabras que empiezan antes del milisegundo 6, o
    sea una: la pantalla enseñaba «I» y decía que ese era el trozo.
  */
  it('desde y hasta son índices, no milisegundos', () => {
    expect(palabrasDelTrozo(PALABRAS, TROZO)?.map((palabra) => palabra.word)).toEqual([
      'I',
      'usually',
      'get',
      'up',
      'at',
      'seven',
    ]);
  });

  it('el corte es medio abierto: «hasta» no entra', () => {
    const segundo = palabrasDelTrozo(PALABRAS, { desde: 6, hasta: 7, texto: 'but' });
    expect(segundo?.map((palabra) => palabra.word)).toEqual(['but']);
    // Y ninguna palabra sale en los dos trozos.
    expect(palabrasDelTrozo(PALABRAS, TROZO)).not.toContainEqual(PALABRAS[6]);
  });

  it('sin marcas no hay palabras que repartir', () => {
    expect(palabrasDelTrozo(null, TROZO)).toBeNull();
  });

  it('el texto del trozo viene hecho, y si no se recorta por caracteres', () => {
    const entero = 'I usually get up at seven, but';
    expect(textoDelTrozo(entero, TROZO)).toBe('I usually get up at seven,');
    expect(textoDelTrozo(entero, { desde: 0, hasta: 9, texto: '' })).toBe('I usually');
  });
});

describe('el tramo de audio de un trozo', () => {
  it('sale de la primera y la última palabra, no de los índices', () => {
    const tramo = rangoDeAudio(PALABRAS, TROZO, 3700);
    expect(tramo?.desdeMs).toBe(0);
    // El final lleva una cola, pero nunca pisa la palabra siguiente.
    expect(tramo?.hastaMs).toBe(1540);
  });

  it('la cola no se mete en la palabra de al lado', () => {
    const tramo = rangoDeAudio(PALABRAS, { desde: 0, hasta: 2, texto: 'I usually' }, 3700);
    // «get» empieza en 560, así que ahí se corta aunque la cola pidiera 680.
    expect(tramo?.hastaMs).toBe(560);
  });

  /*
    Sin marcas no se puede aislar un trozo: no hay forma de saber por qué
    segundo pasa el corte. Devolver un rango a ojo dejaría a alguien repitiendo
    media palabra, así que se devuelve null y la pantalla suena la frase entera
    y lo dice.
  */
  it('sin marcas no hay tramo, y se dice con null', () => {
    expect(rangoDeAudio(null, TROZO, 3700)).toBeNull();
  });
});
