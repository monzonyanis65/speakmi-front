/**
 * Grabar el micrófono mientras se habla en la llamada.
 *
 * El reconocedor del navegador da el texto en vivo, pero entiende mal justo lo
 * que más se dice en una conversación: respuestas cortas con acento. Un «yes»
 * a secas le sale «jazz». Por eso, a la vez que escucha, se graba el audio, y
 * al soltar el micrófono ese audio lo transcribe Whisper en el servidor, que
 * además sabe qué acababa de preguntar la mascota.
 *
 * Si algo de esto no se puede —navegador sin MediaRecorder, permiso denegado—,
 * `grabar` devuelve null y la llamada sigue con lo del navegador, como antes.
 */

export interface Grabacion {
  /** Para de grabar y entrega el audio. Null si no llegó a grabarse nada. */
  terminar: () => Promise<Blob | null>;
  /** Para y lo tira: se colgó, o la mascota va a hablar. */
  cancelar: () => void;
}

/**
 * En qué formato grabar, por orden de preferencia.
 *
 * Opus en webm es lo que graban Chrome y Android, y pesa muy poco: un turno de
 * diez segundos son unos 40 KB. Safari solo sabe mp4. Whisper acepta los dos.
 */
const FORMATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function puedeGrabar(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export async function grabar(): Promise<Grabacion | null> {
  if (!puedeGrabar()) return null;

  let micro: MediaStream;
  try {
    micro = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    return null;
  }

  const formato = FORMATOS.find((tipo) => MediaRecorder.isTypeSupported(tipo));
  let grabador: MediaRecorder;
  try {
    grabador = new MediaRecorder(micro, formato ? { mimeType: formato } : undefined);
  } catch {
    micro.getTracks().forEach((pista) => pista.stop());
    return null;
  }

  const trozos: Blob[] = [];
  grabador.ondataavailable = (evento) => {
    if (evento.data.size > 0) trozos.push(evento.data);
  };

  // Soltar el micrófono al acabar: si no, el piloto rojo de grabación se queda
  // encendido en la pestaña y el móvil no lo libera para el reconocedor.
  const soltar = () => micro.getTracks().forEach((pista) => pista.stop());

  grabador.start();

  return {
    terminar: () =>
      new Promise((listo) => {
        if (grabador.state === 'inactive') {
          soltar();
          listo(null);
          return;
        }
        grabador.onstop = () => {
          soltar();
          const tipo = grabador.mimeType || formato || 'audio/webm';
          listo(trozos.length ? new Blob(trozos, { type: tipo }) : null);
        };
        grabador.stop();
      }),
    cancelar: () => {
      grabador.onstop = null;
      if (grabador.state !== 'inactive') grabador.stop();
      soltar();
    },
  };
}
