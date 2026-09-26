import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { Mascota, type EstadoMascota } from '@/components/Mascota';
import { decir, hayVoz, hayVozInglesa, vozInglesaYa } from '@/lib/voz';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { CabeceraJuego, Contador, Racha } from './Tablero';
import { Destello, PuntosGanados } from './efectos';
import { loQueSumaElSiguiente, puntosDelServidor } from './puntos';
import type {
  ControlDelPanel,
  Marcador,
  OrdenDeBrecha,
  RespuestaCorregida,
  RondaDeBrecha,
} from './tipos';

/**
 * PROTOCOLO DE BRECHA: la estación se cae y Milo, que es la IA, dicta la
 * maniobra en inglés.
 *
 * «Turn the red valve under the screen clockwise before you open the blue hatch
 * above the pipe». Se oye una vez. Luego hay que hacerlo en el panel, en ese
 * orden, tocando el aparato y después el gesto. Un error es una falla crítica:
 * se pierde una de las tres vidas y se acabó la orden.
 *
 *
 * POR QUÉ ESTE JUEGO NO SE CONTESTA, SE EJECUTA
 *
 * Es lo único que lo separa de los ocho anteriores, y no es un capricho de
 * formato. Reconocer «under the screen» entre cuatro opciones se puede hacer por
 * eliminación y sin entender nada; poner la mano en el sitio que dice la frase,
 * no. Por eso el panel tiene DOS válvulas rojas idénticas, una encima y otra
 * debajo de la pantalla: si solo hubiera una, la preposición sobraría y este
 * juego sería un test de vocabulario con decorado espacial.
 *
 *
 * POR QUÉ EL RELOJ NO EMPIEZA HASTA QUE LA IA CALLA
 *
 * La lección cara de PARTICULAS, otra vez. Allí la pausa de lectura se calculó
 * suponiendo que se leen 28 caracteres por segundo, y la realidad son 14-18: el
 * juego salió injugable. Aquí el rato de entender la orden y el rato de
 * ejecutarla son dos cosas distintas y van separadas:
 *
 *   - mientras la IA habla, o mientras el registro escrito está en pantalla, NO
 *     corre ningún reloj. Ese rato lo mide el propio sintetizador, que es la
 *     única medida honesta de cuánto dura una frase hablada, y cuando no hay
 *     voz lo calcula el servidor a 14 caracteres por segundo;
 *   - cuando la orden se acaba, empieza la ventana de ejecución, que son los
 *     segundos que se tarda en buscar el aparato y tocarlo. Eso es lo que se
 *     aprieta al encadenar aciertos, y viene calibrado del servidor.
 *
 *
 * ESTE JUEGO SE PUEDE JUGAR SIN VOZ, Y NO SE QUEDA MUDO
 *
 * Sin voces inglesas instaladas, `decir()` se niega a hablar —una voz española
 * leyendo inglés enseña una pronunciación que no existe— y ESCUCHA se planta y
 * manda a otro juego. Aquí no hace falta: el encargo ya decía «por audio o por
 * registros de texto temporales», así que sin voz la orden aparece escrita unos
 * segundos y luego se borra. Sigue habiendo que entenderla y retenerla; lo que
 * cambia es por qué sentido entra. El informe de antes de empezar lo dice con
 * todas las letras, para que nadie crea que se le ha roto el sonido.
 */

/** Cómo se le dice al servidor que se acabó el tiempo. Copia de `brecha.ts`. */
const SE_ACABO_EL_TIEMPO = 'tiempo';

/** Lo que se queda en pantalla un acierto antes de pasar a la orden siguiente. */
const PAUSA_ACIERTO = 1400;

/**
 * Y lo que se queda un fallo.
 *
 * Casi cuatro veces más, porque aquí hay que LEER: la orden en inglés, lo que
 * significaba y qué era exactamente lo que había que pillar son unos ciento
 * cuarenta caracteres, que a catorce por segundo son diez segundos. No se
 * espera tanto —hay un botón para seguir en cuanto se haya leído— pero cortar a
 * los dos segundos sería enseñar la respuesta y taparla, que es peor que no
 * enseñarla.
 */
const PAUSA_FALLO = 5200;

/** Cuánto se deja ver el registro escrito cuando se pide a mitad de la maniobra. */
const REGISTRO_DE_EMERGENCIA_MS = 2000;

/**
 * Un pelín más lento que en las lecciones.
 *
 * Aquí la frase va sola, no hay contexto que ayude a colocarla, y además hay que
 * retenerla entera para poder ejecutarla. Por debajo de 0,85 ya suena
 * arrastrado y deja de parecer una IA dando órdenes.
 */
const VELOCIDAD_DE_LA_IA = 0.88;

/**
 * Cómo se reparten las seis casillas y los cuatro hitos.
 *
 * Tres filas de dos, con un hito entre fila y fila de cada columna. Es lo que
 * convierte cada casilla en un sitio que se puede nombrar con una preposición
 * sin escribir ni una etiqueta encima: la de arriba a la izquierda es «above the
 * screen» porque está encima de la pantalla, y se ve.
 *
 * El orden de las casillas es el de lectura, y es el mismo que usa el servidor
 * para numerarlas de `c1` a `c6`. Por eso las teclas del 1 al 6 caen donde uno
 * espera.
 */
const FILAS = [
  ['arriba-izq', 'arriba-der'],
  ['medio-izq', 'medio-der'],
  ['abajo-izq', 'abajo-der'],
] as const;

/** Los hitos en español, para lo que se lee y para quien no ve la pantalla. */
const HITOS_ES: Record<string, string> = {
  screen: 'la pantalla',
  vent: 'la rejilla',
  lamp: 'el piloto',
  pipe: 'el tubo',
};

/** Los cuatro aparatos en español. Todos son femeninos, y eso simplifica. */
const TIPOS_ES: Record<string, string> = {
  valve: 'válvula',
  lever: 'palanca',
  hatch: 'escotilla',
  pump: 'bomba',
};

const COLORES_ES: Record<string, string> = {
  red: 'roja',
  blue: 'azul',
  green: 'verde',
  yellow: 'amarilla',
  white: 'blanca',
};

/**
 * De qué color se pinta cada aparato.
 *
 * Van a mano y no con clases de Tailwind porque el color entra en un `fill` de
 * SVG. El blanco tira a gris claro a propósito: el blanco puro desaparece sobre
 * la tarjeta en tema claro, y el aparato tiene que verse antes de leer nada.
 */
const TINTA: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  white: '#e2e8f0',
};

type Fase = 'informe' | 'dictando' | 'ejecutando' | 'resultado';

interface Resultado {
  acerto: boolean;
  sinTiempo: boolean;
  /** En qué paso se torció, contando desde uno. */
  pasoFallado: number | null;
}

export function Brecha({
  ronda,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeBrecha;
  onResponder: (rondaId: string, answer: string[]) => Promise<RespuestaCorregida>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();

  /*
    Si hay voz inglesa se decide ANTES de empezar, mientras se lee el informe.

    Es el mismo problema que resolvió ESCUCHA: la lista de voces del navegador
    tarda segundos en publicarse, y preguntarla a mitad de partida daría «no hay»
    en el primer aparato lento. Aquí encima el informe tiene que decir por
    adelantado si la orden se va a oír o a leer, así que la comprobación cae
    justo donde hace falta.
  */
  const [voz, setVoz] = useState<'comprobando' | 'si' | 'no'>(() => {
    const ya = vozInglesaYa();
    return ya === 'todavia-no-se' ? 'comprobando' : ya;
  });

  const [fase, setFase] = useState<Fase>('informe');
  const [indice, setIndice] = useState(0);
  const [hechos, setHechos] = useState<string[]>([]);
  const [seleccionado, setSeleccionado] = useState<ControlDelPanel | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [registro, setRegistro] = useState(false);
  /** Lo que queda de ventana, de 1 a 0. Solo significa algo ejecutando. */
  const [queda, setQueda] = useState(1);

  const [vidas, setVidas] = useState(ronda.vidas);
  const [aciertos, setAciertos] = useState(0);
  const [contestadas, setContestadas] = useState(0);
  const [racha, setRacha] = useState(0);
  /*
    La racha viva se rompe al fallar; la que PAGA es la más larga de la partida.
    Se guarda aparte para que el marcador en vivo enseñe lo mismo que va a cerrar
    el servidor: un número que baja al fallar y luego no cuadra con el final es
    justo lo que hace que un juego se sienta trucado.
  */
  const [rachaMaxima, setRachaMaxima] = useState(0);
  /** En qué escalón del reloj vamos. Los milisegundos los manda el servidor. */
  const [paso, setPaso] = useState(0);

  const actual: OrdenDeBrecha | undefined = ronda.ordenes[indice];
  const ventanaMs = actual ? actual.pasos.length * escalonDe(ronda, paso) : 0;

  // La misma cuenta que hará el servidor al cerrar. Ver `puntos.ts`, que explica
  // por qué se calcula aquí también en vez de esperar al final.
  const puntuacion = puntosDelServidor('BRECHA', aciertos, rachaMaxima);

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
    Lo que se manda al servidor va en fila india y no se espera para seguir.

    Es lo mismo que hacen CAEN y PARTICULAS: el navegador ya sabe si la maniobra
    salió —la orden le llegó con la secuencia buena— así que parar el juego a
    esperar solo añadiría un parpadeo. Pero la partida NO se cierra hasta que la
    última ha llegado: si el `/fin` adelantara a las respuestas, la puntuación
    final saldría más baja que la que se acaba de ver subir, y eso se lee como
    una estafa.
  */
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const avisar = useCallback(
    (rondaId: string, secuencia: string[]) => {
      cola.current = cola.current.then(() =>
        // Un reintento y ya. Si la red está caída, lo que no puede pasar es que
        // la partida se pare.
        onResponder(rondaId, secuencia).catch(() =>
          onResponder(rondaId, secuencia).catch(() => null),
        ),
      );
    },
    [onResponder],
  );

  const marcador = useRef<Marcador>({ puntuacion: 0, aciertos: 0, total: 0 });
  marcador.current = { puntuacion, aciertos, total: contestadas };

  /*
    Espejos de lo que hace falta leer desde dentro del reloj.

    El reloj de la ventana no puede depender de `hechos` ni de `racha`: si
    dependiera, cada gesto reiniciaría el `requestAnimationFrame` y la ventana
    volvería a empezar, o sea que tocar cosas regalaría tiempo. Leyéndolos por
    referencia, el efecto solo se rearma cuando cambia la orden o el escalón,
    que es cuando de verdad hay un reloj nuevo.
  */
  const actualRef = useRef<OrdenDeBrecha | undefined>(undefined);
  actualRef.current = actual;
  const hechosRef = useRef<string[]>([]);
  hechosRef.current = hechos;
  const rachaRef = useRef(0);
  rachaRef.current = racha;
  const vidasRef = useRef(ronda.vidas);
  vidasRef.current = vidas;

  const cerrada = useRef(false);
  const terminar = useCallback(() => {
    if (cerrada.current) return;
    cerrada.current = true;
    void cola.current.then(() => onFin(marcador.current));
  }, [onFin]);

  /*
    Qué orden está ya resuelta, en una referencia y no en el estado.

    `fase` no basta para cerrar la puerta. Tocar el gesto que remata la maniobra
    y que la ventana se agote en el mismo fotograma son dos llamadas dentro del
    mismo render: las dos ven `fase === 'ejecutando'`, las dos pasan, y la orden
    se manda dos veces. El servidor lo para —contesta GAM-006, «ya respondiste
    esto»— pero el navegador ya habría contado dos respuestas para una sola
    orden, y entonces el marcador que se enseña deja de ser el que va a cerrar la
    partida. Es el mismo agujero que apareció jugando a PARTICULAS.
  */
  const resuelta = useRef<string | null>(null);

  /** Cierra la orden de ahora: con la secuencia que se ejecutó, o sin tiempo. */
  const resolver = useCallback(
    (secuencia: string[], sinTiempo: boolean) => {
      const orden = actualRef.current;
      if (!orden || resuelta.current === orden.id) return;
      resuelta.current = orden.id;

      const buena = orden.pasos.map(gestoDe);
      const acerto =
        !sinTiempo &&
        secuencia.length === buena.length &&
        secuencia.every((g, i) => g === buena[i]);
      const torcido = secuencia.findIndex((gesto, i) => gesto !== buena[i]);

      setResultado({
        acerto,
        sinTiempo,
        pasoFallado: acerto || sinTiempo ? null : (torcido === -1 ? secuencia.length : torcido) + 1,
      });
      setFase('resultado');
      setSeleccionado(null);
      setContestadas((n) => n + 1);

      const nuevaRacha = acerto ? rachaRef.current + 1 : 0;
      setRacha(nuevaRacha);
      setRachaMaxima((mejor) => Math.max(mejor, nuevaRacha));
      if (acerto) setAciertos((n) => n + 1);
      else setVidas((quedan) => Math.max(quedan - 1, 0));

      // El reloj sube de uno en uno y baja de varios: aprieta a quien encadena y
      // cede a quien se atasca. Quedarse sin tiempo también cede, que es el caso
      // en el que más falta hace.
      setPaso((ahora) =>
        acerto ? ahora + 1 : Math.max(ahora - ronda.reloj.pasosAtrasAlFallar, 0),
      );

      // Se manda TAMBIÉN cuando se acabó el tiempo. Si solo contaran las
      // maniobras terminadas, la racha del servidor no se rompería nunca y
      // pagaría el bono al cuadrado de una partida que no existió.
      avisar(orden.id, sinTiempo ? [SE_ACABO_EL_TIEMPO] : secuencia);

      if (!acerto) sonar('fallo');
      else if (nuevaRacha >= 2) sonar('combo', { racha: nuevaRacha });
      else sonar('acierto');
    },
    [avisar, ronda.reloj.pasosAtrasAlFallar],
  );

  /** Un gesto: el aparato que se tocó y lo que se le hizo. */
  const ejecutar = useCallback(
    (control: ControlDelPanel, accion: string) => {
      const orden = actualRef.current;
      if (fase !== 'ejecutando' || !orden || resuelta.current === orden.id) return;

      const secuencia = [...hechosRef.current, `${control.id}:${accion}`];
      const esperado = orden.pasos[secuencia.length - 1];
      const bien = !!esperado && gestoDe(esperado) === secuencia[secuencia.length - 1];

      // El espejo se actualiza ANTES que el estado y no esperando al render que
      // viene: dos gestos que caigan en el mismo tick —un doble toque, una tecla
      // que se repite— leerían los dos la misma lista y el segundo borraría al
      // primero. Así el segundo ve al primero y la maniobra se corrige entera.
      hechosRef.current = secuencia;
      setHechos(secuencia);
      setSeleccionado(null);

      // Al primer gesto equivocado se acabó la maniobra: el encargo dice que un
      // error de comprensión revienta el sistema, y dejar seguir tocando después
      // de haber abierto la escotilla que no era sería fingir que no pasó nada.
      if (!bien || secuencia.length === orden.pasos.length) {
        resolver(secuencia, false);
        return;
      }

      sonar('tic');
    },
    [fase, resolver],
  );

  const avanzar = useCallback(() => {
    if (vidasRef.current <= 0) {
      terminar();
      return;
    }
    setHechos([]);
    setSeleccionado(null);
    setResultado(null);
    setRegistro(false);
    setQueda(1);
    setFase('dictando');
    setIndice((n) => n + 1);
  }, [terminar]);

  /*
    La IA dicta.

    Con voz, el reloj arranca cuando el sintetizador dice que ha terminado, que
    es la única medida honesta de cuánto dura la frase. Sin voz, el registro se
    queda en pantalla el rato que calculó el servidor y luego se borra: sigue
    habiendo que retenerlo.
  */
  useEffect(() => {
    if (fase !== 'dictando' || !actual) return;
    let vivo = true;

    if (voz === 'si') {
      void decir(actual.textoEn, { velocidad: VELOCIDAD_DE_LA_IA }).then(() => {
        if (vivo) setFase('ejecutando');
      });
      return () => {
        vivo = false;
        // Que no siga hablando por encima de la pantalla siguiente.
        if (hayVoz()) window.speechSynthesis.cancel();
      };
    }

    const reloj = window.setTimeout(() => setFase('ejecutando'), actual.lecturaMs);
    return () => {
      vivo = false;
      window.clearTimeout(reloj);
    };
  }, [fase, actual, voz]);

  useEffect(() => {
    return () => {
      if (hayVoz()) window.speechSynthesis.cancel();
    };
  }, []);

  /*
    La ventana de ejecución.

    Un solo `requestAnimationFrame` lleva las dos cosas —cuánto queda y cuándo se
    acabó— para que no puedan desincronizarse: un temporizador aparte que dispara
    el fin mientras la barra va por el 5 % es de las cosas que hacen que un juego
    se sienta injusto. El rato se mide contra `performance.now()` DENTRO del
    latido y no con el sello que trae `requestAnimationFrame`, que va en el reloj
    del documento: restar uno del otro da un número sin sentido y la barra se
    queda llena para siempre. Está contado en PARTICULAS, donde pasó.

    Con `prefers-reduced-motion` la barra no se anima: el estado solo cambia
    cuando cambia el segundo entero, y lo que se pinta es ese número bajando.
    Sigue siendo el mismo reloj y se sigue pudiendo jugar.
  */
  useEffect(() => {
    if (fase !== 'ejecutando' || ventanaMs <= 0) return;

    const inicio = performance.now();
    let cuadro = 0;
    let ultimoSegundo = Number.POSITIVE_INFINITY;

    const latido = () => {
      const transcurrido = performance.now() - inicio;

      if (transcurrido >= ventanaMs) {
        setQueda(0);
        resolver(hechosRef.current, true);
        return;
      }

      const fraccion = 1 - transcurrido / ventanaMs;
      const segundo = Math.ceil((ventanaMs - transcurrido) / 1000);

      if (segundo !== ultimoSegundo) {
        ultimoSegundo = segundo;
        // Los últimos tres segundos suenan. Es lo que hace levantar la vista sin
        // tener que mirar el número, que es justo cuando hace falta.
        if (segundo <= 3) sonar('tic', { urgente: true });
        if (menosMovimiento) setQueda(fraccion);
      }

      if (!menosMovimiento) setQueda(fraccion);
      cuadro = requestAnimationFrame(latido);
    };

    cuadro = requestAnimationFrame(latido);
    return () => cancelAnimationFrame(cuadro);
  }, [fase, ventanaMs, menosMovimiento, resolver]);

  /** La pausa que enseña: corta si salió, larga si hay que leer qué pedía. */
  useEffect(() => {
    if (fase !== 'resultado') return;
    const reloj = window.setTimeout(avanzar, resultado?.acerto ? PAUSA_ACIERTO : PAUSA_FALLO);
    return () => window.clearTimeout(reloj);
  }, [fase, resultado, avanzar]);

  /** El registro de emergencia se borra solo. */
  useEffect(() => {
    if (!registro) return;
    const reloj = window.setTimeout(() => setRegistro(false), REGISTRO_DE_EMERGENCIA_MS);
    return () => window.clearTimeout(reloj);
  }, [registro]);

  // Se acabaron las diez órdenes.
  useEffect(() => {
    if (fase !== 'informe' && !actual) terminar();
  }, [fase, actual, terminar]);

  /*
    Jugar sin tocar la pantalla.

    Del 1 al 6 para los aparatos, en el orden en que se leen, y luego 1 o 2 para
    el gesto —o las flechas, que es lo que sale solo cuando los dos gestos son
    una dirección—. No hay ambigüedad entre las dos cosas porque el panel se
    apaga en cuanto hay un aparato elegido: o se está escogiendo aparato o se
    está escogiendo gesto, nunca las dos.

    Tabular entre seis aparatos y dos gestos dentro de una ventana de cuatro
    segundos no es jugar, es una carrera de obstáculos: por eso la tecla va
    directa. Cada botón lleva su número escrito y su `aria-keyshortcuts`, que es
    lo que hace que se pueda descubrir en vez de adivinar.
  */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

      /*
        El informe se cierra con Enter, y el botón NO lleva `autoFocus`.

        Lo llevaba, y a 320 píxeles el informe no cabe entero: enfocar el botón
        del final hacía que la pantalla apareciera ya desplazada abajo, o sea que
        lo primero que se veía era el botón de empezar y no el parte que hay que
        leer. Con la tecla puesta aquí se sigue pudiendo empezar sin tocar nada y
        la página abre por arriba, que es por donde se lee.
      */
      if (fase === 'informe') {
        if (evento.key === 'Enter') {
          evento.preventDefault();
          setFase('dictando');
        }
        return;
      }

      if (fase === 'resultado') {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          avanzar();
        }
        return;
      }

      if (fase !== 'ejecutando' || !actual) return;

      if (evento.key === 'r' || evento.key === 'R') {
        evento.preventDefault();
        setRegistro(true);
        return;
      }

      if (seleccionado) {
        if (evento.key === 'Escape' || evento.key === 'Backspace') {
          evento.preventDefault();
          setSeleccionado(null);
          return;
        }

        const cual =
          evento.key === '1' || evento.key === 'ArrowLeft'
            ? 0
            : evento.key === '2' || evento.key === 'ArrowRight'
              ? 1
              : null;
        if (cual === null) return;

        evento.preventDefault();
        ejecutar(seleccionado, seleccionado.acciones[cual]);
        return;
      }

      const numero = Number(evento.key);
      if (!Number.isInteger(numero) || numero < 1 || numero > actual.controles.length) return;

      evento.preventDefault();
      setSeleccionado(actual.controles[numero - 1]!);
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [actual, avanzar, ejecutar, fase, seleccionado]);

  /*
    La sonda del jugador simulado, y solo en desarrollo.

    Es el instrumento con el que se calibró el reloj. Jugar a mano cien órdenes
    para medir cuántas se pierden por tiempo no es viable, y manejar el navegador
    desde fuera añade medio segundo por gesto, que es justo lo que se está
    midiendo. Así que la medida se hace DENTRO de la página: un guion lee esto,
    decide qué habría hecho alguien que entiende el 96 % de lo que oye, y pulsa
    las mismas teclas que pulsaría una persona, con sus tiempos.
    `import.meta.env.DEV` hace que nada de esto llegue a producción.

    Lo que expone ya está en memoria —la orden tiene que estar aquí para poder
    decirla en voz alta— así que no abre ningún agujero que no estuviera abierto.
  */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const ventana = window as unknown as { __brechaSonda?: unknown };
    ventana.__brechaSonda = {
      fase,
      orden: actual ?? null,
      hechos,
      vidas,
      aciertos,
      contestadas,
      resultado,
      ventanaMs,
    };
    return () => {
      delete ventana.__brechaSonda;
    };
  }, [fase, actual, hechos, vidas, aciertos, contestadas, resultado, ventanaMs]);

  const hitos = useMemo(() => [ronda.hitos.izq, ronda.hitos.der] as const, [ronda.hitos]);

  if (voz === 'comprobando') {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-[var(--texto-suave)]">Estableciendo contacto con la IA…</p>
      </div>
    );
  }

  if (fase === 'informe') {
    return (
      <Informe
        hitos={hitos}
        conVoz={voz === 'si'}
        ordenes={ronda.ordenes.length}
        vidas={ronda.vidas}
        onEmpezar={() => setFase('dictando')}
        onSalir={onSalir}
      />
    );
  }

  if (!actual) return null;

  const segundos = Math.max(0, Math.ceil((queda * ventanaMs) / 1000));
  const apurado = fase === 'ejecutando' && queda <= 0.34;
  const ahogado = fase === 'ejecutando' && queda <= 0.15;
  const perdida = vidas === 0 && fase === 'resultado';
  /*
    Cuándo se ve la orden escrita: mientras se dicta si no hay voz, y cuando se
    pide el registro de emergencia a mitad de la maniobra. Con voz, durante el
    dictado NO se ve: eso es lo que hace que sea comprensión auditiva.
  */
  const registroVisible = (fase === 'dictando' && voz !== 'si') || registro;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-3">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold leading-none tabular-nums">
            {indice + 1}
            <span className="text-base font-bold text-[var(--texto-suave)]">
              /{ronda.ordenes.length}
            </span>
          </p>
          <p className="text-xs text-[var(--texto-suave)]">órdenes</p>
        </div>
        <Integridad vidas={vidas} total={ronda.vidas} />
        <Contador
          etiqueta="Puntos"
          valor={puntuacion}
          tono={aciertos > 0 ? 'acierto' : 'normal'}
          vivo
        >
          {resultado?.acerto && (
            <PuntosGanados
              key={contestadas}
              puntos={loQueSumaElSiguiente('BRECHA', aciertos - 1)}
            />
          )}
        </Contador>
      </CabeceraJuego>

      {fase === 'resultado' && (
        <Destello key={contestadas} senal={resultado?.acerto ? 'acierto' : 'fallo'} />
      )}

      <div className="mt-2 flex min-h-8 items-center">
        <Racha racha={racha} />
      </div>

      <Comunicaciones
        orden={actual}
        fase={fase}
        resultado={resultado}
        racha={racha}
        registro={registro}
        conVoz={voz === 'si'}
        queda={queda}
        segundos={segundos}
        apurado={apurado}
        ahogado={ahogado}
        menosMovimiento={menosMovimiento}
      />

      <div className="relative mt-2 flex min-h-0 flex-1 flex-col">
        {/*
          La orden escrita, flotando sobre el panel.

          Va encima y no dentro de la consola porque su alto depende de lo larga
          que sea la orden, y una consola que crece y encoge movería el panel
          justo cuando se está apuntando a un aparato. Flotando tapa la fila de
          arriba mientras se lee, que además es lo que se quiere: el registro se
          lee, no se cruza con el panel.
        */}
        {registroVisible && (
          <p
            lang="en"
            className="absolute inset-x-0 top-0 z-10 rounded-2xl border-2 border-cyan-500 bg-slate-900 px-3 py-2 text-[15px] font-bold leading-snug text-slate-100 shadow-lg"
          >
            {actual.textoEn}
          </p>
        )}

        <Panel
          orden={actual}
          hitos={hitos}
          hechos={hechos}
          seleccionado={seleccionado}
          fase={fase}
          resultado={resultado}
          onElegir={setSeleccionado}
        />

        <div className="mt-2">
          {/*
            Leer no es lo que se mide, así que no se obliga a esperar.

            El registro escrito se queda el rato que calculó el servidor a
            catorce caracteres por segundo, que es lo que tarda en leerlo alguien
            que va justo. Quien lo lea antes pulsa aquí y empieza la maniobra:
            no gana nada —la ventana es la misma— pero se ahorra mirar una
            pantalla que ya ha entendido, que es de las cosas que más cansan de
            un juego con reloj.
          */}
          {fase === 'dictando' && voz !== 'si' ? (
            <Boton tono="suave" onClick={() => setFase('ejecutando')}>
              LISTO, YA LA TENGO
            </Boton>
          ) : seleccionado ? (
            <Gestos
              control={seleccionado}
              onGesto={(accion) => ejecutar(seleccionado, accion)}
              onVolver={() => setSeleccionado(null)}
            />
          ) : (
            <Maniobra
              orden={actual}
              hechos={hechos}
              activo={fase === 'ejecutando'}
              onRegistro={() => setRegistro(true)}
            />
          )}
        </div>

        {fase === 'resultado' && resultado && (
          <LoQueEnsena orden={actual} resultado={resultado} perdida={perdida} onSeguir={avanzar} />
        )}
      </div>
    </div>
  );
}

/* ----------------------------------- */
/* El informe de antes de empezar.     */
/* ----------------------------------- */

/**
 * El parte de situación, y no es adorno de ambientación.
 *
 * Hace tres trabajos que si no habría que hacer perdiendo vidas:
 *
 *   1. Enseña las cuatro palabras del panel —screen, vent, lamp, pipe— que son
 *      las que anclan todas las preposiciones. Descubrirlas fallando cuesta una
 *      vida por palabra, y fallar por no saber una palabra que nadie te ha dicho
 *      no enseña nada.
 *   2. Explica que son dos toques: el aparato y luego el gesto.
 *   3. Dice si la orden se va a OÍR o a LEER, y por qué. Sin esto, quien no
 *      tenga voces inglesas instaladas creería que se le ha roto el sonido, que
 *      es exactamente lo que pasó en los dictados de la prueba de nivel.
 */
function Informe({
  hitos,
  conVoz,
  ordenes,
  vidas,
  onEmpezar,
  onSalir,
}: {
  hitos: readonly (readonly string[])[];
  conVoz: boolean;
  ordenes: number;
  vidas: number;
  onEmpezar: () => void;
  onSalir: () => void;
}) {
  const nombres = hitos.flatMap((columna) => [...columna]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <CabeceraJuego onSalir={onSalir} />

      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-900 p-3 text-slate-100">
        <Mascota estado="hablando" tamano={56} />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
            Canal de emergencia
          </p>
          <p className="text-sm font-bold leading-snug">
            Soy la IA de la estación. Te voy a dictar {ordenes} protocolos en inglés. Hazlos tal
            cual los digo.
          </p>
        </div>
      </div>

      <ul className="mt-5 grid gap-3 text-sm">
        <li className="flex gap-2">
          <span aria-hidden>①</span>
          <span>
            {conVoz
              ? 'Escucha la orden. Se dice una vez.'
              : 'Lee la orden. El registro se borra solo.'}
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>②</span>
          <span>
            Toca el aparato del panel y después el gesto. <strong>El sitio importa</strong>: hay dos
            aparatos iguales y solo uno está donde dice la orden.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>③</span>
          <span>
            Un error es una falla crítica. Aguantas {vidas}. Con teclado, las teclas del 1 al 6.
          </span>
        </li>
      </ul>

      {/*
        Las cuatro palabras que anclan todas las preposiciones del juego. Van
        aquí y no dentro de la partida porque dentro no hay tiempo de leer nada.
      */}
      <div className="mt-5 rounded-2xl border-2 border-[var(--borde)] p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--texto-suave)]">
          El panel
        </p>
        {/*
          Una columna a 320 y dos a partir de 360.

          Con dos columnas fijas, «SCREEN la pantalla» partía «la» y «pantalla»
          en dos líneas y la lista se leía como un crucigrama.
        */}
        <ul className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-sm min-[360px]:grid-cols-2">
          {nombres.map((nombre) => (
            <li key={nombre} className="flex items-center gap-1.5">
              <HitoDibujado nombre={nombre} />
              <span lang="en" className="font-extrabold uppercase">
                {nombre}
              </span>
              <span className="text-[var(--texto-suave)]">{HITOS_ES[nombre] ?? ''}</span>
            </li>
          ))}
        </ul>
      </div>

      {!conVoz && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-[var(--texto-aviso)] dark:bg-amber-950/30">
          Tu equipo no tiene ninguna voz en inglés instalada, así que las órdenes van escritas en
          vez de habladas. Podríamos leerlas con la voz española que tienes, pero sonarían mal y
          aprenderías una pronunciación que no existe. En Windows se añaden desde Configuración →
          Hora e idioma → Idioma y región.
        </p>
      )}

      <div className="mt-auto pt-6">
        <Boton tamano="grande" onClick={onEmpezar}>
          ENTENDIDO, EMPIEZA
        </Boton>
      </div>
    </div>
  );
}

/* ----------------------------------- */
/* La consola de la IA.                */
/* ----------------------------------- */

/**
 * La pantalla por la que habla Milo, con la ventana de ejecución debajo.
 *
 * Va oscura en los dos temas a propósito, y no es un capricho de ambientación:
 * es lo que la separa del panel de máquinas que tiene debajo. Una pantalla es
 * oscura; un panel de aparatos, no. Con las dos cosas del color de la superficie
 * había que leer para saber cuál era cuál.
 *
 * Milo NO está de adorno: es la IA. Habla mientras dicta, vigila mientras se
 * ejecuta, se sorprende cuando quedan tres segundos y se hunde cuando revienta
 * algo. Es el único personaje del juego y lo que hace que la orden venga de
 * alguien en vez de salir de un cuadro de texto.
 */
function Comunicaciones({
  orden,
  fase,
  resultado,
  racha,
  registro,
  conVoz,
  queda,
  segundos,
  apurado,
  ahogado,
  menosMovimiento,
}: {
  orden: OrdenDeBrecha;
  fase: Fase;
  resultado: Resultado | null;
  racha: number;
  registro: boolean;
  conVoz: boolean;
  queda: number;
  segundos: number;
  apurado: boolean;
  ahogado: boolean;
  menosMovimiento: boolean;
}) {
  const dictando = fase === 'dictando';
  // Sin voz, la orden se lee mientras se dicta; con voz solo si se pide el
  // registro de emergencia, que cuesta segundos de la ventana.
  const seVe = (dictando && !conVoz) || registro;

  const estado: EstadoMascota = dictando
    ? 'hablando'
    : fase === 'resultado'
      ? resultado?.acerto
        ? racha >= 4
          ? 'orgulloso'
          : 'celebrando'
        : 'triste'
      : ahogado
        ? 'sorprendido'
        : 'escuchando';

  const titular = dictando
    ? conVoz
      ? 'Transmitiendo protocolo…'
      : 'Registro temporal'
    : fase === 'resultado'
      ? resultado?.acerto
        ? 'Secuencia ejecutada. Sistema estable.'
        : resultado?.sinTiempo
          ? 'Sin respuesta. Brecha en el casco.'
          : `Falla crítica en el paso ${resultado?.pasoFallado ?? 1}.`
      : 'Ejecuta el protocolo.';

  return (
    <section className="rounded-2xl bg-slate-900 px-3 py-2 text-slate-100">
      <div className="flex items-center gap-2">
        <Mascota estado={estado} tamano={44} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
            Milo · IA de la estación
          </p>
          <p className="truncate text-sm font-bold">{titular}</p>
        </div>

        {fase === 'ejecutando' && (
          <span
            aria-hidden
            className={cn(
              'shrink-0 text-3xl font-extrabold tabular-nums',
              ahogado ? 'text-red-400' : apurado ? 'text-amber-300' : 'text-slate-100',
            )}
          >
            {segundos}
          </span>
        )}
      </div>

      {/*
        La línea de estado de la transmisión, que NO es la orden.

        La orden escrita no va aquí: va flotando sobre el panel, y el motivo es
        de alto. Una orden de ciento treinta caracteres ocupa cinco líneas a 320
        píxeles, así que meterla en esta consola la haría crecer noventa píxeles
        y encoger de golpe al borrarse. Y eso es justo en mitad de la maniobra,
        con el dedo apuntando a un aparato que se movería debajo. Flotando, la
        consola mide siempre lo mismo y el panel no se mueve nunca.
      */}
      <p aria-hidden className="mt-1 text-xs tracking-[0.3em] text-slate-500">
        {seVe ? '' : '· · · · · · · ·'}
      </p>

      {fase === 'ejecutando' && (
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700">
          <div
            className={cn(
              'h-full rounded-full',
              ahogado ? 'bg-red-500' : apurado ? 'bg-amber-400' : 'bg-cyan-400',
            )}
            /*
              Con movimiento reducido la barra no se dibuja vaciándose: se queda
              entera y quien cuenta el tiempo es el número de arriba, que cambia
              una vez por segundo. No es una versión recortada del juego, es la
              misma información sin nada que se mueva.
            */
            style={{ width: menosMovimiento ? '100%' : `${Math.max(0, queda) * 100}%` }}
          />
        </div>
      )}

      {/*
        Lo que pasa, para quien no ve la pantalla.

        El registro de emergencia se anuncia TAMBIÉN, y no es un detalle: con voz
        la orden solo se oye, y el botón «registro» la vuelve a enseñar escrita.
        Si solo se pintara, ese botón no existiría para quien usa un lector de
        pantalla, que es justo a quien más le puede fallar oírla la primera vez.
      */}
      <p role="status" className="sr-only">
        {seVe ? `Orden: ${orden.textoEn}` : ''}
        {fase === 'resultado' ? titular : ''}
      </p>
    </section>
  );
}

/* ----------------------------------- */
/* El panel de máquinas.               */
/* ----------------------------------- */

function Panel({
  orden,
  hitos,
  hechos,
  seleccionado,
  fase,
  resultado,
  onElegir,
}: {
  orden: OrdenDeBrecha;
  hitos: readonly (readonly string[])[];
  hechos: string[];
  seleccionado: ControlDelPanel | null;
  fase: Fase;
  resultado: Resultado | null;
  onElegir: (control: ControlDelPanel) => void;
}) {
  const porRanura = new Map(orden.controles.map((control) => [control.ranura, control]));
  const tocados = new Set(hechos.map((gesto) => gesto.split(':')[0]));

  /*
    Al resolverse la orden se numeran los aparatos que HABÍA que tocar.

    Es la mitad de lo que enseña un fallo: ver la secuencia buena escrita en
    español está bien, pero verla señalada en el propio panel es lo que deja la
    preposición pegada al sitio.
  */
  const senalados = new Map<string, number[]>();
  if (fase === 'resultado') {
    orden.pasos.forEach((paso, indice) => {
      senalados.set(paso.controlId, [...(senalados.get(paso.controlId) ?? []), indice + 1]);
    });
  }

  return (
    <div className="rounded-2xl border-2 border-slate-300 bg-linear-to-b from-slate-200 to-slate-100 p-2 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
      {FILAS.map((fila, numeroDeFila) => (
        <div key={numeroDeFila}>
          <div className="grid grid-cols-2 gap-2">
            {fila.map((ranura, columna) => {
              const control = porRanura.get(ranura);
              if (!control) return <div key={ranura} />;

              const numero = orden.controles.indexOf(control) + 1;
              return (
                <Aparato
                  key={ranura}
                  control={control}
                  numero={numero}
                  sitio={sitioDe(numeroDeFila, hitos[columna] ?? [])}
                  elegido={seleccionado?.id === control.id}
                  tocado={tocados.has(control.id)}
                  senalado={senalados.get(control.id) ?? null}
                  bien={resultado?.acerto ?? null}
                  apagado={fase !== 'ejecutando'}
                  onElegir={() => onElegir(control)}
                />
              );
            })}
          </div>

          {numeroDeFila < FILAS.length - 1 && (
            <div className="my-1.5 grid grid-cols-2 gap-2">
              {hitos.map((columna, indice) => (
                <Hito key={indice} nombre={columna[numeroDeFila] ?? ''} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Aparato({
  control,
  numero,
  sitio,
  elegido,
  tocado,
  senalado,
  bien,
  apagado,
  onElegir,
}: {
  control: ControlDelPanel;
  numero: number;
  sitio: string;
  elegido: boolean;
  tocado: boolean;
  senalado: number[] | null;
  bien: boolean | null;
  apagado: boolean;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      disabled={apagado}
      aria-keyshortcuts={String(numero)}
      aria-label={`${control.color} ${control.tipo}: ${TIPOS_ES[control.tipo] ?? control.tipo} ${COLORES_ES[control.color] ?? control.color}, ${sitio}`}
      onClick={onElegir}
      className={cn(
        'relative flex min-h-[62px] w-full flex-col items-center justify-center gap-0.5 rounded-xl border-2 bg-[var(--superficie)] transition',
        'border-slate-300 dark:border-slate-600',
        !apagado && 'hover:border-cyan-500 active:scale-95',
        elegido && 'border-cyan-500 ring-2 ring-cyan-400',
        tocado && !senalado && 'opacity-45',
        senalado && (bien ? 'border-emerald-500' : 'border-amber-500'),
      )}
    >
      <span
        aria-hidden
        className="absolute left-1 top-0.5 text-[10px] font-bold text-[var(--texto-suave)]"
      >
        {numero}
      </span>

      {senalado && (
        <span
          aria-hidden
          className={cn(
            'absolute right-1 top-0.5 rounded-full px-1.5 text-[10px] font-extrabold text-white',
            bien ? 'bg-emerald-600' : 'bg-amber-600',
          )}
        >
          {senalado.join('·')}
        </span>
      )}

      <AparatoDibujado tipo={control.tipo} color={control.color} />
      <span lang="en" className="text-[11px] font-extrabold uppercase tracking-wide">
        {control.tipo}
      </span>
    </button>
  );
}

/**
 * Los cuatro aparatos, dibujados.
 *
 * Van en SVG y no con emojis por dos motivos: ninguno de los cuatro tiene un
 * emoji que se parezca —lo más cercano a una válvula es un engranaje— y, sobre
 * todo, el color TIENE que ser el de la orden. Un emoji no se puede teñir, y el
 * color es la mitad de lo que hay que entender.
 */
function AparatoDibujado({ tipo, color }: { tipo: string; color: string }) {
  const tinta = TINTA[color] ?? '#94a3b8';

  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
      {/* Un borde oscuro alrededor para que el blanco y el amarillo se vean
          sobre la tarjeta clara. */}
      <g stroke="#0f172a" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round">
        {tipo === 'valve' && (
          <>
            <circle cx="12" cy="12" r="6.5" fill={tinta} />
            <path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6L6 18" />
            <circle cx="12" cy="12" r="2" fill="#0f172a" stroke="none" />
          </>
        )}
        {tipo === 'lever' && (
          <>
            <rect x="4" y="16" width="16" height="5" rx="1.5" fill={tinta} />
            <path d="M12 18L17 6" strokeWidth="2.4" />
            <circle cx="17.5" cy="5" r="3" fill={tinta} />
          </>
        )}
        {tipo === 'hatch' && (
          <>
            <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill={tinta} />
            <circle cx="12" cy="12" r="4" fill="none" />
            <path d="M12 8V4M12 20v-4M8 12H4M20 12h-4" />
          </>
        )}
        {tipo === 'pump' && (
          <>
            <rect x="3.5" y="9" width="17" height="11" rx="2" fill={tinta} />
            <circle cx="12" cy="14.5" r="3" fill="none" />
            <path d="M8 9V6h8v3" />
          </>
        )}
      </g>
    </svg>
  );
}

/** Uno de los cuatro hitos que dan nombre a los sitios del panel. */
function Hito({ nombre }: { nombre: string }) {
  return (
    <div
      className="flex items-center justify-center gap-1 rounded-lg bg-slate-300/80 py-0.5 dark:bg-slate-700/80"
      aria-hidden
    >
      <HitoDibujado nombre={nombre} />
      <span
        lang="en"
        className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200"
      >
        {nombre}
      </span>
    </div>
  );
}

function HitoDibujado({ nombre }: { nombre: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        className="text-slate-600 dark:text-slate-300"
      >
        {nombre === 'screen' && (
          <>
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M9 20h6" />
          </>
        )}
        {nombre === 'vent' && <path d="M4 7h16M4 12h16M4 17h16" />}
        {nombre === 'lamp' && (
          <>
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
          </>
        )}
        {nombre === 'pipe' && (
          <>
            <path d="M3 9h10a3 3 0 013 3v9" />
            <path d="M14 7h5M14 11h5" />
          </>
        )}
      </g>
    </svg>
  );
}

/* ----------------------------------- */
/* Los dos gestos del aparato elegido. */
/* ----------------------------------- */

/**
 * Los gestos van SIEMPRE en inglés y sin traducción al lado.
 *
 * Es lo que se está midiendo: saber que «counter-clockwise» no es «clockwise» y
 * que «seal» es cerrar. Poner «(cerrar)» debajo convertiría media orden en un
 * trámite de emparejar palabras. La traducción aparece después, cuando la orden
 * ya se ha resuelto y sirve para aprender en vez de para aprobar.
 *
 * El dibujo de al lado tampoco la regala: hay que saber la palabra para saber
 * qué flecha buscar.
 */
function Gestos({
  control,
  onGesto,
  onVolver,
}: {
  control: ControlDelPanel;
  onGesto: (accion: string) => void;
  onVolver: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="truncate text-xs text-[var(--texto-suave)]">
          <span lang="en" className="font-bold uppercase">
            {control.color} {control.tipo}
          </span>{' '}
          — ¿qué le hago?
        </p>
        <button
          type="button"
          onClick={onVolver}
          className="shrink-0 text-xs text-[var(--texto-suave)] underline underline-offset-2"
        >
          otro
        </button>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-2">
        {control.acciones.map((accion, indice) => (
          <button
            key={accion}
            type="button"
            lang="en"
            autoFocus={indice === 0}
            aria-keyshortcuts={String(indice + 1)}
            onClick={() => onGesto(accion)}
            className="boton-3d relative flex min-h-14 items-center justify-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-slate-700 px-2 text-center text-[13px] font-extrabold uppercase leading-none tracking-wide text-white hover:bg-slate-600"
          >
            <span
              aria-hidden
              className="absolute left-1.5 top-1 text-[10px] font-bold text-slate-300"
            >
              {indice + 1}
            </span>
            <GestoDibujado accion={accion} />
            <span className="max-w-[86px] break-words">{accion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GestoDibujado({ accion }: { accion: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        {accion === 'clockwise' && (
          <>
            <path d="M20 12a8 8 0 10-3 6.2" />
            <path d="M20 5v7h-7" />
          </>
        )}
        {accion === 'counter-clockwise' && (
          <>
            <path d="M4 12a8 8 0 113 6.2" />
            <path d="M4 5v7h7" />
          </>
        )}
        {accion === 'up' && <path d="M12 20V5M6 11l6-6 6 6" />}
        {accion === 'down' && <path d="M12 4v15M6 13l6 6 6-6" />}
        {accion === 'open' && <path d="M8 4v16M8 12h12M15 8l5 4-5 4" />}
        {accion === 'close' && <path d="M16 4v16M16 12H4M9 8l-5 4 5 4" />}
        {accion === 'on' && (
          <>
            <circle cx="12" cy="12" r="7" fill="currentColor" />
          </>
        )}
        {accion === 'off' && <circle cx="12" cy="12" r="7" />}
      </g>
    </svg>
  );
}

/* ----------------------------------- */
/* Por dónde va la maniobra.           */
/* ----------------------------------- */

/**
 * Cuántos gestos lleva la maniobra y cuántos van.
 *
 * No dice cuáles: eso sería la respuesta. Dice cuántos quedan, que es lo que
 * hace falta para saber si la orden ya está entera o falta algo, y es
 * exactamente lo que sabría alguien que acaba de oírla.
 */
function Maniobra({
  orden,
  hechos,
  activo,
  onRegistro,
}: {
  orden: OrdenDeBrecha;
  hechos: string[];
  activo: boolean;
  onRegistro: () => void;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <span className="sr-only">
          Gesto {Math.min(hechos.length + 1, orden.pasos.length)} de {orden.pasos.length}
        </span>
        {orden.pasos.map((_, indice) => (
          <span
            key={indice}
            aria-hidden
            className={cn(
              'size-3 rounded-full border-2',
              indice < hechos.length
                ? 'border-cyan-500 bg-cyan-500'
                : 'border-[var(--hueco)] bg-transparent',
            )}
          />
        ))}
        <span className="ml-1 text-xs text-[var(--texto-suave)]">{orden.pasos.length} gestos</span>
      </div>

      {/*
        La salida de emergencia, y cuesta lo que tiene que costar.

        Volver a ver la orden son dos segundos de la ventana, que en la más
        apretada es más de un tercio. Sin este botón, una palabra que no se ha
        oído bien es una vida perdida sin remedio; con él gratis, nadie
        escucharía nunca.
      */}
      <button
        type="button"
        disabled={!activo}
        onClick={onRegistro}
        aria-keyshortcuts="r"
        className="min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold uppercase tracking-wide text-[var(--texto-suave)] underline underline-offset-4 disabled:opacity-40"
      >
        Registro (R)
      </button>
    </div>
  );
}

/** Las vidas: la integridad del casco. */
function Integridad({ vidas, total }: { vidas: number; total: number }) {
  return (
    <div className="shrink-0 text-right">
      <p className="flex items-center justify-end gap-1 leading-none" aria-hidden>
        {Array.from({ length: total }, (_, indice) => (
          <span
            key={indice}
            className={cn(
              'block h-4 w-2 rounded-sm',
              indice < vidas ? 'bg-emerald-500' : 'bg-[var(--hueco)]',
            )}
          />
        ))}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
        <span className="sr-only">
          Integridad: {vidas} de {total}.{' '}
        </span>
        Casco
      </p>
    </div>
  );
}

/* ----------------------------------- */
/* El rato que enseña.                 */
/* ----------------------------------- */

/**
 * Lo que se ve cuando la orden ya se resolvió.
 *
 * No dice «error». Dice la orden en inglés —que hasta ahora solo se había
 * oído—, lo que significaba entera, y qué era exactamente lo que había que
 * pillar. Eso último es lo que separa este rato de un marcador: saber que
 * fallaste no enseña nada; saber que «after you» adelanta lo que viene detrás,
 * sí.
 *
 * Se enseña TAMBIÉN al acertar, aunque más corto y sin la explicación: acertar
 * por corazonada y no llegar a ver de qué iba es medio aprendizaje tirado.
 *
 * Va como una tarjeta encima del panel y no en su sitio porque el panel tiene
 * que seguir viéndose: los aparatos que había que tocar están ahí numerados, y
 * ver el «1» sobre la válvula de debajo de la pantalla es lo que ata la
 * preposición al sitio.
 */
function LoQueEnsena({
  orden,
  resultado,
  perdida,
  onSeguir,
}: {
  orden: OrdenDeBrecha;
  resultado: Resultado;
  perdida: boolean;
  onSeguir: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        'absolute inset-x-0 bottom-0 rounded-2xl border-2 p-3 shadow-lg',
        resultado.acerto
          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950'
          : 'border-red-500 bg-red-50 dark:bg-red-950',
      )}
    >
      <p
        className={cn(
          'text-xs font-extrabold uppercase tracking-wide',
          resultado.acerto ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-fallo)]',
        )}
      >
        {perdida
          ? 'Se perdió la estación'
          : resultado.acerto
            ? 'Sistema estable'
            : resultado.sinTiempo
              ? 'Se acabó el tiempo'
              : `Falla crítica en el paso ${resultado.pasoFallado}`}
      </p>

      <p lang="en" className="mt-1 text-sm font-bold leading-snug">
        {orden.textoEn}
      </p>
      <p className="mt-1 text-sm leading-snug text-[var(--texto-suave)]">{orden.traduccionEs}</p>

      {!resultado.acerto && (
        <p className="mt-1.5 text-sm font-semibold leading-snug">{orden.ensena}</p>
      )}

      <div className="mt-2">
        <Boton tono={resultado.acerto ? 'acierto' : 'marca'} onClick={onSeguir}>
          {perdida ? 'VER EL BALANCE' : 'SEGUIR'}
        </Boton>
      </div>
    </div>
  );
}

/* ----------------------------------- */
/* Cuentas sueltas.                    */
/* ----------------------------------- */

/** Cómo viaja un gesto. Copia a mano de `gestoDe` en `back/.../brecha.ts`. */
function gestoDe(paso: { controlId: string; accion: string }): string {
  return `${paso.controlId}:${paso.accion}`;
}

/** Los escalones vienen del servidor; más allá del último, se repite el último. */
function escalonDe(ronda: RondaDeBrecha, paso: number): number {
  const escalones = ronda.reloj.escalones;
  if (!escalones || escalones.length === 0) return 4000;
  return escalones[Math.min(Math.max(paso, 0), escalones.length - 1)]!;
}

/**
 * Cómo se dice en español dónde está una casilla.
 *
 * Solo lo lee quien no ve la pantalla, y por eso da las DOS referencias cuando
 * las hay: la casilla de en medio está debajo de un hito y encima del otro, y
 * quedarse con una sola dejaría media orden sin poder resolverse de oído.
 */
function sitioDe(fila: number, columna: readonly string[]): string {
  const arriba = columna[fila - 1];
  const abajo = columna[fila];

  // «bajo» y «sobre» y no «debajo de» y «encima de»: con la preposición larga
  // salía «encima de el piloto», porque los hitos vienen con su artículo.
  const trozos = [
    arriba ? `bajo ${HITOS_ES[arriba] ?? arriba}` : null,
    abajo ? `sobre ${HITOS_ES[abajo] ?? abajo}` : null,
  ].filter(Boolean);

  return trozos.join(' y ');
}
