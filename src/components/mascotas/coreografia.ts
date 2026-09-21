/**
 * La coreografía de la mascota: qué pose tiene cada estado y con qué resorte
 * llega a ella.
 *
 * Vive fuera del componente por dos razones. Una de herramienta: un archivo que
 * exporta un componente y además constantes rompe la recarga en caliente de
 * React, y trabajar sin ella se nota en cada guardado. Y otra de fondo, que
 * importa más: esto es la partitura, no el instrumento. Se puede leer, discutir
 * y comprobar entera sin montar nada ni mirar ninguna pantalla, que es justo lo
 * que hace falta para poder afinarla.
 */

export type EstadoMascota =
  | 'neutral'
  | 'feliz'
  | 'celebrando'
  | 'pensando'
  | 'animando'
  | 'escuchando'
  | 'triste'
  | 'sorprendido'
  | 'orgulloso'
  | 'durmiendo'
  | 'hablando';

/**
 * Los resortes, de lo más ligero a lo más pesado.
 *
 * La masa es el ajuste importante y el menos evidente: es la que reparte las
 * llegadas. La cola pesa más que el cuerpo a propósito, porque una cola no se
 * mueve sola, la arrastra el cuerpo y llega tarde. Eso, que en animación se
 * llama acción secundaria, aquí es un número.
 */
export const RESORTE = {
  cuerpo: { type: 'spring' as const, stiffness: 120, damping: 14, mass: 1.1 },
  /** Las dos alas llevan resortes distintos: sincronizadas parecen un mecanismo. */
  alaCercana: { type: 'spring' as const, stiffness: 190, damping: 11, mass: 0.55 },
  alaLejana: { type: 'spring' as const, stiffness: 150, damping: 12, mass: 0.75 },
  cabeza: { type: 'spring' as const, stiffness: 130, damping: 15, mass: 1 },
  /** La cola, la última en enterarse de todo. */
  cola: { type: 'spring' as const, stiffness: 70, damping: 11, mass: 1.5 },
  ojo: { type: 'spring' as const, stiffness: 300, damping: 20, mass: 0.5 },
  /** El párpado: rápido y sin rebote. Un parpadeo que rebota da susto. */
  parpado: { type: 'spring' as const, stiffness: 900, damping: 42, mass: 0.2 },
  boca: { type: 'spring' as const, stiffness: 520, damping: 22, mass: 0.35 },
  mirada: { type: 'spring' as const, stiffness: 260, damping: 22, mass: 0.4 },
};

/**
 * Una pose: dónde está cada parte en un instante.
 *
 * Son unidades del lienzo de 120x120 y grados. En las alas, positivo es hacia
 * abajo y negativo hacia arriba, igual en las dos aunque estén en lados
 * opuestos: así una pose se lee sin tener que traducir mentalmente.
 */
export interface Pose {
  /**
   * Cuánto DESPEGA del suelo. Negativo es hacia arriba.
   *
   * Es cero en casi todos, y no por descuido. La capa del cuerpo pivota en la
   * línea de las patas, así que al inflarse el pecho la figura ya crece hacia
   * arriba sola: un desplazamiento encima solo sirve para levantar también las
   * patas, y entonces el animal levita y se separa de su propia sombra, que en
   * el escaparate de la tienda está dibujada fija debajo.
   *
   * Así que esto lo usan solo los que de verdad se van del suelo: el salto de
   * celebrar, el respingo de la sorpresa y el botecito de estar contento.
   */
  y: number;
  /** El estiramiento, siempre asimétrico: al alargarse se estrecha. */
  eX: number;
  eY: number;
  /** Inclinación del cuerpo entero. */
  giro: number;
  /**
   * Las alas, en GRADOS HACIA ARRIBA. Positivo levanta, negativo deja caer.
   *
   * Es lo mismo para las dos aunque estén en lados opuestos: el esqueleto se
   * encarga de invertirle el signo a la de allá. Escrito «en crudo» había que
   * acordarse de que subir el ala izquierda es girar en un sentido y subir la
   * derecha en el contrario, y estuvo mal justo por eso: el saludo giraba la
   * punta HACIA DENTRO del cuerpo, donde no se ve.
   */
  alaCercana: number;
  alaLejana: number;
  /**
   * Cuánto se separa el ala del cuerpo, hacia fuera.
   *
   * Sin esto no hay saludo posible, y no es un problema de animación sino de
   * dibujo: el ala mide 24 unidades de ancho y el cuerpo la tapa entera menos
   * cuatro. Girándola sin moverla, lo único que se ve moverse es una astilla
   * pegada al costado. Apartándola primero, el ala sale del bulto del cuerpo y
   * ahí sí se lee un brazo levantado.
   *
   * Se resuelve aquí y no redibujando los cinco animales a propósito: el dibujo
   * en reposo está bien, es solo que un ala pegada al cuerpo no puede saludar.
   */
  fueraCercana?: number;
  fueraLejana?: number;
  /** Ladeo de la cabeza propio del estado, aparte del que hace por su cuenta. */
  cabeza: number;
  /** Cuánto abre los ojos. 1 es lo normal. */
  ojo: number;
  cola: number;
}

/**
 * Los once estados, cada uno con su pose de ida, su pose de vuelta y su ritmo.
 *
 * La pose A es siempre la «cargada» y la B la «soltada». Con eso, el gesto sale
 * anticipado sin escribir ninguna secuencia.
 */
/**
 * Un resorte más duro para lo que tiene que verse rápido.
 *
 * El del cuerpo tarda unos 630 ms en asentarse, y el salto de celebrar cambia de
 * pose cada 620: nunca llegaba a completarse, así que se veía blando y lento
 * aunque recorriera mucho. Un gesto seco necesita llegar ANTES de que le toque
 * volver, y eso no se arregla con más recorrido sino con más rigidez.
 */
const RESORTE_SECO = { type: 'spring' as const, stiffness: 420, damping: 17, mass: 0.8 };

export const GESTOS: Record<
  EstadoMascota,
  { a: Pose; b: Pose; ritmo: number; resorte?: typeof RESORTE_SECO }
> = {
  // Respirar y poco más. Es el estado en el que más tiempo se le ve, así que
  // aquí lo importante es que no canse: todo lo de abajo es mínimo a propósito.
  neutral: {
    a: {
      y: 0,
      eX: 1.02,
      eY: 0.978,
      giro: 0,
      alaCercana: -2,
      alaLejana: -2,
      cabeza: 0,
      ojo: 1,
      cola: 4,
    },
    b: {
      y: 0,
      eX: 0.985,
      eY: 1.03,
      giro: 0,
      alaCercana: 3,
      alaLejana: 3,
      cabeza: 0,
      ojo: 1,
      cola: -4,
    },
    ritmo: 1700,
  },
  // Contento: los ojos entornados, que es lo que de verdad distingue una
  // sonrisa de una boca abierta, y algo más de prisa.
  feliz: {
    a: {
      y: 0,
      eX: 1.015,
      eY: 0.985,
      giro: -1,
      alaCercana: 0,
      alaLejana: 0,
      cabeza: -2,
      ojo: 0.82,
      cola: 7,
    },
    b: {
      y: -2,
      eX: 0.98,
      eY: 1.035,
      giro: 1,
      alaCercana: 14,
      alaLejana: 10,
      cabeza: 2,
      ojo: 0.82,
      cola: -7,
    },
    ritmo: 1150,
  },
  // Celebrar: la pose A es el agachado. Ahí está la anticipación entera.
  celebrando: {
    a: {
      y: 4,
      eX: 1.08,
      eY: 0.9,
      giro: 0,
      alaCercana: -6,
      fueraCercana: 8,
      alaLejana: -6,
      fueraLejana: 8,
      cabeza: 4,
      ojo: 0.8,
      cola: 10,
    },
    b: {
      y: -14,
      eX: 0.94,
      eY: 1.09,
      giro: 0,
      alaCercana: 62,
      fueraCercana: 8,
      alaLejana: 54,
      fueraLejana: 8,
      cabeza: -6,
      ojo: 0.75,
      cola: -12,
    },
    ritmo: 620,
    resorte: RESORTE_SECO,
  },
  // Pensar es el único estado quieto de verdad. Aun así no se queda clavado:
  // un personaje absolutamente inmóvil se lee como una imagen rota.
  pensando: {
    a: {
      y: 0,
      eX: 1.005,
      eY: 0.995,
      giro: 0,
      alaCercana: 2,
      alaLejana: 2,
      cabeza: 8,
      ojo: 1,
      cola: 1,
    },
    b: {
      y: 0,
      eX: 0.998,
      eY: 1.008,
      giro: 0,
      alaCercana: 3,
      alaLejana: 3,
      cabeza: 9.5,
      ojo: 1,
      cola: -1,
    },
    ritmo: 2800,
  },
  // Animar: saluda con el ala de acá bien alta mientras el cuerpo acompaña.
  animando: {
    a: {
      y: 0,
      eX: 1.01,
      eY: 0.99,
      giro: -3,
      alaCercana: 44,
      fueraCercana: 13,
      alaLejana: 0,
      cabeza: -3,
      ojo: 1,
      cola: 6,
    },
    b: {
      y: 0,
      eX: 0.99,
      eY: 1.015,
      giro: 3,
      alaCercana: 96,
      fueraCercana: 13,
      alaLejana: 7,
      cabeza: 3,
      ojo: 1,
      cola: -6,
    },
    ritmo: 700,
    resorte: RESORTE_SECO,
  },
  // Escuchar: se inclina hacia quien habla y abre un poco más los ojos. El
  // pulso es corto, como el de alguien atento que no se mueve pero tampoco
  // está parado.
  escuchando: {
    a: {
      y: 0,
      eX: 1.012,
      eY: 0.992,
      giro: 0,
      alaCercana: 0,
      alaLejana: 0,
      cabeza: 3,
      ojo: 1.08,
      cola: 2,
    },
    b: {
      y: 0,
      eX: 0.988,
      eY: 1.022,
      giro: 0,
      alaCercana: 2,
      alaLejana: 2,
      cabeza: 5,
      ojo: 1.12,
      cola: -2,
    },
    ritmo: 900,
  },
  // Triste: se hunde, las alas caen y el ritmo se alarga. Lo que más lo vende
  // no es la postura sino la lentitud.
  triste: {
    a: {
      y: 0,
      eX: 1.03,
      eY: 0.965,
      giro: 0,
      alaCercana: -19,
      alaLejana: -17,
      cabeza: 10,
      ojo: 0.62,
      cola: 11,
    },
    b: {
      y: 0,
      eX: 1.038,
      eY: 0.955,
      giro: 0,
      alaCercana: -23,
      alaLejana: -21,
      cabeza: 12,
      ojo: 0.56,
      cola: 13,
    },
    ritmo: 2600,
  },
  // Sorpresa: un respingo hacia arriba y hacia atrás, con los ojos abiertos de
  // más. Se queda temblando un poco porque el resorte se pasa de largo.
  sorprendido: {
    a: {
      y: -6.5,
      eX: 0.95,
      eY: 1.075,
      giro: -2,
      alaCercana: 42,
      fueraCercana: 6,
      alaLejana: 38,
      fueraLejana: 6,
      cabeza: -5,
      ojo: 1.28,
      cola: -9,
    },
    b: {
      y: -3,
      eX: 0.985,
      eY: 1.03,
      giro: 1.5,
      alaCercana: 30,
      fueraCercana: 6,
      alaLejana: 26,
      fueraLejana: 6,
      cabeza: -2,
      ojo: 1.2,
      cola: 5,
    },
    ritmo: 900,
    resorte: RESORTE_SECO,
  },
  // Orgulloso: saca pecho, se echa hacia atrás y se pone el ala en jarras. El
  // ala de acá se queda quieta y la de allá sigue con el vaivén, que es lo que
  // evita que la pose parezca un maniquí.
  orgulloso: {
    a: {
      y: 0,
      eX: 1.028,
      eY: 1.022,
      giro: -2,
      alaCercana: -31,
      alaLejana: 2,
      cabeza: -4,
      ojo: 0.92,
      cola: 5,
    },
    b: {
      y: 0,
      eX: 1.05,
      eY: 1.005,
      giro: -3,
      alaCercana: -31,
      alaLejana: -5,
      cabeza: -6,
      ojo: 0.92,
      cola: -5,
    },
    ritmo: 1500,
  },
  // Dormir: la respiración más honda y más lenta de todas, y las alas
  // recogidas. Las dos caen: si solo cayera una, parecería que le pasa algo en
  // el hombro.
  durmiendo: {
    a: {
      y: 0,
      eX: 1.008,
      eY: 0.988,
      giro: 0,
      alaCercana: -11,
      alaLejana: -9,
      cabeza: 10,
      ojo: 1,
      cola: 1,
    },
    b: {
      y: 0,
      eX: 0.972,
      eY: 1.048,
      giro: 0,
      alaCercana: -9,
      alaLejana: -7,
      cabeza: 12,
      ojo: 1,
      cola: -1,
    },
    ritmo: 2400,
  },
  // Hablando: el cuerpo casi no hace nada porque el gesto está en la cara. Lo
  // poco que hace es lo que impide que parezca una cabeza sobre un palo.
  hablando: {
    a: {
      y: 0,
      eX: 1.012,
      eY: 0.99,
      giro: -1,
      alaCercana: -2,
      alaLejana: -1,
      cabeza: -1,
      ojo: 1,
      cola: 4,
    },
    b: {
      y: 0,
      eX: 0.988,
      eY: 1.022,
      giro: 1,
      alaCercana: 6,
      alaLejana: 4,
      cabeza: 2,
      ojo: 1,
      cola: -4,
    },
    ritmo: 1400,
  },
};

/**
 * Cuánto llega a abrir la boca según lo fuerte que suene la voz, de 0 a 1.
 *
 * Vive aparte del componente porque es una regla, no un movimiento, y porque es
 * lo único de todo el habla que se puede comprobar sin un navegador delante.
 *
 * El suelo de 0,3 no es capricho: un micrófono nunca lee cero en mitad de una
 * palabra, y una mandíbula que se para del todo a media frase no se lee como
 * silencio, se lee como que la aplicación se ha colgado. Sin valor devuelve 1,
 * que es el ciclo de siempre: una boca que espera datos no puede quedarse
 * quieta.
 */
export function aperturaDeVoz(intensidad?: number): number {
  if (intensidad === undefined) return 1;
  return 0.3 + 0.7 * Math.min(1, Math.max(0, intensidad));
}

/**
 * Los gestos sueltos: lo que hace cuando no hace nada.
 *
 * Un personaje que solo respira acaba leyéndose como una imagen con un efecto
 * encima. Lo que lo convierte en alguien que ESTÁ ahí es que de vez en cuando
 * haga algo que no venía a cuento: estirarse, sacudirse, mirar a los lados.
 * Duolingo lo hace y es la mitad de por qué sus personajes parecen vivos.
 *
 * Son secuencias cortas de poses sobre la pose de reposo del estado, así que no
 * hay que escribir una pose entera: solo lo que cambia. Y son raros a propósito
 * —uno cada tantos ciclos, elegido al azar— porque un tic que sale siempre a la
 * misma hora deja de ser un tic y pasa a ser parte del bucle.
 */
export interface PasoDeTic {
  /** Solo lo que cambia respecto a la pose de reposo. */
  pose: Partial<Pose>;
  /** Cuánto lo aguanta antes de pasar al siguiente. */
  aguanta: number;
}

export const TICS: Record<string, PasoDeTic[]> = {
  // Estirarse: las dos alas a tope, el cuerpo alto y los ojos entornados. Es el
  // más largo de los cuatro porque estirarse es justo aguantar.
  estirarse: [
    {
      pose: {
        alaCercana: 88,
        alaLejana: 84,
        fueraCercana: 10,
        fueraLejana: 10,
        eY: 1.07,
        eX: 0.95,
        cabeza: -8,
        ojo: 0.45,
      },
      aguanta: 700,
    },
    {
      pose: { alaCercana: 20, alaLejana: 16, eY: 0.97, eX: 1.03, cabeza: 2, ojo: 1 },
      aguanta: 420,
    },
  ],
  // Sacudirse: dos giros secos del cuerpo entero, como quien se quita el agua.
  sacudirse: [
    { pose: { giro: -7, cola: 14, alaCercana: 12, alaLejana: 10 }, aguanta: 130 },
    { pose: { giro: 7, cola: -14, alaCercana: -6, alaLejana: -4 }, aguanta: 130 },
    { pose: { giro: -5, cola: 10, alaCercana: 10, alaLejana: 8 }, aguanta: 130 },
    { pose: { giro: 0, cola: 0 }, aguanta: 260 },
  ],
  // Otear: mira a un lado, lo sostiene, y al otro. Sostenerlo es lo que lo
  // distingue de un vaivén: mirar es ir a un sitio y quedarse.
  otear: [
    { pose: { cabeza: -13, ojo: 1.06 }, aguanta: 620 },
    { pose: { cabeza: 14, ojo: 1.06 }, aguanta: 680 },
    { pose: { cabeza: 0, ojo: 1 }, aguanta: 340 },
  ],
  // Dos botes cortos. El agachado va delante, como en el salto de celebrar.
  botar: [
    { pose: { y: 3, eY: 0.94, eX: 1.05 }, aguanta: 120 },
    { pose: { y: -7, eY: 1.05, eX: 0.96, alaCercana: 26, alaLejana: 22 }, aguanta: 200 },
    { pose: { y: 2, eY: 0.96, eX: 1.03 }, aguanta: 130 },
    { pose: { y: -5, eY: 1.04, eX: 0.97, alaCercana: 18, alaLejana: 15 }, aguanta: 190 },
  ],
};

/**
 * En qué estados le está permitido distraerse.
 *
 * Solo en los tranquilos. Celebrando ya tiene bastante, y una mascota que se
 * pone a estirarse en mitad de una felicitación se lee como un fallo. Dormido
 * tampoco: quien duerme no otea.
 */
export const ESTADOS_CON_TICS: EstadoMascota[] = ['neutral', 'feliz', 'escuchando', 'pensando'];
