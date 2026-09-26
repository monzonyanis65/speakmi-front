import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Mascota, MascotaConMensaje } from '@/components/Mascota';
import { decir, hayVoz, hayVozInglesa, vozInglesaYa } from '@/lib/voz';
import { useMenosMovimiento } from '@/lib/movimiento';
import { abrirCanal, contextoDeAudio, despertarSonido, golpe } from '@/lib/sonido';
import { Aviso, CabeceraJuego, Contador, Racha } from './Tablero';
import { Destello, PuntosGanados } from './efectos';
import { puntosDelServidor } from './puntos';
import type { GrupoDeBeat, Marcador, NotaDeBeat, RespuestaCorregida, RondaDeBeat } from './tipos';

/**
 * AL COMPÁS: caen notas por una pista y hay que mandarlas a su pastilla EN EL
 * PULSO. Es el único juego de la casa en el que llegar pronto está tan mal como
 * llegar tarde.
 *
 *
 * EL PROBLEMA DE VERDAD DE ESTE JUEGO: DOS RELOJES QUE NO SON EL MISMO
 *
 * Un juego de ritmo que va medio compás desfasado no es difícil, es
 * insoportable, y aquí hay tres cosas que tienen que ocurrir en el mismo
 * instante: que suene el bombo, que la nota toque la línea y que se abra la
 * ventana de acierto. Si las tres se miden con relojes distintos, se separan.
 *
 * En esta casa ya pasó. En LA PARTÍCULA se mezcló el sello de tiempo que trae
 * `requestAnimationFrame` con `performance.now()`, que van en relojes
 * distintos, y el reloj del juego se quedaba congelado. Está contado en
 * `Particulas.tsx`.
 *
 * Aquí la regla es más dura que «no mezclar»: HAY UN SOLO RELOJ, se elige al
 * empezar la partida y todo lo demás se mide contra él. Se llama `reloj` y está
 * más abajo. El sello que trae `requestAnimationFrame` NO SE USA para nada —ni
 * siquiera se recoge el argumento— y `performance.now()` no aparece en ninguna
 * cuenta del juego salvo dentro del propio reloj cuando no hay audio.
 *
 * Y el reloj que se elige primero es el del AUDIO, `AudioContext.currentTime`,
 * no el del sistema. El motivo es que `setTimeout` y `requestAnimationFrame` no
 * sirven para programar sonido: avisan «cuando el navegador pueda», que en un
 * móvil con la batería baja son decenas de milisegundos tarde, y un bombo 30 ms
 * tarde se OYE. La Web Audio API programa en su propio hilo con
 * `oscillator.start(t)`, así que la canción suena exacta pase lo que pase con
 * los fotogramas. Medir el juego contra ese mismo reloj es lo que hace que la
 * ventana de acierto caiga donde cae el bombo.
 *
 *
 * Y LA LATENCIA DE SALIDA, QUE ES LA PARTE QUE SE OLVIDA
 *
 * `currentTime` no es el instante en el que se OYE algo: es el instante en el
 * que la tarjeta de sonido lo recibe. Entre eso y el altavoz hay un buffer, que
 * el navegador publica en `outputLatency` y que en un portátil ronda los 20 ms
 * y con auriculares por Bluetooth pasa de 150. O sea que un bombo programado
 * para el segundo 10 se oye en el 10,02 o en el 10,15.
 *
 * Si la ventana de acierto se centrara en el segundo 10, quien pulsa justo
 * cuando lo oye llegaría sistemáticamente tarde, y el juego le diría que no
 * tiene ritmo cuando lo tiene. Por eso todo el juego —la ventana, la caída, el
 * dibujo— se mide contra `objetivo = tProgramado + outputLatency`, que es el
 * instante en el que la nota se oye de verdad. Lo único que usa el tiempo sin
 * corregir es la llamada a `oscillator.start`.
 *
 *
 * QUÉ PASA SIN AUDIO, QUE ES MÁS FRECUENTE DE LO QUE PARECE
 *
 * No hay contexto de audio si el sonido está apagado, si todavía no hubo gesto
 * o si esta persona pidió `prefers-reduced-motion` —en esta casa eso también
 * apaga el sonido, y está razonado en `sonido.ts`—. Entonces el reloj es el del
 * sistema y el compás se lleva con la vista: la pista enseña una cuenta atrás
 * en pulsos y la ventana se abre igual. Es el mismo juego sin oírlo.
 *
 *
 * POR QUÉ NO HAY NI UN BYTE DE MÚSICA
 *
 * Porque esta casa ya sabe hacer sonido sin ficheros: todo lo que suena en la
 * aplicación son osciladores y envolventes, cero bytes (ver `sonido.ts`). Un
 * mp3 de un minuto son unos 900 KB que una PWA se descarga ENTERA la primera
 * vez, y además habría que resolver de dónde sale su licencia. El bombo, la
 * caja y el charles se fabrican con un oscilador que cae de 150 a 45 hercios y
 * con medio segundo de ruido blanco generado en memoria. Suena a caja de ritmos
 * porque es literalmente cómo se hacía una caja de ritmos, y pesa lo que pesa
 * este archivo.
 */

/** Cómo se le dice al servidor que la nota pasó de largo. Copia de `beat.ts`. */
const SE_ESCAPO = 'nada';

/**
 * Dónde está la línea de impacto dentro de la pista, de 0 a 1.
 *
 * No al final del todo: una nota centrada en el borde de abajo se metería
 * debajo de las pastillas justo en el instante en el que hay que mirarla.
 */
const LINEA = 0.86;

/** Hasta dónde sigue bajando una nota que ya pasó, antes de desaparecer. */
const PASADO = 1.2;

/**
 * Cuánta música se programa por delante: cuatro décimas.
 *
 * Es el patrón clásico de programar audio en la web (Chris Wilson, «A Tale of
 * Two Clocks»): un bucle frecuente que mira un poco hacia delante y encarga al
 * hilo de audio todo lo que cae en esa ventana. Aquí el bucle es el mismo
 * `requestAnimationFrame` que dibuja, que corre cada 16 ms, así que 400 ms de
 * adelanto son veinticinco oportunidades de programar cada golpe: aunque se
 * pierdan veinte fotogramas seguidos, el bombo sale en su sitio.
 *
 * Y no más adelanto: lo ya programado no se puede cancelar sin cortarlo a lo
 * bruto, así que al salir de la partida se oiría lo que quedara en la cola. Con
 * 400 ms el canal se calla antes de que llegue a sonar.
 */
const ADELANTO = 0.4;

/** Cuántas notas se pintan a la vez. Con 2,4 s de caída nunca hay más de tres. */
const NOTAS_EN_PANTALLA = 4;

/** De tecla a número de pastilla: la mano derecha en reposo, y los números. */
const TECLAS: Record<string, number> = { j: 0, k: 1, l: 2, '1': 0, '2': 1, '3': 2 };

type Compas = 'frase' | 'oido';
type Fase = 'eligiendo' | 'tocando';
type Juicio = 'perfecto' | 'bien' | 'fallo' | 'escapada';

/** Una nota colocada en el tiempo, tal y como la usa el bucle. */
interface NotaEnElTiempo {
  nota: NotaDeBeat;
  grupo: GrupoDeBeat;
  /** Cuál de las tres del grupo es. Se pinta en el compás de oído. */
  orden: number;
  /** El instante EN EL QUE SE OYE, ya con la latencia de salida sumada. */
  objetivo: number;
  resuelta: boolean;
}

/** Lo último que pasó, para el destello y el «+N» flotante. */
interface Golpe {
  juicio: Juicio;
  suma: number;
  vez: number;
}

/**
 * Lo que se apunta para poder medir el desfase de verdad.
 *
 * Solo en desarrollo: `import.meta.env.DEV` es una constante que Vite sustituye
 * al compilar, así que en producción todo este bloque desaparece del paquete.
 * Existe porque «va sincronizado» no es una afirmación que se pueda hacer
 * mirando: hay que apuntar en qué instante tenía que sonar cada nota y en qué
 * instante se abrió su ventana, y restar.
 */
interface MedidasDelCompas {
  reloj: 'audio' | 'sistema';
  /** Lo que dice el navegador que tarda el sonido en salir, en milisegundos. */
  latenciaSalidaMs: number;
  /** El reloj del juego, para que quien mida pueda preguntar la hora igual. */
  ahora: () => number;
  /** Los dos relojes en el instante de empezar, para medir cuánto se separan. */
  relojAlEmpezar: number;
  sistemaAlEmpezar: number;
  notas: Array<{
    id: string;
    /** El instante en el que la nota tiene que oírse. */
    objetivo: number;
    /** Y aquel en el que el juego abrió su ventana. */
    apertura: number | null;
    /** Lo que marcaba el reloj del SISTEMA en ese mismo instante. */
    sistema: number | null;
    /** Lo que tardó el juego en enterarse, respecto al instante teórico. */
    desfaseMs: number | null;
    /** Con cuántos milisegundos de error se pulsó, si se pulsó. */
    errorMs: number | null;
  }>;
  /** Los milisegundos de cada fotograma, para sacar los cuadros por segundo. */
  fotogramas: number[];
}

declare global {
  interface Window {
    __compas?: MedidasDelCompas;
  }
}

export function Beat({
  ronda,
  onResponder,
  onFin,
  onSalir,
  onAjustes,
}: {
  ronda: RondaDeBeat;
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
  onAjustes: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();

  const [fase, setFase] = useState<Fase>('eligiendo');
  const [voz, setVoz] = useState<'comprobando' | 'si' | 'no'>(() => {
    const ya = vozInglesaYa();
    return ya === 'todavia-no-se' ? 'comprobando' : ya;
  });

  const [aciertos, setAciertos] = useState(0);
  const [contestadas, setContestadas] = useState(0);
  const [racha, setRacha] = useState(0);
  /*
    La racha viva se rompe al fallar; la que PAGA es la más larga de la partida.
    Se guarda aparte para que el marcador en vivo enseñe lo mismo que va a
    cerrar el servidor: un número que baja al fallar y luego no cuadra con el
    final es justo lo que hace que un juego se sienta trucado.
  */
  const [rachaMaxima, setRachaMaxima] = useState(0);

  /** El índice de la primera nota sin resolver: manda lo que se pinta. */
  const [desde, setDesde] = useState(0);
  /** Qué nota tiene la ventana abierta ahora mismo, si alguna. */
  const [abierta, setAbierta] = useState<string | null>(null);
  /** En qué pulso de la canción vamos. Es lo que hace que Milo lleve el ritmo. */
  const [pulso, setPulso] = useState(-1);
  const [ultimo, setUltimo] = useState<Golpe | null>(null);

  /** La misma cuenta que hará el servidor al cerrar. Ver `puntos.ts`. */
  const puntuacion = puntosDelServidor('BEAT', aciertos, rachaMaxima);
  const enFiebre = racha >= ronda.compas.rachaDeFiebre;

  /*
    Lo que va a sumar la nota siguiente, con la fórmula del servidor.

    Y de aquí sale el multiplicador que se enseña en la fiebre, que es el sitio
    donde este juego se podía haber vuelto un timo. Lo que paga el servidor es
    `aciertos * 10 + racha² * 2`, así que encadenar YA multiplica: con veinte
    seguidas la nota siguiente vale 88 puntos en vez de 10. El multiplicador que
    sale en pantalla es ese número dividido por diez, ni uno más. No hay ningún
    «×2 de fiebre» inventado aquí encima, porque el servidor no lo pagaría y el
    marcador final no cuadraría con el que se acaba de ver subir. Aquí ya hubo
    un juego que enseñaba puntos que el servidor no pagaba.
  */
  const multiplicador = Math.max(
    1,
    Math.round(
      (puntosDelServidor('BEAT', aciertos + 1, Math.max(rachaMaxima, racha + 1)) - puntuacion) / 10,
    ),
  );

  useEffect(() => {
    if (voz !== 'comprobando') return;
    let vivo = true;
    void hayVozInglesa().then((hay) => {
      if (vivo) setVoz(hay ? 'si' : 'no');
    });
    return () => {
      vivo = false;
    };
  }, [voz]);

  /*
    Las respuestas se mandan en fila india y no se esperan para seguir tocando.

    Es lo mismo que hacen CAEN y PARTICULAS: la ronda llegó con la pastilla
    buena dentro, así que el navegador ya sabe si acertó, y parar el juego a
    esperar al servidor sería parar la canción. Pero la partida NO se cierra
    hasta que ha llegado la última: si el `/fin` adelantara a las respuestas, la
    puntuación final saldría por debajo de la que se acaba de ver subir.
  */
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const avisar = useCallback(
    (notaId: string, respuesta: string) => {
      cola.current = cola.current.then(() =>
        // Un reintento y ya. Si la red está caída, lo que no puede pasar es que
        // la canción se pare.
        onResponder(notaId, respuesta).catch(() =>
          onResponder(notaId, respuesta).catch(() => null),
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

  /* ──────────────────────────  EL MOTOR  ────────────────────────── */

  /** Las notas del compás elegido, colocadas en el tiempo. Las llena `empezar`. */
  const notas = useRef<NotaEnElTiempo[]>([]);
  /** Los envoltorios que se mueven, por identificador de nota. */
  const cuerpos = useRef(new Map<string, HTMLDivElement | null>());

  /**
   * EL RELOJ. Uno solo, y todo se mide contra él.
   *
   * Nace en `empezar` y devuelve segundos. Con audio es `currentTime`, que es
   * el mismo reloj con el que se programa cada bombo; sin audio es el del
   * sistema. Lo que no puede pasar nunca es que se pregunte a los dos, que es
   * exactamente el fallo que se comió el reloj de LA PARTÍCULA.
   */
  const reloj = useRef<() => number>(() => 0);
  /** El canal por el que sale la música, para poder callarlo de golpe. */
  const canal = useRef<GainNode | null>(null);
  /** El instante del pulso cero, en el reloj de arriba. */
  const cero = useRef(0);
  /** Lo que tarda el sonido en llegar al altavoz, en segundos. */
  const latencia = useRef(0);
  /** El siguiente pulso al que hay que ponerle música. */
  const porProgramar = useRef(0);
  /** La siguiente nota que puede recibir una pulsación. */
  const porResolver = useRef(0);
  /** Y la siguiente que tiene que decir su palabra en voz alta. */
  const porDecir = useRef(0);

  /*
    El marcador, ADEMÁS de en el estado, en una referencia.

    No es duplicar por gusto. Una nota se puede resolver desde el bucle —porque
    se escapó— y otra desde un `keydown` en el mismo fotograma, y entre las dos
    no ha habido ningún render: la segunda leería una racha vieja y la cuenta
    se iría. Con la referencia, las dos leen lo que acaba de pasar y el estado
    solo sirve para pintar.
  */
  const cuenta = useRef({ aciertos: 0, contestadas: 0, racha: 0, rachaMaxima: 0 });

  /** En qué instante se oye el pulso `n`. */
  const instanteDelPulso = useCallback(
    (n: number) => cero.current + (n * ronda.compas.msPorPulso) / 1000 + latencia.current,
    [ronda.compas.msPorPulso],
  );

  /**
   * Resuelve una nota: cuenta el punto, avisa al servidor y hace el ruido.
   *
   * Es el único sitio donde se toca el marcador, y está entero aquí en vez de
   * repartido entre el teclado y el bucle porque una nota puede resolverse
   * porque se pulsó o porque se escapó, y las dos cosas tienen que contar
   * exactamente igual. Si escaparse no contara, la racha del servidor no se
   * rompería jamás y el bono al cuadrado —que es el multiplicador de la
   * fiebre— pagaría una partida en la que se dejó pasar la mitad de las notas
   * sin tocar nada.
   */
  const resolver = useCallback(
    (viva: NotaEnElTiempo, respuesta: string, juicio: Juicio) => {
      if (viva.resuelta) return;
      viva.resuelta = true;

      const buena = juicio === 'perfecto' || juicio === 'bien';
      const antes = puntosDelServidor('BEAT', cuenta.current.aciertos, cuenta.current.rachaMaxima);

      cuenta.current.contestadas += 1;
      cuenta.current.racha = buena ? cuenta.current.racha + 1 : 0;
      cuenta.current.rachaMaxima = Math.max(cuenta.current.rachaMaxima, cuenta.current.racha);
      if (buena) cuenta.current.aciertos += 1;

      // Lo que suma ESTA nota: la misma fórmula del servidor antes y después.
      // No es una estimación, es la resta.
      const despues = puntosDelServidor(
        'BEAT',
        cuenta.current.aciertos,
        cuenta.current.rachaMaxima,
      );

      setAciertos(cuenta.current.aciertos);
      setContestadas(cuenta.current.contestadas);
      setRacha(cuenta.current.racha);
      setRachaMaxima(cuenta.current.rachaMaxima);
      setUltimo({ juicio, suma: despues - antes, vez: cuenta.current.contestadas });
      setDesde(porResolver.current);

      avisar(viva.nota.id, respuesta);

      const tocar = canal.current;
      if (tocar) {
        golpe(
          tocar,
          juicio === 'perfecto' ? 'perfecto' : buena ? 'nota' : 'perdida',
          reloj.current() + 0.01,
        );
      }
    },
    [avisar],
  );

  /**
   * Una pastilla pulsada.
   *
   * Lo que resuelve es la primera nota sin resolver, y solo si su ventana está
   * abierta. Que la resuelva SE ACIERTE O NO es lo que impide la trampa obvia
   * de un juego de tres teclas: aporrear J, K y L seguidas dentro de la ventana
   * para que una de las tres sea la buena. Con esto, la primera decide.
   *
   * Pulsar fuera de ventana no hace nada y no resta: en un juego de ritmo se
   * tantea el pulso, y castigar el tanteo solo enseña a no tocar.
   */
  const pulsar = useCallback(
    (pastillaId: string) => {
      const viva = notas.current[porResolver.current];
      if (!viva || viva.resuelta) return;

      const error = (reloj.current() - viva.objetivo) * 1000;
      if (Math.abs(error) > ronda.compas.msVentana) return;

      if (import.meta.env.DEV && window.__compas) {
        const apuntada = window.__compas.notas.find((fila) => fila.id === viva.nota.id);
        if (apuntada) apuntada.errorMs = Math.round(error);
      }

      porResolver.current += 1;
      const acierto = pastillaId === viva.nota.pastillaId;
      const perfecto = acierto && Math.abs(error) <= ronda.compas.msVentanaPerfecta;
      resolver(viva, pastillaId, perfecto ? 'perfecto' : acierto ? 'bien' : 'fallo');
    },
    [resolver, ronda.compas.msVentana, ronda.compas.msVentanaPerfecta],
  );

  /**
   * Empieza a tocar. Solo se llama desde un gesto, que es lo que despierta el
   * audio: el navegador no deja sonar nada hasta que la persona toca algo.
   */
  const empezar = useCallback(
    (elegido: Compas) => {
      despertarSonido();

      const ctx = contextoDeAudio();
      const salida = ctx ? ctx.outputLatency || ctx.baseLatency || 0 : 0;

      reloj.current = ctx ? () => ctx.currentTime : () => performance.now() / 1000;
      canal.current = abrirCanal();
      latencia.current = salida;
      // Un respiro antes del pulso cero: programar en el instante exacto se oye
      // como un chasquido, y además da tiempo a que se pinte la pista.
      cero.current = reloj.current() + 0.25;
      porProgramar.current = 0;
      porResolver.current = 0;
      porDecir.current = 0;
      cuenta.current = { aciertos: 0, contestadas: 0, racha: 0, rachaMaxima: 0 };

      const lista = elegido === 'frase' ? ronda.frase : ronda.oido;
      notas.current = lista.flatMap((grupo) =>
        grupo.notas.map((nota, orden) => ({
          nota,
          grupo,
          orden,
          objetivo: cero.current + (nota.pulso * ronda.compas.msPorPulso) / 1000 + salida,
          resuelta: false,
        })),
      );

      if (import.meta.env.DEV) {
        window.__compas = {
          reloj: ctx ? 'audio' : 'sistema',
          latenciaSalidaMs: Math.round(salida * 1000),
          ahora: () => reloj.current(),
          relojAlEmpezar: reloj.current(),
          sistemaAlEmpezar: performance.now() / 1000,
          notas: notas.current.map((viva) => ({
            id: viva.nota.id,
            objetivo: viva.objetivo,
            apertura: null,
            sistema: null,
            desfaseMs: null,
            errorMs: null,
          })),
          fotogramas: [],
        };
      }

      setDesde(0);
      setFase('tocando');
    },
    [ronda],
  );

  /*
    EL BUCLE. Uno solo, y hace las cinco cosas que tienen que ir juntas:
    programar la música, decir las palabras, mover las notas, abrir y cerrar las
    ventanas y dar por escapadas las que pasaron de largo.

    Van juntas a propósito. Repartidas en cinco temporizadores se
    desincronizarían, que es lo mismo que dice el bucle de LA PARTÍCULA cuando
    explica por qué la barra y el final van en el mismo sitio: un temporizador
    aparte que dispara el fin mientras la barra va por el 5 % es de las cosas
    que hacen que un juego se sienta injusto.

    Fíjate en que `latido` NO RECIBE ARGUMENTO. `requestAnimationFrame` le pasa
    un sello de tiempo y aquí se tira a propósito: ese sello va en un reloj que
    no tiene por qué ser el mismo que el del audio, y mezclarlos es exactamente
    el fallo que dejó congelado el reloj de LA PARTÍCULA.

    Y las notas se mueven escribiendo el `transform` directamente sobre el
    elemento, sin pasar por el estado de React. Sesenta renders por segundo con
    cuatro notas en pantalla es trabajo de sobra para que un móvil empiece a
    perder fotogramas, y lo que se pinta es siempre lo mismo moviéndose. Lo
    único que se toca es `transform`, que es lo que el navegador mueve sin
    volver a calcular la página.
  */
  useEffect(() => {
    if (fase !== 'tocando') return;

    const { msPorPulso, msDeAnticipacion, msVentana, rachaDeFiebre } = ronda.compas;

    /*
      Dónde acaba la canción, SACADO DE LAS NOTAS y no de `pulsosTotales`.

      `pulsosTotales` mide el compás más largo de los dos que trae la ronda, y
      los dos no tienen por qué durar lo mismo: si un nivel tuviera diez frases
      y solo seis tercias, quien jugara al de oído se quedaría veinte segundos
      mirando una pista vacía con el bombo sonando, esperando a que se acabara
      una canción que ya había terminado. Se cuenta desde la última nota que de
      verdad hay, más el aire de siempre.

      El aire son los cuatro pulsos de la anticipación, que es lo que tarda en
      caer una nota: no es un número inventado aquí, es el mismo rato que se ve
      venir la última, y deja que se lea el ✓ del grupo que se acaba de cerrar.
    */
    const ultima = notas.current[notas.current.length - 1];
    const aire = msDeAnticipacion / msPorPulso;
    const pulsosTotales = ultima ? ultima.nota.pulso + aire : 0;
    const anticipacion = msDeAnticipacion / 1000;
    const ventana = msVentana / 1000;

    let cuadro = 0;
    let ultimoPulso = -2;
    let ultimaAbierta: string | null = null;
    let fotogramaAnterior = 0;

    const latido = () => {
      const ahora = reloj.current();

      if (import.meta.env.DEV && window.__compas) {
        if (fotogramaAnterior) {
          window.__compas.fotogramas.push(Math.round((ahora - fotogramaAnterior) * 1000));
        }
        fotogramaAnterior = ahora;
      }

      /* 1. La música, encargada por delante al hilo de audio. */
      const tocar = canal.current;
      if (tocar) {
        while (
          porProgramar.current < pulsosTotales &&
          instanteDelPulso(porProgramar.current) < ahora + ADELANTO
        ) {
          const n = porProgramar.current;
          porProgramar.current += 1;
          // El instante SIN la latencia de salida: esto es lo único que se
          // programa de verdad, y el buffer de la tarjeta lo retrasará hasta el
          // objetivo contra el que se mide todo lo demás.
          const cuando = instanteDelPulso(n) - latencia.current;
          if (cuando <= ahora) continue;

          // 4/4 de toda la vida: bombo en el uno y el tres, caja en el dos y el
          // cuatro, charles en los cuatro. Es el patrón que el oído reconoce
          // como «compás» sin tener que aprender nada.
          golpe(tocar, n % 2 === 0 ? 'bombo' : 'caja', cuando);
          golpe(tocar, 'charles', cuando);
          // En fiebre el charles se dobla: sin cambiar el tempo, la canción se
          // siente el doble de rápida. Es el truco más viejo que hay.
          if (cuenta.current.racha >= rachaDeFiebre) {
            golpe(tocar, 'charles', cuando + msPorPulso / 2000);
          }
        }
      }

      /* 2. El pulso que se ve: es lo que hace que Milo lleve el compás. */
      const pulsoAhora = Math.floor(
        (ahora - cero.current - latencia.current) / (msPorPulso / 1000),
      );
      if (pulsoAhora !== ultimoPulso) {
        ultimoPulso = pulsoAhora;
        setPulso(pulsoAhora);
      }

      /* 3. Las palabras del compás de oído, dichas al SALIR la nota. */
      while (porDecir.current < notas.current.length) {
        const viva = notas.current[porDecir.current]!;
        if (viva.objetivo - anticipacion > ahora) break;
        porDecir.current += 1;
        /*
          La voz se dispara cuando la nota sale, no cuando llega.

          El sintetizador del navegador no se puede programar: `speak()` empieza
          cuando le viene bien, y de una vez a otra varían decenas de
          milisegundos. Metido en el instante del golpe arruinaría el compás.
          Metido dos segundos y medio antes, esa variación no la nota nadie,
          porque lo que hay que clavar no es cuándo suena la palabra sino cuándo
          llega la nota, y eso lo lleva el reloj del audio.
        */
        if (viva.nota.diceEn) void decir(viva.nota.diceEn, { velocidad: 0.9 });
      }

      /* 4. Las notas que se mueven, y las ventanas que se abren y se cierran. */
      let ventanaAbierta: string | null = null;
      for (let i = porResolver.current; i < porResolver.current + NOTAS_EN_PANTALLA; i += 1) {
        const viva = notas.current[i];
        if (!viva) break;

        const falta = viva.objetivo - ahora;
        if (falta > anticipacion) break;

        if (Math.abs(falta) <= ventana) {
          ventanaAbierta = viva.nota.id;
          if (import.meta.env.DEV && window.__compas) {
            const apuntada = window.__compas.notas.find((fila) => fila.id === viva.nota.id);
            if (apuntada && apuntada.apertura === null) {
              apuntada.apertura = ahora;
              apuntada.sistema = performance.now() / 1000;
              // Lo que de verdad se quiere saber: cuántos milisegundos tarda el
              // juego en enterarse de que la ventana tenía que estar abierta.
              apuntada.desfaseMs = Math.round((ahora - (viva.objetivo - ventana)) * 1000);
            }
          }
        }

        const cuerpo = cuerpos.current.get(viva.nota.id);
        if (cuerpo) {
          const recorrido = Math.min(1 - falta / anticipacion, PASADO / LINEA);
          cuerpo.style.transform = `translate3d(0, ${(recorrido * LINEA * 100).toFixed(2)}%, 0)`;
        }
      }

      if (ventanaAbierta !== ultimaAbierta) {
        ultimaAbierta = ventanaAbierta;
        setAbierta(ventanaAbierta);
      }

      /* 5. Lo que se escapó. Cuenta como fallo y se le dice al servidor. */
      const siguiente = notas.current[porResolver.current];
      if (siguiente && !siguiente.resuelta && ahora - siguiente.objetivo > ventana) {
        porResolver.current += 1;
        resolver(siguiente, SE_ESCAPO, 'escapada');
      }

      /* 6. ¿Se acabó la canción? */
      if (porResolver.current >= notas.current.length && ahora > instanteDelPulso(pulsosTotales)) {
        terminar();
        return;
      }

      cuadro = requestAnimationFrame(latido);
    };

    cuadro = requestAnimationFrame(latido);
    return () => cancelAnimationFrame(cuadro);
  }, [fase, instanteDelPulso, resolver, ronda.compas, terminar]);

  /*
    Cambiar de pestaña a mitad de canción.

    `requestAnimationFrame` se para cuando la pestaña se esconde, pero el reloj
    del audio NO: sigue corriendo. Sin hacer nada, al volver se encontraría con
    veinte notas pasadas de largo y las daría todas por escapadas de golpe, que
    es perder la partida por mirar el correo.

    Lo que se hace es CORRER EL PULSO CERO hacia delante lo que se estuvo fuera.
    Como todos los objetivos se miden desde ahí, la canción entera se desplaza
    con él y sigue cuadrando: nada se pierde y nada se adelanta. La música que
    ya estuviera encargada —como mucho los 400 ms de adelanto— suena con el
    canal a cero, así que no se oye un bombo suelto al volver.
  */
  useEffect(() => {
    if (fase !== 'tocando') return;

    let seFue = 0;
    const alCambiar = () => {
      if (document.hidden) {
        seFue = reloj.current();
        if (canal.current) canal.current.gain.value = 0;
        return;
      }

      if (!seFue) return;
      const fuera = reloj.current() - seFue;
      seFue = 0;
      cero.current += fuera;
      for (const viva of notas.current) if (!viva.resuelta) viva.objetivo += fuera;
      if (canal.current) canal.current.gain.value = 1;
    };

    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, [fase]);

  /* Al salir, ni música colgando ni el sintetizador hablando por encima. */
  useEffect(() => {
    return () => {
      canal.current?.disconnect();
      canal.current = null;
      if (hayVoz()) window.speechSynthesis.cancel();
    };
  }, []);

  /*
    El teclado, que en un juego de ritmo es la forma principal de jugar.

    J, K y L: la mano derecha en reposo sobre las tres teclas, que es la postura
    de cualquier juego de este tipo desde hace veinte años. Y 1, 2 y 3 además,
    porque es lo que prueba quien no lo sabe. Cada pastilla lleva su tecla
    escrita y su `aria-keyshortcuts`, que es lo que hace que se descubra en vez
    de adivinarse.

    La tecla apunta a la pastilla DEL GRUPO DE LA NOTA QUE TOCA, no a una fija.
    En el compás de frase son siempre las mismas tres; en el de oído cambian en
    cada grupo, porque son las tres palabras que se confunden.
  */
  useEffect(() => {
    if (fase !== 'tocando') return;

    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey || evento.repeat) return;
      const cual = TECLAS[evento.key.toLowerCase()];
      if (cual === undefined) return;

      const pastilla = notas.current[porResolver.current]?.grupo.pastillas[cual];
      if (!pastilla) return;

      evento.preventDefault();
      pulsar(pastilla.id);
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [fase, pulsar]);

  if (fase === 'eligiendo') {
    return (
      <Entrada
        voz={voz}
        ronda={ronda}
        menosMovimiento={menosMovimiento}
        onEmpezar={empezar}
        onSalir={onSalir}
        onAjustes={onAjustes}
      />
    );
  }

  const visibles = notas.current.slice(desde, desde + NOTAS_EN_PANTALLA);
  const grupoAntes = notas.current[desde - 1]?.grupo;
  /*
    Cuando ya no quedan notas —los dos últimos compases de la canción— se sigue
    enseñando el último grupo en vez de un hueco. Con el hueco, la partida
    acababa con un «…» donde estaba la frase, que se lee como que algo se ha
    roto justo en el momento en el que hay que mirar la puntuación.
  */
  const grupoAhora = visibles[0]?.grupo ?? grupoAntes;
  const cerrado = grupoAntes && visibles[0] && grupoAntes.id !== grupoAhora?.id ? grupoAntes : null;

  return (
    <div className="relative mx-auto w-full max-w-md px-4 py-3">
      {/*
        El fondo psicodélico de la fiebre.

        Va detrás de todo, es solo color y NO aparece con
        `prefers-reduced-motion`: lo pide el encargo y lo pide el sentido común,
        porque un fondo que cambia de color sin parar es de las cosas que peor le
        sientan a quien es sensible al movimiento. Sin él la fiebre se sigue
        viendo entera: el marcador cambia de color, la chapa dice FIEBRE y el
        multiplicador está escrito con su número.
      */}
      {enFiebre && !menosMovimiento && (
        <div aria-hidden className="beat-fiebre pointer-events-none fixed inset-0 z-0" />
      )}

      <div className="relative z-10 flex min-h-[calc(100dvh-1.5rem)] flex-col">
        <CabeceraJuego onSalir={onSalir}>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-extrabold leading-none tabular-nums">
              {Math.min(desde + 1, notas.current.length)}
              <span className="text-base font-bold text-[var(--texto-suave)]">
                /{notas.current.length}
              </span>
            </p>
            <p className="text-xs text-[var(--texto-suave)]">notas</p>
          </div>
          <Contador
            etiqueta="Puntos"
            valor={puntuacion}
            tono={enFiebre ? 'aviso' : aciertos > 0 ? 'acierto' : 'normal'}
            vivo
          >
            {ultimo && ultimo.suma > 0 && <PuntosGanados key={ultimo.vez} puntos={ultimo.suma} />}
          </Contador>
        </CabeceraJuego>

        <div className="mt-2 flex min-h-8 flex-wrap items-center gap-2">
          <Racha racha={racha} />
          {enFiebre && (
            <span
              className={cn(
                'inline-flex min-h-7 items-center rounded-full bg-gradient-to-r from-fuchsia-600 to-orange-500 px-2.5 text-sm font-extrabold text-white',
                !menosMovimiento && 'animate-crecer',
              )}
            >
              FIEBRE ×{multiplicador}
            </span>
          )}
        </div>

        {ultimo && <Destello key={ultimo.vez} senal={senalDe(ultimo.juicio)} />}

        <CabeceraDelGrupo grupo={grupoAhora} cerrado={cerrado} />

        {menosMovimiento ? (
          <PistaQuieta
            visibles={visibles}
            abierta={abierta}
            pulso={pulso}
            anticipacion={ronda.compas.msDeAnticipacion / ronda.compas.msPorPulso}
          />
        ) : (
          <Pista visibles={visibles} abierta={abierta} cuerpos={cuerpos} enFiebre={enFiebre} />
        )}

        <Pastillero
          pastillas={grupoAhora?.pastillas ?? []}
          ingles={grupoAhora?.modo === 'oido'}
          abierta={abierta}
          ultimo={ultimo}
          pulso={pulso}
          enFiebre={enFiebre}
          menosMovimiento={menosMovimiento}
          onPulsar={pulsar}
        />

        {/*
          Lo que pasó, para quien no ve la pantalla. No se anuncia cada nota
          —treinta avisos en un minuto tapan el juego entero— sino solo lo que
          cambia la decisión: el resultado de la última y si hay fiebre.
        */}
        <p role="status" className="sr-only">
          {ultimo
            ? `${NOMBRE_DEL_JUICIO[ultimo.juicio]}. ${racha} seguidas. ${puntuacion} puntos.`
            : ''}
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────  LAS PIEZAS  ────────────────────────── */

const NOMBRE_DEL_JUICIO: Record<Juicio, string> = {
  perfecto: 'Perfecto',
  bien: 'Bien',
  fallo: 'Esa no era',
  escapada: 'Se escapó',
};

function senalDe(juicio: Juicio): 'acierto' | 'fallo' | 'combo' {
  if (juicio === 'perfecto') return 'combo';
  return juicio === 'bien' ? 'acierto' : 'fallo';
}

/** La frase que se está montando, o el sonido que se está separando. */
function CabeceraDelGrupo({
  grupo,
  cerrado,
}: {
  grupo: GrupoDeBeat | undefined;
  cerrado: GrupoDeBeat | null;
}) {
  return (
    <div className="mt-2 min-h-[4.25rem] rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-3 py-2">
      {grupo?.modo === 'oido' ? (
        <>
          <p className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
            Escucha y elige
          </p>
          <p className="text-xs leading-tight">{grupo.contraste}</p>
        </>
      ) : (
        <>
          <p className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
            Móntala en inglés
          </p>
          <p className="text-base font-extrabold leading-tight">{grupo?.fraseEs ?? '…'}</p>
        </>
      )}
      {/*
        Lo que enseñó el grupo anterior, en el compás de descanso.

        Son los cuatro pulsos que hay entre un grupo y el siguiente, y existen
        justo para esto: leer mientras hay que responder es el error que
        `particulas.ts` cuenta largo y tendido, así que lo que hay que leer se
        pone donde no hay nada que responder.
      */}
      {cerrado && (
        <p
          lang={cerrado.modo === 'frase' ? 'en' : undefined}
          className="mt-1 truncate text-xs text-[var(--texto-suave)]"
        >
          ✓ {cerrado.modo === 'frase' ? cerrado.fraseEn : cerrado.ensena}
        </p>
      )}
    </div>
  );
}

/**
 * La pista: las notas cayendo hacia la línea.
 *
 * Cada nota va dentro de un envoltorio de la ALTURA ENTERA de la pista, y lo
 * que el bucle mueve es ese envoltorio en tanto por ciento. Así no hace falta
 * medir la pista en píxeles ni escuchar los cambios de tamaño: los porcentajes
 * de `translate` se calculan sobre el propio elemento, así que un móvil de pie
 * y uno tumbado recorren lo suyo sin que el juego tenga que enterarse.
 */
function Pista({
  visibles,
  abierta,
  cuerpos,
  enFiebre,
}: {
  visibles: NotaEnElTiempo[];
  abierta: string | null;
  cuerpos: { current: Map<string, HTMLDivElement | null> };
  enFiebre: boolean;
}) {
  return (
    <div
      /*
        Qué nota tiene la ventana abierta, escrito en el marcado.

        Lo lee la prueba del componente y lo lee el arnés con el que se midió el
        desfase. Podrían mirar el color del borde, pero entonces cambiar un tono
        rompería una medida, que es la peor forma de tener una prueba.
      */
      data-nota-abierta={abierta ?? ''}
      className="relative mt-2 min-h-44 flex-1 overflow-hidden rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)]"
    >
      {/* La línea a la que hay que darle. Se enciende con la ventana. */}
      <div className="pointer-events-none absolute inset-x-0" style={{ top: `${LINEA * 100}%` }}>
        <div
          className={cn(
            'h-1 w-full rounded-full transition-colors duration-75',
            abierta !== null ? 'bg-lime-500' : enFiebre ? 'bg-fuchsia-500/60' : 'bg-[var(--borde)]',
          )}
        />
      </div>

      {visibles.map((viva) => (
        <div
          key={viva.nota.id}
          ref={(nodo) => {
            cuerpos.current.set(viva.nota.id, nodo);
          }}
          className="pointer-events-none absolute inset-x-0 top-0 h-full will-change-transform"
          style={{ transform: 'translate3d(0, -25%, 0)' }}
        >
          <div
            className={cn(
              'mx-auto flex w-[80%] -translate-y-1/2 items-center justify-center rounded-xl border-2 px-2 py-2 text-center shadow-sm',
              abierta === viva.nota.id
                ? 'border-lime-500 bg-lime-100 dark:bg-lime-900'
                : 'border-[var(--borde)] bg-[var(--fondo)]',
            )}
          >
            <TextoDeNota viva={viva} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * La misma pista con `prefers-reduced-motion`, y este es el reto de diseño que
 * plantea el encargo.
 *
 * Un juego de ritmo sin movimiento parece una contradicción, pero lo que hace
 * falta para jugar no es que algo se mueva: es SABER CUÁNDO. Una nota que baja
 * y una cuenta atrás en pulsos dicen exactamente lo mismo, y la segunda no mueve
 * un solo píxel: el número cambia una vez cada 600 ms y ya está. La ventana de
 * acierto es la misma, los puntos son los mismos y el ¡AHORA! dura exactamente
 * lo que dura la ventana, ni un milisegundo más.
 *
 * Con movimiento reducido tampoco hay sonido —es la regla de esta casa, y está
 * razonada en `sonido.ts`— así que esta cuenta atrás no acompaña al compás: ES
 * el compás. Por eso ocupa la pista entera en vez de ser una etiqueta pequeña.
 */
function PistaQuieta({
  visibles,
  abierta,
  pulso,
  anticipacion,
}: {
  visibles: NotaEnElTiempo[];
  abierta: string | null;
  pulso: number;
  /** Cuántos pulsos antes se ve venir una nota. */
  anticipacion: number;
}) {
  /*
    Solo las notas que YA habrían salido en la pista que se mueve.

    Sin este corte se listaban las cuatro siguientes, y las dos últimas son
    normalmente del grupo de después: la cabecera decía «nuestra profesora
    explicó la lección» y debajo aparecían «my sister» y «English», que son de
    otra frase. Eso no es enseñar el futuro, es contradecirse. El corte es el
    mismo que hace la pista que cae, donde una nota que todavía no ha salido
    está fuera de la pantalla.
  */
  const salidas = visibles.filter((viva) => viva.nota.pulso - pulso <= anticipacion);

  return (
    <div
      data-nota-abierta={abierta ?? ''}
      className="mt-2 flex min-h-44 flex-1 flex-col gap-2 rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-2"
    >
      {salidas.map((viva, sitio) => {
        const llega = abierta === viva.nota.id;
        const faltan = Math.max(viva.nota.pulso - pulso, 0);

        return (
          <div
            key={viva.nota.id}
            className={cn(
              'flex items-center gap-2 rounded-xl border-2 px-2 py-2',
              llega
                ? 'border-[var(--texto-acierto)] bg-emerald-50 dark:bg-emerald-950/40'
                : 'border-[var(--borde)]',
              !llega && sitio > 0 && 'opacity-60',
            )}
          >
            <span
              className={cn(
                'w-[4.5rem] shrink-0 text-center text-xs font-extrabold tabular-nums',
                llega ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-suave)]',
              )}
            >
              {llega ? '¡AHORA!' : `en ${faltan}`}
            </span>
            <TextoDeNota viva={viva} />
          </div>
        );
      })}
    </div>
  );
}

/** Lo que lleva escrito la nota: el trozo de frase, o el altavoz del dictado. */
function TextoDeNota({ viva }: { viva: NotaEnElTiempo }) {
  if (viva.nota.texto) {
    return (
      <span lang="en" className="min-w-0 truncate text-base font-extrabold">
        {viva.nota.texto}
      </span>
    );
  }

  /*
    En el compás de oído la nota NO dice qué palabra es: si lo dijera, no habría
    que oírla. Lo que sí dice es cuál de las tres del grupo es, y eso no regala
    nada: hace falta para saber si la que llega es la primera que sonó o la
    segunda, que con dos notas volando a la vez es fácil de perder.
  */
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span aria-hidden className="text-lg">
        🔊
      </span>
      <span className="truncate text-sm font-bold text-[var(--texto-suave)]">
        la {viva.orden + 1}.ª que oíste
      </span>
    </span>
  );
}

/**
 * Las tres pastillas, con Milo al lado.
 *
 * Milo no está de adorno: es el metrónomo. Da un bote en cada pulso fuerte —el
 * mismo pulso contra el que se mide todo, así que el bote y el bombo son el
 * mismo instante— y cambia de cara con lo que pasa. Quien pierde el compás lo
 * recupera mirándole a él, que es exactamente para lo que sirve un metrónomo y
 * mucho más agradable que un número parpadeando. Con movimiento reducido se
 * queda quieto y sigue cambiando de cara, que es lo que dice el resultado.
 */
function Pastillero({
  pastillas,
  ingles,
  abierta,
  ultimo,
  pulso,
  enFiebre,
  menosMovimiento,
  onPulsar,
}: {
  pastillas: Array<{ id: string; etiqueta: string; pista?: string }>;
  ingles: boolean;
  abierta: string | null;
  ultimo: Golpe | null;
  pulso: number;
  enFiebre: boolean;
  menosMovimiento: boolean;
  onPulsar: (pastillaId: string) => void;
}) {
  const bote = !menosMovimiento && pulso >= 0 && pulso % 2 === 0;

  return (
    <div className="mt-2 flex items-end gap-2">
      <div
        className="shrink-0 transition-transform duration-150"
        style={{ transform: bote ? 'translateY(-7px)' : 'none' }}
      >
        <Mascota estado={estadoDeMilo(ultimo, enFiebre)} tamano={52} />
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
        {pastillas.map((pastilla, indice) => (
          <button
            key={pastilla.id}
            type="button"
            lang={ingles ? 'en' : undefined}
            onPointerDown={() => onPulsar(pastilla.id)}
            aria-keyshortcuts={LETRAS[indice]}
            className={cn(
              'boton-3d flex min-h-16 flex-col items-center justify-center rounded-xl border-2 px-0.5 py-1',
              abierta !== null
                ? 'border-lime-500 bg-[var(--superficie)]'
                : 'border-[var(--borde)] bg-[var(--superficie)]',
            )}
          >
            <span className="w-full truncate text-sm font-extrabold leading-tight">
              {pastilla.etiqueta}
            </span>
            {pastilla.pista && (
              <span className="w-full truncate text-[10px] leading-tight text-[var(--texto-suave)]">
                {pastilla.pista}
              </span>
            )}
            <span className="mt-0.5 text-[10px] font-bold text-[var(--texto-suave)]">
              {LETRAS[indice]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const LETRAS = ['J', 'K', 'L'];

function estadoDeMilo(ultimo: Golpe | null, enFiebre: boolean) {
  if (enFiebre) return 'celebrando' as const;
  if (!ultimo) return 'neutral' as const;
  if (ultimo.juicio === 'perfecto') return 'orgulloso' as const;
  if (ultimo.juicio === 'bien') return 'feliz' as const;
  return 'animando' as const;
}

/* ──────────────────────────  LA ENTRADA  ────────────────────────── */

/**
 * La pantalla de antes de empezar, y es la que hace este juego distinto.
 *
 * Aquí se comprueba si hay voz inglesa, igual que en ESCUCHA. La diferencia es
 * lo que pasa cuando no la hay: ESCUCHA no se puede jugar y se sale con un
 * toque. Aquí solo se cae UNA de las dos formas, y la otra —la de leer trozos
 * de frase— funciona entera en un teléfono sin una sola voz instalada. Es el
 * primer juego de la casa que no se apaga en un móvil pelado, y por eso el
 * compás de frase es el que está arriba, en verde y enfocado.
 *
 * El botón es además el gesto que despierta el audio: el navegador no deja
 * sonar nada hasta que la persona toca algo, así que no hay forma de empezar
 * una canción sin pasar por aquí. Conviene, porque también es donde se dice que
 * se juega con J, K y L.
 */
function Entrada({
  voz,
  ronda,
  menosMovimiento,
  onEmpezar,
  onSalir,
  onAjustes,
}: {
  voz: 'comprobando' | 'si' | 'no';
  ronda: RondaDeBeat;
  menosMovimiento: boolean;
  onEmpezar: (compas: Compas) => void;
  onSalir: () => void;
  onAjustes: () => void;
}) {
  const segundos = useMemo(
    () => Math.round((ronda.compas.pulsosTotales * ronda.compas.msPorPulso) / 1000),
    [ronda.compas],
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-3">
      <CabeceraJuego onSalir={onSalir} />

      <div className="mt-2">
        <MascotaConMensaje
          estado="feliz"
          mensaje="Yo llevo el compás. Tú manda cada nota a su sitio justo cuando toque."
        />
      </div>

      <div className="mt-4 grid gap-3">
        <button
          type="button"
          autoFocus
          onClick={() => onEmpezar('frase')}
          className="boton-3d rounded-2xl border-2 border-lime-800 bg-lime-700 px-4 py-3 text-left text-white"
        >
          <span className="block text-lg font-extrabold">Compás de frase</span>
          <span className="mt-0.5 block text-sm">
            Caen trozos de frase inglesa. Mándalos a QUIÉN, ACCIÓN o QUÉ.
          </span>
          <span className="mt-1 block text-xs font-bold">
            Sin voz y sin sonido también · {ronda.frase.length * 3} notas
          </span>
        </button>

        <button
          type="button"
          disabled={voz !== 'si'}
          onClick={() => onEmpezar('oido')}
          className={cn(
            'rounded-2xl border-2 px-4 py-3 text-left',
            voz === 'si'
              ? 'boton-3d border-fuchsia-900 bg-fuchsia-800 text-white'
              : 'border-[var(--borde)] bg-[var(--superficie)] text-[var(--texto-suave)]',
          )}
        >
          <span className="block text-lg font-extrabold">Compás de oído</span>
          <span className="mt-0.5 block text-sm">
            Una voz dicta la palabra. ¿Dijo «sheep», «ship» o «cheap»?
          </span>
          <span className="mt-1 block text-xs font-bold">
            {voz === 'comprobando'
              ? 'Buscando una voz en inglés…'
              : voz === 'si'
                ? `Con tu voz en inglés · ${ronda.oido.length * 3} notas`
                : 'Este aparato no tiene ninguna voz inglesa'}
          </span>
        </button>
      </div>

      {/*
        Sin voz inglesa NO se cierra el juego, que es lo que hace ESCUCHA. Se
        explica qué se pierde, se deja el otro compás delante y se ofrece el
        camino para arreglarlo. Decirle «vuelve otro día» a quien puede jugar a
        la mitad del juego sería cerrarle la puerta por algo que no le impide
        entrar.
      */}
      {voz === 'no' && (
        <div className="mt-4">
          <Aviso tono="aviso">
            Podríamos leer las palabras con la voz española que tienes, pero «sheep» y «ship»
            sonarían igual y aprenderías una pronunciación que no existe. El compás de frase no
            necesita ninguna voz: ese lo juegas entero.
          </Aviso>
          <button
            type="button"
            onClick={onAjustes}
            className="mt-2 min-h-11 w-full rounded-xl px-4 text-sm text-[var(--texto-suave)] underline underline-offset-4 hover:text-[var(--texto)]"
          >
            Ver mis ajustes de voz
          </button>
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-[var(--superficie)] p-3 text-sm text-[var(--texto-suave)]">
        <p>
          <strong className="text-[var(--texto)]">Se juega con J, K y L</strong>, o tocando las tres
          pastillas de abajo. Una nota cada {redondear(ronda.compas.msEntreNotas)} segundos, con{' '}
          {redondear(ronda.compas.msVentana)} de margen a cada lado: no hace falta clavarlo al
          milisegundo, hace falta saber dónde va.
        </p>
        <p className="mt-2">
          La partida dura {segundos} segundos. Encadena {ronda.compas.rachaDeFiebre} seguidas y se
          enciende la fiebre, que multiplica lo que vale cada nota.
        </p>
        {menosMovimiento && (
          <p className="mt-2">
            Como pediste menos movimiento, las notas no caen ni suena nada: cada una enseña cuántos
            pulsos le faltan y avisa con un ¡AHORA! El margen es exactamente el mismo.
          </p>
        )}
      </div>
    </div>
  );
}

/** Milisegundos a segundos con un decimal, para leerlos en una frase. */
function redondear(ms: number): string {
  return (Math.round(ms / 100) / 10).toLocaleString('es-ES');
}
