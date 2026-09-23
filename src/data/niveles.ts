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
  /** Cómo llama el Marco a los tres grandes bloques: básico, independiente, competente. */
  bloque: string;
  /** Qué sabes hacer al terminarlo, en una frase y sin jerga. */
  resumen: string;
  /**
   * Cosas concretas que sabes hacer, en primera persona.
   *
   * Son la traducción de los descriptores «can do» del Marco a algo que alguien
   * reconozca en su vida: no «produce discurso claro y detallado» sino «cuento
   * una película sin quedarme colgado». Un descriptor que no te deja decir «eso
   * sí lo hago» o «eso no» no sirve para situarte, que es para lo que existe.
   */
  puedes: string[];
  /** Horas de clase guiada que se suelen contar para llegar hasta aquí. */
  horas: string;
  /** Con qué exámenes reconocidos equivale, para quien necesite un papel. */
  examenes: string[];
  /** Los niveles del curso que caen en este tramo, en orden. */
  niveles: string[];
}

/*
  Las frases de `puedes` están escritas a partir de los descriptores del Marco y
  de los «Can Do» de ALTE, pero no son su traducción: el texto oficial está
  redactado para evaluadores —«produce discurso claro y detallado sobre una
  amplia gama de temas»— y eso no le dice nada a quien quiere saber si es B2.

  La regla al escribirlas: quien la lea tiene que poder decir al instante «eso sí
  lo hago» o «eso no». Si la respuesta honesta es «depende», la frase está mal y
  hay que bajarla a algo más concreto. Por eso se cambiaron tres: rellenar un
  formulario lo hace cualquiera reconociendo los campos sin saber inglés; «un
  artículo de mi sector» se queda sin referente para quien no tiene sector; y
  «nadie nota que no es mi idioma» mide algo que el lector no puede comprobar,
  porque nadie sabe lo que nota el de enfrente.

  Fuentes: la traducción oficial del Marco del Instituto Cervantes (escala
  global, cuadro 1), el documento ALTE Can Do alojado por Cambridge, las horas
  guiadas que publica Cambridge English y las equivalencias de IELTS y ETS.
  Están detalladas en `back/docs/09-que-falta-b2-c1-c2.md`.
*/
export const TRAMOS: Tramo[] = [
  {
    letra: 'A1',
    nombre: 'Principiante',
    bloque: 'Usuario básico',
    resumen: 'Te presentas, dices lo que hay a tu alrededor y hablas de tu día.',
    puedes: [
      'Me presento y digo cómo me llamo, de dónde soy y en qué trabajo.',
      'Pido un café o un plato del menú, aunque sea señalando y con frases sueltas.',
      'Me oriento con los carteles de un aeropuerto: salidas, puerta, recogida de equipaje.',
      'Entiendo un precio o una hora cuando me los dicen en voz alta.',
      'Entiendo a alguien que me habla despacio, y le pido que repita cuando no le sigo.',
    ],
    horas: '90-100 horas',
    examenes: ['Cambridge A1 Movers', 'Por debajo de lo que miden IELTS y TOEFL'],
    niveles: ['L1', 'L2', 'L3'],
  },
  {
    letra: 'A2',
    nombre: 'Básico',
    bloque: 'Usuario básico',
    resumen: 'Cuentas lo que pasó, te mueves por una ciudad y describes a la gente.',
    puedes: [
      'Cuento qué hice el fin de semana con frases cortas y en pasado.',
      'Compro en una tienda: pregunto el precio, pido otra talla y devuelvo algo.',
      'Pregunto por una calle y entiendo la respuesta si no se alarga.',
      'Digo qué me gusta y qué no, y añado un porqué en una frase.',
      'Escribo un mensaje corto a un compañero para pedirle algo concreto.',
      'Entiendo las etiquetas del supermercado y la carta de un restaurante normal.',
    ],
    horas: '180-200 horas',
    examenes: ['Cambridge A2 Key (KET)', 'IELTS 3-3.5', 'Por debajo del rango de TOEFL iBT'],
    niveles: ['L4', 'L5', 'L6', 'L7'],
  },
  {
    letra: 'B1',
    nombre: 'Intermedio',
    bloque: 'Usuario independiente',
    resumen: 'Te desenvuelves en casi cualquier situación cotidiana y das tu opinión.',
    puedes: [
      'Viajo solo a un país de habla inglesa y resuelvo el hotel, el transporte y un imprevisto.',
      'Le cuento a alguien la trama de una película que acabo de ver.',
      'Leo una noticia del periódico y me entero de lo que pasó sin buscar palabras.',
      'Escribo un correo para reclamar un cobro o pedir información, y me contestan.',
      'Explico por qué prefiero una opción y doy dos o tres razones.',
      'Charlo con un compañero de trabajo de temas conocidos sin que se corte la conversación.',
    ],
    horas: '350-400 horas',
    examenes: ['Cambridge B1 Preliminary (PET)', 'IELTS 4-5', 'TOEFL iBT 42-71'],
    niveles: ['L8'],
  },
  {
    letra: 'B2',
    nombre: 'Intermedio alto',
    bloque: 'Usuario independiente',
    resumen: 'Discutes ideas abstractas y sigues una conversación rápida entre nativos.',
    puedes: [
      'Sigo una serie sin subtítulos aunque se me escape alguna palabra.',
      'Discuto un cobro mal hecho por teléfono sin ponerme nervioso.',
      'Defiendo mi postura en una reunión de trabajo y contesto en el momento.',
      'Estoy con dos nativos que se pisan al hablar y no me pierdo.',
      'Escribo un informe largo que no suena a traducción del español.',
      'Leo un texto largo con vocabulario técnico de un tema que conozco, sin diccionario.',
    ],
    horas: '500-600 horas',
    examenes: ['Cambridge B2 First (FCE)', 'IELTS 5.5-6.5', 'TOEFL iBT 72-94'],
    niveles: [],
  },
  {
    letra: 'C1',
    nombre: 'Avanzado',
    bloque: 'Usuario competente',
    resumen: 'Te expresas con soltura y matices, también en el trabajo y en lo académico.',
    puedes: [
      'Doy una presentación delante de gente y respondo preguntas que no esperaba.',
      'Pillo la ironía y los dobles sentidos, y también los gasto yo.',
      'Cambio el tono según a quién escribo: no le hablo igual a un cliente que a un amigo.',
      'Hablo un buen rato seguido sin que se me note que busco las palabras.',
      'Leo un artículo de opinión denso y distingo lo que dice de lo que insinúa.',
      'Escribo un texto largo y bien ordenado sobre un tema complicado, sin ayuda.',
    ],
    horas: '700-800 horas',
    examenes: ['Cambridge C1 Advanced (CAE)', 'IELTS 7-8', 'TOEFL iBT 95-114'],
    niveles: [],
  },
  {
    letra: 'C2',
    nombre: 'Maestría',
    bloque: 'Usuario competente',
    resumen: 'Entiendes prácticamente todo y te expresas como alguien que creció con el idioma.',
    puedes: [
      'Entiendo a alguien con un acento cerrado que no había oído en mi vida.',
      'Negocio un contrato o saco un tema delicado eligiendo cada palabra.',
      'Resumo en un párrafo lo que dicen tres fuentes que se contradicen entre sí.',
      'Uso la expresión hecha que toca, la que diría un nativo, no la traducida del español.',
      'Leo un texto técnico de un campo que no es el mío y me quedo con lo esencial.',
    ],
    horas: '1000-1200 horas',
    examenes: [
      'Cambridge C2 Proficiency (CPE)',
      'IELTS 8.5-9',
      'TOEFL iBT no distingue C2 del C1 alto',
    ],
    niveles: [],
  },
];

/** En qué tramo cae un nivel del curso. */
export function tramoDe(codigo: string): Tramo | undefined {
  return TRAMOS.find((t) => t.niveles.includes(codigo));
}
