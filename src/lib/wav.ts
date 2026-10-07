/**
 * Grabar el micrófono en WAV PCM de 16 kHz mono, que es lo único que le vale al
 * evaluador de fonemas.
 *
 * Por qué no se usa `lib/grabacion.ts`, que ya existe: `MediaRecorder` entrega
 * Opus en webm en Chrome y AAC en mp4 en Safari, y la API REST de Azure no acepta
 * ninguno de los dos. Convertir en el servidor pediría ffmpeg —decenas de megas
 * y un arranque en frío que en serverless no cabe—, así que el navegador tiene
 * que entregar el audio ya bueno. Se captura PCM crudo con un AudioWorklet y se
 * le pone la cabecera WAV delante, que son cuatro líneas.
 *
 * Y AQUÍ ESTÁ LA RAZÓN DE FONDO, que es de honestidad y no de formato: Azure
 * acepta también un WAV a 48 kHz. No lo rechaza, lo procesa y devuelve notas
 * malas. Quien estudia leería que pronuncia fatal cuando lo que estaba mal era
 * el audio que le mandamos. Un marcador falso es peor que no tener marcador, así
 * que el muestreo se comprueba aquí y se vuelve a comprobar en el servidor.
 *
 * Si algo no se puede —navegador sin AudioWorklet, permiso denegado— devuelve
 * null y quien llama sigue como antes, sin fonética. Esa es toda la degradación
 * que hace falta: la corrección por palabras no depende de esto.
 */

/** Lo que pide el evaluador, y no es negociable. */
export const MUESTREO = 16000;

/** El tope de Azure. Por encima rechaza, así que se corta aquí y no allí. */
export const MAX_SEGUNDOS = 30;

/**
 * El worklet, escrito como texto y cargado desde un blob.
 *
 * Va inline a propósito: un archivo suelto en `public/` tendría que sobrevivir al
 * empaquetado, al hash de nombres y al service worker de la PWA, y si algún día
 * se cae por el camino el fallo aparecería en producción como «no hay fonética»
 * sin más pista. Así el worklet no puede perderse: viaja dentro del módulo.
 */
const FUENTE_WORKLET = `
class CapturaPcm extends AudioWorkletProcessor {
  process(entradas) {
    const canal = entradas[0] && entradas[0][0];
    if (canal) {
      // Una copia, porque el búfer que llega se reutiliza en el siguiente ciclo.
      const copia = new Float32Array(canal);
      this.port.postMessage(copia, [copia.buffer]);
    }
    return true;
  }
}
registerProcessor('captura-pcm', CapturaPcm);
`;

export interface GrabacionWav {
  /** Para y entrega el WAV. Null si no llegó a grabarse nada aprovechable. */
  terminar: () => Promise<Blob | null>;
  /** Para y lo tira. */
  cancelar: () => void;
  /**
   * El pico de volumen de lo grabado, de 0 a 1. Null si no se puede medir.
   *
   * Hay que mirarlo ANTES de mandar el audio a transcribir, y no es un lujo: un
   * micrófono que se abre pero no capta nada entrega un archivo perfectamente
   * válido lleno de ceros, y a quien transcribe eso no le sale vacío — se
   * inventa una frase. Esa frase luego se puntúa, y alguien que no ha abierto
   * la boca recibe un «6 % bien dichas» que es mentira.
   */
  nivel: () => number | null;
  /**
   * Si el sistema entregó la pista ya muda.
   *
   * Pasa en iOS cuando otro está usando el micrófono o cuando la sesión de
   * audio se quedó en modo reproducción: la pista existe, está «viva», y solo
   * salen ceros. Distinguirlo de «habló bajito» es lo que permite decir la
   * verdad en pantalla.
   */
  muda: () => boolean;
}

/**
 * El pico de volumen de un bloque de muestras, de 0 a 1.
 *
 * Se mira el pico y no la media: una frase es sobre todo silencio entre
 * palabras, así que la media de algo perfectamente audible sale baja y no
 * distingue una grabación floja de una muda. El pico sí.
 */
export function picoDe(datos: Float32Array): number {
  let pico = 0;
  for (let i = 0; i < datos.length; i += 1) {
    const valor = Math.abs(datos[i] ?? 0);
    if (valor > pico) pico = valor;
  }
  return pico;
}

/**
 * Por debajo de este pico se da por hecho que no se grabó ninguna voz.
 *
 * Son unos −40 dB. El silencio digital es 0, el ruido de una habitación callada
 * anda por 0,002, y una voz a medio metro pasa de 0,1 sin esfuerzo. Dejarlo aquí
 * deja fuera el silencio y el siseo del micrófono sin llegar a descartar a quien
 * habla bajito.
 */
export const PICO_MINIMO = 0.01;

export function puedeGrabarWav(): boolean {
  return (
    typeof AudioWorkletNode !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * Abre el contexto de audio, con los dos remedios que pide un iPhone.
 *
 * UNO: pedirle 16 kHz es una petición, no una orden, y Safari no la acepta: la
 * lanza como error en vez de ignorarla. Antes eso se traducía en devolver null
 * —ni grabación ni nada— cuando lo correcto es abrirlo a la frecuencia que él
 * quiera y remuestrear después, que es lo que `bytesWav` ya sabe hacer.
 *
 * DOS: se abre ANTES de pedir el micrófono, a propósito. Un `AudioContext` solo
 * nace despierto si se crea dentro del toque que lo pidió, y el permiso del
 * micrófono lleva un `await` por delante que rompe esa cadena. Creado después,
 * nace `suspended`, y un contexto suspendido NO ejecuta el worklet: se grababan
 * cero muestras y la grabación salía vacía sin que nada diera error.
 */
async function abrirContexto(): Promise<AudioContext | null> {
  let contexto: AudioContext;
  try {
    contexto = new AudioContext({ sampleRate: MUESTREO });
  } catch {
    try {
      contexto = new AudioContext();
    } catch {
      return null;
    }
  }

  // Y aunque se cree en el momento bueno, puede venir dormido. Despertarlo es
  // barato y no hacerlo es quedarse sin audio.
  if (contexto.state === 'suspended') {
    try {
      await contexto.resume();
    } catch {
      // Si no se deja, se sigue: puede despertar al conectarle la entrada.
    }
  }

  return contexto;
}

export async function grabarWav(): Promise<GrabacionWav | null> {
  if (!puedeGrabarWav()) return null;

  const contexto = await abrirContexto();
  if (!contexto) return null;

  let micro: MediaStream;
  try {
    /*
      El micrófono se pide a secas, sin pedirle tratamiento.

      Antes se le pedía cancelación de eco y supresión de ruido, que sobre el
      papel mejoran el audio. En un iPhone hacen otra cosa: activan la unidad de
      proceso de voz del sistema, y esa unidad, cuando el aparato cree que está
      reproduciendo algo, entrega una pista viva y MUDA. No da error, no avisa;
      simplemente llegan ceros. Era eso lo que puntuaba a quien no había hablado.

      La cancelación de eco estaba ahí para que el micro no se grabara la voz que
      acababa de leer el enunciado, y eso ya no hace falta: ahora se calla todo y
      se duerme el audio del sistema antes de abrir el micrófono.
    */
    micro = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    void contexto.close();
    return null;
  }

  /*
    Una pista puede estar viva y muda a la vez, y es la avería que nos ocupa.
    Saberlo aquí no la arregla, pero se cuenta aguas abajo en vez de dejar que
    se note como una nota inventada.
  */
  const pista = micro.getAudioTracks()[0];
  const nacioMuda = pista?.muted === true;

  const soltar = () => micro.getTracks().forEach((pista) => pista.stop());

  let url: string | null = null;
  let nodo: AudioWorkletNode;
  try {
    url = URL.createObjectURL(new Blob([FUENTE_WORKLET], { type: 'text/javascript' }));
    await contexto.audioWorklet.addModule(url);
    nodo = new AudioWorkletNode(contexto, 'captura-pcm');
  } catch {
    if (url) URL.revokeObjectURL(url);
    void contexto.close();
    soltar();
    return null;
  }
  URL.revokeObjectURL(url);

  const entrada = contexto.createMediaStreamSource(micro);
  const trozos: Float32Array[] = [];
  let muestras = 0;
  const tope = MAX_SEGUNDOS * contexto.sampleRate;

  nodo.port.onmessage = (evento: MessageEvent<Float32Array>) => {
    // Pasado el tope se dejan de guardar, pero NO se corta la grabación: quien
    // habla no tiene por qué enterarse a mitad de frase. Lo que sobra se tira.
    if (muestras >= tope) return;
    trozos.push(evento.data);
    muestras += evento.data.length;
  };

  entrada.connect(nodo);
  /*
    El worklet no se conecta a los altavoces. No hace falta para que corra —el
    nodo procesa igual— y conectarlo devolvería tu propia voz por el auricular
    con retardo, que es la forma más rápida de que alguien deje de hablar.
  */

  /*
    Y se vuelve a despertar después de enchufar la entrada.

    En iOS el contexto se puede quedar dormido otra vez cuando el sistema
    reorganiza la sesión de audio al abrir el micrófono. Esto no es repetir lo
    de arriba por si acaso: son dos momentos distintos, y el que importa para
    que lleguen muestras es este, el de después.
  */
  if (contexto.state === 'suspended') {
    try {
      await contexto.resume();
    } catch {
      // Sin esto puede no grabarse nada, pero avisarlo aquí no arregla más.
    }
  }

  const cerrar = () => {
    nodo.port.onmessage = null;
    entrada.disconnect();
    nodo.disconnect();
    void contexto.close();
    soltar();
  };

  /*
    El pico se va calculando sobre la marcha y no al final: al terminar, los
    trozos ya se han pegado y recortado, y además así se puede preguntar por él
    aunque la grabación se haya cerrado.
  */
  let pico: number | null = null;

  return {
    terminar: async () => {
      const muestreo = contexto.sampleRate;
      cerrar();
      if (muestras === 0) return null;
      const todo = juntar(trozos, Math.min(muestras, tope));
      pico = picoDe(todo);
      return construirWav(todo, muestreo);
    },
    cancelar: () => {
      trozos.length = 0;
      cerrar();
    },
    nivel: () => pico,
    muda: () => nacioMuda,
  };
}

/* ------------------------------------------------------------------ */
/* Las partes puras, que son las que se pueden probar                  */
/* ------------------------------------------------------------------ */

/** Pega los trozos del worklet en un solo bloque, recortando al tope. */
export function juntar(trozos: readonly Float32Array[], total: number): Float32Array {
  const todo = new Float32Array(total);
  let donde = 0;
  for (const trozo of trozos) {
    if (donde >= total) break;
    const cabe = Math.min(trozo.length, total - donde);
    todo.set(cabe === trozo.length ? trozo : trozo.subarray(0, cabe), donde);
    donde += cabe;
  }
  return todo;
}

/**
 * Remuestreo lineal.
 *
 * Es el plan B para los navegadores que no dejan fijar la frecuencia del
 * contexto. Interpolar en línea recta no es lo que haría un resampler serio
 * —deja un poco de aliasing en los agudos— pero para voz a 16 kHz no se nota y
 * el evaluador lo puntúa igual. La alternativa era mandar el audio a la
 * frecuencia que fuera, y eso sí cambia las notas.
 */
export function remuestrear(datos: Float32Array, desde: number, hasta: number): Float32Array {
  if (desde === hasta || datos.length === 0) return datos;

  const salida = new Float32Array(Math.max(1, Math.round((datos.length * hasta) / desde)));
  const paso = desde / hasta;
  for (let i = 0; i < salida.length; i += 1) {
    const sitio = i * paso;
    const antes = Math.floor(sitio);
    const despues = Math.min(antes + 1, datos.length - 1);
    const parte = sitio - antes;
    salida[i] = (datos[antes] ?? 0) * (1 - parte) + (datos[despues] ?? 0) * parte;
  }
  return salida;
}

/**
 * La cabecera WAV de 44 bytes y las muestras a 16 bits con signo.
 *
 * El servidor lee estos bytes y rechaza lo que no sea PCM, mono y 16 kHz, así
 * que aquí no hay margen para improvisar: formato 1 (PCM sin comprimir), un
 * canal, `MUESTREO` exacto, 16 bits por muestra.
 */
export function bytesWav(datos: Float32Array, muestreoOrigen: number): ArrayBuffer {
  const muestras = remuestrear(datos, muestreoOrigen, MUESTREO);
  const cuerpo = muestras.length * 2;
  const bytes = new ArrayBuffer(44 + cuerpo);
  const vista = new DataView(bytes);

  const texto = (donde: number, cadena: string) => {
    for (let i = 0; i < cadena.length; i += 1) vista.setUint8(donde + i, cadena.charCodeAt(i));
  };

  texto(0, 'RIFF');
  vista.setUint32(4, 36 + cuerpo, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  vista.setUint32(16, 16, true); // longitud del bloque fmt
  vista.setUint16(20, 1, true); // 1 = PCM sin comprimir
  vista.setUint16(22, 1, true); // mono
  vista.setUint32(24, MUESTREO, true);
  vista.setUint32(28, MUESTREO * 2, true); // bytes por segundo
  vista.setUint16(32, 2, true); // bytes por muestra y canal
  vista.setUint16(34, 16, true); // bits por muestra
  texto(36, 'data');
  vista.setUint32(40, cuerpo, true);

  for (let i = 0; i < muestras.length; i += 1) {
    // Se recorta a [-1, 1] antes de escalar: una muestra por encima de 1 daría
    // la vuelta al entero y saldría un chasquido justo donde el micro saturó.
    const valor = Math.max(-1, Math.min(1, muestras[i] ?? 0));
    vista.setInt16(44 + i * 2, valor < 0 ? valor * 0x8000 : valor * 0x7fff, true);
  }

  return bytes;
}

/** Lo mismo, envuelto para mandar. Separado de `bytesWav` porque el `Blob` de
 *  jsdom no deja volver a leer sus bytes, y la cabecera hay que poder probarla. */
export function construirWav(datos: Float32Array, muestreoOrigen: number): Blob {
  return new Blob([bytesWav(datos, muestreoOrigen)], { type: 'audio/wav' });
}

/** Lo que el servidor va a mirar de la cabecera. Existe para poder comprobarlo. */
export interface CabeceraWav {
  formato: number;
  canales: number;
  muestreo: number;
  bits: number;
  segundos: number;
}

export function leerCabeceraWav(bytes: ArrayBuffer): CabeceraWav | null {
  if (bytes.byteLength < 44) return null;
  const vista = new DataView(bytes);
  const marca = (donde: number) =>
    String.fromCharCode(
      vista.getUint8(donde),
      vista.getUint8(donde + 1),
      vista.getUint8(donde + 2),
      vista.getUint8(donde + 3),
    );
  if (marca(0) !== 'RIFF' || marca(8) !== 'WAVE') return null;

  const muestreo = vista.getUint32(24, true);
  const bits = vista.getUint16(34, true);
  const canales = vista.getUint16(22, true);
  const datos = vista.getUint32(40, true);

  return {
    formato: vista.getUint16(20, true),
    canales,
    muestreo,
    bits,
    segundos: datos / (muestreo * canales * (bits / 8)),
  };
}
