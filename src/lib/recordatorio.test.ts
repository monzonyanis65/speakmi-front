import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { estadoDelPermiso, marcarAvisado, tocaAvisar } from './recordatorio';

/** Deja el reloj del navegador en una hora concreta de hoy. */
function sonLas(hora: number, minuto: number) {
  const ahora = new Date();
  ahora.setHours(hora, minuto, 0, 0);
  vi.setSystemTime(ahora);
}

function conPermiso(valor: NotificationPermission) {
  vi.stubGlobal(
    'Notification',
    class {
      static permission = valor;
      static requestPermission = () => Promise.resolve(valor);
    },
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('recordatorio diario', () => {
  it('sin permiso no avisa, aunque haya pasado la hora', () => {
    conPermiso('default');
    sonLas(21, 0);
    expect(tocaAvisar('19:00')).toBe(false);
  });

  it('con permiso denegado tampoco', () => {
    conPermiso('denied');
    sonLas(21, 0);
    expect(estadoDelPermiso()).toBe('denegado');
    expect(tocaAvisar('19:00')).toBe(false);
  });

  it('antes de la hora no avisa', () => {
    conPermiso('granted');
    sonLas(18, 59);
    expect(tocaAvisar('19:00')).toBe(false);
  });

  it('pasada la hora avisa una vez', () => {
    conPermiso('granted');
    sonLas(19, 1);
    expect(tocaAvisar('19:00')).toBe(true);
  });

  it('no repite el mismo día', () => {
    conPermiso('granted');
    sonLas(19, 1);
    marcarAvisado();
    // Volver a abrir la aplicación por la noche no puede soltar otro aviso.
    sonLas(23, 0);
    expect(tocaAvisar('19:00')).toBe(false);
  });

  it('una hora mal escrita no dispara nada', () => {
    conPermiso('granted');
    sonLas(23, 0);
    expect(tocaAvisar('a las siete')).toBe(false);
  });

  it('sin soporte de avisos lo dice en vez de fallar', () => {
    vi.stubGlobal('Notification', undefined);
    expect(estadoDelPermiso()).toBe('sin-soporte');
  });
});
