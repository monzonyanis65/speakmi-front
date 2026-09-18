import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useContador } from './contador';

/**
 * El entorno de pruebas no pinta fotogramas, así que se le da un
 * `requestAnimationFrame` de mentira que se puede avanzar a mano. Así se puede
 * comprobar lo que de verdad importa: que el número pasa por valores
 * intermedios en vez de saltar al final.
 */
let ahora = 0;
let pendientes: Array<(t: number) => void> = [];

function avanzar(ms: number) {
  ahora += ms;
  const cola = pendientes;
  pendientes = [];
  act(() => {
    for (const fn of cola) fn(ahora);
  });
}

beforeEach(() => {
  ahora = 0;
  pendientes = [];
  vi.stubGlobal('requestAnimationFrame', (fn: (t: number) => void) => {
    pendientes.push(fn);
    return pendientes.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('performance', { now: () => ahora });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

afterEach(() => vi.unstubAllGlobals());

describe('número que sube contando', () => {
  it('empieza en cero y llega al destino', async () => {
    const { result } = renderHook(() => useContador(100, 1000));
    expect(result.current).toBe(0);

    avanzar(1000);
    await waitFor(() => expect(result.current).toBe(100));
  });

  it('pasa por valores intermedios, no salta', async () => {
    const { result } = renderHook(() => useContador(100, 1000));

    const vistos: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      avanzar(100);
      vistos.push(result.current);
    }

    // Si saltara al final, todos los valores serían 100.
    const intermedios = vistos.filter((n) => n > 0 && n < 100);
    expect(intermedios.length).toBeGreaterThan(3);
    expect(vistos.at(-1)).toBe(100);
  });

  it('frena al final: avanza más en la primera mitad que en la segunda', async () => {
    const { result } = renderHook(() => useContador(100, 1000));

    avanzar(500);
    const mitad = result.current;

    // Con una curva que desacelera, a mitad de tiempo ya se lleva más de la
    // mitad del recorrido. Es lo que hace que se sienta vivo y no mecánico.
    expect(mitad).toBeGreaterThan(50);
    expect(mitad).toBeLessThan(100);
  });

  it('a quien pide menos movimiento se le da el número y ya', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { result } = renderHook(() => useContador(250, 1000));
    expect(result.current).toBe(250);
  });

  it('un destino de cero no se anima', () => {
    const { result } = renderHook(() => useContador(0, 1000));
    expect(result.current).toBe(0);
  });
});
