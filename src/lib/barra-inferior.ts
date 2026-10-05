/**
 * Qué hay en la barra de abajo y dónde sale.
 *
 * Vive aparte del componente a propósito: es una decisión de navegación —qué
 * cinco sitios son los importantes y en qué pantallas estorban— y la toman
 * también `App.tsx`, que reserva el hueco, y las pruebas. Metida dentro del
 * .tsx obligaba a importar React para preguntar algo que es una lista y una
 * expresión regular.
 */

import { type ClaveIconoDoble } from '@/components/iconos';

export interface Destino {
  /**
   * El nombre del dibujo, no el dibujo.
   *
   * Este archivo se lee y se prueba sin montar nada, que es la razón de que
   * viva fuera del componente, y un componente de React importado aquí dentro
   * tiraría esa propiedad por la borda. La barra resuelve el nombre contra
   * `components/iconos` en el momento de pintar, que es donde toca.
   */
  icono: ClaveIconoDoble;
  etiqueta: string;
  a: string;
  /**
   * Qué otras pantallas «pertenecen» a este destino.
   *
   * Sin esto, al entrar en los ajustes o en una guía la barra se quedaría sin
   * ningún botón marcado, y quien usa lector de pantalla perdería la única
   * señal de dónde está. Las pantallas de dentro iluminan la sección de la que
   * cuelgan, que es de donde se llegó a ellas.
   */
  dentro?: RegExp;
}

/**
 * Los cinco sitios a los que se vuelve.
 *
 * Son cinco y no seis porque el ancho manda: a 320 px —el móvil más estrecho
 * que sigue vivo— cinco botones salen a 64 px cada uno, y seis a 53, por debajo
 * de los 44 px que pide cualquier guía de accesibilidad una vez descontado el
 * aire entre uno y otro. Todo lo demás cuelga de estos cinco.
 */
export const DESTINOS: readonly Destino[] = [
  {
    icono: 'libro',
    etiqueta: 'Aprender',
    a: '/ruta',
    dentro: /^\/(leccion|guia|examen|repaso|misiones|lecturas)\b/,
  },
  { icono: 'mando', etiqueta: 'Juegos', a: '/juegos' },
  { icono: 'copa', etiqueta: 'Liga', a: '/liga', dentro: /^\/novedades$/ },
  { icono: 'bolsa', etiqueta: 'Tienda', a: '/tienda' },
  {
    icono: 'persona',
    etiqueta: 'Perfil',
    a: '/perfil',
    dentro: /^\/(menu|ajustes|seguridad)$/,
  },
];

/**
 * Dónde NO sale la barra, y por qué.
 *
 * La regla no es «pantallas feas»: es que en todas estas hay algo empezado que
 * se pierde al salir. Una barra fija debajo de un ejercicio es un botón de
 * abandonar a un dedo de distancia del de responder, y se acaba pulsando sin
 * querer. Lo que se deja a medias aquí cuesta de verdad: una grabación, un
 * examen que no se repite, una llamada con el micro abierto, una cola de
 * repaso.
 *
 * El otro grupo son las pantallas de antes de empezar —entrar, elegir nivel,
 * la prueba de nivel— donde la mitad de los cinco destinos todavía no tiene
 * datos que enseñar, y los bancos de pruebas, que no son producto.
 */
const SIN_BARRA: readonly RegExp[] = [
  // Nadie ha entrado todavía: no hay perfil, ni liga, ni monedas.
  /^\/$/,
  /^\/recuperar$/,
  // El alta: tres pasos encadenados que dejan el nivel a medio elegir si se
  // sale por el medio, y la ruta vacía al volver.
  /^\/empezar$/,
  /^\/nivel$/,
  /^\/prueba$/,
  // Con algo empezado que se pierde al salir.
  /^\/leccion\//,
  /^\/examen$/,
  /^\/repaso$/,
  /^\/llamada$/,
  /*
    Imitar el ritmo. Es el caso de libro: hay un micrófono abierto y una
    grabación a medias, y una barra fija pondría el botón de irse a un dedo del
    de grabar. Lleva su propia salida arriba.
  */
  /^\/imitar$/,
  /^\/conversar$/,
  // Una partida con reloj. El catálogo (/juegos) sí lleva barra.
  /^\/juegos\/.+/,
  /*
    El lector de un texto. Además de ser lectura seguida, su panel de palabra
    es otra lámina fija pegada abajo: dos barras en el mismo sitio acaban con
    una tapando a la otra.
  */
  /^\/lecturas\/.+/,
  // Bancos de pruebas, no pantallas del producto.
  /^\/vivo$/,
  /^\/shadowing$/,
  /^\/escritura$/,
];

/** Lo que mide la fila de botones. La zona pulsable de cada uno es este alto. */
export const ALTO_BARRA = '3.5rem';

/** La línea que separa la barra del contenido. */
export const BORDE_BARRA = '2px';

/**
 * Lo que el contenido reserva por debajo.
 *
 * Sale de los dos de arriba y no es un número escrito aparte: midiendo en el
 * navegador se vio que la barra ocupa 58 px y no 56, porque el borde de arriba
 * también pinta. Reservando 56 el último botón de una pantalla se quedaba dos
 * píxeles por debajo de esa línea. Derivado, eso no puede volver a pasar.
 *
 * No se le suma `env(safe-area-inset-bottom)` a propósito: el `body`
 * (index.css) ya se aparta el hueco del iPhone por los cuatro lados, así que el
 * contenido termina por encima de él y lo único que falta descontar es la barra.
 * La barra sí se lo suma por su cuenta, porque al ser fija se salta ese relleno.
 */
export const HUECO_BARRA = `calc(${ALTO_BARRA} + ${BORDE_BARRA})`;

/** Si esta dirección lleva barra. La misma respuesta decide la barra y el hueco. */
export function hayBarraEn(ruta: string): boolean {
  return !SIN_BARRA.some((patron) => patron.test(ruta));
}

/**
 * Si esta pantalla «pertenece» a uno de los cinco y hay que marcarlo: la raíz
 * de la sección, o cualquiera de las que cuelgan de ella.
 */
export function esElDestinoActual(destino: Destino, ruta: string): boolean {
  return ruta === destino.a || (destino.dentro?.test(ruta) ?? false);
}
