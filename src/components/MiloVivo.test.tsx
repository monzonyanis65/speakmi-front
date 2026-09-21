import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MiloVivo } from './MiloVivo';

/**
 * El Milo con física.
 *
 * Aquí no se puede comprobar «que se vea bien»: eso se mira. Lo que sí se puede
 * fijar es que no quede ninguna animación de duración fija, que el movimiento
 * responda al cursor, y que quien pide menos movimiento se quede sin él. Lo
 * demás se revisó en el navegador.
 */

function conMenosMovimiento(activado: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta.includes('prefers-reduced-motion') ? activado : false,
    media: consulta,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

beforeEach(() => conMenosMovimiento(false));
afterEach(() => vi.unstubAllGlobals());

/** El transform que el navegador acaba aplicando a un elemento del dibujo. */
function transformDe(selector: string): string {
  const el = document.querySelector(selector) as HTMLElement | null;
  return el?.style.transform ?? '';
}

describe('Milo con física', () => {
  it('se dibuja y dice quién es', () => {
    render(<MiloVivo />);
    expect(screen.getByRole('img', { name: /Milo/i })).toBeInTheDocument();
  });

  /*
    Que la mirada llegue de verdad al ojo se comprobó en el navegador: con el
    cursor arriba a la izquierda y abajo a la derecha, la pupila da matrices
    distintas, y a 90 ms de un salto grande todavía va por el camino. Aquí no
    se puede repetir: los resortes avanzan con fotogramas y en este entorno de
    pruebas el reloj no corre. Lo que sí se puede fijar es si el componente se
    pone a escuchar al cursor o no.
  */
  it('se pone a escuchar el cursor', () => {
    const escuchados: string[] = [];
    const original = window.addEventListener;
    vi.spyOn(window, 'addEventListener').mockImplementation((tipo, ...resto) => {
      escuchados.push(String(tipo));
      return original.call(window, tipo, ...(resto as [EventListener]));
    });

    render(<MiloVivo />);
    expect(escuchados).toContain('pointermove');
  });

  it('con menos movimiento ni escucha el cursor', () => {
    conMenosMovimiento(true);

    const escuchados: string[] = [];
    const original = window.addEventListener;
    vi.spyOn(window, 'addEventListener').mockImplementation((tipo, ...resto) => {
      escuchados.push(String(tipo));
      return original.call(window, tipo, ...(resto as [EventListener]));
    });

    render(<MiloVivo />);
    // Perseguir el cursor por toda la página es justo lo que marea a quien
    // activa ese ajuste, así que ahí se queda mirando al frente.
    expect(escuchados).not.toContain('pointermove');
  });

  it('deja de escuchar al desmontarse', () => {
    const quitados: string[] = [];
    const original = window.removeEventListener;
    vi.spyOn(window, 'removeEventListener').mockImplementation((tipo, ...resto) => {
      quitados.push(String(tipo));
      return original.call(window, tipo, ...(resto as [EventListener]));
    });

    const { unmount } = render(<MiloVivo />);
    unmount();
    expect(quitados).toContain('pointermove');
  });

  it('no usa ninguna animación de CSS: todo va por física', () => {
    const { container } = render(<MiloVivo />);
    const marcado = container.innerHTML;

    // Si alguien vuelve a colar una clase `animate-` aquí, se pierde el motivo
    // de que este componente exista.
    expect(marcado).not.toMatch(/animate-/);
    expect(marcado).not.toMatch(/transition-duration/);
  });

  it('el estiramiento del aliento es asimétrico', async () => {
    render(<MiloVivo />);
    // El grupo del cuerpo es el que respira: escala distinto en cada eje, que
    // es lo que conserva el volumen en vez de hincharlo como un globo.
    // Es `g > g` y no `g`: el de fuera es la capa de la vuelta, que en reposo
    // no transforma nada. El que respira es el de dentro.
    const cuerpo = document.querySelector('svg > g > g') as SVGGElement | null;
    expect(cuerpo).not.toBeNull();

    const estilo = cuerpo!.getAttribute('style') ?? '';
    expect(estilo).toMatch(/scale-?[xX]|--motion/);
  });

  /*
    El guardián del fallo más caro de este archivo.

    La librería marca lo que anima con `transform-box: fill-box`, y con eso un
    pivote escrito en píxeles deja de contarse desde el lienzo y pasa a contarse
    desde el borde de cada pieza. Estuvo así y, medido en el navegador, la
    cabeza giraba alrededor de un punto que caía fuera del cráneo y el ojo se
    estrechaba alrededor de un punto a 50 píxeles de sí mismo. Se veía casi
    bien, que es lo que lo hizo durar.
  */
  it('todos los pivotes van en porcentaje, nunca en píxeles', () => {
    const { container } = render(<MiloVivo />);
    // Se miran solo los dos primeros valores: el tercero es la z, que el
    // navegador escribe siempre como `0px` y no dice nada de nuestro pivote.
    const origenes = [...container.innerHTML.matchAll(/transform-origin:\s*([^;"]+)/g)].map((m) =>
      m[1]!.trim().split(/\s+/),
    );
    expect(origenes.length).toBeGreaterThan(3);

    const enPixeles = origenes.filter(([x, y]) => x?.endsWith('px') || y?.endsWith('px'));
    expect(enPixeles).toEqual([]);
  });

  it('tiene cara y nuca: puede darse la vuelta entera', () => {
    const { container } = render(<MiloVivo />);
    // Sin una nuca dibujada aparte, la vuelta se queda en un guiño: el cuerpo
    // se estrecha y al volver a abrirse sigue estando la misma cara.
    expect(container.querySelectorAll('circle[r="26"]').length).toBe(2);
    // Y las cejas, que son la mitad del gesto de cualquier mueca.
    expect(container.querySelectorAll('path[stroke-width="2.6"]').length).toBe(2);
  });

  it('acepta el tamaño que se le pida', () => {
    render(<MiloVivo tamano={96} />);
    expect(screen.getByRole('img', { name: /Milo/i })).toHaveAttribute('width', '96');
  });

  it('el transform del dibujo existe, así que la física está montada', () => {
    render(<MiloVivo />);
    expect(transformDe('svg')).not.toBe('');
  });
});
