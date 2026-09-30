import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { type ReactNode } from 'react';
import { BARNABY } from './barnaby';
import { CapaAtuendo } from './atuendos';

/**
 * Barnaby, comprobado sin mirarlo.
 *
 * Una especie es una bolsa de formas quietas, así que casi todo lo suyo se
 * puede leer del SVG que produce: dónde tiene el cráneo, hasta dónde llega el
 * muñón de la cola y si el gorro de la tienda cae donde dice el anclaje.
 *
 * Lo que se comprueba aquí es justo lo que una captura fija NO enseña: que el
 * muñón se MUEVA, que siga pegado al cuerpo mientras se mueve, y que los cuatro
 * anclajes salgan del dibujo y no del ojo de quien lo dibujó.
 */

/** Pinta un trozo suelto de la especie en un lienzo de 120x120 y lo devuelve. */
function pintar(pieza: ReactNode) {
  const { container } = render(<svg viewBox="0 0 120 120">{pieza}</svg>);
  return container.querySelector('svg')!;
}

function num(el: Element | null, atributo: string) {
  return Number(el?.getAttribute(atributo));
}

/** El cuerpo de las seis especies: la misma elipse. */
const CUERPO = { cx: 60, cy: 66, rx: 34, ry: 36 };

/** El esqueleto gira la cola hasta 14 grados; ese es todo el recorrido que hay. */
const GIRO_MAXIMO = 14;

/** «44px 82px» -> [44, 82]. Es como el motor lee los pivotes de cada especie. */
function pivote(origen: string): [number, number] {
  const [x, y] = origen.split(/\s+/);
  return [parseFloat(x ?? ''), parseFloat(y ?? '')];
}

function girar(x: number, y: number, ox: number, oy: number, grados: number) {
  const a = (grados * Math.PI) / 180;
  const dx = x - ox;
  const dy = y - oy;
  return {
    x: ox + dx * Math.cos(a) - dy * Math.sin(a),
    y: oy + dx * Math.sin(a) + dy * Math.cos(a),
  };
}

/**
 * Si un círculo de radio `r` centrado en (x,y) muerde la elipse del cuerpo.
 *
 * Se mira el punto del círculo que más se acerca al centro del cuerpo: si ese
 * cae dentro de la elipse, la pieza está montada sobre la silueta y no flotando
 * al lado.
 */
function tocaElCuerpo(x: number, y: number, r: number) {
  const dx = CUERPO.cx - x;
  const dy = CUERPO.cy - y;
  const d = Math.hypot(dx, dy);
  const px = x + (dx / d) * r;
  const py = y + (dy / d) * r;
  return ((px - CUERPO.cx) / CUERPO.rx) ** 2 + ((py - CUERPO.cy) / CUERPO.ry) ** 2 <= 1;
}

describe('los anclajes de Barnaby salen del dibujo', () => {
  /*
    Esta es la prueba que importa de todo el archivo.

    Los anclajes existen para que un gorro dibujado UNA vez quede bien en las
    seis cabezas, y se pueden escribir a ojo sin que nada reviente: el
    componente compila, la mascota sale, y lo único que pasa es que la gorra
    queda torcida en un solo animal. Aquí se leen del cráneo de verdad —el
    `rect` que pinta `cabeza`— y se comparan con lo que la especie declara.
  */
  it('la coronilla y el ancho son los del cráneo que se pinta', () => {
    const craneo = pintar(BARNABY.cabeza).querySelector('rect');
    expect(craneo, 'Barnaby ya no pinta el cráneo con un rect').not.toBeNull();

    const x = num(craneo, 'x');
    const ancho = num(craneo, 'width');

    expect(BARNABY.anclajes.coronilla, 'la coronilla no es donde empieza el cráneo').toBe(
      num(craneo, 'y'),
    );
    expect(BARNABY.anclajes.anchoCabeza, 'el medio ancho no es el del cráneo').toBe(ancho / 2);
    // Y el cráneo tiene que estar centrado, o el medio ancho no significa nada.
    expect(x + ancho / 2).toBe(60);
  });

  it('el cuello queda por debajo de la barbilla y por encima de la barriga', () => {
    const craneo = pintar(BARNABY.cabeza).querySelector('rect');
    const barbilla = num(craneo, 'y') + num(craneo, 'height');
    // La bufanda se ata aquí y la cabeza gira por aquí: dentro del cuello, no
    // en mitad de la cara ni a media barriga.
    expect(BARNABY.anclajes.cuello).toBeLessThanOrEqual(barbilla);
    expect(BARNABY.anclajes.cuello).toBeGreaterThan(num(craneo, 'y') + 30);
  });

  it('el gorro se apoya en el cráneo de punta a punta', () => {
    const craneo = pintar(BARNABY.cabeza).querySelector('rect');
    const izquierda = num(craneo, 'x');
    const derecha = izquierda + num(craneo, 'width');

    const gorro = pintar(<CapaAtuendo atuendo="OUTFIT_GORRO" anclajes={BARNABY.anclajes} />);
    const copa = gorro.querySelector('path')!.getAttribute('d')!;
    const [, arranque] = copa.match(/^M([\d.-]+)/)!;
    const [, final] = copa.match(/A [^A]*?([\d.-]+) [\d.-]+ Z$/)!;

    expect(Number(arranque), 'el ala del gorro no llega al borde del cráneo').toBeCloseTo(
      izquierda,
      5,
    );
    expect(Number(final)).toBeCloseTo(derecha, 5);
  });
});

describe('el muñón de la cola de un oso', () => {
  /** La raíz y la punta del trazo de la cola, que es lo único que hay que mirar. */
  function trazoDeLaCola() {
    const d = pintar(BARNABY.cola).querySelector('path')!.getAttribute('d')!;
    const puntos = [...d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }));
    return { raiz: puntos[0]!, punta: puntos.at(-1)! };
  }

  it('nace dentro de la silueta, no pegada por fuera', () => {
    // El cuerpo se pinta DESPUÉS de la cola, así que una raíz enterrada queda
    // tapada y la cola parece salir del animal. Una raíz que empieza fuera del
    // cuerpo se lee como una coma pegada al lado, que es el error que arregló el
    // zorro en su día.
    const { raiz } = trazoDeLaCola();
    expect(tocaElCuerpo(raiz.x, raiz.y, 0), 'la cola nace fuera del cuerpo').toBe(true);
  });

  it('la punta asoma, o no habría cola que ver', () => {
    const { punta } = trazoDeLaCola();
    expect(tocaElCuerpo(punta.x, punta.y, 0), 'la cola entera queda tapada por el cuerpo').toBe(
      false,
    );
  });

  /*
    UNA COLA CORTA NO SE PIVOTA COMO UNA LARGA, Y ESTO ES LO QUE LO DEMUESTRA.

    El zorro lleva el pivote A MITAD de cola porque con una cola de treinta y
    cinco píxeles pivotada en la raíz, los 14 grados que gira el esqueleto
    barrerían medio lienzo. Copiar esa decisión aquí es lo que sale solo —es la
    otra cola de la casa y es la que se mira— y con este muñón deja la punta
    moviéndose menos de dos píxeles: la cola se queda clavada.

    Esta prueba se pone roja con el pivote a mitad de cola, y verde con el pivote
    en la raíz, que es al revés que el zorro y por el mismo motivo.
  */
  it('el pivote está en la raíz, y por eso la punta se menea', () => {
    const { punta } = trazoDeLaCola();
    const [ox, oy] = pivote(BARNABY.origenCola);

    const arriba = girar(punta.x, punta.y, ox, oy, -GIRO_MAXIMO);
    const abajo = girar(punta.x, punta.y, ox, oy, GIRO_MAXIMO);
    const recorrido = Math.hypot(abajo.x - arriba.x, abajo.y - arriba.y);

    /*
      Ocho píxeles y no cuatro. Con el listón en cuatro, un pivote puesto a mitad
      de cola —que es la copia literal del zorro— pasaba raspando: mueve la punta
      4.1, y 4.1 píxeles en un lienzo de 120 no se ven. Con el pivote en la raíz
      son 10.7, así que el listón cae en medio y separa las dos decisiones en vez
      de dejarlas empatadas.
    */
    expect(recorrido, 'la punta se queda clavada: el pivote está pegado a ella').toBeGreaterThan(8);
  });

  it('la raíz no se mueve, así que la cola nunca se despega', () => {
    // Girar alrededor de la raíz es lo que hace que meterla dentro del cuerpo
    // salga gratis: el punto que se queda quieto es justo el que no se ve.
    const { raiz } = trazoDeLaCola();
    const [ox, oy] = pivote(BARNABY.origenCola);

    for (let g = -GIRO_MAXIMO; g <= GIRO_MAXIMO; g += 1) {
      const p = girar(raiz.x, raiz.y, ox, oy, g);
      expect(tocaElCuerpo(p.x, p.y, 0), `la cola nace fuera del cuerpo a ${g} grados`).toBe(true);
    }
  });
});

describe('la cara de Barnaby', () => {
  it('tiene las seis bocas y son seis dibujos distintos', () => {
    // Declararlas todas no basta: repetir la misma forma pasaría esta prueba por
    // arriba y dejaría la cara muda. Y una que falte no es una boca que no sale,
    // es un hueco que aparece a media sílaba.
    const formas = Object.values(BARNABY.bocas).map((boca) => pintar(boca).innerHTML);
    expect(formas).toHaveLength(6);
    expect(new Set(formas).size, 'Barnaby repite alguna boca').toBe(6);
  });

  it('ninguna boca se sale del morro crema', () => {
    const morro = [...pintar(BARNABY.cabeza).querySelectorAll('ellipse')].at(-1)!;
    const abajo = num(morro, 'cy') + num(morro, 'ry');

    for (const [cual, boca] of Object.entries(BARNABY.bocas)) {
      for (const forma of pintar(boca).querySelectorAll('ellipse')) {
        expect(
          num(forma, 'cy') + num(forma, 'ry'),
          `la boca ${cual} se sale del morro por abajo`,
        ).toBeLessThanOrEqual(abajo);
      }
    }
  });

  it('la nariz no le pisa los ojos, que se pintan antes', () => {
    // Los ojos son círculos de radio 9 en (50,40) y (70,40) en todas las
    // especies, y la nariz se pinta DESPUÉS: si se le monta encima, el oso mira
    // desde detrás de una mancha.
    const nariz = pintar(BARNABY.hocico).querySelector('ellipse')!;
    const cx = num(nariz, 'cx');
    const cy = num(nariz, 'cy');
    const rx = num(nariz, 'rx');
    const ry = num(nariz, 'ry');

    for (const ojoX of [50, 70]) {
      // Punto de la nariz más cercano al ojo, recorriendo su borde.
      let choca = false;
      for (let a = 0; a < 360; a += 2) {
        const t = (a * Math.PI) / 180;
        const px = cx + rx * Math.cos(t);
        const py = cy + ry * Math.sin(t);
        if (Math.hypot(px - ojoX, py - 40) < 9) choca = true;
      }
      expect(choca, `la nariz se mete en el ojo de x=${ojoX}`).toBe(false);
    }
  });

  it('las cejas caben entre las orejas redondas', () => {
    // Las orejas de un oso son círculos grandes que bajan por los lados hasta
    // la altura de la ceja. Una ceja que empiece dentro de la oreja se lee como
    // un pelo suelto, no como una ceja.
    const orejas = [...pintar(BARNABY.orejas).querySelectorAll('circle')];
    const { y, ancho } = BARNABY.cejas;

    for (const oreja of orejas) {
      const cx = num(oreja, 'cx');
      const cy = num(oreja, 'cy');
      const r = num(oreja, 'r');
      const dy = Math.abs(y - cy);
      if (dy >= r) continue;
      const alcance = Math.sqrt(r * r - dy * dy);
      const extremo = cx < 60 ? 50 - ancho : 70 + ancho;
      if (cx < 60) expect(cx + alcance, 'la oreja de acá pisa la ceja').toBeLessThan(extremo);
      else expect(cx - alcance, 'la oreja de allá pisa la ceja').toBeGreaterThan(extremo);
    }
  });
});

describe('la paleta es la de Speakmi, no la de Duolingo', () => {
  /*
    Se leen los comentarios FUERA antes de mirar. Este archivo nombra los cuatro
    colores de Duolingo por escrito para dejar constancia de cuáles no pueden
    quedar, así que buscarlos en el texto entero encontraría siempre los cuatro.
    Lo que se comprueba es que no se PINTE con ellos.
  */
  const fuente = readFileSync(
    path.join(process.cwd(), 'src/components/mascotas/barnaby.tsx'),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  it('no queda ni un color de marca del original', () => {
    for (const color of ['#58CC02', '#FF4B4B', '#FFC800', '#FF9600']) {
      expect(fuente.toUpperCase(), `queda ${color}, que es de Duolingo`).not.toContain(color);
    }
  });

  it('no se pinta de rojo ni de verde, que aquí significan otra cosa', () => {
    /*
      En esta aplicación el rojo es haber fallado y el verde haber acertado. Un
      personaje pintado de cualquiera de los dos se lee como una corrección cada
      vez que sale al lado de una, y sale al lado de una constantemente.

      El rosa de los mofletes y de la lengua sí pasa, porque ya lo usan el perro
      y el zorro y nadie lo confunde con el color de fallar.
    */
    const pintadas = fuente.match(/(?:fill|stroke)-[a-z]+-\d+/g) ?? [];
    for (const clase of pintadas) {
      expect(clase, `${clase} usa un color que ya significa algo`).not.toMatch(
        /-(red|green|emerald|lime)-/,
      );
    }
  });
});
