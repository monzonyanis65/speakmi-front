import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ICONOS, type ClaveIcono } from '.';

/**
 * LO QUE SE PRUEBA AQUÍ ES QUE LOS VEINTIOCHO SEAN UNA FAMILIA.
 *
 * Un juego de iconos no se rompe de golpe: se rompe de uno en uno. Alguien
 * añade el vigesimonoveno con el trazo a 1.5 porque «se veía gordo», o le mete
 * un gris para que no cante tanto en oscuro, y seis meses después hay dos
 * juegos de iconos conviviendo y nadie sabe cuál es el bueno.
 *
 * Estas pruebas no miran si un dibujo es bonito —eso se mira en una captura a
 * tamaño real— sino las cuatro reglas que no se pueden incumplir sin que el
 * conjunto deje de parecer uno: la rejilla, el trazo, el color heredado y la
 * etiqueta.
 */

const CLAVES = Object.keys(ICONOS) as ClaveIcono[];

function pintar(clave: ClaveIcono, props: Record<string, unknown> = {}) {
  const Dibujo = ICONOS[clave];
  const { container, unmount } = render(<Dibujo {...props} />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error(`${clave} no pinta ningún svg`);
  return { svg, html: container.innerHTML, unmount };
}

describe('el juego de iconos', () => {
  it('son veintiocho y ninguno se llama como otro', () => {
    expect(CLAVES.length).toBe(28);
    expect(new Set(CLAVES).size).toBe(CLAVES.length);
  });

  it.each(CLAVES)('%s se dibuja en la rejilla de 24 y con el trazo de la casa', (clave) => {
    const { svg, unmount } = pintar(clave);

    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('stroke-width')).toBe('2');
    expect(svg.getAttribute('stroke-linecap')).toBe('round');
    expect(svg.getAttribute('stroke-linejoin')).toBe('round');
    // 24 es la rejilla y también el tamaño de serie: un icono que sale a otro
    // tamaño sin que nadie lo pida es un icono que descuadra una fila.
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');

    /*
      Y el trazo se hereda del lienzo, no se repite dentro. Esto es lo que
      impide el afinado a ojo de un icono suelto —«es que este se veía gordo»—,
      que es exactamente como se deshacen estos juegos: el que lo adelgaza tiene
      razón mirando ese icono solo, y se equivoca mirando la fila entera.
    */
    for (const forma of svg.querySelectorAll('*')) {
      for (const propiedad of ['stroke-width', 'stroke-linecap', 'stroke-linejoin']) {
        expect(
          forma.getAttribute(propiedad),
          `${clave} se sale del trazo de la familia en ${propiedad}`,
        ).toBeNull();
      }
    }

    unmount();
  });

  /*
    LA REGLA DEL COLOR, QUE ES LA QUE MÁS SE INCUMPLE SIN QUERER.

    Un icono con un color escrito dentro funciona en claro y desaparece en
    oscuro, o al revés, y nadie lo ve hasta que alguien cambia de tema. Aquí se
    prohíbe de raíz: lo único que puede haber en un `fill` o en un `stroke` es
    `currentColor` —el tono de donde esté— o `none`.
  */
  it.each(CLAVES)('%s hereda el color y no trae ninguno escrito', (clave) => {
    const { html, unmount } = pintar(clave);

    for (const [entero, valor] of html.matchAll(/\b(?:fill|stroke)="([^"]*)"/g)) {
      expect(['currentColor', 'none'], `${clave}: ${entero}`).toContain(valor);
    }
    expect(html, `${clave} trae un color escrito a mano`).not.toMatch(/#[0-9a-f]{3}|rgba?\(|hsl/i);
    // Y tampoco por la puerta de atrás, con una clase de color de Tailwind.
    expect(html, `${clave} pinta con una clase de color`).not.toMatch(
      /\b(?:fill|stroke|text)-(?:slate|marca|acento|emerald|orange|pink|white|black)/,
    );

    unmount();
  });

  /*
    SIN SOMBRAS. A 24 px una sombra no da profundidad, da suciedad: el trazo
    tiene 2 px y cualquier desenfoque se come la mitad. El relieve de esta
    aplicación vive en los botones, no aquí.
  */
  it.each(CLAVES)('%s no lleva sombra ni desenfoque', (clave) => {
    const { html, unmount } = pintar(clave);

    expect(html).not.toMatch(/filter|feGaussianBlur|drop-shadow|opacity/i);

    unmount();
  });

  it.each(CLAVES)('%s obedece el tamaño que se le pide', (clave) => {
    const { svg, unmount } = pintar(clave, { tamano: 40 });

    expect(svg.getAttribute('width')).toBe('40');
    expect(svg.getAttribute('height')).toBe('40');
    // La rejilla NO cambia con el tamaño: el dibujo se escala entero.
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');

    unmount();
  });

  /*
    LA ETIQUETA, QUE ES LA MITAD DEL TRABAJO.

    Un icono al lado de su palabra tiene que callarse, porque si no el lector
    de pantalla dice la cosa dos veces. Un icono que es lo ÚNICO que hay dentro
    de un botón tiene que hablar, porque si no el botón no tiene nombre. Las
    dos cosas salen del mismo sitio para que no se pueda acertar en una y
    fallar en la otra.
  */
  it.each(CLAVES)('%s se esconde del lector de pantalla si no le dan etiqueta', (clave) => {
    const { svg, unmount } = pintar(clave);

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.getAttribute('aria-label')).toBeNull();

    unmount();
  });

  it.each(CLAVES)('%s se anuncia como imagen con nombre cuando sí le dan etiqueta', (clave) => {
    const { svg, unmount } = pintar(clave, { etiqueta: 'Un nombre' });

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Un nombre');
    expect(svg.getAttribute('aria-hidden')).toBeNull();

    unmount();
  });

  /*
    QUE NO HAYA DOS IGUALES.

    La prueba de verdad de un juego de iconos es mirarlos a 24 px uno al lado
    de otro, y eso no lo puede hacer jsdom. Lo que sí puede es cazar el fallo
    tonto que precede al otro: copiar un icono para hacer el siguiente y
    olvidarse de cambiarle el trazado. Pasó con la moneda y la diana, que
    nacieron siendo los dos círculos concéntricos.
  */
  it('no hay dos iconos con el mismo dibujo', () => {
    const porDibujo = new Map<string, ClaveIcono[]>();

    for (const clave of CLAVES) {
      const { svg, unmount } = pintar(clave);
      const firma = [...svg.querySelectorAll('path, circle')]
        .map((f) => f.getAttribute('d') ?? `${f.getAttribute('cx')},${f.getAttribute('r')}`)
        .join('|');
      porDibujo.set(firma, [...(porDibujo.get(firma) ?? []), clave]);
      unmount();
    }

    const repetidos = [...porDibujo.values()].filter((claves) => claves.length > 1);
    expect(repetidos, `estos iconos son el mismo dibujo: ${JSON.stringify(repetidos)}`).toEqual([]);
  });

  /*
    LOS CINCO DE LA BARRA.

    El relleno es el mismo trazado con `fill`, no un segundo dibujo, y esta
    prueba lo exige: los dos estados tienen que compartir las mismas `d` y
    diferenciarse SOLO en el relleno. Así nadie puede retocar la silueta de uno
    y dejar la del otro vieja.
  */
  it.each(['libro', 'mando', 'copa', 'bolsa', 'persona'] as const)(
    '%s engorda al marcarse, y es el mismo dibujo relleno',
    (clave) => {
      const linea = pintar(clave);
      const relleno = pintar(clave, { relleno: true });

      const formas = (svg: SVGElement) =>
        [...svg.querySelectorAll('path, circle')].map((f) => f.getAttribute('d') ?? f.outerHTML);

      expect(relleno.html, 'el estado marcado no se distingue del normal').not.toBe(linea.html);
      expect(relleno.html, 'el marcado no rellena nada').toContain('fill="currentColor"');
      expect(linea.html, 'el normal viene relleno de serie').not.toContain('fill="currentColor"');
      expect(formas(relleno.svg).length).toBe(formas(linea.svg).length);

      linea.unmount();
      relleno.unmount();
    },
  );
});
