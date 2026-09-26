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
 * en setenta y cinco segundos.
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

/** El ritmo de las rayas del asfalto y del trote, del más lento al más rápido. */
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

/** La ventana de esta puerta: leerla, mirarla y decidirla. */
function ventanaDe(puerta: PuertaDeCarrera, ronda: RondaDeCarrera, paso: number): number {
  const escalones = ronda.reloj.escalones;
  const reflejo = escalones[Math.min(Math.max(paso, 0), escalones.length - 1)] ?? escalones[0] ?? 0;
  return puerta.lecturaMs + puerta.portalesMs + reflejo;
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

    const cruzado = viva.puerta.opciones[carrilVivo.current] ?? NO_CRUZO;
    const resultado = anotar(viva.puerta, cruzado);

    setResuelta({ ...resultado, marca: viva.marca, puerta: viva.puerta, cruzado });

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
      setAviso(`Era ${viva.puerta.correcta}. ${viva.puerta.ensena}`);
      sonar('fallo');
      setGolpe({ id: viva.marca, senal: 'fallo' });
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

      const numero = Number(evento.key);
      if (numero >= 1 && numero <= 3) {
        evento.preventDefault();
        cambiarCarril(numero - 1);
      }
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [cambiarCarril]);

  /** El final: un momento para ver la última puerta y se cierra. */
  useEffect(() => {
    if (!acabando) return;
    sonar('fin');
    const reloj = window.setTimeout(terminar, FINAL);
    return () => window.clearTimeout(reloj);
  }, [acabando, terminar]);

  useEffect(() => {
    const todos = relojes.current;
    return () => todos.forEach((reloj) => window.clearTimeout(reloj));
  }, []);

  const { ventaja, racha, paso } = partida.estado;
  const cazador = ronda.cazador;
  const cercania = 1 - Math.min(ventaja / cazador.ventajaMaxima, 1);
  const multiplicador = multiplicadorDe(racha, cazador.tramosDeCombo);
  const ritmo = ritmoDe(ronda, paso);

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
          <Combo multiplicador={multiplicador} pista="Flechas o 1-2-3 para cambiar de carril" />
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
      <Banda puerta={enPista?.puerta ?? null} resuelta={resuelta} />

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
        <Cazador cercania={cercania} />

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
          gesto={resuelta ? (resuelta.acierto ? 'impulso' : 'frenazo') : null}
          marca={resuelta?.marca ?? -1}
          parado={acabando}
        />

        {/*
          Las tres zonas de toque ocupan la pista entera, y los portales van sin
          `pointer-events`. Así se toca DONDE se quiere ir en vez de tener que
          acertarle a un portal que se mueve y que además es pequeño cuando
          todavía está lejos, que es justo cuando ya se sabe la respuesta.
        */}
        <ul className="absolute inset-0 grid grid-cols-3" aria-label="Carriles">
          {CARRILES.map((numero) => (
            <li key={numero} className="contents">
              <button
                type="button"
                onPointerDown={() => cambiarCarril(numero)}
                disabled={acabando}
                aria-label={`Carril ${numero + 1}${
                  enPista ? `: ${enPista.puerta.opciones[numero] ?? ''}` : ''
                }`}
                className="h-full w-full focus-visible:bg-violet-500/10"
              />
            </li>
          ))}
        </ul>

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
            ventanaMs={enPista.ventanaMs}
            apuntado={carril === numero}
            estado={
              !resuelta
                ? 'abierto'
                : opcion === resuelta.puerta.correcta
                  ? 'buena'
                  : opcion === resuelta.cruzado
                    ? 'mala'
                    : 'abierto'
            }
            corriendo={corriendo}
            premio={resuelta?.acierto && opcion === resuelta.cruzado ? resuelta.suma : null}
          />
        </div>
      ))}
    </>
  );
}

function Portal({
  texto,
  ventanaMs,
  apuntado,
  estado,
  corriendo,
  premio,
}: {
  texto: string;
  ventanaMs: number;
  apuntado: boolean;
  estado: 'abierto' | 'buena' | 'mala';
  corriendo: boolean;
  premio: number | null;
}) {
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
            96 px de alto y el texto CENTRADO, no pegado abajo.

            Al cruzar, Milo se planta encima del portal —es lo que pasa, ha
            corrido hasta él— y con el texto en el borde inferior le tapaba
            justamente la palabra que se acababa de elegir. Se ve en las
            capturas del primer intento: el portal rojo salía sin su opción.
            Subiéndola al centro del arco queda por encima de la cabeza de Milo
            y se puede comparar con la buena, que es lo que hay que hacer ahí.
          */
          'flex h-[96px] w-full flex-col items-center justify-center rounded-t-[42%] border-[3px] border-b-0 pb-1 shadow-lg',
          estado === 'buena' && 'border-emerald-500 bg-emerald-100/90 dark:bg-emerald-900/80',
          estado === 'mala' && 'border-red-500 bg-red-100/90 dark:bg-red-950/80',
          estado === 'abierto' &&
            (apuntado
              ? 'border-violet-500 bg-violet-200/90 ring-4 ring-violet-400/50 dark:border-violet-300 dark:bg-violet-800/80'
              : 'border-violet-400/70 bg-[var(--superficie)]/85 dark:border-violet-600'),
        )}
      >
        <span
          lang="en"
          className={cn(
            'block w-full break-words px-0.5 text-center font-extrabold leading-tight',
            tamanoDe(texto),
          )}
        >
          {texto}
        </span>
      </div>

      {premio !== null && (
        <span
          className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white shadow"
          style={{ animation: 'carrera-premio 900ms ease-out forwards' }}
        >
          +{premio}
        </span>
      )}
    </div>
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
  marca,
  parado,
}: {
  carril: number;
  gesto: 'impulso' | 'frenazo' | null;
  marca: number;
  parado: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 w-[30%] -ml-[15%] transition-transform duration-150 ease-out"
      style={{
        /*
          Milo va un poco por DEBAJO del plano al que llegan las puertas (60 %
          contra 72 %), y esos doce puntos son a propósito: el arco mide 96 px,
          así que su mitad inferior cae justo sobre Milo y el portal se cruza de
          verdad en vez de pararse delante. Si los dos planos fueran el mismo,
          el portal aparecería colgado por encima de la cabeza.
        */
        top: 'calc(var(--carrera-alto, 300px) * 0.72)',
        transform: `translateX(${(carril - 1) * 100}%)`,
      }}
    >
      <div
        key={marca}
        style={
          gesto
            ? {
                animation: `carrera-${gesto} ${gesto === 'impulso' ? 520 : 620}ms ease-out`,
              }
            : undefined
        }
      >
        <div
          className="flex justify-center"
          style={{
            animation: `carrera-trote var(--carrera-ritmo, 620ms) ease-in-out infinite`,
            animationPlayState: parado ? 'paused' : 'running',
          }}
        >
          <Mascota
            estado={gesto === 'impulso' ? 'celebrando' : gesto === 'frenazo' ? 'sorprendido' : 'feliz'} // prettier-ignore
            tamano={78}
          />
        </div>
      </div>
      <span className="sr-only">Milo va por el carril {carril + 1}</span>
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
 * Se mueve con una transición y no con una animación porque solo cambia cuando
 * se resuelve una puerta: catorce veces en toda la carrera.
 */
function Cazador({ cercania }: { cercania: number }) {
  const escala = 0.34 + cercania * 0.78;
  const avance = 0.02 + cercania * 0.5;

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 block w-[26%] -translate-x-1/2 transition-all duration-700 ease-out"
      style={{
        transform: `translate3d(-50%, calc(var(--carrera-alto, 300px) * ${avance}), 0) scale(${escala})`,
        opacity: 0.35 + cercania * 0.65,
      }}
    >
      <svg viewBox="0 0 60 60" className="w-full drop-shadow-lg">
        {/*
          Una silueta y no un monstruo dibujado: lo que asusta de algo que
          persigue es no verle la cara. Y de paso pesa cuatro trazos, que en una
          pantalla que ya mueve tres portales es lo que hay que gastar aquí.
        */}
        <path
          d="M30 6c-9 0-16 7-16 16 0 5 2 9 5 12-6 4-10 11-10 19v5h42v-5c0-8-4-15-10-19 3-3 5-7 5-12 0-9-7-16-16-16z"
          className="fill-slate-800 dark:fill-black"
        />
        <circle cx="23" cy="21" r="3.2" className="fill-red-500" />
        <circle cx="37" cy="21" r="3.2" className="fill-red-500" />
      </svg>
    </span>
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

  if (!puerta) return <Cerrando onSalir={onSalir} />;

  const partes = puerta.frase.split(/_{3}/);
  const multiplicador = multiplicadorDe(racha, ronda.cazador.tramosDeCombo);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-3">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
            Puerta {indice + 1} de {puertas.length}
          </p>
          <Combo multiplicador={multiplicador} pista="Teclas 1, 2 y 3" />
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
        Elige el portal que completa la frase. Con teclado, del 1 al 3.
      </p>
      <ul className="mt-2 grid gap-2" aria-label="Portales">
        {puerta.opciones.map((opcion, numero) => (
          <li key={opcion}>
            <button
              type="button"
              disabled={Boolean(resuelta)}
              onClick={() => responder(opcion)}
              lang="en"
              className={cn(
                'flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 px-3 text-center text-lg font-extrabold',
                resuelta && opcion === puerta.correcta
                  ? 'border-emerald-600 bg-emerald-50 text-[var(--texto-acierto)] dark:bg-emerald-950/50'
                  : resuelta?.cruzado === opcion
                    ? 'border-red-500 bg-red-50 text-[var(--texto-fallo)] dark:bg-red-950/50'
                    : 'border-violet-400 bg-[var(--superficie)] dark:border-violet-600',
              )}
            >
              {/*
                El número se ve Y se dice. El dígito pintado es el atajo de
                teclado, y para quien no ve la pantalla el nombre del botón
                empieza por «Portal 1», que es lo que hace que la tecla 1
                signifique algo también ahí.
              */}
              <span aria-hidden className="text-xs font-black text-[var(--texto-suave)]">
                {numero + 1}
              </span>
              <span className="sr-only">Portal {numero + 1}: </span>
              {opcion}
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
