import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Mascota, MascotaConMensaje } from '@/components/Mascota';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { CabeceraJuego, Contador, Racha } from './Tablero';
import { puntosDelServidor } from './puntos';
import type {
  CofreDeHorda,
  EscenaDeHorda,
  FamiliaDeArma,
  Marcador,
  RespuestaCorregida,
  RondaDeHorda,
} from './tipos';

/**
 * HORDA, «Supervivientes»: Milo en una arena, las sombras encima y el arma
 * disparando sola.
 *
 *
 * EL PROBLEMA DE VERDAD DE ESTE JUEGO, Y VA PRIMERO PORQUE LO DECIDE TODO
 *
 * En un juego de hordas la cabeza está en esquivar. Si juntar TURN con OFF
 * fuera elegir dos iconos de colores, a la tercera partida nadie leería nada:
 * se aprendería dónde está el botón, no el verbo compuesto. Ese es el juego
 * vacío que se hace solo si uno no lo impide a propósito.
 *
 * Aquí lo que lo impide son tres cosas, y ninguna es un adorno:
 *
 *   1. MATAR NO PUNTÚA Y NO SUBE EL ARMA. Los puntos salen de compuestos
 *      forjados y de modismos acertados, y de nada más. El arma solo sube de
 *      rango al cerrar un compuesto BUENO, y la curva de la horda está puesta
 *      —en el servidor— para que el arma que sale de forjar bien sea justo la
 *      que hace falta para llegar al final. Quien esquiva de maravilla y junta
 *      orbes al tuntún se queda con el arma del principio y se lo comen.
 *   2. LOS CINCO ORBES SON TODOS REALES. Los dos verbos forman los dos un
 *      compuesto con la partícula buena, y las tres partículas lo forman con el
 *      verbo bueno. Tachar «eso no se dice» no funciona en ninguno de los dos
 *      ejes. Lo sortea el servidor y está probado allí.
 *   3. LA FORJA NO LLEVA RELOJ. La escena son 45 caracteres de media y leer una
 *      frase nueva que hay que entender para actuar va a 14-18 caracteres por
 *      segundo: meterla en una cuenta atrás mientras además se esquiva mediría
 *      reflejos, no inglés. La presión es que la horda crece mientras lees.
 *      Leer despacio cuesta sombras, nunca cuesta la pregunta.
 *
 *
 * UNA ARENA EN 320 PÍXELES
 *
 * El juego NO vive en píxeles: vive en un rectángulo de 100×130 unidades que
 * manda el servidor, y el navegador lo escala a lo que haya. A 320 px de
 * pantalla la arena mide 288 px y una unidad son 2,88; a 390 mide 358 y una
 * unidad son 3,58. Mismas distancias, mismas velocidades, misma dificultad: lo
 * único que cambia es el zoom. En píxeles, la misma horda sería más fácil en
 * una pantalla grande y dos puntuaciones dejarían de significar lo mismo.
 *
 *
 * CÓMO SE DIBUJA, Y POR QUÉ HAY UN LIENZO
 *
 * Cuarenta sombras, sus balas, cinco orbes y los números volando son más de
 * cien cosas moviéndose. BEAT mueve cuatro notas escribiendo `transform` sobre
 * el elemento para no pasar por el estado de React, y es lo correcto para
 * cuatro; para cien, cien nodos del DOM con su `transform` cada fotograma
 * hacen trabajar al compositor más de lo que un móvil de gama media aguanta.
 * Un `<canvas>` es parte del navegador —no es una librería, no pesa un byte— y
 * dibuja las cien en una sola pasada.
 *
 * Milo NO va en el lienzo. Va encima, como un `<Mascota>` de verdad, y lo único
 * que hace el bucle es escribirle el `transform` al envoltorio, exactamente
 * como BEAT. Lo pidió el dueño —que el personaje sea la mascota de la app— y
 * además hay otro motivo: el motor de Milo se está reescribiendo en paralelo,
 * así que se usa por su API pública (`<Mascota estado tamano />`) y no se copia
 * ni un trazo suyo aquí dentro.
 *
 *
 * EL RELOJ, Y EL FALLO QUE NO SE VA A REPETIR
 *
 * Hay un solo bucle y un solo reloj. `performance.now()` se lee DENTRO del
 * latido y el sello que trae `requestAnimationFrame` NO SE USA —ni se recoge el
 * argumento—, que es exactamente el fallo que dejó congelado el reloj de LA
 * PARTÍCULA: los dos sellos van en relojes distintos y restar uno del otro da
 * un número sin sentido. Está contado en `Particulas.tsx`.
 *
 * Y el paso de simulación está TOPADO: si la pestaña se va al fondo medio
 * minuto, al volver no se simulan treinta segundos de golpe —que sería morir
 * por mirar el correo— sino un fotograma largo y a seguir.
 *
 *
 * QUÉ PASA CON `prefers-reduced-motion`
 *
 * Un juego de hordas sin movimiento parece una contradicción, y no lo es, por
 * la misma razón que un juego de ritmo sin movimiento tampoco lo era en BEAT:
 * lo que hace falta para jugar no es que las cosas se muevan, es SABER DÓNDE
 * ESTÁN y cuándo van a llegar. Así que la arena se convierte en un tablero de
 * casillas y la partida en turnos: cada turno y medio las sombras dan un paso,
 * Milo da el suyo y el arma dispara. Nada se interpola, nada se desplaza: las
 * cosas simplemente están en otra casilla.
 *
 * Y es LA MISMA simulación, no una versión recortada: el mismo `avanzar`, las
 * mismas velocidades, la misma curva de la horda y las mismas preguntas. Lo
 * único que cambia es que se le llama una vez por turno con un paso grande en
 * vez de sesenta veces por segundo con pasos pequeños. La puntuación, por
 * tanto, significa lo mismo.
 *
 * No hay un solo destello a pantalla completa, ni con movimiento normal. Lo que
 * en otros juegos de la casa es un fogonazo, aquí es un anillo que sale de Milo
 * dentro de la arena: se ve mejor, no tapa el texto y no hay forma de que dos
 * forjas seguidas se lean como un parpadeo.
 */

/* ════════════════════════  NÚMEROS DE ESTA PANTALLA  ════════════════════════ */

/*
  Lo que hay aquí abajo es SOLO lo que no puede vivir en el servidor: cuánto
  dura un cartel, cada cuánto es un turno, cuánto se separan dos orbes. Todo lo
  que decide la dificultad —la curva de la horda, el daño, el reloj del cofre,
  cuánto corre Milo— llega en la ronda y no se recalcula aquí, porque la
  calibración de este juego no puede vivir en dos sitios que se desincronicen.
*/

/**
 * Lo que dura un turno con movimiento reducido: novecientos milisegundos.
 *
 * Es lo que tarda Milo en cruzar una casilla y media, y es el número que decide
 * si este modo se puede jugar. Medido con el jugador simulado y la horda
 * atenuada: con 1400 se llegaba vivo al final el 10 % de las veces forjándolo
 * todo bien, con 900 el 77 %. Por debajo de 600 los saltos son tan seguidos que
 * empiezan a leerse como movimiento, que es justo lo que aquí no puede haber.
 */
const MS_TURNO = 900;

/** Lo que se queda en pantalla el compuesto bueno tras acertar. */
const MS_LECCION_ACIERTO = 1000;

/**
 * Y tras fallar.
 *
 * Más del doble, porque aquí hay que LEER: el compuesto, lo que significa y la
 * frase de ejemplo son unos sesenta caracteres, que a 16 por segundo son casi
 * cuatro segundos. Se corta en 2,6 porque el compuesto y el significado —lo que
 * de verdad hay que retener— son los primeros treinta caracteres, y porque la
 * horda está parada mientras tanto y no puede estarlo eternamente.
 */
const MS_LECCION_FALLO = 2600;

/**
 * Lo que la horda se queda quieta al fallar una forja.
 *
 * No es piedad: es que el medio segundo que enseña es el de leer el compuesto
 * bueno, y leerlo con tres sombras encima no lo lee nadie. Mientras dura, las
 * sombras no se mueven y no hacen daño.
 *
 * Y no se puede abusar de ello para descansar: fallar cuesta el rango que no
 * sube, rompe la racha y el reloj de la partida SIGUE CORRIENDO, así que quien
 * falle a propósito llega al minuto tres con la mitad de arma. Medido: fallar
 * la mitad de las escenas es no llegar vivo al final.
 */
const MS_ATURDIDO = 1400;

/** Lo que tarda en poder recogerse una partícula tras coger el verbo. */
const MS_GRACIA_TRAS_VERBO = 350;

/**
 * Lo mínimo que se separan dos orbes, en unidades. A 320 px son 98.
 *
 * Es la otra mitad de que pisar la partícula sea una decisión: si dos
 * partículas caen cerca, elegir la buena deja de depender de saber cuál es y
 * pasa a depender de la puntería. Treinta y cuatro unidades son un tercio de la
 * arena, y con tres partículas eso las deja en tres zonas distintas.
 */
const SEPARACION_ORBES = 30;

/**
 * Y lo mínimo que se separa un orbe de Milo al caer: veintiocho unidades.
 *
 * Con menos, los orbes caen tan cerca de Milo que la mitad se recogen sin
 * moverse y la horda deja de importar; con mucho más, ir a por una palabra es
 * una excursión de media arena y la partida da cuatro preguntas en vez de
 * veinte. Medido con el jugador simulado: con veintiocho sale una pregunta cada
 * 7,5 segundos, de los cuales 3,2 son leer la escena, y en una partida entera
 * caben veinte. Veinte preguntas es lo que hace falta para que la diana del
 * 85 % signifique algo: con ocho, un fallo la mueve doce puntos.
 */
const SEPARACION_DE_MILO = 28;

/**
 * Cuánto se espera a que una sombra suelte un orbe antes de soltarlo solo.
 *
 * Los orbes los sueltan las sombras al morir, que es lo que pidió el dueño, y
 * eso tiene una pega medida: cuando el arma es floja se mata poco, y entonces
 * la escena tardaba hasta quince segundos en tener sus cinco orbes en el suelo.
 * O sea que a quien peor le iba el juego le daba menos preguntas, que es lo
 * contrario de lo que hace falta. Con dos segundos, lo que falte cae solo y la
 * partida da una pregunta cada once segundos pase lo que pase.
 */
const SEGUNDOS_PARA_SOLTAR_SOLO = 2;

/** Cuántos números de daño se pintan a la vez. Más es ruido, no información. */
const NUMEROS_MAXIMOS = 14;

/** Lo que dura un número de daño en pantalla. */
const SEGUNDOS_DEL_NUMERO = 0.55;

/**
 * El paso de simulación más largo que se admite, en segundos.
 *
 * Si la pestaña se esconde, `requestAnimationFrame` se para pero el reloj no, y
 * al volver el primer fotograma valdría treinta segundos. Simularlos de golpe
 * sería aparecer muerto por haber mirado el correo. Se topa en tres fotogramas
 * de los lentos y se sigue.
 */
const PASO_MAXIMO = 0.05;

/** Las cuatro familias, en el orden en que se enseñan abajo. */
const FAMILIAS: readonly FamiliaDeArma[] = ['onda', 'aura', 'rastro', 'orbita'];

/** Cómo se llama y de qué color es cada familia. */
const FICHA_DE_FAMILIA: Record<
  FamiliaDeArma,
  { nombre: string; dice: string; color: string; clase: string }
> = {
  onda: {
    nombre: 'Onda',
    dice: 'empuja y congela lo que toca',
    color: '#38bdf8',
    clase: 'text-sky-600 dark:text-sky-400',
  },
  aura: {
    nombre: 'Aura',
    dice: 'muerde todo lo que se te pegue',
    color: '#a3e635',
    clase: 'text-lime-600 dark:text-lime-400',
  },
  rastro: {
    nombre: 'Rastro',
    dice: 'persigue y atraviesa',
    color: '#f472b6',
    clase: 'text-pink-600 dark:text-pink-400',
  },
  orbita: {
    nombre: 'Órbita',
    dice: 'esquirlas girando a tu alrededor',
    color: '#fbbf24',
    clase: 'text-amber-600 dark:text-amber-400',
  },
};

/** Cómo se le dice al servidor que el cofre se cerró sin elegir. */
const SIN_CERRAR = 'nada';

/* ════════════════════════  EL MUNDO  ════════════════════════ */

interface Sombra {
  x: number;
  y: number;
  vida: number;
  /** El rumbo que lleva. Solo se usa por turnos; si no, apunta a Milo siempre. */
  rx: number;
  ry: number;
  /** Hasta qué segundo está congelada por una onda. */
  quietaHasta: number;
  /** El empuje que le queda, en unidades por segundo. */
  ex: number;
  ey: number;
  /** Cuándo puede volver a morderle el aura y la órbita. */
  proximoAura: number;
  proximoOrbita: number;
  /** La última onda que ya le tocó, para que una onda no golpee dos veces. */
  ultimaOnda: number;
}

interface Bala {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dano: number;
  /** Cuántas sombras más puede atravesar. */
  perfora: number;
  color: string;
}

interface Onda {
  id: number;
  x: number;
  y: number;
  radio: number;
  radioMax: number;
  dano: number;
}

interface Orbe {
  clase: 'verbo' | 'particula';
  texto: string;
  x: number;
  y: number;
}

interface NumeroVolando {
  x: number;
  y: number;
  valor: number;
  hasta: number;
}

/** Lo que el mundo le cuenta a la pantalla cuando pasa algo que hay que contar. */
type EventoDeHorda =
  | { tipo: 'forja'; escenaId: string; compuesto: string; acierto: boolean }
  | { tipo: 'cofre-abierto'; cofreId: string; respuesta: string; acierto: boolean }
  | { tipo: 'roce' }
  | { tipo: 'fin'; motivo: 'muerte' | 'tiempo' };

interface Mundo {
  /**
   * Si la partida va POR TURNOS, que es lo que pasa con movimiento reducido.
   *
   * Lo que cambia no es la física —esa se simula igual de fino en los dos
   * modos— sino que TODO EL MUNDO se compromete a un rumbo durante el turno:
   * quien juega elige el suyo una vez y las sombras el suyo también.
   *
   * Lo segundo es imprescindible y costó descubrirlo. Con las sombras
   * persiguiendo a Milo sin parar mientras él se quedaba clavado en una
   * dirección, esquivar era imposible: medido con el jugador simulado, forjar
   * al 100 % daba el mismo resultado que forjar al 0 %, o sea morir en el
   * segundo 35. Un juego donde el inglés no cambia nada es exactamente lo que
   * este archivo existe para no hacer, y lo era solo con movimiento reducido,
   * que es la forma más fea de que ocurra.
   *
   * Con las dos partes comprometidas, el tablero se puede LEER: cada sombra
   * lleva un rumbo, se ve hacia dónde va y se elige por dónde salir. Eso es lo
   * que convierte un juego de reflejos en uno de decisiones sin quitarle nada.
   */
  porTurnos: boolean;
  /** Lo que dura un turno, en milisegundos. Cero si la partida va seguida. */
  msTurno: number;
  /** Hasta qué segundo vale el rumbo de ahora. */
  rumboHasta: number;
  /** Los segundos de partida transcurridos. No corre mientras hay un cofre. */
  t: number;
  milo: { x: number; y: number };
  /** Hacia dónde empuja quien juega, ya normalizado. */
  dir: { x: number; y: number };
  sombras: Sombra[];
  balas: Bala[];
  ondas: Onda[];
  esquirlas: number;
  anguloOrbita: number;
  numeros: NumeroVolando[];
  orbes: Orbe[];
  /** Los orbes de la escena que todavía no ha soltado ninguna sombra. */
  pendientes: Orbe[];
  /** Cuándo toca soltar solo el siguiente pendiente. */
  soltarSoloEn: number;
  vidas: number;
  invulnerableHasta: number;
  /** Hasta qué segundo la horda está parada: se falló una forja. */
  aturdidaHasta: number;
  /** El verbo que Milo lleva encima, si lleva alguno. */
  cargado: string | null;
  cargadoEn: number;
  escenaIndice: number;
  /** Mientras no llega la hora, la escena siguiente no reparte orbes. */
  escenaDesde: number;
  cofreIndice: number;
  /** El cofre que hay puesto en la arena esperando a que Milo lo toque. */
  cofreEnArena: { x: number; y: number } | null;
  proximoCofreEn: number;
  /** El cofre abierto: mientras está, el mundo no avanza. */
  cofreAbierto: { indice: number; abiertoEn: number; ventanaMs: number } | null;
  /** Cuántos cofres seguidos se llevan bien. Es lo que aprieta el reflejo. */
  pasoDeCofre: number;
  rangos: Record<FamiliaDeArma, number>;
  proximoDisparoBase: number;
  proximoDisparo: Record<FamiliaDeArma, number>;
  sembrador: number;
  aciertos: number;
  contestadas: number;
  racha: number;
  rachaMaxima: number;
  /** El anillo que sale de Milo al forjar. Sustituye al destello de pantalla. */
  pulso: { hasta: number; bueno: boolean } | null;
  terminado: 'muerte' | 'tiempo' | null;
  eventos: EventoDeHorda[];
  azar: () => number;
  siguienteOnda: number;
}

/** Mulberry32, el mismo generador que usa `barajar.ts` en el servidor. */
function generador(semilla: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < semilla.length; i += 1) {
    h ^= semilla.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mundoNuevo(ronda: RondaDeHorda, semilla: string, msTurno = 0): Mundo {
  return {
    porTurnos: msTurno > 0,
    msTurno,
    rumboHasta: 0,
    t: 0,
    milo: { x: ronda.arena.ancho / 2, y: ronda.arena.alto / 2 },
    dir: { x: 0, y: 0 },
    sombras: [],
    balas: [],
    ondas: [],
    esquirlas: 0,
    anguloOrbita: 0,
    numeros: [],
    orbes: [],
    pendientes: [],
    soltarSoloEn: 0,
    vidas: ronda.partida.vidas,
    invulnerableHasta: 0,
    aturdidaHasta: 0,
    cargado: null,
    cargadoEn: -1,
    escenaIndice: 0,
    escenaDesde: 0,
    cofreIndice: 0,
    cofreEnArena: null,
    proximoCofreEn: ronda.partida.segundosEntreCofres,
    cofreAbierto: null,
    pasoDeCofre: 0,
    rangos: { onda: 0, aura: 0, rastro: 0, orbita: 0 },
    proximoDisparoBase: 0,
    proximoDisparo: { onda: 0, aura: 0, rastro: 0, orbita: 0 },
    sembrador: 0,
    aciertos: 0,
    contestadas: 0,
    racha: 0,
    rachaMaxima: 0,
    pulso: null,
    terminado: null,
    eventos: [],
    azar: generador(semilla),
    siguienteOnda: 1,
  };
}

/** La parte de la partida que va corrida, de 0 a 1. */
function parte(mundo: Mundo, ronda: RondaDeHorda): number {
  return Math.min(Math.max(mundo.t / ronda.partida.segundos, 0), 1);
}

function entre(a: number, b: number, cuanto: number): number {
  return a + (b - a) * cuanto;
}

/* ════════════════════════  LA SIMULACIÓN  ════════════════════════ */

/**
 * Un paso del mundo. Es la única función que mueve algo, y no toca el DOM.
 *
 * Que sea pura —entra un mundo y un rato, sale el mundo un rato después— es lo
 * que permite las dos cosas que este juego necesitaba:
 *
 *   - el modo de turnos de `prefers-reduced-motion` es ESTA MISMA función
 *     llamada una vez cada turno y medio con un paso grande, así que no es un
 *     juego distinto con las mismas palabras: es el mismo juego a otro ritmo;
 *   - y el jugador simulado con el que está medido todo lo del informe puede
 *     jugar mil partidas sin pintar un píxel ni esperar tres minutos.
 */
function avanzar(mundo: Mundo, dt: number, ronda: RondaDeHorda): void {
  if (mundo.terminado || mundo.cofreAbierto) return;

  const { arena, oleada, arma } = ronda;
  mundo.t += dt;

  if (mundo.t >= ronda.partida.segundos) {
    mundo.terminado = 'tiempo';
    mundo.eventos.push({ tipo: 'fin', motivo: 'tiempo' });
    return;
  }

  const cuanto = parte(mundo, ronda);
  const quieta = mundo.t < mundo.aturdidaHasta;

  moverMilo(mundo, ronda, dt);
  repartirOrbes(mundo, ronda);
  recogerOrbes(mundo, ronda);
  ponerCofre(mundo, ronda);

  if (!quieta) {
    sembrar(mundo, ronda, dt, cuanto);
    moverSombras(mundo, ronda, dt, cuanto);
  }

  disparar(mundo, arma, dt);
  moverBalas(mundo, arena, dt);
  moverOndas(mundo, dt);
  morderConAura(mundo, arma);
  girarEsquirlas(mundo, arma);

  if (!quieta) tocarAMilo(mundo, ronda);

  limpiar(mundo, oleada);
}

function moverMilo(mundo: Mundo, ronda: RondaDeHorda, dt: number): void {
  const { arena } = ronda;
  const paso = arena.velocidadMilo * dt;
  mundo.milo.x = acotar(mundo.milo.x + mundo.dir.x * paso, arena.radioMilo, arena.ancho);
  mundo.milo.y = acotar(mundo.milo.y + mundo.dir.y * paso, arena.radioMilo, arena.alto);
}

function acotar(valor: number, margen: number, tope: number): number {
  return Math.min(Math.max(valor, margen), tope - margen);
}

/**
 * Las sombras salen del borde, y salen del borde MÁS LEJANO a Milo.
 *
 * No es generosidad: es que en una arena de 288 píxeles, una sombra que aparece
 * a dos centímetros del jugador no se puede esquivar aunque se vea venir, y
 * perder una vida por algo que no se podía evitar es lo que hace que un juego se
 * sienta tramposo. Sale del borde y desde ahí se gana el acercamiento.
 */
function sembrar(mundo: Mundo, ronda: RondaDeHorda, dt: number, cuanto: number): void {
  const { arena, oleada } = ronda;
  const porSegundo = entre(oleada.aparicionInicial, oleada.aparicionFinal, cuanto);
  mundo.sembrador += porSegundo * dt;

  while (mundo.sembrador >= 1) {
    mundo.sembrador -= 1;
    if (mundo.sombras.length >= oleada.maximoSombras) continue;

    const vida = entre(oleada.vidaInicial, oleada.vidaFinal, cuanto);
    const lado = Math.floor(mundo.azar() * 4);
    const largo = lado % 2 === 0 ? arena.ancho : arena.alto;
    const donde = mundo.azar() * largo;

    let x = 0;
    let y = 0;
    if (lado === 0) {
      x = donde;
      y = -arena.radioSombra;
    } else if (lado === 1) {
      x = arena.ancho + arena.radioSombra;
      y = donde;
    } else if (lado === 2) {
      x = donde;
      y = arena.alto + arena.radioSombra;
    } else {
      x = -arena.radioSombra;
      y = donde;
    }

    // Si le sale pegada, se cambia al lado de enfrente.
    if (Math.hypot(x - mundo.milo.x, y - mundo.milo.y) < arena.ancho / 3) {
      x = arena.ancho - x;
      y = arena.alto - y;
    }

    mundo.sombras.push({
      x,
      y,
      vida,
      rx: 0,
      ry: 0,
      quietaHasta: 0,
      ex: 0,
      ey: 0,
      proximoAura: 0,
      proximoOrbita: 0,
      ultimaOnda: 0,
    });
  }
}

function moverSombras(mundo: Mundo, ronda: RondaDeHorda, dt: number, cuanto: number): void {
  const { arena, oleada } = ronda;
  const velocidad = entre(oleada.velocidadInicial, oleada.velocidadFinal, cuanto);

  // Por turnos, todas las sombras fijan su rumbo a la vez y lo mantienen. Es la
  // otra mitad del compromiso: quien juega elige una dirección por turno y
  // ellas también, así que el tablero se puede leer antes de decidir.
  const fijarRumbo = mundo.porTurnos && mundo.t >= mundo.rumboHasta;
  if (fijarRumbo) mundo.rumboHasta = mundo.t + mundo.msTurno / 1000;

  for (const sombra of mundo.sombras) {
    // El empuje de la onda se va frenando solo.
    if (sombra.ex !== 0 || sombra.ey !== 0) {
      sombra.x += sombra.ex * dt;
      sombra.y += sombra.ey * dt;
      const freno = Math.max(0, 1 - dt * 5);
      sombra.ex *= freno;
      sombra.ey *= freno;
      if (Math.abs(sombra.ex) < 0.4) sombra.ex = 0;
      if (Math.abs(sombra.ey) < 0.4) sombra.ey = 0;
    }

    if (mundo.t < sombra.quietaHasta) continue;

    if (!mundo.porTurnos || fijarRumbo || (sombra.rx === 0 && sombra.ry === 0)) {
      const dx = mundo.milo.x - sombra.x;
      const dy = mundo.milo.y - sombra.y;
      const largo = Math.hypot(dx, dy) || 1;
      sombra.rx = dx / largo;
      sombra.ry = dy / largo;
    }

    sombra.x += sombra.rx * velocidad * dt;
    sombra.y += sombra.ry * velocidad * dt;

    // No se salen del todo: una sombra empujada fuera del borde vuelve.
    sombra.x = Math.min(
      Math.max(sombra.x, -arena.radioSombra * 2),
      arena.ancho + arena.radioSombra * 2,
    );
    sombra.y = Math.min(
      Math.max(sombra.y, -arena.radioSombra * 2),
      arena.alto + arena.radioSombra * 2,
    );
  }
}

/** La sombra más cercana a Milo, que es a la que apunta todo. */
function masCercana(mundo: Mundo): Sombra | null {
  let elegida: Sombra | null = null;
  let mejor = Infinity;
  for (const sombra of mundo.sombras) {
    const d = (sombra.x - mundo.milo.x) ** 2 + (sombra.y - mundo.milo.y) ** 2;
    if (d < mejor) {
      mejor = d;
      elegida = sombra;
    }
  }
  return elegida;
}

/**
 * EL NIVEL DEL ARMA SON LOS ACIERTOS. No hay otra fuente de potencia.
 *
 * Cada compuesto bien forjado y cada cofre bien abierto suben uno; matar no
 * sube nada. De ahí sale el daño —`danoFamilia × factorPorNivel^(nivel-1)`— y
 * de ahí sale la cadencia, que baja un 6 % por nivel. Entre los dos, cada
 * respuesta buena multiplica por 1,24 lo que el arma hace por segundo.
 *
 * Las familias abiertas NO suman potencia: se la reparten. Es lo que arregló
 * el sorteo que había antes, cuando cada familia tenía su propio rango: el
 * contenido no reparte las familias por igual —hay doce compuestos de ONDA y
 * tres de RASTRO— así que dos partidas con la misma forja acababan una con el
 * doble de arma que la otra, y eso no lo decidía quien jugaba.
 *
 * Lo que sí aporta abrir formas es CUBRIR MÁS SITIO con la misma fuerza, que en
 * un juego de hordas vale mucho y no se puede convertir en un número.
 */
function nivelDelArma(mundo: Mundo): number {
  return mundo.aciertos;
}

function disparar(mundo: Mundo, arma: RondaDeHorda['arma'], dt: number): void {
  const ms = mundo.t * 1000;

  // Un `while` y no un `if`: si un paso de simulación durase más que la
  // cadencia, un `if` se comería disparos en silencio. El tope de tres es para
  // que volver de una pestaña escondida no dispare una ráfaga de golpe.
  let tiros = 0;
  while (ms >= mundo.proximoDisparoBase && tiros < 3) {
    tiros += 1;
    mundo.proximoDisparoBase = Math.max(mundo.proximoDisparoBase + arma.cadenciaBaseMs, ms);
    const objetivo = masCercana(mundo);
    if (objetivo) lanzarBala(mundo, objetivo, arma.danoBase, 0, '#94a3b8');
  }

  const nivel = nivelDelArma(mundo);
  if (nivel <= 0) {
    mundo.esquirlas = 0;
    return;
  }

  const cadencia = arma.cadenciaFamiliaMs * arma.factorCadencia ** (nivel - 1);

  for (const familia of FAMILIAS) {
    if (mundo.rangos[familia] <= 0) continue;
    if (familia === 'aura' || familia === 'orbita') continue;
    if (ms < mundo.proximoDisparo[familia]) continue;

    mundo.proximoDisparo[familia] = ms + cadencia;
    const dano = danoDe(mundo, arma, familia);

    if (familia === 'rastro') {
      const objetivo = masCercana(mundo);
      if (objetivo) {
        lanzarBala(mundo, objetivo, dano, Math.floor(nivel / 5), FICHA_DE_FAMILIA.rastro.color);
      }
    } else {
      mundo.ondas.push({
        id: mundo.siguienteOnda++,
        x: mundo.milo.x,
        y: mundo.milo.y,
        radio: 4,
        radioMax: 20 + Math.min(nivel, 14) * 1.6,
        dano,
      });
    }
  }

  // La órbita gira siempre; lo que crece con el nivel es cuántas esquirlas hay.
  mundo.esquirlas = mundo.rangos.orbita > 0 ? Math.min(1 + Math.floor(nivel / 4), 6) : 0;
  mundo.anguloOrbita += dt * 2.2;
}

/**
 * Lo que hace un golpe de esta forma, con el reparto entre las abiertas.
 *
 * Las partes suman uno, así que el daño por objetivo del arma entera es
 * exactamente `danoPorSegundo(nivel)` del servidor, se tengan una forma o
 * cuatro. Esa igualdad es lo que permite calibrar la curva de la horda contra
 * una sola fórmula en vez de contra lo que salga.
 */
function danoDe(mundo: Mundo, arma: RondaDeHorda['arma'], familia: FamiliaDeArma): number {
  const nivel = nivelDelArma(mundo);
  let reparto = 0;
  for (const otra of FAMILIAS) {
    if (mundo.rangos[otra] > 0) reparto += arma.multiplicadores[otra];
  }
  if (reparto <= 0) return 0;

  return (
    arma.danoFamilia *
    arma.factorPorNivel ** (nivel - 1) *
    (arma.multiplicadores[familia] / reparto)
  );
}

function lanzarBala(
  mundo: Mundo,
  objetivo: Sombra,
  dano: number,
  perfora: number,
  color: string,
): void {
  const dx = objetivo.x - mundo.milo.x;
  const dy = objetivo.y - mundo.milo.y;
  const largo = Math.hypot(dx, dy) || 1;
  mundo.balas.push({
    x: mundo.milo.x,
    y: mundo.milo.y,
    vx: (dx / largo) * 80,
    vy: (dy / largo) * 80,
    dano,
    perfora,
    color,
  });
}

function moverBalas(mundo: Mundo, arena: RondaDeHorda['arena'], dt: number): void {
  for (let i = mundo.balas.length - 1; i >= 0; i -= 1) {
    const bala = mundo.balas[i]!;
    bala.x += bala.vx * dt;
    bala.y += bala.vy * dt;

    if (bala.x < -10 || bala.y < -10 || bala.x > arena.ancho + 10 || bala.y > arena.alto + 10) {
      mundo.balas.splice(i, 1);
      continue;
    }

    for (const sombra of mundo.sombras) {
      if (sombra.vida <= 0) continue;
      if (Math.hypot(sombra.x - bala.x, sombra.y - bala.y) > arena.radioSombra + 2) continue;

      herir(mundo, sombra, bala.dano);
      if (bala.perfora <= 0) {
        mundo.balas.splice(i, 1);
        break;
      }
      bala.perfora -= 1;
    }
  }
}

function moverOndas(mundo: Mundo, dt: number): void {
  for (let i = mundo.ondas.length - 1; i >= 0; i -= 1) {
    const onda = mundo.ondas[i]!;
    onda.radio += dt * 95;
    if (onda.radio >= onda.radioMax) {
      mundo.ondas.splice(i, 1);
      continue;
    }

    for (const sombra of mundo.sombras) {
      if (sombra.vida <= 0 || sombra.ultimaOnda === onda.id) continue;
      const dx = sombra.x - onda.x;
      const dy = sombra.y - onda.y;
      const d = Math.hypot(dx, dy);
      if (d > onda.radio) continue;

      sombra.ultimaOnda = onda.id;
      herir(mundo, sombra, onda.dano);
      // Empuja y congela medio segundo: es la onda de choque congelante que
      // pidió el encargo para TURN + OFF.
      const largo = d || 1;
      sombra.ex = (dx / largo) * 55;
      sombra.ey = (dy / largo) * 55;
      sombra.quietaHasta = mundo.t + 0.5;
    }
  }
}

function morderConAura(mundo: Mundo, arma: RondaDeHorda['arma']): void {
  const nivel = nivelDelArma(mundo);
  if (mundo.rangos.aura <= 0 || nivel <= 0) return;

  const radio = radioDelAura(mundo);
  const dano = danoDe(mundo, arma, 'aura');
  const cada = (arma.cadenciaFamiliaMs * arma.factorCadencia ** (nivel - 1)) / 1000;

  for (const sombra of mundo.sombras) {
    if (sombra.vida <= 0 || mundo.t < sombra.proximoAura) continue;
    if (Math.hypot(sombra.x - mundo.milo.x, sombra.y - mundo.milo.y) > radio) continue;
    sombra.proximoAura = mundo.t + cada;
    herir(mundo, sombra, dano);
  }
}

/** El halo del aura crece con el nivel, pero con techo: no puede tapar la arena. */
function radioDelAura(mundo: Mundo): number {
  return 14 + Math.min(nivelDelArma(mundo), 12) * 1.1;
}

function girarEsquirlas(mundo: Mundo, arma: RondaDeHorda['arma']): void {
  const nivel = nivelDelArma(mundo);
  if (mundo.rangos.orbita <= 0 || mundo.esquirlas <= 0 || nivel <= 0) return;

  const dano = danoDe(mundo, arma, 'orbita');
  const cada = (arma.cadenciaFamiliaMs * arma.factorCadencia ** (nivel - 1)) / 1000;
  const radio = 20;

  for (let i = 0; i < mundo.esquirlas; i += 1) {
    const angulo = mundo.anguloOrbita + (i * 2 * Math.PI) / mundo.esquirlas;
    const ex = mundo.milo.x + Math.cos(angulo) * radio;
    const ey = mundo.milo.y + Math.sin(angulo) * radio;

    for (const sombra of mundo.sombras) {
      if (sombra.vida <= 0 || mundo.t < sombra.proximoOrbita) continue;
      if (Math.hypot(sombra.x - ex, sombra.y - ey) > 6) continue;
      sombra.proximoOrbita = mundo.t + cada;
      herir(mundo, sombra, dano);
    }
  }
}

/**
 * Una sombra recibe daño, y ese es el número que vuela.
 *
 * Conviene decir qué NO es ese número: no son puntos. Matar no paga ni una
 * moneda ni un punto en este juego, y por eso el daño se pinta dentro de la
 * arena, pequeño y en el color de la familia, mientras que los puntos viven
 * arriba en su contador con su etiqueta. Un número que sube por la pantalla y
 * no aparece luego en el marcador es justo lo que hace que un juego se lea como
 * un engaño, así que los dos sitios no se parecen en nada a propósito.
 */
function herir(mundo: Mundo, sombra: Sombra, dano: number): void {
  sombra.vida -= dano;

  if (mundo.numeros.length < NUMEROS_MAXIMOS) {
    mundo.numeros.push({
      x: sombra.x,
      y: sombra.y,
      valor: Math.max(1, Math.round(dano)),
      hasta: mundo.t + SEGUNDOS_DEL_NUMERO,
    });
  }

  if (sombra.vida <= 0 && mundo.pendientes.length > 0) mundo.soltarSoloEn = mundo.t;
}

/**
 * Los orbes los sueltan las sombras al morir, que es lo que pidió el dueño.
 *
 * Con una red debajo: si en tres segundos ninguna sombra ha soltado el que
 * falta, cae solo. Sin esa red hay una partida posible sin juego —arma floja,
 * pocas muertes, ningún orbe, arma más floja todavía— y dejar que exista sería
 * dejar que el juego se atasque justo a quien peor le va.
 */
function soltarPendiente(mundo: Mundo, ronda: RondaDeHorda, x: number, y: number): void {
  const orbe = mundo.pendientes.shift();
  if (!orbe) return;
  orbe.x = x;
  orbe.y = y;
  mundo.orbes.push(orbe);
  colocar(mundo, ronda);
}

function repartirOrbes(mundo: Mundo, ronda: RondaDeHorda): void {
  const escena = ronda.escenas[mundo.escenaIndice];
  if (!escena) return;

  // Todavía se está leyendo el compuesto de la escena anterior.
  if (mundo.t < mundo.escenaDesde) return;

  if (mundo.orbes.length === 0 && mundo.pendientes.length === 0) {
    mundo.pendientes = orbesDe(escena);
    mundo.soltarSoloEn = mundo.t + SEGUNDOS_PARA_SOLTAR_SOLO;
    mundo.cargado = null;
  }

  // Y caen TODOS los que falten a la vez, no uno cada vez: con cinco orbes y
  // uno cada dos segundos, la escena tardaba diez en estar completa.
  while (mundo.pendientes.length > 0 && mundo.t >= mundo.soltarSoloEn) {
    const sitio = sitioLibre(mundo, ronda);
    soltarPendiente(mundo, ronda, sitio.x, sitio.y);
  }
}

function orbesDe(escena: EscenaDeHorda): Orbe[] {
  return [
    ...escena.verbos.map((texto) => ({ clase: 'verbo' as const, texto, x: 0, y: 0 })),
    ...escena.particulas.map((texto) => ({ clase: 'particula' as const, texto, x: 0, y: 0 })),
  ];
}

/**
 * Dónde cae un orbe que ninguna sombra ha soltado.
 *
 * Lejos de los otros orbes —elegir tiene que ser una decisión, no una
 * carambola— pero A MEDIA DISTANCIA de Milo, ni encima ni en la otra punta. La
 * primera versión lo ponía lo más lejos posible de todo, Milo incluido, y eso
 * se pagaba en preguntas: con la arena entera de por medio, cada compuesto
 * costaba treinta segundos de caminata y una partida daba tres preguntas en vez
 * de trece. Entre veinte y cincuenta unidades hay sitio para esquivar de camino
 * sin que ir a por una palabra sea una excursión.
 *
 * Son doce tiradas y se queda la mejor. Buscar el sitio perfecto en una arena
 * con cinco orbes no merece un bucle que pueda no acabar nunca.
 */
function sitioLibre(mundo: Mundo, ronda: RondaDeHorda): { x: number; y: number } {
  const { arena } = ronda;
  let mejor = { x: arena.ancho / 2, y: arena.alto / 2 };
  let mejorNota = -Infinity;

  for (let i = 0; i < 12; i += 1) {
    const x = arena.radioOrbe + mundo.azar() * (arena.ancho - arena.radioOrbe * 2);
    const y = arena.radioOrbe + mundo.azar() * (arena.alto - arena.radioOrbe * 2);
    const deMilo = Math.hypot(x - mundo.milo.x, y - mundo.milo.y);

    let deOtros = 999;
    for (const otro of mundo.orbes) {
      deOtros = Math.min(deOtros, Math.hypot(x - otro.x, y - otro.y));
    }

    const nota =
      Math.min(deOtros, SEPARACION_ORBES) * 2 -
      Math.max(0, SEPARACION_DE_MILO + 6 - deMilo) * 3 -
      Math.max(0, deMilo - 62);

    if (nota > mejorNota) {
      mejorNota = nota;
      mejor = { x, y };
    }
  }
  return mejor;
}

/**
 * Separa los orbes UNA VEZ, al caer uno nuevo, y después ya no se mueven.
 *
 * Las dos mitades importan.
 *
 * Que se separen: si la partícula buena y una señuelo caen a diez píxeles,
 * recoger la que quieres deja de depender de saber cuál es y pasa a depender
 * del dedo. Se apartan hasta `SEPARACION_ORBES`, que a 320 px son 86 píxeles.
 *
 * Y que se quieten: la primera versión los reajustaba en cada fotograma, y eso
 * tenía un fallo que solo apareció midiendo. Mientras Milo no lleva verbo, los
 * orbes también se apartan de él; en cuanto coge uno, dejan de hacerlo —si no,
 * ninguna partícula se podría pisar nunca— pero seguían empujándose entre
 * ellos, y un empujón podía meter una partícula equivocada justo encima de
 * Milo. Resultado: una pregunta contestada que nadie había contestado. De cada
 * cien escenas que el jugador simulado pretendía acertar, se le colaban
 * veintidós así. Colocados una vez y quietos, cero.
 */
function colocar(mundo: Mundo, ronda: RondaDeHorda): void {
  const { arena } = ronda;

  // Cuatro pasadas de relajación bastan para cinco orbes; no hace falta que
  // converja del todo, hace falta que no se toquen.
  for (let pasada = 0; pasada < 4; pasada += 1) {
    for (const orbe of mundo.orbes) {
      for (const otro of mundo.orbes) {
        if (otro === orbe) continue;
        const dx = orbe.x - otro.x;
        const dy = orbe.y - otro.y;
        const d = Math.hypot(dx, dy);
        if (d >= SEPARACION_ORBES || d === 0) continue;
        const empuje = (SEPARACION_ORBES - d) / 2;
        orbe.x += (dx / d) * empuje;
        orbe.y += (dy / d) * empuje;
      }

      const dmx = orbe.x - mundo.milo.x;
      const dmy = orbe.y - mundo.milo.y;
      const dm = Math.hypot(dmx, dmy) || 1;
      if (dm < SEPARACION_DE_MILO) {
        orbe.x += (dmx / dm) * (SEPARACION_DE_MILO - dm);
        orbe.y += (dmy / dm) * (SEPARACION_DE_MILO - dm);
      }

      orbe.x = acotar(orbe.x, arena.radioOrbe, arena.ancho);
      orbe.y = acotar(orbe.y, arena.radioOrbe * 0.7, arena.alto);
    }
  }
}

/**
 * Recoger un orbe: primero el verbo, después la partícula.
 *
 * Los dos orbes de verbo se quedan en el suelo aunque ya se haya cogido uno, a
 * propósito: cambiar de idea es legítimo y no cuesta nada. Lo que cierra el
 * compuesto —y por tanto lo que puntúa— es la partícula, y por eso las
 * partículas están APAGADAS mientras no se lleva verbo: sin eso, pisar una
 * mientras esquivas sería fallar una pregunta que no habías contestado.
 *
 * Y hay tres décimas de gracia tras coger el verbo, porque un orbe de verbo y
 * uno de partícula pueden estar lo bastante cerca como para tocarse los dos en
 * el mismo fotograma.
 */
function recogerOrbes(mundo: Mundo, ronda: RondaDeHorda): void {
  const escena = ronda.escenas[mundo.escenaIndice];
  if (!escena) return;

  for (const orbe of mundo.orbes) {
    const dx = Math.abs(orbe.x - mundo.milo.x);
    const dy = Math.abs(orbe.y - mundo.milo.y);

    /*
      LOS DOS ORBES SE COGEN PISANDO LA PASTILLA, Y ESTO NO ES UN DETALLE.

      El alcance es la pastilla y nada más —18 por 11 unidades, o sea 52 por 32
      píxeles a 320—, y no el círculo generoso que tenía al principio. Medido
      con el jugador simulado: con el alcance generoso, quien iba a por el orbe
      bueno rozaba el otro por el camino, y como rozar un verbo LO CAMBIA en
      silencio, se cerraban compuestos que nadie había elegido. De 100 escenas
      que el muñeco pretendía acertar, acertaba 84. O sea que dieciséis de cada
      cien preguntas las decidía la trayectoria del dedo, que es exactamente lo
      que este juego no puede permitirse.

      Con la pastilla justa y treinta unidades de separación entre orbes, esas
      dieciséis desaparecieron: lo que se cierra es siempre lo que se eligió.
    */
    if (dx > ronda.arena.radioOrbe * 0.9) continue;
    if (dy > 5.5) continue;

    if (orbe.clase === 'verbo') {
      if (mundo.cargado !== null) continue;
      /*
        COGER UN VERBO ES COMPROMETERSE: EL OTRO DESAPARECE.

        Antes los dos se quedaban en el suelo y pisar el otro cambiaba el verbo
        en silencio. Sonaba generoso —«cambiar de idea es legítimo»— y medido
        era una trampa: el muñeco que iba a por la partícula buena con el verbo
        bueno encima rozaba el otro verbo de camino y cerraba un compuesto que
        no había elegido. De cada cien escenas que pretendía acertar, cerraba
        mal veinte, y esas veinte no las decidía el inglés: las decidía por
        dónde pasó.

        Con el verbo comprometido eso no puede ocurrir. Lo que se pierde es
        poder rectificar, y se pierde poco: pisar la pastilla justa ya es
        deliberado, y si de verdad te equivocas de verbo, cierras el compuesto,
        ves el bueno escrito con su significado y sigues. Fallar aquí enseña.
      */
      mundo.cargado = orbe.texto;
      mundo.cargadoEn = mundo.t;
      mundo.orbes = mundo.orbes.filter(
        (otro) => otro.clase !== 'verbo' || otro.texto === orbe.texto,
      );
      return;
    }

    /* Y la partícula, además, CIERRA el compuesto: es la respuesta. */
    if (mundo.cargado === null) continue;
    if (mundo.t - mundo.cargadoEn < MS_GRACIA_TRAS_VERBO / 1000) continue;

    cerrarCompuesto(mundo, escena, `${mundo.cargado} ${orbe.texto}`);
    return;
  }
}

function cerrarCompuesto(mundo: Mundo, escena: EscenaDeHorda, compuesto: string): void {
  const acierto = compuesto === escena.compuesto;

  mundo.orbes = [];
  mundo.pendientes = [];
  mundo.cargado = null;
  mundo.contestadas += 1;
  mundo.racha = acierto ? mundo.racha + 1 : 0;
  mundo.rachaMaxima = Math.max(mundo.rachaMaxima, mundo.racha);
  mundo.pulso = { hasta: mundo.t + 0.45, bueno: acierto };

  if (acierto) {
    mundo.aciertos += 1;
    mundo.rangos[escena.familia] += 1;
    mundo.escenaDesde = mundo.t + MS_LECCION_ACIERTO / 1000;
  } else {
    // La horda se para mientras se lee el compuesto bueno, y Milo no recibe
    // daño: leer con tres sombras encima no lo lee nadie.
    mundo.aturdidaHasta = mundo.t + MS_ATURDIDO / 1000;
    mundo.invulnerableHasta = Math.max(mundo.invulnerableHasta, mundo.aturdidaHasta);
    mundo.escenaDesde = mundo.t + MS_LECCION_FALLO / 1000;
  }

  mundo.escenaIndice += 1;
  mundo.eventos.push({ tipo: 'forja', escenaId: escena.id, compuesto, acierto });
}

/** El cofre aparece solo, lejos de Milo, y espera a que lo toque. */
function ponerCofre(mundo: Mundo, ronda: RondaDeHorda): void {
  if (mundo.cofreEnArena || mundo.t < mundo.proximoCofreEn) return;
  if (!ronda.cofres[mundo.cofreIndice]) return;

  mundo.cofreEnArena = sitioLibre(mundo, ronda);
}

/** ¿Milo llegó al cofre? Entonces el mundo se para y hay modismo que completar. */
function tocarCofre(mundo: Mundo, ronda: RondaDeHorda): boolean {
  if (!mundo.cofreEnArena || mundo.cofreAbierto) return false;
  const cofre = ronda.cofres[mundo.cofreIndice];
  if (!cofre) return false;

  const d = Math.hypot(mundo.cofreEnArena.x - mundo.milo.x, mundo.cofreEnArena.y - mundo.milo.y);
  if (d > ronda.arena.radioMilo + ronda.arena.radioOrbe) return false;

  const escalon = ronda.reloj.escalones;
  const reflejo = escalon[Math.min(mundo.pasoDeCofre, escalon.length - 1)] ?? escalon[0] ?? 1800;

  mundo.cofreAbierto = {
    indice: mundo.cofreIndice,
    abiertoEn: mundo.t,
    // La ventana es LO QUE CUESTA LEER ESTE COFRE más el trozo de acordarse y
    // pulsar, que es el único que se aprieta al encadenar. Está razonado en
    // `horda.ts`: los dos segundos del encargo no dan ni para leerlo.
    ventanaMs: cofre.lecturaMs + reflejo,
  };
  return true;
}

/** Se eligió una opción del cofre, o se acabó su ventana. */
function resolverCofre(mundo: Mundo, ronda: RondaDeHorda, respuesta: string): void {
  const abierto = mundo.cofreAbierto;
  if (!abierto) return;
  const cofre = ronda.cofres[abierto.indice];
  if (!cofre) return;

  const acierto = respuesta !== SIN_CERRAR && respuesta === cofre.correcta;

  mundo.cofreAbierto = null;
  mundo.cofreEnArena = null;
  mundo.cofreIndice += 1;
  mundo.proximoCofreEn = mundo.t + ronda.partida.segundosEntreCofres;
  mundo.contestadas += 1;
  mundo.racha = acierto ? mundo.racha + 1 : 0;
  mundo.rachaMaxima = Math.max(mundo.rachaMaxima, mundo.racha);
  mundo.pasoDeCofre = acierto
    ? mundo.pasoDeCofre + 1
    : Math.max(mundo.pasoDeCofre - ronda.reloj.pasosAtrasAlFallar, 0);

  if (acierto) {
    /*
      El premio del cofre: LA PANTALLA SE LIMPIA y el arma sube un nivel.

      Sube por lo mismo que sube al forjar —es un acierto de inglés, y el nivel
      del arma son los aciertos— así que aquí no hay que hacer nada: basta con
      apuntarlo. Lo que sí hace falta es la limpieza, y es el momento de
      «volverse absurdamente poderoso» que pedía el encargo: llegas al cofre con
      la arena llena, aciertas el modismo y te quedas solo.

      Y si no se ha forjado nada todavía, se abre la ONDA, que es la forma que
      más sitio despeja. Sin esto, quien acierta su primer cofre antes que su
      primera forja tendría un arma de nivel uno sin ninguna forma que disparar.
    */
    mundo.aciertos += 1;
    for (const sombra of mundo.sombras) {
      herir(mundo, sombra, sombra.vida + 1);
    }
    mundo.sombras = [];
    if (FAMILIAS.every((familia) => mundo.rangos[familia] === 0)) mundo.rangos.onda += 1;
    mundo.pulso = { hasta: mundo.t + 0.7, bueno: true };
  } else {
    mundo.escenaDesde = Math.max(mundo.escenaDesde, mundo.t + MS_LECCION_FALLO / 1000);
    mundo.aturdidaHasta = mundo.t + MS_ATURDIDO / 1000;
    mundo.invulnerableHasta = Math.max(mundo.invulnerableHasta, mundo.aturdidaHasta);
    mundo.pulso = { hasta: mundo.t + 0.45, bueno: false };
  }

  mundo.eventos.push({ tipo: 'cofre-abierto', cofreId: cofre.id, respuesta, acierto });
}

function tocarAMilo(mundo: Mundo, ronda: RondaDeHorda): void {
  if (mundo.t < mundo.invulnerableHasta) return;

  const alcance = ronda.arena.radioMilo * 0.8 + ronda.arena.radioSombra;
  for (const sombra of mundo.sombras) {
    if (sombra.vida <= 0) continue;
    if (Math.hypot(sombra.x - mundo.milo.x, sombra.y - mundo.milo.y) > alcance) continue;

    mundo.vidas -= 1;
    mundo.invulnerableHasta = mundo.t + ronda.partida.msInvulnerable / 1000;
    mundo.eventos.push({ tipo: 'roce' });

    if (mundo.vidas <= 0) {
      mundo.terminado = 'muerte';
      mundo.eventos.push({ tipo: 'fin', motivo: 'muerte' });
    }
    return;
  }
}

function limpiar(mundo: Mundo, oleada: RondaDeHorda['oleada']): void {
  for (let i = mundo.sombras.length - 1; i >= 0; i -= 1) {
    if (mundo.sombras[i]!.vida <= 0) mundo.sombras.splice(i, 1);
  }
  for (let i = mundo.numeros.length - 1; i >= 0; i -= 1) {
    if (mundo.numeros[i]!.hasta <= mundo.t) mundo.numeros.splice(i, 1);
  }
  if (mundo.pulso && mundo.pulso.hasta <= mundo.t) mundo.pulso = null;
  if (mundo.sombras.length > oleada.maximoSombras) {
    mundo.sombras.length = oleada.maximoSombras;
  }
}

/* ════════════════════════  EL JUGADOR SIMULADO  ════════════════════════ */

/**
 * Un jugador de mentira que juega de verdad, y es con lo que está medido todo.
 *
 * Existe porque la pregunta que hay que contestar de este juego —«¿el inglés
 * decide si ganas?»— no se responde jugando dos partidas: se responde jugando
 * la MISMA partida cambiando una sola cosa, lo bien que se forja, y mirando
 * quién llega vivo al final. Eso con las manos no se puede hacer, porque nadie
 * esquiva dos veces igual.
 *
 * Así que esquiva siempre igual —persigue el orbe que toca huyendo de lo que
 * tenga cerca, con la misma política— y lo único que cambia entre una partida y
 * otra es `acierto`, la probabilidad de forjar el compuesto bueno.
 *
 * Lo que este muñeco NO mide, y conviene decirlo en voz alta: no mide cuánto
 * tarda una persona en LEER. Lee a la velocidad que se le diga
 * (`caracteresPorSegundo`), así que lo que sale de él es «con una persona que
 * lea a 14 caracteres por segundo, ¿llega el reloj del cofre?», que es una
 * simulación de un lector, no un lector.
 */
interface Politica {
  /** Probabilidad de elegir el compuesto bueno. */
  acierto: number;
  /** A cuántos caracteres por segundo se supone que lee. */
  caracteresPorSegundo: number;
  /** Lo que tarda en decidirse y pulsar, además de leer. */
  reflejoMs: number;
  /**
   * Cada cuánto cambia de rumbo. Es lo que permite medir el modo de turnos.
   *
   * Con movimiento normal se corrige el rumbo en cada fotograma; con
   * `prefers-reduced-motion` se elige una vez por turno y se mantiene 1,4
   * segundos. Es la ÚNICA diferencia entre los dos modos —la física es la misma
   * y se simula igual de fino— así que poniendo aquí 1400 se mide el modo de
   * turnos sin tener que jugarlo tres minutos.
   */
  decidirCadaMs?: number;
  /**
   * Si la partida va por turnos, con las sombras comprometidas también.
   *
   * Va aparte de `decidirCadaMs` porque son dos cosas distintas y la diferencia
   * resultó importar mucho: una persona con movimiento normal tampoco corrige
   * el rumbo sesenta veces por segundo —corrige tres o cuatro— pero las sombras
   * sí la persiguen sin parar. Poder medir las dos por separado es lo que
   * permitió ver que el muñeco que corrige cada fotograma esquiva mucho mejor
   * que nadie, y que los números de dificultad estaban calibrados contra él.
   */
  porTurnos?: boolean;
}

interface Cerebro {
  /** Si esta escena la va a acertar. Se decide al empezarla, no al tocarla. */
  acertara: boolean;
  /** Cuándo vuelve a mirar hacia dónde va. */
  proximoRumbo: number;
  escenaVista: number;
  /** Cuándo termina de leer la escena de ahora. */
  leidaEn: number;
  /** Y cuándo terminará de leer el cofre abierto. */
  cofreListoEn: number;
}

function cerebroNuevo(): Cerebro {
  return { acertara: true, proximoRumbo: 0, escenaVista: -1, leidaEn: 0, cofreListoEn: 0 };
}

/**
 * La política de movimiento, que es la parte que NO cambia entre partidas.
 *
 * Suma dos fuerzas: huir de lo que tiene cerca —con peso inverso al cuadrado de
 * la distancia, o sea que solo importa lo pegado— e ir hacia el orbe que toca.
 * No es un jugador bueno; es un jugador CONSTANTE, que es lo que hace falta
 * para que la única variable del experimento sea el inglés.
 */
function pensar(mundo: Mundo, ronda: RondaDeHorda, cerebro: Cerebro, politica: Politica): void {
  const escena = ronda.escenas[mundo.escenaIndice];

  // En el modo de turnos el rumbo se elige una vez por turno y se mantiene.
  if (politica.decidirCadaMs) {
    if (mundo.t * 1000 < cerebro.proximoRumbo) return;
    cerebro.proximoRumbo = mundo.t * 1000 + politica.decidirCadaMs;
  }

  if (escena && cerebro.escenaVista !== mundo.escenaIndice) {
    cerebro.escenaVista = mundo.escenaIndice;
    cerebro.acertara = mundo.azar() < politica.acierto;
    cerebro.leidaEn =
      mundo.t +
      escena.situacionEs.length / politica.caracteresPorSegundo +
      politica.reflejoMs / 1000;
  }

  /*
    Huir de lo que tiene cerca, con peso inverso al cuadrado de la distancia.

    Mira hasta 45 unidades —un tercio largo de la arena— y no 30, que era lo que
    había al principio: con 30 el muñeco no veía venir nada y se comía sombras
    que cualquiera habría esquivado, así que lo que medía no era si el inglés
    decide la partida, era si el muñeco es malo. No pretende ser un jugador
    bueno; pretende ser uno CONSTANTE y no torpe, para que la única variable del
    experimento sea lo bien que forja.
  */
  let fx = 0;
  let fy = 0;
  let masCerca = Infinity;
  for (const sombra of mundo.sombras) {
    const dx = mundo.milo.x - sombra.x;
    const dy = mundo.milo.y - sombra.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 2025) continue;
    masCerca = Math.min(masCerca, d2);
    const peso = 2025 / Math.max(d2, 36);
    const d = Math.sqrt(d2) || 1;
    fx += (dx / d) * peso;
    fy += (dy / d) * peso;
  }

  /*
    Huir es una DIRECCIÓN, y cuánto pesa lo decide lo cerca que esté lo más
    cercano, no cuántas sombras haya.

    La primera versión sumaba un vector por sombra sin normalizar, así que con
    diez sombras alrededor el peso de huir llegaba a quinientos contra un nueve
    de ir a por la palabra: el muñeco se pasaba la partida corriendo en círculos
    y cerraba tres compuestos en tres minutos. No medía el juego, medía un
    error de aritmética.
  */
  const largoHuida = Math.hypot(fx, fy) || 1;
  const pesoHuir = masCerca < 196 ? 10 : masCerca < 900 ? 4 : 1;
  let hx = (fx / largoHuida) * pesoHuir;
  let hy = (fy / largoHuida) * pesoHuir;

  /*
    Ir a por el orbe, con más ganas cuanto más despejado esté.

    Un jugador de verdad no cruza por delante de una sombra para llegar antes a
    una palabra: se aparta, rodea y vuelve. Pero tampoco se pasa la partida
    huyendo sin coger nada, que es lo que hacía la primera versión de esto: con
    el peso de huir por las nubes, el muñeco daba dos vueltas a la arena por
    cada palabra y cerraba dos compuestos en tres minutos. No medía el juego,
    medía lo torpe que era.

    Y el último tramo va derecho: a menos de doce unidades del orbe, con nada
    pegado, pisa. Sin eso se quedaba orbitando la pastilla sin llegar a tocarla,
    porque la mezcla de huir y perseguir nunca apunta del todo al centro.
  */
  const meta = aDonde(mundo, cerebro, escena);
  if (meta) {
    const dx = meta.x - mundo.milo.x;
    const dy = meta.y - mundo.milo.y;
    const d = Math.hypot(dx, dy) || 1;

    if (d < 12 && masCerca > 169) {
      mundo.dir = { x: dx / d, y: dy / d };
      return;
    }

    hx += (dx / d) * 5;
    hy += (dy / d) * 5;
  }

  // Y que no se pegue a la pared, donde no hay por dónde salir.
  const { arena } = ronda;
  if (mundo.milo.x < 16) hx += 3;
  if (mundo.milo.x > arena.ancho - 16) hx -= 3;
  if (mundo.milo.y < 16) hy += 3;
  if (mundo.milo.y > arena.alto - 16) hy -= 3;

  const largo = Math.hypot(hx, hy);
  mundo.dir = largo > 0.01 ? { x: hx / largo, y: hy / largo } : { x: 0, y: 0 };
}

function aDonde(
  mundo: Mundo,
  cerebro: Cerebro,
  escena: EscenaDeHorda | undefined,
): { x: number; y: number } | null {
  // El cofre manda: es limpieza de pantalla y un nivel de arma.
  if (mundo.cofreEnArena) return mundo.cofreEnArena;
  if (!escena || mundo.t < cerebro.leidaEn) return null;

  const [verboBueno, particulaBuena] = escena.compuesto.split(' ');

  if (mundo.cargado === null) {
    const quiere = cerebro.acertara
      ? verboBueno
      : escena.verbos.find((verbo) => verbo !== verboBueno);
    return mundo.orbes.find((orbe) => orbe.clase === 'verbo' && orbe.texto === quiere) ?? null;
  }

  /*
    Si va a fallar, ya ha cogido el verbo equivocado, así que cualquier
    partícula cierra un compuesto malo. Si va a acertar, va a por la buena.
  */
  if (cerebro.acertara) {
    /*
      Y si la partícula buena todavía no ha caído, ESPERA.

      La primera versión se iba a cualquier partícula cuando no encontraba la
      suya, y eso contaminaba la medida entera: el muñeco cerraba compuestos que
      no había elegido y el experimento decía que fallaba el 23 % de lo que
      pretendía acertar. Un jugador de verdad tampoco pisa la primera que ve.
    */
    return (
      mundo.orbes.find((orbe) => orbe.clase === 'particula' && orbe.texto === particulaBuena) ??
      null
    );
  }

  return mundo.orbes.find((orbe) => orbe.clase === 'particula') ?? null;
}

/*
  `simular` y su resultado NO se exportan, aunque la prueba los use.

  El motivo es la regla de `react-refresh` que tiene puesta esta casa: un
  archivo de componentes que además exporta funciones deja de recargarse en
  caliente, y entonces tocar una línea de este juego obliga a recargar la
  página entera y a perder la partida que se estaba probando. Se llega a ellos
  por `window.__horda`, que es por donde los usa también el arnés de medir.
*/
interface ResultadoSimulado {
  motivo: 'muerte' | 'tiempo';
  segundos: number;
  aciertos: number;
  contestadas: number;
  /** Las forjas, aparte, que es lo que se quiere mirar por su cuenta. */
  escenasAcertadas: number;
  escenasCerradas: number;
  cofresAcertados: number;
  cofresAbiertos: number;
  rachaMaxima: number;
  vidas: number;
  sombrasAlFinal: number;
  maximoDeSombras: number;
  rangos: Record<FamiliaDeArma, number>;
  cofresTarde: number;
}

/**
 * Una partida entera sin pintar nada. Es lo que mide el informe.
 *
 * `cofresTarde` cuenta los cofres en los que el lector simulado no llegó a
 * tiempo. Es el número con el que se comprueba si el reloj del cofre está bien
 * calibrado para quien lee a 14 caracteres por segundo.
 */
function simular(ronda: RondaDeHorda, politica: Politica, semilla: string): ResultadoSimulado {
  const mundo = mundoNuevo(
    ronda,
    semilla,
    politica.porTurnos ? (politica.decidirCadaMs ?? MS_TURNO) : 0,
  );
  const cerebro = cerebroNuevo();
  const dt = 1 / 60;
  let maximoDeSombras = 0;
  let cofresTarde = 0;
  let cofresAcertados = 0;
  let cofresAbiertos = 0;

  while (!mundo.terminado && mundo.t < ronda.partida.segundos + 1) {
    if (mundo.cofreAbierto) {
      const cofre = ronda.cofres[mundo.cofreAbierto.indice]!;
      if (cerebro.cofreListoEn === 0) {
        const caracteres =
          cofre.frase.length + cofre.significadoEs.length + cofre.opciones.join('').length;
        cerebro.cofreListoEn =
          mundo.t + caracteres / politica.caracteresPorSegundo + politica.reflejoMs / 1000;
      }

      // El reloj del cofre corre aunque el mundo esté parado.
      mundo.t += dt;
      const gastado = (mundo.t - mundo.cofreAbierto.abiertoEn) * 1000;

      if (gastado >= mundo.cofreAbierto.ventanaMs) {
        cofresTarde += 1;
        cofresAbiertos += 1;
        cerebro.cofreListoEn = 0;
        resolverCofre(mundo, ronda, SIN_CERRAR);
      } else if (mundo.t >= cerebro.cofreListoEn) {
        const acertara = mundo.azar() < politica.acierto;
        const cofreActual = cofre;
        const elegida = acertara
          ? cofreActual.correcta
          : (cofreActual.opciones.find((opcion) => opcion !== cofreActual.correcta) ??
            cofreActual.correcta);
        cerebro.cofreListoEn = 0;
        cofresAbiertos += 1;
        if (elegida === cofreActual.correcta) cofresAcertados += 1;
        resolverCofre(mundo, ronda, elegida);
      }
      continue;
    }

    pensar(mundo, ronda, cerebro, politica);
    avanzar(mundo, dt, ronda);
    tocarCofre(mundo, ronda);
    maximoDeSombras = Math.max(maximoDeSombras, mundo.sombras.length);
  }

  return {
    motivo: mundo.terminado ?? 'tiempo',
    segundos: Math.round(mundo.t * 10) / 10,
    aciertos: mundo.aciertos,
    contestadas: mundo.contestadas,
    escenasAcertadas: mundo.aciertos - cofresAcertados,
    escenasCerradas: mundo.contestadas - cofresAbiertos,
    cofresAcertados,
    cofresAbiertos,
    rachaMaxima: mundo.rachaMaxima,
    vidas: mundo.vidas,
    sombrasAlFinal: mundo.sombras.length,
    maximoDeSombras,
    rangos: { ...mundo.rangos },
    cofresTarde,
  };
}

/* ════════════════════════  LA PANTALLA  ════════════════════════ */

type Fase = 'entrada' | 'jugando' | 'cofre';

interface Leccion {
  titulo: string;
  correcta: string;
  significadoEs: string;
  ejemploEn: string;
  separable?: boolean;
  acierto: boolean;
  vez: number;
}

/** Lo que se apunta en desarrollo para poder medir lo que dice el informe. */
interface MedidasDeLaHorda {
  fotogramas: number[];
  /** Cuántas sombras había en cada fotograma apuntado. */
  sombras: number[];
  estado: () => { segundo: number; sombras: number; vidas: number; aciertos: number };
  /**
   * Una partida simulada, con la opción de cambiar la calibración.
   *
   * `cambios` existe para poder BARRER números —cuántas sombras por segundo,
   * cuánta vida, cuántos corazones— sin reiniciar el servidor entre prueba y
   * prueba. Lo que se elija acaba escrito en `horda.ts`, que es donde vive la
   * calibración de verdad; esto solo sirve para encontrarlo.
   */
  simular: (
    politica: Politica,
    semilla: string,
    cambios?: Partial<{
      partida: Partial<RondaDeHorda['partida']>;
      oleada: Partial<RondaDeHorda['oleada']>;
      arma: Partial<RondaDeHorda['arma']>;
      arena: Partial<RondaDeHorda['arena']>;
    }>,
  ) => ResultadoSimulado;
  /**
   * Llena la arena de sombras de golpe, para poder medir el caso peor.
   *
   * El caso peor de dibujo son las cuarenta sombras del tope, y a ese sitio no
   * se llega jugando bien: quien forja como es debido mantiene la arena en diez
   * o doce, y quien no forja se muere antes de que se llene. O sea que medir
   * los cuadros por segundo con la pantalla llena exige poder llenarla.
   */
  llenar: (cuantas: number) => void;
  /** Enciende el jugador simulado sobre la partida de verdad, para medir. */
  automata: (politica: Politica | null) => void;
}

declare global {
  interface Window {
    __horda?: MedidasDeLaHorda;
  }
}

export function Horda({
  ronda: servida,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeHorda;
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();

  /*
    Con movimiento reducido se juega la MISMA ronda con la horda atenuada.

    La atenuación la manda el servidor (`oleadaPorTurnos`) y no se inventa aquí,
    por lo mismo que el resto de la curva: es calibración. Y toca el esquive y
    solo el esquive: las escenas, los señuelos, los cofres y el reloj del cofre
    son exactamente los mismos, así que las dos puntuaciones significan lo
    mismo y se pueden comparar.
  */
  const ronda: RondaDeHorda = useMemo(
    () =>
      menosMovimiento
        ? {
            ...servida,
            oleada: servida.oleadaPorTurnos,
            partida: {
              ...servida.partida,
              msInvulnerable: servida.partida.msInvulnerablePorTurnos,
            },
          }
        : servida,
    [menosMovimiento, servida],
  );

  const [fase, setFase] = useState<Fase>('entrada');
  const [aciertos, setAciertos] = useState(0);
  const [contestadas, setContestadas] = useState(0);
  const [racha, setRacha] = useState(0);
  const [rachaMaxima, setRachaMaxima] = useState(0);
  const [vidas, setVidas] = useState(ronda.partida.vidas);
  const [rangos, setRangos] = useState<Record<FamiliaDeArma, number>>({
    onda: 0,
    aura: 0,
    rastro: 0,
    orbita: 0,
  });
  const [restantes, setRestantes] = useState(ronda.partida.segundos);
  const [escenaIndice, setEscenaIndice] = useState(0);
  const [cargado, setCargado] = useState<string | null>(null);
  const [leccion, setLeccion] = useState<Leccion | null>(null);
  const [cofre, setCofre] = useState<CofreDeHorda | null>(null);
  /** Lo que queda de ventana del cofre, de 1 a 0. Solo para pintar. */
  const [quedaDelCofre, setQuedaDelCofre] = useState(1);
  /** Cuántos turnos van, con movimiento reducido. Es lo que repinta el tablero. */
  const [turno, setTurno] = useState(0);

  const puntuacion = puntosDelServidor('HORDA', aciertos, rachaMaxima);

  /* ──────────  el trato con el servidor  ────────── */

  /*
    Las respuestas van en fila india y no se esperan para seguir jugando.

    Es lo mismo que hacen CAEN, PARTICULAS y CARRERA: la ronda llegó con el
    compuesto bueno dentro, así que el navegador ya sabe si acertó, y parar la
    arena a esperar al servidor sería parar el juego con la horda encima. Pero
    la partida NO se cierra hasta que ha llegado la última: si el `/fin`
    adelantara a las respuestas, la puntuación final saldría por debajo de la
    que se acaba de ver subir, y eso se lee como una estafa.
  */
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const avisar = useCallback(
    (rondaId: string, respuesta: string) => {
      cola.current = cola.current.then(() =>
        onResponder(rondaId, respuesta).catch(() =>
          onResponder(rondaId, respuesta).catch(() => null),
        ),
      );
    },
    [onResponder],
  );

  const marcador = useRef<Marcador>({ puntuacion: 0, aciertos: 0, total: 0 });
  marcador.current = { puntuacion, aciertos, total: contestadas };

  const cerrada = useRef(false);
  const terminar = useCallback(() => {
    if (cerrada.current) return;
    cerrada.current = true;
    void cola.current.then(() => onFin(marcador.current));
  }, [onFin]);

  /* ──────────  el mundo y lo que lo dibuja  ────────── */

  const mundo = useRef<Mundo | null>(null);
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const cuerpoDeMilo = useRef<HTMLDivElement | null>(null);
  const barraDelCofre = useRef<HTMLDivElement | null>(null);
  const marco = useRef<HTMLDivElement | null>(null);
  const automata = useRef<Politica | null>(null);
  const cerebro = useRef<Cerebro>(cerebroNuevo());

  /** El tamaño de la arena en píxeles. Lo mide el navegador, no lo supone. */
  const [lado, setLado] = useState({ ancho: 288, alto: 374 });
  const escala = lado.ancho / ronda.arena.ancho;

  /*
    `fase` está en las dependencias, y no es un adorno: es un fallo arreglado.

    La pantalla de entrada se pinta con un `return` temprano, así que mientras
    se está en ella el marco de la arena NO EXISTE y este efecto se va sin medir
    nada. Al empezar la partida el marco aparece, pero el efecto no se volvía a
    ejecutar —sus dependencias eran solo el tamaño lógico, que nunca cambia— y
    el `ResizeObserver` tampoco avisa de un elemento que nació después de
    montarlo. Resultado: la arena se quedaba con el tamaño de respaldo, 288
    píxeles, en todas las pantallas. A 320 colaba de milagro; a 390 el juego se
    veía en un recuadro pequeño con un palmo de hueco debajo.
  */
  useLayoutEffect(() => {
    const caja = marco.current;
    if (!caja || typeof ResizeObserver === 'undefined') return;

    const medir = () => {
      const ancho = caja.clientWidth;
      const alto = caja.clientHeight;
      if (ancho <= 0 || alto <= 0) return;
      // La arena guarda su proporción: o cabe por ancho, o cabe por alto.
      const porAncho = Math.min(ancho, (alto * ronda.arena.ancho) / ronda.arena.alto);
      setLado({
        ancho: Math.round(porAncho),
        alto: Math.round((porAncho * ronda.arena.alto) / ronda.arena.ancho),
      });
    };

    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    medir();
    return () => observador.disconnect();
  }, [fase, ronda.arena.alto, ronda.arena.ancho]);

  /* ──────────  las manos: teclado y dedo  ────────── */

  const teclas = useRef(new Set<string>());

  useEffect(() => {
    if (fase !== 'jugando') return;

    const mirar = () => {
      const m = mundo.current;
      if (!m || automata.current) return;
      let x = 0;
      let y = 0;
      if (teclas.current.has('izq')) x -= 1;
      if (teclas.current.has('der')) x += 1;
      if (teclas.current.has('arr')) y -= 1;
      if (teclas.current.has('aba')) y += 1;
      const largo = Math.hypot(x, y);
      m.dir = largo > 0 ? { x: x / largo, y: y / largo } : { x: 0, y: 0 };
    };

    const cual = (evento: KeyboardEvent): string | null => {
      const t = evento.key.toLowerCase();
      if (t === 'arrowleft' || t === 'a') return 'izq';
      if (t === 'arrowright' || t === 'd') return 'der';
      if (t === 'arrowup' || t === 'w') return 'arr';
      if (t === 'arrowdown' || t === 's') return 'aba';
      return null;
    };

    const alBajar = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
      const lado = cual(evento);
      if (!lado) return;
      evento.preventDefault();
      teclas.current.add(lado);
      mirar();
    };

    const alSubir = (evento: KeyboardEvent) => {
      const lado = cual(evento);
      if (!lado) return;
      teclas.current.delete(lado);
      mirar();
    };

    // Soltar el teclado al irse la pestaña: si no, Milo se queda corriendo
    // contra la pared mientras nadie mira.
    const alSalir = () => {
      teclas.current.clear();
      mirar();
    };

    window.addEventListener('keydown', alBajar);
    window.addEventListener('keyup', alSubir);
    window.addEventListener('blur', alSalir);
    return () => {
      window.removeEventListener('keydown', alBajar);
      window.removeEventListener('keyup', alSubir);
      window.removeEventListener('blur', alSalir);
    };
  }, [fase]);

  /*
    El dedo: un mando que aparece donde se toca.

    En 320 px no cabe un mando fijo en una esquina sin comerse la arena, y si
    se pone encima tapa justo la zona por la que hay que huir. Así que el mando
    no está hasta que se toca: donde cae el dedo queda el centro, y la
    dirección es hacia dónde se arrastra. Es lo que hacen los juegos de este
    género en móvil, y funciona con el pulgar sin mirar.
  */
  const mando = useRef<{ id: number; x: number; y: number } | null>(null);

  const alTocar = useCallback((evento: React.PointerEvent<HTMLDivElement>) => {
    const m = mundo.current;
    if (!m) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    mando.current = { id: evento.pointerId, x: evento.clientX, y: evento.clientY };
    m.dir = { x: 0, y: 0 };
  }, []);

  const alArrastrar = useCallback((evento: React.PointerEvent<HTMLDivElement>) => {
    const m = mundo.current;
    const centro = mando.current;
    if (!m || !centro || centro.id !== evento.pointerId) return;

    const dx = evento.clientX - centro.x;
    const dy = evento.clientY - centro.y;
    const largo = Math.hypot(dx, dy);
    // Una zona muerta de 8 píxeles: sin ella, un dedo apoyado tiembla y Milo
    // se mueve solo.
    m.dir = largo > 8 ? { x: dx / largo, y: dy / largo } : { x: 0, y: 0 };
  }, []);

  const alSoltar = useCallback((evento: React.PointerEvent<HTMLDivElement>) => {
    const m = mundo.current;
    if (mando.current?.id !== evento.pointerId) return;
    mando.current = null;
    if (m) m.dir = { x: 0, y: 0 };
  }, []);

  /* ──────────  lo que pasa cuando el mundo cuenta algo  ────────── */

  const atender = useCallback(
    (evento: EventoDeHorda, m: Mundo) => {
      if (evento.tipo === 'forja') {
        const escena = ronda.escenas.find((candidata) => candidata.id === evento.escenaId);
        avisar(evento.escenaId, evento.compuesto);
        setAciertos(m.aciertos);
        setContestadas(m.contestadas);
        setRacha(m.racha);
        setRachaMaxima(m.rachaMaxima);
        setRangos({ ...m.rangos });
        setEscenaIndice(m.escenaIndice);
        setCargado(null);
        if (escena) {
          setLeccion({
            titulo: evento.acierto ? '¡Esa!' : 'Ese compuesto no es',
            correcta: escena.compuesto,
            significadoEs: escena.significadoEs,
            ejemploEn: escena.ejemploEn,
            separable: escena.separable,
            acierto: evento.acierto,
            vez: m.contestadas,
          });
        }
        if (evento.acierto) sonar(m.racha >= 2 ? 'combo' : 'acierto', { racha: m.racha });
        else sonar('fallo');
        return;
      }

      if (evento.tipo === 'cofre-abierto') {
        const abierto = ronda.cofres.find((candidato) => candidato.id === evento.cofreId);
        avisar(evento.cofreId, evento.respuesta);
        setAciertos(m.aciertos);
        setContestadas(m.contestadas);
        setRacha(m.racha);
        setRachaMaxima(m.rachaMaxima);
        setRangos({ ...m.rangos });
        setCofre(null);
        setFase('jugando');
        if (abierto) {
          setLeccion({
            titulo: evento.acierto
              ? '¡Cofre abierto!'
              : evento.respuesta === SIN_CERRAR
                ? 'Se cerró el cofre'
                : 'Esa no era',
            correcta: abierto.frase.replace('___', abierto.correcta),
            significadoEs: abierto.significadoEs,
            ejemploEn: abierto.ejemploEn,
            acierto: evento.acierto,
            vez: m.contestadas,
          });
        }
        if (evento.acierto) sonar('combo', { racha: m.racha });
        else sonar('fallo');
        return;
      }

      if (evento.tipo === 'roce') {
        setVidas(m.vidas);
        sonar('fallo');
        return;
      }

      setVidas(m.vidas);
      setFase('jugando');
      terminar();
    },
    [avisar, ronda.cofres, ronda.escenas, terminar],
  );

  /* ──────────  EL BUCLE. Uno solo, y un solo reloj  ────────── */

  useEffect(() => {
    if (fase === 'entrada') return;
    const m = mundo.current;
    if (!m) return;

    let cuadro = 0;
    let anterior = performance.now();
    let ultimoTurno = anterior;
    let ultimoSegundo = -1;
    let ultimasVidas = m.vidas;
    let ultimoCargado = m.cargado;

    /*
      `latido` NO RECIBE ARGUMENTO. `requestAnimationFrame` le pasa un sello de
      tiempo y aquí se tira a propósito: ese sello va en un reloj que no tiene
      por qué ser el mismo que `performance.now()`, y mezclarlos es exactamente
      el fallo que dejó congelado el reloj de LA PARTÍCULA. Está contado en
      `Particulas.tsx`.
    */
    const latido = () => {
      const ahora = performance.now();
      const crudo = (ahora - anterior) / 1000;
      anterior = ahora;

      if (import.meta.env.DEV && window.__horda) {
        window.__horda.fotogramas.push(Math.round(crudo * 1000));
        window.__horda.sombras.push(m.sombras.length);
      }

      if (m.cofreAbierto) {
        // El mundo está parado, pero el reloj del cofre corre.
        m.t += Math.min(crudo, PASO_MAXIMO);
        const gastado = (m.t - m.cofreAbierto.abiertoEn) * 1000;
        const queda = Math.max(0, 1 - gastado / m.cofreAbierto.ventanaMs);

        const barra = barraDelCofre.current;
        if (barra) barra.style.transform = `scaleX(${queda.toFixed(3)})`;
        if (menosMovimiento) {
          const segundo = Math.ceil((queda * m.cofreAbierto.ventanaMs) / 1000);
          if (segundo !== ultimoSegundo) {
            ultimoSegundo = segundo;
            setQuedaDelCofre(queda);
          }
        }

        if (queda <= 0) resolverCofre(m, ronda, SIN_CERRAR);
        vaciarEventos(m);
        pintar();
        cuadro = requestAnimationFrame(latido);
        return;
      }

      if (automata.current) pensar(m, ronda, cerebro.current, automata.current);

      if (menosMovimiento) {
        /*
          Con movimiento reducido no se PINTA cada fotograma: se pinta una vez
          por turno. Pero se SIMULA igual de fino, en trocitos de 50 ms, y esa
          distinción es el turno entero de este modo.

          La primera versión llamaba a `avanzar` una sola vez con un paso de
          1,4 segundos, y quedaba roto de tres formas que solo se vieron
          jugándolo: el arma disparaba una vez por turno en vez de dos —o sea
          la mitad de daño—, las balas recorrían 112 unidades de golpe y salían
          de la arena sin tocar a nadie, y las sombras atravesaban a Milo sin
          rozarle. Medido: con movimiento reducido no se pasaba del segundo 50.

          Troceado, la física es exactamente la misma que con movimiento normal
          y lo único distinto es que no se interpola nada en pantalla y que la
          dirección se elige una vez por turno. La puntuación, por tanto,
          significa lo mismo en los dos modos.
        */
        if (ahora - ultimoTurno >= MS_TURNO) {
          ultimoTurno = ahora;
          const trozos = Math.round(MS_TURNO / 1000 / PASO_MAXIMO);
          for (let i = 0; i < trozos; i += 1) {
            if (m.terminado || m.cofreAbierto) break;
            avanzar(m, PASO_MAXIMO, ronda);
            if (tocarCofre(m, ronda)) {
              abrirCofre(m);
              break;
            }
          }
          setTurno((n) => n + 1);
        }
      } else {
        avanzar(m, Math.min(crudo, PASO_MAXIMO), ronda);
        if (tocarCofre(m, ronda)) abrirCofre(m);
      }

      // Lo que cambia poco va por el estado; lo que cambia siempre, no.
      const segundo = Math.max(0, Math.ceil(ronda.partida.segundos - m.t));
      if (segundo !== ultimoSegundo) {
        ultimoSegundo = segundo;
        setRestantes(segundo);
      }
      if (m.vidas !== ultimasVidas) {
        ultimasVidas = m.vidas;
        setVidas(m.vidas);
      }
      if (m.cargado !== ultimoCargado) {
        ultimoCargado = m.cargado;
        setCargado(m.cargado);
      }

      vaciarEventos(m);
      pintar();
      if (!m.terminado) cuadro = requestAnimationFrame(latido);
    };

    const abrirCofre = (m2: Mundo) => {
      const cual = ronda.cofres[m2.cofreAbierto?.indice ?? -1];
      if (!cual) return;
      setCofre(cual);
      setQuedaDelCofre(1);
      setFase('cofre');
    };

    const vaciarEventos = (m2: Mundo) => {
      while (m2.eventos.length > 0) atender(m2.eventos.shift()!, m2);
    };

    const pintar = () => {
      if (menosMovimiento) return;
      dibujar(lienzo.current, m, ronda, escala);
      const cuerpo = cuerpoDeMilo.current;
      if (cuerpo) {
        cuerpo.style.transform = `translate3d(${(m.milo.x * escala).toFixed(1)}px, ${(
          m.milo.y * escala
        ).toFixed(1)}px, 0) translate(-50%, -50%)`;
        cuerpo.style.opacity =
          m.t < m.invulnerableHasta && Math.floor(m.t * 12) % 2 === 0 ? '0.45' : '1';
      }
    };

    cuadro = requestAnimationFrame(latido);
    return () => cancelAnimationFrame(cuadro);
  }, [atender, escala, fase, menosMovimiento, ronda]);

  /* La lección se borra sola, que es lo que devuelve la escena a su sitio. */
  useEffect(() => {
    if (!leccion) return;
    const reloj = window.setTimeout(
      () => setLeccion(null),
      leccion.acierto ? MS_LECCION_ACIERTO : MS_LECCION_FALLO,
    );
    return () => window.clearTimeout(reloj);
  }, [leccion]);

  /* El teclado del cofre: 1, 2 y 3, que es lo único que hace falta ahí. */
  const elegirEnCofre = useCallback(
    (respuesta: string) => {
      const m = mundo.current;
      if (!m || !m.cofreAbierto) return;
      resolverCofre(m, ronda, respuesta);
      while (m.eventos.length > 0) atender(m.eventos.shift()!, m);
    },
    [atender, ronda],
  );

  useEffect(() => {
    if (fase !== 'cofre' || !cofre) return;

    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
      const numero = Number(evento.key);
      if (!Number.isInteger(numero)) return;
      const opcion = cofre.opciones[numero - 1];
      if (!opcion) return;
      evento.preventDefault();
      elegirEnCofre(opcion);
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [cofre, elegirEnCofre, fase]);

  /* El arnés de medir. Solo en desarrollo: Vite lo borra al compilar. */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__horda = {
      fotogramas: [],
      sombras: [],
      estado: () => {
        const m = mundo.current;
        return {
          segundo: m ? Math.round(m.t * 10) / 10 : 0,
          sombras: m?.sombras.length ?? 0,
          vidas: m?.vidas ?? 0,
          aciertos: m?.aciertos ?? 0,
        };
      },
      simular: (politica, semilla, cambios) =>
        simular(
          cambios
            ? {
                ...ronda,
                partida: { ...ronda.partida, ...cambios.partida },
                oleada: { ...ronda.oleada, ...cambios.oleada },
                arma: { ...ronda.arma, ...cambios.arma },
                arena: { ...ronda.arena, ...cambios.arena },
              }
            : ronda,
          politica,
          semilla,
        ),
      llenar: (cuantas) => {
        const m = mundo.current;
        if (!m) return;
        for (let i = 0; i < cuantas; i += 1) {
          m.sombras.push({
            x: ronda.arena.ancho * Math.random(),
            y: ronda.arena.alto * Math.random(),
            vida: 9999,
            rx: 0,
            ry: 0,
            quietaHasta: 0,
            ex: 0,
            ey: 0,
            proximoAura: 0,
            proximoOrbita: 0,
            ultimaOnda: 0,
          });
        }
      },
      automata: (politica) => {
        automata.current = politica;
        cerebro.current = cerebroNuevo();
      },
    };
    return () => {
      delete window.__horda;
    };
  }, [ronda]);

  const empezar = useCallback(() => {
    mundo.current = mundoNuevo(ronda, `${Date.now()}`, menosMovimiento ? MS_TURNO : 0);
    cerebro.current = cerebroNuevo();
    setFase('jugando');
  }, [menosMovimiento, ronda]);

  if (fase === 'entrada') {
    return (
      <Entrada
        ronda={ronda}
        menosMovimiento={menosMovimiento}
        onEmpezar={empezar}
        onSalir={onSalir}
      />
    );
  }

  const escena = ronda.escenas[escenaIndice];
  const m = mundo.current;

  return (
    /*
      `h-dvh` y no `min-h-dvh`, que es lo que usan los demás juegos de la casa.

      La diferencia importa y costó medirla. Con `min-h-dvh` la altura del
      contenedor NO ES DEFINIDA: es el máximo entre la pantalla y lo que ocupe
      el contenido, así que flexbox no tiene ningún hueco que repartir y la
      arena se queda con el tamaño que tuviera en vez de encogerse. Medido a
      320×568: la página salía de 648 píxeles y había que hacer scroll de 80
      para ver el reloj y los puntos, justo mientras se juega. Con `h-dvh` la
      altura es definida, la arena se lleva lo que sobra y no hay scroll.

      Los otros juegos pueden usar `min-h-dvh` porque su contenido es una lista
      que se puede desplazar. Aquí no: si hay que desplazarse, el juego está
      medio fuera de la pantalla.
    */
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-4 py-3">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-2xl font-extrabold leading-none tabular-nums',
              restantes <= 15 && 'text-[var(--texto-aviso)]',
            )}
          >
            {restantes}
          </p>
          <p className="text-xs text-[var(--texto-suave)]">segundos vivo</p>
        </div>
        <Contador
          etiqueta="Puntos"
          valor={puntuacion}
          tono={aciertos > 0 ? 'acierto' : 'normal'}
          vivo
        />
      </CabeceraJuego>

      <div className="mt-1.5 flex min-h-8 flex-wrap items-center gap-2">
        <Corazones vidas={vidas} total={ronda.partida.vidas} />
        <Racha racha={racha} />
      </div>

      {leccion ? (
        <LoQueEnsena leccion={leccion} />
      ) : (
        <LoQuePide escena={escena} cargado={cargado} />
      )}

      {/*
        `min-h-0` y `overflow-hidden` son lo que impide que la arena empuje la
        página. Sin ellos hay una pelea circular: la caja mide lo que mide su
        hijo y el hijo se dimensiona a partir de la caja, así que el lienzo se
        quedaba con sus 374 píxeles de alto en un móvil de 568 y la pantalla
        acababa con barra de desplazamiento vertical justo donde hay que mirar.
        Con `min-h-0`, la caja se queda con lo que sobra y el lienzo se encoge.
      */}
      <div
        ref={marco}
        className="relative mt-2 flex min-h-40 flex-1 items-start justify-center overflow-hidden"
      >
        {menosMovimiento ? (
          <Tablero
            mundo={m}
            ronda={ronda}
            ancho={lado.ancho}
            turno={turno}
            onIr={(x, y) => {
              const vivo = mundo.current;
              if (!vivo) return;
              const dx = x - vivo.milo.x;
              const dy = y - vivo.milo.y;
              const largo = Math.hypot(dx, dy);
              vivo.dir = largo > 0.5 ? { x: dx / largo, y: dy / largo } : { x: 0, y: 0 };
            }}
          />
        ) : (
          <div
            className="relative touch-none overflow-hidden rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)]"
            style={{ width: lado.ancho, height: lado.alto }}
            onPointerDown={alTocar}
            onPointerMove={alArrastrar}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
          >
            <canvas
              ref={lienzo}
              aria-hidden
              className="absolute inset-0 h-full w-full"
              width={lado.ancho}
              height={lado.alto}
            />
            <div
              ref={cuerpoDeMilo}
              className="pointer-events-none absolute left-0 top-0 will-change-transform"
            >
              <Mascota estado={estadoDeMilo(vidas, ronda.partida.vidas)} tamano={escala * 15} />
            </div>
          </div>
        )}
      </div>

      <ElArma rangos={rangos} aciertos={aciertos} arma={ronda.arma} />

      {fase === 'cofre' && cofre && (
        <ElCofre
          cofre={cofre}
          barra={barraDelCofre}
          queda={quedaDelCofre}
          menosMovimiento={menosMovimiento}
          onElegir={elegirEnCofre}
        />
      )}

      {/*
        Lo que pasa, para quien no ve la pantalla. No se anuncia cada sombra
        —serían trescientas en tres minutos y taparían el juego entero— sino
        solo lo que cambia la decisión: qué pide la escena, qué llevas encima y
        cómo acabó la última forja.
      */}
      <p role="status" className="sr-only">
        {leccion
          ? `${leccion.titulo}. ${leccion.correcta}: ${leccion.significadoEs}.`
          : escena
            ? `${escena.situacionEs}. ${cargado ? `Llevas ${cargado}.` : 'Coge un verbo.'} ${vidas} corazones.`
            : ''}
      </p>
    </div>
  );
}

/* ════════════════════════  EL LIENZO  ════════════════════════ */

/**
 * El contexto del lienzo, pedido UNA VEZ por lienzo.
 *
 * Pedirlo en cada fotograma es trabajo tirado sesenta veces por segundo, y
 * además `getContext` no siempre devuelve algo: un navegador sin memoria de
 * vídeo devuelve `null` y jsdom —donde corren las pruebas de esta casa—
 * directamente lanza y escribe una traza. Sin cachearlo, una prueba del
 * componente llenaba la salida con miles de trazas por segundo, y una prueba
 * ruidosa es una prueba que se deja de leer. Sin lienzo el juego sigue: se
 * pierde el dibujo, no la partida.
 */
const CONTEXTOS = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D | null>();

function contextoDe(lienzo: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const guardado = CONTEXTOS.get(lienzo);
  if (guardado !== undefined) return guardado;

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = lienzo.getContext('2d');
  } catch {
    ctx = null;
  }
  CONTEXTOS.set(lienzo, ctx);
  return ctx;
}

/**
 * Todo lo que se mueve, en una sola pasada.
 *
 * El orden importa: lo que está en el suelo primero y lo que vuela después, para
 * que un número de daño no quede debajo de una sombra. Y el aura va la primera
 * de todas porque es un halo: puesto encima, taparía a Milo.
 */
function dibujar(
  lienzo: HTMLCanvasElement | null,
  mundo: Mundo,
  ronda: RondaDeHorda,
  escala: number,
): void {
  /*
    El contexto se pide dentro de un `try`, y no es paranoia de más.

    `getContext` no siempre devuelve algo: un navegador con demasiados lienzos
    abiertos o sin memoria de vídeo devuelve `null`, y jsdom —donde corren las
    pruebas de esta casa— directamente lanza. Sin esto, la prueba del
    componente llenaba la salida de trazas de error por algo que en un
    navegador de verdad no pasa, y una prueba ruidosa es una prueba que se deja
    de leer. Sin lienzo el juego sigue: se pierde el dibujo, no la partida.
  */
  if (!lienzo) return;
  const ctx = contextoDe(lienzo);
  if (!ctx) return;

  const pixeles = Math.min(window.devicePixelRatio || 1, 2);
  const anchoReal = Math.round(lienzo.clientWidth * pixeles);
  const altoReal = Math.round(lienzo.clientHeight * pixeles);
  if (lienzo.width !== anchoReal || lienzo.height !== altoReal) {
    lienzo.width = anchoReal;
    lienzo.height = altoReal;
  }

  ctx.setTransform(escala * pixeles, 0, 0, escala * pixeles, 0, 0);
  ctx.clearRect(0, 0, ronda.arena.ancho, ronda.arena.alto);

  const { arena } = ronda;

  // El aura, que es un halo alrededor de Milo.
  if (mundo.rangos.aura > 0 && mundo.aciertos > 0) {
    const radio = radioDelAura(mundo);
    ctx.beginPath();
    ctx.arc(mundo.milo.x, mundo.milo.y, radio, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(163, 230, 53, 0.13)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(163, 230, 53, 0.5)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // Las ondas de choque.
  for (const onda of mundo.ondas) {
    ctx.beginPath();
    ctx.arc(onda.x, onda.y, onda.radio, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // El anillo de haber forjado, que es lo que en otros juegos sería un
  // destello a pantalla completa. Aquí no hay ninguno: sale de Milo, se queda
  // dentro de la arena y no tapa una sola palabra.
  if (mundo.pulso) {
    const cuanto = Math.max(0, Math.min(1, (mundo.pulso.hasta - mundo.t) / 0.45));
    ctx.beginPath();
    ctx.arc(mundo.milo.x, mundo.milo.y, 12 + (1 - cuanto) * 34, 0, Math.PI * 2);
    ctx.strokeStyle = mundo.pulso.bueno
      ? `rgba(16, 185, 129, ${cuanto.toFixed(2)})`
      : `rgba(239, 68, 68, ${cuanto.toFixed(2)})`;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }

  dibujarOrbes(ctx, mundo, arena);

  if (mundo.cofreEnArena) {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(mundo.cofreEnArena.x - 6, mundo.cofreEnArena.y - 5, 12, 10, 2);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.fillRect(mundo.cofreEnArena.x - 6, mundo.cofreEnArena.y - 1, 12, 1.6);
  }

  // Las esquirlas que giran.
  if (mundo.esquirlas > 0) {
    ctx.fillStyle = FICHA_DE_FAMILIA.orbita.color;
    const radio = 20;
    for (let i = 0; i < mundo.esquirlas; i += 1) {
      const angulo = mundo.anguloOrbita + (i * 2 * Math.PI) / mundo.esquirlas;
      ctx.beginPath();
      ctx.arc(
        mundo.milo.x + Math.cos(angulo) * radio,
        mundo.milo.y + Math.sin(angulo) * radio,
        2.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // Las sombras.
  for (const sombra of mundo.sombras) {
    ctx.beginPath();
    ctx.arc(sombra.x, sombra.y, arena.radioSombra, 0, Math.PI * 2);
    ctx.fillStyle = mundo.t < sombra.quietaHasta ? '#7dd3fc' : '#4c1d95';
    ctx.fill();
    // Dos ojos, que es lo que convierte un círculo en un bicho.
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(sombra.x - 1.4, sombra.y - 0.6, 0.85, 0, Math.PI * 2);
    ctx.arc(sombra.x + 1.4, sombra.y - 0.6, 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  // Las balas.
  for (const bala of mundo.balas) {
    ctx.beginPath();
    ctx.arc(bala.x, bala.y, 1.7, 0, Math.PI * 2);
    ctx.fillStyle = bala.color;
    ctx.fill();
  }

  // Y los números, que son DAÑO y no puntos.
  ctx.font = 'bold 5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const numero of mundo.numeros) {
    const cuanto = Math.max(0, (numero.hasta - mundo.t) / SEGUNDOS_DEL_NUMERO);
    ctx.fillStyle = `rgba(248, 250, 252, ${cuanto.toFixed(2)})`;
    ctx.fillText(String(numero.valor), numero.x, numero.y - 6 + (1 - cuanto) * -7);
  }
}

function dibujarOrbes(
  ctx: CanvasRenderingContext2D,
  mundo: Mundo,
  arena: RondaDeHorda['arena'],
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const orbe of mundo.orbes) {
    const esVerbo = orbe.clase === 'verbo';
    // Las partículas están APAGADAS hasta que Milo lleva un verbo: sin eso,
    // pisar una esquivando sería fallar una pregunta sin haberla contestado.
    const viva = esVerbo || mundo.cargado !== null;
    const elegido = esVerbo && mundo.cargado === orbe.texto;

    ctx.beginPath();
    ctx.roundRect(orbe.x - arena.radioOrbe, orbe.y - 5.5, arena.radioOrbe * 2, 11, 5.5);
    ctx.fillStyle = elegido ? '#16a34a' : esVerbo ? '#1d4ed8' : viva ? '#be185d' : '#3f3f46';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = elegido ? '#bbf7d0' : 'rgba(255,255,255,0.35)';
    ctx.stroke();

    ctx.font = 'bold 6px system-ui, sans-serif';
    ctx.fillStyle = viva ? '#ffffff' : '#a1a1aa';
    ctx.fillText(orbe.texto, orbe.x, orbe.y + 0.4);
  }

  ctx.textBaseline = 'alphabetic';
}

/* ════════════════════════  LAS PIEZAS  ════════════════════════ */

function estadoDeMilo(vidas: number, total: number) {
  if (vidas <= 1) return 'triste' as const;
  if (vidas < total) return 'animando' as const;
  return 'feliz' as const;
}

function Corazones({ vidas, total }: { vidas: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${vidas} corazones`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} aria-hidden className={cn('text-base', i >= vidas && 'opacity-25 grayscale')}>
          ❤️
        </span>
      ))}
    </span>
  );
}

/**
 * Lo que pide la escena, y lo que Milo lleva encima.
 *
 * La escena ocupa dos líneas a propósito y NO se recorta: son 45 caracteres de
 * media y hay que leerlos enteros para saber qué compuesto pedir. Como no hay
 * reloj en la forja, releerla sale gratis, que es justo lo que se quería.
 */
function LoQuePide({
  escena,
  cargado,
}: {
  escena: EscenaDeHorda | undefined;
  cargado: string | null;
}) {
  return (
    <div className="mt-2 min-h-[4.5rem] rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
        Forja el compuesto para esto
      </p>
      <p lang="es" className="text-sm font-extrabold leading-tight">
        {escena?.situacionEs ?? 'No quedan escenas: aguanta lo que puedas.'}
      </p>
      <p className="mt-0.5 text-xs text-[var(--texto-suave)]">
        {cargado ? (
          <>
            Llevas{' '}
            <strong lang="en" className="text-[var(--texto-acierto)]">
              {cargado}
            </strong>{' '}
            — ahora la partícula.
          </>
        ) : (
          'Coge primero un verbo (azul).'
        )}
      </p>
    </div>
  );
}

/**
 * El medio segundo que enseña.
 *
 * No dice «error»: dice el compuesto entero, lo que significa y una frase donde
 * se usa, que es lo mismo que hace LA PARTÍCULA y por el mismo motivo. Estas
 * cosas no se deducen, se asocian, y la única forma de que entren es verlas
 * enteras unas cuantas veces. Se enseña TAMBIÉN al acertar, aunque menos rato:
 * acertar de corazonada y no llegar a ver de qué iba es medio aprendizaje
 * tirado.
 *
 * Y mientras está puesto, la horda no se mueve si se falló. Leer con tres
 * sombras encima no lo lee nadie.
 */
function LoQueEnsena({ leccion }: { leccion: Leccion }) {
  return (
    <div
      className={cn(
        'mt-2 min-h-[4.5rem] rounded-2xl px-3 py-2',
        leccion.acierto ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-extrabold uppercase tracking-wide',
          leccion.acierto ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-fallo)]',
        )}
      >
        {leccion.titulo}
      </p>
      <p className="leading-tight">
        <span lang="en" className="text-base font-extrabold">
          {leccion.correcta}
        </span>{' '}
        <span className="text-xs text-[var(--texto-suave)]">= {leccion.significadoEs}</span>
      </p>
      <p lang="en" className="truncate text-xs italic text-[var(--texto-suave)]">
        {leccion.ejemploEn}
      </p>
      {leccion.separable && (
        <p className="text-[10px] text-[var(--texto-aviso)]">
          Separable: el objeto también puede ir en medio.
        </p>
      )}
    </div>
  );
}

/**
 * El arma: su nivel, lo que multiplica y qué formas tiene abiertas.
 *
 * Dice «daño ×N» y no «×N» a secas, y esa palabra es lo único que separa este
 * marcador de una estafa: el nivel multiplica el DAÑO, no los puntos. En esta
 * aplicación ya hubo un juego que enseñaba un multiplicador al lado de una
 * puntuación que no multiplicaba, y se lee como que te están engañando. Los
 * puntos son los de arriba y salen de la misma fórmula que cerrará el servidor.
 *
 * Y el nivel dice «= tus aciertos» porque literalmente lo es. Es la frase que
 * resume el juego entero y conviene tenerla delante mientras se juega: lo único
 * que te hace fuerte es acertar en inglés.
 */
function ElArma({
  rangos,
  aciertos,
  arma,
}: {
  rangos: Record<FamiliaDeArma, number>;
  aciertos: number;
  arma: RondaDeHorda['arma'];
}) {
  const multiplicador =
    aciertos > 0 ? (arma.factorPorNivel / arma.factorCadencia) ** (aciertos - 1) : 1;

  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
          Arma nivel <strong className="text-[var(--texto)]">{aciertos}</strong> = tus aciertos
        </p>
        <p className="text-xs font-extrabold tabular-nums text-[var(--texto-acierto)]">
          daño ×{multiplicador.toFixed(1)}
        </p>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {FAMILIAS.map((familia) => {
          const abierta = rangos[familia] > 0;
          const ficha = FICHA_DE_FAMILIA[familia];
          return (
            <div
              key={familia}
              className={cn(
                'rounded-xl border-2 px-1 py-1 text-center',
                abierta
                  ? 'border-[var(--borde)] bg-[var(--superficie)]'
                  : 'border-transparent bg-[var(--superficie)] opacity-40',
              )}
            >
              <p className={cn('text-[10px] font-extrabold leading-none', ficha.clase)}>
                {ficha.nombre}
              </p>
              <p className="text-[10px] leading-tight text-[var(--texto-suave)]">
                {abierta ? `×${rangos[familia]}` : 'cerrada'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * El cofre de jefe: el modismo con el hueco y sus tres opciones.
 *
 * La horda está parada mientras esto se lee, y eso NO es una concesión: leer
 * un modismo, su significado y tres opciones son unos 65 caracteres, que a
 * 14-18 caracteres por segundo son más de cuatro segundos. Esquivar a la vez
 * durante cuatro segundos no mediría si te sabes el modismo.
 *
 * El reloj se pinta como una barra que se vacía y, con movimiento reducido,
 * como el número de segundos que quedan: es el mismo reloj sin nada que se
 * mueva, igual que en LA PARTÍCULA.
 */
function ElCofre({
  cofre,
  barra,
  queda,
  menosMovimiento,
  onElegir,
}: {
  cofre: CofreDeHorda;
  barra: React.RefObject<HTMLDivElement | null>;
  queda: number;
  menosMovimiento: boolean;
  onElegir: (respuesta: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/55 px-4 pb-6">
      <div
        role="dialog"
        aria-label="Cofre de jefe"
        className="mx-auto w-full max-w-md rounded-2xl border-2 border-amber-500 bg-[var(--fondo)] p-3"
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--texto-aviso)]">
            Cofre de jefe · completa el modismo
          </p>
          {menosMovimiento && (
            <span className="text-sm font-extrabold tabular-nums">
              {Math.max(0, Math.ceil(queda * 6))}
            </span>
          )}
        </div>

        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--superficie)]">
          <div
            ref={barra}
            className="h-full origin-left rounded-full bg-amber-500"
            style={{ transform: menosMovimiento ? `scaleX(${queda})` : 'scaleX(1)' }}
          />
        </div>

        <p className="mt-2 text-sm text-[var(--texto-suave)]">{cofre.significadoEs}</p>
        <p lang="en" className="text-xl font-extrabold leading-tight">
          {cofre.frase}
        </p>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {cofre.opciones.map((opcion, indice) => (
            <button
              key={opcion}
              type="button"
              lang="en"
              autoFocus={indice === 0}
              aria-keyshortcuts={String(indice + 1)}
              onClick={() => onElegir(opcion)}
              className="boton-3d flex min-h-14 flex-col items-center justify-center rounded-xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-1"
            >
              <span className="w-full truncate text-sm font-extrabold">{opcion}</span>
              <span className="text-[10px] font-bold text-[var(--texto-suave)]">{indice + 1}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * La arena con `prefers-reduced-motion`: un tablero de casillas y turnos.
 *
 * No es una versión recortada del juego. Es la misma simulación llamada una vez
 * cada turno y medio con un paso grande, así que las sombras corren lo mismo,
 * la horda crece igual y las preguntas son las mismas; lo único que no hay es
 * interpolación. Nada se desliza: las cosas están en otra casilla y ya.
 *
 * Con esto se puede jugar entero con las flechas, sin tocar la pantalla y sin
 * que se mueva un píxel entre turno y turno. La cuadrícula es de 7×9 porque en
 * 288 px una casilla sale de 41 px, que es lo mínimo que se distingue de un
 * vistazo con un emoji dentro.
 */
function Tablero({
  mundo,
  ronda,
  ancho,
  turno,
  onIr,
}: {
  mundo: Mundo | null;
  ronda: RondaDeHorda;
  ancho: number;
  turno: number;
  /** Hacia qué punto de la arena quiere ir Milo en el turno siguiente. */
  onIr: (x: number, y: number) => void;
}) {
  const columnas = 7;
  const filas = 9;
  if (!mundo) return null;

  const casilla = (x: number, y: number) => ({
    c: Math.min(columnas - 1, Math.max(0, Math.floor((x / ronda.arena.ancho) * columnas))),
    f: Math.min(filas - 1, Math.max(0, Math.floor((y / ronda.arena.alto) * filas))),
  });

  const rejilla: Array<{ sombras: number; orbe: Orbe | null; milo: boolean; cofre: boolean }> =
    Array.from({ length: columnas * filas }, () => ({
      sombras: 0,
      orbe: null,
      milo: false,
      cofre: false,
    }));

  for (const sombra of mundo.sombras) {
    const { c, f } = casilla(sombra.x, sombra.y);
    rejilla[f * columnas + c]!.sombras += 1;
  }
  for (const orbe of mundo.orbes) {
    const { c, f } = casilla(orbe.x, orbe.y);
    rejilla[f * columnas + c]!.orbe = orbe;
  }
  if (mundo.cofreEnArena) {
    const { c, f } = casilla(mundo.cofreEnArena.x, mundo.cofreEnArena.y);
    rejilla[f * columnas + c]!.cofre = true;
  }
  const suyo = casilla(mundo.milo.x, mundo.milo.y);
  rejilla[suyo.f * columnas + suyo.c]!.milo = true;

  return (
    <div
      data-turno={turno}
      className="grid gap-0.5 rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-1"
      style={{ width: ancho, gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
    >
      {rejilla.map((celda, i) => (
        /*
          Cada casilla es un botón, y eso es lo que hace que este modo se pueda
          jugar con el dedo. Con movimiento reducido no hay mando flotante
          —arrastrar es justo el gesto que este modo evita— así que se toca la
          casilla a la que se quiere ir y Milo tira hacia allí en su turno.
          Con teclado siguen valiendo las flechas, igual que en el otro modo.
        */
        <button
          key={i}
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() =>
            onIr(
              ((i % columnas) + 0.5) * (ronda.arena.ancho / columnas),
              (Math.floor(i / columnas) + 0.5) * (ronda.arena.alto / filas),
            )
          }
          className={cn(
            'flex aspect-square items-center justify-center overflow-hidden rounded-md text-[9px] font-extrabold',
            celda.milo && 'bg-marca-100 dark:bg-marca-900',
            !celda.milo && celda.sombras > 0 && 'bg-violet-200 dark:bg-violet-900',
          )}
        >
          {celda.milo ? (
            <Mascota estado="feliz" tamano={Math.round(ancho / columnas) - 6} />
          ) : celda.cofre ? (
            <span aria-hidden>🧰</span>
          ) : celda.orbe ? (
            <span
              lang="en"
              className={cn(
                'w-full truncate px-0.5 text-center',
                celda.orbe.clase === 'verbo'
                  ? 'text-blue-700 dark:text-blue-300'
                  : mundo.cargado
                    ? 'text-pink-700 dark:text-pink-300'
                    : 'text-[var(--texto-suave)]',
              )}
            >
              {celda.orbe.texto}
            </span>
          ) : celda.sombras > 0 ? (
            <span aria-hidden className="text-xs leading-none">
              {celda.sombras > 1 ? celda.sombras : '●'}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/* ════════════════════════  LA ENTRADA  ════════════════════════ */

/**
 * La pantalla de antes de empezar.
 *
 * Dice lo único que hay que saber antes de la primera partida y que nadie
 * adivinaría: que MATAR NO DA PUNTOS. Sin decirlo, la primera partida se juega
 * matando sombras, se acaba con cero y se lee como que el juego está roto. Con
 * decirlo, la primera partida ya se juega buscando orbes, que es el juego.
 */
function Entrada({
  ronda,
  menosMovimiento,
  onEmpezar,
  onSalir,
}: {
  ronda: RondaDeHorda;
  menosMovimiento: boolean;
  onEmpezar: () => void;
  onSalir: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-3">
      <CabeceraJuego onSalir={onSalir} />

      <div className="mt-2">
        <MascotaConMensaje
          estado="animando"
          mensaje="Yo esquivo. Tú dime qué decir, y mi arma crece con cada compuesto que exista de verdad."
        />
      </div>

      <div className="mt-4 rounded-2xl bg-[var(--superficie)] p-3 text-sm">
        <p>
          <strong>Matar no da ni un punto.</strong> Los puntos y el arma salen de una sola cosa:
          juntar el <strong>verbo</strong> y la <strong>partícula</strong> que forman el compuesto
          que pide la escena de arriba.
        </p>
        <p className="mt-2 text-[var(--texto-suave)]">
          Primero pisa un orbe azul (el verbo) y después uno rosa (la partícula). Si el compuesto
          existe y significa lo que pedían, tu arma sube de rango; cada rango multiplica el daño.
          Sin forjar, la horda te pasa por encima en el minuto dos.
        </p>
      </div>

      <div className="mt-3 rounded-2xl bg-[var(--superficie)] p-3 text-sm text-[var(--texto-suave)]">
        <p>
          <strong className="text-[var(--texto)]">Se juega con las flechas o con WASD</strong>, o
          arrastrando el dedo por la arena. En el cofre de jefe, con 1, 2 y 3.
        </p>
        <p className="mt-2">
          La partida dura {ronda.partida.segundos} segundos con {ronda.partida.vidas} corazones.
          Cada {ronda.partida.segundosEntreCofres} segundos sale un cofre: completa el modismo y la
          pantalla se limpia.
        </p>
        {menosMovimiento && (
          <p className="mt-2">
            Como pediste menos movimiento, la arena es un tablero y la partida va por turnos: cada
            turno las sombras dan un paso, tú das el tuyo y tu arma dispara. Nada se desplaza por la
            pantalla y las preguntas son exactamente las mismas.
          </p>
        )}
      </div>

      <div className="mt-5">
        <button
          type="button"
          autoFocus
          onClick={onEmpezar}
          className="boton-3d w-full rounded-2xl border-2 border-blue-900 bg-blue-800 px-4 py-3 text-lg font-extrabold text-white"
        >
          EMPEZAR
        </button>
      </div>
    </div>
  );
}
