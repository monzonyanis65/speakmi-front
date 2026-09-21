export type Tema = 'auto' | 'claro' | 'oscuro';

const CLAVE = 'speakmi.tema';

/**
 * Claro, oscuro o el del sistema.
 *
 * Se guarda en el navegador y no solo en el servidor a propósito: así se aplica
 * antes de que cargue nada, sin esperar a una petición. Un cambio de tema a
 * mitad de carga es un fogonazo blanco en una habitación a oscuras.
 */
export function temaGuardado(): Tema {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'claro' || valor === 'oscuro' ? valor : 'auto';
  } catch {
    // Navegación privada o almacenamiento bloqueado: manda el sistema.
    return 'auto';
  }
}

/** Lo aplica al documento y lo recuerda. */
export function aplicarTema(tema: Tema): void {
  if (typeof document === 'undefined') return;

  // `auto` se marca quitando el atributo, no poniéndolo en "auto": así la
  // media query del sistema vuelve a mandar sin más reglas de por medio.
  if (tema === 'auto') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.setAttribute('data-tema', tema);

  try {
    if (tema === 'auto') localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, tema);
  } catch {
    // Que no se pueda recordar no impide usarlo en esta sesión.
  }
}

/** Qué se está viendo ahora mismo, resolviendo el «auto». */
export function temaEfectivo(tema: Tema): 'claro' | 'oscuro' {
  if (tema !== 'auto') return tema;
  // `matchMedia` falta en algunos entornos, y no tenerlo no puede tumbar la
  // pantalla: sin poder preguntar al sistema se asume claro.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'claro';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}
