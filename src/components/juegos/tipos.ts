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

export const CODIGOS = ['CONTRARRELOJ', 'PAREJAS', 'CADENA', 'ESCUCHA'] as const;

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
};
