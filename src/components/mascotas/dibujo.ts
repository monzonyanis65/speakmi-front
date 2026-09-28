/**
 * Milo dibujado en un lienzo de mapa de bits, con extremidades de goma.
 *
 * Es el MISMO pájaro: mismo índigo, misma barriga clara, mismo copete, mismo
 * pico naranja, mismos ojos. Las coordenadas son las de siempre —el lienzo de
 * 120×120 de `milo.tsx`, con el suelo en y=108— para que a igual postura salga
 * igual dibujo. Cambia una sola cosa de la anatomía y es la que el encargo
 * pedía: las alas y las patas ya no son piezas rígidas.
 *
 *
 * POR QUÉ LAS ALAS SON UN TRAZO Y NO UNA ELIPSE
 *
 * El ala era `<ellipse cx=32 cy=72 rx=11 ry=20>` girando alrededor del hombro.
 * Una elipse no se dobla: por mucho que gire, sigue siendo la misma cápsula
 * rígida, y lo que se ve al levantarla es una pieza que pivota, no un brazo que
 * se estira. Es el aspecto de marioneta articulada del que venimos.
 *
 * Ahora el ala es UNA CURVA con un trazo grueso y las puntas redondas: nace en
 * el hombro, pasa por un codo y acaba en la punta. El codo no está fijo, se
 * aparta de la recta según dos cosas: cuánto está levantada el ala y hacia
 * dónde va el cuerpo. Así, al subir, el ala se arquea; y al frenar el cuerpo,
 * el codo se queda atrás un instante. Eso es lo que en animación se llama
 * arrastre, y es lo que convierte un palo que gira en algo que tiene peso.
 *
 * El grosor del trazo es el diámetro de la elipse de antes, y los extremos
 * llegan donde llegaba ella. Medido contra el dibujo viejo, el ala ocupa el
 * mismo hueco: lo que cambia es que ahora se dobla por el medio.
 */

import { type Atuendo, type Visema } from './tipos';
import { type PoseViva } from './motor';
import { type EstadoMascota } from './coreografia';

/**
 * Los colores, leídos del tema en vez de copiados.
 *
 * Están declarados en `index.css` como variables (`--color-marca-600` y
 * compañía) y el dibujo SVG los usaba a través de clases de Tailwind. Aquí no
 * hay clases, así que hay que resolverlos a mano, pero LEYÉNDOLOS: copiando los
 * hexadecimales, el día que alguien afine la marca el resto de la aplicación
 * cambiaría de color y Milo se quedaría con el índigo antiguo, que es la clase
 * de desajuste que nadie relaciona con este archivo.
 *
 * Los valores de repuesto son los de hoy, para que en un lienzo sin documento
 * detrás —las pruebas— salga el pájaro de siempre y no uno negro.
 */
const REPUESTO = {
  marca100: '#e0e7ff',
  marca600: '#4f46e5',
  marca700: '#4338ca',
  marca800: '#3730a3',
  acento300: '#fcd34d',
  acento400: '#fbbf24',
  acento500: '#f59e0b',
  acento600: '#d97706',
};

const VARIABLE: Record<keyof typeof REPUESTO, string> = {
  marca100: '--color-marca-100',
  marca600: '--color-marca-600',
  marca700: '--color-marca-700',
  marca800: '--color-marca-800',
  acento300: '--color-acento-300',
  acento400: '--color-acento-400',
  acento500: '--color-acento-500',
  acento600: '--color-acento-600',
};

let cache: typeof REPUESTO | null = null;

/** La paleta del tema. Se resuelve una vez: no cambia entre fotogramas. */
export function paleta(): typeof REPUESTO {
  if (cache) return cache;
  cache = { ...REPUESTO };
  if (typeof window === 'undefined' || !window.getComputedStyle) return cache;
  const leido = window.getComputedStyle(document.documentElement);
  for (const clave of Object.keys(VARIABLE) as (keyof typeof REPUESTO)[]) {
    const valor = leido.getPropertyValue(VARIABLE[clave]).trim();
    if (valor) cache[clave] = valor;
  }
  return cache;
}

/** Tirar la paleta guardada. Solo lo usan las pruebas. */
export function olvidarPaleta() {
  cache = null;
}

/** El azul casi negro de las pupilas y los párpados, que no es de la marca. */
const TINTA = '#0f172a';
/** La ceja de Milo, el índigo más oscuro que hay: es el único cráneo oscuro. */
const CEJA = '#1e1b4b';

/**
 * ¿Se puede dibujar en un lienzo de dos dimensiones en este entorno?
 *
 * En el navegador siempre; en las pruebas, que corren sobre jsdom sin lienzo,
 * nunca. Vive aquí y no en el componente por dos motivos: es una pregunta sobre
 * el dibujo, no sobre React, y exportada desde un archivo de componentes rompe
 * la recarga en caliente de toda la mascota.
 *
 * Se comprueba una sola vez y de forma SÍNCRONA a propósito. Averiguándolo
 * después de montar habría un fotograma con el dibujo de repuesto y otro con el
 * bueno, y ese parpadeo se vería en las treinta pantallas donde sale Milo.
 */
let soportado: boolean | null = null;

export function hayLienzo2D(): boolean {
  if (soportado !== null) return soportado;
  try {
    soportado = Boolean(document.createElement('canvas').getContext('2d'));
  } catch {
    soportado = false;
  }
  return soportado;
}

/**
 * Olvidar lo averiguado. Solo lo usan las pruebas.
 *
 * Existe porque la respuesta se guarda para siempre —averiguarla cuesta crear
 * un elemento— y las pruebas necesitan recorrer los dos caminos: el del lienzo
 * y el de repuesto. Sin esto, la primera prueba que preguntara dejaría fijada
 * la respuesta para todas las demás del archivo.
 */
export function olvidarSoporte() {
  soportado = null;
}

/** La línea del suelo: donde apoyan las patas y donde pivota todo el cuerpo. */
export const SUELO = 108;

/** Lo que hace falta saber para pintar un fotograma de Milo. */
export interface Cuadro {
  pose: PoseViva;
  estado: EstadoMascota;
  /** Cuánto están abiertos los párpados, de 0 a 1. */
  parpado: number;
  /** A dónde mira la pupila, en unidades del lienzo. */
  miraX: number;
  miraY: number;
  /** Hacia dónde va el cuerpo. Es lo que dobla los codos hacia atrás. */
  inercia: number;
  /** La boca de ahora y la que se está apagando, cruzándose en opacidad. */
  boca: Visema;
  bocaPrevia: Visema;
  /** Por dónde va el cruce, de 0 (la previa) a 1 (la nueva). */
  cruce: number;
  /** Cuánto deforma la mandíbula al hablar. */
  bocaAlto: number;
  bocaAncho: number;
  atuendo: Atuendo | null;
  /** Milisegundos desde que arrancó el reloj, para los adornos que laten. */
  t: number;
  /**
   * Dibujo de andar por casa, para los Milos pequeños.
   *
   * A 44 px, una unidad del lienzo mide 0,37 px: el degradado de la sombra, el
   * desplazamiento de la pupila y el brillo del ojo caen todos por debajo del
   * píxel y lo único que consiguen es emborronar. Se quitan, y lo que queda
   * —silueta, postura y color— es justo lo que a ese tamaño sí se ve.
   */
  simple: boolean;
}

const GRADO = Math.PI / 180;

/**
 * Pinta a Milo entero.
 *
 * El contexto llega ya colocado: origen en la esquina del lienzo de 120×120 y
 * escalado para que una unidad sea una unidad. Aquí dentro se trabaja siempre
 * en esas unidades, nunca en píxeles, que es lo que permite que el mismo código
 * sirva a 38 y a 260 px.
 */
export function dibujarMilo(ctx: CanvasRenderingContext2D, c: Cuadro) {
  const { pose } = c;
  const p = paleta();

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  sombraDeContacto(ctx, c);

  ctx.save();

  /*
    El cuerpo entero pivota en la línea del suelo, no en su centro.

    Es la misma decisión que estaba razonada en el esqueleto SVG y sigue siendo
    la correcta: escalando desde el centro, las patas suben con el pecho y el
    pájaro levita en bloque separándose de su propia sombra. Pivotando en el
    suelo, los pies se quedan plantados y lo que crece es el cuerpo hacia
    arriba, que es lo que hace un pecho al llenarse.

    El orden importa y es el de siempre: primero ir al pivote, luego desplazar,
    girar y escalar, y volver. Escalar antes de desplazar multiplicaría también
    la altura del salto por el estiramiento, y el salto mediría distinto según
    lo estirado que fuera, que es un error que se ve como que a veces salta más.
  */
  ctx.translate(60, SUELO);
  ctx.translate(0, pose.y);
  ctx.rotate(pose.giro * GRADO);
  ctx.scale(pose.eX, pose.eY);
  ctx.translate(-60, -SUELO);

  cola(ctx, pose, p.marca700);

  // Tronco y barriga.
  ctx.fillStyle = p.marca600;
  elipse(ctx, 60, 66, 34, 36);
  ctx.fillStyle = p.marca100;
  elipse(ctx, 62, 74, 22, 24);

  /*
    Las patas van DENTRO del cuerpo, igual que en el dibujo viejo y por el mismo
    motivo: sacadas fuera para dejarlas quietas, el tronco sube al respirar y
    las piernas se estiran como un chicle. Dentro, se aplastan con todo lo demás
    y siguen siendo patas.
  */
  patas(ctx, c, p.acento500);

  // El ala de allá va DEBAJO del cuerpo y la de acá encima: es lo que da la
  // profundidad. Como el cuerpo ya está pintado, la de allá se pinta antes en
  // el código pero se ve tapada; por eso aquí las dos van después, y la de allá
  // se dibuja más oscura y más pequeña, que es lo que la manda al fondo.
  ala(ctx, c, 'lejana', p.marca800);
  ala(ctx, c, 'cercana', p.marca700);

  cabeza(ctx, c, p);

  ctx.restore();

  adornos(ctx, c, p);
}

/**
 * La sombra de contacto.
 *
 * Es el detalle más barato de todo el archivo y el que más trabaja: sin ella
 * Milo no está DE PIE en ningún sitio, está flotando delante de un fondo. Con
 * ella, además, el salto se lee antes de mirar al pájaro, porque la sombra se
 * encoge y se aclara según sube.
 *
 * Se ensancha con el aplastamiento porque un cuerpo que se agacha reparte su
 * peso en más suelo, y se estrecha y se difumina con la altura porque una luz
 * cenital proyecta una mancha más pequeña y más suave cuanto más lejos está lo
 * que la tapa. Las dos cosas a la vez son lo que la hace leerse como sombra y
 * no como una elipse gris pegada debajo.
 */
function sombraDeContacto(ctx: CanvasRenderingContext2D, c: Cuadro) {
  const { pose } = c;
  // `pose.y` es negativo hacia arriba; esto queda entre 0 (en el suelo) y 1.
  const alto = Math.min(1, Math.max(0, -pose.y / 14));
  const ancho = 30 * pose.eX * (1 - alto * 0.42);
  const opacidad = 0.26 * (1 - alto * 0.62);

  ctx.save();
  if (c.simple) {
    // Sin degradado: a 44 px el degradado radial ocupa cuatro píxeles y lo
    // único que hace es volverlos grises. Un óvalo plano y algo más tenue dice
    // lo mismo y se ve mejor.
    ctx.globalAlpha = opacidad * 0.8;
    ctx.fillStyle = TINTA;
    elipse(ctx, 60, SUELO + 2, ancho, ancho * 0.22);
    ctx.restore();
    return;
  }

  /*
    El degradado se construye UNA vez por lienzo y se reutiliza.

    Crear un degradado radial cada fotograma sale caro y se nota: medido con el
    Milo de 260 px de la pantalla de llamada y el procesador frenado seis veces
    —lo que viene a ser un móvil de gama media—, con el degradado nuevo en cada
    vuelta la página bajaba a 29 fotogramas por segundo. Es la orden más cara de
    todo el dibujo, porque cada llamada reserva memoria y recalcula la rampa de
    color.

    Se puede guardar porque lo único que cambiaba de un fotograma a otro era el
    tamaño y la opacidad, y ninguna de las dos hace falta que esté dentro: el
    tamaño lo pone la transformación y la opacidad, `globalAlpha`. Así el
    degradado es siempre el mismo —un disco de radio uno que se apaga hacia
    fuera— y lo que se mueve es la escala.
  */
  const grad = degradadoDeSombra(ctx);
  ctx.globalAlpha = opacidad;
  ctx.translate(60, SUELO + 2);
  ctx.scale(ancho, ancho * 0.26);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * El degradado de la sombra, guardado por lienzo.
 *
 * Va en un mapa débil y no en una variable suelta porque cada Milo tiene su
 * propio contexto, y un degradado creado en uno no vale en otro: el navegador
 * los ata al lienzo donde nacieron. Débil para que al desmontarse un Milo su
 * degradado se pueda recoger con él.
 */
const degradados = new WeakMap<CanvasRenderingContext2D, CanvasGradient>();

function degradadoDeSombra(ctx: CanvasRenderingContext2D): CanvasGradient {
  const guardado = degradados.get(ctx);
  if (guardado) return guardado;
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, 'rgba(15, 23, 42, 1)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.55)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  degradados.set(ctx, grad);
  return grad;
}

/** La cola: el mismo triángulo de plumas de siempre, balanceándose. */
function cola(ctx: CanvasRenderingContext2D, pose: PoseViva, color: string) {
  ctx.save();
  ctx.translate(24, 82);
  ctx.rotate(pose.cola * GRADO);
  ctx.translate(-24, -82);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(22, 78);
  ctx.lineTo(4, 92);
  ctx.lineTo(26, 88);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Dónde nace y dónde acaba cada ala, y de qué grosor es.
 *
 * Son las medidas de las elipses de antes traducidas a trazo: el grosor es el
 * diámetro (la de acá tenía rx=11, o sea 22 de ancho) y los extremos caen donde
 * caían los suyos, así que el ala sigue ocupando el mismo hueco del dibujo. La
 * de allá es más corta, más fina y más oscura, que es lo que la manda al fondo
 * y lo que impide que el pájaro se vea recortado en papel.
 */
const ALAS = {
  cercana: { hombro: [36, 64], punta: [31, 81], grosor: 20, lado: -1 },
  lejana: { hombro: [83, 64], punta: [86, 76], grosor: 19, lado: 1 },
} as const;

/**
 * Un ala de goma.
 *
 * El codo es el punto de control de la curva y no está en la recta entre hombro
 * y punta: se aparta perpendicularmente, y CUÁNTO se aparta es todo el efecto.
 *
 *   - Con el ala levantada se aparta más. Un brazo que sube no sube recto, se
 *     arquea, y un ala levantada sin arco es un palo apuntando al cielo.
 *   - Y se aparta hacia el lado contrario al que va el cuerpo. Cuando el cuerpo
 *     arranca hacia arriba, el ala todavía está abajo y el codo se queda atrás;
 *     cuando frena, la sigue. Eso es el arrastre, y es lo que hace que el ala
 *     parezca tener peso en vez de estar pegada.
 *
 * Todo con `quadraticCurveTo`, trazo grueso y puntas redondas: no hay ni una
 * arista en el ala entera, que es justo lo que se pedía.
 */
function ala(ctx: CanvasRenderingContext2D, c: Cuadro, cual: 'cercana' | 'lejana', color: string) {
  const { pose } = c;
  const def = ALAS[cual];
  const angulo = cual === 'cercana' ? pose.alaCercana : -pose.alaLejana;
  const fuera = cual === 'cercana' ? pose.fueraCercana : pose.fueraLejana;

  ctx.save();
  // El ala se aparta del cuerpo antes de girar. Sin esto no hay saludo posible:
  // el ala mide 22 de ancho y el cuerpo la tapa entera menos cuatro, así que
  // girándola sin apartarla lo único que se ve moverse es una astilla pegada al
  // costado. Está medido y razonado en la partitura; aquí solo se ejecuta.
  // Un brazo que se separa del cuerpo también se eleva: de ahí la mitad de y.
  ctx.translate(def.lado * fuera, -fuera * 0.5);

  const [hx, hy] = def.hombro;
  ctx.translate(hx, hy);
  ctx.rotate(angulo * GRADO);
  ctx.translate(-hx, -hy);

  const [px, py] = def.punta;
  const mx = (hx + px) / 2;
  const my = (hy + py) / 2;

  // La perpendicular al hueso, normalizada.
  const dx = px - hx;
  const dy = py - hy;
  const largo = Math.hypot(dx, dy) || 1;
  const nx = -dy / largo;
  const ny = dx / largo;

  /*
    Cuánto se arquea el codo.

    Aquí hay un límite que no es de gusto sino de geometría, y costó verlo. El
    ala de Milo NO es una manguera larga: el hueso mide 17,7 unidades y el trazo
    20 de grosor, o sea que es más gruesa que larga. En algo así, un codo que se
    aparta seis unidades no dibuja una curva, dobla la cápsula sobre sí misma y
    sale una manopla con un mordisco. Medido a 62 grados, que es lo que levanta
    el ala al celebrar: con el apartado en 5,8 el ala se mordía por abajo.

    Con el tope en cuatro, la curva se lee —la punta va claramente retrasada
    respecto al hombro— y la silueta sigue siendo un ala. La regla, para el día
    que alguien la toque: el apartado nunca puede pasar de un quinto del largo
    del hueso más el grosor.
  */
  const porElAngulo = (Math.abs(angulo) / 90) * 3;
  const porLaInercia = c.inercia * 2.2;
  const arco = Math.max(-4, Math.min(4, def.lado * (1.4 + porElAngulo) + porLaInercia));

  ctx.strokeStyle = color;
  ctx.lineWidth = def.grosor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.quadraticCurveTo(mx + nx * arco, my + ny * arco, px, py);
  ctx.stroke();
  ctx.restore();
}

/**
 * Las patas, también de goma.
 *
 * Eran dos líneas rectas de y=100 a y=108 con una barra por pie. Siguen naciendo
 * y acabando donde nacían, pero ahora se doblan: al saltar se recogen hacia el
 * cuerpo (la fase 2 del salto lo pide expresamente) y la rodilla se va hacia
 * fuera, que es lo que hace un bicho que encoge las patas en el aire. Con las
 * patas rectas colgando, el salto se lee como un muñeco levantado con un hilo.
 */
function patas(ctx: CanvasRenderingContext2D, c: Cuadro, color: string) {
  const recoger = c.pose.patas;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  for (const [x, lado] of [
    [52, -1],
    [68, 1],
  ] as const) {
    const cadera = 99;
    /*
      Al recogerse, el pie sube hacia la barriga y la rodilla se abre.

      Cinco unidades y ni una más, y la razón es que esto ocurre DENTRO del
      estirado del salto. La barriga acaba en y=102, o sea a seis unidades del
      pivote del suelo, y el pie a cinco: escalados los dos por 1,32, el pie
      queda 1,3 unidades por debajo del borde del cuerpo y se sigue viendo.
      Con las siete que tenía, el pie subía por encima del borde y, como las
      patas se pintan encima del cuerpo, aparecían dos garras naranjas flotando
      en mitad de la barriga blanca.
    */
    const pieY = SUELO - recoger * 5;
    const rodillaX = x + lado * recoger * 5;
    const rodillaY = (cadera + pieY) / 2 + recoger * 1.5;

    ctx.beginPath();
    ctx.moveTo(x, cadera);
    ctx.quadraticCurveTo(rodillaX, rodillaY, x, pieY);
    ctx.stroke();

    // El dedo, que con la pata recogida se encoge: un pie a tamaño completo
    // colgando de una pata replegada parece una pala.
    const dedo = 6 * (1 - recoger * 0.35);
    ctx.beginPath();
    ctx.moveTo(x - dedo, pieY);
    ctx.lineTo(x + dedo, pieY);
    ctx.stroke();
  }
}

/**
 * La cabeza entera, girando POR EL CUELLO.
 *
 * El aviso que venía con el encargo va justo aquí. En el SVG el problema era
 * `transform-box: fill-box`, que medía los pivotes desde la caja de cada pieza;
 * en lienzo no existe ese concepto, el pivote lo pone uno con `translate`. Pero
 * el error que se cometía es exactamente igual de fácil: `translate(60, 42)` es
 * el CENTRO DEL CRÁNEO, y girar ahí hace que la cabeza rote sobre sí misma como
 * una pegatina. El cuello de Milo está en y=66 —lo declara `milo.tsx` en sus
 * anclajes— y es ahí, 24 unidades más abajo, donde tiene que girar.
 *
 * Comprobado dibujando el punto: con 42 la coronilla se desplaza 10 unidades al
 * ladear 12 grados y el cuello se queda quieto; con 66 el cuello no se mueve y
 * lo que viaja es la coronilla, que es lo que hace una cabeza de verdad.
 */
function cabeza(ctx: CanvasRenderingContext2D, c: Cuadro, p: typeof REPUESTO) {
  const { pose } = c;
  ctx.save();
  ctx.translate(60, 66);
  ctx.rotate(pose.cabeza * GRADO);
  ctx.translate(-60, -66);

  // El copete, detrás del cráneo para que asome.
  ctx.fillStyle = p.marca700;
  ctx.beginPath();
  ctx.moveTo(52, 32);
  ctx.quadraticCurveTo(58, 18, 66, 30);
  ctx.quadraticCurveTo(60, 26, 52, 32);
  ctx.closePath();
  ctx.fill();

  // El cráneo.
  ctx.fillStyle = p.marca600;
  ctx.beginPath();
  ctx.arc(60, 42, 26, 0, Math.PI * 2);
  ctx.fill();

  cejas(ctx, pose);
  ojos(ctx, c);
  pico(ctx, c, p);
  if (c.atuendo) atuendo(ctx, c.atuendo, p);

  ctx.restore();
}

/**
 * Las dos cejas.
 *
 * Son dos trazos y son la mitad de la expresión: con ellas el mismo pájaro pasa
 * de sorprendido a pícaro sin tocar nada más de la cara. Van FUERA del aplastado
 * del parpadeo a propósito, igual que en el dibujo viejo: una ceja dentro de la
 * capa de los ojos se aplastaría con el párpado.
 *
 * Las dos no van a la misma altura, y ahí está el resto: una cara perfectamente
 * simétrica se lee como un icono. El sesgo se reparte entre las dos —0,7 a una y
 * 0,3 a la otra— en vez de subir solo una, porque subiendo una sola la cara
 * entera parecía descolgarse hacia ese lado.
 */
function cejas(ctx: CanvasRenderingContext2D, pose: PoseViva) {
  const Y = 27.5;
  const ANCHO = 7;
  const ARCO = 3.8;

  ctx.strokeStyle = CEJA;
  ctx.lineWidth = 2.7;
  ctx.lineCap = 'round';

  for (const [cx, lado, alto] of [
    [50, -1, pose.ceja - pose.cejaSesgo * 0.7],
    [70, 1, pose.ceja + pose.cejaSesgo * 0.3],
  ] as const) {
    ctx.save();
    ctx.translate(0, alto);
    // El pivote es el centro de la propia ceja. Girando por el centro de la
    // cara, las dos cejas orbitarían alrededor de la nariz.
    ctx.translate(cx, Y);
    ctx.rotate(pose.cejaGiro * lado * GRADO);
    ctx.translate(-cx, -Y);
    ctx.beginPath();
    ctx.moveTo(cx - ANCHO, Y);
    ctx.quadraticCurveTo(cx, Y - ARCO, cx + ANCHO, Y);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Los ojos: abrir, parpadear y mirar, tres cosas a la vez.
 *
 * El alto junta la postura con el parpadeo MULTIPLICÁNDOLOS, igual que antes:
 * entornar los ojos de felicidad y cerrarlos para parpadear son lo mismo en
 * distinto grado, así que se pueden dar a la vez sin que uno pise al otro.
 *
 * Pensando y durmiendo no parpadean: ya están cerrados, y la diferencia entre
 * los dos está en hacia dónde se arquea el párpado. Arriba es alguien
 * concentrado; abajo es alguien dormido. Es un detalle de dos píxeles y es lo
 * único que distingue los dos estados en la cara.
 */
function ojos(ctx: CanvasRenderingContext2D, c: Cuadro) {
  const { pose, estado } = c;
  const cerrados = estado === 'pensando' || estado === 'durmiendo';

  if (cerrados) {
    const curva = estado === 'durmiendo' ? 45 : 35;
    ctx.strokeStyle = TINTA;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (const x of [50, 70]) {
      ctx.beginPath();
      ctx.moveTo(x - 6, 40);
      ctx.quadraticCurveTo(x, curva, x + 6, 40);
      ctx.stroke();
    }
    return;
  }

  const abierto = Math.max(0.02, pose.ojo * c.parpado);

  ctx.save();
  ctx.translate(60, 40);
  ctx.scale(1, abierto);
  ctx.translate(-60, -40);

  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(50, 40, 9, 0, Math.PI * 2);
  ctx.arc(70, 40, 9, 0, Math.PI * 2);
  ctx.fill();

  // Contento la pupila se va un pelo hacia dentro, que es lo que hace una cara
  // sonriendo. Es un desplazamiento de una unidad y se nota.
  const dentro = estado === 'feliz' ? 1 : 0;
  const mx = c.simple ? 0 : c.miraX;
  const my = c.simple ? 0 : c.miraY;

  ctx.fillStyle = TINTA;
  ctx.beginPath();
  ctx.arc(50 + dentro + mx, 41 + my, 4.5, 0, Math.PI * 2);
  ctx.arc(70 + dentro + mx, 41 + my, 4.5, 0, Math.PI * 2);
  ctx.fill();

  if (!c.simple) {
    // El brillo. Convierte dos manchas negras en dos ojos, y a menos de 50 px
    // ya no cabe: por eso se va con el resto del detalle.
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(52 + mx, 39 + my, 1.6, 0, Math.PI * 2);
    ctx.arc(72 + mx, 39 + my, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Las seis bocas de un PICO.
 *
 * Un pico no tiene labios: no se estira ni se frunce, se abre por la bisagra.
 * Lo que cambia entre una boca y otra es el ángulo de apertura y cuánto se
 * arquea la línea donde se juntan las dos mitades. La mitad de arriba va un tono
 * más clara en todas las que abren: sin esa diferencia, el pico abierto es un
 * rombo naranja y no se entiende cuál es el techo de la boca.
 *
 * Son exactamente las mismas coordenadas que las del dibujo SVG, y eso no es
 * pereza: es la garantía de que el Milo del lienzo y el de repuesto tienen la
 * misma cara. Si aquí se retocara un vértice, la tienda y los juegos enseñarían
 * dos pájaros distintos según qué camino de dibujado les tocara.
 */
type Trazo = (ctx: CanvasRenderingContext2D) => void;

const PICOS: Record<Visema, { bajo: Trazo; alto?: Trazo }> = {
  cerrada: {
    bajo: (x) => triangulo(x, 54, 50, 66, 50, 60, 58),
  },
  sonrisa: {
    bajo: (x) => {
      x.beginPath();
      x.moveTo(53, 50);
      x.quadraticCurveTo(60, 45.5, 67, 50);
      x.lineTo(60, 58);
      x.closePath();
      x.fill();
    },
  },
  pena: {
    bajo: (x) => {
      x.beginPath();
      x.moveTo(54, 48.5);
      x.quadraticCurveTo(60, 53, 66, 48.5);
      x.lineTo(60, 58.5);
      x.closePath();
      x.fill();
    },
  },
  ancha: {
    bajo: (x) => triangulo(x, 50, 52, 70, 52, 60, 58),
    alto: (x) => triangulo(x, 50, 52, 70, 52, 60, 48.5),
  },
  redonda: {
    bajo: (x) => triangulo(x, 55.5, 52, 64.5, 52, 60, 61),
    alto: (x) => triangulo(x, 55.5, 52, 64.5, 52, 60, 47.5),
  },
  abierta: {
    bajo: (x) => triangulo(x, 54, 52, 66, 52, 60, 62),
    alto: (x) => triangulo(x, 54, 52, 66, 52, 60, 47),
  },
};

function pico(ctx: CanvasRenderingContext2D, c: Cuadro, p: typeof REPUESTO) {
  ctx.save();
  /*
    La bisagra es la línea donde se juntan las dos mitades, y=52.

    Encogiendo desde ahí, las dos se cierran a la vez y el pico nunca se despega
    de la cara. Desde el centro del pico se despegaría de la cabeza al hablar,
    que es el fallo que costó documentar la última vez: se ve casi bien.
  */
  ctx.translate(60, 52);
  ctx.scale(c.bocaAncho, c.bocaAlto);
  ctx.translate(-60, -52);

  /*
    Las dos bocas se cruzan en opacidad en vez de sustituirse.

    Al hablar esto cambia ocho veces por segundo: un corte seco ahí se ve como
    un parpadeo en mitad de la cara, o directamente como una avería.
  */
  const pintar = (cual: Visema, alfa: number) => {
    if (alfa <= 0.01) return;
    const forma = PICOS[cual];
    ctx.globalAlpha = alfa;
    ctx.fillStyle = p.acento500;
    forma.bajo(ctx);
    if (forma.alto) {
      ctx.fillStyle = p.acento400;
      forma.alto(ctx);
    }
  };

  if (c.bocaPrevia !== c.boca) pintar(c.bocaPrevia, 1 - c.cruce);
  pintar(c.boca, c.bocaPrevia === c.boca ? 1 : c.cruce);

  ctx.globalAlpha = 1;
  ctx.restore();
}

function triangulo(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
}

/**
 * La ropa.
 *
 * Son las cuatro prendas de `atuendos.tsx` con las medidas de Milo metidas
 * —coronilla 16, medio ancho 26, ojos 40, cuello 66—, porque el lienzo dibuja a
 * un solo animal y no necesita el cálculo por anclajes que sí necesitan las
 * cinco especies del SVG.
 *
 * Cuelga de la capa de la cabeza y no del lienzo, que es toda la gracia: así el
 * gorro se ladea con ella sin escribir una línea. Colgado más arriba se quedaría
 * clavado mientras la cabeza gira debajo, que es el efecto de pegatina de
 * siempre.
 */
function atuendo(ctx: CanvasRenderingContext2D, cual: Atuendo, p: typeof REPUESTO) {
  const CORONILLA = 16;
  const ANCHO = 26;
  const OJOS = 40;
  const CUELLO = 66;

  if (cual === 'OUTFIT_GORRO') {
    const borde = CORONILLA + 14;
    const alto = ANCHO * 0.72;
    ctx.fillStyle = p.acento500;
    ctx.beginPath();
    ctx.ellipse(60, borde, ANCHO, alto, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    // La visera sale hacia el lado y no hacia delante: de frente taparía los
    // ojos, que es lo único del dibujo que no se puede tapar.
    ctx.fillStyle = p.acento600;
    ctx.beginPath();
    ctx.moveTo(60 - ANCHO, borde);
    ctx.quadraticCurveTo(60 - ANCHO - 20, borde - 1, 60 - ANCHO - 22, borde + 6);
    ctx.quadraticCurveTo(60 - ANCHO - 10, borde + 8, 60 - ANCHO, borde + 5);
    ctx.closePath();
    ctx.fill();
    redondeado(ctx, 60 - ANCHO, borde - 4, ANCHO * 2, 6, 3);
    ctx.fillStyle = p.acento300;
    circulo(ctx, 60, borde - alto + 2, 2.5);
    return;
  }

  if (cual === 'OUTFIT_CORONA') {
    const base = CORONILLA + 11;
    const w = ANCHO - 10;
    const punta = w - 5;
    ctx.fillStyle = p.acento400;
    ctx.beginPath();
    ctx.moveTo(60 - w, base);
    ctx.lineTo(60 - punta, base - 11);
    ctx.lineTo(55, base - 4);
    ctx.lineTo(60, base - 16);
    ctx.lineTo(65, base - 4);
    ctx.lineTo(60 + punta, base - 11);
    ctx.lineTo(60 + w, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = p.acento500;
    redondeado(ctx, 60 - w + 2, base - 2, w * 2 - 4, 7, 2);
    ctx.fillStyle = '#fb7185';
    circulo(ctx, 60 - punta, base + 1.5, 2);
    circulo(ctx, 60 + punta, base + 1.5, 2);
    ctx.fillStyle = '#f43f5e';
    circulo(ctx, 60, base + 1.5, 2.2);
    return;
  }

  if (cual === 'OUTFIT_GAFAS') {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(38.5, OJOS - 4);
    ctx.lineTo(60 - ANCHO - 4, OJOS - 2);
    ctx.moveTo(81.5, OJOS - 4);
    ctx.lineTo(60 + ANCHO + 4, OJOS - 2);
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    redondeado(ctx, 38.5, OJOS - 8, 21, 17, 6);
    redondeado(ctx, 60.5, OJOS - 8, 21, 17, 6);
    ctx.fillStyle = '#334155';
    redondeado(ctx, 58, OJOS - 4, 4, 3.5, 1.5);
    // El destello es lo que convierte dos manchas negras en cristal.
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(42, OJOS + 3);
    ctx.lineTo(49, OJOS - 5);
    ctx.moveTo(64, OJOS + 3);
    ctx.lineTo(71, OJOS - 5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  // Bufanda. Va en el cuello, que es justo el punto sobre el que gira la cabeza:
  // la vuelta se queda quieta y solo la caída acompaña al ladeo.
  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.moveTo(72, CUELLO + 4);
  ctx.quadraticCurveTo(80, CUELLO + 18, 74, CUELLO + 28);
  ctx.lineTo(66, CUELLO + 26);
  ctx.quadraticCurveTo(72, CUELLO + 14, 68, CUELLO + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(66, CUELLO + 26);
  ctx.lineTo(64, CUELLO + 32);
  ctx.moveTo(70, CUELLO + 27);
  ctx.lineTo(69, CUELLO + 33);
  ctx.moveTo(74, CUELLO + 28);
  ctx.lineTo(74, CUELLO + 34);
  ctx.stroke();
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.moveTo(36, CUELLO - 4);
  ctx.quadraticCurveTo(60, CUELLO + 8, 84, CUELLO - 4);
  ctx.lineTo(82, CUELLO + 4);
  ctx.quadraticCurveTo(60, CUELLO + 16, 38, CUELLO + 4);
  ctx.closePath();
  ctx.fill();
  circulo(ctx, 74, CUELLO + 2, 6);
}

/**
 * Lo que rodea a Milo: ondas al escuchar, estrellas al celebrar, zetas al dormir.
 *
 * Va FUERA del cuerpo a propósito, después de deshacer su transformación: son
 * cosas del mundo, no del pájaro, y aplastarlas con el squash del cuerpo haría
 * que las estrellas se ensancharan cada vez que se agacha.
 */
function adornos(ctx: CanvasRenderingContext2D, c: Cuadro, p: typeof REPUESTO) {
  if (c.estado === 'escuchando') {
    // Dos anillos que salen y se desvanecen, desfasados medio ciclo.
    for (const retraso of [0, 0.5]) {
      const s = (((c.t / 1800 + retraso) % 1) + 1) % 1;
      ctx.globalAlpha = 0.38 * (1 - s);
      ctx.strokeStyle = p.marca600;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(60, 62, 44 + s * 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (c.estado === 'celebrando') {
    // Las estrellitas laten cada una a su aire: a la vez parecen un semáforo.
    const estrellas = [
      { x: 18, y: 26, r: 5, fase: 0 },
      { x: 100, y: 40, r: 4, fase: 0.33 },
      { x: 96, y: 14, r: 3, fase: 0.66 },
    ];
    ctx.fillStyle = p.acento400;
    for (const e of estrellas) {
      const s = respiracionCorta(c.t / 900 + e.fase);
      ctx.globalAlpha = 0.35 + 0.65 * s;
      estrella(ctx, e.x, e.y, e.r * (0.7 + 0.5 * s));
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (c.estado === 'durmiendo') {
    ctx.fillStyle = p.marca600;
    ctx.textAlign = 'center';
    for (const z of [
      { x: 88, y: 28, tam: 15, alfa: 0.7, fase: 0 },
      { x: 101, y: 15, tam: 10, alfa: 0.45, fase: 0.7 },
    ]) {
      const s = (((c.t / 2600 + z.fase) % 1) + 1) % 1;
      ctx.globalAlpha = z.alfa * Math.sin(s * Math.PI);
      ctx.font = `700 ${z.tam}px system-ui, sans-serif`;
      ctx.fillText('z', z.x, z.y - s * 8);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }
}

/** Un latido de 0 a 1 y vuelta, para los adornos. */
function respiracionCorta(fase: number): number {
  const p = fase - Math.floor(fase);
  const x = p < 0.5 ? p * 2 : 2 - p * 2;
  return x * x * (3 - 2 * x);
}

/** Una estrella de cuatro puntas, la de siempre. */
function estrella(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const fino = r * 0.42;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + fino * 0.3, y - fino * 0.3, x + r, y);
  ctx.quadraticCurveTo(x + fino * 0.3, y + fino * 0.3, x, y + r);
  ctx.quadraticCurveTo(x - fino * 0.3, y + fino * 0.3, x - r, y);
  ctx.quadraticCurveTo(x - fino * 0.3, y - fino * 0.3, x, y - r);
  ctx.fill();
}

function elipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function circulo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function redondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  radio: number,
) {
  const r = Math.min(radio, ancho / 2, alto / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, r);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, r);
  ctx.arcTo(x, y + alto, x, y, r);
  ctx.arcTo(x, y, x + ancho, y, r);
  ctx.closePath();
  ctx.fill();
}
