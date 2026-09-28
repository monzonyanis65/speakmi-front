import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'; // prettier-ignore
import { cn } from '@/lib/cn';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { Boton } from '@/components/Boton';
import { Mascota } from '@/components/Mascota';
import { CabeceraJuego, Contador, Racha } from './Tablero';
import { Destello } from './efectos';
import { puntosDelServidor } from './puntos';
import type { CurvaDeDerrape, Marcador, RespuestaCorregida, RondaDeDerrape } from './tipos';

/**
 * DERRAPE: un circuito cenital, dos carriles y la palabra exacta.
 *
 * Milo conduce visto desde arriba. Arriba, quieta, hay una glosa en español
 * —«asegurarse de que pase»— y por delante la pista se parte en dos con un cartel
 * sobre cada rama: `ensure` y `assure`. La rama buena es la trazada: el coche
 * derrapa, saltan chispas y sale disparado. La mala es grava: se atraviesa, pierde
 * segundo y cuarto y ahí se lee la regla.
 *
 *
 * QUÉ HACE ESTO QUE NO HAGA `Carrera.tsx`
 *
 * Se parecen por fuera y conviene decir en qué se separan, porque si la respuesta
 * fuera «lo mismo con coches» sobraría uno de los dos.
 *
 *   1. LO QUE SE PREGUNTA. CARRERA sirve `sent / send / sending`: dos de las tres
 *      son imposibles detrás de «has», así que se tiran sin saber qué significan.
 *      Aquí los dos carteles existen los dos y encajarían los dos. Lo único que
 *      los separa es el significado. Por eso aquí hay DOS ramas y no tres —una
 *      tercera palabra sería relleno, y el relleno se descarta sin leer— y por eso
 *      el trozo de decidir tiene 400 ms más de suelo que allí.
 *   2. LA REPETICIÓN. Son dos vueltas al mismo trazado: los seis pares de la
 *      vuelta 2 son los de la vuelta 1, cuarenta segundos después. Quien falló leyó
 *      la regla en la grava y se la vuelven a preguntar cuando todavía le sirve.
 *      CARRERA hace lo contrario a propósito.
 *   3. EL MARCADOR. CARRERA es supervivencia, con una sombra detrás. Esto es una
 *      contrarreloj: la vuelta 1 pone el listón y la 2 se corre contra ella, con el
 *      crono diciendo en vivo si vas por encima o por debajo.
 *
 *
 * AQUÍ SÍ HAY UN BUCLE, Y ES LA OTRA DECISIÓN TÉCNICA QUE LOS SEPARA
 *
 * `Carrera.tsx` presume, con razón, de no tener ni un `requestAnimationFrame`: sus
 * puertas son animaciones de CSS y el reloj de cada puerta ES su propia animación.
 * Puede permitírselo porque allí nada se conduce. Milo salta de carril a carril y
 * el tiempo solo acerca una puerta.
 *
 * Aquí se conduce, y eso no cabe en un `@keyframes`. El coche tiene inercia, se
 * pasa de frenada, vuelve al centro cuando la pista se junta y el ángulo con el
 * que va atravesado sale de su propia velocidad lateral. Nada de eso se puede
 * declarar de antemano porque depende de lo que se haga en cada fotograma.
 *
 * Así que hay un bucle, uno solo, y escribe los `transform` DIRECTAMENTE sobre los
 * elementos sin pasar por el estado de React. Es lo mismo que hace `Beat.tsx` con
 * sus notas y por lo mismo: sesenta renders por segundo con una mascota dentro es
 * trabajo de sobra para que un móvil pierda fotogramas, y lo que se pinta es
 * siempre lo mismo moviéndose. React solo vuelve a pintar cuando una curva se
 * resuelve: veinticuatro veces en toda la carrera.
 *
 * Y el bucle NO USA el sello de tiempo que le pasa `requestAnimationFrame`. Se
 * mide con `performance.now()` dentro del latido, que es lo que dejó escrito
 * `Particulas.tsx` después de que mezclar los dos relojes —el del documento y el
 * del proceso— dejara una barra llena para siempre. Fíjate en que `latido` no
 * recibe argumento: es a propósito.
 *
 *
 * EL CRONO NO SE LO INVENTA NADIE
 *
 * Un juego de contrarreloj se vuelve deshonesto sin querer en cuanto cronometra
 * con el reloj del navegador algo que el servidor no puede comprobar. Aquí el
 * tiempo de un sector es una función pura de la secuencia de aciertos —la ventana
 * de la curva más su salida, y la salida depende de si se derrapó, de la cadena o
 * de si se acabó en la grava—, que es exactamente lo que el servidor corrige y
 * apunta. La fórmula está en `back/src/modules/games/derrape.ts` y aquí abajo hay
 * una copia a mano, igual que `puntos.ts` copia la de la puntuación y por el mismo
 * motivo.
 *
 * Y los PUNTOS siguen siendo los de siempre: aciertos y racha máxima por la
 * fórmula del servidor. La cadena de derrape acelera el coche y no los puntos, y
 * lo dice con esas palabras en pantalla. `Tablero.tsx` dejó escrito por qué un
 * multiplicador al lado de una puntuación que no multiplica se lee como una
 * estafa.
 */

/* ────────────────────────────  LOS NÚMEROS DE LA PANTALLA  ──────────────────────────── */

/**
 * La vuelta de formación: 1,8 segundos antes de la primera curva.
 *
 * El coche ya rueda y el asfalto ya corre, pero todavía no hay nada que leer. Sin
 * este respiro, la primera curva aparece encima de una pantalla que no se ha
 * entendido y se pierde siempre, y perder por no haber podido mirar todavía es la
 * peor forma de empezar un juego. Es el mismo respiro que se le puso a CAEN y a
 * CARRERA, y doscientos milisegundos más largo porque aquí además hay que
 * entender que se conduce.
 *
 * Y NO cuenta en el crono: el cronómetro arranca en la primera curva. Regalar o
 * cobrar segundos de una vuelta de formación sería lo primero que no cuadraría al
 * comparar dos partidas.
 */
const FORMACION = 1800;

/** Lo que se queda la bandera a cuadros antes de cerrar la partida. */
const META = 1700;

/** Lo que manda el navegador cuando el coche llegó a la bifurcación sin girar. */
const NO_GIRO = 'recto';

/**
 * La física del coche, que son cuatro líneas de integración y tres constantes.
 *
 * El texto que trajo la idea de este juego sugería Matter.js. No hace falta y no
 * se ha añadido: lo único que se simula es una masa colgada de un muelle que tira
 * del coche hacia la rama elegida, con rozamiento. De ahí salen solos el arranque,
 * la frenada, el sobreimpulso al llegar —que es el derrape— y el ángulo con el que
 * el coche va atravesado, que no es más que su velocidad lateral.
 *
 * RIGIDEZ 118 y ROCE 11,5 dan un cambio de rama en unos 300 ms con un 12 % de
 * sobreimpulso. Los dos números están elegidos contra el presupuesto del reloj: el
 * servidor reserva unos 250 ms para girar dentro de `MS_DECISION_SUELO`, así que
 * un coche que tardara medio segundo en cruzar estaría cobrando un tiempo de
 * decisión que no da.
 */
const RIGIDEZ = 118;
const ROCE = 11.5;
const GIRO_MAXIMO = 32;

/**
 * Lo ancho que es el bordillo del medio, en fracción de pista: 0,13.
 *
 * Es lo que convierte «no girar» en un resultado propio y no en un acierto a
 * medias. Si el coche llega a la bifurcación con el morro dentro de esa franja, se
 * come el bordillo y no toma ninguna rama: eso es el muro, y el servidor lo cobra
 * más caro que la grava porque no decidir tiene que ser peor que decidir mal.
 *
 * Y es lo que hace REAL el cuarto de segundo que el servidor reserva para girar:
 * un volantazo en el último instante no llega, igual que no llega en un coche.
 */
const ANCHO_DEL_BORDILLO = 0.13;

/** Dónde está el plano del coche dentro de la pista, en fracción del alto. */
const PLANO_DEL_COCHE = 0.7;

/** De dónde salen los carteles y hasta dónde llegan, en fracción del alto. */
const CARTEL_DESDE = -0.04;
const CARTEL_HASTA = PLANO_DEL_COCHE;
/** Y hasta dónde siguen mientras el coche sale de la curva, ya por debajo. */
const CARTEL_FUERA = 1.15;

/** Lo pequeños que salen los carteles a lo lejos. */
const CARTEL_ESCALA_LEJOS = 0.84;

/**
 * Por qué el 84 % y no un punto de fuga de verdad.
 *
 * Es la misma renuncia que documenta `index.css` para los portales de CARRERA y
 * aquí aprieta todavía más, porque las palabras son más largas. A 320 px la pista
 * mide 292 px y cada cartel ocupa el 44 %, o sea 128 px. Con el 84 % arranca a 108
 * px, y `put up with` a 15 px ocupa 99: se lee desde el primer instante. Con una
 * convergencia real —los dos saliendo del punto de fuga— la palabra empezaría a
 * seis píxeles y no se podría leer hasta media ventana, o sea que el juego estaría
 * cobrando el tiempo de lectura que calcula el servidor sin darlo. Ese es
 * exactamente el error que dejó injugable a LA PARTÍCULA.
 *
 * La profundidad la ponen el recorrido, el asfalto corriendo y que el coche no
 * cambie de tamaño.
 */

/** Cuántas rayas tiene el asfalto y cada cuánto se repiten, en píxeles. */
const RAYAS = 7;
const SEPARACION_DE_RAYAS = 74;

/** Lo deprisa que corre el asfalto, en píxeles por segundo. */
const VELOCIDAD_BASE = 300;
const VELOCIDAD_DERRAPE = 620;
const VELOCIDAD_GRAVA = 120;

/* ────────────────────────────  EL CRONO, COPIADO A MANO  ──────────────────────────── */

/**
 * La fórmula del tiempo de un sector.
 *
 * Es una copia a mano de `milisegundosDeSector` en
 * `back/src/modules/games/derrape.ts`, y está copiada a propósito por lo mismo que
 * `puntos.ts` copia la de la puntuación: quien juega necesita ver el crono correr
 * MIENTRAS conduce —un tiempo que solo aparece al final no es una contrarreloj— y
 * lo único peor que no enseñarlo es enseñar uno que no cuadre con el del final.
 *
 * Lo que la hace honesta es que todo lo que entra aquí lo sabe también el
 * servidor: qué curva era, en qué escalón iba el reloj, si se acertó y con cuántos
 * seguidos. O sea que la vuelta se puede reconstruir entera desde las respuestas
 * que él mismo corrigió. Si algún día cambia la fórmula de allí, cambia aquí.
 */
type Salida = 'derrape' | 'grava' | 'muro';
type Crono = RondaDeDerrape['crono'];

function bonificacionDeDerrape(crono: Crono, racha: number): number {
  if (racha <= 0) return 0;
  const eslabones = Math.min(racha - 1, crono.eslabonesMaximos - 1);
  return crono.derrapeBaseMs + eslabones * crono.derrapePorEslabonMs;
}

function milisegundosDeSalida(crono: Crono, salida: Salida, rachaTras: number): number {
  if (salida === 'derrape') return crono.salidaMs - bonificacionDeDerrape(crono, rachaTras);
  return crono.salidaMs + (salida === 'grava' ? crono.gravaMs : crono.muroMs);
}

/** La ventana de esta curva: leer la pista, mirar los carteles y decidir. */
function ventanaDe(curva: CurvaDeDerrape, ronda: RondaDeDerrape, paso: number): number {
  const escalones = ronda.reloj.escalones;
  const decision =
    escalones[Math.min(Math.max(paso, 0), escalones.length - 1)] ?? escalones[0] ?? 0;
  return curva.pistaMs + curva.cartelesMs + decision;
}

/**
 * El crono, escrito como se escribe un tiempo de vuelta.
 *
 * Tres decimales y no dos, y no es coquetería: la promesa del juego es bajar el
 * tiempo, y con dos decimales dos vueltas buenas empatan. Con `tabular-nums` el
 * número no baila de ancho aunque cambie sesenta veces por segundo.
 */
function comoCrono(ms: number): string {
  const segundos = Math.max(0, ms) / 1000;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos - minutos * 60;
  if (minutos <= 0) return resto.toFixed(3);
  return `${minutos}:${resto.toFixed(3).padStart(6, '0')}`;
}

/** Y la diferencia contra la vuelta de referencia, con su signo delante. */
function comoDiferencia(ms: number): string {
  const signo = ms > 0 ? '+' : ms < 0 ? '−' : '±';
  return `${signo}${(Math.abs(ms) / 1000).toFixed(3)}`;
}

/* ────────────────────────────  EL MARCADOR  ──────────────────────────── */

interface EstadoDeCarrera {
  aciertos: number;
  fallos: number;
  racha: number;
  rachaMaxima: number;
  /** En qué escalón del reloj va la carrera. */
  paso: number;
  /** Los milisegundos de cada sector ya cerrado, en orden. */
  sectores: number[];
}

interface Anotacion {
  acierto: boolean;
  sectorMs: number;
  pasosAtrasAlFallar: number;
}

/**
 * El marcador entero en una función pura.
 *
 * Pura porque hace falta poder calcularlo DOS VECES: una para el estado de React y
 * otra, en el mismo instante, para saber cuánto duró el sector que se acaba de
 * cerrar. El estado de React todavía no ha cambiado cuando el bucle tiene que
 * decidir cuánto va a durar la salida de esta curva.
 */
function reducir(estado: EstadoDeCarrera, accion: Anotacion): EstadoDeCarrera {
  const racha = accion.acierto ? estado.racha + 1 : 0;

  return {
    aciertos: estado.aciertos + (accion.acierto ? 1 : 0),
    fallos: estado.fallos + (accion.acierto ? 0 : 1),
    racha,
    rachaMaxima: Math.max(estado.rachaMaxima, racha),
    // La escalera cede al fallar, igual que en CARRERA, FALSOS_AMIGOS y
    // PARTICULAS: es lo que mantiene a cualquiera cerca de su 85 % de acierto.
    paso: accion.acierto ? estado.paso + 1 : Math.max(estado.paso - accion.pasosAtrasAlFallar, 0),
    sectores: [...estado.sectores, accion.sectorMs],
  };
}

interface Resultado {
  acierto: boolean;
  salida: Salida;
  /** Lo que sube el marcador con esta curva. Es el número que flota. */
  suma: number;
  racha: number;
  /** Lo que descuenta el derrape de esta curva, con la cadena ya contada. */
  bonificacionMs: number;
  /** Lo que dura la salida de la curva: es el rato que el coche sigue en la rama. */
  salidaMs: number;
  /** Y lo que ha costado el sector entero. */
  sectorMs: number;
  /**
   * En qué escalón del reloj queda la carrera después de esta curva.
   *
   * Sale de aquí y no del estado de React, y eso NO es duplicar por duplicar. El
   * bucle se monta una vez por carrera, así que su cierre se quedó con el `paso`
   * que había al montarlo: leerlo de ahí significa calcular las doce ventanas con
   * el escalón cero y que el reloj no apriete NUNCA. Se vio en las pruebas, con
   * la segunda curva durando exactamente lo mismo que la primera después de un
   * acierto.
   */
  paso: number;
}

interface Partida {
  estado: EstadoDeCarrera;
  puntuacion: number;
  /** Apunta una curva tomada y devuelve qué pasó, ya contado. */
  anotar: (curva: CurvaDeDerrape, tomada: string, ventanaMs: number) => Resultado;
  /** Cierra la partida cuando el servidor tenga ya todas las curvas. */
  terminar: () => void;
}

function usePartida(
  ronda: RondaDeDerrape,
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>,
  onFin: (marcador: Marcador) => void,
): Partida {
  const [estado, despachar] = useReducer(reducir, {
    aciertos: 0,
    fallos: 0,
    racha: 0,
    rachaMaxima: 0,
    paso: 0,
    sectores: [],
  });

  const espejo = useRef(estado);

  /*
    Los avisos van EN COLA y de uno en uno, no en paralelo.

    El servidor calcula la racha máxima en el orden en que le llegan las
    respuestas, y dos avisos que se adelanten entre sí le harían contar una racha
    que no existió —o, peor, romper una que sí—. Es la misma cola que usan CAEN y
    CARRERA y por el mismo motivo.
  */
  const cola = useRef<Promise<unknown>>(Promise.resolve());

  const avisar = useCallback(
    (rondaId: string, answer: string) => {
      cola.current = cola.current
        .then(() =>
          // Un reintento y no más. Si el segundo también falla, la cuenta del
          // servidor se quedará corta, que es el lado bueno por el que fallar.
          onResponder(rondaId, answer).catch(() => onResponder(rondaId, answer)),
        )
        .catch(() => undefined);
    },
    [onResponder],
  );

  const { crono, reloj } = ronda;

  const anotar = useCallback(
    (curva: CurvaDeDerrape, tomada: string, ventanaMs: number): Resultado => {
      const acierto = tomada === curva.correcta;
      const salida: Salida = acierto
        ? 'derrape'
        : curva.opciones.includes(tomada)
          ? 'grava'
          : 'muro';

      const antes = espejo.current;
      const rachaTras = acierto ? antes.racha + 1 : 0;
      const salidaMs = milisegundosDeSalida(crono, salida, rachaTras);
      const sectorMs = ventanaMs + salidaMs;

      const accion: Anotacion = {
        acierto,
        sectorMs,
        pasosAtrasAlFallar: reloj.pasosAtrasAlFallar,
      };
      const despues = reducir(antes, accion);
      espejo.current = despues;
      despachar(accion);

      avisar(curva.id, tomada);

      return {
        acierto,
        salida,
        /*
          Lo que sube el marcador de verdad, no un número inventado.

          Se calcula como la DIFERENCIA de la fórmula del servidor entre antes y
          después, así que el «+34» que flota sobre el cartel es exactamente lo que
          va a valer esa curva en la pantalla final.
        */
        suma:
          puntosDelServidor('DERRAPE', despues.aciertos, despues.rachaMaxima) -
          puntosDelServidor('DERRAPE', antes.aciertos, antes.rachaMaxima),
        racha: despues.racha,
        bonificacionMs: acierto ? bonificacionDeDerrape(crono, rachaTras) : 0,
        salidaMs,
        sectorMs,
        paso: despues.paso,
      };
    },
    [avisar, crono, reloj.pasosAtrasAlFallar],
  );

  const cerrada = useRef(false);
  const terminar = useCallback(() => {
    if (cerrada.current) return;
    cerrada.current = true;

    const suyo = espejo.current;
    const fin: Marcador = {
      puntuacion: puntosDelServidor('DERRAPE', suyo.aciertos, suyo.rachaMaxima),
      aciertos: suyo.aciertos,
      total: suyo.aciertos + suyo.fallos,
    };

    /*
      El final espera a que el servidor tenga todas las curvas.

      Sin esta espera, el `/fin` puede adelantar a las últimas respuestas y el
      servidor cerraría la partida contando menos aciertos de los que hubo. Se vería
      una puntuación en la carrera y otra más baja en la pantalla final, que es
      exactamente lo que hace que un juego parezca trucado.
    */
    void cola.current.then(
      () => onFin(fin),
      () => onFin(fin),
    );
  }, [onFin]);

  return {
    estado,
    puntuacion: puntosDelServidor('DERRAPE', estado.aciertos, estado.rachaMaxima),
    anotar,
    terminar,
  };
}

/** Los tiempos de cada vuelta cerrada, para la hoja y para la bandera. */
function vueltasDe(sectores: readonly number[], curvasPorVuelta: number): number[] {
  const vueltas: number[] = [];
  for (let desde = 0; desde + curvasPorVuelta <= sectores.length; desde += curvasPorVuelta) {
    vueltas.push(
      sectores.slice(desde, desde + curvasPorVuelta).reduce((total, uno) => total + uno, 0),
    );
  }
  return vueltas;
}

/* ────────────────────────────  LA PUERTA DE ENTRADA  ──────────────────────────── */

export function Derrape({
  ronda,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeDerrape;
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();
  const partida = usePartida(ronda, onResponder, onFin);

  /*
    Quien pidió menos movimiento no juega a una versión capada: juega a la misma
    contrarreloj sin circuito. Mismo contenido, mismo reloj, mismo crono y el mismo
    servidor contando. Lo que no hay es nada moviéndose. Está explicado abajo, en
    `HojaDeTiempos`.
  */
  if (menosMovimiento) {
    return <HojaDeTiempos ronda={ronda} partida={partida} onSalir={onSalir} />;
  }

  return <Circuito ronda={ronda} partida={partida} onSalir={onSalir} />;
}

/* ────────────────────────────  EL CIRCUITO  ──────────────────────────── */

/** Lo que el bucle necesita saber y React no tiene por qué repintar. */
interface Mundo {
  fase: 'formacion' | 'curva' | 'salida' | 'meta';
  /** Cuándo empezó la fase de ahora, en el reloj del proceso. */
  desde: number;
  /** Lo que dura la fase de ahora. */
  dura: number;
  /** Qué curva se está corriendo. */
  indice: number;
  /** La ventana de esa curva, ya calculada al empezarla. */
  ventanaMs: number;
  /** Hacia qué rama tira el muelle: 0, 1 o el centro mientras la pista se junta. */
  objetivo: number;
  /** Dónde está el coche de verdad, de 0 (izquierda) a 1 (derecha), y su velocidad. */
  x: number;
  vx: number;
  /** Lo que lleva recorrido el asfalto, en píxeles. */
  recorrido: number;
  /** Los sectores ya cerrados, para que el crono no dependa de un render. */
  sectores: number[];
  /** En qué escalón del reloj va, contado por el propio bucle. */
  paso: number;
  /** Cómo se salió de la curva de ahora, si ya se resolvió. */
  salida: Salida | null;
}

interface Resuelta extends Resultado {
  marca: number;
  curva: CurvaDeDerrape;
  tomada: string;
}

/** Lo que se puede mirar y tocar desde fuera para medir. Solo en desarrollo. */
interface MedidasDeDerrape {
  /** Los milisegundos de cada fotograma, para sacar los cuadros por segundo. */
  fotogramas: number[];
  /** Qué hay en pantalla ahora mismo, para que un piloto simulado pueda decidir. */
  estado: () => {
    fase: Mundo['fase'];
    indice: number;
    vuelta: number;
    curva: number;
    pista: string;
    opciones: string[];
    correcta: string;
    /** Lo que queda de ventana. Es lo que un piloto humano no sabe, pero medir sí. */
    restanteMs: number;
    carril: number;
    cronoMs: number;
  } | null;
  /** Gira hacia una rama, igual que una flecha del teclado. */
  girar: (rama: number) => void;
  /** Lo que hay que saber al acabar, sin tener que leer el DOM. */
  resumen: () => { aciertos: number; fallos: number; cronoMs: number; vueltas: number[] };
  terminado: () => boolean;
}

declare global {
  interface Window {
    __derrape?: MedidasDeDerrape;
  }
}

function Circuito({
  ronda,
  partida,
  onSalir,
}: {
  ronda: RondaDeDerrape;
  partida: Partida;
  onSalir: () => void;
}) {
  const curvas = ronda.curvas;
  // Sueltos de la partida: los dos son estables, y meterla entera en las
  // dependencias del bucle lo rearmaría con cada punto que se marca.
  const { anotar, terminar } = partida;

  const pista = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(0);

  /*
    Los nodos que mueve el bucle. Son siete y ni uno más.

    Todo lo que se mueve en esta pantalla se escribe aquí dentro, a mano, sin pasar
    por el estado de React. Lo que React pinta es lo que CAMBIA de verdad —qué
    palabra hay en cada cartel, de qué color está la rama, cuántos puntos llevas— y
    eso pasa veinticuatro veces en toda la carrera.
  */
  const asfalto = useRef<HTMLDivElement>(null);
  const carteles = useRef<HTMLDivElement>(null);
  const coche = useRef<HTMLDivElement>(null);
  const carroceria = useRef<HTMLDivElement>(null);
  const cronoNodo = useRef<HTMLSpanElement>(null);
  const diferenciaNodo = useRef<HTMLSpanElement>(null);
  const marcador = useRef<SVGCircleElement>(null);

  const [viva, setViva] = useState<{ curva: CurvaDeDerrape; marca: number } | null>(null);
  const [resuelta, setResuelta] = useState<Resuelta | null>(null);
  const [carril, setCarril] = useState(-1);
  const [acabando, setAcabando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [fin, setFin] = useState<{ vueltas: number[]; totalMs: number } | null>(null);

  const mundo = useRef<Mundo>({
    fase: 'formacion',
    desde: 0,
    dura: FORMACION,
    indice: 0,
    ventanaMs: 0,
    objetivo: 0.5,
    x: 0.5,
    vx: 0,
    recorrido: 0,
    sectores: [],
    paso: 0,
    salida: null,
  });

  /*
    El alto de la pista, medido y no supuesto.

    Los recorridos van en píxeles porque un `translateY` en porcentaje se calcula
    sobre el propio elemento y no sobre el padre. Se mide al montar y se vuelve a
    medir si la ventana cambia: girar el móvil a media carrera cambia de sitio el
    plano donde está el coche, y una curva tiene que tardar lo mismo en las dos
    posturas.
  */
  useLayoutEffect(() => {
    const nodo = pista.current;
    if (!nodo) return;

    const medir = () => {
      // Si la medida sale cero se juega igual, con media pantalla de recorrido.
      // Pasa en un entorno sin maquetación —las pruebas— y podría pasar en un
      // navegador que pinte tarde; quedarse esperando dejaría el circuito montado
      // y sin arrancar, que se lee como un juego roto.
      setAlto(nodo.getBoundingClientRect().height || Math.round(window.innerHeight * 0.45));
    };

    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const girar = useCallback((rama: number) => {
    const suyo = mundo.current;
    // Solo se gira mientras se va hacia la bifurcación. Después la pista se junta
    // y el coche vuelve al centro solo, que es lo que hace que cada curva sea una
    // decisión nueva y no «quedarse donde ya estabas».
    if (suyo.fase !== 'curva' || rama < 0 || rama > 1) return;
    suyo.objetivo = rama;
    setCarril(rama);
  }, []);

  /*
    Jugar sin tocar la pantalla: flechas o 1 y 2.

    Van en la ventana y no en un contenedor con foco, igual que en CAEN y en
    CARRERA: aquí las dianas se mueven y un orden de tabulación que cambia solo con
    cada curva es peor que no tener ninguno. Con las dos ramas numeradas en
    pantalla, una tecla por rama es directo y no depende de dónde esté el foco.
  */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.altKey || evento.ctrlKey || evento.metaKey) return;

      if (evento.key === 'ArrowLeft') {
        evento.preventDefault();
        girar(0);
        return;
      }
      if (evento.key === 'ArrowRight') {
        evento.preventDefault();
        girar(1);
        return;
      }
      if (evento.key === '1' || evento.key === '2') {
        evento.preventDefault();
        girar(Number(evento.key) - 1);
      }
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [girar]);

  /* ─────────  EL BUCLE  ───────── */

  useEffect(() => {
    if (alto === 0 || acabando) return;

    const suyo = mundo.current;
    let cuadro = 0;
    let anterior = performance.now();

    /*
      El reloj de la fase solo se arranca la PRIMERA vez.

      Este efecto se vuelve a montar si cambia el alto de la pista, y eso pasa de
      verdad: girar el móvil a media carrera. Poniendo `desde` a la hora de ahora
      sin mirar, la curva que estuviera corriendo volvería a empezar su ventana
      desde cero y regalaría varios segundos. Es un fallo que solo se ve girando
      el teléfono en mitad de una curva, o sea casi nunca y siempre a destiempo.
    */
    if (suyo.desde === 0) suyo.desde = anterior;

    /** Arranca la curva que toca, o baja la bandera si ya no quedan. */
    const entrarEnCurva = (indice: number, ahora: number) => {
      const curva = curvas[indice];
      if (!curva) {
        suyo.fase = 'meta';
        suyo.desde = ahora;
        const totalMs = suyo.sectores.reduce((total, uno) => total + uno, 0);
        setFin({ vueltas: vueltasDe(suyo.sectores, ronda.circuito.curvasPorVuelta), totalMs });
        setViva(null);
        setAcabando(true);
        return;
      }

      // El escalón lo lleva el propio bucle. El del estado de React no sirve:
      // este efecto se monta UNA vez por carrera, así que su cierre se quedaría
      // con el escalón cero y el reloj no apretaría nunca.
      suyo.indice = indice;
      suyo.ventanaMs = ventanaDe(curva, ronda, suyo.paso);
      suyo.fase = 'curva';
      suyo.desde = ahora;
      suyo.dura = suyo.ventanaMs;
      suyo.objetivo = 0.5;
      suyo.salida = null;

      setCarril(-1);
      setResuelta(null);
      setViva({ curva, marca: indice });
    };

    /** El coche pasa por la bifurcación: decide la rama en la que esté DE VERDAD. */
    const cruzar = (ahora: number) => {
      const curva = curvas[suyo.indice];
      if (!curva) return;

      /*
        Lo que decide es dónde está el coche, no qué tecla se pulsó.

        Es la diferencia con CARRERA, donde el carril es un número y basta con
        haberlo cambiado. Aquí un volantazo en el último instante no llega, porque
        el coche tiene inercia: si el morro está dentro del bordillo, se lo come.
        Eso no es una crueldad, es lo que hace real el cuarto de segundo que el
        servidor reserva para girar dentro del reloj.
      */
      const dentroDelBordillo = Math.abs(suyo.x - 0.5) < ANCHO_DEL_BORDILLO;
      const rama = suyo.x < 0.5 ? 0 : 1;
      const tomada = dentroDelBordillo ? NO_GIRO : (curva.opciones[rama] ?? NO_GIRO);

      const resultado = anotar(curva, tomada, suyo.ventanaMs);

      suyo.sectores.push(resultado.sectorMs);
      suyo.paso = resultado.paso;
      suyo.salida = resultado.salida;
      suyo.fase = 'salida';
      suyo.desde = ahora;
      suyo.dura = resultado.salidaMs;
      // La pista se junta: el coche vuelve al centro por su cuenta.
      suyo.objetivo = 0.5;

      setResuelta({ ...resultado, marca: suyo.indice, curva, tomada });

      if (resultado.acierto) {
        setAviso(
          `Bien: ${curva.correcta}. ${resultado.suma} puntos.` +
            (resultado.bonificacionMs > 0
              ? ` Derrape: ${(resultado.bonificacionMs / 1000).toFixed(2)} segundos menos.`
              : ''),
        );
        sonar(resultado.racha >= 2 ? 'combo' : 'acierto', { racha: resultado.racha });
      } else {
        setAviso(
          `${resultado.salida === 'muro' ? 'Te fuiste de largo' : 'Grava'}. Era ${curva.correcta}. ${curva.ensena}`,
        );
        sonar('fallo');
      }
    };

    const latido = () => {
      /*
        Sin argumento a propósito.

        `requestAnimationFrame` le pasa al latido un sello de tiempo que va en el
        reloj del DOCUMENTO, y aquí se mide todo con `performance.now()`, que va en
        el del proceso. Restar uno del otro da un número sin sentido: es el fallo
        que `Particulas.tsx` dejó documentado después de que una barra se quedara
        llena para siempre, y el que `Beat.tsx` repite en su propio bucle.
      */
      const ahora = performance.now();
      // El paso se recorta a 50 ms: una pestaña que vuelve de estar escondida no
      // puede mandar el coche al otro lado de la pista de un salto.
      const dt = Math.min((ahora - anterior) / 1000, 0.05);
      anterior = ahora;

      // Solo en desarrollo: en producción esta lista crecería cuatro mil entradas
      // por carrera sin que nadie la mire nunca.
      if (import.meta.env.DEV) fotogramas.current.push(dt * 1000);

      /* 1. La física del coche: un muelle hacia la rama y rozamiento. */
      suyo.vx += (suyo.objetivo - suyo.x) * RIGIDEZ * dt;
      suyo.vx *= Math.exp(-ROCE * dt);
      suyo.x = Math.min(Math.max(suyo.x + suyo.vx * dt, 0.02), 0.98);

      /* 2. El asfalto, que corre más o menos según lo que esté pasando. */
      const velocidad =
        suyo.fase === 'salida' && suyo.salida === 'derrape'
          ? VELOCIDAD_DERRAPE
          : suyo.fase === 'salida'
            ? VELOCIDAD_GRAVA
            : VELOCIDAD_BASE;
      suyo.recorrido = (suyo.recorrido + velocidad * dt) % SEPARACION_DE_RAYAS;

      /* 3. La fase, que es todo el reloj del juego. */
      const transcurrido = ahora - suyo.desde;
      if (suyo.fase === 'formacion' && transcurrido >= FORMACION) {
        entrarEnCurva(0, ahora);
      } else if (suyo.fase === 'curva' && transcurrido >= suyo.ventanaMs) {
        cruzar(ahora);
      } else if (suyo.fase === 'salida' && transcurrido >= suyo.dura) {
        entrarEnCurva(suyo.indice + 1, ahora);
      }

      /* 4. Lo que se escribe en la pantalla, que son siete cosas. */
      if (asfalto.current) {
        asfalto.current.style.transform = `translate3d(0, ${suyo.recorrido.toFixed(1)}px, 0)`;
      }

      if (coche.current) {
        coche.current.style.transform = `translate3d(${((suyo.x - 0.5) * 46).toFixed(2)}%, 0, 0)`;
      }
      if (carroceria.current) {
        // El ángulo ES la velocidad lateral. De ahí sale el derrape sin declararlo:
        // el coche va apuntando a donde se está yendo, no a donde mira la pista.
        const angulo = Math.max(Math.min(suyo.vx * 26, GIRO_MAXIMO), -GIRO_MAXIMO);
        carroceria.current.style.transform = `rotate(${angulo.toFixed(1)}deg)`;
      }

      if (carteles.current) {
        const avance =
          suyo.fase === 'curva'
            ? Math.min(transcurrido / Math.max(suyo.ventanaMs, 1), 1)
            : suyo.fase === 'salida'
              ? 1 + Math.min(transcurrido / Math.max(suyo.dura, 1), 1)
              : 0;
        const desplazamiento =
          avance <= 1
            ? CARTEL_DESDE + (CARTEL_HASTA - CARTEL_DESDE) * avance
            : CARTEL_HASTA + (CARTEL_FUERA - CARTEL_HASTA) * (avance - 1);
        const escala = avance <= 1 ? CARTEL_ESCALA_LEJOS + (1 - CARTEL_ESCALA_LEJOS) * avance : 1;
        carteles.current.style.transform = `translate3d(0, ${(desplazamiento * alto).toFixed(1)}px, 0) scale(${escala.toFixed(3)})`;
        carteles.current.style.opacity = suyo.fase === 'formacion' ? '0' : '1';
      }

      /*
        5. El crono.

        Se escribe DIRECTAMENTE en el nodo y no por el estado de React. Sesenta
        renders por segundo de un marcador con una mascota dentro es exactamente lo
        que no puede pasar aquí, y lo que cambia es un texto: no hace falta React
        para eso.

        Y el sector de ahora se RECORTA a su propia duración. Sin ese recorte, una
        pestaña que se queda dormida devolvería un crono inflado por segundos en los
        que nadie estaba conduciendo, y ese número no cuadraría con el del servidor,
        que solo sabe de sectores cerrados.
      */
      const cerrados = suyo.sectores.reduce((total, uno) => total + uno, 0);
      const enCurso =
        suyo.fase === 'formacion' || suyo.fase === 'meta'
          ? 0
          : Math.min(transcurrido, suyo.fase === 'curva' ? suyo.ventanaMs : suyo.dura);
      const cronoMs = cerrados + enCurso;
      if (cronoNodo.current) cronoNodo.current.textContent = comoCrono(cronoMs);

      if (diferenciaNodo.current) {
        const porVuelta = ronda.circuito.curvasPorVuelta;
        const cerradas = suyo.sectores.length;
        if (cerradas >= porVuelta && suyo.fase !== 'meta') {
          /*
            La diferencia en vivo se compara contra el MISMO punto de la vuelta 1,
            contando el sector que está corriendo ahora. Es lo que hace que el
            número se mueva mientras se conduce en vez de dar un salto al cerrar la
            curva, que es como se lee un delta en una carrera de verdad.
          */
          const enLaSegunda = cerradas - porVuelta;
          const suma = (desde: number, cuantos: number) =>
            suyo.sectores.slice(desde, desde + cuantos).reduce((t, u) => t + u, 0);
          const referencia = suma(0, Math.min(enLaSegunda + 1, porVuelta));
          const lleva = suma(porVuelta, enLaSegunda) + enCurso;
          diferenciaNodo.current.textContent = comoDiferencia(lleva - referencia);
          diferenciaNodo.current.dataset.tono = lleva - referencia <= 0 ? 'mejor' : 'peor';
        }
      }

      if (marcador.current) {
        /*
          El punto del minimapa. Es lo que hace que esto sea un CIRCUITO y no una
          recta infinita: sin él, dos vueltas al mismo trazado son una afirmación
          del texto y no algo que se vea.
        */
        const porVuelta = ronda.circuito.curvasPorVuelta;
        const dentro =
          suyo.fase === 'curva'
            ? transcurrido / Math.max(suyo.ventanaMs, 1)
            : suyo.fase === 'salida'
              ? 1
              : 0;
        const recorridoDeVuelta = ((suyo.indice % porVuelta) + Math.min(dentro, 1)) / porVuelta;
        const angulo = (recorridoDeVuelta - 0.25) * Math.PI * 2;
        marcador.current.setAttribute('cx', (50 + 38 * Math.cos(angulo)).toFixed(2));
        marcador.current.setAttribute('cy', (26 + 18 * Math.sin(angulo)).toFixed(2));
      }

      cuadro = requestAnimationFrame(latido);
    };

    cuadro = requestAnimationFrame(latido);
    return () => cancelAnimationFrame(cuadro);
  }, [alto, acabando, curvas, ronda, anotar]);

  /** La bandera a cuadros: un momento para ver los tiempos y se cierra. */
  useEffect(() => {
    if (!acabando) return;
    sonar('fin');
    const reloj = window.setTimeout(terminar, META);
    return () => window.clearTimeout(reloj);
  }, [acabando, terminar]);

  /* ─────────  LO QUE SE PUEDE MEDIR DESDE FUERA  ───────── */

  /*
    Los fotogramas se guardan en una referencia y NO dentro del objeto de medida.

    La primera versión los tenía dentro, y el objeto se rehacía cada vez que
    cambiaba el marcador: o sea que la lista se vaciaba doce veces por carrera y al
    final salía siempre vacía. Se vio midiendo, que es de las pocas cosas que solo
    se ven midiendo.
  */
  const fotogramas = useRef<number[]>([]);
  const estadoVivo = useRef(partida.estado);
  estadoVivo.current = partida.estado;

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    window.__derrape = {
      fotogramas: fotogramas.current,
      estado: () => {
        const suyo = mundo.current;
        const curva = curvas[suyo.indice];
        if (!curva || suyo.fase === 'meta') return null;
        return {
          fase: suyo.fase,
          indice: suyo.indice,
          vuelta: curva.vuelta,
          curva: curva.curva,
          pista: curva.pista,
          opciones: curva.opciones,
          correcta: curva.correcta,
          restanteMs: suyo.fase === 'curva' ? suyo.ventanaMs - (performance.now() - suyo.desde) : 0,
          carril: suyo.x,
          cronoMs: suyo.sectores.reduce((total, uno) => total + uno, 0),
        };
      },
      girar,
      resumen: () => ({
        aciertos: estadoVivo.current.aciertos,
        fallos: estadoVivo.current.fallos,
        cronoMs: mundo.current.sectores.reduce((total, uno) => total + uno, 0),
        vueltas: vueltasDe(mundo.current.sectores, ronda.circuito.curvasPorVuelta),
      }),
      terminado: () => mundo.current.fase === 'meta',
    };

    return () => {
      delete window.__derrape;
    };
    // Se monta UNA vez por carrera. El marcador se lee de `estadoVivo`, que es una
    // referencia que se refresca en cada render: meterlo en las dependencias
    // volvería a montar el objeto doce veces y perdería las medidas.
  }, [curvas, girar, ronda.circuito.curvasPorVuelta]);

  /* ─────────  LO QUE SE PINTA  ───────── */

  const { racha, paso } = partida.estado;
  const vuelta = viva?.curva.vuelta ?? (fin ? ronda.circuito.vueltas : 1);
  const bonificacion = bonificacionDeDerrape(ronda.crono, racha);
  const mostrada = resuelta?.curva ?? viva?.curva ?? null;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col px-3 py-3 sm:px-4">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
            Vuelta {vuelta} de {ronda.circuito.vueltas} · curva{' '}
            {viva?.curva.curva ?? ronda.circuito.curvasPorVuelta} de{' '}
            {ronda.circuito.curvasPorVuelta}
          </p>
          <Cadena bonificacionMs={bonificacion} racha={racha} />
        </div>
        <Contador etiqueta="Puntos" valor={partida.puntuacion} vivo />
      </CabeceraJuego>

      {/*
        EL CRONO Y LA DIFERENCIA, EN UNA BANDA PROPIA.

        Van juntos y grandes porque son el marcador de este juego. Los puntos siguen
        ahí arriba y siguen siendo lo que paga, pero lo que se mira conduciendo es
        el tiempo: es lo que convierte «he fallado dos» en «voy cinco segundos
        peor». Los dos números los escribe el bucle directamente en su nodo.
      */}
      <Tablero cronoNodo={cronoNodo} diferenciaNodo={diferenciaNodo} hayReferencia={vuelta > 1}>
        <Minimapa marcador={marcador} curvas={ronda.circuito.curvasPorVuelta} />
      </Tablero>

      {/*
        LA PISTA VIVE FUERA DEL CIRCUITO, EN UNA BANDA QUIETA.

        Es la misma decisión que toma `Carrera.tsx` con su frase, y aquí aprieta
        todavía más: leer algo que hay que entender para actuar cuesta entre 14 y 18
        caracteres por segundo, y eso ya va justo sin que el fondo se mueva debajo.
        Lo único que se mueve son los carteles; lo que hay que leer está clavado.
      */}
      <Banda curva={mostrada} resuelta={resuelta} />

      {/* Lo que acaba de pasar, para quien no ve la pantalla. */}
      <p role="status" aria-live="polite" className="sr-only">
        {aviso}
      </p>

      <div
        ref={pista}
        /*
          `overflow-hidden` no es cosmético: es lo que esconde los carteles mientras
          esperan por encima del horizonte y lo que recorta el asfalto por abajo.
        */
        className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-2xl border-2 border-stone-300 bg-stone-200 dark:border-stone-800 dark:bg-stone-900"
      >
        <Asfalto asfalto={asfalto} />

        {/* La zona de la rama que se tomó: acelerador o grava. */}
        {resuelta && <Zona resuelta={resuelta} />}

        {viva && alto > 0 && (
          <div
            ref={carteles}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 origin-top will-change-transform"
          >
            <Bifurcacion
              key={viva.marca}
              curva={viva.curva}
              carril={carril}
              resuelta={resuelta?.marca === viva.marca ? resuelta : null}
            />
          </div>
        )}

        <Coche
          coche={coche}
          carroceria={carroceria}
          plano={PLANO_DEL_COCHE}
          gesto={resuelta ? resuelta.salida : null}
          marca={resuelta?.marca ?? -1}
        />

        {/*
          Las dos zonas de toque ocupan la pista entera y los carteles van sin
          `pointer-events`. Así se toca HACIA DÓNDE se quiere ir en vez de tener que
          acertarle a un cartel que se mueve y que además es pequeño cuando todavía
          está lejos, que es justo cuando ya se sabe la respuesta.
        */}
        <ul className="absolute inset-0 grid grid-cols-2" aria-label="Ramas de la curva">
          {[0, 1].map((rama) => (
            <li key={rama} className="contents">
              <button
                type="button"
                onPointerDown={() => girar(rama)}
                disabled={acabando}
                aria-label={`Rama ${rama + 1}${viva ? `: ${viva.curva.opciones[rama] ?? ''}` : ''}`}
                className="h-full w-full focus-visible:bg-red-500/10"
              />
            </li>
          ))}
        </ul>

        {fin && <Bandera vueltas={fin.vueltas} totalMs={fin.totalMs} />}
      </div>

      {/*
        La tira de la racha ocupa su sitio SIEMPRE, con racha o sin ella. Si
        apareciera al llegar a dos seguidas, la pista —que es lo que queda en medio—
        encogería treinta píxeles y el plano del coche se movería debajo de unos
        carteles que ya vienen bajando con la distancia vieja apuntada.
      */}
      <div className="mt-1 flex h-8 shrink-0 items-center justify-center">
        <Racha racha={racha} />
        {racha === 0 && paso === 0 && (
          <p className="text-[11px] text-[var(--texto-suave)]">Flechas o 1 y 2 para elegir rama</p>
        )}
      </div>

      {resuelta && !resuelta.acierto && <Destello key={resuelta.marca} senal="fallo" />}
    </div>
  );
}

/* ────────────────────────────  LAS PIEZAS  ──────────────────────────── */

/**
 * El crono, el delta y el minimapa.
 *
 * El crono va con `tabular-nums` y ancho fijo porque cambia sesenta veces por
 * segundo: sin eso, el número baila de ancho y parece que tiembla la pantalla. Y la
 * diferencia solo aparece en la vuelta 2, cuando ya hay contra qué correr; en la
 * vuelta 1 su hueco se queda vacío en vez de poner un cero, porque un cero se
 * leería como «vas empatado» cuando lo que pasa es que todavía no hay referencia.
 */
function Tablero({
  cronoNodo,
  diferenciaNodo,
  hayReferencia,
  children,
}: {
  cronoNodo: React.RefObject<HTMLSpanElement | null>;
  diferenciaNodo: React.RefObject<HTMLSpanElement | null>;
  hayReferencia: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex shrink-0 items-center gap-2 rounded-xl border-2 border-stone-300 bg-[var(--superficie)] px-2 py-1.5 dark:border-stone-700">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
          Tiempo de vuelta
        </p>
        <p className="flex items-baseline gap-2">
          <span
            ref={cronoNodo}
            className="text-2xl font-extrabold tabular-nums leading-none"
            aria-hidden
          >
            0.000
          </span>
          {hayReferencia && (
            <span
              ref={diferenciaNodo}
              aria-hidden
              data-tono="mejor"
              className="rounded px-1 text-sm font-extrabold tabular-nums leading-none data-[tono=mejor]:text-[var(--texto-acierto)] data-[tono=peor]:text-[var(--texto-fallo)]"
            >
              {'±'}0.000
            </span>
          )}
        </p>
      </div>
      {children}
    </div>
  );
}

/**
 * El minimapa: un óvalo con las curvas y un punto que las recorre.
 *
 * Es lo que hace que esto sea un CIRCUITO y no una recta infinita con carteles.
 * Sin él, «dos vueltas al mismo trazado» sería una frase del texto y no algo que se
 * vea, y la comparación entre la vuelta 1 y la 2 no tendría dónde apoyarse.
 *
 * Es diminuto y va con `aria-hidden` a propósito: lo que dice está dicho también en
 * letras arriba —«Vuelta 2 de 2, curva 3 de 6»— y para quien no ve la pantalla un
 * óvalo con un punto es ruido.
 */
function Minimapa({
  marcador,
  curvas,
}: {
  marcador: React.RefObject<SVGCircleElement | null>;
  curvas: number;
}) {
  const puntos = useMemo(
    () =>
      Array.from({ length: curvas }, (_, i) => {
        const angulo = (i / curvas - 0.25) * Math.PI * 2;
        return { x: 50 + 38 * Math.cos(angulo), y: 26 + 18 * Math.sin(angulo) };
      }),
    [curvas],
  );

  return (
    <svg viewBox="0 0 100 52" aria-hidden className="h-10 w-20 shrink-0">
      <ellipse
        cx="50"
        cy="26"
        rx="38"
        ry="18"
        className="fill-none stroke-stone-400 dark:stroke-stone-600"
        strokeWidth="7"
      />
      {puntos.map((punto, i) => (
        <circle key={i} cx={punto.x} cy={punto.y} r="2.4" className="fill-stone-500" />
      ))}
      <circle ref={marcador} cx="50" cy="8" r="4.5" className="fill-red-600" />
    </svg>
  );
}

/**
 * La banda de la pista: la glosa en español.
 *
 * Al fallar, debajo aparece la palabra buena y la regla en una línea. Es el único
 * rato en el que este juego enseña algo, y por eso la grava dura dos segundos y
 * medio: es lo que cuesta leer eso sin correr.
 */
function Banda({ curva, resuelta }: { curva: CurvaDeDerrape | null; resuelta: Resuelta | null }) {
  const fallada = Boolean(resuelta && !resuelta.acierto);

  return (
    <div className="mt-2 flex min-h-[74px] shrink-0 flex-col justify-center rounded-xl border-2 border-stone-300 bg-[var(--superficie)] px-2 py-1.5 dark:border-stone-700">
      <p className="text-center text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
        Toma la rama que dice
      </p>
      <p className="text-center text-lg font-extrabold leading-tight sm:text-xl">
        {curva?.pista ?? ' '}
      </p>

      {fallada && (
        <p className="mt-0.5 text-center text-[11px] font-bold leading-snug text-[var(--texto-fallo)]">
          <span lang="en" className="text-[var(--texto-acierto)]">
            {resuelta!.curva.correcta}
          </span>
          {' — '}
          {resuelta!.curva.ensena}
        </p>
      )}
    </div>
  );
}

/**
 * La bifurcación: dos carteles y el bordillo del medio.
 *
 * Los tres van en el MISMO nodo que mueve el bucle, y eso no es ahorro: es lo que
 * hace que el bordillo llegue al coche exactamente cuando llegan los carteles. Con
 * el bordillo por su cuenta, un fotograma de desfase entre los dos convertiría
 * «comerse el bordillo» en algo que pasa a veces y no siempre.
 */
function Bifurcacion({
  curva,
  carril,
  resuelta,
}: {
  curva: CurvaDeDerrape;
  carril: number;
  resuelta: Resuelta | null;
}) {
  return (
    <>
      {/*
        El bordillo. Es lo que separa las dos ramas y lo que se come quien llega sin
        haber girado. Va a rayas rojas y blancas porque eso ya significa «no pases
        por aquí» sin necesidad de leer nada.
      */}
      <div
        className="absolute left-1/2 top-0 h-24 w-[10%] -translate-x-1/2 rounded-b-lg"
        style={{
          backgroundImage: 'repeating-linear-gradient(180deg, #dc2626 0 10px, #f5f5f4 10px 20px)',
        }}
      />

      {curva.opciones.map((opcion, rama) => (
        <div
          key={opcion + String(rama)}
          className="absolute top-2 w-[44%]"
          style={{ left: rama === 0 ? '5%' : '51%' }}
        >
          <Cartel
            texto={opcion}
            apuntado={carril === rama}
            estado={
              !resuelta
                ? 'abierto'
                : opcion === resuelta.curva.correcta
                  ? 'buena'
                  : opcion === resuelta.tomada
                    ? 'mala'
                    : 'abierto'
            }
            premio={resuelta?.acierto && opcion === resuelta.tomada ? resuelta.suma : null}
          />
        </div>
      ))}
    </>
  );
}

/**
 * Un cartel colgado sobre su rama.
 *
 * Lleva dos postes y una placa, y no es un botón: lo que se elige es por dónde
 * pasar, no qué pulsar. Quien toca la pantalla toca la mitad del circuito que
 * quiere, no el cartel, que por eso va sin `pointer-events`.
 */
function Cartel({
  texto,
  apuntado,
  estado,
  premio,
}: {
  texto: string;
  apuntado: boolean;
  estado: 'abierto' | 'buena' | 'mala';
  premio: number | null;
}) {
  return (
    <div className="relative">
      <div
        className={cn(
          'flex h-[62px] w-full items-center justify-center rounded-lg border-[3px] px-1 shadow-lg',
          estado === 'buena' && 'border-emerald-500 bg-emerald-100/95 dark:bg-emerald-900/90',
          estado === 'mala' && 'border-red-500 bg-red-100/95 dark:bg-red-950/90',
          estado === 'abierto' &&
            (apuntado
              ? 'border-red-500 bg-stone-50 ring-4 ring-red-400/50 dark:border-red-400 dark:bg-stone-800'
              : 'border-stone-500 bg-stone-50/95 dark:border-stone-400 dark:bg-stone-800/95'),
        )}
      >
        <span
          lang="en"
          className={cn(
            'block w-full break-words text-center font-extrabold leading-tight',
            tamanoDe(texto),
          )}
        >
          {texto}
        </span>
      </div>

      {/* Los dos postes, que es lo que lo cuelga sobre la pista. */}
      <span
        aria-hidden
        className="absolute inset-x-6 top-full block h-3 border-x-4 border-stone-500 dark:border-stone-400"
      />

      {premio !== null && (
        <span
          className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white shadow"
          style={{ animation: 'derrape-marca 900ms ease-out forwards' }}
        >
          +{premio}
        </span>
      )}
    </div>
  );
}

/**
 * Qué tamaño aguanta la palabra dentro del cartel.
 *
 * Las palabras van de `do` a `put up with`, y una talla única deja la corta ridícula
 * o la larga partida en dos renglones. Partirla no es opción: es lo que hay que leer,
 * y encima de reojo y mientras se acerca.
 *
 * Las cuatro tallas están pensadas para el PEOR momento, que es cuando el cartel
 * acaba de aparecer y está al 84 % de su tamaño. Ahí la más grande son dieciséis
 * píxeles y la más pequeña doce. Contadas sobre el contenido de hoy, noventa de las
 * noventa y seis palabras caen en las dos tallas grandes.
 */
function tamanoDe(texto: string): string {
  if (texto.length <= 5) return 'text-2xl';
  if (texto.length <= 8) return 'text-xl';
  if (texto.length <= 10) return 'text-base';
  return 'text-sm';
}

/**
 * La zona de la rama que se tomó: acelerador o grava.
 *
 * Es la mitad del juego que no es una pregunta. Elegida la rama, el coche SIGUE en
 * ella un rato: la trazada buena se pinta verde y suelta chispas, la grava se pinta
 * ocre y se ve el coche atravesado. Sin ese rato, acertar y fallar se verían igual
 * —un fogonazo y la curva siguiente— y todo lo que este juego promete del derrape no
 * existiría.
 *
 * No se mueve: es un tinte sobre la mitad de la pista. Lo que se mueve encima es el
 * coche, y de eso ya se encarga el bucle.
 */
function Zona({ resuelta }: { resuelta: Resuelta }) {
  const rama = resuelta.curva.opciones.indexOf(resuelta.tomada);
  const chispas = useMemo(() => [-18, -6, 6, 18, -12, 12], []);

  if (resuelta.salida === 'muro') {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 block w-[14%] -translate-x-1/2 bg-red-500/25"
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 block w-1/2',
        rama === 0 ? 'left-0' : 'left-1/2',
        resuelta.acierto ? 'bg-linear-to-t from-emerald-400/40 to-transparent' : 'bg-amber-700/30',
      )}
    >
      {resuelta.acierto &&
        chispas.map((desvio, i) => (
          <span
            key={i}
            className="absolute left-1/2 block size-1.5 rounded-full bg-amber-300"
            style={{
              top: `${PLANO_DEL_COCHE * 100}%`,
              ['--derrape-chispa-x' as string]: `${desvio}px`,
              animation: `derrape-chispa ${420 + i * 40}ms ease-out ${i * 55}ms forwards`,
            }}
          />
        ))}
    </span>
  );
}

/**
 * El coche, con Milo al volante.
 *
 * Va en `memo` y con la mascota dentro por una razón de rendimiento concreta, la
 * misma que documenta `Carrera.tsx`: `Mascota` monta una docena de resortes y varios
 * temporizadores propios, y el circuito se vuelve a pintar cada vez que se resuelve
 * una curva. Sin el `memo`, cada curva reiniciaría el parpadeo, la mirada y el
 * aleteo de Milo a media animación, y se ve como un tirón.
 *
 * Y Milo se usa SOLO por su API pública —`estado` y `tamano`— sin tocar nada de
 * dentro. Ahora mismo hay otra persona reescribiendo su motor de animación, así que
 * cualquier cosa que este archivo diera por supuesta de sus entrañas se rompería sin
 * avisar. Lo que se mueve aquí es la carrocería, que es de este archivo; Milo va
 * sentado encima y no se entera.
 */
const Coche = memo(function Coche({
  coche,
  carroceria,
  plano,
  gesto,
  marca,
}: {
  coche: React.RefObject<HTMLDivElement | null>;
  carroceria: React.RefObject<HTMLDivElement | null>;
  plano: number;
  gesto: Salida | null;
  marca: number;
}) {
  return (
    <div
      ref={coche}
      className="pointer-events-none absolute inset-x-0 will-change-transform"
      style={{ top: `calc(${plano * 100}% - 34px)` }}
    >
      <div ref={carroceria} className="mx-auto w-[19%] min-w-[52px] origin-center">
        <div key={marca} className="relative">
          {/*
            La carrocería vista desde arriba: el morro, los cuatro neumáticos y el
            alerón. Va en SVG y no en divs porque lo que tiene que leerse de un
            vistazo es HACIA DÓNDE apunta, y eso lo dice la forma del morro.
          */}
          {/*
            Los neumáticos cambian de color con el tema, y no es cosmético.

            Empezaron los cuatro en `stone-900`, que sobre el asfalto claro se ve
            perfectamente. En oscuro el asfalto es `stone-900` también, así que el
            coche se quedaba sin ruedas: un bulto rojo del que no se sabe hacia
            dónde apunta. Se vio en las capturas y en ningún otro sitio, porque en
            claro está bien. En oscuro van en `stone-400`, que sobre ese fondo
            tiene contraste de sobra y de paso se lee como una rueda con brillo.
          */}
          <svg viewBox="0 0 40 60" className="w-full drop-shadow-md">
            <g className="fill-stone-900 dark:fill-stone-400">
              <rect x="1" y="9" width="7" height="12" rx="2" />
              <rect x="32" y="9" width="7" height="12" rx="2" />
              <rect x="0" y="38" width="8" height="14" rx="2" />
              <rect x="32" y="38" width="8" height="14" rx="2" />
            </g>
            <path
              d="M20 1c6 0 11 6 12 14l1 30c0 8-5 14-13 14S7 53 7 45l1-30C9 7 14 1 20 1z"
              className={cn(
                gesto === 'grava' || gesto === 'muro' ? 'fill-red-800' : 'fill-red-600',
              )}
            />
            <rect
              x="5"
              y="52"
              width="30"
              height="5"
              rx="2"
              className="fill-stone-800 dark:fill-stone-400"
            />
            <circle cx="20" cy="26" r="11" className="fill-stone-950/25" />
          </svg>

          {/*
            Milo en la cabina. Va recortado en redondo y a `tamano` pequeño porque lo
            que se ve desde arriba es la cabeza, no el bicho entero.
          */}
          <span className="absolute left-1/2 top-[30%] block -translate-x-1/2 overflow-hidden rounded-full">
            <Mascota
              estado={gesto === 'derrape' ? 'celebrando' : gesto ? 'sorprendido' : 'feliz'}
              tamano={40}
            />
          </span>
        </div>
      </div>
      <span className="sr-only">Milo conduce</span>
    </div>
  );
});

/**
 * El asfalto: los bordes de la pista y las rayas del centro corriendo.
 *
 * Siete rayas y ni una más, con `aria-hidden`. No significan nada y para quien no ve
 * la pantalla serían ruido; lo que hacen es que el circuito esté vivo también en los
 * segundos en los que no hay ninguna curva, que son casi dos por curva.
 *
 * Y van TODAS dentro del mismo nodo, que es el que mueve el bucle: una sola escritura
 * de `transform` por fotograma en vez de siete. La tira mide una raya de más por
 * arriba, así que al desplazarla un hueco entero vuelve a quedar donde estaba y el
 * asfalto corre sin fin sin tener que reposicionar nada.
 */
function Asfalto({ asfalto }: { asfalto: React.RefObject<HTMLDivElement | null> }) {
  const rayas = useMemo(() => Array.from({ length: RAYAS }, (_, i) => i), []);

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Los dos arcenes, que son lo que dice dónde acaba la pista. */}
      <span className="absolute inset-y-0 left-0 block w-[4%] bg-stone-400 dark:bg-stone-700" />
      <span className="absolute inset-y-0 right-0 block w-[4%] bg-stone-400 dark:bg-stone-700" />

      <div
        ref={asfalto}
        className="absolute inset-x-0 will-change-transform"
        style={{ top: `-${SEPARACION_DE_RAYAS}px`, bottom: `-${SEPARACION_DE_RAYAS}px` }}
      >
        {rayas.map((raya) => (
          <span
            key={raya}
            className="absolute left-1/2 block h-8 w-1.5 -translate-x-1/2 rounded bg-stone-50/70 dark:bg-stone-500/50"
            style={{ top: `${raya * SEPARACION_DE_RAYAS}px` }}
          />
        ))}
      </div>
    </span>
  );
}

/**
 * La cadena de derrape.
 *
 * Dice «−0,48 s por curva» y no «×4», y esa diferencia es todo el motivo de que esta
 * pieza exista por separado en vez de dejárselo a `Racha`. `Tablero.tsx` lo dejó
 * escrito: un multiplicador suelto al lado de una puntuación promete que el acierto
 * siguiente vale el cuádruple, y aquí no lo vale —los puntos los paga el servidor con
 * su fórmula de siempre—. Lo que sí vale más es la velocidad con la que se sale de la
 * curva, así que se escribe exactamente eso, en segundos, que es la moneda de este
 * juego.
 */
function Cadena({ bonificacionMs, racha }: { bonificacionMs: number; racha: number }) {
  if (racha < 2 || bonificacionMs <= 0) {
    return (
      <p className="mt-0.5 text-[11px] leading-snug text-[var(--texto-suave)]">
        Encadena trazadas para salir más rápido
      </p>
    );
  }

  return (
    <p
      key={bonificacionMs}
      className="mt-0.5 inline-flex animate-crecer items-center gap-1 rounded-full bg-red-700 px-2 py-0.5 text-[11px] font-extrabold leading-none tabular-nums text-white"
    >
      <span aria-hidden>{'⚡'}</span> derrape {'−'}
      {(bonificacionMs / 1000).toFixed(2)} s por curva
    </p>
  );
}

/** La bandera a cuadros, con los tiempos de las dos vueltas. */
function Bandera({ vueltas, totalMs }: { vueltas: number[]; totalMs: number }) {
  const mejora = vueltas.length >= 2 ? vueltas[1]! - vueltas[0]! : null;

  return (
    <div className="absolute inset-0 grid place-items-center bg-[var(--fondo)]/90 px-4">
      <div className="text-center">
        <p className="animate-crecer text-xl font-extrabold">Bandera a cuadros</p>
        <ul className="mt-2 space-y-0.5">
          {vueltas.map((vuelta, i) => (
            <li key={i} className="tabular-nums">
              <span className="text-[var(--texto-suave)]">Vuelta {i + 1}: </span>
              <span className="font-extrabold">{comoCrono(vuelta)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-lg font-extrabold tabular-nums">Total {comoCrono(totalMs)}</p>
        {mejora !== null && (
          <p
            className={cn(
              'mt-1 text-sm font-bold tabular-nums',
              mejora <= 0 ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-fallo)]',
            )}
          >
            {mejora <= 0
              ? `${comoDiferencia(mejora)} s en la segunda vuelta`
              : `${comoDiferencia(mejora)} s en la segunda vuelta`}
          </p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────  SIN MOVIMIENTO  ──────────────────────────── */

/**
 * La misma contrarreloj, sin circuito: una hoja de tiempos.
 *
 * QUÉ SE QUITA Y QUÉ NO, QUE ES LA PARTE DIFÍCIL
 *
 * Un juego de conducción con movimiento reducido no puede tener nada acercándose ni
 * nada deslizándose, así que aquí no hay circuito, ni coche, ni asfalto corriendo.
 * Hasta ahí es lo obvio.
 *
 * Lo que NO se quita es la contrarreloj, y esa sí es una decisión. `Carrera.tsx`, con
 * movimiento reducido, se convierte en un cuestionario con cuenta atrás: conserva el
 * reloj y pierde la carrera, y para CARRERA está bien porque allí la carrera era la
 * forma y el reloj era el fondo. Aquí la contrarreloj ES el fondo: lo que este juego
 * promete es bajar tu tiempo recuperando la palabra exacta más deprisa la segunda
 * vez que te la preguntan. Quitarle el crono lo convertiría en una lista de
 * ejercicios de sinónimos, que la aplicación ya tiene.
 *
 * Así que el crono se queda entero —los mismos sectores, la misma fórmula, el mismo
 * servidor— y lo que cambia es CÓMO SE PINTA: una hoja de tiempos que se va
 * rellenando. Cada curva cerrada añade una fila con su tiempo, y las de la vuelta 2
 * traen al lado lo que se le ha ganado o perdido a la misma curva de la vuelta 1.
 * Una fila que aparece no es una animación: es información que antes no estaba.
 *
 * El crono grande solo cambia cuando se cierra un sector, o sea doce veces en toda la
 * partida, y no sesenta veces por segundo. Y la cuenta atrás de la curva de ahora
 * cambia una vez por segundo, que es exactamente lo que hace LA PARTÍCULA con su
 * barra y por el mismo motivo: un número que baja de segundo en segundo no es
 * movimiento, es información.
 *
 * Y de propina, aquí se lee MEJOR que en el circuito: no hay asfalto corriendo debajo
 * robando atención, y la ventana es la misma que calculó el servidor. O sea que la
 * versión accesible es, si acaso, un poco más fácil. Es el lado correcto por el que
 * equivocarse.
 */
function HojaDeTiempos({
  ronda,
  partida,
  onSalir,
}: {
  ronda: RondaDeDerrape;
  partida: Partida;
  onSalir: () => void;
}) {
  const curvas = ronda.curvas;
  const { anotar, terminar } = partida;

  const [indice, setIndice] = useState(0);
  const [resuelta, setResuelta] = useState<Resuelta | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState('');

  const curva = curvas[indice];
  const { racha, paso, sectores } = partida.estado;
  const seAcabo = !curva;

  const responder = useCallback(
    (tomada: string) => {
      if (!curva) return;
      const ventanaMs = ventanaDe(curva, ronda, paso);
      const resultado = anotar(curva, tomada, ventanaMs);
      setResuelta({ ...resultado, marca: indice, curva, tomada });
      setAviso(
        resultado.acierto
          ? `Bien: ${curva.correcta}. Sector ${comoCrono(resultado.sectorMs)} segundos.`
          : `Era ${curva.correcta}. ${curva.ensena}`,
      );
      sonar(resultado.acierto ? 'acierto' : 'fallo');
    },
    [anotar, curva, indice, paso, ronda],
  );

  /*
    El reloj de la curva.

    Un solo `requestAnimationFrame` lleva las dos cosas —cuánto queda y cuándo se
    acabó— para que no puedan desincronizarse. El rato se mide con
    `performance.now()` DENTRO del latido y no con el sello que trae
    `requestAnimationFrame`: no es lo mismo, el sello del fotograma va en el reloj del
    documento y `performance.now()` en el del proceso, y restar uno del otro da un
    número sin sentido. En esta casa ya se vio el fallo, con una barra que se quedaba
    llena para siempre.

    Y el estado solo cambia cuando cambia el SEGUNDO ENTERO, que es lo que hace que
    esto no sea movimiento.
  */
  useEffect(() => {
    if (!curva || resuelta || seAcabo) return;

    const total = ventanaDe(curva, ronda, paso);
    const inicio = performance.now();
    let cuadro = 0;
    let ultimo = Number.POSITIVE_INFINITY;

    const latido = () => {
      const transcurrido = performance.now() - inicio;

      if (transcurrido >= total) {
        setSegundos(0);
        responder(NO_GIRO);
        return;
      }

      const queda = Math.ceil((total - transcurrido) / 1000);
      if (queda !== ultimo) {
        ultimo = queda;
        setSegundos(queda);
      }

      cuadro = requestAnimationFrame(latido);
    };

    cuadro = requestAnimationFrame(latido);
    return () => cancelAnimationFrame(cuadro);
  }, [curva, resuelta, seAcabo, ronda, paso, responder]);

  /** La pausa que enseña. Dura exactamente lo que el crono cobra por la grava. */
  useEffect(() => {
    if (!resuelta || seAcabo) return;
    const reloj = window.setTimeout(() => {
      setResuelta(null);
      setIndice((n) => n + 1);
    }, resuelta.salidaMs);
    return () => window.clearTimeout(reloj);
  }, [resuelta, seAcabo]);

  useEffect(() => {
    if (seAcabo) terminar();
  }, [seAcabo, terminar]);

  if (!curva) return <Cerrando onSalir={onSalir} />;

  const porVuelta = ronda.circuito.curvasPorVuelta;
  const totalMs = sectores.reduce((total, uno) => total + uno, 0);
  const bonificacion = bonificacionDeDerrape(ronda.crono, racha);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-3">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
            Vuelta {curva.vuelta} de {ronda.circuito.vueltas} · curva {curva.curva} de {porVuelta}
          </p>
          <Cadena bonificacionMs={bonificacion} racha={racha} />
        </div>
        <Contador
          etiqueta="Segundos"
          valor={segundos}
          tono={segundos <= 2 && !resuelta ? 'aviso' : 'normal'}
        />
        <Contador etiqueta="Puntos" valor={partida.puntuacion} />
      </CabeceraJuego>

      <p role="status" aria-live="polite" className="sr-only">
        {aviso}
      </p>

      <p className="mt-3 text-center text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
        Tiempo de vuelta
      </p>
      <p className="text-center text-3xl font-extrabold tabular-nums leading-none">
        {comoCrono(totalMs)}
      </p>

      <div className="mt-3 shrink-0 rounded-xl border-2 border-stone-300 bg-[var(--superficie)] px-3 py-3 dark:border-stone-700">
        <p className="text-center text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
          Toma la rama que dice
        </p>
        <p className="text-center text-xl font-extrabold leading-snug">{curva.pista}</p>

        {resuelta && !resuelta.acierto && (
          <p className="mt-1.5 text-center text-xs font-bold leading-snug text-[var(--texto-fallo)]">
            <span lang="en" className="text-[var(--texto-acierto)]">
              {curva.correcta}
            </span>
            {' — '}
            {curva.ensena}
          </p>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-[var(--texto-suave)]">
        Elige la palabra exacta. Con teclado, 1 o 2.
      </p>

      <ul className="mt-2 grid gap-2" aria-label="Ramas de la curva">
        {curva.opciones.map((opcion, rama) => (
          <li key={opcion}>
            <button
              type="button"
              disabled={Boolean(resuelta)}
              onClick={() => responder(opcion)}
              lang="en"
              className={cn(
                'flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 px-3 text-center text-lg font-extrabold',
                resuelta && opcion === curva.correcta
                  ? 'border-emerald-600 bg-emerald-50 text-[var(--texto-acierto)] dark:bg-emerald-950/50'
                  : resuelta?.tomada === opcion
                    ? 'border-red-500 bg-red-50 text-[var(--texto-fallo)] dark:bg-red-950/50'
                    : 'border-stone-400 bg-[var(--superficie)] dark:border-stone-600',
              )}
            >
              {/*
                El número se ve Y se dice. El dígito pintado es el atajo de teclado, y
                para quien no ve la pantalla el nombre del botón empieza por «Rama 1»,
                que es lo que hace que la tecla 1 signifique algo también ahí.
              */}
              <span aria-hidden className="text-xs font-black text-[var(--texto-suave)]">
                {rama + 1}
              </span>
              <span className="sr-only">Rama {rama + 1}: </span>
              {opcion}
            </button>
          </li>
        ))}
      </ul>

      <Hoja sectores={sectores} curvasPorVuelta={porVuelta} />
    </div>
  );
}

/**
 * La hoja de tiempos: una fila por curva, una columna por vuelta.
 *
 * Es lo que sustituye al circuito y al minimapa, y hace su mismo trabajo sin mover
 * nada: dice por dónde vas y, sobre todo, deja ver la comparación entera de un
 * vistazo en vez de un delta que pasa. La columna de la derecha es la que importa:
 * cuánto le has ganado a tu propia vuelta 1 en la misma curva.
 */
function Hoja({
  sectores,
  curvasPorVuelta,
}: {
  sectores: readonly number[];
  curvasPorVuelta: number;
}) {
  const filas = Array.from({ length: curvasPorVuelta }, (_, i) => ({
    primera: sectores[i] ?? null,
    segunda: sectores[curvasPorVuelta + i] ?? null,
  }));

  return (
    <table className="mt-4 w-full border-collapse text-sm tabular-nums">
      <caption className="sr-only">
        Hoja de tiempos: cada curva con su tiempo en las dos vueltas
      </caption>
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
          <th scope="col" className="py-1 text-left font-normal">
            Curva
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            Vuelta 1
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            Vuelta 2
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            Dif.
          </th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => {
          const diferencia =
            fila.primera !== null && fila.segunda !== null ? fila.segunda - fila.primera : null;
          return (
            <tr key={i} className="border-t border-stone-200 dark:border-stone-800">
              <th scope="row" className="py-1 text-left font-normal text-[var(--texto-suave)]">
                {i + 1}
              </th>
              <td className="py-1 text-right">
                {fila.primera === null ? '—' : comoCrono(fila.primera)}
              </td>
              <td className="py-1 text-right">
                {fila.segunda === null ? '—' : comoCrono(fila.segunda)}
              </td>
              <td
                className={cn(
                  'py-1 text-right font-bold',
                  diferencia === null
                    ? 'text-[var(--texto-suave)]'
                    : diferencia <= 0
                      ? 'text-[var(--texto-acierto)]'
                      : 'text-[var(--texto-fallo)]',
                )}
              >
                {diferencia === null ? '—' : comoDiferencia(diferencia)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Cerrando({ onSalir }: { onSalir: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <p className="text-center text-[var(--texto-suave)]">Guardando la carrera…</p>
      <div className="mt-4">
        <Boton tono="suave" onClick={onSalir}>
          Volver a los juegos
        </Boton>
      </div>
    </div>
  );
}
