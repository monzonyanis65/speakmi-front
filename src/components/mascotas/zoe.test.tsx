import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CapaAtuendo } from './atuendos';
import { GESTOS } from './coreografia';
import { type Visema } from './tipos';
import { ZOE } from './zoe';

/**
 * Lo que hay que comprobar de un personaje nuevo, comprobado sobre el dibujo.
 *
 * Una especie no tiene comportamiento: es una bolsa de formas quietas. Así que
 * aquí no se prueba que algo se mueva —de eso ya se encargan las pruebas del
 * motor— sino las tres cosas que sí se pueden equivocar al dibujar y que no se
 * ven hasta que alguien mira la pantalla:
 *
 *   1. que los anclajes estén MEDIDOS sobre el cráneo y no estimados a ojo,
 *   2. que la ropa que se cuelga de ellos caiga donde tiene que caer,
 *   3. que no haya quedado ni un color que en esta aplicación signifique otra
 *      cosa (el rojo de fallar, el verde de acertar) ni ninguno de los de la
 *      marca de la que salió el estudio original.
 *
 * Todo se hace pintando las piezas a texto: una pieza es SVG y el SVG es
 * legible, así que se puede medir sin abrir un navegador.
 */

const pintar = (nodo: ReactNode) => renderToStaticMarkup(<>{nodo}</>);

/** Todas las piezas del personaje en un solo texto, para buscar por él. */
function marcaCompleta(): string {
  const bocas = Object.values(ZOE.bocas);
  return [
    pintar(ZOE.cola),
    pintar(ZOE.cuerpo),
    pintar(ZOE.alaLejana),
    pintar(ZOE.alaCercana),
    pintar(ZOE.orejas),
    pintar(ZOE.cabeza),
    pintar(ZOE.hocico),
    pintar(ZOE.patas),
    ...bocas.map(pintar),
    ZOE.cejas.color,
  ].join(' ');
}

function atributos(etiqueta: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const trozo of etiqueta.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
    salida[trozo[1]!] = trozo[2]!;
  }
  return salida;
}

function elementos(marca: string, nombre: string): Record<string, string>[] {
  return [...marca.matchAll(new RegExp(`<${nombre}\\b[^>]*>`, 'g'))].map((uno) =>
    atributos(uno[0]),
  );
}

/** El círculo más grande de una pieza: el cráneo en `cabeza`, la melena en `orejas`. */
function redondoMayor(nodo: ReactNode) {
  const marca = pintar(nodo);
  const formas = [
    ...elementos(marca, 'circle').map((a) => ({
      cx: Number(a.cx),
      cy: Number(a.cy),
      rx: Number(a.r),
      ry: Number(a.r),
    })),
    ...elementos(marca, 'ellipse').map((a) => ({
      cx: Number(a.cx),
      cy: Number(a.cy),
      rx: Number(a.rx),
      ry: Number(a.ry),
    })),
  ];
  return formas.reduce((mayor, uno) => (uno.rx > mayor.rx ? uno : mayor));
}

describe('Zoe, la exploradora', () => {
  it('lleva los anclajes medidos sobre su propio cráneo, no estimados', () => {
    const craneo = redondoMayor(ZOE.cabeza);

    // La coronilla es el punto más alto del cráneo y el medio ancho es su radio.
    // No son dos números que «queden bien»: son dos medidas del dibujo, y si el
    // dibujo cambia de tamaño y estos no, el gorro se queda flotando o clavado.
    expect(craneo.cx).toBe(60);
    expect(ZOE.anclajes.coronilla).toBe(craneo.cy - craneo.ry);
    expect(ZOE.anclajes.anchoCabeza).toBe(craneo.rx);

    // Los ojos los pinta el esqueleto en y=40 para todas las especies, así que
    // esa línea tiene que caer dentro de la cara, no sobre el pelo ni en el aire.
    expect(ZOE.anclajes.ojos).toBeGreaterThan(craneo.cy - craneo.ry);
    expect(ZOE.anclajes.ojos).toBeLessThan(craneo.cy + craneo.ry);

    // Y el cuello, por debajo del centro de la cabeza: es el punto por el que
    // gira, y puesto por encima la cabeza se ladearía desde la frente.
    expect(ZOE.anclajes.cuello).toBeGreaterThan(craneo.cy);
  });

  it('la gorra se apoya SOBRE el pelo y no se hunde dentro de él', () => {
    /*
      Esta es la prueba que de verdad usa `CapaAtuendo`, en vez de repetir aquí
      su fórmula. Zoe es la primera con una mata de pelo más alta que el cráneo,
      y el contrato dice que la coronilla se mide sin contar el copete: si la
      cúpula del gorro no llega por encima del pelo, el gorro aparece medio
      enterrado en la cabeza, que es justo lo que no se ve en ninguna otra
      prueba.
    */
    const gorro = pintar(<CapaAtuendo atuendo="OUTFIT_GORRO" anclajes={ZOE.anclajes} />);
    const cupula = elementos(gorro, 'path')
      .map((a) => a.d ?? '')
      .find((d) => d.includes('A '));
    expect(cupula).toBeDefined();

    const medidas = cupula!.match(/M[\d.]+ ([\d.]+) A [\d.]+ ([\d.]+)/);
    expect(medidas).not.toBeNull();
    const [borde, alto] = [Number(medidas![1]), Number(medidas![2])];

    const melena = redondoMayor(ZOE.orejas);
    expect(borde - alto).toBeLessThanOrEqual(melena.cy - melena.ry);

    // Y el pelo tiene que asomar por los lados de la gorra: si fuera más
    // estrecho que el cráneo, no sería pelo, sería un casco.
    expect(melena.rx).toBeGreaterThan(ZOE.anclajes.anchoCabeza);
  });

  it('las cejas siguen sobre la piel cuando se suben del todo', () => {
    /*
      Las cejas son la mitad de la cara y el esqueleto las sube varios píxeles al
      sorprenderse. En una cara humana eso las lleva hacia el nacimiento del
      pelo, y una ceja castaña sobre pelo castaño desaparece justo en el gesto
      en el que más se mira.

      La subida no se escribe a mano aquí: se saca de las poses de verdad, para
      que si algún día una pose exagera el gesto, esta prueba se entere.
    */
    const subida = Math.min(
      ...Object.values(GESTOS)
        .flatMap(({ a, b }) => [a, b])
        .flatMap((pose) => [pose.ceja - pose.cejaSesgo * 0.7, pose.ceja + pose.cejaSesgo * 0.3]),
    );
    expect(subida).toBeLessThan(0);

    const craneo = redondoMayor(ZOE.cabeza);
    // La punta de fuera de la ceja de acá, que va centrada sobre el ojo de x=50.
    const punta = { x: 50 - ZOE.cejas.ancho, y: ZOE.cejas.y + subida };
    const distancia = Math.hypot(punta.x - craneo.cx, punta.y - craneo.cy);

    expect(distancia).toBeLessThanOrEqual(craneo.rx);
  });

  it('no le queda ni un color de la marca de la que salió el estudio', () => {
    // El acento original de Zoe era el #FF4B4B, que es de Duolingo. Estos cuatro
    // no pueden aparecer ni como atributo ni metidos en una clase arbitraria.
    const marca = marcaCompleta().toUpperCase();
    for (const prohibido of ['#58CC02', '#FF4B4B', '#FFC800', '#FF9600']) {
      expect(marca).not.toContain(prohibido);
    }
  });

  it('no se pinta de rojo ni de verde, que aquí significan fallar y acertar', () => {
    /*
      En esta aplicación el rojo y el verde no son colores, son mensajes: el
      rojo es haber fallado y el verde haber acertado. Una mascota de uno de los
      dos aparece al lado de una corrección y se lee como parte de ella.
    */
    const marca = marcaCompleta();
    for (const familia of ['red', 'green', 'emerald', 'lime']) {
      expect(marca).not.toMatch(new RegExp(`(fill|stroke)-${familia}-`));
    }
    expect(marca).not.toContain('var(--color-fallo)');
    expect(marca).not.toContain('var(--color-acierto)');
  });

  it('declara las seis bocas y ninguna sale vacía', () => {
    const seis: Visema[] = ['cerrada', 'sonrisa', 'pena', 'ancha', 'redonda', 'abierta'];

    for (const cual of seis) {
      // Una boca que falte no es una boca que no salga: el esqueleto las cruza
      // en opacidad, así que es un hueco que aparece a media sílaba.
      expect(pintar(ZOE.bocas[cual]).length).toBeGreaterThan(0);
    }

    // Y todas dentro de la cara: la barbilla está en el borde bajo del cráneo.
    const craneo = redondoMayor(ZOE.cabeza);
    const barbilla = craneo.cy + craneo.ry;
    for (const cual of seis) {
      const bajos = [
        ...elementos(pintar(ZOE.bocas[cual]), 'ellipse').map((a) => Number(a.cy) + Number(a.ry)),
        ...[...pintar(ZOE.bocas[cual]).matchAll(/[\d.]+ ([\d.]+)/g)].map((uno) => Number(uno[1])),
      ];
      expect(Math.max(...bajos)).toBeLessThan(barbilla);
    }
  });
});
