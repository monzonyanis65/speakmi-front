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
  reloj: { lecturaMs: number; barraMs: number };
}

/** `POST /api/games/:code/respuesta`. */
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
};
