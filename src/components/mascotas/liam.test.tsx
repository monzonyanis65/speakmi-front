import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CapaAtuendo } from './atuendos';
import { LIAM } from './liam';
import { type Visema } from './tipos';

/**
 * Lo que hay que comprobar de un personaje nuevo, que no es que se dibuje.
 *
 * Que un `path` exista no dice nada: los seis personajes son formas quietas y
 * cualquier prueba que mire «hay un camino en la capa de la cabeza» pasa siempre.
 * Lo que sí se puede romper sin que nadie lo vea son las TRES cosas de aquí
 * abajo, y las tres se rompen callando: el gorro de la tienda dejando de tapar
 * el pelo, dos visemas iguales, y un color de la marca de otro colándose.
 */

const VISEMAS: Visema[] = ['cerrada', 'sonrisa', 'pena', 'ancha', 'redonda', 'abierta'];

/**
 * Los puntos de un `path`, en pares.
 *
 * Todos los caminos de Liam se escriben con órdenes absolutas de dos números
 * —`M`, `L`, `C`, `Q`— así que los números alternan x e y desde el principio y
 * basta con leerlos de dos en dos. No vale para una `A` (el arco lleva siete
 * números y solo dos son un punto), y por eso esta función solo se usa sobre el
 * pelo, que no tiene ninguno.
 */
function puntosDe(d: string): { x: number; y: number }[] {
  const numeros = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const puntos: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < numeros.length; i += 2) {
    puntos.push({ x: numeros[i]!, y: numeros[i + 1]! });
  }
  return puntos;
}

describe('Liam', () => {
  /**
   * EL PELO TIENE QUE CABER DEBAJO DEL GORRO.
   *
   * Esta es la prueba que justifica el archivo entero. Liam es el primero que
   * lleva algo propio en la cabeza, y los anclajes existen precisamente para que
   * una prenda dibujada una sola vez siente bien en las seis especies. Si el
   * flequillo sube un par de píxeles —o si a alguien le parece que la coronilla
   * «debería» estar más arriba— el pelo empieza a salir POR ENCIMA de la copa de
   * la gorra y el personaje se queda con un mechón atravesando el sombrero. No
   * revienta nada, no sale en ninguna otra prueba, y en la tienda se ve a 64
   * píxeles, que es donde menos se nota.
   *
   * La copa del gorro es media elipse apoyada en `coronilla + 14` y de alto
   * `anchoCabeza * 0.72`, que es como la calcula `CapaAtuendo`. Su punto más alto
   * es la diferencia de los dos, y por encima de ahí no puede haber ni un punto
   * de pelo.
   *
   * Se comparan los PUNTOS DE CONTROL y no la curva, y eso hace la prueba más
   * exigente de lo necesario a propósito: una curva de Bézier nunca se sale de la
   * envolvente de sus puntos, así que si los puntos caben, la curva cabe seguro.
   */
  it('deja el pelo entero por debajo de la copa del gorro', () => {
    const { coronilla, anchoCabeza } = LIAM.anclajes;
    const cumbreDelGorro = coronilla + 14 - anchoCabeza * 0.72;

    const { container } = render(
      <svg viewBox="0 0 120 120">
        {LIAM.orejas}
        {LIAM.cabeza}
      </svg>,
    );

    const pelo = [...container.querySelectorAll('path')].filter((p) =>
      (p.getAttribute('class') ?? '').includes('fill-violet-800'),
    );
    // Dos: la masa de detrás del cráneo y el flequillo de delante. Si algún día
    // son una sola pieza o tres, esta prueba tiene que enterarse.
    expect(pelo).toHaveLength(2);

    const masAlto = Math.min(
      ...pelo.flatMap((p) => puntosDe(p.getAttribute('d') ?? '').map((pt) => pt.y)),
    );
    expect(masAlto).toBeGreaterThan(cumbreDelGorro);
  });

  /**
   * Y el gorro tiene que apoyarse en el pelo, no flotar sobre él.
   *
   * La otra mitad de lo mismo: con el pelo demasiado bajo la prueba de arriba
   * pasaría igual y la gorra quedaría colgada en el aire. El margen tiene que
   * existir y tiene que ser pequeño.
   */
  it('apoya el gorro sobre el pelo, sin dejar aire entre los dos', () => {
    const { coronilla, anchoCabeza } = LIAM.anclajes;
    const cumbreDelGorro = coronilla + 14 - anchoCabeza * 0.72;

    const { container } = render(
      <svg viewBox="0 0 120 120">
        {LIAM.cabeza}
        <CapaAtuendo atuendo="OUTFIT_GORRO" anclajes={LIAM.anclajes} />
      </svg>,
    );

    const flequillo = [...container.querySelectorAll('path')].find((p) =>
      (p.getAttribute('class') ?? '').includes('fill-violet-800'),
    );
    const cumbreDelPelo = Math.min(
      ...puntosDe(flequillo?.getAttribute('d') ?? '').map((pt) => pt.y),
    );

    expect(cumbreDelPelo - cumbreDelGorro).toBeLessThan(6);
  });

  /**
   * Las seis bocas tienen que ser seis bocas distintas.
   *
   * El esqueleto monta las seis a la vez y cruza en opacidad la que toca, así que
   * dos visemas iguales no dan ningún error: dan una boca que se queda quieta en
   * mitad de una sílaba, que es de las cosas más difíciles de ver mirando y de
   * las más fáciles de provocar copiando y pegando la de al lado.
   */
  it('dibuja las seis bocas y ninguna repetida', () => {
    const dibujadas = VISEMAS.map((cual) => {
      const { container } = render(<svg viewBox="0 0 120 120">{LIAM.bocas[cual]}</svg>);
      return container.innerHTML;
    });

    for (const marcado of dibujadas) {
      expect(marcado).toMatch(/<(path|ellipse|circle|rect)/);
    }
    expect(new Set(dibujadas).size).toBe(VISEMAS.length);
  });

  /**
   * Ni un color de la marca de Duolingo.
   *
   * El personaje viene de un estudio de bocetos pintado con su paleta, y los
   * cuatro de abajo son suyos. Además, dos de ellos chocan con el idioma de esta
   * aplicación: aquí el verde significa acertar y el rojo fallar.
   *
   * Se lee el archivo tal cual porque es la única forma de pillarlo: un color
   * escrito a mano no llega al marcado como texto reconocible, y una clase de
   * Tailwind tampoco se resuelve en las pruebas.
   */
  it('no conserva ningún color de la paleta de origen', () => {
    const fuente = readFileSync(path.join(import.meta.dirname, 'liam.tsx'), 'utf8');
    for (const color of ['58CC02', 'FF4B4B', 'FFC800', 'FF9600']) {
      expect(fuente.toUpperCase()).not.toContain(color);
    }
    // Y tampoco por la vía de las clases: verde y rojo son señales, no pelaje.
    expect(fuente).not.toMatch(/(fill|stroke)-(green|red|emerald|lime)-/);
  });
});
