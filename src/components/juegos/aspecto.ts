import type { CodigoJuego } from './tipos';

/**
 * De qué color es cada juego.
 *
 * POR QUÉ NO ESTÁ EN `tipos.ts`
 *
 * Allí vive el contrato: qué juegos hay, qué entrenan, qué icono llevan. Eso lo
 * lee todo el mundo, incluida la pantalla final. Esto de aquí es solo cómo se
 * pinta el escaparate, y se separa para que cambiar un degradado no obligue a
 * tocar el archivo del que cuelgan los cuatro juegos.
 *
 * POR QUÉ CADA UNO TIENE SU COLOR
 *
 * En `tipos.ts` dos de los cuatro son del mismo morado, y con cuatro tarjetas
 * iguales de forma y casi iguales de color, la única forma de saber cuál es cuál
 * es leer el título. Un escaparate se mira, no se lee: si el naranja es la
 * velocidad y el verde son tus fallos, a la tercera visita ya se toca sin leer.
 *
 * Los tonos de texto van en pareja claro/oscuro y todos pasan de 4.5 sobre su
 * fondo. El color nunca va solo: el título y el «entrena qué» dicen lo mismo en
 * palabras.
 */
export interface AspectoDeJuego {
  /** El degradado de la placa del icono. */
  degradado: string;
  /** El borde de la tarjeta, del color del juego pero apagado. */
  borde: string;
  /** El fondo de la tira del récord. */
  tinte: string;
  /** El color del «entrena qué» y del número del récord. */
  texto: string;
  /**
   * El lavado de color de la esquina de la tarjeta.
   *
   * Aquí hubo un icono gigante al 6 % asomando por la esquina. Puesto se veía
   * bien; con el texto encima, no: un reloj traslúcido detrás de «Contrarreloj»
   * no es textura, es suciedad. El degradado hace el mismo trabajo —que la
   * tarjeta se lea como un cartel— sin meterse debajo de ninguna palabra.
   */
  lavado: string;
}

export const ASPECTOS: Record<CodigoJuego, AspectoDeJuego> = {
  CONTRARRELOJ: {
    degradado: 'from-orange-400 to-orange-600',
    borde: 'border-orange-200 dark:border-orange-900',
    tinte: 'bg-orange-50 dark:bg-orange-950/50',
    texto: 'text-orange-700 dark:text-orange-300',
    lavado: 'from-orange-50 dark:from-orange-950/60',
  },
  PAREJAS: {
    degradado: 'from-marca-400 to-marca-600',
    borde: 'border-marca-200 dark:border-marca-800',
    tinte: 'bg-marca-50 dark:bg-marca-900/50',
    texto: 'text-marca-700 dark:text-marca-300',
    lavado: 'from-marca-50 dark:from-marca-900/50',
  },
  CADENA: {
    degradado: 'from-emerald-400 to-emerald-600',
    borde: 'border-emerald-200 dark:border-emerald-900',
    tinte: 'bg-emerald-50 dark:bg-emerald-950/50',
    texto: 'text-emerald-700 dark:text-emerald-300',
    lavado: 'from-emerald-50 dark:from-emerald-950/60',
  },
  ESCUCHA: {
    degradado: 'from-sky-400 to-sky-600',
    borde: 'border-sky-200 dark:border-sky-900',
    tinte: 'bg-sky-50 dark:bg-sky-950/50',
    texto: 'text-sky-700 dark:text-sky-300',
    lavado: 'from-sky-50 dark:from-sky-950/60',
  },
  /*
    Verde azulado, y no el verde del acierto.

    En este juego el verde SIGNIFICA algo —letra en su sitio— y usar el mismo
    tono para la tarjeta lo gastaría antes de entrar. El teal se distingue del
    esmeralda de CADENA a simple vista y no choca con los tres colores que el
    tablero usa para hablar.
  */
  CINCO_LETRAS: {
    degradado: 'from-teal-400 to-teal-600',
    borde: 'border-teal-200 dark:border-teal-900',
    tinte: 'bg-teal-50 dark:bg-teal-950/50',
    texto: 'text-teal-700 dark:text-teal-300',
    lavado: 'from-teal-50 dark:from-teal-950/60',
  },
  /*
    Fucsia, y no el azul de lluvia que pedía el nombre.

    Escucha ya es azul cielo, y en un escaparate de tarjetas del mismo tamaño
    dos azules vecinos se tocan por error: se elige por color antes de leer el
    título, que es justo lo que dice el comentario de arriba. El agua la pone el
    icono y el fondo del propio juego; la tarjeta solo tiene que ser
    inconfundible.
  */
  CAEN: {
    degradado: 'from-fuchsia-400 to-fuchsia-600',
    borde: 'border-fuchsia-200 dark:border-fuchsia-900',
    tinte: 'bg-fuchsia-50 dark:bg-fuchsia-950/50',
    texto: 'text-fuchsia-700 dark:text-fuchsia-300',
    lavado: 'from-fuchsia-50 dark:from-fuchsia-950/60',
  },
  /*
    Rosa, que es el vecino incómodo del fucsia de CAEN y aun así el que toca.

    Los seis colores libres que quedaban o chocaban con un significado —el rojo
    es fallar, el ámbar es avisar, el esmeralda es acertar— o eran el mismo tono
    que otra tarjeta: el cian se confunde con el azul de ESCUCHA y el teal de
    CINCO_LETRAS, el violeta es el índigo de la marca. El rosa se distingue del
    fucsia por ser más cálido, y de propina dice lo que el juego hace: es el
    color de la señal de peligro sin ser el del error.
  */
  FALSOS_AMIGOS: {
    degradado: 'from-rose-400 to-rose-600',
    borde: 'border-rose-200 dark:border-rose-900',
    tinte: 'bg-rose-50 dark:bg-rose-950/50',
    texto: 'text-rose-700 dark:text-rose-300',
    lavado: 'from-rose-50 dark:from-rose-950/60',
  },
  /*
    Índigo, que es el hueco que quedaba.

    Ya hay un morado de marca (PAREJAS), un azul cielo (ESCUCHA) y un fucsia
    (CAEN), y el índigo se distingue de los tres puesto al lado. Dentro del
    juego el color no significa nada: allí el verde y el rojo son el acierto y
    el fallo, y la barra que se vacía va de la marca al aviso.
  */
  PARTICULAS: {
    degradado: 'from-indigo-400 to-indigo-600',
    borde: 'border-indigo-200 dark:border-indigo-900',
    tinte: 'bg-indigo-50 dark:bg-indigo-950/50',
    texto: 'text-indigo-700 dark:text-indigo-300',
    lavado: 'from-indigo-50 dark:from-indigo-950/60',
  },
  /*
    Acero, y es el único sin color de todo el escaparate.

    Los colores que quedaban libres o significan algo —el rojo es fallar, el
    ámbar es avisar, el esmeralda es acertar— o eran el vecino de alguien: el
    cian se confunde con el azul de ESCUCHA y el teal de CINCO_LETRAS, igual que
    ya se dijo al elegir el de FALSOS_AMIGOS. Pero aquí el gris no es lo que
    sobraba: es lo que toca. Entre ocho tarjetas de colores vivos, la de las
    máquinas se reconoce por ser la única que no lo es, y la sirena roja del
    icono pone todo el aviso que hace falta.

    El degradado va oscuro a propósito. Con `slate-300/500` la tarjeta se leía
    como un botón desactivado, que es lo último que puede parecer un juego.
  */
  BRECHA: {
    degradado: 'from-slate-600 to-slate-900',
    borde: 'border-slate-300 dark:border-slate-700',
    tinte: 'bg-slate-100 dark:bg-slate-800/60',
    texto: 'text-slate-700 dark:text-slate-300',
    lavado: 'from-slate-100 dark:from-slate-800/60',
  },
  /*
    Ámbar oscuro, y es el hueco que quedaba con dos pegas que conviene decir en
    voz alta.

    La primera: el ámbar es el vecino del naranja de CONTRARRELOJ. Se separa
    bajando el degradado a 500-700 —el de CONTRARRELOJ va de 400 a 600— así que
    una tarjeta sale clara y la otra tostada, y puestas al lado no se confunden.
    La segunda: en el resto de la aplicación el ámbar es el color de AVISAR.
    Dentro del juego eso no estorba, porque ahí el ámbar no señala nada: el
    verde es el acierto, el rojo el fallo y los sellos de reputación van en su
    propio tono.

    Se elige igualmente porque de lo que quedaba libre es lo único que dice algo
    del juego —luz de farol, latón, madera de puesto— y porque el gris neutro,
    que era la alternativa sin significado, ya se lo llevó BRECHA.
  */
  /*
    Cian y fucsia a la vez, y es la única tarjeta con dos tonos.

    El cian solo no valía: está entre el azul cielo de ESCUCHA y el verde
    azulado de CINCO_LETRAS, y puestas las tres en fila se eligen por error, que
    es justo lo que este archivo existe para evitar. Pero el cian es EL color de
    este juego —es el del neón— y renunciar a él por un vecino habría dejado la
    tarjeta sin decir nada.

    La salida es que la placa del icono vaya de cian a fucsia. Ninguna otra de
    las diez cruza dos tonos, así que se reconoce por la forma del degradado
    antes que por el color, y de paso es exactamente lo que se ve en un cartel
    de neón de noche. El borde, el tinte y el texto se quedan en cian solo,
    porque ahí lo que hace falta es contraste y no identidad.
  */
  NEON: {
    degradado: 'from-cyan-400 to-fuchsia-600',
    borde: 'border-cyan-200 dark:border-cyan-900',
    tinte: 'bg-cyan-50 dark:bg-cyan-950/50',
    texto: 'text-cyan-700 dark:text-cyan-300',
    lavado: 'from-cyan-50 dark:from-cyan-950/60',
  },
  /*
    Lima, y es el último hueco que quedaba con una pega que conviene reconocer.

    La pega es que es un verde, y en esta aplicación el verde SIGNIFICA algo:
    acertado. Se elige igualmente por dos motivos. El primero, que el verde del
    acierto es esmeralda (#10b981) y este es lima (#a3e635), que es
    amarillo-verde: puestos al lado no se confunden, y en el escaparate el lima
    no compite con ninguna otra tarjeta. El segundo, que dice algo del juego:
    es el color de una pantalla de neón encendida, que es exactamente lo que
    hay dentro.

    Lo que se descartó y por qué: el violeta y el morado son vecinos del índigo
    de PARTICULAS y del morado de marca de PAREJAS; el rojo es fallar y el
    ámbar es avisar; el gris ya se lo llevó BRECHA y el cian NEON.
  */
  BEAT: {
    degradado: 'from-lime-400 to-lime-600',
    borde: 'border-lime-200 dark:border-lime-900',
    tinte: 'bg-lime-50 dark:bg-lime-950/50',
    texto: 'text-lime-700 dark:text-lime-300',
    lavado: 'from-lime-50 dark:from-lime-950/60',
  },
  /*
    Violeta, que es el color de Milo.

    En las otras diez tarjetas el color es del juego; en esta es del que corre,
    y eso es lo que hay que reconocer sin leer: es la única en la que la mascota
    de la aplicación ES el personaje. Se separa del morado de marca de PAREJAS
    por ser más frío y del índigo de PARTICULAS por ser más rojo; puestos los
    tres en fila se distinguen, que es lo único que este archivo pide.
  */
  CARRERA: {
    degradado: 'from-violet-400 to-violet-700',
    borde: 'border-violet-200 dark:border-violet-900',
    tinte: 'bg-violet-50 dark:bg-violet-950/50',
    texto: 'text-violet-700 dark:text-violet-300',
    lavado: 'from-violet-50 dark:from-violet-950/60',
  },
  MERCADO: {
    degradado: 'from-amber-500 to-amber-700',
    borde: 'border-amber-200 dark:border-amber-900',
    tinte: 'bg-amber-50 dark:bg-amber-950/50',
    texto: 'text-amber-700 dark:text-amber-300',
    lavado: 'from-amber-50 dark:from-amber-950/60',
  },
};
