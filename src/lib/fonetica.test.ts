import { describe, expect, it } from 'vitest';
import { analizar, contarCortes, patronDe, UMBRAL_SONIDO } from './fonetica';
import { normalizarSimbolo, sonidoDe } from '@/data/fonemas';

/** Atajo para escribir palabras con sonidos sin llenar la prueba de llaves. */
function palabra(texto: string, ...sonidos: Array<[string, number]>) {
  return {
    palabra: texto,
    indicePalabra: 0,
    fonemas: sonidos.map(([simbolo, puntuacion]) => ({ simbolo, puntuacion })),
  };
}

describe('la tabla de sonidos', () => {
  it('encuentra el mismo sonido venga con marca de largo o sin ella', () => {
    // Cada proveedor de fonética transcribe a su manera. Si la búsqueda fuera
    // literal, el mismo sonido tendría ficha con unos servidores y no con otros.
    expect(sonidoDe('iː')).toBe(sonidoDe('i'));
    expect(sonidoDe('ˈiː')).toBe(sonidoDe('i'));
    expect(sonidoDe('i:')).toBe(sonidoDe('i'));
  });

  it('no mezcla la i larga con la i floja al quitar la marca de largo', () => {
    // El riesgo de normalizar: que /iː/ y /ɪ/ acaben en la misma ficha y la
    // pantalla explique «ship» enseñando a estirar los labios.
    expect(normalizarSimbolo('iː')).not.toBe(normalizarSimbolo('ɪ'));
    expect(sonidoDe('iː')).not.toBe(sonidoDe('ɪ'));
    expect(sonidoDe('uː')).not.toBe(sonidoDe('ʊ'));
  });

  it('la vocal de bird llega igual escrita de las tres maneras', () => {
    expect(sonidoDe('ɝ')).toBe(sonidoDe('ɜː'));
    expect(sonidoDe('ɚ')).toBe(sonidoDe('ɜː'));
  });

  it('no tiene ficha de los sonidos que el español ya hace bien', () => {
    // Si algún día alguien mete /m/ o /aɪ/ «por completar la tabla», esta
    // prueba se pone roja: el valor del archivo está en que es corto.
    for (const facil of ['m', 'n', 'f', 'aɪ', 'aʊ', 'ɔɪ']) {
      expect(sonidoDe(facil)).toBeNull();
    }
  });
});

describe('patrones de posición', () => {
  it('ve la e que se cuela delante de una s inicial', () => {
    expect(patronDe('school', 0, 5, 's')?.id).toBe('ese-inicial');
    expect(patronDe('speak', 0, 5, 's')?.id).toBe('ese-inicial');
  });

  it('no la ve cuando detrás de la s va una vocal', () => {
    // «sun» no le da ningún problema a un hispanohablante: el grupo imposible es
    // s + consonante, no la s.
    expect(patronDe('sun', 0, 3, 's')).toBeNull();
  });

  it('ve la consonante final, y no la confunde con una vocal final', () => {
    expect(patronDe('band', 3, 4, 'd')?.id).toBe('consonante-final');
    expect(patronDe('day', 2, 3, 'eɪ')).toBeNull();
  });

  it('una palabra de un solo sonido no tiene final que comerse', () => {
    expect(patronDe('a', 0, 1, 'ə')).toBeNull();
  });
});

describe('a quién se le echa la culpa', () => {
  it('ordena por lo que cuesta cada sonido, no por la peor nota suelta', () => {
    /*
      El caso que decide el diseño entero. La /v/ se hunde una sola vez; la /iː/
      se queda a medias cuatro veces. Ordenando por la peor nota mandaría la /v/
      arriba, y quien lo lea arreglaría un accidente en vez del sonido que va a
      seguir saliéndole mal en todas las frases.
    */
    const { flojos } = analizar([
      palabra('vest', ['v', 30]),
      palabra('sheep', ['iː', 55]),
      palabra('leave', ['iː', 55]),
      palabra('green', ['iː', 55]),
      palabra('please', ['iː', 55]),
    ]);

    expect(flojos[0]?.simbolo).toBe('iː');
    expect(flojos[0]?.veces).toBe(4);
    expect(flojos[0]?.deuda).toBe(4 * (UMBRAL_SONIDO - 55));
    expect(flojos[1]?.simbolo).toBe('v');
  });

  it('junta el mismo sonido de varias palabras en una sola ficha', () => {
    const { flojos } = analizar([palabra('very', ['v', 40]), palabra('vote', ['v', 50])]);

    expect(flojos).toHaveLength(1);
    expect(flojos[0]?.palabras).toEqual(['very', 'vote']);
    expect(flojos[0]?.peor).toBe(40);
  });

  it('separa el mismo sonido según si el fallo es de posición o del sonido', () => {
    // La z de «peas» y la z final de «weekends» necesitan consejos distintos:
    // una es «enciende la voz», la otra es «no te comas el final».
    const { flojos } = analizar([
      palabra('peas', ['p', 90], ['iː', 88], ['z', 40]),
      palabra('zoo', ['z', 40], ['uː', 90]),
    ]);

    expect(flojos).toHaveLength(2);
    expect(flojos.some((flojo) => flojo.patron?.id === 'consonante-final')).toBe(true);
    expect(flojos.some((flojo) => flojo.patron === null)).toBe(true);
  });

  it('cuenta los sonidos que no sabe explicar pero no los enseña', () => {
    // /ɔɪ/ no tiene ficha porque es «oi» y sale solo. Pintarlo pelado sería un
    // reproche con formato de dato.
    const { flojos, total, limpios } = analizar([palabra('boy', ['b', 90], ['ɔɪ', 20])]);

    expect(total).toBe(2);
    expect(limpios).toBe(1);
    expect(flojos).toHaveLength(0);
  });

  it('enseña el patrón aunque el sonido no tenga ficha', () => {
    // La /s/ de «school» está perfectamente hecha y no tiene ficha, pero hay
    // muchísimo que contar sobre la e que se cuela delante.
    const { flojos } = analizar([palabra('school', ['s', 45], ['k', 90], ['uː', 88], ['l', 90])]);

    expect(flojos).toHaveLength(1);
    expect(flojos[0]?.sonido).toBeNull();
    expect(flojos[0]?.patron?.id).toBe('ese-inicial');
  });

  it('no manda a soplar detrás de una t que cierra la palabra', () => {
    /*
      La ficha de /p/ /t/ /k/ va del soplo de aire al EMPEZAR palabra. En «at» la
      t es la última y ese consejo no aplica: lo que pasa ahí es que el final se
      cae, que es otro consejo y casi el contrario.
    */
    const { flojos } = analizar([palabra('at', ['æ', 88], ['t', 40])]);

    expect(flojos[0]?.sonido).toBeNull();
    expect(flojos[0]?.patron?.id).toBe('consonante-final');
  });

  it('con todo por encima del umbral no hay nada que corregir', () => {
    const { flojos, total, limpios } = analizar([palabra('cat', ['k', 90], ['æ', 85], ['t', 80])]);

    expect(flojos).toHaveLength(0);
    expect(total).toBe(3);
    expect(limpios).toBe(3);
  });

  it('una lista vacía es una medida, no un error', () => {
    expect(analizar([])).toEqual({ flojos: [], total: 0, limpios: 0 });
  });
});

describe('cortes', () => {
  it('cuenta los de cada clase por separado', () => {
    expect(
      contarCortes([
        { indicePalabra: 1, tipo: 'sobra' },
        { indicePalabra: 3, tipo: 'sobra' },
        { indicePalabra: 5, tipo: 'falta' },
      ]),
    ).toEqual({ sobran: 2, faltan: 1 });
  });
});
