import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { type ReactNode } from 'react';
import { BEEPER } from './beeper';
import { GESTOS } from './coreografia';
import { type Visema } from './tipos';

/**
 * Las pruebas de Beeper, el robot.
 *
 * No comprueban que el dibujo sea bonito, que eso no se comprueba: comprueban
 * las tres cosas de este personaje que se pueden romper sin que se note en
 * ninguna pantalla hasta que alguien se pone el gorro, se duerme o habla.
 *
 * Todas miden SOBRE EL MARCADO en vez de repetir los números del archivo. Una
 * prueba que dijera `expect(anclajes.coronilla).toBe(16)` no comprobaría nada:
 * sería la misma constante escrita dos veces, y al retocar el chasis se
 * cambiarían las dos a la vez sin mirar si siguen cuadrando.
 */

/** Monta un trozo de personaje dentro de un lienzo y devuelve el nodo raíz. */
function lienzo(pieza: ReactNode): SVGSVGElement {
  const { container } = render(
    <svg viewBox="0 0 120 120" data-testid="lienzo">
      {pieza}
    </svg>,
  );
  return container.querySelector('svg')!;
}

/** Un rectángulo del dibujo, con sus cuatro medidas ya en números. */
function rectangulo(raiz: SVGSVGElement, pieza: string) {
  const nodo = raiz.querySelector(`[data-pieza="${pieza}"]`);
  expect(nodo, `falta la pieza "${pieza}"`).not.toBeNull();
  const num = (attr: string) => Number(nodo!.getAttribute(attr));
  return {
    x: num('x'),
    y: num('y'),
    ancho: num('width'),
    alto: num('height'),
    radio: num('rx'),
  };
}

/** Todas las barritas de una boca, con su base y su altura. */
function barras(visema: Visema) {
  const raiz = lienzo(BEEPER.bocas[visema]);
  return [...raiz.querySelectorAll('rect')].map((r) => ({
    izq: Number(r.getAttribute('x')),
    ancho: Number(r.getAttribute('width')),
    alto: Number(r.getAttribute('height')),
    base: Number(r.getAttribute('y')) + Number(r.getAttribute('height')),
  }));
}

/** La Y del pivote de la boca, que es la línea base del medidor. */
const LINEA_BASE = Number(BEEPER.origenBoca.split(/\s+/)[1]!.replace('px', ''));

describe('Beeper, el robot', () => {
  /*
    LA PRUEBA DEL GORRO.

    Los anclajes existen para que una prenda dibujada una sola vez caiga bien en
    todas las cabezas, y una cabeza CUADRADA es justo la que más fácil los
    desmiente: sus esquinas de arriba están mucho más altas que las de un cráneo
    redondo del mismo ancho, así que un `anchoCabeza` copiado de los animales
    deja las dos puntas del chasis asomando por encima de la copa.

    Esto no compara números con números: rehace la cuenta que hace `CapaAtuendo`
    para el gorro —media elipse de `anchoCabeza` por `anchoCabeza * 0.72`, con el
    borde catorce píxeles por debajo de la coronilla— y comprueba punto por punto
    que queda por encima del contorno real del cráneo dibujado.
  */
  it('el gorro tapa el cráneo de punta a punta', () => {
    const { coronilla, anchoCabeza } = BEEPER.anclajes;
    const craneo = rectangulo(lienzo(BEEPER.cabeza), 'craneo');

    // Lo primero, que los anclajes describan el cráneo que hay y no otro.
    expect(craneo.y).toBe(coronilla);
    expect(craneo.ancho / 2).toBe(anchoCabeza);
    expect(craneo.x + craneo.ancho / 2).toBe(60);

    // El contorno de arriba de un rectángulo redondeado, esquinas incluidas.
    const techoDelCraneo = (px: number) => {
      const centroIzq = craneo.x + craneo.radio;
      const centroDer = craneo.x + craneo.ancho - craneo.radio;
      if (px >= centroIzq && px <= centroDer) return craneo.y;
      const dx = px < centroIzq ? centroIzq - px : px - centroDer;
      return craneo.y + craneo.radio - Math.sqrt(craneo.radio ** 2 - dx ** 2);
    };

    // La copa del gorro, con la misma fórmula que `atuendos.tsx`.
    const borde = coronilla + 14;
    const alto = anchoCabeza * 0.72;
    const techoDelGorro = (px: number) =>
      borde - alto * Math.sqrt(1 - ((px - 60) / anchoCabeza) ** 2);

    for (let px = craneo.x; px <= craneo.x + craneo.ancho; px += 0.5) {
      expect(
        techoDelGorro(px),
        `a x=${px} el cráneo asoma por encima de la copa del gorro`,
      ).toBeLessThanOrEqual(techoDelCraneo(px));
    }
  });

  /*
    LAS CEJAS VIVEN DENTRO DEL VISOR.

    Son dos segmentos de LED y van en ámbar: sobre el visor oscuro se ven
    perfectamente, y sobre el gris del chasis apenas. El hueco donde caben es
    estrecho por los CUATRO lados, no por dos, y esa es la gracia de esta
    prueba: arriba y abajo se ven a simple vista, pero a los lados no, porque
    ahí el borde del visor no es recto sino una esquina redondeada que se mete
    hacia dentro justo a la altura a la que sube la ceja al sorprenderse.
  */
  it('las cejas caben dentro del visor, también levantadas del todo', () => {
    const cabeza = lienzo(BEEPER.cabeza);
    const visor = rectangulo(cabeza, 'visor');
    const banda = rectangulo(cabeza, 'banda-ojos');
    const { y, ancho, arco, grosor } = BEEPER.cejas;

    // En reposo: por debajo del borde del visor y por encima de la banda.
    expect(y - arco - grosor / 2).toBeGreaterThan(visor.y);
    expect(y + grosor / 2).toBeLessThan(banda.y);

    /*
      La subida no la decide este archivo: sale de la coreografía, donde cada
      estado declara cuánto sube la ceja y cuánto se descompensan entre sí. El
      esqueleto reparte ese sesgo con `- sesgo * 0.7` en la de acá y
      `+ sesgo * 0.3` en la de allá, así que la que más sube es siempre la de
      acá. Se recorren los once estados en vez de escribir aquí el peor número,
      porque el peor número lo puede cambiar mañana cualquier pose nueva.
    */
    const subidaMaxima = Math.max(
      ...Object.values(GESTOS).flatMap(({ a, b }) =>
        [a, b].map((pose) => -(pose.ceja - pose.cejaSesgo * 0.7)),
      ),
    );
    const levantada = y - subidaMaxima;
    expect(levantada - arco - grosor / 2).toBeGreaterThanOrEqual(visor.y);

    /*
      Y AHORA LAS PUNTAS, que es el lado que no se ve venir.

      El esqueleto pone las dos cejas en x=50 y x=70, así que la punta de fuera
      de cada una cae a `ancho` del centro del ojo, más medio grosor por el
      remate redondo del trazo. Levantadas, esas dos puntas se meten en la
      esquina del visor. Se comprueba contra el contorno real del rectángulo
      redondeado, esquinas incluidas, y no contra sus lados rectos: comparando
      con los lados, el fallo no aparece, que es justo por lo que este es el que
      se cuela.
    */
    /*
      Con medio píxel de margen, no al filo. Al medirlo salió que una ceja de
      las de los animales —`ancho` 8— cabía por ocho centésimas de píxel, y eso
      no es caber: es que todavía no se ha visto. Media unidad es lo que hace
      que la prueba avise antes de que el fallo salga en una captura.
    */
    const MARGEN = 0.5;
    const dentroDelVisor = (px: number, py: number) => {
      const izq = visor.x + visor.radio;
      const der = visor.x + visor.ancho - visor.radio;
      const arriba = visor.y + visor.radio;
      const abajo = visor.y + visor.alto - visor.radio;
      const cx = Math.min(Math.max(px, izq), der);
      const cy = Math.min(Math.max(py, arriba), abajo);
      return Math.hypot(px - cx, py - cy) <= visor.radio - MARGEN;
    };

    for (const centro of [50, 70]) {
      for (const lado of [-1, 1]) {
        const punta = centro + lado * (ancho + grosor / 2);
        expect(
          dentroDelVisor(punta, levantada),
          `levantada del todo, la punta de la ceja en x=${punta} se sale del visor`,
        ).toBe(true);
      }
    }
  });

  /*
    LAS SEIS SIGUEN SIENDO SEIS.

    El esqueleto las monta todas a la vez y cruza en opacidad la que toca, así
    que dos bocas iguales no son una boca de más: son una sílaba en la que no
    pasa nada y el personaje parece atascado.
  */
  it('las seis bocas son seis dibujos distintos', () => {
    const visemas: Visema[] = ['cerrada', 'sonrisa', 'pena', 'ancha', 'redonda', 'abierta'];
    const dibujos = visemas.map((v) => lienzo(BEEPER.bocas[v]).innerHTML);

    for (const [i, dibujo] of dibujos.entries()) {
      expect(dibujo.length, `la boca "${visemas[i]}" está vacía`).toBeGreaterThan(0);
    }
    expect(new Set(dibujos).size).toBe(visemas.length);
  });

  /*
    EL MEDIDOR SE APOYA EN SU LÍNEA BASE.

    Las tres bocas de sonido son barras de nivel, y una barra de nivel crece
    desde abajo. Por eso `origenBoca` no está en una bisagra sino en el suelo
    del display: al hablar, el esqueleto estira la boca desde ese punto y las
    barras suben. Si alguna barra no naciera exactamente ahí, al hablar se
    despegaría del suelo del medidor y se vería flotando.
  */
  it('las barras de nivel nacen todas en la línea base del display', () => {
    for (const visema of ['ancha', 'redonda', 'abierta'] as Visema[]) {
      const trozos = barras(visema);
      expect(trozos.length, `la boca "${visema}" no tiene barras`).toBeGreaterThan(0);
      for (const barra of trozos) {
        expect(barra.base, `una barra de "${visema}" no toca la línea base`).toBeCloseTo(
          LINEA_BASE,
          5,
        );
      }
    }
  });

  /*
    Y NO SE SALEN DEL CRISTAL AL HABLAR.

    El esqueleto estira la boca hasta un 25 % más alta en las sílabas fuertes
    (`bocaAlto` va de 1,05 a 1,25 en `Mascota.tsx`). Como el estirón sale de la
    línea base, la barra más alta es la que decide: pasada de largo, la punta
    asoma por encima del cristal y pinta sobre el marco, que es un fallo que
    solo se ve mientras habla y dura una sílaba.
  */
  it('ninguna barra se sale del cristal cuando el estirón de hablar es máximo', () => {
    const cristal = rectangulo(lienzo(BEEPER.hocico), 'cristal-display');
    const ESTIRON_MAXIMO = 1.25;

    for (const visema of ['ancha', 'redonda', 'abierta'] as Visema[]) {
      for (const barra of barras(visema)) {
        const punta = LINEA_BASE - barra.alto * ESTIRON_MAXIMO;
        expect(
          punta,
          `una barra de "${visema}" se sale del cristal al hablar`,
        ).toBeGreaterThanOrEqual(cristal.y);
      }
    }
  });

  /*
    NI VERDE NI ROJO EN NINGUNA PARTE.

    El diseño de origen venía con los LED en verde menta y algún acento rojo,
    que es la paleta de Duolingo. En esta aplicación esos dos colores tienen
    significado —verde es acertar, rojo es fallar— y un robot con la cara verde
    estaría dando un «correcto» que nadie ha ganado. Esta prueba mira el
    personaje entero, piezas y bocas, para que un retoque de mañana no los
    vuelva a colar.
  */
  it('no usa ningún color que en esta aplicación signifique acertar o fallar', () => {
    const entero = lienzo(
      <>
        {BEEPER.cola}
        {BEEPER.cuerpo}
        {BEEPER.alaLejana}
        {BEEPER.alaCercana}
        {BEEPER.orejas}
        {BEEPER.cabeza}
        {BEEPER.hocico}
        {BEEPER.patas}
        {Object.values(BEEPER.bocas)}
      </>,
    ).innerHTML;

    expect(entero).not.toMatch(/(red|green|emerald|lime|teal)-\d/);
    expect(entero.toUpperCase()).not.toMatch(/#(58CC02|FF4B4B|FFC800|FF9600)/);
    expect(entero).not.toMatch(/var\(--color-(acierto|fallo|aviso)\)/);
    expect(BEEPER.cejas.color).not.toMatch(/(red|green|emerald|lime|teal)-\d/);
  });
});
