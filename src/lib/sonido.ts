import { useEffect, useState } from 'react';
import { quiereMenosMovimiento } from '@/lib/movimiento';

/**
 * El sonido de los juegos, fabricado en el momento.
 *
 * No hay ni un fichero de audio. Cada pitido es un oscilador y una envolvente:
 * se enciende una onda cuadrada a una frecuencia, se le sube y se le baja el
 * volumen en unas centésimas y se apaga. Suena a consola de ocho bits porque es
 * literalmente cómo sonaban, y pesa cero bytes: nada que descargar, nada que
 * cachear, nada que se quede a medias con mala cobertura.
 *
 *
 * LAS TRES COSAS QUE NO SE PUEDEN SALTAR
 *
 * 1. El navegador no deja sonar nada hasta que la persona toca la pantalla. Si
 *    se crea el `AudioContext` al cargar, nace «suspended», no suena y deja un
 *    aviso en la consola. Por eso se crea en respuesta a un gesto —ver
 *    `useDespertarSonido`— y hasta entonces `sonar` no hace nada.
 *
 * 2. Se tiene que poder apagar, y hay que acordarse. Un juego que pita sin
 *    permiso en una oficina es un juego que se desinstala. El interruptor está
 *    en los ajustes y se guarda en este aparato, no en la cuenta: el sonido es
 *    del sitio donde estás —el portátil del trabajo en silencio, el móvil del
 *    sofá a todo volumen—, no de la persona.
 *
 * 3. Con `prefers-reduced-motion` no suena nada. No es solo movimiento: quien
 *    pide menos estímulo tampoco quiere fanfarrias.
 *
 * Y un solo `AudioContext` para toda la aplicación. Los navegadores permiten un
 * puñado por pestaña y luego dejan de crearlos; uno por pitido se queda mudo a
 * los pocos aciertos.
 */

export type Sonido = 'acierto' | 'fallo' | 'combo' | 'tic' | 'fin' | 'record' | 'moneda';

export interface OpcionesDeSonido {
  /** Para `combo`: cuántos aciertos seguidos llevas. Cuanto más alta, más agudo. */
  racha?: number;
  /** Para `tic`: los últimos segundos suenan más arriba y más fuerte. */
  urgente?: boolean;
}

export const CLAVE_SONIDO = 'speakmi.sonido';

/**
 * El volumen general.
 *
 * Bajo a propósito. Esto no es música, son avisos que suenan treinta veces por
 * minuto; a un volumen «normal» cansan en dos partidas y lo primero que se hace
 * es apagarlos. Vale más que se queden cortos y nadie los apague.
 */
const VOLUMEN = 0.12;

let contexto: AudioContext | null = null;
let maestro: GainNode | null = null;
/** ¿Ya hubo un gesto? Sin él, crear el contexto solo sirve para ensuciar la consola. */
let despierto = false;
let encendido = leerPreferencia();

/** Quien esté pintando el interruptor, para que se entere si cambia en otra pestaña. */
const oyentes = new Set<(valor: boolean) => void>();

/** ¿Suena o no? */
export function sonidoEncendido(): boolean {
  return encendido;
}

/** Enciende o apaga, y lo recuerda. */
export function encenderSonido(valor: boolean): void {
  encendido = valor;
  try {
    localStorage.setItem(CLAVE_SONIDO, valor ? 'si' : 'no');
  } catch {
    // Sin memoria local el ajuste dura lo que dure la pestaña. Peor es no dejar
    // apagarlo.
  }
  for (const oyente of oyentes) oyente(valor);
}

/**
 * Prepara el audio. Solo vale llamarlo desde un gesto de verdad.
 *
 * Aquí es donde nace el `AudioContext`, y nace una sola vez. Si ya existe pero
 * el navegador lo durmió —cambiar de pestaña lo duerme— se reanuda.
 */
export function despertarSonido(): void {
  despierto = true;
  if (!encendido || quiereMenosMovimiento()) return;
  asegurarContexto();
}

/**
 * ¿Ha tocado ya algo esta persona, en algún momento?
 *
 * El gesto que nos vale casi siempre es el de `useDespertarSonido`, pero llega
 * tarde en un caso concreto: entrar a un juego se hace pulsando en la pantalla
 * anterior, y ese toque ocurre ANTES de que el juego se monte y ponga a
 * escuchar. Quien entra al contrarreloj y se queda leyendo sin tocar nada se
 * quedaría sin el tic del reloj, que es justo cuando más falta hace.
 *
 * `userActivation.hasBeenActive` es exactamente lo que el navegador usa para
 * decidir si deja sonar: dice si hubo interacción en algún momento de la vida de
 * la página. Donde no existe —Safari, de momento— se sigue con los oyentes, que
 * funcionan en todas partes.
 */
function hayGesto(): boolean {
  if (despierto) return true;
  if (typeof navigator === 'undefined') return false;
  const activacion = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } })
    .userActivation;
  return activacion?.hasBeenActive === true;
}

/**
 * Suena `nombre`.
 *
 * No lanza nunca y no devuelve nada: un pitido que falla no puede romper una
 * partida. Si no se puede sonar —apagado, sin gesto, sin soporte— no pasa nada
 * y el juego sigue exactamente igual, porque todo lo que se oye está dicho
 * también en la pantalla.
 */
export function sonar(nombre: Sonido, opciones: OpcionesDeSonido = {}): void {
  if (!encendido || !hayGesto() || quiereMenosMovimiento()) return;

  const ctx = asegurarContexto();
  if (!ctx || !maestro) return;

  // Un pelín por delante del reloj del audio: programar en el instante exacto
  // se oye como un chasquido en algunos equipos.
  const t = ctx.currentTime + 0.005;

  switch (nombre) {
    // Dos notas hacia arriba, cortas y limpias. Es el «sí» de toda la vida.
    case 'acierto':
      nota({ frecuencia: 880, inicio: t, duracion: 0.07 });
      nota({ frecuencia: 1318.5, inicio: t + 0.06, duracion: 0.11 });
      break;

    /*
      Un gruñido que cae.

      Ni estridente ni largo: fallar ya escuece, y un sonido de castigo hace que
      se juegue con miedo. Baja de sol a sol una octava más abajo en un cuarto
      de segundo y se va.
    */
    case 'fallo':
      nota({
        frecuencia: 196,
        hasta: 98,
        inicio: t,
        duracion: 0.26,
        tipo: 'sawtooth',
        volumen: 0.5,
      });
      break;

    /*
      El arpegio de la racha, y el único sonido que cambia con lo que haces.

      Cada acierto seguido lo sube un semitono. Es lo que convierte una lista de
      ejercicios en una escalera: la respuesta siguiente SUENA más alta que la
      anterior, y eso se nota antes de leer ningún número.
    */
    case 'combo': {
      const escalon = Math.min(Math.max(opciones.racha ?? 2, 2), 14) - 2;
      const base = 523.25 * Math.pow(2, escalon / 12);
      nota({ frecuencia: base, inicio: t, duracion: 0.07, volumen: 0.55 });
      nota({ frecuencia: base * 1.26, inicio: t + 0.05, duracion: 0.07, volumen: 0.6 });
      nota({ frecuencia: base * 1.5, inicio: t + 0.1, duracion: 0.13, volumen: 0.7 });
      break;
    }

    // El reloj. Cortísimo y flojo, que va a sonar diez veces seguidas.
    case 'tic':
      nota({
        frecuencia: opciones.urgente ? 2100 : 1500,
        inicio: t,
        duracion: 0.03,
        volumen: opciones.urgente ? 0.45 : 0.25,
      });
      break;

    // Tres notas que bajan y se posan: se acabó, sin drama.
    case 'fin':
      nota({ frecuencia: 659.3, inicio: t, duracion: 0.12, tipo: 'triangle', volumen: 0.6 });
      nota({ frecuencia: 523.3, inicio: t + 0.11, duracion: 0.12, tipo: 'triangle', volumen: 0.6 });
      nota({ frecuencia: 392, inicio: t + 0.22, duracion: 0.3, tipo: 'triangle', volumen: 0.6 });
      break;

    /*
      La fanfarria del récord: do-mi-sol-do, y la última con su quinta encima
      para que suene a acorde y no a nota suelta. Dura casi un segundo, que es
      mucho para un aviso y justo para algo que pasa una vez cada muchas
      partidas.
    */
    case 'record':
      nota({ frecuencia: 523.3, inicio: t, duracion: 0.1 });
      nota({ frecuencia: 659.3, inicio: t + 0.09, duracion: 0.1 });
      nota({ frecuencia: 784, inicio: t + 0.18, duracion: 0.1 });
      nota({ frecuencia: 1046.5, inicio: t + 0.27, duracion: 0.45 });
      nota({ frecuencia: 1568, inicio: t + 0.27, duracion: 0.45, tipo: 'triangle', volumen: 0.4 });
      break;

    // La moneda de siempre: un golpe y una nota que se queda sonando.
    case 'moneda':
      nota({ frecuencia: 988, inicio: t, duracion: 0.07, volumen: 0.5 });
      nota({ frecuencia: 1318.5, inicio: t + 0.06, duracion: 0.32, volumen: 0.5 });
      break;
  }
}

/* ──────────────────────  EL RITMO, PARA «AL COMPÁS»  ────────────────────── */

/**
 * Lo que un juego de ritmo necesita y `sonar` no puede dar.
 *
 * `sonar` toca AHORA: se llama cuando pasa algo y suena unos milisegundos
 * después. Con eso se hacen avisos, y con avisos no se hace un compás. Un juego
 * de ritmo necesita decir «este bombo suena en el segundo 12,600 exacto» con
 * varios segundos de antelación, porque programar audio con `setTimeout` o con
 * `requestAnimationFrame` falla por decenas de milisegundos y eso se OYE: un
 * desajuste de 20 ms entre dos golpes ya se nota.
 *
 * La Web Audio API sí sabe hacerlo: `oscillator.start(t)` con `t` en el reloj
 * del propio audio lo programa en el hilo de audio, que no se entera de si el
 * navegador va justo de trabajo ni de cuántos fotogramas se perdieron. Es la
 * única forma de que una canción suene en su sitio, y es lo que estas funciones
 * abren al resto de la casa.
 *
 * Todo esto es AÑADIDO: no cambia ni una línea de lo de arriba, y `sonar` sigue
 * haciendo exactamente lo mismo para los otros diez juegos.
 */

/**
 * El reloj del audio, si se puede tener.
 *
 * Devuelve `null` exactamente en los mismos casos en los que `sonar` no suena
 * —apagado, sin gesto todavía, con `prefers-reduced-motion`, sin soporte— y eso
 * es a propósito: quien lo pide tiene que estar preparado para jugar sin él. En
 * «Al compás» eso significa llevar el compás con la vista, que es justo lo que
 * hace falta para que el juego funcione con movimiento reducido.
 */
export function contextoDeAudio(): AudioContext | null {
  if (!encendido || !hayGesto() || quiereMenosMovimiento()) return null;
  return asegurarContexto();
}

/**
 * Un canal propio para el juego, que se puede callar y tirar de golpe.
 *
 * Sin él, una partida abandonada a media canción dejaría sonando todo lo que ya
 * estuviera programado, que pueden ser varios segundos de bombos en una pantalla
 * que ya no existe. Con un `GainNode` propio basta con desconectarlo.
 */
export function abrirCanal(): GainNode | null {
  const ctx = contextoDeAudio();
  if (!ctx || !maestro) return null;

  const canal = ctx.createGain();
  canal.gain.value = 1;
  canal.connect(maestro);
  return canal;
}

export type Percusion =
  /** El bombo: el pulso fuerte. */
  | 'bombo'
  /** La caja, en los pulsos 2 y 4. */
  | 'caja'
  /** El charles, que subdivide y es lo que se siente como «velocidad». */
  | 'charles'
  /** Una nota acertada. */
  | 'nota'
  /** Acertada EN EL PULSO. Suena más arriba, y es todo lo que gana. */
  | 'perfecto'
  /** Nota fallada o escapada. */
  | 'perdida';

/**
 * Programa un golpe para el instante `cuando`, en el reloj del contexto.
 *
 * `cuando` es tiempo ABSOLUTO de `AudioContext.currentTime`, no un retraso. Es
 * la diferencia entre «suena dentro de 600 ms, más o menos» y «suena en el
 * segundo 12,600», y es toda la diferencia entre un compás y un ruido.
 */
export function golpe(canal: GainNode, tipo: Percusion, cuando: number): void {
  if (!contexto) return;

  switch (tipo) {
    /*
      El bombo: una onda que CAE de 150 a 45 hercios en una décima.

      Un bombo no es una nota grave, es una caída. Con la frecuencia fija suena
      a pitido de horno; deslizándola hacia abajo el oído lo oye como un golpe,
      que es exactamente lo que hacen las cajas de ritmos desde 1980.
    */
    case 'bombo':
      enCanal(canal, { frecuencia: 150, hasta: 45, inicio: cuando, duracion: 0.13, tipo: 'sine' });
      break;

    // La caja: un chasquido de ruido con un cuerpo grave debajo.
    case 'caja':
      ruido(canal, cuando, 0.14, 1400, 0.5);
      enCanal(canal, {
        frecuencia: 190,
        hasta: 120,
        inicio: cuando,
        duracion: 0.09,
        tipo: 'triangle',
        volumen: 0.45,
      });
      break;

    // El charles: ruido cortísimo y muy agudo.
    case 'charles':
      ruido(canal, cuando, 0.035, 7000, 0.22);
      break;

    case 'nota':
      enCanal(canal, { frecuencia: 880, inicio: cuando, duracion: 0.09, volumen: 0.5 });
      break;

    /*
      El «perfecto»: la misma nota con su quinta encima.

      No paga ni un punto —lo explica `beat.ts`— así que todo lo que gana quien
      clava el pulso es esto. Por eso tiene que notarse: es un acorde y no una
      nota suelta.
    */
    case 'perfecto':
      enCanal(canal, { frecuencia: 1046.5, inicio: cuando, duracion: 0.1, volumen: 0.5 });
      enCanal(canal, {
        frecuencia: 1568,
        inicio: cuando + 0.01,
        duracion: 0.14,
        tipo: 'triangle',
        volumen: 0.4,
      });
      break;

    /*
      La nota perdida, y a propósito SUAVE.

      En un juego de ritmo se falla mucho y seguido. El castigo sonoro de
      `sonar('fallo')` repetido treinta veces en cincuenta segundos convierte la
      partida en una regañina, y lo que hace falta después de fallar es volver a
      engancharse al compás.
    */
    case 'perdida':
      enCanal(canal, {
        frecuencia: 180,
        hasta: 110,
        inicio: cuando,
        duracion: 0.12,
        tipo: 'sawtooth',
        volumen: 0.3,
      });
      break;
  }
}

/**
 * El ruido de la caja y del charles.
 *
 * Es el único sonido de toda la aplicación que necesita una FUENTE y no un
 * oscilador, porque el ruido blanco no es una onda periódica: hay que
 * fabricarlo muestra a muestra. Medio segundo a la frecuencia del contexto son
 * unos 24 000 números, se genera UNA vez y se reutiliza en cada golpe. Sigue
 * siendo cero bytes descargados.
 */
let muestraDeRuido: AudioBuffer | null = null;

function ruido(
  canal: GainNode,
  inicio: number,
  duracion: number,
  corte: number,
  volumen: number,
): void {
  const ctx = contexto;
  if (!ctx) return;

  if (!muestraDeRuido) {
    muestraDeRuido = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const datos = muestraDeRuido.getChannelData(0);
    for (let i = 0; i < datos.length; i += 1) datos[i] = Math.random() * 2 - 1;
  }

  const fuente = ctx.createBufferSource();
  fuente.buffer = muestraDeRuido;

  // Un paso alto: sin él la caja suena a soplido y se come el bombo.
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'highpass';
  filtro.frequency.value = corte;

  const sobre = ctx.createGain();
  sobre.gain.setValueAtTime(volumen, inicio);
  sobre.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);

  fuente.connect(filtro);
  filtro.connect(sobre);
  sobre.connect(canal);
  fuente.start(inicio);
  fuente.stop(inicio + duracion + 0.02);
}

/** Una `nota`, pero saliendo por el canal del juego en vez de por el maestro. */
function enCanal(canal: GainNode, datos: Nota): void {
  const ctx = contexto;
  if (!ctx) return;

  const { frecuencia, inicio, duracion, hasta, tipo = 'square', volumen = 0.7 } = datos;
  const oscilador = ctx.createOscillator();
  const sobre = ctx.createGain();

  oscilador.type = tipo;
  oscilador.frequency.setValueAtTime(frecuencia, inicio);
  if (hasta) {
    oscilador.frequency.exponentialRampToValueAtTime(Math.max(hasta, 1), inicio + duracion);
  }

  sobre.gain.setValueAtTime(0.0001, inicio);
  sobre.gain.exponentialRampToValueAtTime(Math.max(volumen, 0.0002), inicio + 0.006);
  sobre.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);

  oscilador.connect(sobre);
  sobre.connect(canal);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracion + 0.05);
}

/**
 * El interruptor, para pintarlo.
 *
 * Devuelve el estado y cómo cambiarlo. Se suscribe a los cambios porque el
 * ajuste se puede tocar desde dos sitios —los ajustes y, si algún día hace
 * falta, dentro del juego— y los dos tienen que enseñar lo mismo.
 */
export function useSonido(): { encendido: boolean; cambiar: (valor: boolean) => void } {
  const [valor, setValor] = useState(sonidoEncendido);

  useEffect(() => {
    const oyente = (nuevo: boolean) => setValor(nuevo);
    oyentes.add(oyente);
    // Por si cambió entre el primer render y este efecto.
    setValor(sonidoEncendido());
    return () => {
      oyentes.delete(oyente);
    };
  }, []);

  return { encendido: valor, cambiar: encenderSonido };
}

/**
 * Deja el audio listo en cuanto la persona toque algo.
 *
 * Escucha `pointerdown` y no `click` a propósito: el `pointerdown` ocurre ANTES
 * de que salte el `onClick` del botón, así que el primer acierto de la partida
 * ya suena. Con `click` siempre se perdía el primero.
 */
export function useDespertarSonido(): void {
  useEffect(() => {
    if (despierto) return;

    const tipos = ['pointerdown', 'touchstart', 'keydown'] as const;
    const alGesto = () => {
      despertarSonido();
      quitar();
    };
    const quitar = () => {
      for (const tipo of tipos) window.removeEventListener(tipo, alGesto);
    };

    for (const tipo of tipos) window.addEventListener(tipo, alGesto, { passive: true });
    return quitar;
  }, []);
}

/** Para las pruebas: deja el módulo como recién cargado. */
export function reiniciarSonidoParaPruebas(): void {
  contexto = null;
  // La muestra de ruido se fabrica contra un contexto concreto: con otro no
  // vale, así que se olvida con él.
  muestraDeRuido = null;
  maestro = null;
  despierto = false;
  encendido = leerPreferencia();
  oyentes.clear();
}

function leerPreferencia(): boolean {
  try {
    // Por defecto encendido: un juego mudo la primera vez no se siente un juego,
    // y apagarlo son dos toques.
    return localStorage.getItem(CLAVE_SONIDO) !== 'no';
  } catch {
    return true;
  }
}

function asegurarContexto(): AudioContext | null {
  if (contexto) {
    // Cambiar de pestaña lo duerme. Reanudar solo vale si hubo gesto, y aquí
    // siempre lo hubo.
    if (contexto.state === 'suspended') void contexto.resume().catch(() => undefined);
    return contexto;
  }

  const Clase = claseDeAudio();
  if (!Clase) return null;

  try {
    contexto = new Clase();
    maestro = contexto.createGain();
    maestro.gain.value = VOLUMEN;
    maestro.connect(contexto.destination);
  } catch {
    // Navegador sin audio, o con demasiados contextos abiertos. Se juega igual.
    contexto = null;
    maestro = null;
  }

  return contexto;
}

function claseDeAudio(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const conPrefijo = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? conPrefijo.webkitAudioContext ?? null;
}

interface Nota {
  frecuencia: number;
  inicio: number;
  duracion: number;
  /** A dónde desliza la frecuencia, si desliza. Es lo que hace el «uhh» del fallo. */
  hasta?: number;
  tipo?: OscillatorType;
  /** Sobre el volumen general, de 0 a 1. */
  volumen?: number;
}

/**
 * Una nota: un oscilador con su envolvente.
 *
 * La envolvente es lo que separa un pitido de juego de una alarma de horno. Sin
 * ella el sonido empieza y acaba de golpe y chasquea; con una subida de ocho
 * milisegundos y una caída exponencial suena a instrumento.
 *
 * Las rampas son exponenciales y nunca llegan a cero porque `exponentialRamp`
 * no admite el cero: se va a una diezmilésima, que ya es silencio.
 */
function nota({ frecuencia, inicio, duracion, hasta, tipo = 'square', volumen = 0.7 }: Nota): void {
  if (!contexto || !maestro) return;

  const oscilador = contexto.createOscillator();
  const sobre = contexto.createGain();

  oscilador.type = tipo;
  oscilador.frequency.setValueAtTime(frecuencia, inicio);
  if (hasta)
    oscilador.frequency.exponentialRampToValueAtTime(Math.max(hasta, 1), inicio + duracion);

  sobre.gain.setValueAtTime(0.0001, inicio);
  sobre.gain.exponentialRampToValueAtTime(Math.max(volumen, 0.0002), inicio + 0.008);
  sobre.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);

  oscilador.connect(sobre);
  sobre.connect(maestro);
  oscilador.start(inicio);
  // Se para sola: un oscilador que no se para se queda en memoria para siempre.
  oscilador.stop(inicio + duracion + 0.05);
}
