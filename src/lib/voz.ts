/**
 * Decir una frase en inglés con la voz del sistema.
 *
 * Se usa el sintetizador del navegador, que es gratis, funciona sin claves y no
 * gasta cuota de nadie. A cambio, la voz depende del equipo: en un Windows
 * recién instalado puede no haber ninguna en inglés, y por eso todo esto avisa
 * en vez de fallar en silencio.
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
  if (!hayVoz()) return 'no';
  const voces = window.speechSynthesis.getVoices();
  if (!voces.length) return 'todavia-no-se';
  return voces.some((voz) => voz.lang.toLowerCase().startsWith('en')) ? 'si' : 'no';
}

/**
 * ¿Hay alguna voz inglesa instalada?
 *
 * Importa más de lo que parece. Si no la hay, el navegador no se queda mudo:
 * lee el inglés con la voz que tenga, que aquí suele ser española. Eso no es un
 * defecto de sonido, es enseñar mal: «beach» leído por una voz española suena a
 * otra palabra. Antes que eso, mejor no reproducir nada y decirlo.
 */
export async function hayVozInglesa(): Promise<boolean> {
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

/** Lee el texto en voz alta. Resuelve cuando termina, o si no se pudo. */
export async function decir(texto: string, opciones: OpcionesDecir = {}): Promise<void> {
  if (!hayVoz() || !texto.trim()) return;

  // Cortar lo anterior: si alguien pulsa dos veces, no deben solaparse.
  window.speechSynthesis.cancel();

  const voces = await vocesListas();
  const voz = opciones.vozId
    ? (voces.find((v) => v.voiceURI === opciones.vozId) ?? (await vozAUsar()))
    : await vozAUsar();

  /*
    Sin voz inglesa no se reproduce nada.

    Dejarlo sonar sería peor que el silencio: el navegador usaría la voz que
    tenga, y una española leyendo inglés enseña una pronunciación que no existe.
    Quien llama a esto debe comprobar antes `hayVozInglesa()` y explicarlo.
  */
  if (!voz || !voz.lang.toLowerCase().startsWith('en')) return;

  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = voz.lang;
  /*
    0.95 y no 1: un pelín más lento se entiende mejor sin que suene ralentizado.
    Antes estaba en 0.9, que ya se notaba arrastrado y sonaba más artificial.
  */
  frase.rate = opciones.velocidad ?? 0.95;
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
