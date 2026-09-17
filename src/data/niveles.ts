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
