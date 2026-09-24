import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Mascota } from '@/components/Mascota';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { CabeceraJuego, Contador, Racha } from './Tablero';
import { Destello, PuntosGanados } from './efectos';
import { loQueSumaElSiguiente, puntosDelServidor } from './puntos';
import type { CartaDeFalsoAmigo, Marcador, RespuestaCorregida, RondaDeFalsosAmigos } from './tipos';

/**
 * FALSOS_AMIGOS: sale una palabra con una traducción y hay que decir si cuela.
 *
 * «embarrassed — embarazada». Izquierda si es trampa, derecha si es verdad, y
 * queda un par de segundos. Cada acierto seguido aprieta un poco el reloj.
 *
 *
 * POR QUÉ HAY QUE IR DEPRISA
 *
 * Porque el error vive en el reflejo. Estas palabras no se fallan por no saber
 * inglés: se fallan porque se parecen a una española y el cerebro traduce sin
 * pedir permiso. Con diez segundos por carta cualquiera repasa mentalmente la
 * lista y acierta, y entonces el juego mide la memoria en vez del instinto, que
 * es justo lo que hay que corregir. La prisa no es el adorno del juego, es el
 * juego.
 *
 * Los números del reloj los manda el servidor ya calculados (`reloj.escalones`)
 * y están razonados en `back/src/modules/games/falsos-amigos.ts`. Resumen: de 4
 * segundos a 1,6, y de 1,6 no baja, porque por debajo de eso ya no se mide si
 * alguien sabe que «actually» no es actualmente, se mide su tiempo de reacción.
 *
 *
 * EL MEDIO SEGUNDO QUE ENSEÑA
 *
 * Al fallar se para y se enseña qué significaba de verdad. Es lo único de este
 * juego que no va deprisa, y es lo que lo convierte en aprender en vez de en un
 * examen: el fallo por instinto solo se corrige viendo la respuesta buena justo
 * después de haberse equivocado, con el error todavía caliente.
 */

/** Lo que dura el «bien» de un acierto. Corto: la prisa es el juego. */
const MS_REVELA_ACIERTO = 550;

/**
 * Y lo que dura el fallo: casi dos segundos.
 *
 * Es tiempo de leer «exit no es éxito, es salida» entero y sin agobio. Acortarlo
 * ahorraría un segundo por fallo y quitaría lo único que este juego enseña.
 */
const MS_REVELA_FALLO = 1900;

/** Lo que manda el navegador cuando la carta se agotó sin tocar nada. */
const SE_ACABO = 'tiempo';
const DICE_FALSO = 'falso';
const DICE_VERDADERO = 'verdadero';

type Respuesta = typeof SE_ACABO | typeof DICE_FALSO | typeof DICE_VERDADERO;

interface Veredicto {
  respuesta: Respuesta;
  acerto: boolean;
  carta: CartaDeFalsoAmigo;
}

export function FalsosAmigos({
  ronda,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeFalsosAmigos;
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();

  const [indice, setIndice] = useState(0);
  const [veredicto, setVeredicto] = useState<Veredicto | null>(null);

  /**
   * En qué escalón del reloj va la partida.
   *
   * Sube uno por acierto y baja `pasosAtrasAlFallar` al fallar, que es lo que
   * convierte el reloj en una dificultad que se adapta: aprieta a quien encadena
   * y cede a quien se atasca, en vez de dejar a nadie fuera.
   */
  const [paso, setPaso] = useState(0);

  const [aciertos, setAciertos] = useState(0);
  const [contestadas, setContestadas] = useState(0);
  const [racha, setRacha] = useState(0);
  /*
    La racha viva se rompe al fallar; la que PAGA es la más larga de la partida.
    Se guarda aparte para que el marcador de arriba enseñe exactamente lo que va
    a cerrar el servidor: un número que no cuadra al final se lee como una
    estafa, y ya nos pasó una vez.
  */
  const [rachaMaxima, setRachaMaxima] = useState(0);

  /**
   * Lo que le queda a la carta, en milisegundos. Solo sirve para pintar.
   *
   * Va con el identificador de la carta a la que pertenece, y eso no sobra: el
   * cronómetro lo arranca un efecto, que corre DESPUÉS de pintar. Sin la marca,
   * el primer fotograma de cada carta enseñaba lo que le quedaba a la anterior
   * —un salto de tres segundos a medio—, y en un juego donde la barra es la
   * mitad de la información eso es enseñar un dato falso justo al empezar.
   */
  const [cuenta, setCuenta] = useState<{ id: string; ms: number }>({ id: '', ms: 0 });

  const carta = ronda.cartas[indice];
  const duracion = escalonDe(ronda, paso);
  const puntuacion = puntosDelServidor('FALSOS_AMIGOS', aciertos, rachaMaxima);

  /*
    Las respuestas que todavía viajan al servidor.

    El `/fin` no puede adelantarlas: si la partida se cerrara antes de que llegue
    la última carta, la puntuación final saldría por debajo de la que se acaba de
    ver subir. Es lo mismo que hace CAEN con las caídas.
  */
  const pendientes = useRef<Array<Promise<unknown>>>([]);

  const marcador = useRef<Marcador>({ puntuacion: 0, aciertos: 0, total: 0 });
  marcador.current = { puntuacion, aciertos, total: contestadas };

  const terminado = useRef(false);
  const terminar = useCallback(() => {
    if (terminado.current) return;
    terminado.current = true;
    const fin = marcador.current;
    void Promise.allSettled(pendientes.current).then(() => onFin(fin));
  }, [onFin]);

  const responder = useCallback(
    (respuesta: Respuesta) => {
      if (!carta) return;

      // La verdad está en la propia carta: el servidor mandó `verdadera` con la
      // ronda justo para poder pintar el veredicto sin esperar a nadie. Él sigue
      // llevando la cuenta buena, carta a carta.
      const acerto = respuesta === (carta.verdadera ? DICE_VERDADERO : DICE_FALSO);
      const nuevaRacha = acerto ? racha + 1 : 0;

      setVeredicto({ respuesta, acerto, carta });
      setContestadas((n) => n + 1);
      setRacha(nuevaRacha);
      setRachaMaxima((mejor) => Math.max(mejor, nuevaRacha));
      setPaso((actual) =>
        acerto ? actual + 1 : Math.max(actual - ronda.reloj.pasosAtrasAlFallar, 0),
      );
      if (acerto) setAciertos((n) => n + 1);

      if (!acerto) sonar('fallo');
      else if (nuevaRacha >= 2) sonar('combo', { racha: nuevaRacha });
      else sonar('acierto');

      /*
        Se avisa al servidor y no se espera. Si la petición se pierde, esa carta
        no cuenta para la puntuación del servidor y sí para la de la pantalla:
        es un descuadre de diez puntos que el servidor ya sabe detectar y anotar,
        y es preferible a congelar una carta de segundo y medio esperando a la
        red. Quedarse sin tiempo TAMBIÉN se manda, porque si no, la racha del
        servidor no se rompería nunca.
      */
      pendientes.current.push(onResponder(carta.id, respuesta).catch(() => undefined));
    },
    [carta, onResponder, racha, ronda.reloj.pasosAtrasAlFallar],
  );

  /*
    El reloj de la carta, en un `ref` para que cambiar de carta no lo reinicie
    a mitad: el efecto de abajo solo depende de qué carta es y de cuánto dura.
  */
  const responderRef = useRef(responder);
  responderRef.current = responder;

  useEffect(() => {
    if (!carta || veredicto) return;

    const fin = Date.now() + duracion;
    setCuenta({ id: carta.id, ms: duracion });

    /*
      Bajo `prefers-reduced-motion` la barra se refresca cada cuarto de segundo
      en vez de cada cuadro: sigue diciendo cuánto queda —que es información, no
      adorno, y sin ella el juego no se puede jugar— pero avanza a saltos en vez
      de deslizarse. El número de al lado dice lo mismo con cifras.
    */
    const pulso = window.setInterval(
      () => setCuenta({ id: carta.id, ms: Math.max(0, fin - Date.now()) }),
      menosMovimiento ? 250 : 60,
    );
    const agotada = window.setTimeout(() => responderRef.current(SE_ACABO), duracion);

    return () => {
      window.clearInterval(pulso);
      window.clearTimeout(agotada);
    };
  }, [carta, duracion, menosMovimiento, veredicto]);

  // Pasado el veredicto, la siguiente carta. Al fallar se espera más: ese rato
  // leyendo lo que significaba de verdad es todo lo que este juego enseña.
  useEffect(() => {
    if (!veredicto) return;

    const espera = window.setTimeout(
      () => {
        setVeredicto(null);
        setIndice((n) => n + 1);
      },
      veredicto.acerto ? MS_REVELA_ACIERTO : MS_REVELA_FALLO,
    );

    return () => window.clearTimeout(espera);
  }, [veredicto]);

  useEffect(() => {
    if (!carta && !veredicto) terminar();
  }, [carta, veredicto, terminar]);

  /*
    Las flechas del teclado, que es como se pidió y como se juega en un
    ordenador. Se ponen en `window` y no en los botones porque no hay ninguno
    enfocado al empezar la carta, y exigir un tabulador antes de cada partida
    sería exigir un trámite dentro de un juego de reflejos.
  */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
      evento.preventDefault();
      responderRef.current(evento.key === 'ArrowLeft' ? DICE_FALSO : DICE_VERDADERO);
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  // Mientras el efecto no haya arrancado el cronómetro de ESTA carta, lo que se
  // enseña es lo que va a durar, no lo que le quedaba a la de antes.
  const restante = veredicto ? 0 : cuenta.id === carta?.id ? cuenta.ms : duracion;
  const queda = duracion > 0 ? Math.max(0, Math.min(1, restante / duracion)) : 0;
  const ahogado = queda <= 0.25;

  /** Hacia dónde se va la carta al descartarla. */
  const salida = useMemo(() => {
    if (!veredicto || menosMovimiento) return undefined;
    const lado = veredicto.respuesta === DICE_VERDADERO ? 1 : -1;
    if (veredicto.respuesta === SE_ACABO) return { transform: 'scale(0.9)', opacity: 0.25 };
    return { transform: `translateX(${lado * 115}%) rotate(${lado * 12}deg)`, opacity: 0 };
  }, [veredicto, menosMovimiento]);

  const visible = veredicto?.carta ?? carta;
  if (!visible) return null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-4">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold leading-none tabular-nums">
            {Math.min(indice + 1, ronda.cartas.length)}
            <span className="text-base font-bold text-[var(--texto-suave)]">
              /{ronda.cartas.length}
            </span>
          </p>
          <p className="text-xs text-[var(--texto-suave)]">cartas</p>
        </div>
        <Contador
          etiqueta="Puntos"
          valor={puntuacion}
          tono={aciertos > 0 ? 'acierto' : 'normal'}
          vivo
        >
          {veredicto?.acerto && (
            <PuntosGanados
              key={contestadas}
              puntos={loQueSumaElSiguiente('FALSOS_AMIGOS', aciertos - 1)}
            />
          )}
        </Contador>
      </CabeceraJuego>

      {veredicto && !menosMovimiento && (
        <Destello key={contestadas} senal={veredicto.acerto ? 'acierto' : 'fallo'} />
      )}

      <div className="mt-3 min-h-8">
        <Racha racha={racha} />
      </div>

      {/*
        El reloj: una barra que se vacía y la cifra al lado.

        Es lo que hace que la prisa se SIENTA en vez de solo saberse. Va pegado
        a la carta y no en la cabecera para que se vea sin apartar la vista de
        las dos palabras, que es donde tiene que estar mirando quien juega.
      */}
      <div className="mt-1 flex items-center gap-2" aria-hidden>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--superficie)]">
          <div
            className={cn(
              'h-full rounded-full',
              veredicto ? 'bg-[var(--hueco)]' : ahogado ? 'bg-fallo' : 'bg-marca-600',
            )}
            style={{ width: `${queda * 100}%` }}
          />
        </div>
        <span
          className={cn(
            'w-10 shrink-0 text-right text-xs font-bold tabular-nums',
            ahogado && !veredicto ? 'text-[var(--texto-fallo)]' : 'text-[var(--texto-suave)]',
          )}
        >
          {(restante / 1000).toFixed(1)}s
        </span>
      </div>

      {/*
        La carta. Grande, centrada y sola: no hay nada más que leer.

        `overflow-hidden` no es cosmético: la carta se va hacia el lado que se
        eligió, y al salirse ensanchaba el documento y sacaba una barra de
        desplazamiento horizontal en el móvil. Una barra que aparece y
        desaparece cada segundo y medio mueve toda la pantalla.
      */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden py-4">
        <div
          key={visible.id}
          style={salida}
          className={cn(
            'w-full rounded-3xl border-2 px-4 py-10 text-center shadow-sm',
            !menosMovimiento && 'transition-all duration-300 ease-out',
            /*
              Con menos movimiento la carta no se va a ningún lado, así que se
              esconde al contestar. Sin esto, la explicación se pintaba ENCIMA
              de la carta y no se leía ninguna de las dos: quien pidió que nada
              se mueva se quedaba sin lo único que este juego enseña.
            */
            menosMovimiento && !!veredicto && 'invisible',
            veredicto?.acerto === true && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
            veredicto?.acerto === false && 'border-red-500 bg-red-50 dark:bg-red-950/40',
            !veredicto && 'border-[var(--borde)] bg-[var(--superficie)]',
          )}
        >
          <p lang="en" className="break-words text-4xl font-extrabold leading-tight">
            {visible.en}
          </p>
          <p className="mt-4 text-xs uppercase tracking-wide text-[var(--texto-suave)]">
            ¿significa?
          </p>
          <p className="mt-2 break-words text-2xl font-bold leading-tight text-[var(--texto)]">
            {visible.parece}
          </p>
        </div>

        {/*
          Lo que se aprende, JUSTO DONDE ESTABA LA CARTA.

          Puesto abajo, junto a los botones, dejaba medio metro de pantalla
          vacío mientras la carta se iba, y la explicación —que es lo único que
          este juego enseña— quedaba en letra pequeña en una esquina. Aquí cae
          donde ya estaban puestos los ojos y ocupa el hueco que deja la carta
          al salir, que es exactamente para lo que ese hueco sirve.
        */}
        {veredicto && (
          <div
            role="status"
            className={cn(
              // Centrado a mano y no con `items-center`: al ir en posición
              // absoluta, el sitio que le tocaría por defecto es el de después
              // de la carta, o sea abajo del todo.
              'absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-start gap-2 rounded-2xl p-3 text-left',
              // El fondo va opaco, no al 30 % como el resto de los avisos: este
              // se pinta encima de la carta mientras la carta se va, y con un
              // fondo traslúcido se leen las dos cosas superpuestas.
              veredicto.acerto ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-red-50 dark:bg-red-950',
            )}
          >
            <Mascota estado={veredicto.acerto ? 'celebrando' : 'animando'} tamano={40} />
            <div className="min-w-0">
              <p
                className={cn(
                  'text-lg font-extrabold leading-tight',
                  veredicto.acerto ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-fallo)]',
                )}
              >
                {tituloDelVeredicto(veredicto, racha)}
              </p>
              {!veredicto.acerto && (
                <>
                  <p className="mt-1 text-base font-semibold text-[var(--texto)]">
                    «{veredicto.carta.en}» es {veredicto.carta.real}
                  </p>
                  <p className="mt-1 text-sm text-[var(--texto-suave)]">{veredicto.carta.porQue}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/*
        Los dos botones SON el juego, así que se llevan el ancho entero y la
        parte de abajo, que es donde llega el pulgar. Ochenta píxeles de alto
        contra los cuarenta y cuatro que pide el mínimo: aquí se pulsa sin mirar
        y con prisa, y un botón justo de tamaño se falla.
      */}
      <div className="grid grid-cols-2 gap-3 pb-2">
        <BotonDeDecidir
          lado="izquierda"
          etiqueta="FALSO"
          detalle="es trampa"
          tono="fallo"
          elegido={veredicto?.respuesta === DICE_FALSO}
          bloqueado={!!veredicto}
          onPulsar={() => responder(DICE_FALSO)}
        />
        <BotonDeDecidir
          lado="derecha"
          etiqueta="VERDADERO"
          detalle="sí significa eso"
          tono="acierto"
          elegido={veredicto?.respuesta === DICE_VERDADERO}
          bloqueado={!!veredicto}
          onPulsar={() => responder(DICE_VERDADERO)}
        />
      </div>
    </div>
  );
}

/** Los escalones vienen del servidor; más allá del último, se repite el último. */
function escalonDe(ronda: RondaDeFalsosAmigos, paso: number): number {
  const escalones = ronda.reloj.escalones;
  if (escalones.length === 0) return 2500;
  return escalones[Math.min(Math.max(paso, 0), escalones.length - 1)]!;
}

function tituloDelVeredicto(veredicto: Veredicto, racha: number): string {
  if (veredicto.acerto) {
    if (racha >= 2) return `¡Bien! ${racha} seguidas`;
    return veredicto.carta.verdadera ? '¡Sí era!' : '¡Trampa esquivada!';
  }
  if (veredicto.respuesta === SE_ACABO) return 'Se acabó el tiempo';
  return veredicto.carta.verdadera ? 'Sí lo era' : 'Esa era la trampa';
}

/**
 * Uno de los dos botones.
 *
 * Lleva la flecha dibujada porque el juego se pidió con flechas y porque dice
 * dónde está cada cosa antes de la primera carta: falso a la izquierda,
 * verdadero a la derecha. Quien juega en el móvil ve la dirección; quien juega
 * en el portátil ve qué tecla es.
 */
function BotonDeDecidir({
  lado,
  etiqueta,
  detalle,
  tono,
  elegido,
  bloqueado,
  onPulsar,
}: {
  lado: 'izquierda' | 'derecha';
  etiqueta: string;
  detalle: string;
  tono: 'fallo' | 'acierto';
  elegido: boolean;
  bloqueado: boolean;
  onPulsar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPulsar}
      disabled={bloqueado}
      aria-label={`${etiqueta}: ${detalle}. Flecha ${lado}.`}
      className={cn(
        'boton-3d flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 px-2 text-white transition',
        tono === 'fallo'
          ? 'border-rose-800 bg-rose-600 hover:bg-rose-500'
          : 'border-emerald-900 bg-emerald-700 hover:bg-emerald-600',
        // Al bloquearse NO se apaga como un botón deshabilitado cualquiera: se
        // sigue viendo cuál se pulsó, que es parte del veredicto.
        bloqueado && !elegido && 'opacity-40',
        elegido && 'ring-4 ring-white/60',
      )}
    >
      <span aria-hidden className="text-lg leading-none">
        {lado === 'izquierda' ? '←' : '→'}
      </span>
      <span aria-hidden className="mt-1 text-sm font-extrabold leading-none">
        {etiqueta}
      </span>
      <span aria-hidden className="mt-1 text-[10px] leading-none opacity-90">
        {detalle}
      </span>
    </button>
  );
}
