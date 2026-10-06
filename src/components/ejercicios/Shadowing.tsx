import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useMenosMovimiento } from '@/lib/movimiento';
import { grabar, puedeGrabar, type Grabacion } from '@/lib/grabacion';
import { sondarFugaDeAltavoz, sePuedeSondar, type Sonda } from '@/lib/auriculares';
import {
  enviarIntento,
  fuenteDeAudio,
  palabrasDelTrozo,
  pedirShadow,
  rangoDeAudio,
  textoDelTrozo,
  type Intento,
  type Opciones,
  type Shadow as DatosShadow,
  type Trozo,
} from '@/lib/shadowing';
import { ComoSonaste } from './ComoSonaste';
import { foneticaDeMentira } from '@/lib/fonetica-mentira';
import type { EvaluacionFonetica } from '@/lib/fonetica';
import {
  avisosDeRitmo,
  compararRitmo,
  loQueSuena,
  type Desliz,
  type PalabraDicha,
  type TiempoDePalabra,
} from '@/lib/shadowing-ritmo';

/**
 * Shadowing: oír a un nativo y repetir encima imitando su ritmo.
 *
 * No es leer en voz alta. Ahí lo que se mide es si te entienden las palabras;
 * aquí lo que se practica es la FORMA de la frase: qué sílaba pisas, qué
 * palabras van pegadas, dónde coge aire. Por eso la pantalla se organiza en
 * trozos cortos que se repiten hasta que salen, y por eso el resultado enseña
 * dónde te descuadraste y no solo un porcentaje.
 *
 * Las dos decisiones que sostienen todo lo demás:
 *
 *   1. Sin auriculares el modo «a la vez» no existe. Si el modelo suena por el
 *      altavoz mientras grabas, el micrófono lo recoge y el reconocedor puntúa
 *      su voz. La nota saldría alta y no sería tuya.
 *   2. Nunca por debajo de 0,75. Más lento, el inglés deja de tener ritmo de
 *      inglés: desaparecen las contracciones y las vocales débiles, y acabas
 *      practicando con destreza una forma de hablar que nadie usa.
 */

/** Las únicas dos velocidades. Ver el punto 2 de arriba. */
const VELOCIDADES = [0.75, 1] as const;
type Velocidad = (typeof VELOCIDADES)[number];

/** Con menos de esto no se aprueba el trozo. El ritmo no puntúa: ver `Resultado`. */
const UMBRAL = 0.7;

type Modo = 'por-turnos' | 'simultaneo';

interface Props {
  ejercicio: { code: string; prompt?: { instruction_es?: string } };
  /** Solo para la pantalla de pruebas: fuerza los caminos sin tiempos y sin ritmo. */
  opciones?: Opciones;
  onTerminado?: (aprobado: boolean) => void;
}

export function Shadowing({ ejercicio, opciones, onTerminado }: Props) {
  const menosMovimiento = useMenosMovimiento();

  const [datos, setDatos] = useState<DatosShadow | null>(null);
  const [simulado, setSimulado] = useState(false);
  const [cargando, setCargando] = useState(true);

  const [indiceTrozo, setIndiceTrozo] = useState(0);
  const [velocidad, setVelocidad] = useState<Velocidad>(1);
  const [msActual, setMsActual] = useState(0);
  const [sonando, setSonando] = useState(false);

  const [modo, setModo] = useState<Modo>('por-turnos');
  const [sonda, setSonda] = useState<Sonda | null>(null);
  const [sondando, setSondando] = useState(false);

  const [grabando, setGrabando] = useState(false);
  const [miAudio, setMiAudio] = useState<string | null>(null);
  const [evaluando, setEvaluando] = useState(false);
  /*
    El intento, más los tres campos nuevos de fonética.

    Se ensancha aquí y no en `lib/shadowing.ts` porque el contrato de esa capa lo
    escribe el servidor de shadowing y el de fonética viene de otro sitio: son
    dos acuerdos distintos que se juntan en pantalla. Como los tres campos son
    opcionales, una respuesta que no los traiga encaja sin tocar nada.
  */
  const [intento, setIntento] = useState<(Intento & EvaluacionFonetica) | null>(null);
  const [intentos, setIntentos] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audio = useRef<HTMLAudioElement | null>(null);
  const grabacion = useRef<Grabacion | null>(null);
  const reloj = useRef<number | null>(null);

  const trozo: Trozo | null = datos?.trozos[indiceTrozo] ?? null;
  const palabrasModelo = datos && trozo ? palabrasDelTrozo(datos.palabras, trozo) : null;

  useEffect(() => {
    let vigente = true;
    void pedirShadow(ejercicio.code, opciones ?? {}).then((respuesta) => {
      if (!vigente) return;
      setDatos(respuesta.datos);
      setSimulado(respuesta.simulado);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
    // `opciones` viene de la URL y no cambia durante la vida de la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejercicio.code]);

  const parar = useCallback(() => {
    if (reloj.current !== null) cancelAnimationFrame(reloj.current);
    reloj.current = null;
    audio.current?.pause();
    setSonando(false);
  }, []);

  /*
    Al salir, y también al cambiar de frase: nada sonando, nada grabando.

    Va colgado de `ejercicio.code` y no solo del desmontaje, que es lo que había.
    En «Imitar el ritmo» se cambia de frase sin desmontar nada —solo cambia la
    prop—, así que con la limpieza atada al desmontaje no se ejecutaba nunca y la
    frase siguiente heredaba el micrófono abierto de la anterior. Es el mismo
    fallo que en leer en voz alta, y se nota igual: la primera vez te oye y a
    partir de ahí no, sin decir nada.
  */
  useEffect(
    () => () => {
      parar();
      grabacion.current?.cancelar();
      grabacion.current = null;
    },
    [parar, ejercicio.code],
  );

  useEffect(() => {
    return () => {
      if (miAudio) URL.revokeObjectURL(miAudio);
    };
  }, [miAudio]);

  /**
   * Suena el trozo, y solo el trozo.
   *
   * El tramo de audio sale de los tiempos de las palabras, no de los índices
   * del trozo. Sin marcas no hay tramo que valga y suena la frase entera: es lo
   * honesto, porque cortar por un sitio calculado a ojo deja a alguien
   * repitiendo media palabra sin saber por qué.
   */
  function escuchar(nueva: Velocidad) {
    const elemento = audio.current;
    if (!elemento || !trozo || !datos) return;

    const tramo = rangoDeAudio(datos.palabras, trozo, datos.audio.duracionMs);
    const desde = tramo?.desdeMs ?? 0;
    const hasta = tramo?.hastaMs ?? datos.audio.duracionMs;

    setVelocidad(nueva);
    setError(null);
    elemento.playbackRate = nueva;
    // Sin esto, a 0,75 el nativo suena grave y a nadie le sirve imitar a alguien
    // que no habla así.
    elemento.preservesPitch = true;
    elemento.currentTime = desde / 1000;
    setMsActual(desde);
    setSonando(true);

    const seguir = () => {
      const ms = elemento.currentTime * 1000;
      setMsActual(ms);
      if (ms >= hasta) {
        parar();
        return;
      }
      reloj.current = requestAnimationFrame(seguir);
    };

    void elemento
      .play()
      .then(() => {
        reloj.current = requestAnimationFrame(seguir);
      })
      .catch(() => {
        setSonando(false);
        setError('El navegador no dejó sonar el audio. Vuelve a tocar el botón.');
      });
  }

  async function comprobarAuriculares() {
    setSondando(true);
    const resultado = await sondarFugaDeAltavoz();
    setSonda(resultado);
    setSondando(false);
    // Si se está en simultáneo y resulta que hay fuga, se baja solo. Dejarlo
    // puesto sería mantener encendido justo lo que acabamos de medir que miente.
    if (resultado.fuga !== 'sin-fuga') setModo('por-turnos');
  }

  async function empezarAGrabar() {
    setError(null);
    setIntento(null);
    if (miAudio) {
      URL.revokeObjectURL(miAudio);
      setMiAudio(null);
    }

    // Si quedó una grabación viva de un intento anterior se cierra antes de
    // abrir otra: dos flujos del micrófono a la vez dejan el piloto encendido y
    // el aparato cogido por el que ya nadie va a usar.
    grabacion.current?.cancelar();
    grabacion.current = null;

    const abierta = await grabar();
    if (!abierta) {
      setError('No pudimos abrir el micrófono. Dale permiso y vuelve a intentarlo.');
      return;
    }

    grabacion.current = abierta;
    setGrabando(true);
    // En simultáneo el modelo suena mientras hablas, que es el ejercicio de
    // verdad: se habla ENCIMA, no después. Solo se llega aquí con auriculares.
    if (modo === 'simultaneo') escuchar(velocidad);
  }

  async function terminarDeGrabar() {
    const abierta = grabacion.current;
    grabacion.current = null;
    setGrabando(false);
    parar();
    if (!abierta) return;

    const blob = await abierta.terminar();
    if (!blob) {
      setError('No se grabó nada. Acércate al micrófono y vuelve a intentarlo.');
      return;
    }

    setMiAudio(URL.createObjectURL(blob));
    setEvaluando(true);
    try {
      const respuesta = await enviarIntento(ejercicio.code, blob, indiceTrozo, opciones ?? {});
      /*
        Con el doble puesto no hay fonética de ningún sitio, así que se inventa
        aquí para poder mirar la pantalla. Solo cuando el intento ES de mentira:
        colgarle sonidos inventados a una corrección de verdad sería exactamente
        lo que el aviso de arriba promete que no pasa.
      */
      setIntento(
        respuesta.simulado
          ? {
              ...respuesta.intento,
              ...foneticaDeMentira(respuesta.intento.palabras.map((palabra) => palabra.word)),
            }
          : respuesta.intento,
      );
      setSimulado((antes) => antes || respuesta.simulado);
      setIntentos((cuantos) => cuantos + 1);
      onTerminado?.(respuesta.intento.accuracy >= UMBRAL);
    } catch {
      setError('No pudimos evaluar el intento. Inténtalo otra vez.');
    } finally {
      setEvaluando(false);
    }
  }

  function oirte() {
    if (!miAudio) return;
    parar();
    const mio = new Audio(miAudio);
    void mio.play().catch(() => setError('El navegador no dejó sonar tu grabación.'));
  }

  function irAlTrozo(indice: number) {
    parar();
    setIndiceTrozo(indice);
    setIntento(null);
    setIntentos(0);
    setMsActual(0);
    if (miAudio) {
      URL.revokeObjectURL(miAudio);
      setMiAudio(null);
    }
  }

  if (cargando) {
    return <p className="p-6 text-center text-[var(--texto-suave)]">Preparando el audio…</p>;
  }

  if (!datos || !trozo) {
    return (
      <p role="alert" className="p-6 text-center text-[var(--texto-fallo)]">
        No pudimos cargar este ejercicio.
      </p>
    );
  }

  const fuente = fuenteDeAudio(datos.audio);
  const simultaneoDisponible = sonda?.fuga === 'sin-fuga';

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10">
      {fuente && <audio ref={audio} src={fuente} preload="auto" />}

      {simulado && (
        <p className="mt-4 rounded-xl border border-dashed border-amber-500 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Datos de mentira: el servidor de shadowing todavía no responde. Lo que ves aquí no es tu
          voz corregida.
        </p>
      )}

      <p className="mt-4 text-sm text-[var(--texto-suave)]">
        {ejercicio.prompt?.instruction_es ??
          'Escucha y repite encima, imitando el ritmo y la entonación. No se trata de acertar las palabras: se trata de sonar igual.'}
      </p>

      <AvisoDeAuriculares
        sonda={sonda}
        sondando={sondando}
        onComprobar={() => void comprobarAuriculares()}
      />

      <SelectorDeTrozo
        trozos={datos.trozos}
        activo={indiceTrozo}
        intentos={intentos}
        onElegir={irAlTrozo}
      />

      <div className="mt-4 rounded-2xl bg-[var(--superficie)] p-4">
        {palabrasModelo ? (
          <TextoResaltado
            palabras={palabrasModelo}
            ms={msActual}
            sonando={sonando}
            menosMovimiento={menosMovimiento}
          />
        ) : (
          <>
            <p className="font-[var(--font-lectura)] text-xl leading-relaxed">
              {textoDelTrozo(datos.texto, trozo)}
            </p>
            <p className="mt-3 text-xs text-[var(--texto-suave)]">
              Este audio no trae los tiempos de cada palabra, así que no podemos ir señalando cuál
              suena ni aislar el trozo: suena la frase entera. Sigue el texto de oído.
            </p>
          </>
        )}
      </div>

      <Controles
        velocidad={velocidad}
        sonando={sonando}
        grabando={grabando}
        evaluando={evaluando}
        puedeGrabar={puedeGrabar()}
        tieneMiAudio={Boolean(miAudio)}
        onEscuchar={escuchar}
        onParar={parar}
        onGrabar={() => void empezarAGrabar()}
        onTerminar={() => void terminarDeGrabar()}
        onOirme={oirte}
      />

      <ModoDePractica
        modo={modo}
        disponible={simultaneoDisponible}
        sonda={sonda}
        onCambiar={setModo}
      />

      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--texto-fallo)]">
          {error}
        </p>
      )}

      {intento && (
        <Resultado
          intento={intento}
          modelo={palabrasModelo}
          onOtraVez={() => void empezarAGrabar()}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * El aviso de los auriculares.
 *
 * Va arriba y no escondido en los ajustes porque cambia lo que significa la
 * nota, no la comodidad. Y no dice «se recomiendan auriculares»: dice qué pasa
 * si no los llevas, porque un consejo sin consecuencia no lo sigue nadie.
 */
function AvisoDeAuriculares({
  sonda,
  sondando,
  onComprobar,
}: {
  sonda: Sonda | null;
  sondando: boolean;
  onComprobar: () => void;
}) {
  const tono =
    sonda?.fuga === 'sin-fuga'
      ? 'border-emerald-500 text-emerald-800 dark:text-emerald-300'
      : sonda?.fuga === 'con-fuga'
        ? 'border-red-500 text-red-800 dark:text-red-300'
        : 'border-amber-500 text-amber-800 dark:text-amber-300';

  return (
    <section className={cn('mt-4 rounded-2xl border-2 p-4', tono)} aria-live="polite">
      <p className="text-sm font-semibold">
        <span aria-hidden>🎧</span> Ponte auriculares antes de empezar
      </p>
      <p className="mt-1 text-xs text-[var(--texto-suave)]">
        Si el modelo sale por el altavoz, tu micrófono lo graba a él y la corrección puntúa su voz.
        Saldrías con un notable sin haber abierto la boca.
      </p>

      {sonda && (
        <p className="mt-2 text-sm">
          {sonda.motivo}
          {sonda.subidaDb !== null && (
            <span className="text-[var(--texto-suave)]">
              {' '}
              ({sonda.subidaDb > 0 ? '+' : ''}
              {sonda.subidaDb} dB)
            </span>
          )}
        </p>
      )}

      {!sePuedeSondar() && (
        <p className="mt-2 text-sm">
          Este navegador no deja comprobarlo. Pon los auriculares igualmente.
        </p>
      )}

      {sePuedeSondar() && (
        <button
          type="button"
          onClick={onComprobar}
          disabled={sondando}
          className="mt-3 min-h-11 w-full rounded-xl border border-current px-4 text-sm font-medium disabled:opacity-60"
        >
          {sondando
            ? 'Sonando un pitido…'
            : sonda
              ? 'Volver a comprobar'
              : 'Comprobar (oirás un pitido corto)'}
        </button>
      )}
    </section>
  );
}

function SelectorDeTrozo({
  trozos,
  activo,
  intentos,
  onElegir,
}: {
  trozos: readonly Trozo[];
  activo: number;
  intentos: number;
  onElegir: (indice: number) => void;
}) {
  return (
    <nav className="mt-4" aria-label="Trozos de la frase">
      <div className="flex flex-wrap gap-2">
        {trozos.map((trozo, i) => (
          <button
            key={`${trozo.desde}-${i}`}
            type="button"
            onClick={() => onElegir(i)}
            aria-current={i === activo ? 'true' : undefined}
            className={cn(
              'min-h-11 min-w-11 rounded-xl border px-3 text-sm',
              i === activo
                ? 'border-marca-600 bg-marca-600 font-bold text-white'
                : 'border-[var(--borde)] text-[var(--texto-suave)]',
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--texto-suave)]">
        Trozo {activo + 1} de {trozos.length} ·{' '}
        {intentos === 0
          ? 'sin intentos todavía'
          : `${intentos} ${intentos === 1 ? 'intento' : 'intentos'} en este trozo`}
      </p>
    </nav>
  );
}

/**
 * El texto con la palabra que suena encendida.
 *
 * Es lo que permite seguir el audio sin ir leyendo por delante, que es el vicio
 * que arruina el ejercicio: quien lee por delante practica lectura, no ritmo.
 * En las pausas no se enciende nada y aparece un punto de respiración, porque
 * saber dónde se calla el modelo es la mitad de lo que hay que copiar.
 */
function TextoResaltado({
  palabras,
  ms,
  sonando,
  menosMovimiento,
}: {
  palabras: readonly TiempoDePalabra[];
  ms: number;
  sonando: boolean;
  menosMovimiento: boolean;
}) {
  const { indice, pausa } = loQueSuena(palabras, ms);

  return (
    <p className="font-[var(--font-lectura)] text-xl leading-relaxed">
      {palabras.map((palabra, i) => (
        <span
          key={`${palabra.word}-${i}`}
          aria-current={sonando && i === indice ? 'true' : undefined}
          className={cn(
            'mr-1.5 inline-block rounded px-1',
            // La transición se quita con movimiento reducido, pero el resaltado
            // NO: es información, no adorno. Sin él no se sabe qué suena.
            !menosMovimiento && 'transition-colors duration-75',
            sonando && i === indice ? 'bg-marca-600 font-bold text-white' : 'text-[var(--texto)]',
          )}
        >
          {palabra.word}
        </span>
      ))}
      {sonando && pausa && (
        <span className="ml-1 align-middle text-sm text-marca-600 dark:text-marca-400">
          · respira ·
        </span>
      )}
    </p>
  );
}

function Controles({
  velocidad,
  sonando,
  grabando,
  evaluando,
  puedeGrabar: hayMicro,
  tieneMiAudio,
  onEscuchar,
  onParar,
  onGrabar,
  onTerminar,
  onOirme,
}: {
  velocidad: Velocidad;
  sonando: boolean;
  grabando: boolean;
  evaluando: boolean;
  puedeGrabar: boolean;
  tieneMiAudio: boolean;
  onEscuchar: (velocidad: Velocidad) => void;
  onParar: () => void;
  onGrabar: () => void;
  onTerminar: () => void;
  onOirme: () => void;
}) {
  return (
    <div className="mt-4 grid gap-2">
      <div className="flex gap-2">
        {VELOCIDADES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => (sonando && v === velocidad ? onParar() : onEscuchar(v))}
            className={cn(
              'min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium',
              sonando && v === velocidad
                ? 'border-marca-600 bg-marca-600 text-white'
                : 'border-[var(--borde)]',
            )}
          >
            {sonando && v === velocidad ? 'Parar' : `Escuchar ${v === 1 ? 'normal' : '0,75'}`}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={grabando ? onTerminar : onGrabar}
        disabled={!hayMicro || evaluando}
        className={cn(
          'min-h-14 rounded-2xl px-4 text-base font-bold text-white disabled:opacity-60',
          grabando ? 'bg-[var(--color-fallo)]' : 'bg-marca-700',
        )}
      >
        {evaluando ? 'Mirando tu ritmo…' : grabando ? 'Ya está, para' : 'Repetir encima'}
      </button>

      <button
        type="button"
        onClick={onOirme}
        disabled={!tieneMiAudio}
        className="min-h-11 rounded-xl border border-[var(--borde)] px-4 text-sm disabled:opacity-50"
      >
        Oírte a ti
      </button>

      {!hayMicro && (
        <p className="text-xs text-[var(--texto-suave)]">
          Este navegador no puede grabar. Puedes escuchar y repetir, pero no corregirte.
        </p>
      )}
    </div>
  );
}

function ModoDePractica({
  modo,
  disponible,
  sonda,
  onCambiar,
}: {
  modo: Modo;
  disponible: boolean;
  sonda: Sonda | null;
  onCambiar: (modo: Modo) => void;
}) {
  const porQueNo = !disponible
    ? sonda === null
      ? 'Comprueba antes los auriculares: hasta entonces no sabemos si tu micrófono está oyendo al modelo.'
      : sonda.fuga === 'con-fuga'
        ? 'Desactivado: tu micrófono está oyendo el altavoz, así que la corrección puntuaría la voz del modelo.'
        : `Desactivado: ${sonda.motivo} Sin esa comprobación la nota no sería fiable.`
    : null;

  return (
    <fieldset className="mt-4 rounded-2xl border border-[var(--borde)] p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-[var(--texto-suave)]">
        Cómo practicar
      </legend>
      <div className="grid gap-2">
        <Opcion
          nombre="Por turnos"
          detalle="Escuchas, y luego repites. Vale siempre."
          elegido={modo === 'por-turnos'}
          onElegir={() => onCambiar('por-turnos')}
        />
        <Opcion
          nombre="A la vez"
          detalle="Hablas encima del modelo. Es el shadowing de verdad."
          elegido={modo === 'simultaneo'}
          desactivado={!disponible}
          onElegir={() => onCambiar('simultaneo')}
        />
      </div>
      {porQueNo && <p className="mt-2 text-xs text-[var(--texto-suave)]">{porQueNo}</p>}
    </fieldset>
  );
}

function Opcion({
  nombre,
  detalle,
  elegido,
  desactivado,
  onElegir,
}: {
  nombre: string;
  detalle: string;
  elegido: boolean;
  desactivado?: boolean;
  onElegir: () => void;
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 items-start gap-2 rounded-xl p-2',
        desactivado ? 'opacity-50' : 'cursor-pointer',
        elegido && !desactivado && 'bg-marca-50 dark:bg-marca-900/30',
      )}
    >
      <input
        type="radio"
        name="modo-shadowing"
        checked={elegido}
        disabled={desactivado}
        onChange={onElegir}
        className="mt-1 size-5 shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{nombre}</span>
        <span className="block text-xs text-[var(--texto-suave)]">{detalle}</span>
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */

/**
 * El resultado.
 *
 * El porcentaje de palabras está, pero no es lo que se viene a ver: lo que
 * enseña a hablar es el mapa de abajo, donde se ve qué palabra llegó tarde y
 * qué pausa te saltaste. Por eso el ritmo NO decide si apruebas: hay
 * proveedores que no lo miden, y suspender por algo que ni siquiera se puede
 * medir en ese aparato sería inventarse una nota.
 */
function Resultado({
  intento,
  modelo,
  onOtraVez,
}: {
  intento: Intento & EvaluacionFonetica;
  modelo: readonly TiempoDePalabra[] | null;
  onOtraVez: () => void;
}) {
  const deslices = modelo ? compararRitmo(modelo, intento.palabras) : null;
  const avisos = deslices ? avisosDeRitmo(deslices) : [];

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--texto-suave)]">
        Qué tal ha ido
      </h2>

      <p className="mt-2 text-sm">{intento.mensaje_es}</p>

      {intento.ritmo.disponible && <Acentos ritmo={intento.ritmo} />}

      <div className="mt-2 flex gap-2">
        <Medida valor={`${Math.round(intento.accuracy * 100)}%`} etiqueta="palabras claras" />
        {intento.ritmo.disponible && (
          <Medida valor={`${intento.ritmo.desfaseMedioMs} ms`} etiqueta="de desfase medio" />
        )}
      </div>

      {intento.ritmo.disponible && (
        /*
          LA CORRELACIÓN VA AQUÍ ABAJO Y EN PEQUEÑO, Y ES A PROPÓSITO.

          Mide si tus subidas y bajadas siguen a las del modelo, y a un
          hispanohablante se le da bien sin haber arreglado nada: leyendo sílaba
          a sílaba se tarda lo mismo y los huecos caen donde el modelo los deja,
          así que sale un 0,84 con el ritmo español intacto. Ponerla de marcador
          principal sería felicitar justo a quien peor lo está haciendo. Se
          enseña porque es un dato real, no se esconde; pero no manda.
        */
        <p className="mt-2 text-xs text-[var(--texto-suave)]">
          Tu curva de entonación se parece un {Math.round(intento.ritmo.correlacion * 100)} % a la
          suya. Es un dato suelto: se saca alto aunque el ritmo siga siendo español, así que mira
          los acentos.
        </p>
      )}

      {!intento.ritmo.disponible && (
        <p className="mt-3 rounded-xl border border-dashed border-[var(--borde)] p-3 text-sm text-[var(--texto-suave)]">
          El ritmo todavía no se puede medir con este audio. Preferimos decírtelo a enseñarte un
          número que no significa nada.
        </p>
      )}

      <PalabrasDichas palabras={intento.palabras} />

      {/*
        Qué sonido se falló, debajo de las palabras y encima del mapa de ritmo.
        Ahí porque encadena: arriba se ve QUÉ palabra salió regular, aquí POR QUÉ
        y qué hacer con la lengua, y debajo dónde se descuadró la frase entera.
      */}
      <ComoSonaste
        fonemas={intento.fonemas}
        cortes={intento.cortes}
        prosodia={intento.prosodia}
        palabras={intento.palabras.map((palabra) => palabra.word)}
      />

      {deslices ? (
        <MapaDeRitmo
          deslices={deslices}
          modelo={modelo!}
          dichas={intento.palabras}
          avisos={avisos}
        />
      ) : (
        <p className="mt-4 text-sm text-[var(--texto-suave)]">
          Sin los tiempos del modelo no podemos decirte dónde te descuadraste, solo qué palabras se
          entendieron.
        </p>
      )}

      <button
        type="button"
        onClick={onOtraVez}
        className="mt-5 min-h-12 w-full rounded-2xl bg-marca-700 px-4 font-bold text-white"
      >
        Repetir este trozo
      </button>
    </section>
  );
}

/**
 * El marcador que manda: cuántas sílabas fuertes pisaste.
 *
 * Es el único de los tres que ve el fallo de un hispanohablante. El español da
 * a cada sílaba más o menos el mismo peso y el inglés no: aplasta las débiles
 * para llegar a tiempo a las fuertes. Quien lee sílaba a sílaba tarda lo mismo
 * que el modelo y dibuja una curva parecida —desfase bajo, correlación alta—,
 * pero no acierta un solo acento. Por eso va arriba, grande y explicado: un
 * número sin la frase que lo explica no le dice a nadie qué tiene que cambiar.
 */
function Acentos({ ritmo }: { ritmo: Intento['ritmo'] }) {
  const total = Math.max(1, ritmo.acentosTotales);
  const parte = ritmo.acentosAcertados / total;
  const bien = parte >= 0.7;

  return (
    <div
      className={cn(
        'mt-3 rounded-2xl border-2 p-3',
        bien ? 'border-emerald-500' : 'border-amber-500',
      )}
    >
      <p className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-3xl font-bold',
            bien ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300',
          )}
        >
          {ritmo.acentosAcertados}/{ritmo.acentosTotales}
        </span>
        <span className="text-sm font-medium">sílabas fuertes pisadas</span>
      </p>
      <p className="mt-1 text-xs text-[var(--texto-suave)]">
        {bien
          ? 'Esto es lo que hace que suenes a inglés: aplastas las sílabas débiles para llegar a tiempo a las fuertes.'
          : 'El inglés aplasta las sílabas débiles para llegar a tiempo a las fuertes; el español las reparte por igual. Es lo que estás practicando aquí.'}
      </p>
    </div>
  );
}

function Medida({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-[var(--superficie)] p-2 text-center">
      <p className="truncate text-lg font-bold text-marca-600 dark:text-marca-400">{valor}</p>
      <p className="text-[0.7rem] leading-tight text-[var(--texto-suave)]">{etiqueta}</p>
    </div>
  );
}

function PalabrasDichas({ palabras }: { palabras: readonly PalabraDicha[] }) {
  return (
    <p className="mt-4 font-[var(--font-lectura)] text-lg leading-relaxed">
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
    </p>
  );
}

/**
 * Dónde se descuadró, dibujado y escrito.
 *
 * Dos líneas de tiempo, la del modelo y la tuya, para que se vea de un vistazo
 * qué palabra se te fue y qué silencio te comiste. Debajo va lo mismo en
 * palabras: el dibujo no lo puede leer quien usa lector de pantalla, y con
 * movimiento reducido tampoco hay animación que lo cuente, así que la lista no
 * es un extra sino la misma información por otro camino.
 */
function MapaDeRitmo({
  deslices,
  modelo,
  dichas,
  avisos,
}: {
  deslices: readonly Desliz[];
  modelo: readonly TiempoDePalabra[];
  dichas: readonly PalabraDicha[];
  avisos: readonly string[];
}) {
  /*
    Solo se quitan las inventadas, igual que en `compararRitmo`. Las omitidas se
    quedan como hueco: si se filtraran, la palabra siguiente ocuparía su puesto
    en la lista y todas las barras de después se dibujarían encima de la palabra
    equivocada. Un mapa descolocado es peor que no tener mapa.
  */
  const tuyas = dichas.filter((palabra) => palabra.verdict !== 'inserted');
  const situadas = tuyas.filter((palabra) => palabra.startMs !== null && palabra.endMs !== null);
  const sinSituar = tuyas.length - situadas.length;

  const origenModelo = modelo[0]?.startMs ?? 0;
  const origenTuyo = situadas[0]?.startMs ?? 0;
  const finModelo = (modelo[modelo.length - 1]?.endMs ?? 0) - origenModelo;
  const finTuyo = (situadas[situadas.length - 1]?.endMs ?? 0) - origenTuyo;
  const total = Math.max(finModelo, finTuyo, 1);

  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold">Dónde se descuadró</h3>
      <p className="mt-1 text-xs text-[var(--texto-suave)]">
        Las dos líneas empiezan a la vez a propósito: lo que se compara es la forma de la frase, no
        cuánto tardaste en arrancar.
      </p>

      <div className="mt-3 grid gap-1 overflow-hidden">
        <Linea etiqueta="Modelo">
          {modelo.map((palabra, i) => (
            <Barra
              key={`m-${i}`}
              izquierda={((palabra.startMs - origenModelo) / total) * 100}
              ancho={((palabra.endMs - palabra.startMs) / total) * 100}
              texto={palabra.word}
              clase="bg-marca-600 text-white"
            />
          ))}
        </Linea>

        <Linea etiqueta="Tú">
          {deslices.map((desliz, i) => {
            const tuya = tuyas[i];
            // Sin hora no hay dónde ponerla, y el cero sería el principio de la
            // frase: parecería que la dijiste antes de empezar.
            if (!tuya || tuya.startMs === null || tuya.endMs === null) return null;
            return (
              <Barra
                key={`t-${i}`}
                izquierda={((tuya.startMs - origenTuyo) / total) * 100}
                ancho={((tuya.endMs - tuya.startMs) / total) * 100}
                texto={desliz.word}
                clase={
                  desliz.cuando === 'a-tiempo'
                    ? 'bg-emerald-600 text-white'
                    : desliz.cuando === 'tarde'
                      ? 'bg-amber-500 text-amber-950'
                      : 'bg-sky-600 text-white'
                }
              />
            );
          })}
        </Linea>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--texto-suave)]">
        <span>
          <span className="mr-1 inline-block size-2 rounded-full bg-emerald-600" />a tiempo
        </span>
        <span>
          <span className="mr-1 inline-block size-2 rounded-full bg-amber-500" />
          tarde
        </span>
        <span>
          <span className="mr-1 inline-block size-2 rounded-full bg-sky-600" />
          antes de tiempo
        </span>
        {sinSituar > 0 && (
          <span>
            · {sinSituar === 1 ? 'una palabra' : `${sinSituar} palabras`} sin hora: no salen en tu
            línea
          </span>
        )}
      </p>

      {avisos.length > 0 ? (
        <ul className="mt-3 grid gap-1.5">
          {avisos.map((aviso) => (
            <li key={aviso} className="text-sm">
              {aviso}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--texto-acierto)]">
          El ritmo te salió. Ninguna palabra se desvió más de una décima.
        </p>
      )}
    </div>
  );
}

function Linea({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-[var(--texto-suave)]">{etiqueta}</span>
      <div className="relative h-7 min-w-0 flex-1 rounded-lg bg-[var(--superficie)]">
        {children}
      </div>
    </div>
  );
}

function Barra({
  izquierda,
  ancho,
  texto,
  clase,
}: {
  izquierda: number;
  ancho: number;
  texto: string;
  clase: string;
}) {
  return (
    <span
      // Se recorta a la caja para que una palabra que se fue de tiempo no
      // empuje el ancho de la página en un móvil de 320.
      style={{
        left: `${Math.max(0, Math.min(100, izquierda))}%`,
        width: `${Math.max(2, Math.min(100, ancho))}%`,
      }}
      className={cn(
        'absolute top-1 flex h-5 items-center overflow-hidden rounded px-0.5 text-[0.6rem]',
        clase,
      )}
    >
      <span className="truncate">{texto}</span>
    </span>
  );
}
