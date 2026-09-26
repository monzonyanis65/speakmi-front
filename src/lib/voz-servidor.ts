import { getToken } from '@/lib/auth';
import { URL_API } from '@/lib/api';

/**
 * El plan B del sonido: que hable el servidor.
 *
 * Hasta aquí, todo el inglés que suena en la aplicación dependía de las voces
 * que tuviera instaladas el navegador de cada persona. En un Android en español
 * no suele haber ninguna inglesa, y entonces se apagaba media aplicación: los
 * dictados, los pares mínimos, el juego de Escucha y parte de la prueba de
 * nivel. La aplicación avisaba bien, pero avisar no es resolver.
 *
 * Esto NO sustituye al sintetizador del navegador, que sigue siendo lo primero
 * que se intenta: es gratis, va sin conexión y suena al instante. Aquí se llega
 * solo cuando el aparato no puede, y el servidor devuelve un MP3 que él mismo
 * guarda en caché, así que la misma palabra se paga una vez para todo el mundo.
 *
 * No añade ni un kilobyte de dependencia al paquete del navegador: `fetch` y
 * `Audio` son del propio navegador.
 */

/** Lo último que se supo del servidor, para no preguntarlo en cada pantalla. */
const CLAVE_ESTADO = 'speakmi.voz.servidor';

type Estado = 'si' | 'no' | 'todavia-no-se';

let estado: Estado = recordado();
let preguntaEnCurso: Promise<boolean> | null = null;

function recordado(): Estado {
  try {
    const valor = localStorage.getItem(CLAVE_ESTADO);
    return valor === 'si' || valor === 'no' ? valor : 'todavia-no-se';
  } catch {
    // Navegación privada o cookies bloqueadas: se preguntará cada vez.
    return 'todavia-no-se';
  }
}

function anotar(nuevo: 'si' | 'no'): void {
  estado = nuevo;
  try {
    localStorage.setItem(CLAVE_ESTADO, nuevo);
  } catch {
    // Que no se pueda recordar no impide usarlo en esta sesión.
  }
}

/**
 * ¿Puede hablar el servidor? Lo que se sepa ahora mismo, sin esperar.
 *
 * Sin sesión la respuesta es que no, y es la verdad: la ruta del audio pide
 * identificarse, así que en la pantalla de entrada no hay servidor al que
 * recurrir. Responder en seco aquí evita que las pantallas parpadeen mientras
 * se resuelve algo que ya se sabe.
 */
export function servidorPuedeHablarYa(): Estado {
  if (!getToken()) return 'no';
  return estado;
}

/** Lo mismo, preguntándoselo al servidor si todavía no se sabe. */
export async function servidorPuedeHablar(): Promise<boolean> {
  if (!getToken()) return false;
  if (estado !== 'todavia-no-se') return estado === 'si';

  // Varias pantallas preguntan a la vez al arrancar; una sola petición basta.
  preguntaEnCurso ??= (async () => {
    try {
      const respuesta = await fetch(`${URL_API}/api/speech/providers`, {
        credentials: 'include',
        headers: { Accept: 'application/json', Authorization: `Bearer ${getToken() ?? ''}` },
      });

      if (!respuesta.ok) return false;

      const datos = (await respuesta.json()) as { ttsServidor?: boolean };
      const puede = datos.ttsServidor === true;
      anotar(puede ? 'si' : 'no');
      return puede;
    } catch {
      /*
        Sin red no se anota nada a propósito.

        Un «no» guardado por estar en el metro se quedaría pegado y dejaría la
        aplicación muda cuando volviera la cobertura. Se responde que no para
        esta vez y se vuelve a preguntar en la siguiente.
      */
      return false;
    } finally {
      preguntaEnCurso = null;
    }
  })();

  return preguntaEnCurso;
}

/**
 * Los audios ya descargados, para no volver a pedirlos.
 *
 * En una partida de Escucha se repite la misma palabra cada vez que se toca el
 * botón, y en un dictado la frase entera varias veces. Sin esto, cada toque
 * sería un viaje a la red y una espera antes de oír nada.
 */
const DESCARGADOS = 24;
const descargados = new Map<string, string>();

function guardarDescarga(texto: string, url: string): void {
  descargados.set(texto, url);

  if (descargados.size > DESCARGADOS) {
    const masViejo = descargados.keys().next().value;
    if (masViejo !== undefined) {
      const url = descargados.get(masViejo);
      descargados.delete(masViejo);
      // Sin esto, el navegador se queda con el audio en memoria para siempre.
      if (url) URL.revokeObjectURL(url);
    }
  }
}

async function descargar(texto: string): Promise<string | null> {
  const yaEsta = descargados.get(texto);
  if (yaEsta) return yaEsta;

  const token = getToken();
  if (!token) return null;

  try {
    const respuesta = await fetch(`${URL_API}/api/speech/audio?text=${encodeURIComponent(texto)}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!respuesta.ok) {
      /*
        Un 503 es el servidor diciendo que hoy no puede: no hay clave, o se
        acabó la cuota del mes. Se anota para dejar de intentarlo en cada
        palabra y para que las pantallas vuelvan a enseñar el aviso de siempre,
        que es lo honesto. Un 401 no se anota: es la sesión, no la voz.
      */
      if (respuesta.status === 503) anotar('no');
      return null;
    }

    const url = URL.createObjectURL(await respuesta.blob());
    guardarDescarga(texto, url);
    return url;
  } catch {
    return null;
  }
}

/** El audio que está sonando ahora, para poder cortarlo. */
let sonando: HTMLAudioElement | null = null;

/** Corta el audio del servidor, si hay alguno sonando. */
export function pararAudioDelServidor(): void {
  if (!sonando) return;
  sonando.pause();
  sonando = null;
}

/**
 * Dice el texto con la voz del servidor. Devuelve si se pudo.
 *
 * La velocidad se aplica al reproducir y no al generar, y eso ahorra dinero: el
 * dictado se puede oír a 0,9 y a 0,55 sin que sean dos audios distintos que
 * sintetizar, guardar y descargar. `preservesPitch` es lo que evita que al
 * bajarlo suene grave, que era el motivo clásico para no hacerlo así.
 */
export async function decirEnServidor(texto: string, velocidad: number): Promise<boolean> {
  const url = await descargar(texto);
  if (!url) return false;

  pararAudioDelServidor();

  const audio = new Audio(url);
  audio.playbackRate = velocidad;
  audio.preservesPitch = true;
  sonando = audio;

  try {
    await audio.play();
  } catch {
    /*
      El navegador puede negarse a sonar si no hubo un toque antes. No es un
      fallo del audio: en cuanto se pulse el botón del altavoz sonará. Se
      devuelve `true` porque el audio existe y el aviso de «aquí no hay voz»
      sería mentira.
    */
    sonando = null;
    return true;
  }

  await new Promise<void>((resolver) => {
    const cerrar = () => {
      audio.onended = null;
      audio.onerror = null;
      if (sonando === audio) sonando = null;
      resolver();
    };
    audio.onended = cerrar;
    audio.onerror = cerrar;
  });

  return true;
}

/** Solo para las pruebas: olvida lo que se sabía del servidor. */
export function olvidarEstadoDelServidor(): void {
  estado = 'todavia-no-se';
  preguntaEnCurso = null;
  for (const url of descargados.values()) URL.revokeObjectURL(url);
  descargados.clear();
  try {
    localStorage.removeItem(CLAVE_ESTADO);
  } catch {
    // No había nada que olvidar.
  }
}
