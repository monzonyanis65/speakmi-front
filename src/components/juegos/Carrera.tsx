import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'; // prettier-ignore
import { cn } from '@/lib/cn';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { Boton } from '@/components/Boton';
import { Mascota } from '@/components/Mascota';
import { CabeceraJuego, Contador, Racha } from './Tablero';
import { Destello } from './efectos';
import { puntosDelServidor } from './puntos';
import type { Marcador, PuertaDeCarrera, RespuestaCorregida, RondaDeCarrera } from './tipos';

/**
 * CARRERA, «Carrera de sintaxis»: Milo corre y hay que elegir portal.
 *
 * Milo corre solo por tres carriles. Arriba sale una frase con un hueco —«She
 * has already ___ the email»— y a lo lejos aparecen tres portales, uno por
 * carril, con las opciones. Se cruza el que toca. El bueno da impulso y sube el
 * combo; el malo frena y acerca al cazador.
 *
 *
 * HAY DOS EJES, Y LOS DOS PREGUNTAN GRAMÁTICA
 *
 * Además del carril se salta y se rueda, y eso NO es esquivar. Unas puertas
 * —las dobles— traen el arco partido en dos filas con seis formas: arriba se
 * entra saltando, abajo rodando, y encima de la frase pone qué afirma cada
 * fila. Ahí el gesto es media respuesta: el carril elige la palabra y la fila
 * elige la forma, y por eso caben contrastes que con tres opciones no cabían.
 *
 * Otras —las sencillas con reja— traen una valla o un travesaño delante de los
 * TRES arcos por igual. Eso sí es puro arcade: no dice nada de cuál es la
 * buena, es el peaje que mantiene los dos gestos en las manos para cuando
 * llegue una doble. Está dicho así de claro en `carrera.ts`.
 *
 * Y todo eso sigue sin costar ni un `requestAnimationFrame`, que es lo
 * siguiente.
 *
 *
 * NO HAY NI UN `requestAnimationFrame` EN LA PISTA
 *
 * Y esa es la decisión técnica que sostiene el juego. Todo lo que se mueve
 * —las puertas acercándose, las rayas del asfalto, el trote de Milo— son
 * animaciones de CSS sobre `transform` y `opacity`, o sea del compositor. El
 * reloj de una puerta ES su propia animación: cuándo llega lo dice su
 * `animationend`, no un contador de JavaScript.
 *
 * Lo que se gana es que el hilo principal esté libre. Con un latido por
 * fotograma habría que reescribir tres `transform` cada 16 ms y además
 * repintar el marcador de React; medido en un móvil de gama media eso es la
 * diferencia entre ir a 59 y ir a tirones, y un runner que va a tirones no es
 * un runner. Aquí React solo pinta cuando se resuelve una puerta: catorce veces
 * en ochenta y cinco segundos.
 *
 * EL SALTO TAMPOCO NECESITÓ UN BUCLE, y esa era la parte que parecía que iba a
 * obligar a meterlo. Un runner comprueba colisiones cada fotograma porque los
 * obstáculos están repartidos por el mundo; aquí solo hay UN instante en el que
 * la colisión importa —cuando la puerta llega al plano de Milo— y ese instante
 * ya lo daba el `animationend` de la propia puerta. Así que la física vive en
 * los porcentajes de `@keyframes` y la pregunta «¿estaba en el aire?» se
 * contesta con una resta, una vez por puerta. Sesenta comprobaciones por
 * segundo habrían contestado sesenta veces lo mismo.
 *
 * El precio está en `PorTurnos`, y se paga a gusto: con `prefers-reduced-motion`
 * el navegador deja todas las animaciones en 0,01 ms, así que la pista entera
 * dejaría de funcionar. Por eso quien pide menos movimiento no juega a una
 * versión capada de esto, juega a otra pantalla con el mismo juego dentro. Está
 * explicado abajo, en `PorTurnos`.
 *
 *
 * EL TIEMPO LO CALCULA EL SERVIDOR Y AQUÍ NO SE INVENTA NADA
 *
 * Cada puerta llega con sus `lecturaMs` y sus `portalesMs`, y la ronda con la
 * escalera de `escalones[racha]`. La ventana es la suma de los tres, y solo el
 * último se acorta al encadenar. Es la regla que este juego no puede romper:
 * hay que leer una frase Y tres opciones Y encima el suelo se mueve, así que
 * apretar la lectura no lo haría más difícil, lo haría imposible. El porqué de
 * cada número está en `back/src/modules/games/carrera.ts`.
 *
 *
 * LA PUNTUACIÓN LA CUENTA EL SERVIDOR, Y EL COMBO NO LA TOCA
 *
 * Lo que sale de aquí por cada puerta son dos identificadores: cuál era y el
 * texto del portal por el que pasó Milo. El servidor los corrige contra la
 * puerta que él mismo sorteó y lleva la cuenta. Lo que se ve subir en pantalla
 * es la misma fórmula de `puntos.ts`.
 *
 * Y el «×2 / ×4 / ×8» del combo multiplica el IMPULSO —la distancia que se le
 * saca al cazador— y no los puntos, y lo dice con esas palabras en pantalla. Es
 * a propósito: en esta aplicación ya hubo un juego que enseñaba un multiplicador
 * que el servidor no pagaba, y `Tablero.tsx` dejó escrito por qué la racha no
 * puede poner «×3» al lado de una puntuación que no multiplica por tres. Aquí
 * el ×8 es verdad sobre lo que dice que multiplica: a nueve seguidas, cruzar
 * bien vale 48 de ventaja en vez de 6, y se ve la barra llenarse de un golpe.
 */

/**
 * El respiro antes de la primera puerta: 1,6 segundos.
 *
 * Milo ya está corriendo y el asfalto ya se mueve, pero todavía no hay nada que
 * leer. Sin este respiro, la primera puerta aparece encima de una pantalla que
 * no se ha entendido y se pierde siempre, y perder por no haber podido mirar
 * todavía es la peor forma posible de empezar un juego. Es el mismo respiro que
 * se le puso a CAEN, y por lo mismo.
 */
const PREPARACION = 1600;

/** Lo que se queda una puerta resuelta a la vista antes de lanzar la siguiente. */
const PAUSA = { acierto: 560, fallo: 1700 } as const;

/**
 * Por qué el fallo dura tres veces más.
 *
 * Porque es el único rato en el que este juego enseña algo. Al acertar no hay
 * nada que leer —se acertó— y alargarlo solo corta el ritmo. Al fallar aparece
 * la frase entera con su palabra buena y la regla en una línea, y 1,7 s es lo
 * que cuesta leer eso sin correr. Si la carrera siguiera al mismo ritmo, fallar
 * sería solo un castigo mudo.
 */

/** Lo que dura el final antes de cerrar la partida. */
const FINAL = 1500;

/** Los tres carriles. El del medio es donde arranca Milo. */
const CARRILES = [0, 1, 2] as const;
const CARRIL_INICIAL = 1;

/** Lo que se manda cuando la puerta se cruzó sin portal debajo. */
const NO_CRUZO = 'nada';

/** Y lo que se manda cuando Milo se estrelló contra la reja o el travesaño. */
const CHOCO = 'choque';

/* ----------------------------------- */
/* El eje vertical: saltar y rodar.    */
/* ----------------------------------- */

/**
 * LOS DOS GESTOS, Y POR QUÉ SON UN RELOJ Y NO UN BOOLEANO
 *
 * Saltar no es un estado que se enciende y se apaga: es un arco que dura, y lo
 * que decide si Milo pasó la valla es DÓNDE estaba en el instante exacto en el
 * que la puerta llegó a su plano. Así que lo que se guarda no es «está
 * saltando» sino «empezó a saltar en el milisegundo tal», y la pregunta se
 * contesta restando.
 *
 * Eso es también lo que permite que aquí siga sin haber ni un
 * `requestAnimationFrame`. No hace falta mirar cada fotograma dónde está Milo:
 * hace falta mirarlo UNA VEZ, cuando la puerta llega, y ese instante lo da el
 * `animationend` de la propia puerta igual que antes. La física vive en los
 * porcentajes de `@keyframes` y la decisión en una resta.
 *
 * Las ventanas son las que dibujan esas animaciones, medidas sobre ellas y no
 * inventadas aquí: si se tocan los porcentajes de `index.css` hay que tocar
 * estos números, y por eso están juntos y comentados en los dos sitios.
 */
const SALTO = { dura: 640, desde: 60, hasta: 580 } as const;
const RODADA = { dura: 760, desde: 40, hasta: 680 } as const;

/** Lo que dura el tropiezo contra la reja, que es lo único que no se puede cancelar. */
const TROPIEZO = 520;

/**
 * Cuánto tiene que irse el dedo para que sea un gesto y no un toque: 24 px.
 *
 * Por debajo, cualquier toque con el pulgar torcido saltaría sin querer, y en
 * una puerta doble saltar sin querer es contestar sin querer. Por encima de 30
 * px el deslizamiento se siente pesado en una pista que a 320 px tiene poco
 * más de 300 de alto. Veinticuatro es también, y no por casualidad, la mitad
 * del objetivo táctil mínimo de 48 px: por debajo de eso el movimiento cabe
 * dentro de lo que se mueve un dedo sin querer al apoyarlo.
 */
const DESLIZAR = 24;

interface Gesto {
  tipo: 'salto' | 'rodada';
  /** El `performance.now()` en el que empezó. Todo lo demás se calcula restando. */
  inicio: number;
}

/** Si en este instante Milo está por encima de una valla baja. */
function enElAire(gesto: Gesto | null, ahora: number): boolean {
  if (gesto?.tipo !== 'salto') return false;
  const va = ahora - gesto.inicio;
  return va >= SALTO.desde && va <= SALTO.hasta;
}

/** Y si en este instante cabe por debajo de un travesaño alto. */
function pegadoAlSuelo(gesto: Gesto | null, ahora: number): boolean {
  if (gesto?.tipo !== 'rodada') return false;
  const va = ahora - gesto.inicio;
  return va >= RODADA.desde && va <= RODADA.hasta;
}

/** Si el gesto ya terminó y Milo volvió a correr de pie. */
function terminado(gesto: Gesto | null, ahora: number): boolean {
  if (!gesto) return true;
  return ahora - gesto.inicio >= (gesto.tipo === 'salto' ? SALTO.dura : RODADA.dura);
}

/**
 * Por qué fila se cruza una puerta, o si Milo se estrelló.
 *
 * Es la función que convierte el eje nuevo en una respuesta, y está aparte y
 * pura porque es lo único de todo esto que se puede probar sin navegador.
 *
 *   - PUERTA DOBLE: no hay forma de cruzarla corriendo. Saltando se entra por
 *     la fila de arriba y rodando por la de abajo; de pie se choca con el
 *     travesaño. Aquí el gesto ES media respuesta: `ejes` dice qué afirma cada
 *     fila, así que saltar es decir «esto va en pasado» y equivocarse de fila
 *     es equivocarse de gramática, no de dedos.
 *   - PUERTA CON REJA: la reja es igual en los tres arcos, así que el gesto no
 *     dice nada sobre cuál es la buena: es un peaje. `valla` se salta y `barra`
 *     se rueda; hacer el otro gesto, o ninguno, es chocar.
 *   - PUERTA DESPEJADA: se cruza como se quiera. Saltar por gusto no penaliza,
 *     que es lo que hace que el gesto se pueda practicar sin miedo.
 */
function cruzarPor(
  puerta: PuertaDeCarrera,
  carril: number,
  gesto: Gesto | null,
  ahora: number,
): string {
  const arriba = enElAire(gesto, ahora);
  const abajo = pegadoAlSuelo(gesto, ahora);

  if (puerta.altas) {
    if (arriba) return puerta.altas[carril] ?? NO_CRUZO;
    if (abajo) return puerta.opciones[carril] ?? NO_CRUZO;
    return CHOCO;
  }

  if (puerta.estorbo === 'valla' && !arriba) return CHOCO;
  if (puerta.estorbo === 'barra' && !abajo) return CHOCO;

  return puerta.opciones[carril] ?? NO_CRUZO;
}

/**
 * El ritmo de las rayas del asfalto y del trote, del más lento al más rápido.
 *
 * LOS 300 MS SON UN TOPE, Y ES LO IMPORTANTE DE ESTOS DOS NÚMEROS.
 *
 * La velocidad sube con la racha —es lo que hace que ir bien se SIENTA más
 * rápido— pero deja de subir en el acierto diez, que es donde el reloj de las
 * puertas toca su suelo. No hay un modo en el que la pista siga acelerando
 * sola: se acelera porque se está acertando, y cuando la escalera se queda sin
 * escalones, la pista también.
 *
 * El tope está donde está porque por debajo de 300 ms las rayas dejan de leerse
 * como rayas: a 60 fotogramas, una raya que cruza la pista en menos de un
 * tercio de segundo recorre 16 px por fotograma y se ve a trozos. Y la misma
 * duración lleva el trote de Milo, así que bajar de ahí lo convierte en una
 * vibración. Es el mismo motivo por el que un runner de verdad topa su
 * velocidad: no por piedad, porque por encima de cierto punto el jugador ya no
 * ve lo que tiene que esquivar.
 */
const RITMO_LENTO = 620;
const RITMO_RAPIDO = 300;

export function Carrera({
  ronda,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeCarrera;
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();
  const partida = usePartida(ronda, onResponder, onFin);

  /*
    Quien pidió menos movimiento no juega a una versión capada: juega a la misma
    carrera sin pista. Mismo contenido, mismo reloj, mismo cazador y el mismo
    servidor contando. Lo que no hay es nada moviéndose.
  */
  if (menosMovimiento) {
    return <PorTurnos ronda={ronda} partida={partida} onSalir={onSalir} />;
  }

  return <Pista ronda={ronda} partida={partida} onSalir={onSalir} />;
}

/* ------------------------------------------------------------------ */
/* El marcador, que es lo único que comparten las dos formas de jugar. */
/* ------------------------------------------------------------------ */

interface EstadoDeCarrera {
  aciertos: number;
  fallos: number;
  racha: number;
  rachaMaxima: number;
  /** Lo que le saca Milo al cazador, de 0 al máximo que diga el servidor. */
  ventaja: number;
  /** En qué escalón del reloj va la partida. */
  paso: number;
}

interface Anotacion {
  acierto: boolean;
  /** Los números del cazador, que los manda el servidor con la ronda. */
  cazador: RondaDeCarrera['cazador'];
  pasosAtrasAlFallar: number;
}

/** Por cuánto va el combo con esta racha. */
function multiplicadorDe(
  racha: number,
  tramos: RondaDeCarrera['cazador']['tramosDeCombo'],
): number {
  let multiplicador = 1;
  for (const tramo of tramos) {
    if (racha >= tramo.desde) multiplicador = tramo.multiplicador;
  }
  return multiplicador;
}

/**
 * El marcador entero en una función pura.
 *
 * Pura porque hace falta poder calcularlo DOS VECES: una para el estado de
 * React y otra, en el mismo instante, para saber si esa puerta fue la que dejó
 * al cazador encima o con qué racha suena el acierto. El estado de React
 * todavía no ha cambiado cuando hay que pintar el golpe.
 */
function reducir(estado: EstadoDeCarrera, accion: Anotacion): EstadoDeCarrera {
  const { cazador } = accion;

  if (accion.acierto) {
    const racha = estado.racha + 1;
    const impulso = cazador.impulsoPorAcierto * multiplicadorDe(racha, cazador.tramosDeCombo);

    return {
      aciertos: estado.aciertos + 1,
      fallos: estado.fallos,
      racha,
      rachaMaxima: Math.max(estado.rachaMaxima, racha),
      ventaja: Math.min(estado.ventaja + impulso, cazador.ventajaMaxima),
      paso: estado.paso + 1,
    };
  }

  return {
    aciertos: estado.aciertos,
    fallos: estado.fallos + 1,
    racha: 0,
    rachaMaxima: estado.rachaMaxima,
    ventaja: Math.max(estado.ventaja - cazador.frenazoPorFallo, 0),
    // La escalera cede al fallar, igual que en FALSOS_AMIGOS y PARTICULAS: es lo
    // que mantiene a cualquiera cerca de su 85 % de acierto, juegue como juegue.
    paso: Math.max(estado.paso - accion.pasosAtrasAlFallar, 0),
  };
}

interface Resultado {
  acierto: boolean;
  /** Lo que sube el marcador con esta puerta. Es el número que flota. */
  suma: number;
  racha: number;
  multiplicador: number;
  ventaja: number;
  paso: number;
  /** El cazador le echó la zarpa: se acabó. */
  cazado: boolean;
}

interface Partida {
  estado: EstadoDeCarrera;
  puntuacion: number;
  /** Apunta una puerta cruzada y devuelve qué pasó, ya contado. */
  anotar: (puerta: PuertaDeCarrera, cruzado: string) => Resultado;
  /** Cierra la partida cuando el servidor tenga ya todas las puertas. */
  terminar: () => void;
}

function usePartida(
  ronda: RondaDeCarrera,
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>,
  onFin: (marcador: Marcador) => void,
): Partida {
  const [estado, despachar] = useReducer(reducir, {
    aciertos: 0,
    fallos: 0,
    racha: 0,
    rachaMaxima: 0,
    ventaja: ronda.cazador.ventajaInicial,
    paso: 0,
  });

  const espejo = useRef(estado);

  /*
    Los avisos van EN COLA y de uno en uno, no en paralelo.

    El servidor calcula la racha máxima en el orden en que le llegan las
    respuestas, y dos avisos que se adelanten entre sí le harían contar una
    racha que no existió —o, peor, romper una que sí—. Es la misma cola que usa
    CAEN y por el mismo motivo.
  */
  const cola = useRef<Promise<unknown>>(Promise.resolve());

  const avisar = useCallback(
    (rondaId: string, answer: string) => {
      cola.current = cola.current
        .then(() =>
          // Un reintento y no más. Si el segundo también falla, la cuenta del
          // servidor se quedará corta, que es el lado bueno por el que fallar:
          // nunca de más.
          onResponder(rondaId, answer).catch(() => onResponder(rondaId, answer)),
        )
        .catch(() => undefined);
    },
    [onResponder],
  );

  const { cazador, reloj } = ronda;

  const anotar = useCallback(
    (puerta: PuertaDeCarrera, cruzado: string): Resultado => {
      const acierto = cruzado === puerta.correcta;
      const accion: Anotacion = {
        acierto,
        cazador,
        pasosAtrasAlFallar: reloj.pasosAtrasAlFallar,
      };

      const antes = espejo.current;
      const despues = reducir(antes, accion);
      espejo.current = despues;
      despachar(accion);

      avisar(puerta.id, cruzado);

      return {
        acierto,
        /*
          Lo que sube el marcador de verdad, no un número inventado.

          Se calcula como la DIFERENCIA de la fórmula del servidor entre antes y
          después, así que el «+34» que flota sobre el portal es exactamente lo
          que va a valer esa puerta en la pantalla final. Es la única forma de
          enseñar un número en vivo sin prometer nada.
        */
        suma:
          puntosDelServidor('CARRERA', despues.aciertos, despues.rachaMaxima) -
          puntosDelServidor('CARRERA', antes.aciertos, antes.rachaMaxima),
        racha: despues.racha,
        multiplicador: multiplicadorDe(despues.racha, cazador.tramosDeCombo),
        ventaja: despues.ventaja,
        paso: despues.paso,
        cazado: despues.ventaja === 0,
      };
    },
    [avisar, cazador, reloj.pasosAtrasAlFallar],
  );

  const cerrada = useRef(false);
  const terminar = useCallback(() => {
    if (cerrada.current) return;
    cerrada.current = true;

    const suyo = espejo.current;
    const fin: Marcador = {
      puntuacion: puntosDelServidor('CARRERA', suyo.aciertos, suyo.rachaMaxima),
      aciertos: suyo.aciertos,
      total: suyo.aciertos + suyo.fallos,
    };

    /*
      El final espera a que el servidor tenga todas las puertas.

      Sin esta espera, el `/fin` puede adelantar a las últimas respuestas y el
      servidor cerraría la partida contando menos aciertos de los que hubo. Se
      vería una puntuación en la carrera y otra más baja en la pantalla final,
      que es exactamente lo que hace que un juego parezca trucado.
    */
    void cola.current.then(
      () => onFin(fin),
      () => onFin(fin),
    );
  }, [onFin]);

  return {
    estado,
    puntuacion: puntosDelServidor('CARRERA', estado.aciertos, estado.rachaMaxima),
    anotar,
    terminar,
  };
}

/**
 * La ventana de esta puerta: leerla, mirarla, decidirla y hacer el gesto.
 *
 * Los tres sumandos que vienen en la puerta —lectura, portales y gesto— los
 * calculó el servidor y aquí no se tocan. Solo el escalón del reflejo depende
 * de cómo vaya la partida, y es el único que se aprieta.
 */
function ventanaDe(puerta: PuertaDeCarrera, ronda: RondaDeCarrera, paso: number): number {
  const escalones = ronda.reloj.escalones;
  const reflejo = escalones[Math.min(Math.max(paso, 0), escalones.length - 1)] ?? escalones[0] ?? 0;
  return puerta.lecturaMs + puerta.portalesMs + reflejo + (puerta.gestoMs ?? 0);
}

/* ----------------------------------- */
/* El arnés de medir, que solo existe en desarrollo. */
/* ----------------------------------- */

/**
 * Lo que la pista publica para poder medirse, igual que HORDA y DERRAPE.
 *
 * NO ES UNA API: es un mirador de desarrollo, y `import.meta.env.DEV` lo deja
 * fuera de lo que se sirve. Existe porque este juego solo se puede calibrar
 * JUGÁNDOLO, y un jugador simulado manejado desde fuera de la página —con
 * Playwright, mandando un gesto por viaje— le suma medio segundo a cada toque
 * y mide otra cosa: en un juego donde la ventana del salto son 520 ms, ese
 * medio segundo ES el juego.
 *
 * Lo importante que publica no es el marcador, que ya se ve en pantalla, sino
 * el MOTIVO de cada fallo. Este juego tiene ahora dos formas de perder una
 * puerta que no se parecen en nada —no saberse la gramática y no llegar con el
 * gesto— y lo que hay que vigilar es que el segundo sea marginal. La diana es
 * el 85 % de acierto de Wilson y compañía, y el 15 % restante tiene que
 * ponerlo el inglés.
 */
interface MedidasDeLaCarrera {
  /** La puerta en el aire con su respuesta dentro, para el jugador simulado. */
  puerta: (PuertaDeCarrera & { desde: number; ventanaMs: number }) | null;
  /** Lo que se fue resolviendo, con por qué se falló cada una. */
  puertas: Array<{
    id: string;
    correcta: string;
    cruzado: string;
    acierto: boolean;
    /** Lo que sobró de la ventana. Negativo no existe: la puerta llega y ya. */
    holguraMs: number;
    motivo: 'acierto' | 'gramatica' | 'gesto' | 'tiempo';
  }>;
  /** Si la carrera ya se cerró, y con qué. */
  fin: { ventaja: number; aciertos: number; fallos: number } | null;
}

declare global {
  interface Window {
    __carrera?: MedidasDeLaCarrera;
  }
}

/* ----------------------------------- */
/* La pista, que es la versión que corre. */
/* ----------------------------------- */

interface EnPista {
  puerta: PuertaDeCarrera;
  ventanaMs: number;
  /** Sube con cada puerta lanzada: es lo que reinicia las animaciones. */
  marca: number;
}

interface Resuelta extends Resultado {
  marca: number;
  puerta: PuertaDeCarrera;
  cruzado: string;
}

function Pista({
  ronda,
  partida,
  onSalir,
}: {
  ronda: RondaDeCarrera;
  partida: Partida;
  onSalir: () => void;
}) {
  const puertas = ronda.puertas;
  // Sueltos de la partida: los dos son estables, y meterla entera en las
  // dependencias de un efecto lo rearma con cada punto que se marca.
  const { anotar, terminar } = partida;

  const campo = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(0);

  const [indice, setIndice] = useState(0);
  const [enPista, setEnPista] = useState<EnPista | null>(null);
  const [resuelta, setResuelta] = useState<Resuelta | null>(null);
  const [carril, setCarril] = useState<number>(CARRIL_INICIAL);
  const [acabando, setAcabando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [golpe, setGolpe] = useState<{ id: number; senal: 'combo' | 'fallo' } | null>(null);

  /*
    El carril también vive en una referencia, y no es duplicar por duplicar.

    Cuando la puerta llega, quien decide es el carril EN ESE INSTANTE, y el
    `animationend` que lo pregunta se registró en un render anterior. Con el
    valor del estado se leería el carril que había cuando se lanzó la puerta,
    que es exactamente el que se acaba de cambiar.
  */
  const carrilVivo = useRef(CARRIL_INICIAL);
  const relojes = useRef<number[]>([]);

  /*
    El gesto, en referencia por el mismo motivo que el carril y uno más.

    El mismo: quien decide es el gesto EN EL INSTANTE en el que llega la puerta,
    y el `animationend` que lo pregunta se registró en un render anterior.

    Y el propio: aquí no basta con saber cuál fue el último gesto, hace falta
    saber CUÁNDO empezó, porque un salto que terminó hace 200 ms no vale y uno
    que empezó hace 200 ms sí. Por eso lo que se guarda es el sello de tiempo y
    no un booleano, y por eso no hay ningún latido mirando si Milo sigue en el
    aire: se mira una vez, al llegar la puerta.

    El estado de React que lo acompaña existe solo para pintar la animación, y
    cambia dos o tres veces por puerta —no sesenta por segundo—.
  */
  const gestoVivo = useRef<Gesto | null>(null);
  const [gesto, setGesto] = useState<Gesto | null>(null);
  const [tropiezo, setTropiezo] = useState(0);
  const [acecho, setAcecho] = useState(0);

  /** Dónde empezó el dedo, para saber si lo que viene es un deslizamiento. */
  const desdeY = useRef<number | null>(null);

  /** Cuándo salió la puerta que está en el aire. Solo lo usa el arnés de medir. */
  const salioEn = useRef(0);

  /*
    El mirador de desarrollo se monta y se desmonta con la pista.

    Se BORRA al salir a propósito: si sobreviviera al desmontaje, la carrera
    siguiente empezaría con las puertas de la anterior dentro y cualquier
    medida saldría con el doble de puertas de las que hubo. Es lo mismo que
    hacen HORDA y DERRAPE con los suyos.
  */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__carrera = { puerta: null, puertas: [], fin: null };
    return () => {
      delete window.__carrera;
    };
  }, []);

  /*
    La puerta en el aire y la última resuelta, también en referencias.

    No es duplicar el estado por gusto: `cruzar` lo llama un `animationend`, o
    sea fuera del ciclo de React, y lo que necesita saber —qué puerta hay y si
    ya se resolvió— tiene que estar disponible EN ESE INSTANTE. Con el estado se
    leería el del render en el que se registró el oyente.

    Y hacerlo dentro de un `setEnPista(viva => …)` no vale, aunque parezca la
    forma corta: en desarrollo React llama DOS VECES a esa función para cazar
    efectos escondidos, y aquí dentro hay tres —apuntar la puerta, sonar y
    encolar el aviso al servidor—. Se vio jugando: la carrera mandaba quince
    respuestas para catorce puertas.
  */
  const puertaViva = useRef<EnPista | null>(null);
  const resueltaMarca = useRef(-1);

  /*
    El alto de la pista, medido y no supuesto.

    Los recorridos van en píxeles porque los porcentajes de `translateY` se
    calculan sobre el propio elemento y no sobre el padre. Se mide al montar y
    se vuelve a medir si la ventana cambia: girar el móvil a media carrera
    cambia de sitio el plano donde está Milo.
  */
  useLayoutEffect(() => {
    const nodo = campo.current;
    if (!nodo) return;

    const medir = () => {
      // Si la medida sale cero se juega igual, con media pantalla de recorrido.
      // Pasa en un entorno sin maquetación —las pruebas— y podría pasar en un
      // navegador que pinte tarde; quedarse esperando dejaría la pista montada
      // y sin lanzar nada, que se lee como un juego roto.
      setAlto(nodo.getBoundingClientRect().height || Math.round(window.innerHeight * 0.45));
    };

    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const acabar = useCallback(() => {
    setAcabando(true);
    // Se vacía la MISMA lista en vez de cambiarla por otra: la limpieza del
    // desmontaje se quedó con esta referencia.
    relojes.current.forEach((reloj) => window.clearTimeout(reloj));
    relojes.current.length = 0;
  }, []);

  /** Lanza la puerta que toca, tras el respiro que corresponda. */
  useEffect(() => {
    if (acabando || alto === 0) return;

    const puerta = puertas[indice];
    if (!puerta) {
      acabar();
      return;
    }

    const espera = indice === 0 ? PREPARACION : 0;
    const reloj = window.setTimeout(() => {
      const viva: EnPista = {
        puerta,
        ventanaMs: ventanaDe(puerta, ronda, partida.estado.paso),
        marca: indice,
      };
      puertaViva.current = viva;
      salioEn.current = performance.now();
      if (import.meta.env.DEV && window.__carrera) {
        window.__carrera.puerta = {
          ...puerta,
          desde: salioEn.current,
          ventanaMs: viva.ventanaMs,
        };
      }
      setResuelta(null);
      setEnPista(viva);
    }, espera);

    relojes.current.push(reloj);
    return () => window.clearTimeout(reloj);
    // `partida.estado.paso` se lee al lanzar y no debe rearmar esto: cambia con
    // la misma puerta que acaba de resolverse, y rearmarlo relanzaría la que
    // viene con el reloj a medias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, acabando, alto, puertas, acabar]);

  /** Milo cruza la puerta: decide el carril en el que esté EN ESE INSTANTE. */
  const cruzar = useCallback(() => {
    const viva = puertaViva.current;
    if (!viva || resueltaMarca.current === viva.marca) return;
    resueltaMarca.current = viva.marca;

    const ahora = performance.now();
    const cruzado = cruzarPor(viva.puerta, carrilVivo.current, gestoVivo.current, ahora);
    const resultado = anotar(viva.puerta, cruzado);

    if (import.meta.env.DEV && window.__carrera) {
      window.__carrera.puerta = null;
      window.__carrera.puertas.push({
        id: viva.puerta.id,
        correcta: viva.puerta.correcta,
        cruzado,
        acierto: resultado.acierto,
        holguraMs: Math.round(viva.ventanaMs - (ahora - salioEn.current)),
        motivo: resultado.acierto
          ? 'acierto'
          : // Los tres fallos posibles, separados porque no significan lo mismo:
            // chocar es saberla y no haber saltado, no cruzar es no haber
            // llegado, y el resto es gramática. Solo el último es el que este
            // juego quiere cobrar.
            cruzado === CHOCO
            ? 'gesto'
            : cruzado === NO_CRUZO
              ? 'tiempo'
              : 'gramatica',
      });
    }

    setResuelta({ ...resultado, marca: viva.marca, puerta: viva.puerta, cruzado });

    /*
      Chocar se pinta como lo que es: un tropiezo, no una respuesta mala.

      El golpe de Milo es distinto —se va de bruces en vez de clavar los
      frenos— y la sombra pega un zarpazo. Cuesta lo mismo que cualquier otro
      fallo, que es lo que impide que el juego se acabe jugando sin gesto, pero
      se LEE distinto, y eso importa porque el segundo y medio siguiente es el
      único rato en el que este juego enseña algo: a quien chocó sabiendo la
      gramática, explicársela otra vez no le sirve de nada.
    */
    if (cruzado === CHOCO) setTropiezo(viva.marca + 1);

    if (resultado.acierto) {
      setAviso(
        `Bien: ${viva.puerta.correcta}. ${resultado.suma} puntos.` +
          (resultado.multiplicador > 1 ? ` Impulso por ${resultado.multiplicador}.` : ''),
      );
      sonar(resultado.racha >= 2 ? 'combo' : 'acierto', { racha: resultado.racha });
      if (resultado.multiplicador > 1 && resultado.racha % 3 === 0) {
        setGolpe({ id: viva.marca, senal: 'combo' });
      }
    } else {
      setAviso(
        cruzado === CHOCO
          ? `Chocaste. Era ${viva.puerta.correcta}. ${viva.puerta.ensena}`
          : `Era ${viva.puerta.correcta}. ${viva.puerta.ensena}`,
      );
      sonar('fallo');
      setGolpe({ id: viva.marca, senal: 'fallo' });
      setAcecho(viva.marca + 1);
    }

    if (resultado.cazado) {
      acabar();
      return;
    }

    const reloj = window.setTimeout(
      () => setIndice((n) => n + 1),
      resultado.acierto ? PAUSA.acierto : PAUSA.fallo,
    );
    relojes.current.push(reloj);
  }, [anotar, acabar]);

  const cambiarCarril = useCallback(
    (nuevo: number) => {
      if (nuevo < 0 || nuevo > 2 || acabando) return;
      carrilVivo.current = nuevo;
      setCarril(nuevo);
    },
    [acabando],
  );

  /**
   * Saltar o rodar.
   *
   * Dos reglas, y las dos son de juego y no de código:
   *
   *   1. UN GESTO NO SE INTERRUMPE A SÍ MISMO. Pulsar saltar dos veces no
   *      reinicia el arco: el segundo toque se pierde. Sin esta regla, machacar
   *      el botón mantendría a Milo en el aire para siempre y la valla dejaría
   *      de existir.
   *   2. RODAR EN EL AIRE CORTA EL SALTO Y CAE DE GOLPE. Es la caída rápida de
   *      todos los runners y aquí hace falta de verdad: en una puerta doble, un
   *      salto que se lanzó antes de terminar de leer se puede arreglar
   *      rodando, y sin eso ese salto sería una respuesta dada sin querer.
   */
  const gesticular = useCallback(
    (tipo: 'salto' | 'rodada') => {
      if (acabando) return;
      const ahora = performance.now();
      const actual = gestoVivo.current;

      const caidaRapida = tipo === 'rodada' && enElAire(actual, ahora);
      if (!terminado(actual, ahora) && !caidaRapida) return;

      const nuevo: Gesto = { tipo, inicio: ahora };
      gestoVivo.current = nuevo;
      setGesto(nuevo);
    },
    [acabando],
  );

  /*
    Jugar sin tocar la pantalla: flechas o 1-2-3.

    Van en la ventana y no en un contenedor con foco, igual que en CAEN: aquí
    las dianas se mueven y un orden de tabulación que cambia solo con cada
    puerta es peor que no tener ninguno. Con los carriles numerados en pantalla,
    una tecla por carril es directo y no depende de dónde esté el foco.
  */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.altKey || evento.ctrlKey || evento.metaKey) return;

      if (evento.key === 'ArrowLeft') {
        evento.preventDefault();
        cambiarCarril(carrilVivo.current - 1);
        return;
      }
      if (evento.key === 'ArrowRight') {
        evento.preventDefault();
        cambiarCarril(carrilVivo.current + 1);
        return;
      }

      /*
        Arriba salta y abajo rueda, y además la barra espaciadora salta.

        El espacio va porque es lo que pulsa cualquiera en un juego de saltar
        sin que nadie se lo diga, y porque `repeat` lo protege: mantenerlo
        pulsado repite el evento sesenta veces por segundo, y aunque `gesticular`
        ya ignora el gesto que llega con otro en marcha, dejar entrar la ráfaga
        significaría que soltar y volver a pulsar en el momento justo valdría lo
        mismo que tenerlo apretado. La valla tiene que costar un toque.
      */
      if (evento.key === 'ArrowUp' || evento.key === ' ' || evento.key === 'Spacebar') {
        evento.preventDefault();
        if (!evento.repeat) gesticular('salto');
        return;
      }
      if (evento.key === 'ArrowDown') {
        evento.preventDefault();
        if (!evento.repeat) gesticular('rodada');
        return;
      }

      const numero = Number(evento.key);
      if (numero >= 1 && numero <= 3) {
        evento.preventDefault();
        cambiarCarril(numero - 1);
      }
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [cambiarCarril, gesticular]);

  /*
    El tropiezo y el zarpazo se apagan solos.

    Los dos son carteles de un rato, no estados de la partida: lo que la partida
    guarda es la ventaja, que la lleva el marcador. Si se quedaran encendidos,
    la sombra se instalaría encima de la pista después del primer fallo y la
    tercera fase del cazador —la de «aguanta y se aleja»— no existiría.
  */
  useEffect(() => {
    if (!tropiezo) return;
    const reloj = window.setTimeout(() => setTropiezo(0), TROPIEZO);
    return () => window.clearTimeout(reloj);
  }, [tropiezo]);

  useEffect(() => {
    if (!acecho) return;
    const reloj = window.setTimeout(() => setAcecho(0), ACECHO);
    return () => window.clearTimeout(reloj);
  }, [acecho]);

  /*
    Y el gesto se apaga cuando termina el arco.

    Parece de adorno y no lo es: mientras hay gesto, el trote de Milo está en
    pausa —no se puede trotar en el aire— y el botón se queda encendido. Sin
    esta línea, el primer salto de la partida dejaría a Milo deslizándose sin
    mover las patas durante las trece puertas siguientes y el botón encendido
    hasta el final. La referencia `gestoVivo` NO se toca aquí: esa se contesta
    restando y no necesita que nadie la apague; esto es solo lo que se pinta.
  */
  useEffect(() => {
    if (!gesto) return;
    const dura = gesto.tipo === 'salto' ? SALTO.dura : RODADA.dura;
    const reloj = window.setTimeout(
      () => setGesto((actual) => (actual === gesto ? null : actual)),
      Math.max(dura - (performance.now() - gesto.inicio), 0),
    );
    return () => window.clearTimeout(reloj);
  }, [gesto]);

  /** El final: un momento para ver la última puerta y se cierra. */
  useEffect(() => {
    if (!acabando) return;
    sonar('fin');
    if (import.meta.env.DEV && window.__carrera) {
      const suyo = partida.estado;
      window.__carrera.fin = {
        ventaja: suyo.ventaja,
        aciertos: suyo.aciertos,
        fallos: suyo.fallos,
      };
    }
    const reloj = window.setTimeout(terminar, FINAL);
    return () => window.clearTimeout(reloj);
    // El marcador se lee al cerrar y no debe rearmar esto: cambia con cada
    // puerta y volvería a sonar el final catorce veces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acabando, terminar]);

  useEffect(() => {
    const todos = relojes.current;
    return () => todos.forEach((reloj) => window.clearTimeout(reloj));
  }, []);

  const { ventaja, racha, paso } = partida.estado;
  const cazador = ronda.cazador;
  const multiplicador = multiplicadorDe(racha, cazador.tramosDeCombo);
  const ritmo = ritmoDe(ronda, paso);
  const puerta = enPista?.puerta ?? null;

  /*
    La chuleta de los mandos, que ahora tiene que caber cuatro teclas.

    NO cambia con la puerta, y eso es deliberado aunque parezca lo contrario de
    lo útil: `Combo` la esconde en cuanto hay racha —su sitio lo ocupa el
    «impulso ×4»—, así que un aviso que solo viviera aquí desaparecería
    justamente cuando se va bien, que es cuando llegan las puertas dobles. El
    aviso del gesto vive en el renglón de la banda, que está siempre.

    Y es CORTA porque tiene que caber en un renglón a 320 px. Con la versión
    larga —«Flechas o 1-2-3 para el carril»— se partía en dos y la cabecera
    crecía catorce píxeles; como el pill del combo ocupa su sitio y mide uno
    solo, la cabecera se encogía al llegar a tres seguidas y toda la pista
    bailaba debajo de una puerta ya lanzada. Se vio en la captura de 320×568.
  */
  const pista = 'Carril 1-2-3 · ↑ salta · ↓ rueda';

  return (
    <div
      className="mx-auto flex h-dvh w-full max-w-md flex-col px-3 py-3 sm:px-4"
      style={{
        ['--carrera-alto' as string]: `${alto}px`,
        ['--carrera-ritmo' as string]: `${ritmo}ms`,
      }}
    >
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
            Puerta {Math.min(indice + 1, puertas.length)} de {puertas.length}
          </p>
          <Combo multiplicador={multiplicador} pista={pista} />
        </div>
        <Contador etiqueta="Puntos" valor={partida.puntuacion} vivo />
      </CabeceraJuego>

      {/*
        LA FRASE VIVE FUERA DE LA PISTA, EN UNA BANDA QUIETA.

        Es la decisión de maquetación que más pesa del juego. Puesta encima del
        asfalto quedaría más bonita y sería ilegible: leer una frase en inglés
        que hay que entender para actuar cuesta entre 14 y 18 caracteres por
        segundo, y eso ya es apretado sin que el fondo se mueva debajo. Así que
        lo único que se mueve son los portales, y lo que hay que leer está
        clavado, con el hueco marcado y con contraste de sobra.
      */}
      <Banda puerta={puerta} resuelta={resuelta} />

      {/* Lo que acaba de pasar, para quien no ve la pantalla. */}
      <p role="status" aria-live="polite" className="sr-only">
        {aviso}
      </p>

      <div
        ref={campo}
        /*
          `overflow-hidden` no es cosmético: es lo que esconde los portales
          mientras esperan encima del horizonte y lo que recorta el asfalto.
        */
        className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-2xl border-2 border-violet-200 bg-linear-to-b from-violet-100 to-violet-50 dark:border-violet-950 dark:from-slate-950 dark:to-violet-950/40"
      >
        <Asfalto />
        <Cazador ventaja={ventaja} maxima={cazador.ventajaMaxima} acecho={acecho} />

        {enPista && alto > 0 && (
          <Puerta
            key={enPista.marca}
            enPista={enPista}
            carril={carril}
            resuelta={resuelta?.marca === enPista.marca ? resuelta : null}
            parada={acabando}
            onLlegar={cruzar}
          />
        )}

        <Corredor
          carril={carril}
          gesto={gesto}
          tropieza={tropiezo}
          golpe={resuelta ? (resuelta.acierto ? 'impulso' : 'frenazo') : null}
          marca={resuelta?.marca ?? -1}
          parado={acabando}
        />

        {/*
          Las tres zonas de toque ocupan la pista entera, y los portales van sin
          `pointer-events`. Así se toca DONDE se quiere ir en vez de tener que
          acertarle a un portal que se mueve y que además es pequeño cuando
          todavía está lejos, que es justo cuando ya se sabe la respuesta.

          Y con los gestos, esas mismas zonas llevan el DESLIZAMIENTO. El cambio
          de carril se queda en `pointerdown` —tiene que ser inmediato— y el
          gesto sale de `pointermove` en cuanto el dedo se va 24 px arriba o
          abajo, no al soltar: esperar a levantar el dedo le mete a cada salto la
          latencia entera del gesto, y el reloj de la puerta no la ha pagado.
          Que un deslizamiento cambie de carril de paso no molesta: el carril se
          puede volver a cambiar y lo que cuenta es dónde está Milo al llegar.
        */}
        <ul className="absolute inset-0 grid grid-cols-3" aria-label="Carriles">
          {CARRILES.map((numero) => (
            <li key={numero} className="contents">
              <button
                type="button"
                onPointerDown={(evento) => {
                  desdeY.current = evento.clientY;
                  cambiarCarril(numero);
                }}
                onPointerMove={(evento) => {
                  if (desdeY.current === null) return;
                  const recorrido = evento.clientY - desdeY.current;
                  if (Math.abs(recorrido) < DESLIZAR) return;
                  desdeY.current = null;
                  gesticular(recorrido < 0 ? 'salto' : 'rodada');
                }}
                onPointerUp={() => {
                  desdeY.current = null;
                }}
                onPointerCancel={() => {
                  desdeY.current = null;
                }}
                disabled={acabando}
                aria-label={etiquetaDeCarril(puerta, numero)}
                className="h-full w-full touch-none focus-visible:bg-violet-500/10"
              />
            </li>
          ))}
        </ul>

        {/*
          Los dos botones del gesto, en las esquinas de ABAJO y no en una fila
          propia.

          Una fila debajo de la pista costaría 32 px, y a 320×568 —la pantalla
          más baja que se usa— esos 32 px salen de la pista, que es donde vive
          todo. Abajo del todo no estorban: Milo corre al 78 % de la altura, así
          que el último quinto está vacío siempre. Son botones de verdad, con su
          nombre, así que también se llega a ellos tabulando.
        */}
        <div className="pointer-events-none absolute inset-x-1 bottom-1 flex justify-between">
          <BotonDeGesto
            etiqueta="Rodar"
            signo="▼"
            activo={gesto?.tipo === 'rodada'}
            disabled={acabando}
            onPulsar={() => gesticular('rodada')}
          />
          <BotonDeGesto
            etiqueta="Saltar"
            signo="▲"
            activo={gesto?.tipo === 'salto'}
            disabled={acabando}
            onPulsar={() => gesticular('salto')}
          />
        </div>

        {acabando && (
          <div className="absolute inset-0 grid place-items-center bg-[var(--fondo)]/85">
            <p className="animate-crecer px-4 text-center text-xl font-extrabold">
              {ventaja === 0 ? '¡Te alcanzó la sombra!' : '¡Llegaste al final!'}
            </p>
          </div>
        )}
      </div>

      <BarraDelCazador ventaja={ventaja} maxima={cazador.ventajaMaxima} />

      {/*
        La tira de la racha ocupa su sitio SIEMPRE, con racha o sin ella. Si
        apareciera al llegar a dos seguidas, la pista —que es lo que queda en
        medio— encogería treinta píxeles y el plano de Milo se movería debajo de
        una puerta que ya está en el aire con la distancia vieja apuntada.
      */}
      <div className="mt-1 flex h-8 shrink-0 items-center justify-center">
        <Racha racha={racha} />
      </div>

      {golpe && <Destello key={golpe.id} senal={golpe.senal} />}
    </div>
  );
}

/**
 * Lo deprisa que se ve ir el asfalto, según el escalón del reloj.
 *
 * No mide nada ni decide nada: es la traducción a ojo de lo que el reloj ya
 * está haciendo. Importa porque sin ella la carrera SE SIENTE igual de rápida
 * en la puerta uno que en la catorce aunque la ventana haya bajado un 45 %, y
 * entonces la aceleración —que es lo que este juego promete— solo existiría en
 * los números.
 */
function ritmoDe(ronda: RondaDeCarrera, paso: number): number {
  const escalones = ronda.reloj.escalones;
  const primero = escalones[0] ?? RITMO_LENTO;
  const ultimo = escalones[escalones.length - 1] ?? primero;
  const actual = escalones[Math.min(Math.max(paso, 0), escalones.length - 1)] ?? primero;

  if (primero === ultimo) return RITMO_LENTO;
  const fraccion = (actual - ultimo) / (primero - ultimo);
  return Math.round(RITMO_RAPIDO + fraccion * (RITMO_LENTO - RITMO_RAPIDO));
}

/* ----------------------------------- */
/* Las piezas que se pintan.           */
/* ----------------------------------- */

/**
 * La banda de la frase.
 *
 * El hueco se pinta como un hueco —un recuadro vacío— y no como tres guiones
 * bajos: a 320 px y de reojo, «___» se confunde con una palabra corta, y el
 * primer trabajo de quien lee es encontrar DÓNDE falta algo.
 *
 * Al fallar, el hueco se rellena con la palabra buena en verde y debajo aparece
 * la regla en una línea. Es el único rato en el que este juego enseña algo, y
 * por eso la pausa del fallo dura el triple que la del acierto.
 */
function Banda({
  puerta,
  resuelta,
}: {
  puerta: PuertaDeCarrera | null;
  resuelta: Resuelta | null;
}) {
  const mostrada = resuelta?.puerta ?? puerta;
  const fallada = Boolean(resuelta && !resuelta.acierto);
  const partes = useMemo(() => (mostrada ? mostrada.frase.split(/_{3}/) : ['', '']), [mostrada]);

  return (
    <div className="mt-2 flex min-h-[76px] shrink-0 flex-col justify-center rounded-xl border-2 border-violet-200 bg-[var(--superficie)] px-2 py-1.5 dark:border-violet-900">
      {/*
        EL RENGLÓN DEL GESTO, y OCUPA SU SITIO SIEMPRE.

        Lo de que ocupe su sitio siempre no es maña: es la misma lección que ya
        estaba escrita abajo para la tira de la racha. Este renglón solo tiene
        algo que decir en las puertas que piden gesto, que son cuatro o cinco de
        catorce; si apareciera y desapareciera, la banda crecería y encogería
        catorce veces, la pista —que es lo que queda en medio— se movería con
        ella y el plano de Milo cambiaría DEBAJO de una puerta que ya está en el
        aire con la distancia vieja apuntada. Se vería como un salto del suelo.
        Así que la altura está reservada con `h-4` y lo que cambia es el texto.

        Y lo que dice en una puerta doble no es una ayuda de más: sin la
        etiqueta se vería «went» arriba y «go» abajo sin saber qué se afirma al
        saltar, y media respuesta la pondría el azar. Con ella, saltar es decir
        «esto va en pasado» y equivocarse de fila es equivocarse de gramática.

        Va DENTRO de la banda quieta y no sobre el asfalto, por lo mismo que la
        frase: es texto que hay que leer para actuar.
      */}
      <p className="flex h-4 items-center justify-center text-center text-[11px] font-bold leading-none text-[var(--texto-suave)]">
        {fallada ? null : mostrada?.ejes ? (
          <span className="text-amber-600 dark:text-amber-400">
            ▲ {mostrada.ejes.arriba} · ▼ {mostrada.ejes.abajo}
          </span>
        ) : mostrada?.estorbo ? (
          <span className="text-amber-600 dark:text-amber-400">
            {mostrada.estorbo === 'valla' ? '▲ salta la valla' : '▼ rueda bajo la barra'}
          </span>
        ) : null}
      </p>
      <p lang="en" className="text-center text-lg font-extrabold leading-tight sm:text-xl">
        {partes[0]}
        <span
          className={cn(
            'mx-0.5 inline-block min-w-14 rounded-md border-b-4 px-1 align-baseline',
            fallada
              ? 'border-emerald-500 bg-emerald-50 text-[var(--texto-acierto)] dark:bg-emerald-950/60'
              : 'border-violet-400 bg-violet-50 dark:bg-violet-950/60',
          )}
        >
          {fallada ? resuelta!.puerta.correcta : ' '}
        </span>
        {partes.slice(1).join('')}
      </p>

      {fallada && (
        <p className="mt-0.5 text-center text-[11px] font-bold leading-snug text-[var(--texto-fallo)]">
          {resuelta!.puerta.ensena}
        </p>
      )}
    </div>
  );
}

/**
 * Una puerta: tres portales acercándose, uno por carril.
 *
 * Son dos capas por portal y cada una mueve una sola cosa, que es lo que
 * permite tocar una sin estropear la otra:
 *
 *   1. el desplazamiento, que es el que recorre la pista y el que lleva el
 *      RELOJ: su `animationend` es lo que dice que la puerta llegó;
 *   2. el tamaño del arco, que crece más deprisa al final para que se lea como
 *      profundidad aunque el desplazamiento sea lineal;
 *
 * Con las dos en el mismo elemento habría que reescribir el `transform` entero
 * desde JavaScript en cada fotograma, que es exactamente lo que no hay que
 * hacer.
 *
 * La palabra NO tiene capa propia, y eso también costó un intento: vive dentro
 * del arco, así que su escala se multiplicaría por la de él y acabaría más
 * pequeña, no más grande. Lo que la hace legible desde el primer instante es
 * que el arco no baja del 78 %, y eso está razonado en `index.css`.
 */
function Puerta({
  enPista,
  carril,
  resuelta,
  parada,
  onLlegar,
}: {
  enPista: EnPista;
  carril: number;
  resuelta: Resuelta | null;
  parada: boolean;
  onLlegar: () => void;
}) {
  const corriendo = !resuelta && !parada;

  return (
    <>
      {enPista.puerta.opciones.map((opcion, numero) => (
        <div
          key={opcion + String(numero)}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -ml-[15%] w-[30%]"
          style={{
            ['--carrera-carril' as string]: numero - 1,
            animation: `carrera-puerta-mover ${enPista.ventanaMs}ms linear forwards`,
            animationPlayState: corriendo ? 'running' : 'paused',
          }}
          /*
            La puerta llegó al plano de Milo.

            Se compara `target` con `currentTarget` y no el nombre de la
            animación porque las capas de dentro tienen las suyas y sus avisos
            burbujean hasta aquí; lo que hay que distinguir es DE QUIÉN es el
            aviso, y eso lo dice el destino. Además el nombre no viaja en todos
            los entornos, así que comprobarlo dejaría este final sin probar.

            Y solo lo escucha el portal del medio: los tres terminan a la vez, y
            sin este filtro la puerta se resolvería tres veces.
          */
          onAnimationEnd={(evento) => {
            if (numero !== 1) return;
            if (evento.target === evento.currentTarget && corriendo) onLlegar();
          }}
        >
          <Portal
            texto={opcion}
            alta={enPista.puerta.altas?.[numero] ?? null}
            estorbo={enPista.puerta.estorbo ?? null}
            ventanaMs={enPista.ventanaMs}
            apuntado={carril === numero}
            estadoDe={(cual) =>
              !resuelta
                ? 'abierto'
                : cual === resuelta.puerta.correcta
                  ? 'buena'
                  : cual === resuelta.cruzado
                    ? 'mala'
                    : 'abierto'
            }
            corriendo={corriendo}
            premio={resuelta?.acierto && opcion === resuelta.cruzado ? resuelta.suma : null}
            premioAlto={
              resuelta?.acierto && enPista.puerta.altas?.[numero] === resuelta.cruzado
                ? resuelta.suma
                : null
            }
          />
        </div>
      ))}
    </>
  );
}

/**
 * El alto del arco, en sus dos formas.
 *
 * El sencillo se queda en los 96 px de siempre. El doble sube a 116 y ese
 * número sale de una cuenta, no del ojo: hay que meter dos palabras y un
 * travesaño, y lo que no se puede bajar es la letra. Con 116 px cada mitad
 * tiene 52 y el travesaño 8; a 320 px y al 78 % de escala —lo más pequeño que
 * llega a estar el arco— esos 52 px son 40, que dan de sobra para un renglón
 * de la talla grande y su aire.
 *
 * Los 20 px de más también caen donde tienen que caer. Milo corre al 78 % de
 * la altura de la pista y la puerta llega al 60 %: con el arco sencillo, su
 * mitad de abajo le cae encima. Con el doble, la fila de arriba queda por
 * encima de su cabeza y la de abajo a la altura de sus pies, que es
 * exactamente lo que hay que creerse para saltar a una y rodar a la otra.
 */
const ARCO_SENCILLO = 96;
const ARCO_DOBLE = 116;

function Portal({
  texto,
  alta,
  estorbo,
  ventanaMs,
  apuntado,
  estadoDe,
  corriendo,
  premio,
  premioAlto,
}: {
  texto: string;
  /** La opción de la fila de arriba, si esta puerta es doble. */
  alta: string | null;
  estorbo: 'valla' | 'barra' | null;
  ventanaMs: number;
  apuntado: boolean;
  estadoDe: (opcion: string) => 'abierto' | 'buena' | 'mala';
  corriendo: boolean;
  premio: number | null;
  premioAlto: number | null;
}) {
  const doble = alta !== null;
  const estado = doble ? 'abierto' : estadoDe(texto);

  return (
    <div
      className="relative"
      style={{
        animation: `carrera-puerta-crecer ${ventanaMs}ms linear forwards`,
        animationPlayState: corriendo ? 'running' : 'paused',
      }}
    >
      {/*
        El arco. Es un rectángulo redondeado por arriba con el interior más
        claro, y no un botón: lo que se cruza es un hueco, y un rectángulo plano
        no se cruza, se toca.
      */}
      <div
        className={cn(
          /*
            El texto CENTRADO, no pegado abajo.

            Al cruzar, Milo se planta encima del portal —es lo que pasa, ha
            corrido hasta él— y con el texto en el borde inferior le tapaba
            justamente la palabra que se acababa de elegir. Se ve en las
            capturas del primer intento: el portal rojo salía sin su opción.
            Subiéndola al centro del arco queda por encima de la cabeza de Milo
            y se puede comparar con la buena, que es lo que hay que hacer ahí.
          */
          'flex w-full flex-col items-center justify-center overflow-hidden rounded-t-[42%] border-[3px] border-b-0 shadow-lg',
          !doble && 'pb-1',
          estado === 'buena' && 'border-emerald-500 bg-emerald-100/90 dark:bg-emerald-900/80',
          estado === 'mala' && 'border-red-500 bg-red-100/90 dark:bg-red-950/80',
          estado === 'abierto' &&
            (apuntado
              ? 'border-violet-500 bg-violet-200/90 ring-4 ring-violet-400/50 dark:border-violet-300 dark:bg-violet-800/80'
              : 'border-violet-400/70 bg-[var(--superficie)]/85 dark:border-violet-600'),
        )}
        style={{ height: doble ? ARCO_DOBLE : ARCO_SENCILLO }}
      >
        {doble ? (
          <>
            <Fila texto={alta} estado={estadoDe(alta)} />
            {/*
              El travesaño. No es una raya decorativa: es lo que hay que evitar,
              y por eso se pinta como un obstáculo —rayado y con sombra— y no
              como un separador.
            */}
            <span
              aria-hidden
              className="h-2 w-full shrink-0 bg-[repeating-linear-gradient(45deg,#f59e0b_0,#f59e0b_5px,#1f2937_5px,#1f2937_10px)] shadow-md"
            />
            <Fila texto={texto} estado={estadoDe(texto)} />
          </>
        ) : (
          <span
            lang="en"
            className={cn(
              'block w-full break-words px-0.5 text-center font-extrabold leading-tight',
              tamanoDe(texto),
            )}
          >
            {texto}
          </span>
        )}
      </div>

      {/*
        La reja de una puerta sencilla, POR FUERA del arco y pegada a su boca.

        Va fuera y no dentro porque lo que hace no es dividir el hueco, es
        taparlo: es una valla plantada delante de los tres arcos por igual. Y
        por eso se dibuja idéntica en los tres, que es lo que impide que sea un
        cartel diciendo dónde está la respuesta.
      */}
      {estorbo && <Reja tipo={estorbo} />}

      {premioAlto !== null && <Premio suma={premioAlto} arriba />}
      {premio !== null && <Premio suma={premio} arriba={false} />}
    </div>
  );
}

/** Una de las dos filas de un portal partido. */
function Fila({ texto, estado }: { texto: string; estado: 'abierto' | 'buena' | 'mala' }) {
  return (
    <span
      lang="en"
      className={cn(
        'flex w-full flex-1 items-center justify-center break-words px-0.5 text-center font-extrabold leading-tight',
        tamanoDe(texto),
        estado === 'buena' &&
          'bg-emerald-200/90 text-[var(--texto-acierto)] dark:bg-emerald-800/80',
        estado === 'mala' && 'bg-red-200/90 text-[var(--texto-fallo)] dark:bg-red-900/80',
      )}
    >
      {texto}
    </span>
  );
}

/**
 * La valla baja o el travesaño alto de una puerta sencilla.
 *
 * `valla` es una tabla en la boca del arco que llega a la altura de la rodilla
 * de Milo: se pasa por encima. `barra` es un travesaño colgado arriba con el
 * hueco debajo: se pasa por abajo. Se dibujan con el mismo rayado de obra que
 * el travesaño de la puerta doble para que las tres cosas se lean como lo
 * mismo —algo con lo que se choca— sin tener que aprenderse tres símbolos.
 */
function Reja({ tipo }: { tipo: 'valla' | 'barra' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 h-3 bg-[repeating-linear-gradient(45deg,#f59e0b_0,#f59e0b_5px,#1f2937_5px,#1f2937_10px)] shadow-md',
        tipo === 'valla' ? 'bottom-0 rounded-t-sm' : 'top-3 rounded-sm',
      )}
    />
  );
}

/** Los puntos que se ganan, flotando sobre la fila por la que se pasó. */
function Premio({ suma, arriba }: { suma: number; arriba: boolean }) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white shadow',
        arriba ? '-top-4' : '-top-2',
      )}
      style={{ animation: 'carrera-premio 900ms ease-out forwards' }}
    >
      +{suma}
    </span>
  );
}

/**
 * Milo corriendo.
 *
 * Va en `memo` y con la mascota dentro por una razón de rendimiento concreta:
 * `Mascota` monta una docena de resortes y varios temporizadores propios, y la
 * pista la vuelve a pintar cada vez que se resuelve una puerta. Sin el `memo`,
 * cada punto que se marca reiniciaría el parpadeo, la mirada y el aleteo de
 * Milo a media animación, y se ve como un tirón.
 *
 * El trote NO sale de la coreografía de la mascota sino de una capa de CSS de
 * aquí, que sube, baja y balancea. Es lo que convierte «un búho quieto» en «un
 * búho corriendo» sin tocar el archivo de las mascotas, y además va al ritmo
 * del asfalto: cuando la carrera acelera, Milo trota más deprisa.
 */
const Corredor = memo(function Corredor({
  carril,
  gesto,
  tropieza,
  golpe,
  marca,
  parado,
}: {
  carril: number;
  /** El salto o la rodada en marcha. Se pinta con su propia capa. */
  gesto: Gesto | null;
  /** Sube con cada choque: es lo que reinicia la animación de irse de bruces. */
  tropieza: number;
  golpe: 'impulso' | 'frenazo' | null;
  marca: number;
  parado: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 w-[30%] -ml-[15%] transition-transform duration-150 ease-out"
      style={{
        /*
          Milo va un poco por DEBAJO del plano al que llegan las puertas (60 %
          contra 78 %), y esa distancia es a propósito: el arco mide 96 px, así
          que su mitad inferior cae justo sobre Milo y el portal se cruza de
          verdad en vez de pararse delante. Si los dos planos fueran el mismo,
          el portal aparecería colgado por encima de la cabeza.

          Estaba en 72 % y a 320×568 —la pantalla más baja que se usa— Milo
          tapaba la palabra del portal que acababa de cruzar, justo al fallar,
          que es cuando esa palabra es lo único que enseña. En pantallas altas
          no pasaba. Bajarlo al 78 % lo resuelve sin tocar el cruce: la mitad
          inferior del arco le sigue cayendo encima.
        */
        top: 'calc(var(--carrera-alto, 300px) * 0.78)',
        transform: `translateX(${(carril - 1) * 100}%)`,
      }}
    >
      <div
        key={marca}
        style={
          golpe
            ? {
                animation: `carrera-${golpe} ${golpe === 'impulso' ? 520 : 620}ms ease-out`,
              }
            : undefined
        }
      >
        {/*
          EL GESTO VA EN SU PROPIA CAPA, y es la misma razón por la que el
          desplazamiento y el tamaño de la puerta van en capas distintas: cada
          capa mueve UNA cosa. El salto sube y baja, el trote de dentro sigue
          trotando, y el tirón del acierto —que está en la capa de fuera— sigue
          pudiendo dispararse encima sin que ninguno de los tres se pise.

          Con las tres en el mismo elemento habría que componer los `transform`
          a mano desde JavaScript en cada fotograma, que es exactamente lo que
          este juego no hace en ninguna parte.

          `transform-origin: bottom` es lo que convierte el `scaleY(0.5)` de la
          rodada en agacharse en vez de encoger: sin él, Milo se achataría
          hacia el centro y se le verían los pies despegados del suelo.
        */}
        <div
          key={gesto ? `${gesto.tipo}${gesto.inicio}` : 'de-pie'}
          className="origin-bottom"
          style={
            gesto
              ? {
                  animation: `carrera-${gesto.tipo} ${
                    gesto.tipo === 'salto' ? SALTO.dura : RODADA.dura
                  }ms linear forwards`,
                }
              : undefined
          }
        >
          <div
            key={`choque${tropieza}`}
            style={
              tropieza
                ? { animation: `carrera-tropiezo ${TROPIEZO}ms ease-out forwards` }
                : undefined
            }
          >
            <div
              className="flex justify-center"
              style={{
                animation: `carrera-trote var(--carrera-ritmo, 620ms) ease-in-out infinite`,
                animationPlayState: parado || gesto ? 'paused' : 'running',
              }}
            >
              <Mascota
                estado={golpe === 'impulso' ? 'celebrando' : golpe === 'frenazo' || tropieza ? 'sorprendido' : 'feliz'} // prettier-ignore
                tamano={78}
              />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">
        Milo va por el carril {carril + 1}
        {gesto?.tipo === 'salto' ? ', saltando' : gesto?.tipo === 'rodada' ? ', rodando' : ''}
      </span>
    </div>
  );
});

/**
 * El asfalto: dos líneas de carril y seis rayas corriendo.
 *
 * Seis y ni una más, con `aria-hidden`. No significan nada y para quien no ve la
 * pantalla serían ruido; lo que hacen es que la pista esté viva también en los
 * segundos en los que no hay ninguna puerta, que entre puerta y puerta son casi
 * dos. Van con retardo negativo escalonado, así que el suelo ya lleva un rato
 * corriendo cuando aparece la pantalla.
 */
function Asfalto() {
  const rayas = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/*
        La calzada, y su forma sale de una cuenta, no del ojo.

        El trapecio TIENE que contener a los tres portales en todo el recorrido,
        y eso ata su anchura a la de ellos. Los portales van del 85 % al 100 %
        de separación y del 78 % al 100 % de tamaño —eso está razonado en
        `index.css`, y es lo que los hace legibles desde el primer instante—,
        así que su envergadura va del 74 % de la pista arriba al 90 % abajo. Una
        calzada con el punto de fuga de verdad mide un 18 % arriba: los portales
        de los lados le colgarían fuera, flotando sobre la nada. Se vio en las
        primeras capturas.

        De ahí estos números: 15-85 % arriba y -4-104 % abajo. Es un trapecio
        suave, mucho menos espectacular que una carretera de verdad, y es el que
        cuadra con lo único que no se podía negociar, que es que la palabra del
        portal se lea.
      */}
      <span
        className="absolute inset-x-0 bottom-0 top-[12%] block bg-slate-300/70 dark:bg-slate-800/70"
        style={{ clipPath: 'polygon(15% 0, 85% 0, 104% 100%, -4% 100%)' }}
      />
      {/*
        Las dos líneas que separan los carriles, en la misma perspectiva.

        Salen de dividir la calzada en tres: arriba en el 38 y el 62 %, abajo en
        el 32 y el 68 %. Comprobado a la altura en la que llega la puerta, caen
        en el 35 y el 65 %, que es exactamente donde están los bordes de los
        portales cuando se cruzan. Si no coincidieran, el portal de un carril
        quedaría a caballo de su propia línea, y en un juego que se decide por
        carriles eso confunde de verdad.
      */}
      <span
        className="absolute inset-x-0 bottom-0 top-[12%] block bg-slate-400/60 dark:bg-slate-600/50"
        style={{ clipPath: 'polygon(38.0% 0, 38.6% 0, 32.3% 100%, 31.7% 100%)' }}
      />
      <span
        className="absolute inset-x-0 bottom-0 top-[12%] block bg-slate-400/60 dark:bg-slate-600/50"
        style={{ clipPath: 'polygon(61.4% 0, 62.0% 0, 68.3% 100%, 67.7% 100%)' }}
      />

      {rayas.map((raya) => (
        <span
          key={raya}
          className="absolute left-1/2 top-0 block h-1.5 w-[22%] -translate-x-1/2 rounded-full bg-violet-400/70 dark:bg-violet-400/40"
          style={{
            animation: `carrera-raya var(--carrera-ritmo, 620ms) linear infinite`,
            animationDelay: `${-(raya * 620) / 6}ms`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * El cazador: una sombra al fondo de la pista que se acerca al fallar.
 *
 * No es un adorno ni una barra disfrazada: es lo que sustituye a las vidas. La
 * diferencia es que las vidas cuentan despistes y esto cuenta DERRUMBES. Con
 * tres vidas, fallar la cuarta puerta y la novena acaba la partida igual que
 * fallar tres seguidas; aquí no, porque entre medias se recupera. Lo que mata
 * es dejar de leer, que es exactamente lo que este juego quiere castigar.
 *
 *
 * LAS TRES FASES, Y POR QUÉ NO SON UN SISTEMA DE VIDAS APARTE
 *
 * La sombra tiene tres estados y los tres se leen de la MISMA ventaja que ya
 * llevaba la barra. Es la decisión de diseño de esta pieza y conviene decir qué
 * se estuvo a punto de hacer en su lugar: un contador de tropiezos propio, con
 * su regla de «te atrapan al segundo», que corría en paralelo a la ventaja.
 *
 * Se descartó por lo que medía. Ese contador es puro arcade —cuenta gestos
 * fallados— y habría metido una segunda forma de perder la carrera que no sabe
 * nada de inglés. Este juego apunta a que se falle el 15 % y a que ese 15 % lo
 * ponga la gramática; una muerte por dedos, por rara que fuese, sale entera de
 * ese presupuesto. Así que la fase es una LECTURA de la ventaja y no una vida:
 *
 *   - FUERA (ventaja ≥ 70): la sombra no está. Quien encadena no la ve, que es
 *     justo lo que pide un runner: el que va perfecto corre solo.
 *   - ASOMA (40 a 70): se ve al fondo, pequeña. Es el aviso.
 *   - ENCIMA (por debajo de 40): grande y pisando. Con 55 de salida y 26 por
 *     fallo, ahí se llega con un fallo y se sale con dos cruces buenas.
 *   - ZARPA (ventaja 0): tres fallos sin recuperarse. Se acabó.
 *
 * Y encima de todo eso va el ZARPAZO, que es una capa aparte y de tiempo: al
 * fallar la sombra se abalanza tres segundos y medio y se retira sola. Eso es
 * lo que hace que «aguanta y se alejan» sea verdad sin tocar la puntuación: el
 * susto se va solo, y lo que queda debajo es la ventaja, que solo la mueve
 * cruzar puertas.
 */
const CAZADOR_FUERA = 0.7;
const CAZADOR_ENCIMA = 0.4;

/** Lo que dura el zarpazo: 3,5 segundos, dentro de los 3-5 que pedía el diseño. */
const ACECHO = 3500;

function Cazador({ ventaja, maxima, acecho }: { ventaja: number; maxima: number; acecho: number }) {
  const resto = Math.min(Math.max(ventaja / maxima, 0), 1);
  const cercania = 1 - resto;
  const escala = 0.34 + cercania * 0.78;
  const avance = 0.02 + cercania * 0.5;

  /*
    Fuera de la pista no es opacidad cero: es que no está.

    Con `opacity: 0` el elemento sigue ahí, sigue componiéndose y sigue
    ocupando una capa del compositor en la pantalla que más capas mueve del
    juego. Y sobre todo, se vería aparecer un fantasma medio transparente en el
    rato en el que la ventaja cruza el umbral, que es exactamente lo contrario
    de lo que tiene que contar: o te persiguen o no.
  */
  const fuera = resto >= CAZADOR_FUERA && !acecho;

  return (
    <>
      {!fuera && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 block w-[26%] -translate-x-1/2 transition-all duration-700 ease-out"
          style={{
            transform: `translate3d(-50%, calc(var(--carrera-alto, 300px) * ${avance}), 0) scale(${escala})`,
            opacity: resto < CAZADOR_ENCIMA ? 1 : 0.28 + cercania * 0.5,
          }}
        >
          <SiluetaDeSombra />
        </span>
      )}

      {/*
        El zarpazo: una sombra de más, suya y con su propio reloj.

        Va SEPARADA de la de arriba a propósito. Si el susto se pintara moviendo
        la misma silueta, al acabarse volvería a su sitio con la transición de
        700 ms de la ventaja y parecería que la ventaja ha cambiado, cuando lo
        único que ha pasado es que el susto se fue. Dos capas, dos relojes y
        ninguna miente sobre la otra.
      */}
      {acecho > 0 && (
        <span
          key={acecho}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 block w-[34%]"
          style={{ animation: `carrera-zarpazo ${ACECHO}ms ease-out forwards` }}
        >
          <SiluetaDeSombra />
        </span>
      )}
    </>
  );
}

/**
 * Una silueta y no un monstruo dibujado: lo que asusta de algo que persigue es
 * no verle la cara. Y de paso pesa cuatro trazos, que en una pantalla que ya
 * mueve tres portales es lo que hay que gastar aquí.
 */
function SiluetaDeSombra() {
  return (
    <svg viewBox="0 0 60 60" className="w-full drop-shadow-lg">
      <path
        d="M30 6c-9 0-16 7-16 16 0 5 2 9 5 12-6 4-10 11-10 19v5h42v-5c0-8-4-15-10-19 3-3 5-7 5-12 0-9-7-16-16-16z"
        className="fill-slate-800 dark:fill-black"
      />
      <circle cx="23" cy="21" r="3.2" className="fill-red-500" />
      <circle cx="37" cy="21" r="3.2" className="fill-red-500" />
    </svg>
  );
}

/** Lo que le saca Milo al cazador, en barra y en número. */
function BarraDelCazador({ ventaja, maxima }: { ventaja: number; maxima: number }) {
  const porcentaje = Math.max(0, Math.min(100, (ventaja / maxima) * 100));
  const apurado = porcentaje <= 34;

  return (
    <div className="mt-2 shrink-0">
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
        <span>Ventaja sobre la sombra</span>
        {/*
          El número al lado de la barra, y no solo la barra. Es lo mismo que
          hacen las vidas de CAEN con sus corazones: la barra se mira de reojo a
          media carrera, y el número es lo que lee quien no distingue lo lleno de
          lo vacío.
        */}
        <span className="font-extrabold tabular-nums">{Math.round(porcentaje)}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Ventaja sobre la sombra"
        aria-valuenow={Math.round(porcentaje)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-0.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            apurado ? 'bg-red-500' : 'bg-violet-500',
          )}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

/**
 * El combo.
 *
 * Dice «impulso ×4» y no «×4» a secas, y esa palabra es todo el motivo de que
 * esta pieza exista por separado en vez de dejárselo a `Racha`. `Tablero.tsx`
 * lo dejó escrito: un multiplicador suelto al lado de una puntuación promete que
 * el acierto siguiente vale el cuádruple, y aquí no lo vale —los puntos los paga
 * el servidor con su fórmula de siempre—. Lo que sí vale el cuádruple es la
 * distancia que se le saca al cazador, así que se escribe exactamente eso.
 */
function Combo({ multiplicador, pista }: { multiplicador: number; pista: string }) {
  if (multiplicador <= 1) {
    return <p className="mt-0.5 text-[11px] leading-snug text-[var(--texto-suave)]">{pista}</p>;
  }

  return (
    <p
      key={multiplicador}
      className="mt-0.5 inline-flex animate-crecer items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-extrabold leading-none text-white"
    >
      <span aria-hidden>⚡</span> impulso ×{multiplicador}
    </p>
  );
}

/**
 * Cómo se llama un carril para quien no ve la pantalla.
 *
 * En una puerta sencilla dice su opción, como siempre. En una doble dice las
 * DOS y con qué gesto se coge cada una, porque ahí el nombre del carril ya no
 * es una respuesta: es la mitad de una. Sin el gesto dentro del nombre, quien
 * juega de oído sabría que en el carril 2 hay «went» y «go» y no tendría forma
 * de saber cuál coge al pasar.
 */
function etiquetaDeCarril(puerta: PuertaDeCarrera | null, numero: number): string {
  if (!puerta) return `Carril ${numero + 1}`;

  const abajo = puerta.opciones[numero] ?? '';
  const arriba = puerta.altas?.[numero];
  if (arriba) return `Carril ${numero + 1}: saltando ${arriba}, rodando ${abajo}`;

  const gesto =
    puerta.estorbo === 'valla' ? ' saltando' : puerta.estorbo === 'barra' ? ' rodando' : '';
  return `Carril ${numero + 1}:${gesto} ${abajo}`;
}

/**
 * Los botones de saltar y rodar.
 *
 * Existen por dos motivos que se refuerzan: que el juego se pueda jugar
 * tocando sin tener que descubrir que hay que deslizar —un gesto que no se ve
 * no existe— y que los dos ejes sean alcanzables con el tabulador, igual que
 * ya lo eran los tres carriles.
 *
 * Son cuadrados de 44 px, que es el objetivo táctil de las guías de
 * accesibilidad y lo que en esta pantalla se puede pulsar sin mirar mientras
 * pasan otras cosas.
 */
function BotonDeGesto({
  etiqueta,
  signo,
  activo,
  disabled,
  onPulsar,
}: {
  etiqueta: string;
  signo: string;
  activo: boolean;
  disabled: boolean;
  onPulsar: () => void;
}) {
  return (
    <button
      type="button"
      // `pointerdown` y no `click`: el gesto tiene que salir en cuanto el dedo
      // toca, no cuando lo levanta. Esperar al `click` le mete a cada salto los
      // cien y pico milisegundos del toque entero, y el reloj de la puerta no
      // los ha pagado.
      onPointerDown={onPulsar}
      disabled={disabled}
      aria-label={etiqueta}
      className={cn(
        'pointer-events-auto grid h-11 w-11 touch-none place-items-center rounded-full border-2 text-base font-black shadow-md',
        activo
          ? 'border-amber-500 bg-amber-300 text-slate-900'
          : 'border-violet-400/80 bg-[var(--superficie)]/85 text-[var(--texto-suave)] dark:border-violet-600',
      )}
    >
      <span aria-hidden>{signo}</span>
    </button>
  );
}

/**
 * Qué tamaño aguanta la opción dentro del portal.
 *
 * Las opciones van de «am» a «don't must», y una talla única deja la corta
 * ridícula o la larga partida en dos renglones. Partirla no es opción: es lo
 * que hay que leer, y encima de reojo y mientras se acerca.
 *
 * Las cuatro tallas están pensadas para el PEOR momento, que es cuando el
 * portal acaba de aparecer y está al 78 % de su tamaño: ahí la más grande son
 * quince píxeles y la más pequeña once. Contadas sobre el contenido de hoy, 201
 * de las 306 opciones caen en la talla grande y solo una pasa de nueve letras.
 */
function tamanoDe(texto: string): string {
  if (texto.length <= 4) return 'text-xl';
  if (texto.length <= 7) return 'text-lg';
  if (texto.length <= 9) return 'text-base';
  return 'text-sm';
}

/* ----------------------------------- */
/* La versión sin movimiento.          */
/* ----------------------------------- */

/**
 * La misma carrera, sin pista.
 *
 * QUÉ SE QUITA Y QUÉ NO, QUE ES LA PARTE DIFÍCIL
 *
 * Un runner con movimiento reducido no puede tener nada acercándose, así que
 * aquí no se acerca nada: los tres portales están quietos y del mismo tamaño, y
 * el asfalto no corre. Hasta ahí es lo obvio.
 *
 * Lo que NO se quita es el reloj, y esa sí es una decisión. CAEN, con
 * movimiento reducido, se convierte en un juego por turnos sin prisa, y para
 * CAEN está bien: allí lo que se entrena es reconocer una palabra, y se puede
 * entrenar sin reloj. Aquí no. Lo que este juego entrena es leer una frase
 * inglesa a velocidad de reflejo, sin traducir de por medio; quitarle el tiempo
 * lo convierte en un ejercicio de rellenar huecos, que la aplicación ya tiene a
 * montones. Sería accesible y estaría vacío.
 *
 * Así que el reloj se queda y lo que cambia es CÓMO SE PINTA: un número que
 * baja de segundo en segundo, sin barra que se vacíe ni nada que se deslice. El
 * estado solo cambia cuando cambia el segundo entero, que es exactamente lo que
 * hace LA PARTÍCULA con su barra. Un número que cambia una vez por segundo no
 * es movimiento: es información.
 *
 * Y de propina, aquí se lee MEJOR que en la pista: no hay suelo moviéndose
 * debajo robando atención, y la ventana es la misma que calculó el servidor. O
 * sea que la versión accesible es, si acaso, un poco más fácil. Es el lado
 * correcto por el que equivocarse.
 *
 * La carrera se sigue viendo: hay un mapa de catorce casillas con Milo en la
 * suya y la sombra detrás, y esas dos fichas se mueven de casilla cuando se
 * resuelve una puerta. Un salto de posición no es una animación.
 *
 *
 * Y AHORA HAY UN EJE VERTICAL, QUE ES EL CASO MÁS DIFÍCIL DE TODOS
 *
 * La puerta doble pregunta dos cosas —qué palabra y qué forma— y en la pista
 * la segunda se contesta saltando o rodando. Aquí eso no se puede sostener, y
 * no por pureza: el gesto se acierta metiendo un toque dentro de una ventana de
 * 520 ms que solo existe porque hay un arco animándose, y quien pidió menos
 * movimiento no tiene ese arco. Un botón de «saltar» sin salto sería una
 * ventana de tiempo sin nada que la explique.
 *
 * Así que se quita el gesto y NO se quita la pregunta: las seis formas salen
 * como seis botones en dos grupos, con las mismas etiquetas de `ejes` que se
 * pintan en la pista. Ese es el reparto correcto, y conviene decirlo porque la
 * tentación era la contraria: el gesto era la FORMA de contestar, no lo que se
 * preguntaba. Degradar la puerta doble a tres opciones habría sido quitarle a
 * esta pantalla la mitad de la gramática que el juego entrena, que es
 * exactamente lo que «accesible y vacío» quiere decir.
 *
 * La reja de las puertas sencillas sí se quita entera, y sin pena: era arcade
 * puro, un peaje para que los dos gestos se practicaran. Sin gestos no hay nada
 * que practicar.
 *
 * El reloj sigue siendo el del servidor, con su `gestoMs` incluido —medio
 * segundo que aquí sobra—. Se deja a propósito, por lo mismo que está escrito
 * arriba: esta pantalla acaba siendo un poco más fácil, y ese es el lado
 * correcto por el que equivocarse.
 */
function PorTurnos({
  ronda,
  partida,
  onSalir,
}: {
  ronda: RondaDeCarrera;
  partida: Partida;
  onSalir: () => void;
}) {
  const puertas = ronda.puertas;
  const { anotar, terminar } = partida;

  const [indice, setIndice] = useState(0);
  const [resuelta, setResuelta] = useState<Resuelta | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState('');

  const puerta = puertas[indice];
  const { ventaja, racha, paso } = partida.estado;
  const seAcabo = ventaja === 0 || !puerta;

  /*
    Esta pantalla publica el MISMO mirador de desarrollo que la pista.

    No es simetría por simetría: sin él, el jugador simulado no puede jugar aquí
    —no hay forma de saber qué portal es el bueno— y entonces la pantalla
    accesible no se puede medir jugando, que es la única forma de medir este
    juego. Se quedó sin medir en la primera versión y se notó enseguida: al
    intentar llegar a una puerta doble contestando al azar, la carrera se acaba
    en la cuarta y las dobles están de la once en adelante.
  */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__carrera = { puerta: null, puertas: [], fin: null };
    return () => {
      delete window.__carrera;
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || !window.__carrera) return;
    window.__carrera.puerta =
      puerta && !resuelta ? { ...puerta, desde: performance.now(), ventanaMs: 0 } : null;
  }, [puerta, resuelta]);

  const responder = useCallback(
    (cruzado: string) => {
      if (!puerta) return;
      const resultado = anotar(puerta, cruzado);
      setResuelta({ ...resultado, marca: indice, puerta, cruzado });
      setAviso(
        resultado.acierto
          ? `Bien: ${puerta.correcta}. ${resultado.suma} puntos.`
          : `Era ${puerta.correcta}. ${puerta.ensena}`,
      );
      sonar(resultado.acierto ? 'acierto' : 'fallo');
    },
    [anotar, indice, puerta],
  );

  /*
    El reloj de la puerta.

    Un solo `requestAnimationFrame` lleva las dos cosas —cuánto queda y cuándo
    se acabó— para que no puedan desincronizarse. El rato se mide con
    `performance.now()` DENTRO del latido y no con el sello de tiempo que trae
    `requestAnimationFrame`: no es lo mismo, el sello del fotograma va en el
    reloj del documento y `performance.now()` en el del proceso, y restar uno
    del otro da un número sin sentido. En esta casa ya se vio el fallo, con una
    barra que se quedaba llena para siempre.

    Y el estado solo cambia cuando cambia el SEGUNDO ENTERO, que es lo que hace
    que esto no sea movimiento. Sesenta repintados por segundo de un número que
    baja serían exactamente lo que aquí no puede haber.
  */
  useEffect(() => {
    if (!puerta || resuelta || seAcabo) return;

    const total = ventanaDe(puerta, ronda, paso);
    const inicio = performance.now();
    let cuadro = 0;
    let ultimo = Number.POSITIVE_INFINITY;

    const latido = () => {
      const transcurrido = performance.now() - inicio;

      if (transcurrido >= total) {
        setSegundos(0);
        responder(NO_CRUZO);
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
  }, [puerta, resuelta, seAcabo, ronda, paso, responder]);

  /** La pausa que enseña: corta si se acertó, larga si hay regla que leer. */
  useEffect(() => {
    if (!resuelta || seAcabo) return;
    const reloj = window.setTimeout(
      () => {
        setResuelta(null);
        setIndice((n) => n + 1);
      },
      resuelta.acierto ? PAUSA.acierto : PAUSA.fallo,
    );
    return () => window.clearTimeout(reloj);
  }, [resuelta, seAcabo]);

  useEffect(() => {
    if (seAcabo) terminar();
  }, [seAcabo, terminar]);

  /*
    Las teclas, que aquí faltaban.

    La cabecera de esta pantalla llevaba escrito «Teclas 1, 2 y 3» desde el
    principio y no había nadie escuchándolas: los portales eran botones, así que
    se llegaba a ellos tabulando y pulsando intro, pero el dígito no hacía nada.
    Con las puertas dobles el número de opciones pasa a ser tres o seis, así que
    el atajo tenía que existir de verdad y tenía que contar hasta donde haga
    falta. La pista de la cabecera ahora sale del número de opciones y no de una
    cadena escrita a mano, que es lo que dejó que se desincronizaran.
  */
  useEffect(() => {
    if (!puerta || resuelta || seAcabo) return;

    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
      const numero = Number(evento.key);
      const elegida = opcionesDeLaPuerta(puerta)[numero - 1];
      if (!elegida) return;
      evento.preventDefault();
      responder(elegida.texto);
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [puerta, resuelta, seAcabo, responder]);

  if (!puerta) return <Cerrando onSalir={onSalir} />;

  const partes = puerta.frase.split(/_{3}/);
  const multiplicador = multiplicadorDe(racha, ronda.cazador.tramosDeCombo);
  const opciones = opcionesDeLaPuerta(puerta);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-3">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
            Puerta {indice + 1} de {puertas.length}
          </p>
          <Combo multiplicador={multiplicador} pista={`Teclas 1 a ${opciones.length}`} />
        </div>
        {/*
          Los segundos se quedan CONGELADOS en lo que quedaba al contestar, no a
          cero. Ponerlos a cero decía que se había acabado el tiempo cuando lo
          que había pasado es lo contrario: se había contestado con dos segundos
          de sobra, que es justo lo que apetece ver.
        */}
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
      <Mapa
        puertas={puertas.length}
        van={indice}
        ventaja={ventaja}
        maxima={ronda.cazador.ventajaMaxima}
      />{' '}
      {/* prettier-ignore */}
      <div className="mt-4 shrink-0 rounded-xl border-2 border-violet-200 bg-[var(--superficie)] px-3 py-3 dark:border-violet-900">
        <p lang="en" className="text-center text-xl font-extrabold leading-snug">
          {partes[0]}
          <span
            className={cn(
              'mx-0.5 inline-block min-w-16 rounded-md border-b-4 px-1',
              resuelta && !resuelta.acierto
                ? 'border-emerald-500 bg-emerald-50 text-[var(--texto-acierto)] dark:bg-emerald-950/60'
                : 'border-violet-400 bg-violet-50 dark:bg-violet-950/60',
            )}
          >
            {resuelta && !resuelta.acierto ? puerta.correcta : ' '}
          </span>
          {partes.slice(1).join('')}
        </p>

        {resuelta && !resuelta.acierto && (
          <p className="mt-1.5 text-center text-xs font-bold leading-snug text-[var(--texto-fallo)]">
            {puerta.ensena}
          </p>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-[var(--texto-suave)]">
        {puerta.altas
          ? 'Elige la forma que completa la frase. Con teclado, del 1 al 6.'
          : 'Elige el portal que completa la frase. Con teclado, del 1 al 3.'}
      </p>
      {/*
        LA PUERTA DOBLE AQUÍ NO SE SALTA: SE ELIGE. Y NO ES UNA VERSIÓN CAPADA.

        Lo que la puerta doble pregunta son dos cosas —qué palabra y qué forma—,
        y eso es lo que tiene que seguir preguntando. Lo que NO puede seguir
        siendo es el salto, porque quien pidió menos movimiento no puede tener
        un gesto que depende de un arco animado y de acertarle a una ventana de
        520 ms.

        Así que las seis formas salen como seis botones en dos grupos
        etiquetados con los mismos `ejes` que en la pista. Se pierde el gesto y
        se conserva la pregunta entera, que es el reparto correcto: el gesto era
        la FORMA de contestar, no la pregunta.

        El reloj es el mismo que calculó el servidor, `gestoMs` incluido. Ese
        sumando aquí sobra —no hay gesto que hacer— y se deja a propósito: es
        medio segundo de regalo en la pantalla accesible, y ya está escrito
        abajo por qué ese es el lado correcto por el que equivocarse.
      */}
      {/*
        Y LAS SEIS VAN EN DOS COLUMNAS, no en una lista de seis.

        Es la corrección que pidió la captura de 320×568: en una columna, la
        sexta forma caía por debajo del borde y había que DESPLAZARSE con el
        reloj corriendo. Leer seis opciones ya es lo caro de esta puerta;
        buscarlas fuera de la pantalla es cobrar un tiempo que el servidor no
        dio.

        Y de paso se lee mejor, que es la parte que importa: dos columnas con
        el nombre de su eje encima son la rejilla que la puerta doble pregunta
        —tres palabras por dos formas—, y eso en la pista lo dice la altura. El
        orden de las teclas se conserva porque la rejilla se llena POR
        COLUMNAS: del 1 al 3 la fila de arriba y del 4 al 6 la de abajo, igual
        que las lee un lector de pantalla.
      */}
      {puerta.ejes && (
        <p
          aria-hidden
          className="mt-2 grid grid-cols-2 gap-2 text-center text-[11px] font-bold text-[var(--texto-suave)]"
        >
          <span>{puerta.ejes.arriba}</span>
          <span>{puerta.ejes.abajo}</span>
        </p>
      )}
      <ul
        className={cn('mt-2 grid gap-2', puerta.ejes && 'grid-flow-col grid-cols-2 grid-rows-3')}
        aria-label="Portales"
      >
        {opciones.map(({ texto, fila }, numero) => (
          <li key={texto}>
            <button
              type="button"
              disabled={Boolean(resuelta)}
              onClick={() => responder(texto)}
              lang="en"
              /*
                El nombre va en `aria-label` y no armado con trozos de dentro.

                Armado con trozos —un `sr-only` con «Portal 1», el texto y otro
                `sr-only` con la fila— el navegador los junta con los espacios
                que le parecen y sale «Portal 1: went , pasado». Con una sola
                etiqueta se oye lo que se quiso escribir.
              */
              aria-label={`Portal ${numero + 1}: ${texto}${fila ? `, ${fila}` : ''}`}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border-2 px-2 text-center font-extrabold',
                // Dos columnas aprietan el ancho, así que la letra baja un
                // punto y el alto se queda en el objetivo táctil de 48 px. En
                // una sola columna se queda como estaba.
                puerta.ejes ? 'min-h-12 text-base' : 'min-h-14 px-3 text-lg',
                resuelta && texto === puerta.correcta
                  ? 'border-emerald-600 bg-emerald-50 text-[var(--texto-acierto)] dark:bg-emerald-950/50'
                  : resuelta?.cruzado === texto
                    ? 'border-red-500 bg-red-50 text-[var(--texto-fallo)] dark:bg-red-950/50'
                    : 'border-violet-400 bg-[var(--superficie)] dark:border-violet-600',
              )}
            >
              {/*
                El número se ve y además se dice, dentro del `aria-label`: el
                dígito pintado es el atajo de teclado, y para quien no ve la
                pantalla el nombre del botón empieza por «Portal 1», que es lo
                que hace que la tecla 1 signifique algo también ahí.

                Y LA FILA SE DICE Y NO SE PINTA. Pintarla en cada botón era
                repetir seis veces lo que ya dice el encabezado de su columna, y
                con seis opciones en pantalla esa repetición es ruido justo
                donde hay que leer deprisa. Pero quitarla del todo dejaba a
                quien no ve la pantalla con «Portal 1: Are» y sin saber qué
                afirma al elegirla —el encabezado va `aria-hidden` porque ahí
                arriba son dos palabras sueltas sin sujeto—.
              */}
              <span aria-hidden className="text-xs font-black text-[var(--texto-suave)]">
                {numero + 1}
              </span>
              <span aria-hidden>{texto}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex min-h-8 flex-1 items-start justify-center">
        <Racha racha={racha} />
      </div>
    </div>
  );
}

/**
 * Las opciones de una puerta como lista, para la pantalla sin movimiento.
 *
 * El orden es el que importa: primero la fila de ARRIBA entera y después la de
 * abajo, y no carril por carril alternando filas. Con seis botones en una
 * columna, agrupar por fila es lo que deja leerlos como lo que son —tres
 * pasados y tres presentes— y lo que hace que la etiqueta de `ejes` de encima
 * signifique algo. Alternando, la lista sería seis palabras sueltas.
 *
 * La etiqueta de fila viaja con cada opción porque el botón la enseña entre
 * paréntesis: en la pista esa información la daba la altura, y aquí no hay
 * altura que dar.
 */
function opcionesDeLaPuerta(
  puerta: PuertaDeCarrera,
): Array<{ texto: string; fila: string | null }> {
  if (!puerta.altas || !puerta.ejes) {
    return puerta.opciones.map((texto) => ({ texto, fila: null }));
  }

  return [
    ...puerta.altas.map((texto) => ({ texto, fila: puerta.ejes!.arriba })),
    ...puerta.opciones.map((texto) => ({ texto, fila: puerta.ejes!.abajo })),
  ];
}

/**
 * El mapa de la carrera: dónde va Milo y dónde va la sombra.
 *
 * Es lo que hace que esto siga siendo una carrera sin que nada se deslice. Las
 * dos fichas cambian de casilla cuando se resuelve una puerta, o sea catorce
 * veces en toda la partida, y un salto de posición no es una animación.
 *
 * La sombra va tantas casillas por detrás como ventaja quede. No es exacto —la
 * ventaja es una barra de cien y aquí hay catorce casillas— pero es lo que hay
 * que entender de un vistazo: si la sombra está pegada, el próximo fallo es el
 * último.
 */
function Mapa({
  puertas,
  van,
  ventaja,
  maxima,
}: {
  puertas: number;
  van: number;
  ventaja: number;
  maxima: number;
}) {
  const casillas = useMemo(() => Array.from({ length: puertas }, (_, i) => i), [puertas]);
  const hueco = Math.max(1, Math.round((ventaja / maxima) * 4));
  const sombra = van - hueco;

  return (
    <div className="mt-3">
      <ul aria-hidden className="flex items-center justify-between gap-0.5">
        {casillas.map((casilla) => (
          <li
            key={casilla}
            className={cn(
              'flex h-6 flex-1 items-center justify-center rounded text-sm',
              casilla === van
                ? 'bg-violet-200 dark:bg-violet-800'
                : casilla === sombra
                  ? 'bg-slate-300 dark:bg-slate-700'
                  : casilla < van
                    ? 'bg-violet-100 dark:bg-violet-950'
                    : 'bg-[var(--superficie)]',
            )}
          >
            {casilla === van ? '🦉' : casilla === sombra ? '🌑' : ''}
          </li>
        ))}
      </ul>
      <p className="sr-only">
        Milo va por la puerta {van + 1} de {puertas}. Le saca {Math.round((ventaja / maxima) * 100)}{' '}
        por ciento de ventaja a la sombra.
      </p>
    </div>
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
