import { api, URL_API } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { PalabraDicha, TiempoDePalabra, Veredicto } from '@/lib/shadowing-ritmo';

/**
 * El trato con el servidor para el shadowing, y una imitación mientras no exista.
 *
 * El back de esto se está escribiendo a la vez que esta pantalla. Los tipos de
 * abajo son el contrato acordado y no se tocan; lo que hay debajo es un doble
 * que responde igual, para poder terminar la pantalla sin esperar a nadie. El
 * doble se anuncia siempre en pantalla: un dato inventado que no se distingue de
 * uno real es peor que no tener dato.
 */

export type { PalabraDicha, Veredicto };

export interface AudioDelModelo {
  /** Una de las dos, según lo que dé el proveedor. */
  url?: string;
  base64?: string;
  mime: string;
  duracionMs: number;
}

/** Un trozo que se practica en bucle: el tramo de audio y lo que se dice en él. */
export interface Trozo {
  desde: number;
  hasta: number;
  texto: string;
}

export interface Shadow {
  audio: AudioDelModelo;
  texto: string;
  /** Null cuando el proveedor no da tiempos. Entonces NO se resalta nada. */
  palabras: TiempoDePalabra[] | null;
  trozos: Trozo[];
}

export interface Ritmo {
  /** False = no hay medida de ritmo. Los números de al lado no significan nada. */
  disponible: boolean;
  desfaseMedioMs: number;
  /** De 0 a 1. */
  correlacion: number;
  acentosAcertados: number;
  acentosTotales: number;
}

export interface Intento {
  palabras: PalabraDicha[];
  ritmo: Ritmo;
  accuracy: number;
  mensaje_es: string;
}

/** De dónde sale el `src` del audio, venga como venga. */
export function fuenteDeAudio(audio: AudioDelModelo): string | null {
  if (audio.url) return audio.url;
  if (audio.base64) return `data:${audio.mime};base64,${audio.base64}`;
  return null;
}

/**
 * Las palabras del modelo que caen dentro de un trozo.
 *
 * `desde` y `hasta` NO son milisegundos: son ÍNDICES, medio abiertos como los
 * de `slice`. Con marcas van sobre `palabras[]`; sin marcas, sobre los
 * caracteres de `texto`. Es fácil confundirlos porque el resto del contrato va
 * en milisegundos, y confundirlos no revienta nada: simplemente el trozo sale
 * vacío o con las palabras de otro sitio, que es peor que un error.
 */
export function palabrasDelTrozo(
  palabras: readonly TiempoDePalabra[] | null,
  trozo: Trozo,
): TiempoDePalabra[] | null {
  if (!palabras) return null;
  return palabras.slice(trozo.desde, trozo.hasta);
}

/**
 * Lo que se lee en un trozo.
 *
 * El servidor ya manda el texto hecho, y es lo que se usa. El recorte por
 * caracteres es el plan B para cuando no venga: sin marcas, los índices del
 * trozo son posiciones dentro de `texto`.
 */
export function textoDelTrozo(texto: string, trozo: Trozo): string {
  if (trozo.texto) return trozo.texto;
  return texto.slice(trozo.desde, trozo.hasta);
}

/**
 * Un pelín de aire al final del trozo, para que no se coma la última consonante.
 * No se pasa nunca de donde empieza la palabra siguiente.
 */
const COLA_MS = 120;

/**
 * De qué segundo a qué segundo suena un trozo.
 *
 * Los índices del trozo no dicen nada del audio; el tramo hay que sacarlo de
 * los tiempos de la primera y la última palabra. Por eso, CUANDO NO HAY MARCAS
 * NO SE PUEDE AISLAR UN TROZO: devuelve null, y lo honesto entonces es sonar la
 * frase entera y decirlo, en vez de cortar por un sitio inventado y dejar a
 * alguien repitiendo media palabra.
 */
export function rangoDeAudio(
  palabras: readonly TiempoDePalabra[] | null,
  trozo: Trozo,
  duracionMs: number,
): { desdeMs: number; hastaMs: number } | null {
  if (!palabras || palabras.length === 0) return null;

  const dentro = palabras.slice(trozo.desde, trozo.hasta);
  const primera = dentro[0];
  const ultima = dentro[dentro.length - 1];
  if (!primera || !ultima) return null;

  const siguiente = palabras[trozo.hasta]?.startMs ?? duracionMs;
  return {
    desdeMs: primera.startMs,
    hastaMs: Math.min(ultima.endMs + COLA_MS, siguiente, duracionMs),
  };
}

export interface Opciones {
  /** Fuerza el doble aunque el servidor conteste. Para ver los caminos raros. */
  simular?: boolean;
  /** El doble responde sin tiempos por palabra. */
  sinTiempos?: boolean;
  /** El doble responde sin medida de ritmo. */
  sinRitmo?: boolean;
}

export interface Respuesta {
  datos: Shadow;
  /** True = esto es mentira y hay que decirlo en pantalla. */
  simulado: boolean;
}

export async function pedirShadow(code: string, opciones: Opciones = {}): Promise<Respuesta> {
  if (!opciones.simular) {
    try {
      const datos = await api.get<Shadow>(`/speech/shadow?code=${encodeURIComponent(code)}`);
      return { datos, simulado: false };
    } catch {
      // El servidor todavía no tiene esta ruta. Se sigue con el doble, avisando.
    }
  }
  return { datos: shadowDeMentira(opciones), simulado: true };
}

/**
 * Manda la grabación y recoge la corrección.
 *
 * Va con `fetch` a pelo y no por `lib/api` porque esto es multipart: el cliente
 * de la casa convierte a JSON todo lo que no sea un Blob suelto, y un FormData
 * pasado por `JSON.stringify` llega al servidor como `{}`.
 */
export async function enviarIntento(
  code: string,
  audio: Blob,
  trozo: number | null,
  opciones: Opciones = {},
): Promise<{ intento: Intento; simulado: boolean }> {
  if (!opciones.simular) {
    const token = getToken();
    const cuerpo = new FormData();
    cuerpo.append('audio', audio, nombreDeArchivo(audio));
    cuerpo.append('code', code);
    if (trozo !== null) cuerpo.append('trozo', String(trozo));

    try {
      const respuesta = await fetch(`${URL_API}/api/speech/shadow/intento`, {
        method: 'POST',
        credentials: 'include',
        // Sin `Content-Type` a propósito: lo pone el navegador con el `boundary`,
        // que no podemos saber desde aquí. Ponerlo a mano rompe el multipart.
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: cuerpo,
      });
      if (respuesta.ok) return { intento: (await respuesta.json()) as Intento, simulado: false };
    } catch {
      // Igual que arriba: se sigue con el doble.
    }
  }

  return { intento: intentoDeMentira(opciones, trozo), simulado: true };
}

function nombreDeArchivo(audio: Blob): string {
  if (audio.type.includes('mp4')) return 'intento.mp4';
  if (audio.type.includes('ogg')) return 'intento.ogg';
  return 'intento.webm';
}

/* ------------------------------------------------------------------ */
/* El doble                                                            */
/* ------------------------------------------------------------------ */

/**
 * Los tiempos del modelo, escritos a mano a partir de cómo suena la frase de
 * verdad: «seven» cae larga y acentuada, hay aire antes de «but» y otro respiro
 * antes del «I» del final. Sirven para poder ver si la pantalla resalta donde
 * toca antes de que exista un alineador que lo diga.
 */
const PALABRAS_DE_MENTIRA: TiempoDePalabra[] = [
  { word: 'I', startMs: 0, endMs: 140 },
  { word: 'usually', startMs: 140, endMs: 560 },
  { word: 'get', startMs: 560, endMs: 720 },
  { word: 'up', startMs: 720, endMs: 880 },
  { word: 'at', startMs: 880, endMs: 980 },
  { word: 'seven', startMs: 980, endMs: 1420 },
  { word: 'but', startMs: 1750, endMs: 1900 },
  { word: 'on', startMs: 1900, endMs: 2020 },
  { word: 'weekends', startMs: 2020, endMs: 2520 },
  { word: 'I', startMs: 2820, endMs: 2940 },
  { word: 'sleep', startMs: 2940, endMs: 3260 },
  { word: 'in', startMs: 3260, endMs: 3500 },
];

const DURACION_DE_MENTIRA = 3700;

/** Índices sobre `PALABRAS_DE_MENTIRA`, medio abiertos: `[desde, hasta)`. */
const TROZOS_DE_MENTIRA: Trozo[] = [
  { desde: 0, hasta: 6, texto: 'I usually get up at seven,' },
  { desde: 6, hasta: 12, texto: 'but on weekends I sleep in.' },
];

function shadowDeMentira(opciones: Opciones): Shadow {
  return {
    audio: {
      base64: wavDeMentira(PALABRAS_DE_MENTIRA, DURACION_DE_MENTIRA),
      mime: 'audio/wav',
      duracionMs: DURACION_DE_MENTIRA,
    },
    texto: 'I usually get up at seven, but on weekends I sleep in.',
    palabras: opciones.sinTiempos ? null : PALABRAS_DE_MENTIRA,
    trozos: TROZOS_DE_MENTIRA,
  };
}

/**
 * Un intento con los fallos típicos de quien empieza: se arranca medio segundo
 * tarde, se llega tarde a la sílaba fuerte del primer trozo y en el segundo se
 * come el respiro antes del «I». Están puestos a propósito para que la pantalla
 * de ritmo tenga algo que enseñar mientras no hay servidor, y el medio segundo
 * de arranque está para que se vea que NO lo cuenta como fallo.
 */
function intentoDeMentira(opciones: Opciones, trozo: number | null): Intento {
  const ARRANQUE = 480;
  const rango = trozo === null ? null : TROZOS_DE_MENTIRA[trozo];

  const todas: PalabraDicha[] = PALABRAS_DE_MENTIRA.map((palabra, i) => {
    const tarde = palabra.word === 'seven' ? 280 : 0;
    // El respiro antes del «I» del final se lo come: entra 240 ms antes.
    const adelanto = i >= 9 ? 240 : 0;

    // «up» se la salta: llega sin hora, que es lo que manda el servidor cuando
    // no hay nada que situar. Está aquí para que el camino del null se vea.
    if (palabra.word === 'up') {
      return { word: 'up', heard: null, verdict: 'omitted', score: 0, startMs: null, endMs: null };
    }

    return {
      word: palabra.word,
      heard: palabra.word === 'usually' ? 'usual' : palabra.word,
      verdict: (palabra.word === 'usually' ? 'mispronounced' : 'correct') as Veredicto,
      score: palabra.word === 'usually' ? 0.52 : 0.94,
      startMs: palabra.startMs + ARRANQUE + tarde - adelanto,
      endMs: palabra.endMs + ARRANQUE + tarde - adelanto,
    };
  });

  // Medio abierto, igual que el contrato: `hasta` no entra.
  const palabras = rango ? todas.slice(rango.desde, rango.hasta) : todas;

  return {
    palabras,
    ritmo: opciones.sinRitmo
      ? {
          disponible: false,
          desfaseMedioMs: 0,
          correlacion: 0,
          acentosAcertados: 0,
          acentosTotales: 0,
        }
      : {
          /*
            Estos números son el caso trampa a propósito: correlación alta y
            acentos por los suelos. Es lo que devuelve un lector silábico —el
            vicio del hispanohablante—, que tarda lo mismo que el modelo y deja
            huecos largos donde el modelo los deja, pero no comprime ni una
            sílaba débil. Si la pantalla enseñara la correlación en grande, le
            daría la enhorabuena justo a quien peor lo está haciendo.
          */
          disponible: true,
          desfaseMedioMs: 96,
          correlacion: 0.84,
          acentosAcertados: 1,
          acentosTotales: 5,
        },
    accuracy: 0.87,
    mensaje_es:
      'Las palabras salen bien, pero les das a todas el mismo peso. En inglés solo unas pocas se pisan.',
  };
}

/* ------------------------------------------------------------------ */
/* Un WAV inventado, para que el doble suene de verdad                  */
/* ------------------------------------------------------------------ */

/** Ocho kilohercios: suena a interfono, pero pesa cuatro veces menos y esto es un doble. */
const MUESTREO = 8000;

/**
 * Un audio sintético con un pitido por palabra en su sitio.
 *
 * No se parece a una voz, y da igual: lo que hay que poder comprobar sin
 * servidor es que la palabra se ilumina cuando suena y se apaga en las pausas, y
 * para eso hace falta un audio cuyos tiempos se sepan de antemano. Se genera al
 * vuelo y no se mete en el repositorio: son sesenta kilobytes que no pinta nada
 * cargar en el paquete de producción.
 */
function wavDeMentira(palabras: readonly TiempoDePalabra[], duracionMs: number): string {
  const muestras = Math.round((duracionMs / 1000) * MUESTREO);
  const pcm = new Int16Array(muestras);

  palabras.forEach((palabra, i) => {
    const desde = Math.round((palabra.startMs / 1000) * MUESTREO);
    const hasta = Math.min(muestras, Math.round((palabra.endMs / 1000) * MUESTREO));
    // Alterna de grave a agudo para que se oiga dónde empieza cada palabra.
    const hercios = 220 + (i % 4) * 60;
    for (let m = desde; m < hasta; m += 1) {
      const avance = (m - desde) / Math.max(1, hasta - desde);
      // Sube y baja en cada palabra: sin envolvente suena a chasquidos.
      const envolvente = Math.sin(Math.PI * avance);
      pcm[m] = Math.round(Math.sin((2 * Math.PI * hercios * m) / MUESTREO) * envolvente * 9000);
    }
  });

  return aBase64(conCabeceraWav(pcm));
}

function conCabeceraWav(pcm: Int16Array): Uint8Array {
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const vista = new DataView(bytes.buffer);
  const texto = (posicion: number, valor: string) => {
    for (let i = 0; i < valor.length; i += 1) vista.setUint8(posicion + i, valor.charCodeAt(i));
  };

  texto(0, 'RIFF');
  vista.setUint32(4, 36 + pcm.length * 2, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true); // PCM sin comprimir
  vista.setUint16(22, 1, true); // mono
  vista.setUint32(24, MUESTREO, true);
  vista.setUint32(28, MUESTREO * 2, true);
  vista.setUint16(32, 2, true);
  vista.setUint16(34, 16, true);
  texto(36, 'data');
  vista.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i += 1) vista.setInt16(44 + i * 2, pcm[i] ?? 0, true);

  return bytes;
}

function aBase64(bytes: Uint8Array): string {
  // De mil en mil: `fromCharCode` con cincuenta mil argumentos revienta la pila.
  let texto = '';
  for (let i = 0; i < bytes.length; i += 1000) {
    texto += String.fromCharCode(...bytes.subarray(i, i + 1000));
  }
  return btoa(texto);
}
