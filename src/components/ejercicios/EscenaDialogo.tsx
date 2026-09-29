import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Mascota, type EstadoMascota } from '@/components/Mascota';
import { NOMBRE_ESPECIE } from '@/lib/mascota-contexto';
import { useMenosMovimiento } from '@/lib/movimiento';
import { seguirAmplitud } from '@/lib/amplitud';
import { callar, decir, hayVozInglesa, vozInglesaYa } from '@/lib/voz';
import {
  codigoDeLeccion,
  conNombres,
  msDeTurno,
  msHablando,
  repartoDe,
  type Papel,
  type Reparto,
  type Turno,
} from './escena';
import type { Correccion, PropsEjercicio } from './tipos';

/**
 * Una escena actuada: dos personajes hablando entre ellos.
 *
 * Es lo que en otras aplicaciones sería un vídeo, y no lo es a propósito. Un
 * vídeo cuesta megas por alumno, cuesta derechos de imagen y cuesta una
 * regrabación entera cada vez que se cambia una frase. Aquí la «grabación» son
 * cuatro líneas de texto en el JSON de la unidad: el reparto lo pone esta
 * pantalla, la boca la mueve el motor de las mascotas y cambiar una réplica es
 * editar una cadena.
 *
 *
 * QUÉ ENSEÑA ESTO QUE NO ENSEÑA UN DIÁLOGO ESCRITO
 *
 * Un diálogo en un papel se lee como dos listas de frases. Lo que se pierde es
 * lo único que no está en las palabras: quién lo dice, a quién, y con qué cara.
 * «Sure.» de buena gana y «Sure.» de mala gana son dos respuestas distintas y se
 * escriben igual. Por eso cada turno trae un `animo` y por eso el personaje se
 * queda con esa cara cuando termina de hablar: ese silencio con cara es la mitad
 * de lo que después se pregunta.
 *
 * Y por eso hay pregunta. Una escena sin pregunta es un vídeo que se mira: se
 * pasa por encima y no se entera nadie. La pregunta no va de palabras sueltas
 * —eso ya lo entrenan los otros nueve tipos—, va de qué quiso decir cada uno.
 *
 *
 * POR QUÉ NO CORRE NINGÚN RELOJ RÁPIDO
 *
 * Ver `escena.ts`. Lo resumido: una réplica inglesa se queda en pantalla lo que
 * cuesta leerla a CATORCE caracteres por segundo, que es lo que lee quien
 * todavía está descifrando. En esta casa ya hubo un juego injugable por suponer
 * veintiocho. Y aunque el cálculo fuera perfecto, seguiría estando el botón de
 * volver atrás: una escena que solo se puede ver hacia delante es una escena que
 * se pierde para siempre en cuanto alguien se despista un segundo.
 *
 *
 * SIN VOZ ESTO SIGUE FUNCIONANDO
 *
 * No hay ningún altavoz que prometa un audio que no existe. Cuando el aparato no
 * puede decir inglés —y no se lee con una voz española a propósito, porque
 * enseñaría una pronunciación falsa— la escena es exactamente la misma escena:
 * se lee, se ve quién habla porque es el que tiene la boca en marcha, y los
 * tiempos son los mismos porque los tiempos los manda la lectura, no el audio.
 * Lo único que se dice es que aquí no va a sonar nada, y se dice una vez.
 */
export function EscenaDialogo({ ejercicio, bloqueado, onCambio, resultado }: PropsEjercicio) {
  const prompt = ejercicio.prompt as {
    instruction_es: string;
    escena: string;
    turnos: Turno[];
    question_es: string;
    options: Array<{ text: string }>;
  };

  const quieto = useMenosMovimiento();
  const puedeSonar = usePuedeSonar();
  const reparto = repartoDe(codigoDeLeccion(ejercicio.code));

  const [indice, setIndice] = useState(0);
  /** Hasta dónde se ha llegado. Es lo que decide si ya se puede preguntar. */
  const [vistos, setVistos] = useState(0);
  /*
    Con movimiento reducido la escena NO avanza sola.

    Apagar las animaciones y dejar que las réplicas se sustituyan solas cada
    cuatro segundos sería no haber entendido la petición: lo que molesta no es la
    transición, es que la pantalla cambie por su cuenta. Así que aquí se pasa a
    mano, y a cambio el guion entero está desplegado desde el principio.
  */
  const [reproduciendo, setReproduciendo] = useState(!quieto);
  const [glosa, setGlosa] = useState(false);
  /** Sube cada vez que se pide repetir: es lo que rearranca el turno actual. */
  const [repeticion, setRepeticion] = useState(0);
  const [fase, setFase] = useState<'diciendo' | 'callado'>('diciendo');
  /*
    Lo fuerte que suena la voz ahora mismo, de 0 a 1, o nada si no hay nada que
    medir.

    «Nada» no es un fallo, es el caso corriente: solo se puede medir cuando habla
    el servidor, porque el sintetizador del navegador no entrega ningún nodo al
    que engancharse. Sin valor, la boca hace su ciclo propio, que es lo que
    `coreografia.ts` documenta como correcto cuando no hay dato. Lo que no se
    hace nunca es deducirlo del texto: eso sería fingir un audio.
  */
  const [intensidad, setIntensidad] = useState<number | undefined>(undefined);
  const [elegida, setElegida] = useState<number | null>(null);

  /*
    El guion se lee de una caja y no de las dependencias del efecto.

    Si `turnos` entrara en las dependencias, bastaría con que el padre volviera a
    dibujarse con otro objeto igual para que el efecto se desmontara, cortara la
    voz y volviera a empezar el turno desde el principio. Se vería como una
    escena que se atasca en la misma réplica.
  */
  const guion = useRef(prompt.turnos);
  guion.current = prompt.turnos;

  const ultimo = prompt.turnos.length - 1;
  const turno = prompt.turnos[indice];

  // Cambiar de ejercicio es empezar otra escena, no seguir la anterior.
  useEffect(() => {
    setIndice(0);
    setVistos(0);
    setElegida(null);
    setRepeticion(0);
  }, [ejercicio.code]);

  useEffect(() => setVistos((v) => Math.max(v, indice)), [indice]);

  /*
    El turno: decirlo, dejar la cara puesta al acabar y, si va sola, pasar.

    Se espera al reloj Y a la voz, no al primero que termine. El reloj sabe lo
    que cuesta LEER la frase y la voz sabe lo que cuesta DECIRLA, y ninguno de
    los dos sabe lo del otro: con una voz lenta, pasar al terminar la lectura
    cortaría el audio a media palabra; con una frase larga, pasar al callar la
    voz se llevaría la réplica antes de que nadie la haya leído entera.
  */
  useEffect(() => {
    const actual = guion.current[indice];
    if (!actual) return;

    let vivo = true;
    let soltarAmplitud = () => {};
    setFase('diciendo');
    setIntensidad(undefined);

    const callado = window.setTimeout(
      () => {
        if (!vivo) return;
        setFase('callado');
        // Al callar se suelta el dato, no se deja el último que se midió: una
        // boca parada en media vocal se lee como algo que se ha quedado colgado.
        setIntensidad(undefined);
      },
      msHablando(actual, glosa),
    );

    const voz = puedeSonar
      ? decir(actual.en, {
          velocidad: 0.9,
          /*
            Con movimiento reducido la boca no se mueve pase lo que pase, así que
            montar el analizador sería abrir un bucle de fotogramas para tirar
            todas sus lecturas.
          */
          ...(quieto
            ? {}
            : {
                alSonar: (audio: HTMLAudioElement) => {
                  soltarAmplitud = seguirAmplitud(audio, (abierta) => {
                    if (vivo) setIntensidad(abierta);
                  });
                },
              }),
        })
      : Promise.resolve();

    let paso = 0;
    const reloj = new Promise<void>((seguir) => {
      paso = window.setTimeout(seguir, msDeTurno(actual, glosa));
    });

    if (reproduciendo) {
      void Promise.all([reloj, voz]).then(() => {
        if (!vivo) return;
        if (indice < guion.current.length - 1) setIndice(indice + 1);
        // Al final no se vuelve a empezar: la escena se para y aparece la
        // pregunta. Un bucle haría que la última réplica no se leyera nunca
        // entera, porque siempre estaría a punto de volver al principio.
        else setReproduciendo(false);
      });
    }

    return () => {
      vivo = false;
      soltarAmplitud();
      window.clearTimeout(callado);
      window.clearTimeout(paso);
      callar();
    };
  }, [indice, repeticion, reproduciendo, glosa, puedeSonar, quieto]);

  /*
    La pregunta no se enseña hasta haber llegado al final de la escena.

    No es para castigar a nadie: es que una pregunta visible desde el primer
    segundo cambia lo que se mira. Quien la ve antes deja de ver la escena y se
    pone a buscar en ella la palabra de la opción, que es justo la forma de
    contestar sin haberse enterado de nada.

    Con movimiento reducido el guion está entero en pantalla desde el principio,
    así que ahí no hay nada que esperar.
  */
  const escenaVista = quieto || vistos >= ultimo;
  const revelados = quieto ? ultimo : vistos;

  /** El contenido escribe `{A}` y `{B}`; en pantalla eso son dos nombres. */
  const nombrar = (texto: string) => conNombres(texto, reparto, (e) => NOMBRE_ESPECIE[e]);

  const irA = (n: number) => {
    setReproduciendo(false);
    setIndice(Math.min(Math.max(0, n), ultimo));
  };

  if (!turno) return null;

  return (
    <div>
      <p className="text-sm text-[var(--texto-suave)]">{prompt.instruction_es}</p>

      <p className="mt-2 text-center text-xs uppercase tracking-wide text-[var(--texto-suave)]">
        {prompt.escena}
      </p>

      <Escenario
        reparto={reparto}
        turno={turno}
        fase={fase}
        quieto={quieto}
        intensidad={intensidad}
      />

      {/*
        El guion revelado, y cada réplica es un botón.

        Volver atrás con la flecha funciona, pero obliga a pulsarla tres veces
        para llegar a la primera. Poder tocar directamente la réplica que no se
        entendió es lo que convierte «se puede repetir» en «se repite».
      */}
      <ol className="mt-4 grid gap-2" aria-live="polite">
        {prompt.turnos.slice(0, revelados + 1).map((t, n) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => irA(n)}
              aria-current={n === indice}
              className={cn(
                'flex w-full min-w-0 gap-2 rounded-2xl border px-3 py-2 text-left transition',
                n === indice
                  ? 'border-marca-600 bg-marca-50 dark:bg-marca-600/20'
                  : 'border-transparent bg-[var(--superficie)] opacity-70 hover:opacity-100',
              )}
            >
              <span
                className={cn(
                  // `self-start` y no solo `shrink-0`: en un flex, el hijo se
                  // estira al alto de la fila, y la etiqueta del nombre salía
                  // como una columna de color del alto de toda la réplica.
                  'mt-0.5 shrink-0 self-start rounded-lg px-2 py-0.5 text-xs font-bold',
                  t.quien === 'A'
                    ? 'bg-marca-600 text-white'
                    : 'bg-amber-600 text-white dark:bg-amber-500',
                )}
              >
                {NOMBRE_ESPECIE[reparto[t.quien]]}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block break-words font-[var(--font-lectura)] leading-relaxed',
                    n === indice ? 'text-lg' : 'text-sm',
                  )}
                >
                  {t.en}
                </span>
                {glosa && (
                  <span className="mt-1 block break-words text-sm text-[var(--texto-suave)]">
                    {t.es}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <Controles
        indice={indice}
        ultimo={ultimo}
        reproduciendo={reproduciendo}
        onIr={irA}
        onRepetir={() => {
          setFase('diciendo');
          setRepeticion((r) => r + 1);
        }}
        onReproducir={() => {
          // Al final, el botón de seguir ya no sigue: vuelve a empezar. Si no,
          // sería un botón que se pulsa y no pasa nada.
          if (indice >= ultimo && !reproduciendo) setIndice(0);
          setReproduciendo(!reproduciendo);
        }}
      />

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          onClick={() => setGlosa(!glosa)}
          aria-pressed={glosa}
          className="rounded-xl px-2 py-1 text-marca-700 underline decoration-dotted dark:text-marca-300"
        >
          {glosa ? 'Ocultar traducción' : 'Ver traducción'}
        </button>
        {!puedeSonar && (
          /*
            Se dice una vez y sin altavoz al lado. Un botón de sonido que no
            suena es peor que no tener sonido: se pulsa, no pasa nada, y quien
            lo pulsó cree que se le ha roto la aplicación.
          */
          <span className="text-[var(--texto-suave)]">
            Aquí no hay voz inglesa: la escena se lee
          </span>
        )}
      </div>

      {escenaVista ? (
        <Pregunta
          question={nombrar(prompt.question_es)}
          options={prompt.options.map((o) => ({ text: nombrar(o.text) }))}
          bloqueado={bloqueado}
          elegida={elegida}
          resultado={resultado}
          onElegir={(n) => {
            setElegida(n);
            onCambio(n);
          }}
        />
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--borde)] px-4 py-3 text-center text-sm text-[var(--texto-suave)]">
          Al terminar la escena hay una pregunta sobre lo que se dijeron.
        </p>
      )}
    </div>
  );
}

/**
 * ¿Va a sonar algo aquí?
 *
 * Se arranca con lo que ya se sepa para que la frase de «aquí no hay voz» no
 * aparezca y desaparezca a los dos segundos, que es lo que se ve como un fallo.
 */
function usePuedeSonar(): boolean {
  const [puede, setPuede] = useState(() => vozInglesaYa() === 'si');

  useEffect(() => {
    let vivo = true;
    void hayVozInglesa().then((hay) => {
      if (vivo) setPuede(hay);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return puede;
}

/**
 * Los dos actores.
 *
 * Quien habla está en `hablando`, que es el estado con el que el motor mueve la
 * boca; el otro está `escuchando` y atenuado. Esa es toda la gramática visual
 * que hace falta para saber quién dice qué sin leer ningún nombre, y es lo que
 * un diálogo escrito no tiene.
 *
 * Al callar, el que habló se queda con su `animo`. No es un adorno: es la
 * respuesta a la pregunta de después la mitad de las veces.
 */
function Escenario({
  reparto,
  turno,
  fase,
  quieto,
  intensidad,
}: {
  reparto: Reparto;
  turno: Turno;
  fase: 'diciendo' | 'callado';
  quieto: boolean;
  /** Lo que suena la voz ahora, si es que se puede medir. Ver `amplitud.ts`. */
  intensidad?: number;
}) {
  const animo = (turno.animo ?? 'neutral') as EstadoMascota;
  // Con movimiento reducido no se mueve ninguna boca, así que el único que puede
  // decir quién habla es el resalte y la cara. Se pone la cara desde el primer
  // momento en vez de esperar a que calle.
  const hablando: EstadoMascota = quieto || fase === 'callado' ? animo : 'hablando';

  return (
    <div className="mt-2 flex items-end justify-center gap-2">
      {(['A', 'B'] as Papel[]).map((papel) => {
        const suyo = turno.quien === papel;
        return (
          <div
            key={papel}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center transition-opacity',
              suyo ? 'opacity-100' : 'opacity-45',
            )}
          >
            <Mascota
              especie={reparto[papel]}
              estado={suyo ? hablando : 'escuchando'}
              // Solo al que habla: pasarle el volumen al que escucha le abriría
              // la boca a quien no está diciendo nada.
              intensidad={suyo ? intensidad : undefined}
              tamano={84}
            />
          </div>
        );
      })}
    </div>
  );
}

function Controles({
  indice,
  ultimo,
  reproduciendo,
  onIr,
  onRepetir,
  onReproducir,
}: {
  indice: number;
  ultimo: number;
  reproduciendo: boolean;
  onIr: (n: number) => void;
  onRepetir: () => void;
  onReproducir: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      <BotonControl
        etiqueta="Réplica anterior"
        onClick={() => onIr(indice - 1)}
        apagado={indice === 0}
      >
        ◀
      </BotonControl>
      <BotonControl etiqueta="Repetir esta réplica" onClick={onRepetir}>
        ↻
      </BotonControl>
      <BotonControl
        etiqueta={reproduciendo ? 'Pausar la escena' : 'Seguir la escena'}
        onClick={onReproducir}
      >
        {reproduciendo ? '⏸' : '▶'}
      </BotonControl>
      <BotonControl
        etiqueta="Réplica siguiente"
        onClick={() => onIr(indice + 1)}
        apagado={indice >= ultimo}
      >
        ▶|
      </BotonControl>
      <span className="ml-1 text-sm tabular-nums text-[var(--texto-suave)]">
        {indice + 1} / {ultimo + 1}
      </span>
    </div>
  );
}

function BotonControl({
  etiqueta,
  onClick,
  apagado,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  apagado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={apagado}
      aria-label={etiqueta}
      title={etiqueta}
      // 44 px de lado: es el mínimo que se acierta con el pulgar sin mirar, y
      // estos botones se usan justo mientras se mira otra cosa.
      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] text-base transition hover:border-marca-400 disabled:opacity-40"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}

type Marca = 'buena' | 'mala' | 'ninguna';

/* Tonos oscuros con texto blanco: un verde pálido con texto verde no llega al
   contraste mínimo, y este es el momento en que hay que poder leer bien. */
const CLASE_MARCA: Record<Marca, string> = {
  buena: 'border-emerald-800 bg-emerald-800 text-white',
  mala: 'border-red-700 bg-red-700 text-white',
  ninguna: '',
};

function marcaDe(resultado: Correccion | null | undefined, texto: string, elegida: boolean): Marca {
  if (!resultado) return 'ninguna';
  if (resultado.isCorrect) return elegida ? 'buena' : 'ninguna';

  const correcta = resultado.feedback.correcta?.trim().toLowerCase();
  if (correcta && texto.trim().toLowerCase() === correcta) return 'buena';
  return elegida ? 'mala' : 'ninguna';
}

function Pregunta({
  question,
  options,
  bloqueado,
  elegida,
  resultado,
  onElegir,
}: {
  question: string;
  options: Array<{ text: string }>;
  bloqueado: boolean;
  elegida: number | null;
  resultado?: Correccion | null;
  onElegir: (n: number) => void;
}) {
  return (
    <div className="mt-6 border-t border-[var(--borde)] pt-5">
      <p className="break-words font-[var(--font-lectura)] text-lg leading-relaxed">{question}</p>
      <div className="mt-4 grid gap-3">
        {options.map((opcion, n) => {
          const marca = marcaDe(resultado, opcion.text, elegida === n);
          return (
            <button
              key={opcion.text}
              type="button"
              disabled={bloqueado}
              aria-pressed={elegida === n}
              onClick={() => onElegir(n)}
              className={cn(
                'flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-base transition',
                CLASE_MARCA[marca],
                marca === 'buena' && 'animate-crecer',
                marca === 'mala' && 'animate-temblor',
                marca === 'ninguna' &&
                  (elegida === n
                    ? 'border-marca-600 bg-marca-50 ring-2 ring-marca-600/30 dark:bg-marca-600/20'
                    : 'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400'),
                marca === 'ninguna' && 'disabled:opacity-60',
              )}
            >
              <span className="min-w-0 flex-1 break-words">{opcion.text}</span>
              {/* El color no puede ser la única señal: hay quien no distingue el
                  verde del rojo, y un icono lo resuelve sin texto extra. */}
              {marca !== 'ninguna' && (
                <span aria-label={marca === 'buena' ? 'Correcta' : 'Tu respuesta'}>
                  {marca === 'buena' ? '✓' : '✕'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
