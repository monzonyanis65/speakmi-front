import { describe, expect, it } from 'vitest';
import {
  codigoDeLeccion,
  conNombres,
  COLA_TURNO,
  CPS_INGLES,
  elencoDelReparto,
  especiesDelCatalogo,
  MINIMO_TURNO,
  msDeTurno,
  msHablando,
  repartoDe,
} from './escena';

/**
 * Las réplicas de verdad de las tres unidades que ya tienen escena.
 *
 * Se prueban las de verdad y no cadenas inventadas porque lo que se quiere saber
 * es si ESTAS frases se pueden leer, no si la fórmula es una fórmula.
 */
const REPLICAS = [
  'Your sister works downtown, right?',
  'She does. Well, until Friday. She starts at the hospital on Monday.',
  'She says the hours are terrible. The money is much better.',
  'They only come in small sizes. I think those are not yours.',
  'That one, no. These, next to the register, are half price.',
  'I still come. I am just not used to the new schedule yet.',
  'I did not. I come at night now. There is nobody, and I like that.',
];

describe('cuánto se queda una réplica en pantalla', () => {
  /*
    LA PRUEBA QUE IMPORTA.

    No comprueba la fórmula, comprueba el techo: pase lo que pase con el cálculo,
    ninguna réplica puede irse de la pantalla antes de lo que cuesta leerla a 18
    caracteres por segundo, que es el extremo RÁPIDO del rango de quien lee para
    entender. Está escrita así, contra el resultado y no contra la constante,
    porque una prueba que compare `CPS_INGLES` con 14 pasa igual de bien aunque
    alguien meta luego un factor de corrección en la fórmula.

    Comprobada al revés antes de darla por buena: con CPS_INGLES = 28, que es lo
    que dejó injugable a otro juego de esta casa, las réplicas largas se quedan
    en 3,1 s frente a los 3,7 que hacen falta y esta prueba se pone roja.
  */
  it('ninguna réplica se va antes de lo que cuesta leerla a 18 caracteres por segundo', () => {
    for (const linea of REPLICAS) {
      const minimo = (linea.length / 18) * 1000;
      expect(
        msDeTurno({ en: linea, es: '' }, false),
        `«${linea}» se va demasiado pronto`,
      ).toBeGreaterThanOrEqual(minimo);
    }
  });

  it('y las largas van al ritmo de 14, que es el de quien todavía descifra', () => {
    const larga = REPLICAS[1]!;
    expect(msDeTurno({ en: larga, es: '' }, false)).toBe(
      Math.round((larga.length / CPS_INGLES) * 1000) + COLA_TURNO,
    );
  });

  it('una réplica de dos palabras no se va en medio segundo', () => {
    // «Half?» son cinco caracteres. Sin suelo se iría antes de que diera tiempo
    // a mirar al otro lado de la escena, que es donde está el que la dice.
    expect(msDeTurno({ en: 'Half?', es: '¿A mitad?' }, false)).toBe(MINIMO_TURNO);
  });

  it('la traducción solo cuesta tiempo cuando está puesta', () => {
    const turno = REPLICAS[2]!;
    const con = msDeTurno(
      { en: turno, es: 'Dice que el horario es horrible. El dinero es mucho mejor.' },
      true,
    );
    const sin = msDeTurno(
      { en: turno, es: 'Dice que el horario es horrible. El dinero es mucho mejor.' },
      false,
    );
    expect(con).toBeGreaterThan(sin);
  });

  it('el personaje calla antes de que pase el turno, para que le dé tiempo a poner cara', () => {
    for (const linea of REPLICAS) {
      const turno = { en: linea, es: '' };
      expect(msHablando(turno, false)).toBeLessThan(msDeTurno(turno, false));
    }
  });
});

describe('quién hace cada papel', () => {
  it('el mismo papel es el mismo animal en toda la lección', () => {
    // Dos ejercicios distintos de la misma lección: si A cambiara de animal
    // entre uno y otro, nadie sabría que es la misma persona hablando.
    const primero = repartoDe(codigoDeLeccion('L5-U3-03-E04'));
    const segundo = repartoDe(codigoDeLeccion('L5-U3-03-E05'));
    expect(primero).toEqual(segundo);
  });

  it('A y B nunca son el mismo animal', () => {
    for (let nivel = 1; nivel <= 24; nivel += 1) {
      for (let unidad = 1; unidad <= 4; unidad += 1) {
        for (let leccion = 1; leccion <= 6; leccion += 1) {
          const codigo = `L${nivel}-U${unidad}-0${leccion}`;
          const reparto = repartoDe(codigo);
          expect(reparto.A, `${codigo} reparte el mismo animal dos veces`).not.toBe(reparto.B);
        }
      }
    }
  });

  it('lecciones distintas no salen siempre con la misma pareja', () => {
    const parejas = new Set<string>();
    for (let n = 1; n <= 24; n += 1) {
      const reparto = repartoDe(`L${n}-U1-01`);
      parejas.add(`${reparto.A}+${reparto.B}`);
    }
    // Con cinco animales hay veinte parejas posibles. Pedir más de cinco es
    // pedir que el reparto reparta de verdad y no que siempre salgan los dos
    // mismos porque el número se calculó con el prefijo y no con todo el código.
    expect(parejas.size).toBeGreaterThan(5);
  });

  it('el código de la lección es el del ejercicio sin el sufijo', () => {
    expect(codigoDeLeccion('L9-U2-04-E05')).toBe('L9-U2-04');
    // Un código que ya es de lección se queda como está.
    expect(codigoDeLeccion('L9-U2-04')).toBe('L9-U2-04');
  });

  it('una pregunta que nombra un papel acaba nombrando al personaje', () => {
    /*
      El contenido escribe «{B}» porque no puede saber quién actúa. Si esto no
      sustituyera, la pantalla enseñaría «¿Qué le corrige {B} a {A}?» debajo de
      dos animales que se llaman Milo y Tuco, y no habría forma de saber a quién
      se refiere la pregunta.
    */
    const reparto = { A: 'PET_MILO', B: 'PET_GATO' } as const;
    const nombre = { PET_MILO: 'Milo', PET_GATO: 'Nala' } as Record<string, string>;
    expect(conNombres('¿Qué le corrige {B} a {A}?', reparto, (e) => nombre[e]!)).toBe(
      '¿Qué le corrige Nala a Milo?',
    );
  });

  it('un texto sin papeles se queda exactamente igual', () => {
    const reparto = { A: 'PET_MILO', B: 'PET_GATO' } as const;
    const tal = '¿Por qué se lleva las de sesenta?';
    expect(conNombres(tal, reparto, () => 'Milo')).toBe(tal);
  });

  it('el elenco no se deja ninguna especie del catálogo', () => {
    // Si alguien añade un animal sexto a `mascotas/`, esta prueba se pone roja y
    // avisa de que también hay que meterlo en el reparto. Sin ella, el animal
    // nuevo existiría en la tienda y no actuaría nunca.
    expect([...elencoDelReparto()].sort()).toEqual([...especiesDelCatalogo()].sort());
  });
});
