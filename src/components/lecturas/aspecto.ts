import type { EstadoPalabra } from '@/lib/lecturas';

/**
 * De qué color va cada palabra, y por qué de ese y no de otro.
 *
 *
 * EL PROBLEMA QUE RESUELVE ESTA PALETA
 *
 * Pintar el texto entero por estado es lo que hace que esto enganche: el
 * progreso no está en una barra aparte, está en el artículo. Pero tiene una
 * trampa que se ve en cuanto pegas tu primer texto: un artículo recién traído
 * tiene el 100 % de palabras sin marcar. Si «sin marcar» se pinta de rojo, lo
 * primero que ves al traer algo tuyo es un examen suspendido de arriba abajo, y
 * eso no invita a leer, invita a cerrar.
 *
 * Y aquí el rojo ya significa algo: en el resto de la aplicación es fallar
 * (`--color-fallo`, el botón de corregir, el temblor de Milo). El verde es
 * acertar. Usar esos dos para «no la conozco» y «la conozco» sería decirle a
 * alguien que no saber una palabra que nunca ha visto es un error suyo.
 *
 *
 * LA DECISIÓN
 *
 * El eje no es acierto/fallo, es RUIDO. Cuanto más sabes, más callado está el
 * texto:
 *
 *   nueva        fondo ámbar, como un rotulador          ← lo único que grita
 *   aprendiendo  subrayado índigo, sin fondo             ← a medias
 *   sabida       nada de nada, texto normal              ← invisible
 *   ignorada     subrayado de puntos, muy flojo          ← fuera de juego
 *
 * Leer el artículo con todo en ámbar se parece a un libro de texto subrayado
 * —una postura de estudiar—, no a un examen corregido. Y el premio es que el
 * color se VA: la sensación de avanzar es que el texto se calma y acaba
 * pareciendo un artículo normal. Eso es exactamente lo que está pasando.
 *
 *
 * NO SOLO COLOR
 *
 * Los cuatro estados se distinguen por FORMA además de por tono: fondo relleno,
 * línea continua, nada, línea de puntos. Quien no separa el ámbar del índigo los
 * sigue separando, y quien lee en blanco y negro también.
 *
 *
 * LA REGLA QUE NO SE PUEDE ROMPER
 *
 * Los cuatro miden EXACTAMENTE lo mismo. Todos llevan `border-b-2`, aunque tres
 * de ellos lo lleven transparente o de puntos, y ninguno cambia de grosor ni de
 * relleno. Si un estado midiera un píxel más que otro, marcar una palabra
 * recolocaría el párrafo entero y el renglón por el que ibas saltaría de sitio
 * justo en el momento de tocar. Esa es la mitad invisible de «marcar sin perder
 * dónde ibas»: la otra mitad está en `desplazamientoParaVer`.
 */
export interface Aspecto {
  /** Cómo se pinta la palabra. Va en el `span` de dentro, no en el botón. */
  clase: string;
  /** Cómo se llama, para la leyenda y para quien lo oye en vez de verlo. */
  nombre: string;
  /** Lo que pone el botón del panel. */
  accion: string;
  /** Una línea explicando para qué sirve marcarla así. */
  pista: string;
  /** El punto de color de la leyenda y de los botones. */
  punto: string;
}

export const ASPECTO: Record<EstadoPalabra, Aspecto> = {
  nueva: {
    /*
      Un TRAZO, no un recuadro. Relleno entero, la palabra salía como una
      ficha de color de veintidós píxeles de alto, y un artículo con el 75 %
      de palabras sin marcar se veía como un tablero de fichas en vez de
      como un texto. En oscuro era peor todavía: el ámbar translúcido sobre
      el azul marino da un marrón que destaca más que el propio texto.

      El degradado pinta solo los 0,72 em de abajo, que es por donde pasa un
      rotulador de verdad: se ve igual de bien de un vistazo y se sigue
      leyendo la frase, porque la mitad de arriba de la letra queda limpia.
    */
    clase:
      'bg-[linear-gradient(to_top,rgba(251,191,36,0.6)_0_0.72em,transparent_0.72em)] ' +
      'dark:bg-[linear-gradient(to_top,rgba(251,191,36,0.38)_0_0.72em,transparent_0.72em)]',
    nombre: 'por descubrir',
    accion: 'No la conozco',
    pista: 'Se queda marcada y entra en el repaso espaciado.',
    punto: 'bg-acento-300 dark:bg-acento-500',
  },
  aprendiendo: {
    clase: 'border-b-2 border-marca-500 dark:border-marca-400',
    nombre: 'en marcha',
    accion: 'Me suena',
    pista: 'La has visto antes pero todavía no te sale sola.',
    punto: 'bg-marca-500 dark:bg-marca-400',
  },
  sabida: {
    clase: '',
    nombre: 'sabida',
    accion: 'Ya la sé',
    pista: 'Deja de marcarse en todos tus textos.',
    punto: 'bg-[var(--borde)] border border-[var(--texto-suave)]/40',
  },
  ignorada: {
    clase: 'border-b-2 border-dotted border-slate-400/70 dark:border-slate-500/70',
    nombre: 'fuera',
    accion: 'No me interesa',
    pista: 'Nombres propios, marcas, siglas: no cuentan como vocabulario.',
    punto: 'bg-transparent border border-dashed border-[var(--texto-suave)]/70',
  },
};

/** El orden en que salen los cuatro botones: de no saberla a descartarla. */
export const ORDEN: readonly EstadoPalabra[] = ['nueva', 'aprendiendo', 'sabida', 'ignorada'];

/**
 * Lo común a toda palabra tocable: SOLO el punto de toque.
 *
 * El relleno vertical es lo que convierte una línea de texto de diecisiete
 * píxeles en un botón de cuarenta y siete, que es lo que hace falta para que un
 * pulgar acierte. Va en el relleno y no en `line-height` porque el relleno sí
 * cuenta como superficie pulsable y el interlineado no: una palabra con mucho
 * aire alrededor pero caja de veinte píxeles se falla igual.
 *
 * Y AQUÍ NO HAY NI UN COLOR, que es lo que se aprendió mirando las capturas.
 *
 * Con el color pintado sobre esta caja, cada palabra por descubrir salía como un
 * rectángulo amarillo de cuarenta y siete píxeles de alto separado del siguiente
 * por un canal blanco. Un artículo entero así no parece un texto subrayado:
 * parece un tablero de fichas, y encima de uno amarillo. Se deja de leer la
 * frase y se empiezan a ver cajas.
 *
 * Por eso el color vive en un `span` de dentro (`CLASE_MARCA`), que es en línea
 * y por tanto se ciñe a las letras. Lo que se ve es un trazo de rotulador sobre
 * la palabra, con el texto respirando alrededor, y el punto de toque sigue
 * midiendo los mismos cuarenta y siete píxeles porque no ha cambiado.
 *
 * De regalo, la regla de «todos los estados miden igual» deja de depender de mi
 * cuidado: el relleno y el borde vertical de un elemento EN LÍNEA no cuentan
 * para la altura del renglón, así que ningún estado puede recolocar el párrafo
 * aunque alguien añada uno mañana.
 *
 * `inline-block` en el botón es a propósito: impide que una palabra se parta por
 * la mitad al final del renglón. `break-words` es la excepción para el caso raro
 * —una URL pegada de cuarenta caracteres— donde partir es mejor que desbordar la
 * pantalla a lo ancho.
 */
export const CLASE_PALABRA =
  'inline-block max-w-full break-words rounded-[4px] py-[0.6rem] leading-[1.5] ' +
  'align-baseline touch-manipulation';

/**
 * La marca de color, ceñida a las letras.
 *
 * El relleno lateral va con un margen negativo del mismo tamaño, y eso es lo que
 * arregla un defecto que solo se vio en las capturas: con relleno a secas, cada
 * palabra ocupaba cuatro píxeles más de los que pinta y el texto salía «the way
 * . By», con un hueco antes de cada punto y de cada coma. En un artículo entero
 * eso se lee como si la puntuación estuviera suelta. Con el margen negativo el
 * color se sale de la palabra pero la CAJA mide lo que miden las letras, así que
 * el punto vuelve a pegarse a su palabra.
 *
 * `box-decoration-clone` mantiene la marca entera cuando una palabra con guion
 * se parte entre dos renglones.
 */
export const CLASE_MARCA = 'box-decoration-clone rounded-[3px] px-[2px] py-[1px] mx-[-2px]';
