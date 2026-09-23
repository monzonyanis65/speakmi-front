/**
 * Los niveles del curso, tal como los imparte el Instituto Venezolano de Lenguas.
 * El mapeo con Interchange está documentado en speakmi-back/docs/02-curriculo.md.
 *
 * Esto vive en el frontend solo para la pantalla de bienvenida, que debe cargar
 * al instante y sin pedir nada a la API. La verdad la tiene el backend.
 */

export interface Nivel {
  codigo: string;
  numero: number;
  cefr: string;
  titulo: string;
  descripcion: string;
  ejemplo: string;
}

export const NIVELES: Nivel[] = [
  {
    codigo: 'L1',
    numero: 1,
    cefr: 'A1',
    titulo: 'Empiezo de cero',
    descripcion: 'Saludar, presentarte y nombrar cosas de tu alrededor.',
    ejemplo: 'This is a notebook.',
  },
  {
    codigo: 'L2',
    numero: 2,
    cefr: 'A1',
    titulo: 'Mi día a día',
    descripcion: 'La hora, tu rutina y lo que estás haciendo ahora.',
    ejemplo: "It's a quarter to three.",
  },
  {
    codigo: 'L3',
    numero: 3,
    cefr: 'A1+',
    titulo: 'Gustos y costumbres',
    descripcion: 'Comida, deportes y con qué frecuencia haces las cosas.',
    ejemplo: 'I always eat breakfast.',
  },
  {
    codigo: 'L4',
    numero: 4,
    cefr: 'A2',
    titulo: 'Moverme y contar lo que pasó',
    descripcion: 'Dar direcciones, hablar del pasado y llamar por teléfono.',
    ejemplo: 'I had a good time.',
  },
  {
    codigo: 'L5',
    numero: 5,
    cefr: 'A2',
    titulo: 'Quién soy y qué hago',
    descripcion: 'De dónde eres, tu trabajo, precios y lo que sabes hacer.',
    ejemplo: 'Do you play the guitar?',
  },
  {
    codigo: 'L6',
    numero: 6,
    cefr: 'A2',
    titulo: 'Mi gente y mi barrio',
    descripcion: 'Tu familia, tus hábitos, lo que hiciste y dónde vives.',
    ejemplo: 'We went dancing.',
  },
  {
    codigo: 'L7',
    numero: 7,
    cefr: 'A2+',
    titulo: 'Describir y comparar',
    descripcion: 'Cómo es la gente, lugares, experiencias y consejos.',
    ejemplo: 'Have you ever been there?',
  },
  {
    codigo: 'L8',
    numero: 8,
    cefr: 'B1',
    titulo: 'Desenvolverme',
    descripcion: 'Restaurante, planes, comparaciones y cómo has cambiado.',
    ejemplo: 'What would you like?',
  },
];

/**
 * Los tramos del Marco Común Europeo, que es la escala que la gente reconoce.
 *
 * Nadie dice «voy por el nivel 5»; se dice «soy A2». Es la etiqueta que se pone
 * en un currículum, la que piden en una entrevista y la que sirve para
 * compararse con alguien que estudió en otro sitio. Los ocho niveles del curso
 * son el camino; los tramos son dónde te deja ese camino.
 *
 * Dentro de una misma letra hay varios niveles, y eso no es un capricho de este
 * curso: entre empezar un A2 y terminarlo hay meses de trabajo. Por eso el
 * mapeo usa además A1+ y A2+, que marcan la segunda mitad del tramo.
 *
 * Los tres últimos todavía no tienen curso. Salen igualmente, y en gris, porque
 * esconderlos daría a entender que B1 es el final del inglés. Ver la escalera
 * entera y saber en qué peldaño estás vale más que un listado que se corta sin
 * explicar por qué.
 */
export interface Tramo {
  letra: string;
  nombre: string;
  /** Qué sabes hacer al terminarlo, en una frase y sin jerga. */
  resumen: string;
  /** Los niveles del curso que caen en este tramo, en orden. */
  niveles: string[];
}

export const TRAMOS: Tramo[] = [
  {
    letra: 'A1',
    nombre: 'Principiante',
    resumen: 'Te presentas, dices lo que hay a tu alrededor y hablas de tu día.',
    niveles: ['L1', 'L2', 'L3'],
  },
  {
    letra: 'A2',
    nombre: 'Básico',
    resumen: 'Cuentas lo que pasó, te mueves por una ciudad y describes a la gente.',
    niveles: ['L4', 'L5', 'L6', 'L7'],
  },
  {
    letra: 'B1',
    nombre: 'Intermedio',
    resumen: 'Te desenvuelves en casi cualquier situación cotidiana y das tu opinión.',
    niveles: ['L8'],
  },
  {
    letra: 'B2',
    nombre: 'Intermedio alto',
    resumen: 'Discutes ideas abstractas y sigues una conversación rápida entre nativos.',
    niveles: [],
  },
  {
    letra: 'C1',
    nombre: 'Avanzado',
    resumen: 'Te expresas con soltura y matices, también en el trabajo y en lo académico.',
    niveles: [],
  },
  {
    letra: 'C2',
    nombre: 'Maestría',
    resumen: 'Entiendes prácticamente todo y te expresas como alguien que creció con el idioma.',
    niveles: [],
  },
];

/** En qué tramo cae un nivel del curso. */
export function tramoDe(codigo: string): Tramo | undefined {
  return TRAMOS.find((t) => t.niveles.includes(codigo));
}
