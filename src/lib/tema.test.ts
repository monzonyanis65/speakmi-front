import { describe, expect, it, beforeEach } from 'vitest';
import { aplicarTema, temaEfectivo, temaGuardado } from './tema';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-tema');
});

describe('tema', () => {
  it('sin elegir nada manda el sistema', () => {
    expect(temaGuardado()).toBe('auto');
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
  });

  it('elegir oscuro lo marca en el documento y lo recuerda', () => {
    aplicarTema('oscuro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
    expect(temaGuardado()).toBe('oscuro');
  });

  it('volver a automático quita el atributo, no lo pone en "auto"', () => {
    aplicarTema('claro');
    aplicarTema('auto');
    // Con `data-tema="auto"` la media query del sistema no volvería a mandar:
    // las reglas de CSS miran la ausencia del atributo, no su valor.
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
    expect(temaGuardado()).toBe('auto');
  });

  it('un valor inventado en la memoria no se aplica', () => {
    localStorage.setItem('speakmi.tema', 'fucsia');
    expect(temaGuardado()).toBe('auto');
  });

  it('resuelve el automático mirando al sistema', () => {
    expect(temaEfectivo('claro')).toBe('claro');
    expect(temaEfectivo('oscuro')).toBe('oscuro');
    expect(['claro', 'oscuro']).toContain(temaEfectivo('auto'));
  });
});
