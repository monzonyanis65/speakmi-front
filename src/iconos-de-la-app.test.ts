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
 *   · que el color del fondo del dibujo sea el mismo que el `theme_color`, que
 *     es el que pinta la barra de estado y la pantalla de arranque. Si no lo
 *     es, al abrirla aparece un marco de otro tono alrededor del icono.
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

/** El color de fondo que declara el propio dibujo. */
function fondoDelSvg(): string {
  const encontrado = /<rect[^>]*fill="(#[0-9a-fA-F]{6})"/.exec(svg);
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

  it('el fondo del dibujo es el mismo color que la barra de estado', () => {
    const fondo = fondoDelSvg();
    expect(fondo, 'el SVG no declara un fondo liso').toMatch(/^#[0-9a-f]{6}$/);

    const delHtml = /<meta name="theme-color" content="(#[0-9a-fA-F]{6})"/.exec(html)?.[1];
    const delManifest = /theme_color: '(#[0-9a-fA-F]{6})'/.exec(vite)?.[1];

    expect(delHtml?.toLowerCase(), 'el theme-color del html no es el del icono').toBe(fondo);
    expect(delManifest?.toLowerCase(), 'el theme_color del manifest no es el del icono').toBe(
      fondo,
    );
  });
});
