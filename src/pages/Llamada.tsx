import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useNombreMascota } from '@/lib/mascota-contexto';
import { Boton } from '@/components/Boton';
import { Mascota } from '@/components/Mascota';
import { NOMBRE_CATEGORIA } from '@/components/ejercicios/tipos';
import { escuchar, estaDisponible, type SesionEscucha } from '@/lib/reconocimiento';
import { decir, hayVozInglesa, vozInglesaYa } from '@/lib/voz';

interface Escenario {
  code: string;
  titleEs: string;
  descripcionEs: string;
  primeraFrase: string;
}

interface Correccion {
  hasErrors: boolean;
  corrected: string;
  errors: Array<{ category: string; original: string; correction: string; explanation_es: string }>;
  praise_es?: string;
}

interface Turno {
  de: 'tu' | 'mascota';
  texto: string;
  correccion?: Correccion | null;
}

interface Resumen {
  summary_es: string;
  wentWell_es: string[];
  toImprove_es: string[];
  phrases: Array<{ en: string; es: string }>;
}

/** En qué parte de la llamada estamos. */
type Fase = 'eligiendo' | 'llamando' | 'dentro' | 'valorando' | 'repaso';

/** Qué está pasando dentro de la llamada. Es quien manda sobre el botón grande. */
type Momento = 'hablando' | 'tuTurno' | 'escuchando' | 'pensando';

type Valoracion = 'muy-facil' | 'adecuada' | 'muy-dificil';

/**
 * Cuántos turnos tuyos se consideran una llamada entera.
 *
 * La barra no marca un final obligatorio: se puede colgar antes y se puede
 * seguir después. Sirve para saber si esto va a durar dos minutos o veinte, que
 * es lo que decide si alguien empieza la llamada o la deja para luego.
 */
const TURNOS_LLAMADA = 6;

/**
 * Lo que dura la pantalla de «llamando».
 *
 * Existe porque la petición puede contestar en cien milisegundos, y entrar de
 * golpe en una conversación en inglés asusta. Medio segundo es el tiempo justo
 * para leer a quién se llama sin que parezca que la aplicación se ha colgado.
 */
const ESPERA_LLAMADA = 500;

/** Qué hacer ante cada fallo del micrófono. Nunca se deja un botón mudo. */
const MOTIVOS: Record<string, string> = {
  'not-allowed':
    'El navegador tiene el micrófono bloqueado. Dale permiso en el candado de la barra de direcciones y vuelve a pulsar.',
  'service-not-allowed':
    'El sistema no deja usar el micrófono. Revísalo en los ajustes de privacidad y vuelve a pulsar.',
  'audio-capture':
    'No encontramos ningún micrófono. Conecta uno o revisa cuál está elegido, y vuelve a pulsar.',
  network: 'Se cortó la conexión del reconocimiento. Comprueba internet y vuelve a pulsar.',
};

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/** Corta lo que se esté diciendo. `decir` no expone esto y colgar tiene que callar. */
function callar() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Navegador sin sintetizador: no había nada que cortar.
  }
}

/**
 * Llamada con la mascota: se habla en voz alta y se escucha, sin teclado.
 *
 * Lo que sostiene la pantalla es que hablar y escuchar nunca se solapen. El
 * micrófono solo se abre al pulsarlo, y solo se puede pulsar cuando la mascota
 * ya ha terminado de hablar. Si se abriera solo al acabar la frase, el altavoz
 * del móvil se oiría a sí mismo y la llamada se contestaría sola.
 *
 * Igual que en la conversación escrita, aquí no se corrige a nadie mientras
 * habla: las correcciones llegan con cada turno, se guardan calladas y se
 * enseñan al colgar.
 */
export function Llamada() {
  const navegar = useNavigate();
  const nombre = useNombreMascota();

  const [fase, setFase] = useState<Fase>('eligiendo');
  const [momento, setMomento] = useState<Momento>('hablando');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [escenario, setEscenario] = useState<Escenario | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [frase, setFrase] = useState('');
  const [parcial, setParcial] = useState('');
  const [subtitulo, setSubtitulo] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [valoracion, setValoracion] = useState<Valoracion | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);

  const [puedeEscuchar] = useState(() => estaDisponible());
  /*
    Lo que ya se sabe de las voces se usa en el primer pintado, y lo que no, se
    espera. Sin esto la pantalla enseñaría el aviso de «no hay voz inglesa»
    durante los tres segundos que Chrome tarda en publicar su lista.
  */
  const [vozInglesa, setVozInglesa] = useState<boolean | null>(() => {
    const ya = vozInglesaYa();
    return ya === 'todavia-no-se' ? null : ya === 'si';
  });

  const sesion = useRef<SesionEscucha | null>(null);
  const montado = useRef(true);
  /*
    Cada vez que se manda hablar sube este número. Lo que venía detrás de un
    `decir` anterior se compara con él y se retira si ya no es el actual: así,
    pulsar «repetir» a mitad de frase, o colgar, no deja una continuación vieja
    encendiendo el micrófono encima de la nueva.
  */
  const vozActual = useRef(0);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      sesion.current?.cancelar();
      sesion.current = null;
      callar();
    };
  }, []);

  useEffect(() => {
    if (vozInglesa !== null) return;
    let vivo = true;
    void hayVozInglesa().then((hay) => {
      if (vivo) setVozInglesa(hay);
    });
    return () => {
      vivo = false;
    };
  }, [vozInglesa]);

  const puedeLlamar = puedeEscuchar && vozInglesa === true;

  const { data: escenarios } = useQuery({
    queryKey: ['escenarios'],
    queryFn: () => api.get<{ scenarios: Escenario[] }>('/tutor/scenarios'),
    enabled: puedeLlamar,
  });

  // --- Hablar y escuchar, que nunca se pisan -------------------------------

  async function hablar(texto: string) {
    sesion.current?.cancelar();
    sesion.current = null;
    const marca = (vozActual.current += 1);

    setFrase(texto);
    setParcial('');
    setMomento('hablando');
    await decir(texto);

    // Mientras hablaba pudieron colgar o pedir otra frase: entonces esta
    // llamada ya no manda, y devolver el turno sería devolvérselo a nadie.
    if (!montado.current || vozActual.current !== marca) return;
    setMomento('tuTurno');
  }

  function ponerseAEscuchar() {
    setAviso(null);
    setParcial('');

    /*
      Un fallo del motor dispara `onError` y acto seguido `onend`, que llama a
      `onFinal` con lo poco que hubiera. Sin esta bandera, el aviso de «dale
      permiso al micrófono» se pisaría a sí mismo con un «no se oyó nada».
    */
    let fallo = false;

    const abierta = escuchar({
      idioma: 'en-US',
      onParcial: (texto) => setParcial(texto),
      onFinal: (resultado) => {
        sesion.current = null;
        if (fallo || !montado.current) return;

        const dicho = resultado.texto.trim();
        if (!dicho) {
          setMomento('tuTurno');
          setAviso('No se oyó nada. Acércate al micrófono y vuelve a pulsar.');
          return;
        }
        void responder(dicho);
      },
      onError: (motivo) => {
        fallo = true;
        sesion.current = null;
        if (!montado.current) return;
        setMomento('tuTurno');
        setAviso(MOTIVOS[motivo] ?? 'El micrófono falló. Vuelve a pulsar para intentarlo.');
      },
    });

    if (!abierta) {
      setMomento('tuTurno');
      setAviso(
        'No pudimos abrir el micrófono. Cierra otras pestañas que lo estén usando y vuelve a pulsar.',
      );
      return;
    }

    sesion.current = abierta;
    setMomento('escuchando');
  }

  async function responder(dicho: string) {
    if (!conversationId) return;

    setTurnos((previos) => [...previos, { de: 'tu', texto: dicho }]);
    setMomento('pensando');
    setParcial('');

    try {
      const respuesta = await api.post<{ reply: string; correction: Correccion | null }>(
        `/tutor/conversations/${conversationId}/turn`,
        { text: dicho },
      );

      setTurnos((previos) => {
        const copia = [...previos];
        const ultimo = copia[copia.length - 1];
        // La corrección se guarda junto a tu turno y se calla hasta el repaso.
        if (ultimo?.de === 'tu') {
          copia[copia.length - 1] = { ...ultimo, correccion: respuesta.correction };
        }
        return [...copia, { de: 'mascota', texto: respuesta.reply }];
      });

      await hablar(respuesta.reply);
    } catch {
      if (!montado.current) return;
      setMomento('tuTurno');
      setAviso('No pudimos enviar lo que dijiste. Vuelve a pulsar y repítelo.');
    }
  }

  // --- Entrar y salir de la llamada ----------------------------------------

  async function llamar(elegido: Escenario) {
    setError(null);
    setEscenario(elegido);
    setFase('llamando');

    try {
      const [inicio] = await Promise.all([
        api.post<{ conversationId: string; opening: string; titleEs?: string }>(
          '/tutor/conversations',
          { scenarioCode: elegido.code },
        ),
        esperar(ESPERA_LLAMADA),
      ]);
      if (!montado.current) return;

      setConversationId(inicio.conversationId);
      setTurnos([{ de: 'mascota', texto: inicio.opening }]);
      setFase('dentro');
      await hablar(inicio.opening);
    } catch {
      if (!montado.current) return;
      setFase('eligiendo');
      setError('No pudimos empezar la llamada. Inténtalo otra vez.');
    }
  }

  function colgar() {
    // Invalida cualquier continuación pendiente antes de cortar el audio.
    vozActual.current += 1;
    sesion.current?.cancelar();
    sesion.current = null;
    callar();
    setFase('valorando');

    if (!conversationId) return;
    void api
      .post<{ resumen: Resumen }>(`/tutor/conversations/${conversationId}/finish`)
      .then((final) => {
        if (montado.current) setResumen(final.resumen);
      })
      .catch(() => {
        // Sin resumen del servidor el repaso sigue en pie: las correcciones ya
        // llegaron turno a turno, y son lo que de verdad hay que enseñar.
      });
  }

  const tuyos = turnos.filter((turno) => turno.de === 'tu').length;
  const progreso = Math.min(1, tuyos / TURNOS_LLAMADA);

  // --- Sin micrófono o sin voz inglesa: no se entra -------------------------

  if (!puedeEscuchar || vozInglesa === false) {
    const sinMicro = !puedeEscuchar;
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 text-center">
        <Mascota estado="triste" tamano={130} className="mx-auto" />
        <h1 className="mt-4 text-2xl font-extrabold">
          {sinMicro ? 'Aquí no puedo escucharte' : 'Aquí no tengo voz inglesa'}
        </h1>
        <p className="mt-3 text-[var(--texto-suave)]">
          {sinMicro
            ? 'Este navegador no trae reconocimiento de voz, así que la llamada sería en un solo sentido.'
            : 'Tu equipo no tiene ninguna voz en inglés instalada. Leería el inglés con una voz española, y eso enseña una pronunciación que no existe.'}
        </p>

        <div className="mt-6 rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-4 text-left text-sm">
          <p className="font-bold">Cómo arreglarlo</p>
          <ul className="mt-2 grid list-disc gap-1.5 pl-4 text-[var(--texto-suave)]">
            {sinMicro ? (
              <>
                <li>Abre Speakmi en Chrome o en Edge, en el ordenador o en Android.</li>
                <li>Si estás en iPhone, usa por ahora la conversación escrita.</li>
              </>
            ) : (
              <>
                <li>En Windows: Configuración · Hora e idioma · Voz, y añade inglés.</li>
                <li>En Android: Ajustes · Idiomas · Salida de texto a voz.</li>
                <li>Después vuelve aquí y recarga la página.</li>
              </>
            )}
          </ul>
        </div>

        <Boton tono="suave" tamano="grande" className="mt-6" onClick={() => navegar('/conversar')}>
          Conversar por escrito
        </Boton>
        <Boton tono="suave" className="mt-3" onClick={() => navegar('/ruta')}>
          Volver
        </Boton>
      </div>
    );
  }

  // --- Mientras se sabe qué voces hay --------------------------------------

  if (vozInglesa === null) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 text-center">
        <Mascota estado="pensando" tamano={120} className="mx-auto" />
        <p className="mt-4 text-[var(--texto-suave)]" role="status">
          Preparando la llamada…
        </p>
      </div>
    );
  }

  // --- El repaso, al final de todo -----------------------------------------

  if (fase === 'repaso') {
    const tusTurnos = turnos.filter((turno) => turno.de === 'tu');

    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <div className="text-center">
          <Mascota estado="celebrando" tamano={120} className="mx-auto" />
          <h1 className="mt-3 text-2xl font-extrabold">Llamada terminada</h1>
          <p className="mt-2 text-[var(--texto-suave)]">
            {resumen?.summary_es ?? `Hablaste ${tusTurnos.length} veces en inglés, en voz alta.`}
          </p>
        </div>

        <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-[var(--texto-suave)]">
          Lo que dijiste
        </h2>
        <ul className="mt-3 grid gap-3">
          {tusTurnos.map((turno, indice) => {
            const fallos = turno.correccion?.hasErrors ? turno.correccion.errors : [];
            return (
              <li
                key={`${indice}-${turno.texto}`}
                style={{ animationDelay: `${indice * 60}ms` }}
                className="animate-entrada rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-4"
              >
                <p className="font-[var(--font-lectura)]" lang="en">
                  {turno.texto}
                </p>

                {fallos.length === 0 ? (
                  <p className="mt-2 text-sm font-bold text-[var(--texto-acierto)]">✓ Bien dicho</p>
                ) : (
                  <ul className="mt-3 grid gap-3">
                    {fallos.map((fallo) => (
                      <li key={`${fallo.original}-${fallo.correction}`} className="text-sm">
                        <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-xs font-bold dark:bg-white/10">
                          {NOMBRE_CATEGORIA[fallo.category] ?? fallo.category}
                        </span>
                        <p className="mt-1">
                          <span className="text-[var(--texto-fallo)] line-through">
                            {fallo.original}
                          </span>{' '}
                          <span className="text-[var(--texto-acierto)]">{fallo.correction}</span>
                        </p>
                        <p className="text-[var(--texto-suave)]">{fallo.explanation_es}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {resumen && resumen.phrases.length > 0 && (
          <div className="mt-5 rounded-2xl bg-marca-50 p-4 dark:bg-marca-900/30">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--texto-suave)]">
              Para la próxima llamada
            </p>
            <ul className="mt-2 grid gap-1.5 text-sm">
              {resumen.phrases.map((item) => (
                <li key={item.en}>
                  <span className="font-bold" lang="en">
                    {item.en}
                  </span>
                  <span className="text-[var(--texto-suave)]"> · {item.es}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Boton tamano="grande" className="mt-6" onClick={() => navegar('/ruta')}>
          VOLVER A MI RUTA
        </Boton>
      </div>
    );
  }

  // --- Qué tal fue ---------------------------------------------------------

  if (fase === 'valorando') {
    const opciones: Array<{ valor: Valoracion; titulo: string; detalle: string }> = [
      { valor: 'muy-facil', titulo: 'Muy fácil', detalle: 'Lo entendí todo sin esfuerzo.' },
      { valor: 'adecuada', titulo: 'Adecuada', detalle: 'Me costó lo justo.' },
      { valor: 'muy-dificil', titulo: 'Muy difícil', detalle: 'Me perdí más de una vez.' },
    ];

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
        <div className="text-center">
          <Mascota estado="animando" tamano={110} className="mx-auto" />
          <h1 className="mt-3 text-2xl font-extrabold">¿Qué tal fue?</h1>
          <p className="mt-2 text-sm text-[var(--texto-suave)]">
            Con esto ajusto el nivel de la próxima llamada.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          {opciones.map((opcion, indice) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => {
                setValoracion(opcion.valor);
                setFase('repaso');
              }}
              style={{ animationDelay: `${indice * 60}ms` }}
              className={cn(
                'boton-3d animate-entrada min-h-12 rounded-2xl border-2 border-[var(--hueco)]',
                'bg-[var(--superficie)] p-4 text-left hover:border-marca-400',
                valoracion === opcion.valor && 'border-marca-500',
              )}
            >
              <p className="font-bold">{opcion.titulo}</p>
              <p className="mt-1 text-sm text-[var(--texto-suave)]">{opcion.detalle}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- Llamando ------------------------------------------------------------

  if (fase === 'llamando') {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 text-center">
        <div className="mx-auto flex size-56 animate-crecer items-center justify-center rounded-full bg-marca-50 dark:bg-marca-900/40">
          <Mascota estado="animando" tamano={170} />
        </div>
        <p className="mt-6 text-xl font-extrabold" role="status">
          Llamando a {nombre}…
        </p>
        <p className="mt-2 text-sm text-[var(--texto-suave)]">{escenario?.titleEs}</p>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={colgar}
            aria-label="Colgar la llamada"
            className="boton-3d flex size-16 items-center justify-center rounded-full border-b-4 border-red-800 bg-red-600 text-2xl text-white"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
      </div>
    );
  }

  // --- Elegir de qué hablar ------------------------------------------------

  if (fase === 'eligiendo') {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <div className="text-center">
          <Mascota estado="animando" tamano={110} className="mx-auto" />
          <h1 className="mt-3 text-2xl font-extrabold">¿De qué hablamos?</h1>
          <p className="mt-2 text-sm text-[var(--texto-suave)]">
            Te llamo y hablamos en inglés, en voz alta. No te corrijo durante la llamada: lo vemos
            al colgar.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          {escenarios?.scenarios.map((opcion, indice) => (
            <button
              key={opcion.code}
              type="button"
              onClick={() => void llamar(opcion)}
              style={{ animationDelay: `${indice * 60}ms` }}
              className="boton-3d animate-entrada min-h-12 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4 text-left hover:border-marca-400"
            >
              <p className="font-bold">{opcion.titleEs}</p>
              <p className="mt-1 text-sm text-[var(--texto-suave)]">{opcion.descripcionEs}</p>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm text-[var(--texto-fallo)]" role="alert">
            {error}
          </p>
        )}

        <Boton tono="suave" className="mt-6" onClick={() => navegar('/ruta')}>
          Volver
        </Boton>
      </div>
    );
  }

  // --- Dentro de la llamada ------------------------------------------------

  /*
    Mientras te toca a ti, la mascota se queda en neutral: sigue respirando y
    parpadeando, pero no hace nada. Es lo que dice sin palabras que la pelota
    está en tu tejado.
  */
  const estadoMascota =
    momento === 'hablando'
      ? 'hablando'
      : momento === 'escuchando'
        ? 'escuchando'
        : momento === 'pensando'
          ? 'pensando'
          : 'neutral';

  const etiquetaBoton =
    momento === 'hablando'
      ? `Escucha a ${nombre}`
      : momento === 'tuTurno'
        ? 'Pulsa para hablar'
        : momento === 'escuchando'
          ? 'Pulsa para enviar'
          : `${nombre} está respondiendo…`;

  /*
    Lo que se lee abajo. Mientras te escucha, lo que va entendiendo; el resto
    del tiempo, lo que dijo la mascota.

    Se recorta a las últimas palabras a propósito. Un subtítulo que crece sin
    parar deja de ser un subtítulo: se comió media pantalla y empujó a la
    mascota fuera en la primera prueba con una frase larga. Se enseña la cola y
    no el principio porque lo que importa es lo que se acaba de decir.
  */
  const loQueSeVe = recortarCola(momento === 'escuchando' && parcial ? parcial : frase, 140);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-bold">{escenario?.titleEs}</p>
        <button
          type="button"
          onClick={colgar}
          aria-label="Colgar la llamada"
          className="boton-3d flex min-h-12 items-center gap-2 rounded-2xl border-b-4 border-red-800 bg-red-600 px-4 font-bold text-white"
        >
          <span aria-hidden>✕</span> Colgar
        </button>
      </header>

      <div
        role="progressbar"
        aria-label="Avance de la llamada"
        aria-valuemin={0}
        aria-valuemax={TURNOS_LLAMADA}
        aria-valuenow={tuyos}
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[var(--hueco)]"
      >
        <div
          className="h-full rounded-full bg-marca-500 transition-[width] duration-300 ease-out"
          style={{ width: `${progreso * 100}%` }}
        />
      </div>

      {/* La mascota manda en la pantalla: es a quien se le está hablando. */}
      <div className="flex flex-1 flex-col items-center justify-center py-4">
        <Mascota estado={estadoMascota} tamano={260} className="max-w-full" />

        <p className="sr-only" role="status">
          {momento === 'hablando'
            ? `${nombre} está hablando`
            : momento === 'escuchando'
              ? `${nombre} te está escuchando`
              : momento === 'pensando'
                ? `${nombre} está pensando`
                : 'Tu turno'}
        </p>

        {subtitulo && loQueSeVe && (
          /*
            Sobre la mascota hay colores claros y oscuros, así que el subtítulo
            lleva su propio fondo casi opaco en vez de fiarse del de la página.
            Es la única forma de garantizar el contraste en los dos temas.
          */
          <p
            className="mt-4 w-full animate-subir rounded-2xl bg-slate-900/95 px-4 py-3 text-center font-[var(--font-lectura)] text-lg text-white shadow-lg"
            lang="en"
          >
            {loQueSeVe}
          </p>
        )}
      </div>

      {aviso && (
        <p className="mb-2 text-center text-sm text-[var(--texto-fallo)]" role="alert">
          {aviso}
        </p>
      )}

      <div className="sticky bottom-0 grid gap-3 bg-[var(--fondo)] pb-3 pt-2">
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => void hablar(frase)}
            disabled={!frase || momento === 'pensando' || momento === 'escuchando'}
            aria-label="Repetir la última frase"
            className="boton-3d flex min-h-12 items-center gap-2 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] px-4 text-sm font-bold disabled:opacity-50"
          >
            <span aria-hidden>↺</span> Repetir
          </button>

          <button
            type="button"
            onClick={() => setSubtitulo((antes) => !antes)}
            aria-pressed={!subtitulo}
            className="boton-3d flex min-h-12 items-center gap-2 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] px-4 text-sm font-bold"
          >
            {subtitulo ? 'Ocultar subtítulo' : 'Mostrar subtítulo'}
          </button>
        </div>

        <Boton
          tamano="grande"
          tono={momento === 'escuchando' ? 'acierto' : 'marca'}
          className={cn('min-h-16 text-lg', momento === 'escuchando' && 'animate-latido')}
          disabled={momento === 'hablando' || momento === 'pensando'}
          onClick={() => {
            if (momento === 'tuTurno') ponerseAEscuchar();
            else if (momento === 'escuchando') sesion.current?.detener();
          }}
        >
          {etiquetaBoton}
        </Boton>
      </div>
    </div>
  );
}

/** Las últimas palabras de un texto, sin cortar ninguna por la mitad. */
function recortarCola(texto: string, maximo: number): string {
  const limpio = texto.trim();
  if (limpio.length <= maximo) return limpio;

  const cola = limpio.slice(limpio.length - maximo);
  const desdePalabra = cola.indexOf(' ');
  return `… ${desdePalabra === -1 ? cola : cola.slice(desdePalabra + 1)}`;
}
