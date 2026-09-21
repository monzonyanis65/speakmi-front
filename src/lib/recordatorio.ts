/**
 * El recordatorio diario para volver a practicar.
 *
 * Aquí hay que ser honesto con lo que un navegador puede hacer. Una página web
 * no puede despertarse sola a una hora para avisarte: eso lo hace una app
 * instalada, o un servidor que empuja el aviso. Lo que sí se puede es avisar
 * cuando la aplicación está abierta, y recordar si ya se avisó hoy.
 *
 * Así que esto no promete más de lo que cumple, y la pantalla de ajustes lo
 * dice con todas las letras. Lo contrario sería un interruptor decorativo: se
 * activa, no llega ningún aviso, y se pierde la confianza en todo lo demás.
 */

const CLAVE_ULTIMO = 'speakmi.recordatorio.ultimo';

export type EstadoPermiso = 'sin-soporte' | 'concedido' | 'denegado' | 'sin-pedir';

export function estadoDelPermiso(): EstadoPermiso {
  // `typeof` y no `'Notification' in window`: la propiedad puede existir con
  // valor indefinido, y entonces leer `.permission` revienta.
  if (typeof Notification === 'undefined') return 'sin-soporte';
  if (Notification.permission === 'granted') return 'concedido';
  if (Notification.permission === 'denied') return 'denegado';
  return 'sin-pedir';
}

/** Pide permiso. Devuelve cómo quedó la cosa. */
export async function pedirPermiso(): Promise<EstadoPermiso> {
  if (estadoDelPermiso() === 'sin-soporte') return 'sin-soporte';
  try {
    const respuesta = await Notification.requestPermission();
    return respuesta === 'granted'
      ? 'concedido'
      : respuesta === 'denied'
        ? 'denegado'
        : 'sin-pedir';
  } catch {
    return 'denegado';
  }
}

/** Un aviso de prueba, para ver que llega antes de fiarse del ajuste. */
export function avisarAhora(texto = 'Así se verán los recordatorios de Speakmi.'): boolean {
  if (estadoDelPermiso() !== 'concedido') return false;
  try {
    new Notification('Speakmi', {
      body: texto,
      icon: '/icon-192.png',
      tag: 'speakmi-recordatorio',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * El día de hoy según el reloj de quien estudia, no según UTC.
 *
 * `toISOString` da la fecha en UTC, y en Venezuela son cuatro horas menos: a
 * partir de las ocho de la tarde el día UTC ya ha cambiado. Con eso, un aviso
 * dado a las siete se volvía a dar a las nueve, porque para el código ya era
 * otro día. Justo en las horas en que la gente estudia.
 */
function hoy(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/**
 * ¿Toca avisar ya?
 *
 * Se avisa una vez al día, a partir de la hora elegida, y solo si la aplicación
 * está abierta. Se guarda el día del último aviso para no repetirlo cada vez
 * que se cambia de pantalla.
 */
export function tocaAvisar(hora: string): boolean {
  if (estadoDelPermiso() !== 'concedido') return false;

  const [h, m] = hora.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return false;

  const ahora = new Date();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  if (minutosAhora < h * 60 + m) return false;

  try {
    return localStorage.getItem(CLAVE_ULTIMO) !== hoy();
  } catch {
    // Sin memoria se avisaría en cada carga, que es peor que no avisar.
    return false;
  }
}

export function marcarAvisado(): void {
  try {
    localStorage.setItem(CLAVE_ULTIMO, hoy());
  } catch {
    // Sin memoria no se puede evitar repetir; `tocaAvisar` ya devuelve falso.
  }
}
