import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { enviarLectura } from '@/lib/lectura';
import { grabarWav, type GrabacionWav } from '@/lib/wav';
import { escuchar, estaDisponible, type Escuchado, type SesionEscucha } from '@/lib/reconocimiento';
import { ComoSonaste } from './ComoSonaste';
import type { EvaluacionFonetica } from '@/lib/fonetica';
import { Micro } from '@/components/iconos';

/**
 * Por debajo de esto la grabación no tiene voz dentro y no vale la pena mandarla.
 *
 * Son los 44 bytes de cabecera más un pelín: un WAV de 16 kHz a 16 bits son
 * 32 KB por segundo, así que mil bytes no llegan ni a una sílaba.
 */
const MINIMO_AUDIO = 1000;

/**
 * Lo que se espera al reconocedor después de pedirle que pare.
 *
 * Normalmente contesta en seguida. Pero en el Safari del iPhone puede no haber
 * llegado a arrancar —el micrófono lo tiene la grabación— y entonces no avisa
 * nunca de que terminó: sin este tope, la pantalla se quedaba en «evaluando»
 * para siempre y había que salirse de la lección.
 */
const ESPERA_RECONOCEDOR_MS = 1500;

interface PalabraLeida {
  wordIndex: number;
  word: string;
  heard: string | null;
  score: number;
  verdict: 'correct' | 'mispronounced' | 'omitted' | 'inserted';
}

/**
 * `EvaluacionFonetica` trae los tres campos nuevos —qué sonido falló, dónde se
 * cortó el enlace y la música de la frase— y los trae OPCIONALES a propósito.
 * Este servidor todavía puede contestar sin ellos, y entonces la pantalla no
 * enseña ese bloque en vez de enseñarlo vacío. Los tres estados están explicados
 * en `lib/fonetica.ts`: sin el campo, con el campo a null y con el campo a lista
 * vacía significan cosas distintas y se ven distintas.
 */
interface Informe extends EvaluacionFonetica {
  words: PalabraLeida[];
  accuracy: number;
  completeness: number;
  transcript: string;
  aprobado: boolean;
  palabrasParaTrabajar: Array<{ word: string; hint?: string }>;
}

interface Props {
  ejercicio: {
    code: string;
    prompt: {
      instruction_es: string;
      referenceText: string;
      trickyWords?: Array<{ word: string; hint: string; ipa?: string }>;
    };
  };
  /**
   * Avisa de cómo fue, y con QUÉ se dijo.
   *
   * La transcripción se entrega además del veredicto porque la prueba de nivel
   * la vuelve a corregir en el servidor: allí la nota decide el nivel del curso
   * entero, y una nota que viaja desde el navegador es una nota que se puede
   * escribir a mano. En las lecciones basta con el veredicto.
   */
  onTerminado: (aprobado: boolean, dicho: { texto: string; alternativas: string[] }) => void;
}

/**
 * Leer en voz alta.
 *
 * El navegador escucha, el servidor alinea lo dicho con el texto y devuelve qué
 * palabra falló. Esta es la pantalla que justifica la app: ninguna otra cosa que
 * hagas escribiendo te dice si te entenderían al hablar.
 *
 * Y desde ahora dice además QUÉ SONIDO falló, que es el salto que de verdad
 * enseña. Para eso hace falta el audio en crudo, no el texto: el reconocedor del
 * navegador entrega palabras y para cuando contesta el sonido ya no existe. Así
 * que se graba en paralelo, en WAV PCM de 16 kHz mono —lo único que acepta el
 * evaluador—, y se manda en multipart junto al JSON de siempre.
 *
 * Los dos caminos siguen valiendo. Sin grabación, la petición va en JSON como
 * hasta ahora y la corrección llega sin fonemas: la pantalla no enseña entonces
 * ningún bloque de sonidos, porque no hay nada que contar. Eso NO es lo mismo
 * que llegar con los campos a null, que significa que se intentó y no se pudo, y
 * se dice con todas las letras sin inventarse un cero.
 */
export function LeerEnVozAlta({ ejercicio, onTerminado }: Props) {
  const [estado, setEstado] = useState<'listo' | 'escuchando' | 'evaluando' | 'hecho'>('listo');
  const [parcial, setParcial] = useState('');
  const [informe, setInforme] = useState<Informe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sesion = useRef<SesionEscucha | null>(null);
  /*
    El micrófono se graba APARTE del reconocedor, y a la vez.

    El reconocedor del navegador entrega texto y nada más: nunca va a poder decir
    qué sonido se torció dentro de una palabra, porque para cuando devuelve algo
    el audio ya no existe. Para eso hace falta la grabación en crudo, que viaja
    al servidor junto al texto. Si no se puede grabar, esto se queda a null y la
    corrección sigue siendo la de siempre, sin fonemas.
  */
  const audio = useRef<GrabacionWav | null>(null);
  // Abrir el micrófono tarda, y en ese hueco el botón sigue pulsable. Sin esto,
  // un doble toque abre dos grabaciones y la primera se queda huérfana con el
  // piloto rojo encendido.
  const arrancando = useRef(false);
  const inicio = useRef<number>(0);
  // El reconocedor puede avisar de que terminó más de una vez. Sin esto, una
  // lectura se evaluaría dos veces y el aviso de "no te escuchamos" se quedaría
  // pegado junto al resultado bueno.
  const yaEvaluado = useRef(false);
  /**
   * De quién es el micrófono ahora mismo.
   *
   * Abrirlo tarda —el permiso, el módulo del worklet— y en ese hueco se puede
   * salir de la pantalla o cambiar de ejercicio. Lo que vuelva del `await` mira
   * este número para saber si sigue siendo suyo; si no lo es, suelta lo que
   * acaba de abrir. Sin esto, una grabación que nace huérfana se queda con el
   * micrófono cogido para siempre, y el aparato no se lo da a nadie más: a
   * partir de ahí la app no oye, y ya no hay forma de recuperarlo sin recargar.
   */
  const turno = useRef(0);
  /*
    Si el reconocedor ha fallado en este intento.

    El fallo puede llegar MIENTRAS `empezar` sigue dentro del `await`, y entonces
    lo que viene después pisaría el estado dejando la pantalla en «escuchando»
    con el micrófono muerto: el botón de parar puesto y nada que parar.
  */
  const fallo = useRef(false);
  /** El tope de `parar`, para poder cancelarlo al salir o al cambiar de frase. */
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const soportado = estaDisponible();
  const { referenceText, trickyWords } = ejercicio.prompt;

  /*
    Cambiar de ejercicio es empezar de cero, y lo primero es devolver el micro.

    Hay pantallas que NO vuelven a montar este componente entre una pregunta y
    la siguiente: el examen le cambia el ejercicio y nada más. Con la limpieza
    colgada solo del desmontaje, ahí no se ejecutaba nunca: la segunda pregunta
    de voz heredaba el resultado de la primera —sin botón de micrófono que
    tocar— y además heredaba el flujo del micro y el `AudioContext` abiertos del
    intento anterior. Eso es lo que se nota como «en la primera me deja y en las
    demás ya no me escucha»: no es la app la que deja de oír, es el sistema, que
    no reparte dos veces un micrófono que nadie ha devuelto.
  */
  useEffect(() => {
    setEstado('listo');
    setParcial('');
    setInforme(null);
    setError(null);
    yaEvaluado.current = false;
    arrancando.current = false;

    return () => {
      // Lo que esté a medio abrir deja de ser de esta pantalla.
      turno.current += 1;
      clearTimeout(espera.current);
      sesion.current?.cancelar();
      sesion.current = null;
      audio.current?.cancelar();
      audio.current = null;
    };
  }, [ejercicio.code]);

  /**
   * Devuelve el micrófono y el reconocedor, los dos.
   *
   * Es la operación que faltaba en los dos caminos que no acaban bien —el
   * reconocedor no entiende nada, o el micrófono da un error— y es justo donde
   * más falta hacía: lo que no se suelta, el sistema no se lo da a nadie más.
   * En un iPhone eso no se ve como un error, se ve como que a partir del segundo
   * ejercicio la app ya no te oye, sin decir nada.
   */
  function soltarTodo() {
    sesion.current?.cancelar();
    sesion.current = null;
    audio.current?.cancelar();
    audio.current = null;
  }

  async function empezar() {
    if (arrancando.current) return;
    arrancando.current = true;
    const mio = turno.current;
    setError(null);
    setParcial('');
    setInforme(null);
    yaEvaluado.current = false;
    fallo.current = false;

    /*
      La grabación se abre ANTES que el reconocedor, y se espera a que esté.
      Al revés, el medio segundo que tarda el permiso se comería el principio de
      la frase, y el principio de la frase es justo donde viven los fallos que
      esto pretende enseñar: la «e» delante de «school», el soplo de la p.
    */
    // Si quedó una grabación abierta de un intento que se quedó a medias —el
    // reconocedor no entendió nada y se volvió a empezar— se cierra antes de
    // abrir otra: dos streams del micrófono a la vez dejan el piloto encendido.
    audio.current?.cancelar();
    const grabacion = await grabarWav();
    arrancando.current = false;

    // Mientras se abría el micrófono se cambió de ejercicio o se salió. Esta
    // grabación ya no es de nadie, así que se cierra aquí mismo: guardarla sería
    // dejar el micrófono cogido por una pantalla que ya no existe.
    if (mio !== turno.current) {
      grabacion?.cancelar();
      return;
    }

    audio.current = grabacion;
    inicio.current = Date.now();

    const abierta = escuchar({
      idioma: 'en-US',
      onParcial: setParcial,
      onFinal: (oido) => void evaluar(oido),
      onError: (motivo) => {
        fallo.current = true;
        // Primero devolver el micrófono, y después contarlo. Al revés, el aviso
        // sale en pantalla mientras el aparato sigue cogido, que es el estado
        // del que ya no se sale sin recargar.
        soltarTodo();
        setEstado('listo');
        setError(
          motivo === 'not-allowed'
            ? 'Necesitamos permiso para usar el micrófono.'
            : 'No pudimos escucharte. Inténtalo otra vez.',
        );
      },
    });

    if (!abierta) {
      audio.current?.cancelar();
      audio.current = null;
      setError('Tu navegador no puede escuchar. Prueba con Chrome o Edge.');
      return;
    }

    sesion.current = abierta;
    // El fallo puede haber llegado mientras se abría. Si ya se soltó todo, no se
    // vuelve a poner cara de estar escuchando.
    if (fallo.current) {
      soltarTodo();
      return;
    }
    setEstado('escuchando');
  }

  function parar() {
    sesion.current?.detener();
    setEstado('evaluando');

    /*
      Y si el reconocedor no contesta, se evalúa igual con lo grabado.

      Pararlo dispara `onend`, que es quien llama a `evaluar`. Pero si nunca
      llegó a arrancar de verdad —en iOS el micrófono lo tiene la grabación— no
      hay nada que parar y ese aviso no llega jamás: la pantalla se quedaba en
      «evaluando» sin salida. `evaluar` se protege sola contra entrar dos veces,
      así que si el reconocedor sí contesta, el que llegue segundo no hace nada.
    */
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      void evaluar({ texto: '', alternativas: [] });
    }, ESPERA_RECONOCEDOR_MS);
  }

  /** Cierra la grabación y entrega el WAV, o null si no hubo ninguna. */
  async function recogerAudio(): Promise<Blob | null> {
    const abierta = audio.current;
    audio.current = null;
    return abierta ? abierta.terminar() : null;
  }

  /**
   * Lo que se dijo, preguntándoselo al servidor si el aparato no se enteró.
   *
   * ESTE ES EL CAMINO QUE HACE QUE FUNCIONE EN UN IPHONE.
   *
   * Leer en voz alta usa dos cosas a la vez: la grabación en crudo (para saber
   * qué SONIDO falló) y el reconocedor del navegador (para saber qué palabras
   * se dijeron). En iOS esas dos no se reparten el micrófono: lo coge la
   * grabación —se ve el punto naranja encendido— y el reconocedor se queda
   * mudo. La primera vez cuela y a partir de la segunda ya no, que es
   * exactamente como se nota: «la primera funciona, la siguiente no».
   *
   * Pero el audio SÍ se está grabando. Así que cuando el reconocedor no trae
   * nada, lo que se grabó se manda a transcribir al servidor en vez de dar el
   * intento por perdido.
   *
   * Y se manda SIN decirle qué frase tocaba leer. El servidor acepta una pista,
   * y ponerle ahí el texto de referencia haría que Whisper devolviera justo esa
   * frase aunque se hubiera leído mal: un aprobado inventado, que es lo único
   * peor que no poder evaluar. Sin pista, su instrucción por defecto ya dice
   * que transcriba exactamente lo que oiga, errores incluidos.
   */
  async function loQueSeDijo(oido: Escuchado, grabado: Blob | null): Promise<Escuchado> {
    const delNavegador = oido.texto.trim();
    if (delNavegador) return { texto: delNavegador, alternativas: oido.alternativas ?? [] };
    if (!grabado || grabado.size < MINIMO_AUDIO) return { texto: '', alternativas: [] };

    try {
      const delServidor = await api.post<{ text: string }>('/speech/transcribe', grabado, {
        timeoutMs: 15_000,
      });
      const texto = delServidor.text.trim();
      // Una sola versión: Whisper entrega su mejor lectura, no un abanico.
      return { texto, alternativas: texto ? [texto] : [] };
    } catch {
      // Sin servidor se queda como estaba: no se oyó, y se dice.
      return { texto: '', alternativas: [] };
    }
  }

  async function evaluar(oido: Escuchado) {
    if (yaEvaluado.current) return;
    /*
      Se marca ya, y no después de saber si hubo texto.

      Ahora en medio puede haber una transcripción en el servidor, que son
      segundos; sin marcarlo aquí, un segundo aviso del reconocedor durante esa
      espera mandaría la misma lectura dos veces. Si al final no se oyó nada se
      vuelve a poner en falso, y se puede reintentar igual que antes.
    */
    yaEvaluado.current = true;
    clearTimeout(espera.current);
    setError(null);
    setEstado('evaluando');

    /*
      El micrófono se devuelve ANTES de decidir nada.

      Lo que venga después —transcribir, evaluar, fallar— puede tardar segundos,
      y durante todo ese rato el aparato no tiene por qué seguir cogido. Es lo
      que deja el micro libre para el ejercicio siguiente pase lo que pase.
    */
    const grabado = await recogerAudio();
    sesion.current?.cancelar();
    sesion.current = null;

    const dicho = await loQueSeDijo(oido, grabado);

    if (!dicho.texto) {
      yaEvaluado.current = false;
      setError('No te escuchamos. Acércate al micrófono e inténtalo otra vez.');
      setEstado('listo');
      return;
    }

    try {
      const resultado = await enviarLectura<Informe>(
        {
          referenceText,
          transcript: dicho.texto,
          // El reconocedor entrega varias versiones de lo mismo. Aquí no se sabe
          // cuál es la buena; el servidor sí, porque tiene el texto que había que
          // leer, así que se le mandan todas y él se queda con la que encaja.
          alternatives: dicho.alternativas,
          exerciseCode: ejercicio.code,
          durationMs: Date.now() - inicio.current,
          ...(trickyWords
            ? { trickyWords: trickyWords.map(({ word, hint }) => ({ word, hint })) }
            : {}),
        },
        grabado,
      );
      setInforme(resultado);
      setEstado('hecho');
      // Lo que de verdad se dijo, venga del aparato o del servidor. La prueba de
      // nivel vuelve a corregir esto allí, así que mandar lo del reconocedor
      // cuando quien oyó fue Whisper le daría a corregir una frase vacía.
      onTerminado(resultado.aprobado, dicho);
    } catch {
      yaEvaluado.current = false;
      setError('No pudimos evaluar tu lectura. Inténtalo otra vez.');
      setEstado('listo');
    }
  }

  if (!soportado) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--borde)] p-8 text-center">
        <p className="text-3xl" aria-hidden>
          🔇
        </p>
        <p className="mt-3 font-medium">Tu navegador no puede escucharte</p>
        <p className="mt-1 text-sm text-[var(--texto-suave)]">
          La lectura en voz alta funciona en Chrome, Edge y Android. Puedes saltar este ejercicio.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-[var(--texto-suave)]">{ejercicio.prompt.instruction_es}</p>

      <div className="mt-5 rounded-2xl bg-[var(--superficie)] p-5">
        <p className="font-[var(--font-lectura)] text-xl leading-relaxed">
          {informe ? <TextoCorregido palabras={informe.words} /> : referenceText}
        </p>
      </div>

      {trickyWords && trickyWords.length > 0 && !informe && (
        <div className="mt-4 grid gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--texto-suave)]">
            Ojo con estas
          </p>
          {trickyWords.map((tricky) => (
            <p key={tricky.word} className="text-sm">
              <span className="font-semibold">{tricky.word}</span>{' '}
              <span className="text-[var(--texto-suave)]">{tricky.hint}</span>
            </p>
          ))}
        </div>
      )}

      {estado === 'escuchando' && (
        <div className="mt-5 rounded-2xl bg-marca-50 p-4 dark:bg-marca-900/30">
          <p className="text-sm text-marca-700 dark:text-marca-300">{parcial || 'Te escucho…'}</p>
        </div>
      )}

      {informe && <Resultado informe={informe} />}

      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--texto-fallo)]">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col items-center">
        {estado === 'listo' && (
          <>
            <button
              type="button"
              onClick={() => void empezar()}
              aria-label="Empezar a leer"
              className="flex size-20 items-center justify-center rounded-full bg-marca-600 text-white transition hover:bg-marca-700"
            >
              <Micro tamano={36} />
            </button>
            <p className="mt-3 text-sm text-[var(--texto-suave)]">Toca y lee en voz alta</p>
          </>
        )}

        {estado === 'escuchando' && (
          <>
            <button
              type="button"
              onClick={parar}
              aria-label="Terminé de leer"
              className="flex size-20 animate-pulse items-center justify-center rounded-full bg-[var(--color-fallo)] text-3xl text-white"
            >
              ■
            </button>
            <p className="mt-3 text-sm text-[var(--texto-suave)]">Toca cuando termines</p>
          </>
        )}

        {estado === 'evaluando' && (
          <p className="text-sm text-[var(--texto-suave)]">Escuchando lo que dijiste…</p>
        )}

        {estado === 'hecho' && (
          <button
            type="button"
            onClick={() => void empezar()}
            className="rounded-2xl border border-[var(--borde)] px-6 py-3 text-sm font-medium transition hover:border-marca-400"
          >
            Intentarlo otra vez
          </button>
        )}
      </div>
    </div>
  );
}

/** El texto con cada palabra pintada según cómo sonó. */
function TextoCorregido({ palabras }: { palabras: PalabraLeida[] }) {
  return (
    <span>
      {palabras
        .filter((palabra) => palabra.verdict !== 'inserted')
        .map((palabra, i) => (
          <span
            key={`${palabra.word}-${i}`}
            title={palabra.heard ? `Oímos: ${palabra.heard}` : 'No te oímos decirla'}
            className={cn(
              'mr-1.5 inline-block rounded px-1',
              palabra.verdict === 'correct'
                ? 'text-emerald-800 dark:text-emerald-300'
                : palabra.verdict === 'mispronounced'
                  ? 'bg-amber-200/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-red-200/60 text-red-900 line-through dark:bg-red-900/40 dark:text-red-200',
            )}
          >
            {palabra.word}
          </span>
        ))}
    </span>
  );
}

function Resultado({ informe }: { informe: Informe }) {
  const exactitud = Math.round(informe.accuracy * 100);

  return (
    <div className="mt-5">
      <div className="flex gap-3">
        <Medida valor={`${exactitud}%`} etiqueta="bien dichas" />
        <Medida valor={`${Math.round(informe.completeness * 100)}%`} etiqueta="del texto" />
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm">
        <span className="inline-block size-2 rounded-full bg-emerald-500" /> bien
        <span className="ml-2 inline-block size-2 rounded-full bg-amber-400" /> dudosa
        <span className="ml-2 inline-block size-2 rounded-full bg-red-400" /> no se oyó
      </p>

      {/*
        El desglose por sonidos va ANTES de la lista de palabras, y es un cambio
        de fondo: «te falló "think"» no se puede practicar, porque no dice qué
        hacer distinto la próxima vez. «Se te fue la lengua detrás de los dientes,
        sácala hasta que se vea» sí. La lista de palabras se queda debajo como
        recordatorio de dónde pasó.
      */}
      <ComoSonaste
        fonemas={informe.fonemas}
        cortes={informe.cortes}
        prosodia={informe.prosodia}
        palabras={palabrasPorIndice(informe.words)}
      />

      {informe.palabrasParaTrabajar.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--borde)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--texto-suave)]">
            Para la próxima
          </p>
          <ul className="mt-2 grid gap-1.5">
            {informe.palabrasParaTrabajar.map((palabra) => (
              <li key={palabra.word} className="text-sm">
                <span className="font-semibold">{palabra.word}</span>
                {palabra.hint && (
                  <span className="text-[var(--texto-suave)]"> · {palabra.hint}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * El texto de referencia por índice de palabra.
 *
 * Los cortes vienen con `indicePalabra`, que apunta al texto que había que leer,
 * no a lo que se dijo. Las palabras inventadas (`inserted`) no están en ese texto
 * y por eso no ocupan sitio: colocarlas correría todos los índices siguientes y
 * los cortes acabarían señalando palabras que no son.
 */
function palabrasPorIndice(palabras: readonly PalabraLeida[]): string[] {
  const lista: string[] = [];
  for (const palabra of palabras) {
    if (palabra.verdict === 'inserted') continue;
    lista[palabra.wordIndex] = palabra.word;
  }
  return lista;
}

function Medida({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-[var(--superficie)] p-3 text-center">
      <p className="text-xl font-bold text-marca-600 dark:text-marca-400">{valor}</p>
      <p className="text-xs text-[var(--texto-suave)]">{etiqueta}</p>
    </div>
  );
}
