import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NIVELES, TRAMOS, tramoDe } from './niveles';

/**
 * Que esta lista no se quede vieja.
 *
 *
 * POR QUÉ EXISTE
 *
 * Este archivo es una copia a mano del curso, y vive aquí por una razón buena:
 * la pantalla de bienvenida tiene que pintarse al instante, sin pedirle nada a
 * la API. El precio de esa copia es que puede mentir, y mintió.
 *
 * El curso creció de dieciséis niveles a veinticuatro. Aquí no se enteró nadie:
 * los tramos C1 y C2 seguían con la lista de niveles VACÍA, así que en la
 * pantalla salían las dos letras con su descripción y debajo no había nada.
 * Contado por quien lo vio: «el material ya debería aparecer aquí». Y no era
 * que faltara el material —estaba escrito, sembrado y servido—, era que esta
 * lista no lo nombraba.
 *
 * Una lista que hay que acordarse de ampliar se queda vieja antes o después.
 * Esto es lo que protesta la próxima vez.
 */

describe('los niveles del curso', () => {
  it('cada nivel está en un tramo, y en uno solo', () => {
    const huerfanos: string[] = [];
    const repetidos: string[] = [];

    for (const nivel of NIVELES) {
      const cuantos = TRAMOS.filter((tramo) => tramo.niveles.includes(nivel.codigo));
      if (cuantos.length === 0) huerfanos.push(nivel.codigo);
      if (cuantos.length > 1) repetidos.push(`${nivel.codigo} (${cuantos.length} tramos)`);
    }

    expect(
      huerfanos,
      `estos niveles no salen en ningún tramo, así que no se ven en la pantalla: ${huerfanos.join(', ')}`,
    ).toEqual([]);
    expect(repetidos, `estos niveles salen en más de un tramo: ${repetidos.join(', ')}`).toEqual(
      [],
    );
  });

  it('ningún tramo nombra un nivel que no existe', () => {
    const codigos = new Set(NIVELES.map((nivel) => nivel.codigo));
    const fantasmas = TRAMOS.flatMap((tramo) =>
      tramo.niveles.filter((codigo) => !codigos.has(codigo)).map((c) => `${tramo.letra} → ${c}`),
    );

    expect(fantasmas, `tramos que nombran niveles inexistentes: ${fantasmas.join(', ')}`).toEqual(
      [],
    );
  });

  it('ningún tramo se queda sin niveles', () => {
    /*
      Este es EL fallo que pasó. Un tramo vacío no revienta ni se ve en rojo:
      simplemente pinta su letra, su descripción y un hueco donde debería estar
      el camino.
    */
    const vacios = TRAMOS.filter((tramo) => tramo.niveles.length === 0).map((t) => t.letra);

    expect(vacios, `tramos sin un solo nivel detrás: ${vacios.join(', ')}`).toEqual([]);
  });

  it('el tramo que dice el nivel es el tramo donde está', () => {
    const descuadres: string[] = [];

    for (const nivel of NIVELES) {
      const tramo = tramoDe(nivel.codigo);
      // `A1+` y `A2+` son medios pasos: viven en el tramo de su letra.
      const letra = nivel.cefr.replace('+', '');
      if (tramo?.letra !== letra) {
        descuadres.push(
          `${nivel.codigo} dice ${nivel.cefr} pero está en ${tramo?.letra ?? 'nada'}`,
        );
      }
    }

    expect(descuadres, descuadres.join('; ')).toEqual([]);
  });

  it('los números van seguidos y empiezan en 1', () => {
    const numeros = NIVELES.map((nivel) => nivel.numero);
    expect(numeros).toEqual(numeros.map((_, i) => i + 1));

    for (const nivel of NIVELES) {
      expect(nivel.codigo, `${nivel.codigo} no cuadra con su número`).toBe(`L${nivel.numero}`);
    }
  });

  /**
   * La comprobación que de verdad habría pillado el fallo: contrastar con el
   * curso de verdad, que está en el otro repositorio.
   *
   * Se salta sola si el back no está al lado, porque son dos repositorios
   * distintos y quien clone solo este no debe ver una prueba roja por algo que
   * no tiene. Donde están los dos —la máquina de quien desarrolla— sí corre.
   */
  it('dice lo mismo que el curso del back, si el back está al lado', () => {
    const curso = path.resolve(__dirname, '../../../back/content/levels.json');
    if (!existsSync(curso)) return;

    const { levels } = JSON.parse(readFileSync(curso, 'utf8')) as {
      levels: Array<{ code: string; cefr: string; titleEs: string }>;
    };

    const alla = levels.map((nivel) => nivel.code).sort();
    const aca = NIVELES.map((nivel) => nivel.codigo).sort();

    const faltan = alla.filter((codigo) => !aca.includes(codigo));
    const sobran = aca.filter((codigo) => !alla.includes(codigo));

    expect(faltan, `el curso tiene estos niveles y esta pantalla no: ${faltan.join(', ')}`).toEqual(
      [],
    );
    expect(
      sobran,
      `esta pantalla anuncia niveles que el curso no tiene: ${sobran.join(', ')}`,
    ).toEqual([]);

    const tramoDistinto = levels
      .filter((nivel) => {
        const mio = NIVELES.find((n) => n.codigo === nivel.code);
        return mio && mio.cefr !== nivel.cefr;
      })
      .map((nivel) => {
        const mio = NIVELES.find((n) => n.codigo === nivel.code);
        return `${nivel.code}: el curso dice ${nivel.cefr}, aquí pone ${mio?.cefr}`;
      });

    expect(tramoDistinto, tramoDistinto.join('; ')).toEqual([]);
  });
});
