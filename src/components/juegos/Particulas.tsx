import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { CabeceraJuego, Contador, Racha } from './Tablero';
import { Destello, PuntosGanados } from './efectos';
import { loQueSumaElSiguiente, puntosDelServidor } from './puntos';
import type {
  Marcador,
  RespuestaCorregida,
  RondaDeParticulas,
  SituacionDeParticula,
} from './tipos';

/**
 * LA PARTÍCULA: un verbo en el centro, seis partículas alrededor y una barra
 * que se vacía.
 *
 * Arriba sale una situación en español —«tus vecinos se van y te dejan el
 * gato»— y hay que pulsar AFTER antes de que la barra llegue a cero.
 *
 *
 * POR QUÉ LA PRISA ES LA PARTE PEDAGÓGICA
 *
 * Los verbos compuestos no se deducen, se asocian. No hay ninguna lógica que
 * lleve de «cuidar» a *look after*: dentro de ese compuesto, «after» no
 * significa «después» ni significa nada. Así que la barra de tres segundos no
 * es un adorno de videojuego: impide sobrepensar la gramática y obliga a
 * responder por asociación, que es exactamente como se usan al hablar. Con diez
 * segundos, uno razona, acierta y no aprende nada, porque en una conversación
 * no va a tener diez segundos.
 *
 *
 * POR QUÉ EL RELOJ SON DOS NÚMEROS Y NO UNO
 *
 * Tres segundos a pelo no son tensión, son un muro, y el motivo es que dentro
 * de esos tres segundos estaban metidas dos cosas distintas: LEER la situación
 * en español —entre 1,4 y 1,8 segundos para las de este contenido— y ASOCIAR la
 * partícula, que es lo único que se quiere medir. O sea que la mitad del reloj
 * se iba en leer castellano, y alguien que se sabe *look after* fallaba por ser
 * lento leyendo español. Eso no es dificultad, es ruido.
 *
 * Así que hay `lecturaMs` —la situación ya está en pantalla, se puede contestar
 * y la barra sigue llena— y después `barraMs`, los tres segundos que se ven
 * vaciarse. Los dos los manda el servidor, que es donde están calibrados; aquí
 * no se inventa ninguno.
 *
 *
 * QUÉ PASA AL FALLAR, QUE ES LO QUE ENSEÑA
 *
 * Se enseña el compuesto entero con su significado y una frase de ejemplo. Ese
 * medio segundo es el juego: lo que tiene que quedar en la cabeza es la
 * asociación completa —*look after* = cuidar de alguien—, no un «has fallado».
 * Por eso la pausa del fallo es más larga que la del acierto, y por eso se
 * avisa además cuando el compuesto es separable, que es una trampa aparte.
 */

/**
 * Cómo se le dice al servidor que la barra se vació.
 *
 * Es una copia a mano de `SE_ACABO_EL_TIEMPO` en `back/src/modules/games/
 * particulas.ts`. Se manda igual que una respuesta, y no se calla: si solo se
 * avisara de las contestadas, la racha del servidor no se rompería nunca y
 * pagaría el bono al cuadrado de una partida que no existió.
 */
const SE_ACABO_EL_TIEMPO = 'tiempo';

/** Cuánto se queda en pantalla el acierto antes de pasar a la siguiente. */
const PAUSA_ACIERTO = 900;

/**
 * Y cuánto el fallo.
 *
 * Más del doble, porque aquí hay que LEER: el compuesto, lo que significa y la
 * frase de ejemplo son unos sesenta caracteres, que a velocidad de lectura
 * normal en español son dos segundos largos. Cortar antes sería enseñar la
 * respuesta y taparla, que es peor que no enseñarla.
 */
const PAUSA_FALLO = 2800;

/** El radio del corro, en porcentaje del cuadrado que lo contiene. */
const RADIO_CORRO = 36.5;

/** El radio de la circunferencia del reloj dentro de su `viewBox` de 100. */
const RADIO_RELOJ = 45;
const VUELTA = 2 * Math.PI * RADIO_RELOJ;

type Fase = 'jugando' | 'resultado';

export function Particulas({
  ronda,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeParticulas;
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();

  const [indice, setIndice] = useState(0);
  const [fase, setFase] = useState<Fase>('jugando');
  const [elegida, setElegida] = useState<string | null>(null);
  /** Lo que queda de barra, de 1 a 0. Solo significa algo mientras se juega. */
  const [queda, setQueda] = useState(1);

  const [aciertos, setAciertos] = useState(0);
  const [contestadas, setContestadas] = useState(0);
  const [racha, setRacha] = useState(0);
  /*
    La racha viva se rompe al fallar; la que PAGA es la más larga de la partida.
    Se guarda aparte para que el marcador en vivo enseñe lo mismo que va a
    cerrar el servidor.
  */
  const [rachaMaxima, setRachaMaxima] = useState(0);

  const actual: SituacionDeParticula | undefined = ronda.rondas[indice];
  const acertada = elegida !== null && elegida === actual?.correcta;

  // La misma cuenta que hará el servidor al cerrar. Ver `puntos.ts`, que explica
  // por qué se calcula aquí también en vez de esperar al final.
  const puntuacion = puntosDelServidor('PARTICULAS', aciertos, rachaMaxima);

  /*
    Las respuestas se mandan en fila india y no se esperan para seguir jugando.

    Es lo mismo que hace CAEN: el navegador ya sabe si acertó —la ronda le llegó
    con la solución— así que parar el juego a esperar al servidor solo añadiría
    un parpadeo. Pero la partida NO se cierra hasta que la última ha llegado: si
    el `/fin` adelantara a las respuestas, la puntuación final saldría más baja
    que la que se acaba de ver subir, y eso se lee como una estafa.
  */
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const avisar = useCallback(
    (rondaId: string, answer: string) => {
      cola.current = cola.current.then(() =>
        // Un reintento y ya. Si la red está caída, lo que no puede pasar es que
        // el juego se pare.
        onResponder(rondaId, answer).catch(() => onResponder(rondaId, answer).catch(() => null)),
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

  /*
    Qué ronda está ya contestada, en una referencia y no en el estado.

    `fase` no basta para cerrar la puerta. Pulsar una partícula y que la barra
    se vacíe en el mismo fotograma son dos llamadas dentro del mismo render:
    las dos ven `fase === 'jugando'`, las dos pasan, y la ronda se manda dos
    veces. El servidor lo para —contesta GAM-006, «ya respondiste esto»— pero
    el navegador ya ha contado dos respuestas para una sola ronda, y entonces
    el marcador que se enseña deja de ser el que va a cerrar la partida.
    Apareció jugando: dos 409 en cinco partidas, justo en las rondas que se
    contestaban al filo.
  */
  const contestada = useRef<string | null>(null);

  /** Contesta la ronda de ahora: una partícula, o que se acabó el tiempo. */
  const responder = useCallback(
    (respuesta: string) => {
      if (!actual || fase !== 'jugando' || contestada.current === actual.id) return;
      contestada.current = actual.id;

      const buena = respuesta === actual.correcta;
      const nuevaRacha = buena ? racha + 1 : 0;

      setElegida(respuesta);
      setFase('resultado');
      setContestadas((n) => n + 1);
      setRacha(nuevaRacha);
      setRachaMaxima((mejor) => Math.max(mejor, nuevaRacha));
      if (buena) setAciertos((n) => n + 1);

      avisar(actual.id, respuesta);

      if (!buena) sonar('fallo');
      else if (nuevaRacha >= 2) sonar('combo', { racha: nuevaRacha });
      else sonar('acierto');
    },
    [actual, avisar, fase, racha],
  );

  const avanzar = useCallback(() => {
    setElegida(null);
    setQueda(1);
    setFase('jugando');
    setIndice((n) => n + 1);
  }, []);

  /*
    El reloj de la ronda.

    Un solo `requestAnimationFrame` lleva las dos cosas —cuánto queda de barra y
    cuándo se acabó— para que no puedan desincronizarse: un temporizador aparte
    que dispara el fin mientras la barra va por el 5 % es de las cosas que hacen
    que un juego se sienta injusto. El tiempo se mide contra el reloj del
    sistema y no contando fotogramas, así que una pestaña que se ralentiza no
    regala segundos.

    Con `prefers-reduced-motion` la barra NO se anima: el estado solo cambia
    cuando cambia el segundo entero, y lo que se pinta es ese número bajando.
    Sigue siendo el mismo reloj y se sigue pudiendo jugar.
  */
  useEffect(() => {
    if (!actual || fase !== 'jugando') return;

    const total = ronda.reloj.lecturaMs + ronda.reloj.barraMs;
    const inicio = performance.now();
    let cuadro = 0;
    let ultimoSegundo = Number.POSITIVE_INFINITY;

    /*
      El rato se mide con `performance.now()` DENTRO del latido y no con el
      sello de tiempo que trae `requestAnimationFrame`.

      No es lo mismo: el sello del fotograma va en el reloj del documento y
      `performance.now()` en el del proceso, y restar uno del otro da un número
      sin sentido. Se vio en las pruebas —la barra se quedaba llena para
      siempre— pero es un fallo de verdad, no de las pruebas: cualquier entorno
      donde los dos relojes no arranquen a la vez rompe el reloj del juego.
    */
    const latido = () => {
      const transcurrido = performance.now() - inicio;

      if (transcurrido >= total) {
        setQueda(0);
        responder(SE_ACABO_EL_TIEMPO);
        return;
      }

      // Mientras dura la lectura la barra se queda llena; después baja.
      const gastado = Math.max(0, transcurrido - ronda.reloj.lecturaMs);
      const restante = Math.max(0, ronda.reloj.barraMs - gastado);
      const fraccion = ronda.reloj.barraMs > 0 ? restante / ronda.reloj.barraMs : 0;

      if (menosMovimiento) {
        const segundo = Math.ceil(restante / 1000);
        if (segundo !== ultimoSegundo) {
          ultimoSegundo = segundo;
          setQueda(fraccion);
        }
      } else {
        setQueda(fraccion);
      }

      cuadro = requestAnimationFrame(latido);
    };

    cuadro = requestAnimationFrame(latido);
    return () => cancelAnimationFrame(cuadro);
  }, [actual, fase, menosMovimiento, responder, ronda.reloj.barraMs, ronda.reloj.lecturaMs]);

  /** La pausa que enseña: corta si se acertó, larga si hay que leer la buena. */
  useEffect(() => {
    if (fase !== 'resultado') return;
    const reloj = window.setTimeout(avanzar, acertada ? PAUSA_ACIERTO : PAUSA_FALLO);
    return () => window.clearTimeout(reloj);
  }, [fase, acertada, avanzar]);

  // Se acabaron las doce.
  useEffect(() => {
    if (!actual) terminar();
  }, [actual, terminar]);

  /*
    Jugar sin tocar la pantalla.

    Del 1 al 6, en el orden en que se ven: arriba y siguiendo las agujas del
    reloj. Tabular entre seis botones en tres segundos no es jugar, es una
    carrera de obstáculos, así que la tecla va directa a la partícula. Cada
    botón lleva su número escrito y su `aria-keyshortcuts`, que es lo que hace
    que se pueda descubrir en vez de adivinar.
  */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

      if (fase === 'resultado') {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          avanzar();
        }
        return;
      }

      const numero = Number(evento.key);
      if (!Number.isInteger(numero) || numero < 1 || !actual) return;
      const particula = actual.particulas[numero - 1];
      if (!particula) return;

      evento.preventDefault();
      responder(particula);
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [actual, avanzar, fase, responder]);

  if (!actual) return null;

  const apurado = queda <= 0.33;
  const ahogado = queda <= 0.15;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-4">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold leading-none tabular-nums">
            {indice + 1}
            <span className="text-base font-bold text-[var(--texto-suave)]">
              /{ronda.rondas.length}
            </span>
          </p>
          <p className="text-xs text-[var(--texto-suave)]">situaciones</p>
        </div>
        <Contador
          etiqueta="Puntos"
          valor={puntuacion}
          tono={aciertos > 0 ? 'acierto' : 'normal'}
          vivo
        >
          {fase === 'resultado' && acertada && (
            <PuntosGanados
              key={contestadas}
              puntos={loQueSumaElSiguiente('PARTICULAS', aciertos - 1)}
            />
          )}
        </Contador>
      </CabeceraJuego>

      {fase === 'resultado' && (
        <Destello key={contestadas} senal={acertada ? 'acierto' : 'fallo'} />
      )}

      <div className="mt-2 flex min-h-8 items-center">
        <Racha racha={racha} />
      </div>

      {/*
        La situación, arriba y a lo grande.

        Es el enunciado entero del juego y se lee en un segundo y medio: va en
        su propia tarjeta para que el ojo sepa dónde caer al empezar la ronda
        sin tener que buscarla entre los botones.
      */}
      <p
        lang="es"
        className="rounded-2xl bg-[var(--superficie)] px-4 py-3 text-center text-lg font-bold leading-snug"
      >
        {actual.situacionEs}
      </p>

      <div className="flex flex-1 items-center justify-center py-2">
        <div className="relative aspect-square w-full max-w-[320px]">
          <RelojRedondo
            queda={queda}
            verbo={actual.verbo}
            fase={fase}
            acertada={acertada}
            apurado={apurado}
            ahogado={ahogado}
            menosMovimiento={menosMovimiento}
            barraMs={ronda.reloj.barraMs}
          />

          {actual.particulas.map((particula, posicion) => {
            // Arriba y siguiendo las agujas del reloj, que es el orden en que
            // se leen los números del 1 al 6.
            const angulo = (-90 + posicion * 60) * (Math.PI / 180);
            const esLaSuya = elegida === particula;
            const esLaBuena = particula === actual.correcta;
            const contestada = fase === 'resultado';

            return (
              <button
                key={particula}
                type="button"
                lang="en"
                disabled={contestada}
                aria-keyshortcuts={String(posicion + 1)}
                onClick={() => responder(particula)}
                style={{
                  left: `${50 + RADIO_CORRO * Math.cos(angulo)}%`,
                  top: `${50 + RADIO_CORRO * Math.sin(angulo)}%`,
                }}
                className={cn(
                  'absolute flex min-h-[46px] min-w-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border-2 px-2 text-sm font-extrabold uppercase tracking-wide transition',
                  !contestada &&
                    'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400 active:scale-95',
                  contestada &&
                    esLaBuena &&
                    'border-emerald-600 bg-emerald-50 text-[var(--texto-acierto)] dark:bg-emerald-950/40',
                  contestada &&
                    esLaSuya &&
                    !esLaBuena &&
                    'border-red-500 bg-red-50 text-[var(--texto-fallo)] dark:bg-red-950/40',
                  contestada && !esLaSuya && !esLaBuena && 'border-[var(--borde)] opacity-40',
                )}
              >
                <span
                  aria-hidden
                  className="absolute left-1.5 top-0.5 text-[10px] font-bold text-[var(--texto-suave)]"
                >
                  {posicion + 1}
                </span>
                {particula}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[9.5rem]">
        {fase === 'resultado' ? (
          <LoQueEnsena
            situacion={actual}
            acertada={acertada}
            sinTiempo={elegida === SE_ACABO_EL_TIEMPO}
            onSeguir={avanzar}
          />
        ) : (
          <p className="pt-3 text-center text-sm text-[var(--texto-suave)]">
            Pulsa la partícula que completa la frase.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * El verbo grande con el reloj alrededor.
 *
 * La barra circular vaciándose es el corazón del juego, así que se ve y se
 * siente: el aro va de la marca al aviso y al rojo, y el verbo de dentro es lo
 * más grande de la pantalla.
 *
 * Con `prefers-reduced-motion` el aro no se dibuja vaciándose —se queda
 * completo y apagado— y en su lugar aparece el número de segundos que quedan,
 * que cambia una vez por segundo. No es una versión recortada del juego: es la
 * misma información sin nada que se mueva.
 */
function RelojRedondo({
  queda,
  verbo,
  fase,
  acertada,
  apurado,
  ahogado,
  menosMovimiento,
  barraMs,
}: {
  queda: number;
  verbo: string;
  fase: Fase;
  acertada: boolean;
  apurado: boolean;
  ahogado: boolean;
  menosMovimiento: boolean;
  barraMs: number;
}) {
  const jugando = fase === 'jugando';
  const segundos = Math.max(0, Math.ceil((queda * barraMs) / 1000));

  const color = !jugando
    ? acertada
      ? 'stroke-emerald-500'
      : 'stroke-red-500'
    : ahogado
      ? 'stroke-red-500'
      : apurado
        ? 'stroke-amber-500'
        : 'stroke-marca-500';

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 flex size-[42%] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={RADIO_RELOJ}
          fill="none"
          strokeWidth="7"
          className="stroke-[var(--superficie)]"
        />
        <circle
          cx="50"
          cy="50"
          r={RADIO_RELOJ}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className={color}
          strokeDasharray={VUELTA}
          // Quieto del todo cuando se pidió menos movimiento: el aro se queda
          // entero y quien cuenta el tiempo es el número de abajo.
          strokeDashoffset={menosMovimiento || !jugando ? 0 : VUELTA * (1 - queda)}
        />
      </svg>

      <div className="flex flex-col items-center">
        <span lang="en" className="text-3xl font-extrabold uppercase leading-none tracking-tight">
          {verbo}
        </span>
        {menosMovimiento && jugando && (
          <span
            className={cn(
              'mt-1 text-sm font-extrabold tabular-nums',
              ahogado
                ? 'text-[var(--texto-fallo)]'
                : apurado
                  ? 'text-[var(--texto-aviso)]'
                  : 'text-[var(--texto-suave)]',
            )}
          >
            {segundos}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * El medio segundo que enseña.
 *
 * No dice «error»: dice el compuesto entero, lo que significa y una frase donde
 * se usa. Lo que tiene que quedar es la asociación completa, no la corrección,
 * porque estas cosas no se deducen y la única forma de que entren es verlas
 * enteras unas cuantas veces.
 *
 * Y se enseña TAMBIÉN al acertar, aunque más pequeño: acertar por corazonada y
 * no llegar a ver de qué iba es medio aprendizaje tirado.
 */
function LoQueEnsena({
  situacion,
  acertada,
  sinTiempo,
  onSeguir,
}: {
  situacion: SituacionDeParticula;
  acertada: boolean;
  sinTiempo: boolean;
  onSeguir: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        'mt-1 rounded-2xl p-3',
        acertada ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30',
      )}
    >
      <p
        className={cn(
          'text-xs font-extrabold uppercase tracking-wide',
          acertada ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-fallo)]',
        )}
      >
        {acertada ? '¡Esa!' : sinTiempo ? 'Se acabó el tiempo' : 'Esa no era'}
      </p>

      <p className="mt-1 leading-tight">
        <span lang="en" className="text-lg font-extrabold">
          {situacion.compuesto}
        </span>{' '}
        <span className="text-[var(--texto-suave)]">= {situacion.significadoEs}</span>
      </p>

      <p lang="en" className="mt-1 text-sm italic text-[var(--texto-suave)]">
        {situacion.ejemploEn}
      </p>

      {/*
        Los separables son otra dificultad encima, y callársela sería enseñar
        medio compuesto: quien aprende «pick up the phone» sin saber que también
        es «pick the phone up» va a pensar que la segunda está mal.
      */}
      {situacion.separable && (
        <p className="mt-1 text-xs text-[var(--texto-aviso)]">
          Separable: el objeto también puede ir en medio.
        </p>
      )}

      <div className="mt-2">
        <Boton tono={acertada ? 'acierto' : 'marca'} onClick={onSeguir}>
          SEGUIR
        </Boton>
      </div>
    </div>
  );
}
