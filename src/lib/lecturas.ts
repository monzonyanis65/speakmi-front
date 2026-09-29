import { ApiError, NetworkError, api } from '@/lib/api';

/**
 * Leer un texto tuyo.
 *
 * La idea es la de LingQ: traes un artículo que de verdad te interesa, lo lees
 * entero y vas tocando lo que no conoces. Lo que aquí vive es la capa de datos:
 * los tipos del contrato con el servidor, un puñado de funciones puras que las
 * pantallas usan para contar y colorear, y un respaldo local para poder trabajar
 * mientras el servidor todavía no existe.
 *
 * Todo lo que se puede razonar sin pintar nada está aquí y no en los
 * componentes, porque es lo que se puede probar sin montar un navegador: cómo se
 * trocea un párrafo, cuándo hay que desplazar la pantalla y cuántas palabras
 * quedan por descubrir.
 */

export type EstadoPalabra = 'nueva' | 'aprendiendo' | 'sabida' | 'ignorada';

export interface Palabra {
  i: number;
  texto: string;
  /**
   * La forma de diccionario. Es la CLAVE de todo: el estado se guarda por lema,
   * no por posición, así que marcar «code» una vez lo marca en las nueve veces
   * que sale en el artículo.
   *
   * Vacío significa que el trozo no es una palabra —una coma, un número, un
   * paréntesis— y entonces no se puede tocar. Se pinta como texto y ya está.
   */
  lema: string;
  estado: EstadoPalabra;
  /**
   * Dónde empieza y dónde acaba dentro del `texto` de su párrafo.
   *
   * Las manda el servidor y se usan PARA PINTAR. La alternativa —volver a
   * trocear el párrafo aquí para colocar las marcas— significa dos criterios
   * distintos partiendo el mismo texto: en cuanto uno de los dos trate las
   * comillas tipográficas o un guion largo de otra manera, las marcas se
   * desplazan una palabra y el color deja de corresponder con lo que hay
   * guardado. Con los cortes dados, el párrafo se pinta rebanando su propio
   * texto y la puntuación sale exactamente como se pegó.
   */
  desde: number;
  hasta: number;
}

export interface Parrafo {
  indice: number;
  texto: string;
  palabras: Palabra[];
}

export interface AudioLectura {
  base64: string;
  mime: string;
}

export interface Lectura {
  id: string;
  titulo: string;
  fuente: 'pegado' | 'url';
  parrafos: Parrafo[];
  /**
   * La voz del texto ENTERO, y casi siempre `null`.
   *
   * Solo viene en textos de menos de 200 caracteres, así que para un artículo de
   * verdad es siempre `null`: mil palabras son unos seis mil caracteres, treinta
   * llamadas al sintetizador y varios megas de base64 dentro de un JSON, y eso
   * no cabe en una función que vive segundos. La voz de un artículo se pide
   * párrafo a párrafo con `audioDeParrafo`.
   *
   * `null` significa que NO hay voz. No es un error ni un «todavía cargando».
   */
  audio: AudioLectura | null;
}

export interface ResumenLectura {
  id: string;
  titulo: string;
  creadaEn: string;
  palabras: number;
  sinSaber: number;
}

export interface NuevaLectura {
  titulo?: string;
  texto?: string;
  url?: string;
}

/* ───────────────────────── trocear el texto ───────────────────────── */

/**
 * Un trozo es o bien una palabra, o bien cualquier otra cosa pegada sin
 * espacios.
 *
 * La primera alternativa se traga los apóstrofos y guiones de dentro a
 * propósito: «don't» y «well-known» son UNA palabra y partirlas daría tres
 * cosas tocables donde hay una sola de aprender. La segunda recoge la
 * puntuación y los números, que se pintan pero no se tocan.
 */
const TROZO = /[\p{L}\p{M}]+(?:['’’-][\p{L}\p{M}]+)*|\S+/gu;

/** Signos que se pegan a lo de su izquierda: nunca llevan espacio delante. */
const CIERRAN = new Set([',', '.', ';', ':', '!', '?', ')', ']', '}', '»', '”', '…', '%', '’']);

/** Signos que se pegan a lo de su derecha: nunca llevan espacio detrás. */
const ABREN = new Set(['(', '[', '{', '«', '“', '¿', '¡']);

/**
 * La forma de diccionario aproximada.
 *
 * A propósito se queda corta: quita mayúsculas, signos de los extremos y el
 * posesivo, y nada más. Lematizar de verdad —«ran» → «run»— necesita un
 * diccionario, y ese trabajo es del servidor. Esto solo tiene que ser
 * CONSISTENTE, porque es la clave con la que se agrupan las apariciones.
 */
export function lemaDe(texto: string): string {
  const limpio = texto.toLowerCase().replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '');
  if (!limpio) return '';
  return limpio.replace(/['’’]s$/u, '');
}

/**
 * Trocea un párrafo en palabras tocables y puntuación que solo se pinta.
 *
 * Solo se usa en el respaldo local: cuando hay servidor, los trozos vienen
 * troceados y con sus posiciones. Se escribe igual que lo hace él —cada trozo
 * con su `desde` y su `hasta`— para que la pantalla no tenga dos caminos.
 */
export function trocear(texto: string, estado: EstadoPalabra = 'nueva'): Palabra[] {
  const palabras: Palabra[] = [];
  let i = 0;

  for (const encontrado of texto.matchAll(TROZO)) {
    const trozo = encontrado[0];
    const desde = encontrado.index;
    const lema = lemaDe(trozo);
    palabras.push({
      i,
      texto: trozo,
      lema,
      // Sin lema no hay nada que aprender, así que tampoco hay nada que marcar:
      // una coma en estado «nueva» pintaría el texto de amarillo sin motivo.
      estado: lema ? estado : 'ignorada',
      desde,
      hasta: desde + trozo.length,
    });
    i += 1;
  }

  return palabras;
}

/** Un trozo de párrafo listo para pintar: o es palabra, o es lo que va entre dos. */
export type Trozo =
  { tipo: 'palabra'; palabra: Palabra } | { tipo: 'relleno'; texto: string; clave: string };

/**
 * Parte el párrafo para pintarlo, usando los cortes que da el servidor.
 *
 * Lo que sale entre una palabra y la siguiente —espacios, comas, comillas— se
 * saca del propio `texto` del párrafo rebanándolo, no se reconstruye. Así el
 * texto pintado es CARÁCTER POR CARÁCTER el que se pegó, sin que nadie tenga
 * que acordarse de qué signos llevan espacio delante.
 *
 * Si algún día llega un párrafo sin posiciones, se vuelve a la reconstrucción de
 * `espacioAntes`, que es peor pero se lee.
 */
export function trozosParaPintar(parrafo: Parrafo): Trozo[] {
  const { texto, palabras } = parrafo;
  const conPosicion = palabras.every(
    (palabra) => Number.isInteger(palabra.desde) && Number.isInteger(palabra.hasta),
  );

  if (!texto || !conPosicion) {
    const trozos: Trozo[] = [];
    palabras.forEach((palabra, indice) => {
      if (espacioAntes(palabra.texto, palabras[indice - 1]?.texto)) {
        trozos.push({ tipo: 'relleno', texto: ' ', clave: `e${palabra.i}` });
      }
      trozos.push({ tipo: 'palabra', palabra });
    });
    return trozos;
  }

  const trozos: Trozo[] = [];
  let cursor = 0;

  for (const palabra of [...palabras].sort((a, b) => a.desde - b.desde)) {
    if (palabra.desde > cursor) {
      trozos.push({
        tipo: 'relleno',
        texto: texto.slice(cursor, palabra.desde),
        clave: `r${palabra.i}`,
      });
    }
    trozos.push({ tipo: 'palabra', palabra });
    cursor = Math.max(cursor, palabra.hasta);
  }

  if (cursor < texto.length) {
    trozos.push({ tipo: 'relleno', texto: texto.slice(cursor), clave: 'final' });
  }

  return trozos;
}

/** Parte un texto pegado en párrafos, respetando las líneas en blanco. */
export function enParrafos(texto: string): Parrafo[] {
  return texto
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((trozo) => trozo.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((trozo, indice) => ({ indice, texto: trozo, palabras: trocear(trozo) }));
}

/**
 * ¿Va un espacio antes de este trozo?
 *
 * Existe porque el contrato manda una lista de trozos, no una cadena. Unirlos
 * con espacios sin más escribe «Hello , world .», que no es el texto que trajo
 * quien lo pegó. Y como esto vale tanto para pintar como para sacar la frase de
 * ejemplo, se escribe UNA vez.
 */
export function espacioAntes(actual: string, anterior: string | undefined): boolean {
  if (anterior === undefined) return false;
  const primero = actual[0];
  const ultimo = anterior[anterior.length - 1];
  if (primero !== undefined && CIERRAN.has(primero)) return false;
  if (ultimo !== undefined && ABREN.has(ultimo)) return false;
  return true;
}

/** Vuelve a montar el texto de una lista de trozos. */
export function unirTrozos(palabras: readonly Palabra[]): string {
  let salida = '';
  let anterior: string | undefined;
  for (const palabra of palabras) {
    if (espacioAntes(palabra.texto, anterior)) salida += ' ';
    salida += palabra.texto;
    anterior = palabra.texto;
  }
  return salida;
}

/* ───────────────────────── contar y marcar ───────────────────────── */

export interface Cuenta {
  /** Solo palabras de verdad: la puntuación no cuenta para el progreso. */
  total: number;
  nueva: number;
  aprendiendo: number;
  sabida: number;
  ignorada: number;
  /** Lo que todavía tiene algo que enseñarte. */
  porDescubrir: number;
  /** De 0 a 100, contando lo ignorado como decidido. */
  porcentaje: number;
}

export function contar(parrafos: readonly Parrafo[]): Cuenta {
  const cuenta: Cuenta = {
    total: 0,
    nueva: 0,
    aprendiendo: 0,
    sabida: 0,
    ignorada: 0,
    porDescubrir: 0,
    porcentaje: 0,
  };

  for (const parrafo of parrafos) {
    for (const palabra of parrafo.palabras) {
      if (!palabra.lema) continue;
      cuenta.total += 1;
      cuenta[palabra.estado] += 1;
    }
  }

  cuenta.porDescubrir = cuenta.nueva + cuenta.aprendiendo;
  cuenta.porcentaje =
    cuenta.total === 0 ? 0 : Math.round(((cuenta.sabida + cuenta.ignorada) / cuenta.total) * 100);
  return cuenta;
}

/**
 * Cambia el estado de UN LEMA, en todas sus apariciones.
 *
 * Y esto es lo que hace que la pantalla enseñe algo. Marcar solo el trozo que
 * se tocó es lo que sale natural al escribirlo —tienes el índice delante— y es
 * un error de verdad: el servidor guarda por lema (`PUT …/palabra { lema,
 * estado }`), así que al recargar aparecerían marcadas las nueve apariciones de
 * «code» y antes de recargar solo una. La pantalla estaría enseñando un
 * progreso distinto del que hay guardado.
 *
 * Además es lo que se SIENTE bien: marcas una palabra difícil y ves cómo se
 * apaga en los cinco sitios donde salía.
 */
export function marcarLema(parrafos: readonly Parrafo[], lema: string, estado: EstadoPalabra) {
  if (!lema) return parrafos as Parrafo[];
  return parrafos.map((parrafo) => ({
    ...parrafo,
    palabras: parrafo.palabras.map((palabra) =>
      palabra.lema === lema ? { ...palabra, estado } : palabra,
    ),
  }));
}

/** Cuántas veces sale ese lema en todo el texto. */
export function vecesQueSale(parrafos: readonly Parrafo[], lema: string): number {
  let veces = 0;
  for (const parrafo of parrafos) {
    for (const palabra of parrafo.palabras) if (palabra.lema === lema) veces += 1;
  }
  return veces;
}

/**
 * Las frases del propio texto donde sale la palabra.
 *
 * Es lo que se enseña en el panel en lugar de una traducción, y no es un
 * sucedáneo: para alguien de B1 leyendo sobre lo suyo, ver «deploy» en las tres
 * frases donde sale dice más que una entrada de diccionario con seis acepciones.
 * Y no se inventa nada, que es la otra mitad del asunto.
 */
export function frasesCon(parrafos: readonly Parrafo[], lema: string, maximo = 3): string[] {
  const frases: string[] = [];

  for (const parrafo of parrafos) {
    const texto = parrafo.texto || unirTrozos(parrafo.palabras);
    // Se corta detrás del punto, no delante: así el signo se queda con su frase.
    for (const frase of texto.split(/(?<=[.!?])\s+/)) {
      const recortada = frase.trim();
      if (!recortada) continue;
      if (!trocear(recortada).some((palabra) => palabra.lema === lema)) continue;
      frases.push(recortada);
      if (frases.length >= maximo) return frases;
    }
  }

  return frases;
}

/* ───────────────────────── no perder el sitio ───────────────────────── */

export interface Encuadre {
  /** Borde de arriba de la palabra, en coordenadas de la ventana. */
  arriba: number;
  /** Borde de abajo. */
  abajo: number;
  altoVentana: number;
  /** Lo que tapa el panel por abajo. Cero si está cerrado. */
  altoPanel: number;
  /** Lo que tapa la cabecera por arriba. */
  altoCabecera?: number;
}

/**
 * Cuánto hay que desplazar la pantalla para que la palabra tocada siga
 * viéndose, y CERO si ya se veía.
 *
 * El cero es el motivo de que esto exista. Lo natural es llamar a
 * `scrollIntoView({ block: 'center' })` al abrir el panel, y eso mueve el texto
 * SIEMPRE, también —sobre todo— cuando la palabra estaba perfectamente a la
 * vista. El resultado es que tocar una palabra te tira el párrafo a otro sitio y
 * pierdes el renglón por el que ibas. En un artículo de quinientas palabras eso
 * es la diferencia entre leer y buscar dónde estabas cada diez segundos.
 *
 * Así que: si la palabra cabe en la banda que queda libre entre la cabecera y el
 * panel, no se mueve nada. Y si no cabe, se mueve lo mínimo y ni un píxel más.
 */
export function desplazamientoParaVer(encuadre: Encuadre, margen = 12): number {
  const { arriba, abajo, altoVentana, altoPanel, altoCabecera = 0 } = encuadre;
  const techo = altoCabecera;
  const suelo = altoVentana - altoPanel;

  // La banda libre es más estrecha que la palabra (pantalla diminuta con el
  // panel abierto): se alinea por arriba, que es donde empieza a leerse.
  if (abajo - arriba >= suelo - techo) return Math.round(arriba - techo - margen);

  if (abajo > suelo) return Math.round(abajo - suelo + margen);
  if (arriba < techo) return Math.round(arriba - techo - margen);
  return 0;
}

/* ───────────────────────── el audio ───────────────────────── */

/**
 * El base64 del contrato, convertido en algo que `<audio>` pueda reproducir.
 *
 * Se pasa por `Blob` en vez de usar el `data:` tal cual porque un MP3 de tres
 * minutos son unos tres megas de texto en la URL, y en móvil eso se nota al
 * buscar dentro del audio. Con `Blob` el navegador lo tiene en binario y puede
 * saltar a un punto sin volver a decodificar.
 *
 * Devuelve `null` si el base64 viene roto, y entonces la pantalla dice que no
 * hay voz, que es exactamente la verdad.
 */
export function urlDeAudio(audio: AudioLectura): string | null {
  try {
    const binario = atob(audio.base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: audio.mime || 'audio/mpeg' }));
  } catch {
    return null;
  }
}

/* ───────────────────────── el servidor ───────────────────────── */

/**
 * MIENTRAS NO HAYA SERVIDOR
 *
 * Las rutas de `/api/lecturas` las está escribiendo otra persona a la vez que
 * esto. Para no quedarse parado esperando, todo lo que sale de aquí tiene un
 * respaldo que guarda en este navegador y trocea el texto igual que lo hará el
 * servidor.
 *
 * Los identificadores del respaldo empiezan por `sim-`, y ESA es la regla que
 * decide a dónde va cada llamada. Sin ella habría que interpretar los 404, y un
 * 404 de «esa ruta no existe» se parece demasiado a uno de «esa lectura la
 * borraste hace un rato»: el día que el servidor esté, borrar una lectura de
 * verdad la resucitaría como copia local.
 *
 * La pantalla dice cuándo está en este modo. Un texto de mentira que se presenta
 * como tuyo es peor que una pantalla vacía.
 */
const PREFIJO_LOCAL = 'sim-';
const CLAVE_LOCAL = 'speakmi.lecturas.local';

type Disponibilidad = 'si' | 'no' | 'todavia-no-se';

let servidor: Disponibilidad = 'todavia-no-se';

/** Lo que se sabe ahora mismo del servidor de lecturas, sin preguntar. */
export function hayServidorDeLecturas(): Disponibilidad {
  return servidor;
}

/** La ruta no existe todavía, o no hay red: toca el respaldo. */
function faltaLaRuta(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return error instanceof ApiError && (error.status === 404 || error.status === 501);
}

interface Guardada {
  id: string;
  titulo: string;
  fuente: 'pegado' | 'url';
  creadaEn: string;
  parrafos: Parrafo[];
}

function leerLocal(): Guardada[] {
  try {
    const crudo = localStorage.getItem(CLAVE_LOCAL);
    if (!crudo) return [...EJEMPLO];
    const datos: unknown = JSON.parse(crudo);
    return Array.isArray(datos) ? (datos as Guardada[]) : [...EJEMPLO];
  } catch {
    // Navegación privada, cuota llena o un JSON de otra versión: se empieza de
    // cero en vez de dejar la pantalla rota.
    return [...EJEMPLO];
  }
}

function escribirLocal(lecturas: Guardada[]): void {
  try {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(lecturas));
  } catch {
    // Que no se pueda guardar no impide leer en esta sesión.
  }
}

function resumir(guardada: Guardada): ResumenLectura {
  const cuenta = contar(guardada.parrafos);
  return {
    id: guardada.id,
    titulo: guardada.titulo,
    creadaEn: guardada.creadaEn,
    palabras: cuenta.total,
    sinSaber: cuenta.porDescubrir,
  };
}

function tituloDe(datos: NuevaLectura): string {
  if (datos.titulo?.trim()) return datos.titulo.trim();
  const primera = datos.texto?.trim().split(/\s+/).slice(0, 7).join(' ');
  if (primera) return primera.length < (datos.texto?.trim().length ?? 0) ? `${primera}…` : primera;
  return datos.url?.trim() || 'Texto sin título';
}

/** Lista de textos. Es la llamada que decide si hay servidor o no. */
export async function listarLecturas(): Promise<ResumenLectura[]> {
  if (servidor !== 'no') {
    try {
      const lista = await api.get<ResumenLectura[]>('/lecturas');
      servidor = 'si';
      return lista;
    } catch (error) {
      if (!faltaLaRuta(error)) throw error;
      servidor = 'no';
    }
  }

  return leerLocal()
    .map(resumir)
    .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));
}

export async function crearLectura(datos: NuevaLectura): Promise<{ id: string }> {
  if (servidor !== 'no') {
    try {
      const creada = await api.post<{ id: string; titulo: string; palabras: number }>(
        '/lecturas',
        datos,
      );
      servidor = 'si';
      return { id: creada.id };
    } catch (error) {
      if (!faltaLaRuta(error)) throw error;
      servidor = 'no';
    }
  }

  // Sin servidor no se puede descargar una URL: lo diría el navegador y lo
  // impediría el CORS de casi cualquier web. Se dice, no se finge.
  if (!datos.texto?.trim()) {
    throw new Error('Sin servidor solo se pueden leer textos pegados, no direcciones web.');
  }

  const guardada: Guardada = {
    id: `${PREFIJO_LOCAL}${Date.now().toString(36)}`,
    titulo: tituloDe(datos),
    fuente: 'pegado',
    creadaEn: new Date().toISOString(),
    parrafos: enParrafos(datos.texto),
  };

  escribirLocal([guardada, ...leerLocal()]);
  return { id: guardada.id };
}

export async function obtenerLectura(id: string): Promise<Lectura> {
  if (!id.startsWith(PREFIJO_LOCAL)) {
    return api.get<Lectura>(`/lecturas/${encodeURIComponent(id)}`);
  }

  const guardada = leerLocal().find((lectura) => lectura.id === id);
  if (!guardada) throw new Error('Esa lectura ya no está en este navegador.');

  return {
    id: guardada.id,
    titulo: guardada.titulo,
    fuente: guardada.fuente,
    parrafos: guardada.parrafos,
    // Sin servidor no hay voz, y eso es lo mismo que pasa hoy CON servidor:
    // la clave de Azure está vacía. La pantalla ya sabe decirlo.
    audio: null,
  };
}

export async function marcarPalabra(
  id: string,
  lema: string,
  estado: EstadoPalabra,
): Promise<void> {
  if (!id.startsWith(PREFIJO_LOCAL)) {
    await api.put<{ ok: true }>(`/lecturas/${encodeURIComponent(id)}/palabra`, { lema, estado });
    return;
  }

  const lecturas = leerLocal();
  const guardada = lecturas.find((lectura) => lectura.id === id);
  if (!guardada) return;
  guardada.parrafos = marcarLema(guardada.parrafos, lema, estado);
  escribirLocal(lecturas);
}

/**
 * La voz de UN párrafo, o `null` si no hay.
 *
 * Por párrafo y bajo demanda porque es lo único que cabe: sintetizar un artículo
 * entero en una petición se sale del tiempo de una función serverless, y
 * devolverlo en base64 dentro del JSON del detalle serían varios megas antes de
 * poder leer la primera línea.
 *
 * Y de rebote arregla lo que peor llevaba esta pantalla: con la voz partida por
 * párrafos se puede señalar EL PÁRRAFO QUE SUENA sin inventarse nada. No es
 * palabra por palabra —para eso harían falta marcas de tiempo que nadie manda—,
 * pero es sincronía de verdad y no una estimación que se desajusta.
 *
 * Un 204 es «hoy no hay voz», que es lo que contesta mientras la clave de Azure
 * esté vacía. No es un fallo y no se pinta como tal.
 */
export async function audioDeParrafo(id: string, parrafo: number): Promise<AudioLectura | null> {
  if (id.startsWith(PREFIJO_LOCAL)) return null;

  try {
    const datos = await api.get<AudioLectura | undefined>(
      `/lecturas/${encodeURIComponent(id)}/audio?parrafo=${parrafo}`,
    );
    // `apiFetch` devuelve `undefined` en un 204: ahí es donde llega el «no hay voz».
    return datos?.base64 ? datos : null;
  } catch {
    // Sin red o con el servidor caído tampoco hay voz. Lo que no puede pasar es
    // que se caiga la pantalla de leer por un audio que era opcional.
    return null;
  }
}

export async function borrarLectura(id: string): Promise<void> {
  if (!id.startsWith(PREFIJO_LOCAL)) {
    await api.delete<void>(`/lecturas/${encodeURIComponent(id)}`);
    return;
  }
  escribirLocal(leerLocal().filter((lectura) => lectura.id !== id));
}

/** Solo para las pruebas: olvida lo que se sabía del servidor. */
export function olvidarServidorDeLecturas(): void {
  servidor = 'todavia-no-se';
}

/**
 * El texto de ejemplo del modo sin servidor.
 *
 * Está escrito para quien va a usar esto: inglés de trabajo, de los que salen en
 * una revisión de código, no «the cat is on the table». Sirve además para que la
 * pantalla se pueda probar con un texto largo de verdad, que es donde se rompen
 * las cosas.
 */
const TEXTO_EJEMPLO = `Why code review takes three days

Most teams agree that code review matters, and most teams are quietly unhappy with how theirs works. A pull request goes up on Monday, gets a first comment on Wednesday, and lands on Friday afternoon when nobody wants to touch anything. The work itself took two hours.

The usual explanation is that reviewers are busy. That is true, but it hides the real problem: a large change is expensive to review, so it keeps getting postponed in favour of something cheaper. Every hour it waits, the branch drifts further from the main one, and the eventual review has to cover both the change and the conflicts it picked up along the way.

Smaller changes break this loop. A patch that touches forty lines can be read between two meetings. It gets approved the same day, so it merges before it rots, and the next patch starts from a clean base. Nothing about the team changed; the size of the unit of work did.

There is a second habit worth stealing. Write the description as if the reader knows nothing about the ticket. Explain what you tried, what you rejected, and what you are unsure about. Reviewers who understand your reasoning argue with the reasoning instead of rewriting your code in the comments, and that conversation is far shorter.

None of this requires a new tool. It requires deciding that a review is a conversation with a deadline, and that anything too big to read in one sitting is too big to send.`;

const EJEMPLO: Guardada[] = [
  {
    id: `${PREFIJO_LOCAL}ejemplo`,
    titulo: 'Why code review takes three days',
    fuente: 'pegado',
    creadaEn: '2026-01-01T00:00:00.000Z',
    parrafos: enParrafos(TEXTO_EJEMPLO.split('\n').slice(2).join('\n')),
  },
];
