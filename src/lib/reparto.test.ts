import { describe, expect, it, vi } from 'vitest';
import { NOMBRE_ESPECIE } from './mascota-contexto';
import { fraseDe, ORDEN, REPARTO, repartoDeLeccion } from './reparto';
import { type Especie } from '@/components/mascotas';

/**
 * El reparto.
 *
 * QUÉ SE APRIETA AQUÍ Y POR QUÉ ESTO Y NO OTRA COSA
 *
 * Este archivo no comprueba que los personajes «caigan bien»: eso no se puede
 * comprobar. Comprueba las tres cosas que, si se rompen, convierten el reparto
 * en decoración sin que nadie se dé cuenta hasta meses después:
 *
 *   1. Que quién sale en una lección NO dependa del azar ni del reloj. Un
 *      personaje que cambia cada vez que entras no es un personaje.
 *   2. Que los cinco salgan de verdad y repartidos. Un sorteo mal hecho deja a
 *      dos sin aparecer nunca y nadie lo nota mirando una lección.
 *   3. Que los cinco sean DISTINTOS. Es lo más fácil de perder: se retoca una
 *      fila, luego otra, y acaban siendo el mismo personaje con cinco dibujos.
 *
 * Y una cuarta que no es de reparto sino de no romper la tienda: que los
 * nombres sigan siendo los del catálogo por los que se pagó.
 */

const TODAS = ORDEN;

/** Las lecciones de un curso entero, para mirar el reparto de lejos. */
function todoElCurso(): string[] {
  const codigos: string[] = [];
  for (let nivel = 1; nivel <= 16; nivel += 1) {
    for (let unidad = 1; unidad <= 4; unidad += 1) {
      for (let leccion = 1; leccion <= 6; leccion += 1) {
        codigos.push(`L${nivel}-U${unidad}-${String(leccion).padStart(2, '0')}`);
      }
    }
  }
  return codigos;
}

describe('los nombres siguen siendo los de la tienda', () => {
  it('nadie ha rebautizado a nadie por su cuenta', () => {
    /*
      Los nombres se escriben dos veces —aquí en `reparto.ts` para poder leer el
      archivo de un tirón, y en `mascota-contexto.ts` copiados del catálogo del
      servidor— y esta prueba es lo único que impide que se separen.

      Ya pasó antes con la tienda: se compraba a «Nala» y la aplicación la
      llamaba «Kira» en todas las pantallas. Manda el catálogo, porque es el
      nombre con el que se pagó.
    */
    for (const especie of TODAS) {
      expect(REPARTO[especie].nombre, `${especie} se llama distinto en cada sitio`).toBe(
        NOMBRE_ESPECIE[especie],
      );
    }
  });

  it('cada ficha es la del animal que dice ser', () => {
    for (const especie of TODAS) {
      expect(REPARTO[especie].especie).toBe(especie);
    }
  });
});

describe('quién da cada lección', () => {
  it('la misma lección enseña siempre a los mismos, pase lo que pase', () => {
    /*
      El corazón de todo. Se fuerza el azar a dar valores distintos en cada
      llamada: si algún día alguien mete un `Math.random()` en el reparto —que
      es lo primero que se le ocurre a cualquiera para «que no salga siempre el
      mismo»—, esta prueba se pone roja inmediatamente.
    */
    const azar = vi.spyOn(Math, 'random');
    let n = 0;
    azar.mockImplementation(() => {
      n += 1;
      return (n % 100) / 100;
    });

    try {
      for (const codigo of ['L5-U1-03', 'L1-U1-01', 'L16-U4-06']) {
        const primera = repartoDeLeccion(codigo);
        for (let i = 0; i < 25; i += 1) {
          const otra = repartoDeLeccion(codigo);
          expect(otra.protagonista.especie, `${codigo} cambió de protagonista`).toBe(
            primera.protagonista.especie,
          );
          expect(otra.secundario.especie, `${codigo} cambió de secundario`).toBe(
            primera.secundario.especie,
          );
        }
      }
      expect(azar, 'el reparto consultó al azar').not.toHaveBeenCalled();
    } finally {
      azar.mockRestore();
    }
  });

  it('el secundario nunca es el protagonista', () => {
    // Dos veces el mismo animal en la pantalla final no es un dúo, es un
    // error de pintado que además se ve enorme.
    for (const codigo of todoElCurso()) {
      const { protagonista, secundario } = repartoDeLeccion(codigo);
      expect(secundario.especie, `${codigo} se duplicó`).not.toBe(protagonista.especie);
    }
  });

  it('los cinco dan clase, y ninguno se queda sin salir', () => {
    /*
      Con 384 lecciones, lo justo serían 77 para cada uno. Se exige el 10 % —38—
      porque un revoltijo no reparte perfecto y apretar más sería probar el
      generador y no la decisión.

      Lo que esto pilla de verdad son los repartos que PARECEN repartir: coger
      la longitud del código, o el último dígito, deja a tres personajes sin
      aparecer en todo el curso y a simple vista no se nota.
    */
    const veces = new Map<Especie, number>(TODAS.map((e) => [e, 0]));
    const codigos = todoElCurso();
    for (const codigo of codigos) {
      const quien = repartoDeLeccion(codigo).protagonista.especie;
      veces.set(quien, veces.get(quien)! + 1);
    }

    const minimo = Math.floor(codigos.length * 0.1);
    for (const especie of TODAS) {
      expect(veces.get(especie), `${especie} casi no da clase`).toBeGreaterThan(minimo);
    }
  });

  it('una unidad no sale entera con el mismo', () => {
    // Seis lecciones seguidas con el mismo profesor es lo que se siente como
    // «siempre me sale este». Se pide que en cada unidad se vean al menos tres
    // caras distintas de las cinco.
    for (let nivel = 1; nivel <= 16; nivel += 1) {
      for (let unidad = 1; unidad <= 4; unidad += 1) {
        const caras = new Set<Especie>();
        for (let leccion = 1; leccion <= 6; leccion += 1) {
          const codigo = `L${nivel}-U${unidad}-${String(leccion).padStart(2, '0')}`;
          caras.add(repartoDeLeccion(codigo).protagonista.especie);
        }
        expect(caras.size, `L${nivel}-U${unidad} sale casi entera con los mismos`).toBeGreaterThan(
          2,
        );
      }
    }
  });

  it('sin código todavía, tampoco se rompe', () => {
    // La pantalla monta antes de que la ruta entregue el código, así que este
    // caso ocurre de verdad en cada carga.
    expect(() => repartoDeLeccion('')).not.toThrow();
    expect(repartoDeLeccion('').protagonista.especie).toBe(
      repartoDeLeccion('').protagonista.especie,
    );
  });
});

describe('que sean cinco y no uno repetido', () => {
  it('no hay dos que reaccionen igual a todo', () => {
    /*
      Esta es la prueba que defiende la idea entera. El carácter de un personaje
      no está en el comentario que tiene encima, está en la fila de `animo`: si
      dos filas son idénticas, esos dos son el mismo personaje por muy distinto
      que diga el texto que son.

      Se rompe sola el día que alguien «arregle» a Nala poniéndole las caras de
      Milo porque le parezcan más simpáticas.
    */
    const filas = new Map<string, Especie>();
    for (const especie of TODAS) {
      const fila = JSON.stringify(REPARTO[especie].animo);
      const yaEstaba = filas.get(fila);
      expect(yaEstaba, `${especie} y ${yaEstaba} son el mismo personaje`).toBeUndefined();
      filas.set(fila, especie);
    }
  });

  it('nadie se pone triste cuando fallas', () => {
    /*
      La regla de la casa, escrita como prueba porque escrita como comentario no
      sobrevive a la primera tarde en que alguien piense que quedaría más tierno.

      `triste` es compadecerse, y compadecerse convierte un ejercicio fallado en
      un suspenso. El personaje puede picarse, espabilarse o acercarse a leer la
      corrección contigo; lo que no puede es poner cara de «pobrecito».
    */
    for (const especie of TODAS) {
      expect(REPARTO[especie].animo.fallo, `${especie} se compadece`).not.toBe('triste');
      expect(REPARTO[especie].animo.casi, `${especie} se compadece`).not.toBe('triste');
    }
  });

  it('nadie celebra un fallo ni lo aplaude', () => {
    // Al revés también: reaccionar con una fiesta a un fallo es peor que
    // compadecerse, porque además parece un error de programación.
    for (const especie of TODAS) {
      expect(['celebrando', 'animando']).not.toContain(REPARTO[especie].animo.fallo);
    }
  });

  it('no tienen todos la misma paciencia', () => {
    // Aburrirse antes que los demás es carácter, y es lo que se ve sin que
    // nadie diga nada. Si las cinco paciencias fueran iguales, los cinco se
    // dormirían a la vez y volverían a ser el mismo.
    const paciencias = new Set(TODAS.map((e) => REPARTO[e].paciencia));
    expect(paciencias.size).toBeGreaterThan(3);
  });

  it('todos tienen algo que decir en los tres momentos en que hablan', () => {
    for (const especie of TODAS) {
      for (const momento of ['entra', 'racha', 'final'] as const) {
        const frases = REPARTO[especie].dice[momento];
        expect(frases.length, `${especie} se queda mudo en «${momento}»`).toBeGreaterThan(0);
        for (const frase of frases) expect(frase.trim()).not.toBe('');
      }
    }
  });

  it('ninguno felicita por existir', () => {
    /*
      La misma regla que tiene escrita el tutor en el servidor: nada de «buen
      trabajo». Se trata a quien estudia como a alguien que está haciendo algo,
      no como a un alumno al que se le pone nota.

      Se mira en todo lo que dicen, incluidas las frases de racha, que son las
      que más tiran hacia ahí.
    */
    const prohibido = /muy bien|buen trabajo|bien hecho|enhorabuena|eres (un|una) crack|genial/i;
    for (const especie of TODAS) {
      for (const frases of Object.values(REPARTO[especie].dice)) {
        for (const frase of frases) {
          expect(frase, `${especie} felicita por existir`).not.toMatch(prohibido);
        }
      }
    }
  });
});

describe('lo que dice', () => {
  it('la misma lección abre siempre con la misma frase', () => {
    for (const codigo of ['L5-U1-03', 'L2-U3-04']) {
      const { protagonista } = repartoDeLeccion(codigo);
      const primera = fraseDe(protagonista, 'entra', codigo);
      for (let i = 0; i < 10; i += 1) {
        expect(fraseDe(protagonista, 'entra', codigo)).toBe(primera);
      }
      expect(protagonista.dice.entra).toContain(primera);
    }
  });

  it('quien encadena aciertos no oye siempre lo mismo', () => {
    /*
      La frase se elige con el código MÁS el número de racha justamente para
      esto. Con el código a secas, quien encadena doce aciertos oiría cuatro
      veces exactamente la misma frase, y ahí se acaba la ilusión de que hay
      alguien detrás.

      Se pide que en cuatro rachas se oigan al menos dos frases distintas, y no
      que las cuatro lo sean, porque eso último sería mentira: con dos o tres
      frases guardadas, un revoltijo repite por fuerza. Escribir la prueba
      exigiendo lo imposible solo lleva a apañar el reparto hasta que pase, que
      es peor que no tenerla.
    */
    for (const codigo of ['L5-U1-03', 'L1-U1-01', 'L16-U4-06']) {
      for (const especie of TODAS) {
        const personaje = REPARTO[especie];
        const oidas = new Set(
          [3, 6, 9, 12].map((r) => fraseDe(personaje, 'racha', `${codigo}:${r}`)),
        );
        expect(oidas.size, `${especie} dice siempre lo mismo en ${codigo}`).toBeGreaterThan(1);
      }
    }
  });
});
