import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El icono que acaba en la pantalla de inicio del teléfono.
 *
 * Son cinco archivos que tienen que decir lo mismo y viven en cuatro sitios
 * distintos: el SVG original, los PNG que se generan de él, el `<link>` de
 * `index.html` y el manifest de `vite.config.ts`. Nada obliga a que coincidan, y
 * cuando no coinciden no se rompe nada: sencillamente el teléfono enseña el
 * icono viejo, o enseña una franja de otro color alrededor. Eso no se ve en
 * local —ahí el icono lo pone el navegador desde el SVG— y se descubre después
 * de instalarla.
 *
 * Por eso esto no mira si el dibujo es bonito, que no se puede medir, sino las
 * tres cosas que se desparejan solas:
 *
 *   · que exista el archivo que cada sitio promete;
 *   · que mida lo que dice medir;
 *   · que el fondo del dibujo sea el mismo que el `background_color`.
 *
 *
 * ESTA PRUEBA COMPROBABA LO QUE NO ERA
 *
 * Comparaba el fondo del icono con el `theme_color`, y eso era una premisa
 * equivocada: `theme_color` pinta la barra de estado y la de herramientas, o
 * sea el CROMADO de la aplicación, que es índigo porque esa es la marca. El que
 * va detrás del icono mientras arranca es `background_color`, que es otro campo.
 *
 * Atarlos obligaba a que el icono fuese del color de la barra de estado, que no
 * tiene por qué. Se vio en cuanto el icono dejó de ser un cuadrado índigo y pasó
 * a ser un dibujo sobre un cielo claro: la prueba daba rojo y el icono estaba
 * bien. Lo que se arregló fue la prueba.
 */

const raiz = path.resolve(import.meta.dirname, '..');
const leer = (relativo: string) => readFileSync(path.join(raiz, relativo), 'utf8');

const svg = leer('public/favicon.svg');
const html = leer('index.html');
const vite = leer('vite.config.ts');

/** El lado de un PNG sale de su cabecera, sin descomprimir nada. */
function ladoDe(relativo: string): { ancho: number; alto: number } {
  const bytes = readFileSync(path.join(raiz, relativo));
  return { ancho: bytes.readUInt32BE(16), alto: bytes.readUInt32BE(20) };
}

/**
 * El color por el que empieza el fondo del dibujo.
 *
 * Es la primera parada del degradado, que es la de arriba, y es la que se ve
 * pegada al borde superior del icono.
 */
function fondoDelSvg(): string {
  const encontrado = /<stop[^>]*stop-color="(#[0-9a-fA-F]{6})"/.exec(svg);
  return (encontrado?.[1] ?? '').toLowerCase();
}

describe('el icono de la aplicación', () => {
  it('cada PNG mide lo que su nombre y el manifest prometen', () => {
    const esperados = [
      { archivo: 'public/icon-192.png', lado: 192 },
      { archivo: 'public/icon-512.png', lado: 512 },
      { archivo: 'public/icon-maskable-512.png', lado: 512 },
      { archivo: 'public/apple-touch-icon.png', lado: 180 },
    ];

    for (const { archivo, lado } of esperados) {
      const medido = ladoDe(archivo);
      expect(medido, `${archivo} no es cuadrado`).toEqual({ ancho: lado, alto: lado });
    }
  });

  it('el manifest y el html solo prometen archivos que existen', () => {
    const prometidos = [
      ...vite.matchAll(/src: '\/([\w.-]+\.png)'/g),
      ...html.matchAll(/href="\/([\w.-]+\.(?:png|svg))"/g),
    ].map((coincidencia) => coincidencia[1]!);

    // Que haya algo que comprobar: si un día cambia la forma de escribirlo, esta
    // prueba se quedaría pasando sin mirar nada.
    expect(prometidos.length).toBeGreaterThanOrEqual(4);

    for (const archivo of prometidos) {
      expect(() => leer(`public/${archivo}`), `${archivo} se promete y no está`).not.toThrow();
    }
  });

  it('el fondo del dibujo es el mismo que el de la pantalla de arranque', () => {
    const fondo = fondoDelSvg();
    expect(fondo, 'el SVG no declara el degradado del fondo').toMatch(/^#[0-9a-f]{6}$/);

    // `background_color` es lo que pinta el teléfono detrás del icono mientras
    // la aplicación arranca. Si no es el del icono, durante ese segundo se ve un
    // marco de otro tono alrededor del dibujo.
    const arranque = /background_color: '(#[0-9a-fA-F]{6})'/.exec(vite)?.[1];
    expect(arranque?.toLowerCase(), 'el background_color no es el del icono').toBe(fondo);
  });

  it('la barra de estado sigue siendo del color de la marca', () => {
    // Esto NO tiene que ver con el icono, y por eso se comprueba aparte: es el
    // cromado de la aplicación. Antes estaba atado al fondo del dibujo y era un
    // error; se deja escrito para que no se vuelvan a atar.
    const delHtml = /<meta name="theme-color" content="(#[0-9a-fA-F]{6})"/.exec(html)?.[1];
    const delManifest = /theme_color: '(#[0-9a-fA-F]{6})'/.exec(vite)?.[1];

    expect(delHtml?.toLowerCase()).toBe('#4f46e5');
    expect(delManifest?.toLowerCase()).toBe('#4f46e5');
  });
});
