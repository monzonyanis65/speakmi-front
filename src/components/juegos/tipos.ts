/**
 * El contrato de los juegos, tal cual lo sirve el servidor, y lo que la
 * pantalla añade por su cuenta.
 *
 * Lo que viene del servidor son datos: título, descripción y marcas. Lo que vive
 * aquí es lo que no cambia nunca y hace falta aunque la API esté caída: qué
 * icono lleva cada juego, de qué color es y —lo importante— PARA QUÉ SIRVE.
 * Un juego que no dice qué entrena es un adorno.
 */
import type { EjercicioPublico } from '@/components/ejercicios/tipos';

export const CODIGOS = [
  'CONTRARRELOJ',
  'PAREJAS',
  'CADENA',
  'ESCUCHA',
  'CINCO_LETRAS',
  'CAEN',
  'FALSOS_AMIGOS',
  'PARTICULAS',
  'BRECHA',
  'MERCADO',
  'NEON',
  'BEAT',
  'CARRERA',
] as const;

export type CodigoJuego = (typeof CODIGOS)[number];

export function esCodigoJuego(valor: string | undefined): valor is CodigoJuego {
  return !!valor && (CODIGOS as readonly string[]).includes(valor);
}

/** Una entrada del listado, tal como la manda `GET /api/games`. */
export interface JuegoDelCatalogo {
  code: string;
  titleEs: string;
  descripcionEs: string;
  mejorPuntuacion: number | null;
  jugadasHoy: number;
}

/** `GET /api/games/:code/ronda` para CONTRARRELOJ y CADENA. */
export interface RondaDeEjercicios {
  code: string;
  segundos: number | null;
  ejercicios: EjercicioPublico[];
}

/** `GET /api/games/:code/ronda` para PAREJAS. */
export interface RondaDeParejas {
  code: string;
  parejas: Array<{ id: string; en: string; es: string }>;
}

/** `GET /api/games/:code/ronda` para ESCUCHA. */
export interface RondaDeEscucha {
  code: string;
  rondas: Array<{ id: string; diceEn: string; opciones: string[] }>;
}

/** De qué color sale una letra en CINCO_LETRAS. Lo decide el servidor. */
export type EstadoLetra =
  /** Esa letra, en ese sitio. */
  | 'sitio'
  /** Está en la palabra, pero en otro sitio. */
  | 'otra'
  /** No está, o ya no quedan de esa. */
  | 'no';

export interface LetraColoreada {
  letra: string;
  estado: EstadoLetra;
}

export interface IntentoDeCincoLetras {
  palabra: string;
  letras: LetraColoreada[];
}

export type EstadoDeCincoLetras = 'jugando' | 'ganada' | 'perdida';

/**
 * `GET /api/games/CINCO_LETRAS/ronda`.
 *
 * Fíjate en lo que NO hay: la palabra. Mientras `estado` sea `jugando` no llega,
 * porque si llegara se leería en la pestaña de red y no habría juego. Solo
 * aparece al acabar, que es cuando hay que enseñarla.
 */
export interface RondaDeCincoLetras {
  code: string;
  /** `YYYY-MM-DD`, el día del servidor. */
  dia: string;
  /** El número del día, para el título y para compartir. */
  numero: number;
  largo: number;
  intentosMaximos: number;
  intentos: IntentoDeCincoLetras[];
  estado: EstadoDeCincoLetras;
  restantes: number;
  /** Si la partida de hoy ya se cerró y cobró en el servidor. */
  cerrada: boolean;
  palabra?: string;
  /**
   * Si es LA palabra del día o una extra.
   *
   * La del día es la misma para todo el mundo y es la que se comparte en
   * cuadraditos. Las extra son para seguir jugando: compartirlas no diría nada,
   * porque cada cual tuvo la suya.
   */
  esDelDia: boolean;
}

/** `POST /api/games/CINCO_LETRAS/respuesta`. */
export interface IntentoCorregido extends RespuestaCorregida {
  letras: LetraColoreada[];
  estado: EstadoDeCincoLetras;
  restantes: number;
  intentos: IntentoDeCincoLetras[];
  palabra?: string;
}

/** `GET /api/games/:code/ronda` para CAEN. */
export interface RondaDeLluvia {
  code: string;
  /** Cuántas palabras pueden escaparse antes de que se acabe. */
  vidas: number;
  olas: OlaDeLluvia[];
}

/**
 * Una ola: cuatro cestas abajo y tres palabras que caen.
 *
 * Viene con `cestaId`, o sea con la solución. Es lo mismo que hace PAREJAS y por
 * el mismo motivo: entre soltar la palabra y ver si entró no cabe un viaje al
 * servidor mientras siguen cayendo otras dos. La puntuación la sigue contando el
 * servidor caída a caída; esto solo sirve para pintar el golpe al instante.
 */
export interface OlaDeLluvia {
  id: string;
  cestas: Array<{ id: string; es: string }>;
  palabras: Array<{ id: string; en: string; cestaId: string }>;
}

/**
 * `GET /api/games/:code/ronda` para FALSOS_AMIGOS.
 *
 * Las cartas vienen con la respuesta dentro (`verdadera`, `real`, `porQue`), y
 * es a propósito: la carta más apretada dura 1,6 segundos, así que el veredicto
 * no puede esperar a que conteste el servidor. Es el mismo trato que hacen
 * PAREJAS y CAEN. La puntuación la sigue contando el servidor carta a carta;
 * esto solo sirve para pintar el golpe al instante y para poder enseñar qué
 * significaba de verdad sin un viaje de por medio.
 */
export interface RondaDeFalsosAmigos {
  code: string;
  cartas: CartaDeFalsoAmigo[];
  /**
   * El reloj, ya calculado por el servidor.
   *
   * `escalones[n]` son los milisegundos que dura una carta cuando se llevan `n`
   * aciertos seguidos. Viene hecho en vez de venir como una fórmula porque la
   * calibración es lo que hace que este juego sea jugable o sea un muro, y no
   * puede vivir en dos sitios que se puedan desincronizar.
   */
  reloj: {
    escalones: number[];
    /** Cuántos escalones se afloja al fallar. */
    pasosAtrasAlFallar: number;
  };
}

export interface CartaDeFalsoAmigo {
  id: string;
  /** La palabra inglesa. */
  en: string;
  /** Lo que la carta propone que significa. */
  parece: string;
  /** Lo que significa de verdad. Se enseña al fallar. */
  real: string;
  /** Si `parece` era correcto. */
  verdadera: boolean;
  /** La explicación corta, para el medio segundo en el que se aprende. */
  porQue: string;
}

/**
 * Una situación de PARTICULAS: un verbo, seis partículas y qué significa.
 *
 * Viene con la solución dentro, igual que las olas de CAEN y por el mismo
 * motivo: la barra dura tres segundos y entre pulsar y ver si era no cabe un
 * viaje al servidor. El servidor sigue corrigiendo cada respuesta y llevando la
 * cuenta; esto solo sirve para pintar el resultado al instante y, sobre todo,
 * para poder enseñar el compuesto bueno en el medio segundo que enseña.
 */
export interface SituacionDeParticula {
  id: string;
  /** El verbo del centro: `look`. */
  verbo: string;
  /** La escena en español. Nunca lleva la respuesta dentro. */
  situacionEs: string;
  /** Las seis de alrededor, ya en el orden en que se pintan. */
  particulas: string[];
  correcta: string;
  /** El compuesto entero: `look after`, `run out of`. */
  compuesto: string;
  significadoEs: string;
  ejemploEn: string;
  /** Si admite el objeto en medio: `pick up the phone` / `pick the phone up`. */
  separable: boolean;
  nivel: 'A2' | 'B1';
  /**
   * Cuánto se deja leer ESTA situación antes de que la barra empiece a bajar.
   *
   * Va por situación y no por partida porque de eso depende: una frase de
   * treinta caracteres no necesita lo mismo que una de cincuenta, y darles el
   * mismo rato castiga a la larga sin premiar a la corta.
   */
  lecturaMs: number;
}

/**
 * `GET /api/games/PARTICULAS/ronda`.
 *
 * El reloj llega calculado desde el servidor y NO se inventa aquí: es lo que
 * decide si el juego enseña o es un muro, así que vive en un sitio. Son dos
 * números porque son dos cosas: `lecturaMs` es el rato en que la situación ya
 * está en pantalla y se puede contestar pero la barra sigue llena —leer español
 * no es lo que se entrena— y `barraMs` son los tres segundos que se ven
 * vaciarse, que son de asociación pura.
 */
export interface RondaDeParticulas {
  code: string;
  rondas: SituacionDeParticula[];
  reloj: {
    lecturaMs: number;
    /** Lo que dura la barra al empezar, sin racha todavía. */
    barraMs: number;
    /**
     * `escalones[n]` son los milisegundos de barra con n aciertos seguidos.
     *
     * Llega calculado y no como fórmula: el reloj es lo que decide si el juego
     * enseña o es un muro, y una calibración que vive en dos sitios acaba
     * desincronizada sin que nadie se entere hasta jugarlo.
     */
    escalones: number[];
    /** Cuántos escalones se retroceden al fallar o al quedarse sin tiempo. */
    pasosAtrasAlFallar: number;
  };
}

/**
 * Un aparato del panel de BRECHA, ya colocado en su casilla.
 *
 * No trae ni una etiqueta que diga dónde está: el sitio se ve, y se ve porque
 * las casillas están repartidas alrededor de los cuatro hitos del panel. Eso es
 * el juego. Si la casilla dijera «under the screen», entender la preposición
 * dejaría de hacer falta.
 */
export interface ControlDelPanel {
  id: string;
  ranura: 'arriba-izq' | 'arriba-der' | 'medio-izq' | 'medio-der' | 'abajo-izq' | 'abajo-der';
  color: 'red' | 'blue' | 'green' | 'yellow' | 'white';
  tipo: 'valve' | 'lever' | 'hatch' | 'pump';
  /** Los dos gestos que ofrece, en el orden en que se pintan. */
  acciones: [string, string];
}

/**
 * Una orden de la IA, con su panel y con la secuencia buena dentro.
 *
 * Viene resuelta por el mismo motivo que las cartas de FALSOS_AMIGOS: la falla
 * crítica tiene que verse en el momento del gesto equivocado, y entre tocar y
 * saber si era no cabe un viaje al servidor dentro de una ventana de cuatro
 * segundos. Y hay un motivo de más, propio de este juego: la frase inglesa tiene
 * que estar aquí de todas formas para poder decirla en voz alta, así que quien
 * mire la pestaña de red se ahorra entenderla, no la descubre.
 *
 * El servidor sigue corrigiendo cada orden y llevando la cuenta.
 */
export interface OrdenDeBrecha {
  id: string;
  nivel: 'A2' | 'B1' | 'B2';
  trampa: 'sitio' | 'direccion' | 'orden' | 'vocabulario';
  /** Lo que dice la IA. Es el enunciado entero del juego. */
  textoEn: string;
  /** Lo que significaba. Solo se enseña cuando la orden ya se resolvió. */
  traduccionEs: string;
  /** La frase que enseña al fallar: qué era exactamente lo que había que pillar. */
  ensena: string;
  controles: ControlDelPanel[];
  /** La secuencia buena, en el orden en que hay que ejecutarla. */
  pasos: Array<{ controlId: string; accion: string }>;
  /** Cuánto se deja leer el registro escrito cuando no hay voz inglesa. */
  lecturaMs: number;
}

/**
 * `GET /api/games/BRECHA/ronda`.
 *
 * El reloj llega calculado desde el servidor y NO se inventa aquí, igual que en
 * FALSOS_AMIGOS y PARTICULAS: es lo que decide si el juego enseña o es un muro,
 * así que vive en un solo sitio. `escalones[n]` son los milisegundos que se dan
 * POR PASO cuando se llevan `n` órdenes seguidas, y la ventana de una orden es
 * eso multiplicado por sus pasos.
 */
export interface RondaDeBrecha {
  code: string;
  /** Cuántas fallas críticas se aguantan antes de perder la estación. */
  vidas: number;
  /** Los hitos de cada columna del panel, de arriba abajo. */
  hitos: { izq: string[]; der: string[] };
  ordenes: OrdenDeBrecha[];
  reloj: {
    escalones: number[];
    /** Cuántos escalones se aflojan al fallar o al quedarse sin tiempo. */
    pasosAtrasAlFallar: number;
  };
}

/**
 * Una runa del banco de MERCADO: una pieza de frase con su identificador.
 *
 * El texto va SIEMPRE en minúscula y sin punto, y no es descuido: si una runa
 * llegara con mayúscula, la primera posición de la frase estaría regalada sin
 * saber una palabra de inglés, y con el punto pasaría lo mismo por el otro
 * extremo. La mayúscula y el punto los pone esta pantalla al montar la frase.
 */
export interface RunaDeMercado {
  id: string;
  texto: string;
}

/**
 * Un cliente de la tanda, tal y como llega.
 *
 * Fíjate en lo que NO hay, que es lo importante: no viene la solución, ni
 * cuáles de las runas son las buenas, ni cuántas hacen falta, ni qué opción del
 * regateo es la correcta. Es la única ronda de la casa que no trae nada de eso,
 * y se puede porque este juego no tiene reloj: montar una frase lleva medio
 * minuto, así que los trescientos milisegundos de red no le quitan nada a nadie
 * y a cambio se cierra la grieta que los demás juegos sí tienen, que es mirar
 * la pestaña de red.
 */
export interface EncargoDeMercado {
  id: string;
  /** Quién lo pide. Un oficio inventado: aquí no hay marcas ni personas reales. */
  clienteEs: string;
  emoji: string;
  /** Lo que pide, en español. Nunca nombra la gramática ni trae la frase dentro. */
  demandaEs: string;
  /** El banco entero: piezas buenas y señuelos revueltos, sin distinguir. */
  runas: RunaDeMercado[];
  regateo: {
    contextoEs: string;
    /** Lo que suelta el cliente al cobrar, en inglés. */
    clienteEn: string;
    opciones: Array<{ id: string; texto: string }>;
  };
  nivel: 'A2' | 'B1' | 'B2';
}

/** `GET /api/games/MERCADO/ronda`. */
export interface RondaDeMercado {
  code: string;
  /** Sellos del puesto. Ofender a un cliente cuesta uno. */
  reputacion: number;
  encargos: EncargoDeMercado[];
}

/** Lo que devuelve el servidor al forjar un objeto. */
export interface FeedbackDeForja {
  message_es: string;
  /** La frase buena, ya con su mayúscula y su punto. */
  correcta: string;
  /** La que se montó, para poder compararlas de un vistazo. */
  tuya: string;
  leccionEs: string;
  /** Los señuelos que se colaron, con el motivo. Vacío si se acertó. */
  senuelos: Array<{ texto: string; porQue: string }>;
}

/** Y al contestar al regateo. */
export interface FeedbackDeRegateo {
  message_es: string;
  correcta: string;
  significadoEs: string;
  dijiste: string;
  dijisteSignificado: string;
  ofende: boolean;
  leccionEs: string;
}

/**
 * `POST /api/games/MERCADO/respuesta`.
 *
 * `ofende` viene del servidor y es lo único que mueve la reputación: decirle a
 * un cliente «I'll write you off» no es un fallo de gramática, es una grosería,
 * y por eso cuesta un sello mientras que equivocarse de verbo compuesto solo
 * cuesta la venta.
 */
export interface RespuestaDeMercado extends RespuestaCorregida {
  ofende?: boolean;
  feedback?: FeedbackDeForja | FeedbackDeRegateo | RespuestaCorregida['feedback'];
}

/** `POST /api/games/:code/respuesta`. */
/* ────────────────────────────  NEON  ──────────────────────────── */

/** Un documento del expediente. El cuerpo va en inglés y sin traducir. */
export interface DocumentoDelCaso {
  id: string;
  tipo: 'correo' | 'registro' | 'medico' | 'transcripcion' | 'ficha' | 'nota';
  /** El rótulo, en español: «Correo interno», «Registro de puertas». */
  titulo: string;
  de?: string;
  para?: string;
  cuando?: string;
  lineas: string[];
  /**
   * Las palabras imprescindibles, traducidas.
   *
   * No es un diccionario: son las dos o tres sin las cuales la deducción no se
   * puede hacer. Traducirlo todo convertiría el documento en un texto español
   * con adorno inglés; no traducir nada lo convertiría en un examen de
   * vocabulario que este juego no pretende ser.
   */
  glosario: Array<{ en: string; es: string }>;
}

/**
 * Quién es quién, y con qué registro hay que hablarle.
 *
 * `comoTratarle` es la pieza que hace posible preguntar por el registro sin
 * meter falsos fallos. Sin ella, elegir entre «Would you mind…» y «Start
 * talking» sería cuestión de gusto y las dos respuestas serían defendibles. Con
 * la ficha delante, la buena se deduce del expediente igual que la
 * contradicción.
 */
export interface PersonaDelCaso {
  id: string;
  nombre: string;
  cargo: string;
  comoTratarle: string;
}

/** Una pregunta del caso, ya sin la respuesta. */
export interface PasoDelCaso {
  id: string;
  fase: 'expediente' | 'interrogatorio' | 'acusacion';
  enunciado: string;
  opciones: Array<{ texto: string }>;
  tipo?: 'cruce' | 'inferencia' | 'lexico';
  /** El fragmento sobre el que se pregunta, si lo hay. */
  cita?: { docId: string; texto: string };
  personaId?: string;
  /** Lo que suelta el sospechoso, en inglés. */
  dice?: string;
  traduccion?: string;
  objetivo?: string;
  /** Lo que susurra Milo antes del primer turno con cada sospechoso. */
  avisoDeMilo?: string;
}

export interface CasoDeNeon {
  casoId: string;
  titulo: string;
  gancho: string;
  lugar: string;
  documentos: DocumentoDelCaso[];
  personas: PersonaDelCaso[];
  pasos: PasoDelCaso[];
}

/**
 * `GET /api/games/NEON/ronda`.
 *
 * Fíjate en lo que NO hay: ni una respuesta. Ni `correcta`, ni por qué lo es,
 * ni qué contesta cada sospechoso. Es el único juego de la casa que puede
 * permitírselo sin pagar nada por ello, porque es el único sin reloj: CAEN,
 * FALSOS_AMIGOS, PARTICULAS y BRECHA mandan la solución porque un viaje al
 * servidor se comería el instante que enseña, y aquí no hay instante que
 * comerse.
 */
export interface RondaDeNeon {
  code: string;
  /** Cuántas veces puedes equivocarte de registro antes de que se levante. */
  recelosParaCerrarse: number;
  caso: CasoDeNeon;
}

/**
 * `POST /api/games/NEON/respuesta`.
 *
 * Lo que vuelve al fallar es lo que este juego enseña: `refuta` es la línea del
 * expediente que desmiente lo que elegiste, no un «no era esa». `porQue` viene
 * siempre, porque acertar por los pelos también hay que saber por qué fue.
 */
export interface VeredictoDeNeon {
  isCorrect: boolean;
  feedback?: {
    message_es?: string;
    /** Lo que decía la opción buena. Solo al fallar. */
    correcta?: string;
    /** Qué línea del expediente tumba lo que se eligió. Solo al fallar. */
    refuta?: string;
    porQue?: string;
    /** Lo que contesta el sospechoso a LO QUE SE LE DIJO, se acierte o no. */
    reaccion?: string;
    /** Lo que suelta al bajar la guardia. Solo al acertar interrogando. */
    revelacion?: string;
    /** Qué pasó de verdad. Solo al contestar la acusación. */
    cierre?: string;
  } | null;
}

/* ────────────────────────────  BEAT  ──────────────────────────── */

/**
 * Una de las tres pastillas de abajo: a lo que se apunta.
 *
 * En el compás de frase son siempre las mismas —QUIÉN, ACCIÓN, QUÉ— y en el de
 * oído cambian en cada grupo, porque son las tres palabras que se confunden.
 */
export interface PastillaDeBeat {
  id: string;
  etiqueta: string;
  /** La aclaración pequeña: la traducción, o qué cuenta como esa parte. */
  pista?: string;
}

/**
 * Una nota, con su pastilla buena dentro.
 *
 * Viene resuelta por el mismo motivo que las cartas de FALSOS_AMIGOS y las olas
 * de CAEN, y aquí es donde más se nota: la ventana de acierto entera dura
 * 800 ms, y un viaje al servidor en una conexión regular son 300. Esperar la
 * corrección se comería más de un tercio de la ventana y el juego dejaría de ir
 * al compás de nada. El servidor sigue corrigiendo nota a nota y llevando la
 * cuenta; esto solo sirve para pintar el golpe en el pulso.
 */
export interface NotaDeBeat {
  id: string;
  /** En qué pulso de la canción cae, contando desde cero. */
  pulso: number;
  /** Lo que lleva escrito. Falta en el compás de oído: allí la nota se oye. */
  texto?: string;
  /** Lo que dicta la voz. Solo en el compás de oído. */
  diceEn?: string;
  pastillaId: string;
}

/** Un grupo: tres notas que van juntas y una cosa que enseñan al acabar. */
export interface GrupoDeBeat {
  id: string;
  modo: 'frase' | 'oido';
  nivel: 'A2' | 'B1';
  /** Lo que significa la frase, en español. Solo en el compás de frase. */
  fraseEs?: string;
  /** La frase inglesa entera, que es lo que se enseña al cerrar el grupo. */
  fraseEn?: string;
  /** Qué sonido separa las tres palabras. Solo en el compás de oído. */
  contraste?: string;
  ensena: string;
  pastillas: PastillaDeBeat[];
  notas: NotaDeBeat[];
}

/**
 * `GET /api/games/BEAT/ronda`.
 *
 * Llegan LOS DOS compases y se juega uno. Es la única ronda de la casa que
 * sirve más de lo que se usa, y el motivo es que cuál se puede jugar no lo
 * decide el servidor: lo decide si este aparato tiene una voz inglesa
 * instalada, y eso solo se sabe aquí. Así la pantalla de entrada comprueba la
 * voz, lo explica y deja elegir sin una segunda vuelta a la red.
 *
 * `compas` llega calculado desde el servidor y NO se inventa aquí, igual que el
 * `reloj` de FALSOS_AMIGOS, PARTICULAS y BRECHA: es lo que decide si el juego
 * enseña o es una prueba de reflejos, así que vive en un solo sitio.
 */
export interface RondaDeBeat {
  code: string;
  compas: {
    msPorPulso: number;
    msEntreNotas: number;
    /** Cuánto rato se ve venir una nota antes de llegar a la línea. */
    msDeAnticipacion: number;
    /** El medio ancho de la ventana de acierto. */
    msVentana: number;
    /** Y el del «perfecto», que NO paga puntos: solo brilla y suena. */
    msVentanaPerfecta: number;
    pulsosDeCortesia: number;
    pulsosTotales: number;
    /** Aciertos seguidos que encienden la fiebre. */
    rachaDeFiebre: number;
  };
  /** El compás que se lee. Se juega sin voz ninguna. */
  frase: GrupoDeBeat[];
  /** El que se oye. Necesita una voz inglesa instalada. */
  oido: GrupoDeBeat[];
}

/* ────────────────────────────  CARRERA  ──────────────────────────── */

/**
 * Una puerta: la frase con el hueco y los tres portales de sus carriles.
 *
 * Viene con `correcta` dentro, igual que las olas de CAEN y las cartas de
 * FALSOS_AMIGOS y por el mismo motivo: entre que Milo cruza el portal y se ve
 * si coge impulso o frena no cabe un viaje al servidor, y menos con la puerta
 * siguiente ya acercándose. El servidor sigue corrigiendo puerta a puerta y
 * llevando la cuenta; esto solo sirve para pintar el golpe al instante y para
 * poder enseñar la regla en el medio segundo que sigue a un fallo.
 *
 * `opciones` YA VIENE BARAJADA por el servidor y en el orden de los carriles:
 * la de la izquierda, la del medio y la de la derecha. Aquí no se toca. Si se
 * barajara otra vez, el texto que se manda al corregir dejaría de coincidir con
 * el portal que se cruzó.
 */
export interface PuertaDeCarrera {
  id: string;
  /** La frase inglesa con el hueco marcado con `___`. */
  frase: string;
  /** Las tres opciones, en el orden de los carriles. */
  opciones: string[];
  correcta: string;
  /** La regla en una línea. Se enseña al fallar, que es cuando hace falta. */
  ensena: string;
  /** Qué entrena esta puerta. Se resume al terminar la carrera. */
  foco: string;
  /**
   * Lo que cuesta leer ESTA frase, según el servidor.
   *
   * No se calcula aquí ni se aprieta con la racha, y las dos cosas importan. La
   * velocidad de lectura de una frase nueva que hay que entender para actuar
   * son 14-18 caracteres por segundo, y suponer más es lo que dejó injugable a
   * otro juego de esta casa. Vive en el servidor para que no pueda haber dos
   * calibraciones distintas.
   */
  lecturaMs: number;
  /** Y lo que cuesta mirar y leer sus tres portales. Tampoco se aprieta. */
  portalesMs: number;
}

/**
 * `GET /api/games/CARRERA/ronda`.
 *
 * El reloj llega TROCEADO desde el servidor, que es lo que distingue a este
 * juego de los otros con reloj: la ventana de una puerta son sus `lecturaMs`
 * más sus `portalesMs` más `escalones[racha]`, y solo el último sumando se
 * acorta al encadenar. Apretar la lectura no haría el juego más difícil, lo
 * haría imposible.
 */
export interface RondaDeCarrera {
  code: string;
  puertas: PuertaDeCarrera[];
  reloj: {
    /** `escalones[n]` son los milisegundos de decidir con n aciertos seguidos. */
    escalones: number[];
    /** Cuántos escalones se aflojan al fallar o al cruzar sin elegir. */
    pasosAtrasAlFallar: number;
  };
  /**
   * El cazador, que aquí hace lo que en otros juegos hacen las vidas.
   *
   * La diferencia es que cuenta DERRUMBES y no despistes: la barra sube al
   * acertar y baja al fallar, así que equivocarse en la cuarta puerta y en la
   * novena no acaba la carrera —se recupera entre medias— y fallar tres
   * seguidas sí.
   */
  cazador: {
    ventajaInicial: number;
    ventajaMaxima: number;
    impulsoPorAcierto: number;
    frenazoPorFallo: number;
    /**
     * Desde qué racha multiplica cada tramo del combo.
     *
     * Multiplican el IMPULSO, o sea la distancia que se le saca al cazador, y
     * NO los puntos. Es la distinción que `Tablero.tsx` dejó escrita: un «×8»
     * al lado de una puntuación que no multiplica por ocho se lee como una
     * estafa, y ya pasó en esta aplicación. Los puntos los cuenta el servidor
     * con la fórmula de siempre y el marcador en vivo enseña esa misma.
     */
    tramosDeCombo: Array<{ desde: number; multiplicador: number }>;
  };
}

export interface RespuestaCorregida {
  isCorrect: boolean;
  /**
   * El contrato dice `feedback?` sin más. Puede llegar como frase suelta o como
   * el objeto que usa el resto de la aplicación, así que se acepta cualquiera
   * de los dos y se normaliza con `textoDeFeedback`.
   */
  feedback?: string | { message_es?: string; correcta?: string } | null;
}

/** `POST /api/games/:code/fin`. */
export interface ResultadoFinal {
  puntuacion: number;
  mejorPuntuacion: number;
  monedas: number;
  recordNuevo: boolean;
}

/** Lo que cada juego entrega al terminar, antes de mandarlo al servidor. */
export interface Marcador {
  puntuacion: number;
  aciertos: number;
  total: number;
}

export function textoDeFeedback(feedback: RespuestaCorregida['feedback']): string | null {
  if (!feedback) return null;
  if (typeof feedback === 'string') return feedback.trim() || null;
  const texto = feedback.message_es ?? feedback.correcta;
  return texto?.trim() || null;
}

/**
 * Lo que vale un acierto según la racha que llevas.
 *
 * Diez puntos el primero, veinte el segundo seguido, y así hasta el tope. Es la
 * regla que convierte una lista de ejercicios en un juego: acertar tres seguidos
 * tiene que valer más que acertar tres sueltos, porque encadenar es justo lo
 * difícil. El tope existe para que una racha larga no vuelva irrelevante todo lo
 * demás.
 */
export function puntosPorRacha(racha: number, tope = 5): number {
  return 10 * Math.min(Math.max(racha, 1), tope);
}

/** El multiplicador que se enseña en pantalla, que es el mismo número sin el ×10. */
export function multiplicadorDe(racha: number, tope = 5): number {
  return Math.min(Math.max(racha, 1), tope);
}

export interface FichaDeJuego {
  icono: string;
  /** El título de respaldo, para cuando el servidor no contesta. */
  titulo: string;
  /** La descripción de respaldo, por lo mismo. */
  descripcion: string;
  /** Qué entrena. Esto no lo manda el servidor y es lo que justifica el juego. */
  entrena: string;
  /** Por qué entrenar eso importa. Se lee dentro del juego, no en la tarjeta. */
  porQue: string;
  /** Fondo del icono. Van oscuros porque el texto de dentro es blanco. */
  color: string;
}

/**
 * Los cuatro juegos.
 *
 * El orden no es casual: contrarreloj primero porque es el que más se juega y el
 * que mejor explica de qué va esto; escucha el último porque es el único que
 * puede no funcionar en un equipo sin voces inglesas instaladas.
 */
export const FICHAS: Record<CodigoJuego, FichaDeJuego> = {
  CONTRARRELOJ: {
    icono: '⏱️',
    titulo: 'Contrarreloj',
    descripcion: 'Cuántas aciertas en un minuto.',
    entrena: 'la velocidad',
    porQue:
      'Saberte la regla y poder usarla a tiempo no son lo mismo. Aquí no hay tiempo de pensarlo: eso es hablar.',
    color: 'bg-acento-600',
  },
  PAREJAS: {
    icono: '🃏',
    titulo: 'Parejas',
    descripcion: 'Junta cada palabra en inglés con la española.',
    entrena: 'el vocabulario',
    porQue:
      'Cuantas más palabras reconozcas sin traducir, menos se te corta una frase por la mitad.',
    color: 'bg-marca-700',
  },
  CADENA: {
    icono: '🔗',
    titulo: 'Cadena',
    descripcion: 'Sigue acertando. Un fallo y se acaba.',
    entrena: 'justo tus fallos',
    porQue:
      'Los ejercicios salen de lo que vienes fallando, así que la cadena se rompe donde flojeas.',
    color: 'bg-emerald-800',
  },
  ESCUCHA: {
    icono: '🎧',
    titulo: 'Escucha',
    descripcion: 'Oyes una palabra y eliges cuál era.',
    entrena: 'el oído',
    porQue:
      'Entender de oído es lo último que llega, y es lo único que no se puede leer dos veces.',
    color: 'bg-marca-800',
  },
  /*
    El único diario, y el único que no se puede repetir.

    Por eso no promete una habilidad que se entrena a base de partidas —no hay
    partidas, hay una al día— sino la que de verdad pone en juego: escribir la
    palabra entera, letra a letra, que es donde se ve si alguien se la sabe o
    solo la reconoce en una lista de cuatro opciones.
  */
  CINCO_LETRAS: {
    icono: '🔤',
    titulo: 'Cinco letras',
    descripcion: 'La palabra del día, en seis intentos.',
    entrena: 'cómo se escriben',
    porQue:
      'Reconocer una palabra en una lista es fácil. Escribirla de memoria, letra por letra, es lo que hace falta para usarla.',
    color: 'bg-teal-800',
  },
  /*
    PAREJAS también es vocabulario, y por eso este no puede decir que entrena
    «el vocabulario»: dos tarjetas que prometen lo mismo son una tarjeta
    repetida. Lo que cambia aquí es que hay un suelo acercándose, y eso convierte
    reconocer en reconocer A TIEMPO, que es otra habilidad distinta.
  */
  CAEN: {
    icono: '🌧️',
    titulo: 'Lluvia de palabras',
    descripcion: 'Llévalas a su cesta antes de que toquen el suelo.',
    entrena: 'reconocer sin pensar',
    porQue:
      'Aquí no da tiempo a traducir en la cabeza: o la palabra te dice algo al verla, o se te cae al suelo.',
    color: 'bg-fuchsia-700',
  },
  /*
    El único que no entrena algo que el curso ya enseña: trae material que el
    curso NO TIENE. En las 186 palabras del temario no hay ni un falso amigo.

    Y por eso lo que promete no es una habilidad, es un tipo de error concreto.
    Estas palabras no se fallan por no saber inglés —quien las falla lleva seis
    niveles aprobados— se fallan por instinto, y contra el instinto no vale
    estudiar: hay que pillarse a uno mismo en el acto.
  */
  FALSOS_AMIGOS: {
    icono: '🎭',
    titulo: 'Falsos amigos',
    descripcion: '¿Significa lo que parece? Decide antes de que se acabe.',
    entrena: 'no fiarte del parecido',
    porQue:
      '«Embarrassed» no es embarazada y «library» no es librería. Se fallan por instinto, así que hay que ir deprisa para pillarlo.',
    color: 'bg-rose-700',
  },
  /*
    El otro que trae material que el curso no tiene, y el que menos se parece a
    una lección.

    Un verbo compuesto no se deduce: no hay nada en «after» que lleve de mirar a
    cuidar. Por eso no promete entender ni recordar, sino ASOCIAR, que es la
    única forma en que estas cosas entran. Y por eso el reloj de tres segundos
    no es un adorno: con diez, uno razona la gramática, acierta y no aprende
    nada, porque hablando no va a tener diez.
  */
  PARTICULAS: {
    icono: '🎯',
    titulo: 'La partícula',
    descripcion: 'Un verbo, seis partículas y tres segundos.',
    entrena: 'los verbos compuestos',
    porQue:
      'No se deducen, se asocian: nada en «after» lleva de mirar a cuidar. Con prisa no da tiempo a razonarlo, que es justo el punto.',
    color: 'bg-indigo-700',
  },
  /*
    El único que no se contesta: se obedece.

    Los ocho de arriba preguntan algo y se elige, se escribe o se arrastra. Aquí
    una IA dicta un protocolo en inglés y hay que hacerlo, en su orden y en su
    sitio. Por eso lo que promete no es «las preposiciones» —eso sonaría a
    ejercicio de rellenar huecos— sino OBEDECER una instrucción, que es la
    prueba de que se entendió: en una instrucción mal entendida no se pierde
    medio punto, se abre la escotilla que no era.

    El icono es la sirena y no un cohete: lo que hay aquí no es espacio, es
    prisa. Y el color es acero, el único apagado de todo el escaparate, porque
    junto a ocho tarjetas de colores vivos el panel de máquinas se reconoce sin
    leer nada.
  */
  BRECHA: {
    icono: '🚨',
    titulo: 'Protocolo de brecha',
    descripcion: 'La IA dicta la maniobra en inglés. Ejecútala antes de que reviente.',
    entrena: 'obedecer en inglés',
    porQue:
      'Entender de verdad una instrucción es poder ejecutarla. Aquí el sitio, el orden y la dirección deciden si la estación aguanta.',
    color: 'bg-slate-700',
  },
  /*
    El único que no pregunta: fabrica.

    Los otros nueve sirven una pregunta y recogen una respuesta, aunque se
    responda arrastrando, pulsando un corro o tocando un panel. Aquí se MONTA
    algo: el cliente dice en español lo que necesita y hay que construir la
    frase inglesa que lo dice, con un banco donde sobran piezas. Por eso lo que
    promete no es «la gramática» —eso suena a examen— sino PRODUCIR la frase,
    que es la diferencia entre reconocer la buena entre cuatro y saber decirla.

    El color es ámbar oscuro y tiene dos pegas que conviene reconocer: es vecino
    del naranja de CONTRARRELOJ y en el resto de la aplicación el ámbar
    significa «aviso». Se elige igualmente porque de los tonos que quedaban
    libres es el único que dice algo del juego —luz de farol, latón, madera de
    puesto— y porque el tramo que se usa aquí (500 a 800) es mucho más oscuro
    que el naranja claro de CONTRARRELOJ, así que puestas al lado no se
    confunden. El gris de acero, que era la otra opción neutra, ya es de BRECHA.
  */
  /*
    El único que se juega leyendo, y el único sin prisa de los diez.

    Por eso lo que promete no es una habilidad rápida sino la más lenta que hay:
    darse cuenta de que dos frases no pueden ser ciertas a la vez. Y la segunda
    mitad —a quién se le habla de usted y a quién no— es lo que el curso llama
    «registro» y nunca llega a preguntar, porque preguntarlo a secas no se puede
    sin dar la situación por escrito.
  */
  NEON: {
    icono: '🔎',
    titulo: 'Sombras de neón',
    descripcion: 'Lee el expediente, pilla la contradicción y elige cómo le hablas a cada uno.',
    entrena: 'leer entre líneas',
    porQue:
      'La contradicción no está escrita en ninguna línea: está entre dos. Y a un directivo no se le habla como a un estibador.',
    color: 'bg-cyan-800',
  },
  /*
    El único que se juega A TIEMPO, y no «deprisa».

    Cinco de los diez llevan reloj, pero el reloj de todos ellos es una cuenta
    atrás: contesta antes de que se acabe, y cuanto antes mejor. Aquí llegar
    pronto está tan mal como llegar tarde, porque lo que se pulsa es un pulso.
    Por eso lo que promete no es velocidad —eso ya lo dice CONTRARRELOJ— sino
    colocar cada trozo de frase en su sitio, que es lo que hace falta para que
    una frase inglesa salga entera y no a trompicones.

    Y es el único de los once que no se apaga en un móvil sin voces inglesas:
    su compás principal se lee, no se oye.

    El color es lima, y tiene una pega que conviene decir: es un verde, y el
    verde de esta casa significa «acertado». Se elige igualmente porque el lima
    es amarillo-verde y el del acierto es esmeralda, que puestos al lado no se
    parecen, y porque de lo que quedaba libre era lo único que decía algo de un
    juego de ritmo: es el color de una pantalla de neón encendida.
  */
  BEAT: {
    icono: '🥁',
    titulo: 'Al compás',
    descripcion: 'Caen notas con trozos de frase. Mándalas a su sitio en el pulso.',
    entrena: 'el orden de la frase',
    porQue:
      'En inglés el sujeto no se puede callar y el verbo va en bloque. Al compás no da tiempo a recolocarlo: o sale ordenado, o se escapa.',
    color: 'bg-lime-700',
  },
  /*
    El único que no se juega con la pantalla quieta: se corre.

    Los demás juegos con reloj ponen una cuenta atrás delante de algo parado.
    Aquí Milo va hacia adelante pase lo que pase y lo único que se decide es por
    qué carril pasa. Por eso lo que promete no es «la gramática» ni «la
    velocidad», sino leer MIENTRAS pasa otra cosa, que es la situación real: a
    nadie le paran el mundo para que termine de entender una frase.

    El color es violeta porque es de Milo, que aquí no es un adorno de la
    esquina: es lo que corre. Se separa del morado de marca de PAREJAS por ser
    más frío y más oscuro.
  */
  CARRERA: {
    icono: '🏃',
    titulo: 'Carrera de sintaxis',
    descripcion: 'Milo corre por tres carriles. Cruza el portal que completa la frase.',
    entrena: 'leer sin frenar',
    porQue:
      'Aquí el suelo no se para a esperarte. O la frase te dice algo mientras corres, o te comes el portal que no era.',
    color: 'bg-violet-700',
  },
  MERCADO: {
    icono: '🏮',
    titulo: 'El mercado de contrabando',
    descripcion: 'Fabrica lo que el cliente pide, pieza a pieza. Y no le ofendas al cobrar.',
    entrena: 'construir la frase',
    porQue:
      'Reconocer la frase buena entre cuatro es fácil. Montarla tú, eligiendo entre piezas que casi valen, es lo que hace falta para hablar.',
    color: 'bg-amber-700',
  },
};
