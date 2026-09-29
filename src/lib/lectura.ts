import { api, URL_API } from '@/lib/api';
import { getToken } from '@/lib/auth';

/**
 * Mandar una lectura en voz alta, con audio o sin él.
 *
 * `POST /api/speech/read-aloud` acepta las dos formas y las dos siguen siendo
 * válidas:
 *
 *   · JSON de toda la vida → corrección por palabras, sin fonemas. Es lo que
 *     pasa hoy en cualquier navegador que no pueda grabar PCM, y no es un modo
 *     degradado: es la app que ya existía.
 *   · multipart con dos campos, `datos` (el mismo JSON, como cadena) y `audio`
 *     (la grabación en WAV PCM 16 kHz mono) → además, la puntuación por fonema.
 *
 * Va con `fetch` a pelo y no por `lib/api` por lo mismo que `lib/shadowing.ts`:
 * el cliente de la casa convierte a JSON todo lo que no sea un Blob suelto, y un
 * FormData pasado por `JSON.stringify` llega al servidor como `{}`.
 */
export async function enviarLectura<T>(
  datos: Record<string, unknown>,
  audio: Blob | null,
): Promise<T> {
  if (!audio) return api.post<T>('/speech/read-aloud', datos);

  const cuerpo = new FormData();
  cuerpo.append('datos', JSON.stringify(datos));
  cuerpo.append('audio', audio, 'lectura.wav');

  const token = getToken();
  try {
    const respuesta = await fetch(`${URL_API}/api/speech/read-aloud`, {
      method: 'POST',
      credentials: 'include',
      // Sin `Content-Type`: lo pone el navegador con el `boundary`, que desde
      // aquí no se puede saber. Ponerlo a mano rompe el multipart.
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo,
    });
    if (respuesta.ok) return (await respuesta.json()) as T;
  } catch {
    // Igual que abajo: se reintenta sin audio.
  }

  /*
    Si el audio no cuela —el servidor no acepta multipart todavía, o mira la
    cabecera del WAV y la rechaza— se reintenta sin él. Lo que llega entonces es
    la corrección de siempre SIN los campos de fonética, y eso en pantalla ya
    significa exactamente lo que ha pasado: «no se intentó». Es la salida
    honesta. Insistir con el audio devolvería un error donde antes había una
    corrección perfectamente útil, y enseñar notas de fonemas sacadas de un audio
    que el servidor considera malo sería peor todavía: números falsos.
  */
  return api.post<T>('/speech/read-aloud', datos);
}
