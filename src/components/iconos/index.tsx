import { type ReactNode } from 'react';

/**
 * EL JUEGO DE ICONOS DE SPEAKMI
 *
 * POR QUÉ DIBUJADOS Y NO EMOJIS
 *
 * Un emoji no lo dibuja la aplicación: lo dibuja el sistema operativo. El mismo
 * 🏆 es plano en Android, brillante y con perspectiva en iPhone, y otra cosa en
 * Windows; cambia de tamaño real, de peso y de color sin que aquí se pueda
 * hacer nada. Eso significa que la aplicación se ve distinta en cada teléfono y
 * no controla su propia cara. Y al lado de nueve personajes dibujados a mano, un
 * emoji de Apple se lee como pegado de otro sitio.
 *
 * POR QUÉ PROPIOS Y NO UNA LIBRERÍA
 *
 * Feather y Material son correctos y neutros. El problema es justo ese: neutro
 * al lado de estos personajes significa «comprado». La geometría de la casa está
 * en `mascotas/gato.tsx` y `mascotas/zorro.tsx` —esquinas blandas, formas
 * llenas, nada de filigrana— y estos doce y pico dibujos la siguen.
 *
 * LAS CUATRO REGLAS QUE LOS HACEN UNA FAMILIA
 *
 * 1. Rejilla de 24×24. Todo se dibuja ahí y se escala desde ahí; a ese tamaño
 *    el trazo mide 2 px justos, que es donde se afinaron.
 * 2. Trazo de 2, puntas y uniones redondas. Es lo ÚNICO que hace que una copa,
 *    un bocadillo y una llama parezcan hermanos. Ni un icono lo cambia.
 * 3. `currentColor` siempre. Heredan el tono de donde estén, así que funcionan
 *    en claro y en oscuro sin dibujarlos dos veces. Ni un color escrito a mano.
 * 4. Sin sombras. A 24 px una sombra es suciedad. La profundidad de esta app
 *    vive en el relieve de los botones (`boton-3d`), no en los iconos.
 *
 * LÍNEA CUANDO NO ESTÁS, RELLENO CUANDO SÍ
 *
 * Los cinco de la barra de abajo llevan `relleno`. Es cómo se dice «estás aquí»
 * sin depender del color, que es lo que necesita quien no distingue bien los
 * tonos: el icono engorda, y eso se ve en gris, en morado y en blanco y negro.
 *
 * El relleno es el MISMO trazado con `fill`, no un segundo dibujo: así los dos
 * estados no pueden separarse el día que alguien retoque la silueta. Lo que no
 * sobrevive al relleno —la cruceta del mando, el lomo del libro— es detalle
 * interior, y desaparecer dentro de una silueta maciza es lo que tiene que
 * pasarle. Lo que sí tiene que sobrevivir —el asa de la bolsa, las asas de la
 * copa— se dibujó FUERA del cuerpo a propósito, para que el relleno no se lo
 * coma.
 *
 * CÓMO SE NOMBRAN
 *
 * En español y por lo que son, no por dónde se usan: `copa` y no `liga`, porque
 * la copa también sale en el examen del nivel y en el récord de un juego. El
 * mapa de «qué icono va en cada sitio» vive donde se usa.
 */

export interface PropsIcono {
  /**
   * Lo que mide de lado, en píxeles. 24 es la rejilla en la que están dibujados.
   *
   * Es un número y no una clase de ancho porque un SVG sin `width` se estira
   * hasta llenar a su padre, y dentro de un botón flexible eso acaba en un
   * icono de 300 px la primera vez que alguien olvida la clase.
   */
  tamano?: number;
  className?: string;
  /**
   * Lo que oye quien no ve el icono.
   *
   * Sin etiqueta el icono es decorativo y se esconde del lector de pantalla,
   * que es lo correcto cuando al lado hay texto que ya lo dice. CON etiqueta
   * pasa a ser una imagen con nombre, y eso solo hace falta cuando el icono es
   * lo único que hay dentro de un botón.
   */
  etiqueta?: string;
}

/** Los cinco de la barra, que además de línea tienen versión rellena. */
export interface PropsIconoDoble extends PropsIcono {
  relleno?: boolean;
}

/**
 * El lienzo común.
 *
 * Aquí viven las cuatro reglas de la familia, en un solo sitio: si el trazo
 * cambia, cambia en los veintiocho a la vez. Un icono que trae su propio
 * `strokeWidth` es un icono que se despega del resto sin que nadie lo note.
 */
function Lienzo({
  tamano = 24,
  className,
  etiqueta,
  children,
}: PropsIcono & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      /*
        Decorativo por defecto, imagen con nombre cuando se le da etiqueta. Lo
        de en medio —un SVG sin `aria-hidden` y sin nombre— es lo único que no
        puede pasar: algunos lectores lo anuncian como «imagen» a secas y
        meten un ruido vacío entre el texto.
      */
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
      // En IE/Edge viejos un SVG entraba en el orden del tabulador. No cuesta
      // nada y evita que el tabulador pare en un dibujo que no hace nada.
      focusable={false}
      className={className}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------------- *
 * LOS CINCO DE LA BARRA
 * ------------------------------------------------------------------------- */

/**
 * Libro abierto. Aprender, las lecciones hechas y las de vocabulario.
 *
 * Las dos hojas son un solo contorno con una uve en el centro arriba y un pico
 * abajo: eso es lo que hace que la silueta maciza siga siendo un libro y no un
 * rectángulo. El lomo va aparte porque es una línea interior y desaparece al
 * rellenar, que es lo que tiene que hacer.
 */
export function Libro({ relleno, ...props }: PropsIconoDoble) {
  return (
    <Lienzo {...props}>
      <path
        fill={relleno ? 'currentColor' : 'none'}
        d="M12 7.6C10.2 6 7.7 5.3 4.9 5.5A1.3 1.3 0 0 0 3.7 6.8v9.9a1.3 1.3 0 0 0 1.4 1.3c2.7-.2 5 .4 6.9 1.8 1.9-1.4 4.2-2 6.9-1.8a1.3 1.3 0 0 0 1.4-1.3V6.8a1.3 1.3 0 0 0-1.2-1.3c-2.8-.2-5.3.5-7.1 2.1Z"
      />
      <path d="M12 7.6v12.2" />
    </Lienzo>
  );
}

/**
 * Mando. Los juegos.
 *
 * Los dos cuernos de abajo son lo que lo identifica de lejos; la cruceta y los
 * botones son adorno de cerca. Por eso el cuerpo lleva el peso del dibujo: a
 * 24 px la silueta ya dice «mando» antes de que se vea nada de dentro.
 */
export function Mando({ relleno, ...props }: PropsIconoDoble) {
  return (
    <Lienzo {...props}>
      <path
        fill={relleno ? 'currentColor' : 'none'}
        d="M8.4 8.6h7.2a5.6 5.6 0 0 1 5.5 4.6l.5 3a2.8 2.8 0 0 1-5 2.2l-1.4-1.9H8.8l-1.4 1.9a2.8 2.8 0 0 1-5-2.2l.5-3a5.6 5.6 0 0 1 5.5-4.6Z"
      />
      {/* La cruceta y los dos botones, en los sitios de siempre: izquierda se
          mueve, derecha se actúa. Es un dibujo, pero es el dibujo correcto. */}
      <path d="M7.4 11.9v2.8M6 13.3h2.8" />
      <path d="M15.6 12.4h0M17.8 14.4h0" />
    </Lienzo>
  );
}

/**
 * Copa. La liga, el examen del nivel y el récord de un juego.
 *
 * COPA Y BOLSA SON LOS DOS PREMIOS DE LA APP Y NO PUEDEN PARECERSE.
 *
 * Se separan por tres sitios a la vez, no por uno:
 *   - la copa se ENSANCHA arriba y acaba en punta abajo; la bolsa al revés;
 *   - la copa tiene DOS asas, una a cada lado, a media altura; la bolsa UNA,
 *     arriba y en arco;
 *   - la copa se apoya en una base ancha; la bolsa no tiene pie.
 *
 * Con un solo rasgo distinto se confundirían a 24 px. Con tres, no.
 *
 * Las asas se dibujan por FUERA del cáliz para que el relleno no se las coma:
 * rellena, la copa sigue teniendo dos orejas.
 */
export function Copa({ relleno, ...props }: PropsIconoDoble) {
  return (
    <Lienzo {...props}>
      <path fill={relleno ? 'currentColor' : 'none'} d="M6.8 4h10.4v5.3a5.2 5.2 0 0 1-10.4 0Z" />
      <path d="M6.8 5.6H4.5a2.7 2.7 0 0 0 2.4 3M17.2 5.6h2.3a2.7 2.7 0 0 1-2.4 3" />
      <path d="M12 14.5v6.1M8 20.6h8" />
    </Lienzo>
  );
}

/**
 * Bolsa de la compra. La tienda.
 *
 * El asa va por encima del borde del cuerpo a propósito: ahí el relleno no la
 * alcanza, así que la bolsa rellena sigue teniendo asa y no se queda en un
 * trapecio macizo, que es lo que la haría confundirse con cualquier cosa.
 */
export function Bolsa({ relleno, ...props }: PropsIconoDoble) {
  return (
    <Lienzo {...props}>
      <path
        fill={relleno ? 'currentColor' : 'none'}
        d="M5 8.6h14l1 10.3a1.6 1.6 0 0 1-1.6 1.8H5.6A1.6 1.6 0 0 1 4 18.9Z"
      />
      <path d="M8.7 8.6V6.7a3.3 3.3 0 0 1 6.6 0v1.9" />
    </Lienzo>
  );
}

/**
 * Persona. El perfil.
 *
 * Los hombros son un arco ABIERTO con relleno: el navegador rellena un trazado
 * sin cerrar como si lo estuviera, pero no pinta el lado que falta. Así sale
 * medio óvalo macizo sin una raya recta debajo, que es lo que haría parecer
 * que la persona está metida en una caja.
 */
export function Persona({ relleno, ...props }: PropsIconoDoble) {
  const cuerpo = relleno ? 'currentColor' : 'none';
  return (
    <Lienzo {...props}>
      <circle cx="12" cy="7.9" r="3.7" fill={cuerpo} />
      <path fill={cuerpo} d="M4.6 20.4a7.4 7 0 0 1 14.8 0" />
    </Lienzo>
  );
}

/* ------------------------------------------------------------------------- *
 * LA PORTADA: LAS TRES ACCIONES Y LAS CUATRO CIFRAS
 * ------------------------------------------------------------------------- */

/**
 * Flecha en círculo. Repasar.
 *
 * REPASAR Y LECCIONES ERAN EL OTRO PAR PELIGROSO: los dos hablan de lecciones.
 * Se separan por la forma y no por el detalle: una es redonda y abierta, la
 * otra es rectangular y cerrada. A 24 px eso se distingue de reojo.
 *
 * El hueco del círculo va arriba a la derecha porque es donde cae la chapa del
 * número de repasos pendientes en la portada: la chapa se apoya en el hueco en
 * vez de taparle una punta a la flecha.
 */
export function Repasar(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M19.6 14.7a8 8 0 1 1-1.9-8.3L20.8 9.6" />
      <path d="M20.8 4.4v5.2h-5.2" />
    </Lienzo>
  );
}

/** Auricular de teléfono. Llamar a la mascota. */
export function Telefono(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M5.9 3.2h2.9a1.5 1.5 0 0 1 1.5 1.3l.5 2.8a1.5 1.5 0 0 1-.8 1.6l-1.7.8a11.6 11.6 0 0 0 5.5 5.5l.8-1.7a1.5 1.5 0 0 1 1.6-.8l2.8.5a1.5 1.5 0 0 1 1.3 1.5v2.9a2.1 2.1 0 0 1-2.3 2.1C10.2 19 5 13.8 3.8 5.5a2.1 2.1 0 0 1 2.1-2.3Z" />
    </Lienzo>
  );
}

/** Bocadillo. Escribir, y las lecciones de conversación. */
export function Bocadillo(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M4.4 4.6h15.2a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2H9.9l-4.4 3.4v-3.4H4.4a2 2 0 0 1-2-2V6.6a2 2 0 0 1 2-2Z" />
    </Lienzo>
  );
}

/**
 * Llama. La racha.
 *
 * Dos contornos, uno dentro de otro. Con uno solo, a 24 px la llama se lee como
 * una gota; la segunda lengua es lo que la convierte en fuego. Es el único
 * icono del juego con detalle interior, y se lo gana: la racha es el número que
 * más se mira de la aplicación.
 */
export function Llama(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M13.6 2.4c0 3.3-2.4 4-4.1 6.2a6.3 6.3 0 1 0 9 1.6c-1.3-2.6-3.3-5.1-4.9-7.8Z" />
      <path d="M12 19.6a2.9 2.9 0 0 1-2.9-2.9c0-1.7 1.3-2.4 2.9-4.5 1.6 2.1 2.9 2.8 2.9 4.5a2.9 2.9 0 0 1-2.9 2.9Z" />
    </Lienzo>
  );
}

/** Estrella de cinco puntas. La experiencia. */
export function Estrella(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="m12 3.1 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9Z" />
    </Lienzo>
  );
}

/**
 * Dos monedas, una encima de otra. La cartera.
 *
 * El primer intento fueron dos círculos concéntricos —el canto y el relieve— y
 * era un error: eso no es una moneda, es una diana. Se vio en la tira a tamaño
 * real, con los dos iconos uno al lado del otro.
 *
 * Dos discos DESPLAZADOS lo arreglan por partida doble: dicen «monedas» en
 * plural, que es lo que cuenta la cifra, y no tienen nada que ver con la
 * silueta concéntrica de la diana.
 */
export function Moneda(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <circle cx="9.4" cy="9.4" r="6.4" />
      {/* El disco de atrás, solo por donde asoma: el arco arranca y acaba justo
          en los dos puntos donde los dos círculos se cruzan. */}
      <path d="M15.7 8.3a6.4 6.4 0 1 1-7.4 7.4" />
    </Lienzo>
  );
}

/* ------------------------------------------------------------------------- *
 * EL RESTO
 * ------------------------------------------------------------------------- */

/**
 * Diana. El objetivo de un desafío y el récord por batir.
 *
 * También hubo aquí un intento descartado: diana con flecha clavada. Dibujada,
 * la flecha diagonal saliendo de un círculo es el símbolo de Marte, ♂, y a
 * 24 px no se lee otra cosa. Mejor los anillos de toda la vida: ahora que la
 * moneda son dos discos desplazados, lo concéntrico queda libre para esto.
 */
export function Diana(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <circle cx="12" cy="12" r="8.3" />
      <circle cx="12" cy="12" r="4.6" />
      {/* El centro. Un trazado de largo cero con la punta redonda es un punto
          del grosor del trazo, así que no se sale de la familia. */}
      <path d="M12 12h0" />
    </Lienzo>
  );
}

/** Pieza de puzle. Las lecciones de gramática: encajar piezas es lo que son. */
export function Pieza(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M4.5 9.6V5.5a1 1 0 0 1 1-1h4.1a2.4 2.4 0 1 1 4.8 0h4.1a1 1 0 0 1 1 1v4.1a2.4 2.4 0 1 0 0 4.8v4.1a1 1 0 0 1-1 1h-4.1a2.4 2.4 0 1 0-4.8 0H5.5a1 1 0 0 1-1-1v-4.1a2.4 2.4 0 1 1 0-4.8Z" />
    </Lienzo>
  );
}

/** Hoja con el pico doblado. Las lecciones de lectura. */
export function Documento(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M6.6 2.9h6.6l5.7 5.7v11.5a1 1 0 0 1-1 1H6.6a1 1 0 0 1-1-1V3.9a1 1 0 0 1 1-1Z" />
      <path d="M13.2 2.9v4.8a1 1 0 0 0 1 1h4.7" />
      <path d="M8.9 13.2h6.2M8.9 16.6h6.2" />
    </Lienzo>
  );
}

/** Auriculares. Las lecciones de escucha. */
export function Auriculares(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M3.4 17.2v-5a8.6 8.6 0 0 1 17.2 0v5" />
      <path d="M20.6 18.2a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-2.9a2 2 0 0 1 2-2h3Z" />
      <path d="M3.4 18.2a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-2.9a2 2 0 0 0-2-2h-3Z" />
    </Lienzo>
  );
}

/** Micrófono. Las lecciones de hablar y los ejercicios que piden voz. */
export function Micro(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M12 2.8a3.2 3.2 0 0 1 3.2 3.2v5.6a3.2 3.2 0 0 1-6.4 0V6A3.2 3.2 0 0 1 12 2.8Z" />
      <path d="M5.9 10.6v1a6.1 6.1 0 0 0 12.2 0v-1" />
      <path d="M12 17.7v3.5M8.6 21.2h6.8" />
    </Lienzo>
  );
}

/** Banderín de meta. La prueba que cierra una unidad. */
export function Bandera(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M5.6 21V3.4" />
      <path d="M5.6 4.6h12.8l-2.2 3.4 2.2 3.4H5.6Z" />
    </Lienzo>
  );
}

/** Las tres rayas. Abrir el menú de la cuenta. */
export function Menu(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M3.6 7h16.8M3.6 12h16.8M3.6 17h16.8" />
    </Lienzo>
  );
}

/** Candado cerrado. Lo que todavía no está abierto. */
export function Candado(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M5.4 10.5h13.2a1.6 1.6 0 0 1 1.6 1.6v7.2a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6v-7.2a1.6 1.6 0 0 1 1.6-1.6Z" />
      <path d="M7.9 10.5V7.2a4.1 4.1 0 0 1 8.2 0v3.3" />
    </Lienzo>
  );
}

/** La marca de hecho. Lo que ya está. */
export function Check(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="m4.6 12.6 5 5.2L19.4 6.6" />
    </Lienzo>
  );
}

/** La cruz de cerrar. */
export function Cerrar(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="m6.6 6.6 10.8 10.8M17.4 6.6 6.6 17.4" />
    </Lienzo>
  );
}

/** Birrete. El nivel al que llegaste. */
export function Birrete(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M12 3.4 22 8.1l-10 4.7L2 8.1Z" />
      <path d="M6.5 10.4v4.8c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-4.8" />
      <path d="M20.5 9.4v4.6" />
    </Lienzo>
  );
}

/**
 * Altavoz con ondas. Escuchar algo.
 *
 * Va en pareja con `AltavozLlano`: mientras suena se pinta el llano y en
 * reposo este. El cambio de icono es la única señal de que el botón está
 * ocupado para quien no oye el audio o lo tiene en silencio.
 */
export function Altavoz(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M4.2 9.3h3L11.9 5v14l-4.7-4.3h-3A1.2 1.2 0 0 1 3 13.5v-3a1.2 1.2 0 0 1 1.2-1.2Z" />
      <path d="M15.2 9.4a3.8 3.8 0 0 1 0 5.2" />
      <path d="M18 6.8a7.6 7.6 0 0 1 0 10.4" />
    </Lienzo>
  );
}

/** El mismo altavoz sin ondas: el momento en que ya está sonando. */
export function AltavozLlano(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M4.2 9.3h3L11.9 5v14l-4.7-4.3h-3A1.2 1.2 0 0 1 3 13.5v-3a1.2 1.2 0 0 1 1.2-1.2Z" />
    </Lienzo>
  );
}

/** Lápiz. Escribir algo, o la prueba de nivel. */
export function Lapiz(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M17.6 3.4a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8.8 19.2l-4.2 1 1-4.2Z" />
      <path d="m15.6 5.4 3 3" />
    </Lienzo>
  );
}

/** La flecha que sale de la caja: esto abre otra pestaña. */
export function EnlaceExterno(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M18 13.8v4.8a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V7.8A1.8 1.8 0 0 1 5.4 6h4.8" />
      <path d="M14.2 4.4h5.4v5.4M19.6 4.4l-9.2 9.2" />
    </Lienzo>
  );
}

/** Rayo. Los desafíos de ritmo: hacer algo seguido, rápido. */
export function Rayo(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="M13.4 2.4 4.6 13.6h6.2l-.2 8 8.8-11.2h-6.2Z" />
    </Lienzo>
  );
}

/**
 * Medalla con cinta. Un desafío grande cumplido.
 *
 * La cinta son dos tiras CRUZADAS y no un trapecio cerrado: cerrada se leía
 * como un reloj de arena encima de un círculo, y sin cruzar, como dos orejas.
 * Cruzadas, el disco cuelga de algo en vez de apoyarse, que es lo único que
 * separa una medalla de una moneda.
 */
export function Medalla(props: PropsIcono) {
  return (
    <Lienzo {...props}>
      <path d="m8.3 2.8 5.1 6.8M15.7 2.8 10.6 9.6" />
      <circle cx="12" cy="15.4" r="5.9" />
    </Lienzo>
  );
}

/* ------------------------------------------------------------------------- *
 * EL CATÁLOGO
 * ------------------------------------------------------------------------- */

/**
 * Los iconos a los que se llega por nombre.
 *
 * Existe porque hay dos sitios que eligen icono con un dato y no con código:
 * la barra de abajo, que vive en un `.ts` sin JSX para poder leerse y probarse
 * sin montar nada, y los desafíos, cuyo icono lo manda el servidor. En los
 * demás sitios se importa el componente directamente, que es más claro.
 */
export const ICONOS = {
  libro: Libro,
  mando: Mando,
  copa: Copa,
  bolsa: Bolsa,
  persona: Persona,
  repasar: Repasar,
  telefono: Telefono,
  bocadillo: Bocadillo,
  llama: Llama,
  estrella: Estrella,
  moneda: Moneda,
  diana: Diana,
  pieza: Pieza,
  documento: Documento,
  auriculares: Auriculares,
  micro: Micro,
  bandera: Bandera,
  menu: Menu,
  candado: Candado,
  check: Check,
  cerrar: Cerrar,
  birrete: Birrete,
  altavoz: Altavoz,
  altavozLlano: AltavozLlano,
  lapiz: Lapiz,
  enlaceExterno: EnlaceExterno,
  rayo: Rayo,
  medalla: Medalla,
} as const;

export type ClaveIcono = keyof typeof ICONOS;

/** Las cinco de la barra: las únicas que entienden `relleno`. */
export type ClaveIconoDoble = 'libro' | 'mando' | 'copa' | 'bolsa' | 'persona';
