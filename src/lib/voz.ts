import {
  decirEnServidor,
  pararAudioDelServidor,
  servidorPuedeHablar,
  servidorPuedeHablarYa,
} from '@/lib/voz-servidor';

/**
 * Decir una frase en inglés, con la voz que haya.
 *
 * Lo primero es siempre el sintetizador del navegador: es gratis, funciona sin
 * conexión y suena al instante. El problema es que depende del equipo, y en un
 * Android en español —o en un Windows recién instalado— puede no haber ninguna
 * voz inglesa. Antes, ahí se acababa el asunto: la aplicación avisaba bien, pero
 * los dictados, los pares mínimos y el juego de Escucha se quedaban sin poder
 * hacerse.
 *
 * Por eso hay un segundo intento: que hable el servidor. Ver `voz-servidor.ts`.
 * Sigue sin sonar nada con una voz española leyendo inglés, que era y sigue
 * siendo lo único inaceptable, y si tampoco hay servidor se avisa igual que
 * antes. El aviso no se quita: deja de ser la única salida.
 */

const CLAVE_VOZ = 'speakmi.voz';

export function hayVoz(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Las voces tardan en cargar y `getVoices()` devuelve una lista vacía en la
 * primera llamada de muchos navegadores. Se espera al aviso de que ya están.
 */
async function vocesListas(): Promise<SpeechSynthesisVoice[]> {
  if (!hayVoz()) return [];

  const voces = window.speechSynthesis.getVoices();
  if (voces.length) return voces;

  /*
    Hasta cinco segundos, no uno.

    Medido en un Windows real: Chrome tarda unos tres segundos en publicar la
    lista. Con el tope anterior de 1,2 s se devolvía vacía, y sin voz elegida el
    navegador aplicaba la suya por defecto, que aquí era española. El resultado
    era un sintetizador español leyendo inglés.
  */
  return new Promise((resolver) => {
    let resuelto = false;
    const cerrar = (lista: SpeechSynthesisVoice[]) => {
      if (resuelto) return;
      resuelto = true;
      clearInterval(reloj);
      window.speechSynthesis.removeEventListener('voiceschanged', alCambiar);
      resolver(lista);
    };

    const alCambiar = () => cerrar(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', alCambiar);

    // Algunos navegadores no disparan el aviso: se pregunta cada poco.
    const reloj = setInterval(() => {
      const ahora = window.speechSynthesis.getVoices();
      if (ahora.length) cerrar(ahora);
    }, 300);

    setTimeout(() => cerrar(window.speechSynthesis.getVoices()), 5000);
  });
}

/**
 * Lo mismo, pero sin esperar: lo que se sepa ahora mismo.
 *
 * Cuando el navegador ya publicó su lista, y es lo normal salvo en los primeros
 * segundos, se puede responder en seco. Eso evita que la pantalla enseñe un
 * hueco y luego el contenido, que se ve como un parpadeo.
 */
export function vozInglesaYa(): 'si' | 'no' | 'todavia-no-se' {
  const aqui = vozInglesaDelAparatoYa();
  if (aqui === 'si') return 'si';

  const servidor = servidorPuedeHablarYa();
  if (servidor === 'si') return 'si';

  // Un «no» solo se afirma cuando se sabe de los dos. Mientras falte uno, la
  // respuesta honesta es que todavía no se sabe, y quien pregunta enseña
  // «buscando una voz» en vez de un aviso que a lo mejor hay que retirar.
  if (aqui === 'todavia-no-se' || servidor === 'todavia-no-se') return 'todavia-no-se';
  return 'no';
}

/** Lo que este aparato puede hacer por su cuenta, sin contar con el servidor. */
function vozInglesaDelAparatoYa(): 'si' | 'no' | 'todavia-no-se' {
  if (!hayVoz()) return 'no';
  const voces = window.speechSynthesis.getVoices();
  if (!voces.length) return 'todavia-no-se';
  return voces.some((voz) => voz.lang.toLowerCase().startsWith('en')) ? 'si' : 'no';
}

/**
 * ¿Se puede oír inglés aquí, de la forma que sea?
 *
 * Importa más de lo que parece. Sin voz inglesa, el navegador no se queda mudo:
 * lee el inglés con la voz que tenga, que aquí suele ser española. Eso no es un
 * defecto de sonido, es enseñar mal: «beach» leído por una voz española suena a
 * otra palabra. Antes que eso, mejor no reproducir nada y decirlo.
 *
 * Lo que cambia respecto de antes es que «no hay voz en este aparato» ya no
 * significa «no hay forma de oírlo»: queda el servidor. Por eso la pregunta que
 * se hace la aplicación es esta y no «¿hay una voz instalada?».
 */
export async function hayVozInglesa(): Promise<boolean> {
  // Si ya se sabe que sí, ni se espera a la lista de voces ni se pregunta nada.
  if (vozInglesaYa() === 'si') return true;

  /*
    Las dos preguntas a la vez, no una detrás de otra.

    `vocesListas()` puede tardar hasta cinco segundos en un navegador que no
    publica su lista. Encadenar la del servidor detrás dejaría a quien no tiene
    voces —justo a quien esto viene a rescatar— mirando una pantalla de espera
    el doble de tiempo.
  */
  const [aqui, servidor] = await Promise.all([hayVozInglesaDelAparato(), servidorPuedeHablar()]);
  return aqui || servidor;
}

async function hayVozInglesaDelAparato(): Promise<boolean> {
  const voces = await vocesListas();
  return voces.some((voz) => voz.lang.toLowerCase().startsWith('en'));
}

/**
 * Cuánto de natural suena cada voz, a ojo.
 *
 * Esto estaba justo al revés: se prefería `localService`, es decir, la voz
 * instalada en el sistema. Son precisamente las robóticas, las de toda la vida
 * de Windows. Las que suenan a persona son las que el navegador sintetiza
 * fuera, y esas tienen `localService` en falso.
 *
 * Los nombres se miran porque los fabricantes marcan sus voces nuevas con una
 * etiqueta: «Natural» y «Neural» en Microsoft, «Google» en Chrome. Cuando no se
 * reconoce nada, no se penaliza: se deja pasar con puntuación media.
 */
function calidadDe(voz: SpeechSynthesisVoice): number {
  const nombre = voz.name.toLowerCase();
  let puntos = 0;

  if (/natural|neural/.test(nombre)) puntos += 6;
  if (nombre.includes('google')) puntos += 5;
  if (/premium|enhanced|siri/.test(nombre)) puntos += 4;
  if (!voz.localService) puntos += 3;

  // Inglés de Estados Unidos primero: es el del curso y el de los ejemplos.
  if (voz.lang === 'en-US') puntos += 2;
  else if (voz.lang.startsWith('en')) puntos += 1;

  return puntos;
}

export interface VozDisponible {
  /** Lo que identifica la voz en el navegador. Es lo que se guarda. */
  id: string;
  /** Lo que se lee en la lista, ya limpio de coletillas del fabricante. */
  nombre: string;
  idioma: string;
  /** Si el sistema la considera de las buenas. Sirve para ordenarlas. */
  natural: boolean;
}

/** Las voces inglesas del equipo, de la que mejor suena a la que peor. */
export async function listarVoces(): Promise<VozDisponible[]> {
  const voces = await vocesListas();

  return voces
    .filter((voz) => voz.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => calidadDe(b) - calidadDe(a))
    .map((voz) => ({
      id: voz.voiceURI,
      nombre: nombreCorto(voz),
      idioma: voz.lang,
      natural: calidadDe(voz) >= 5,
    }));
}

/**
 * El nombre, sin lo que no aporta.
 *
 * Los fabricantes los escriben para sus catálogos, no para una lista:
 * «Microsoft Aria Online (Natural) - English (United States)». Se queda lo que
 * distingue una voz de otra, que es el nombre propio.
 */
function nombreCorto(voz: SpeechSynthesisVoice): string {
  const limpio = voz.name
    .replace(/^(Microsoft|Google|Apple)\s+/i, '')
    .replace(/\s*-\s*English.*$/i, '')
    .replace(/\s*\((Natural|Neural|Enhanced|Premium)\)/gi, '')
    .replace(/\s+Online$/i, '')
    .trim();

  return limpio || voz.name;
}

/** Qué voz se eligió, si se eligió alguna. */
export function vozElegida(): string | null {
  try {
    return localStorage.getItem(CLAVE_VOZ);
  } catch {
    // Navegación privada o cookies bloqueadas: se sigue con la automática.
    return null;
  }
}

export function elegirVoz(id: string | null): void {
  try {
    if (id) localStorage.setItem(CLAVE_VOZ, id);
    else localStorage.removeItem(CLAVE_VOZ);
  } catch {
    // Que no se pueda recordar no impide usarla en esta sesión.
  }
}

async function vozAUsar(): Promise<SpeechSynthesisVoice | null> {
  const voces = await vocesListas();
  if (!voces.length) return null;

  const preferida = vozElegida();
  if (preferida) {
    const elegida = voces.find((voz) => voz.voiceURI === preferida);
    // Puede haber desaparecido al cambiar de equipo o de navegador: entonces se
    // cae a la automática en vez de quedarse mudo.
    if (elegida) return elegida;
  }

  const inglesas = voces.filter((voz) => voz.lang.toLowerCase().startsWith('en'));
  if (!inglesas.length) return null;

  return inglesas.reduce((mejor, voz) => (calidadDe(voz) > calidadDe(mejor) ? voz : mejor));
}

export interface OpcionesDecir {
  /** Por debajo de 1 se entiende mejor a quien está empezando. */
  velocidad?: number;
  /** Fuerza una voz concreta, para poder probarlas en el selector. */
  vozId?: string;
}

/** Corta lo que esté sonando, venga del aparato o del servidor. */
export function callar(): void {
  pararAudioDelServidor();
  if (hayVoz()) window.speechSynthesis.cancel();
}

/** Lee el texto en voz alta. Resuelve cuando termina, o si no se pudo. */
export async function decir(texto: string, opciones: OpcionesDecir = {}): Promise<void> {
  const limpio = texto.trim();
  if (!limpio) return;

  // Cortar lo anterior: si alguien pulsa dos veces, no deben solaparse.
  callar();

  const velocidad = opciones.velocidad ?? 0.95;

  const voces = hayVoz() ? await vocesListas() : [];
  const voz = opciones.vozId
    ? (voces.find((v) => v.voiceURI === opciones.vozId) ?? (await vozAUsar()))
    : await vozAUsar();

  /*
    Sin voz inglesa en el aparato, que lo diga el servidor.

    Lo que sigue sin hacerse nunca es dejar sonar la voz que haya: una española
    leyendo inglés enseña una pronunciación que no existe, y eso es peor que el
    silencio. Si el servidor tampoco puede, no suena nada y quien llama debe
    haber comprobado antes `hayVozInglesa()` para explicarlo.
  */
  if (!voz || !voz.lang.toLowerCase().startsWith('en')) {
    await decirEnServidor(limpio, velocidad);
    return;
  }

  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = voz.lang;
  /*
    0.95 y no 1: un pelín más lento se entiende mejor sin que suene ralentizado.
    Antes estaba en 0.9, que ya se notaba arrastrado y sonaba más artificial.
  */
  frase.rate = velocidad;
  /*
    Un punto por debajo del tono neutro. Las voces sintéticas tienden a sonar
    agudas y planas, y bajarlas un poco las acerca a una voz hablada.
  */
  frase.pitch = 0.95;
  frase.voice = voz;

  await new Promise<void>((resolver) => {
    let cerrado = false;
    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      resolver();
    };
    frase.onend = cerrar;
    frase.onerror = cerrar;
    // Chrome se queda a veces sin disparar `onend`. El tope evita que el botón
    // se quede en "reproduciendo" para siempre.
    setTimeout(cerrar, Math.max(4000, texto.length * 120));
    window.speechSynthesis.speak(frase);
  });
}
