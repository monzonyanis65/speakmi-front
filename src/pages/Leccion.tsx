import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Ejercicio } from '@/components/ejercicios/Ejercicio';
import { LeerEnVozAlta } from '@/components/ejercicios/LeerEnVozAlta';
import { Shadowing } from '@/components/ejercicios/Shadowing';
import { HablarLibre } from '@/components/ejercicios/HablarLibre';
import { useContador } from '@/lib/contador';
import { Mascota, MascotaConMensaje, type EstadoMascota } from '@/components/Mascota';
import { Boton } from '@/components/Boton';
import { Confeti } from '@/components/Confeti';
import {
  NOMBRE_CATEGORIA,
  type Correccion,
  type EjercicioPublico,
  type Respuesta,
} from '@/components/ejercicios/tipos';
import { ListaDeMisiones } from '@/components/misiones/Misiones';
import type { Misiones } from '@/components/misiones/tipos';
import { useMenosMovimiento } from '@/lib/movimiento';
import { fraseDe, repartoDeLeccion, type Momento, type Personaje } from '@/lib/reparto';

interface DatosLeccion {
  lesson: { code: string; titleEs: string; type: string; xpReward: number };
  skills: Array<{ code: string; titleEs: string; explanationMd: string | null }>;
  exercises: EjercicioPublico[];
}

interface Resumen {
  score: number;
  total: number;
  accuracy: number;
  xpEarned: number;
  /**
   * Cómo quedan los desafíos del día DESPUÉS de esta lección.
   *
   * Viene dentro de la misma respuesta y no en otra petición a propósito: si
   * la pantalla tuviera que preguntarlo aparte, habría un momento en que el
   * resumen ya está puesto y la misión todavía dice lo de antes, que es
   * exactamente la sensación de que el marcador no cuadra con el final.
   *
   * Opcional porque un servidor que todavía no se ha actualizado no lo manda,
   * y quedarse sin pantalla de resumen por eso sería mucho peor que no ver las
   * misiones.
   */
  misiones?: Misiones;
}

// Los que no se corrigen contra una solución escrita: llevan su propio flujo,
// se evalúan en el módulo de voz y se pueden saltar. El dictado no está aquí
// porque sí se escribe, aunque se oiga primero.
const SIN_TECLADO = new Set(['read_aloud', 'speak_prompt']);

/**
 * Una lección, un ejercicio por pantalla.
 *
 * La corrección la hace el servidor; aquí solo se muestra. Nunca se bloquea el
 * avance por fallar: el error se explica y se sigue, porque atascar a alguien
 * en una frase es la forma más rápida de que cierre la app.
 */
export function Leccion() {
  const navegar = useNavigate();
  const { code } = useParams<{ code: string }>();

  const [sessionId, setSessionId] = useState<string | null>(null);
  /** Por qué no se pudo abrir la lección, si es que no se pudo. */
  const [cerrada, setCerrada] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [correccion, setCorreccion] = useState<Correccion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [vozHecha, setVozHecha] = useState(false);
  /**
   * Si en este ejercicio de leer en voz alta se está imitando al modelo en vez
   * de leerlo por cuenta propia.
   *
   * Son dos cosas distintas y por eso se elige, en vez de sustituir una por la
   * otra: leer mide si sabes decirlo, e imitar mide CÓMO lo dices —el ritmo—,
   * que es lo que de verdad separa a un hispanohablante y lo único que la app
   * no medía en ninguna parte. Arranca siempre en leer, así que quien ya usaba
   * la app no nota ningún cambio hasta que lo pulsa.
   */
  const [imitando, setImitando] = useState(false);
  /**
   * Lo que se falló y hay que volver a preguntar antes de dar la lección por
   * terminada.
   *
   * Pasar de largo por un fallo es la forma más rápida de no aprenderlo: se lee
   * la corrección, se asiente y se olvida. Volver a preguntarlo al final, en la
   * misma sesión, obliga a producirlo de nuevo, que es cuando se fija.
   *
   * Guarda posiciones, no códigos, porque es la posición lo que se usa para
   * navegar por la lista.
   */
  const [porRepetir, setPorRepetir] = useState<number[]>([]);
  const [repitiendo, setRepitiendo] = useState(false);
  /** Cuántas preguntas se han contestado ya, repescas incluidas. */
  const [contestados, setContestados] = useState(0);
  /** Cuántas repescas habrá en total. Solo crece, para que la barra no retroceda. */
  const [repescas, setRepescas] = useState(0);
  /** Aciertos seguidos. Se parte al primer fallo. */
  const [racha, setRacha] = useState(0);
  /** Lo que el personaje tiene en el bocadillo ahora mismo, si tiene algo. */
  const [dicho, setDicho] = useState<string | null>(null);

  /*
    Quién da esta lección. Sale del código y solo del código: volver a L5-U1-03
    es volver a encontrarse al mismo, que es lo que separa a un personaje de un
    adorno que rota.
  */
  const { protagonista, secundario } = repartoDeLeccion(code ?? '');
  const quieto = useMenosMovimiento();
  const presencia = usePresencia(protagonista.paciencia, quieto);

  // La frase de entrada, una sola vez y al montar. Es la única que no responde
  // a nada de lo que hagas, y por eso es también la única que se pone sola.
  useEffect(() => {
    if (!code) return;
    setDicho(fraseDe(protagonista, 'entra', code));
  }, [code, protagonista]);

  /*
    Todo lo que se dice se calla solo. Un bocadillo que se queda puesto deja de
    leerse a los diez segundos y a partir de ahí solo ocupa sitio.

    Entre una frase y la siguiente siempre pasa por `null` —una racha tarda tres
    ejercicios y el reloj son seis segundos—, así que basta con mirar el texto:
    no hace falta un contador para distinguir dos frases iguales seguidas,
    porque nunca llegan seguidas.
  */
  useEffect(() => {
    if (!dicho) return;
    const reloj = setTimeout(() => setDicho(null), 6000);
    return () => clearTimeout(reloj);
  }, [dicho]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['leccion', code],
    queryFn: () => api.get<DatosLeccion>(`/curriculum/lessons/${code!}`),
    enabled: Boolean(code),
  });

  // Se abre la sesión en cuanto se sabe qué lección es.
  useEffect(() => {
    if (!code || sessionId) return;
    void api
      .post<{ sessionId: string }>('/sessions/start', { lessonCode: code })
      .then((r) => setSessionId(r.sessionId))
      .catch((error: unknown) => {
        setSessionId(null);
        // Sin sesión la lección se ve pero no corrige nada: hay que decir por
        // qué. El caso corriente es haber llegado aquí escribiendo la
        // dirección de una lección que todavía está cerrada.
        setCerrada(
          error instanceof ApiError
            ? error.message
            : 'No pudimos abrir esta lección. Inténtalo otra vez.',
        );
      });
  }, [code, sessionId]);

  const ejercicios = data?.exercises ?? [];
  const ejercicio = ejercicios[indice];
  // Solo es el último de verdad si no queda nada pendiente de repetir.
  const esUltimo = indice + 1 >= ejercicios.length && porRepetir.length === 0;
  const necesitaVoz = ejercicio ? SIN_TECLADO.has(ejercicio.type) : false;

  async function comprobar() {
    if (!ejercicio || !sessionId || respuesta === null) return;
    setEnviando(true);
    try {
      const resultado = await api.post<Correccion>(`/sessions/${sessionId}/answer`, {
        exerciseCode: ejercicio.code,
        answer: respuesta,
        // En la repesca el servidor corrige y explica, pero no vuelve a contar:
        // acertar a la segunda no borra que a la primera no salió.
        ...(repitiendo ? { reintento: true } : {}),
      });
      setCorreccion(resultado);

      /*
        La racha. Se lleva aquí y no en el servidor porque no vale puntos: es
        solo para que el personaje se entere de que llevas unas cuantas.

        Habla cada tres, no cada vez. Un comentario por acierto deja de ser un
        comentario y pasa a ser el ruido de fondo de la pantalla, y además la
        corrección del servidor ya está escrita justo debajo: dos textos a la
        vez sobre lo mismo se leen a la mitad.
      */
      const seguidas = resultado.isCorrect ? racha + 1 : 0;
      setRacha(seguidas);
      if (seguidas >= 3 && seguidas % 3 === 0) {
        setDicho(fraseDe(protagonista, 'racha', `${code ?? ''}:${seguidas}`));
      }
    } catch {
      // Sin corrección no se puede seguir, y dejar el botón mudo parece que la
      // aplicación se colgó. Se avisa y se deja volver a intentarlo.
      setCorreccion({
        isCorrect: false,
        score: 0,
        feedback: {
          message_es: 'No pudimos corregirlo. Inténtalo otra vez en un momento.',
          errores: [],
        },
      });
    } finally {
      setEnviando(false);
    }
  }

  async function siguiente() {
    // Lo que se acaba de fallar se apunta para volver a preguntarlo. Si ya
    // venía de la repesca y se vuelve a fallar, no se encola otra vez:
    // repetir en bucle algo que no sale frustra y no enseña.
    const cola = [...porRepetir];
    if (correccion && !correccion.isCorrect && !repitiendo && !cola.includes(indice)) {
      cola.push(indice);
      setRepescas((n) => n + 1);
    }

    setCorreccion(null);
    setRespuesta(null);
    setVozHecha(false);
    setImitando(false);
    setContestados((n) => n + 1);

    // Mientras quede lista por delante se sigue en orden. Ojo: esto NO vale
    // durante la repesca, porque entonces el índice apunta a un ejercicio de
    // atrás y avanzar uno volvería a recorrer la lección entera.
    if (!repitiendo && indice + 1 < ejercicios.length) {
      setPorRepetir(cola);
      setIndice(indice + 1);
      return;
    }

    // Se acabó la lista, o se está en la repesca: toca lo siguiente de la cola.
    const siguienteRepesca = cola[0];
    if (siguienteRepesca !== undefined) {
      setPorRepetir(cola.slice(1));
      setRepitiendo(true);
      setIndice(siguienteRepesca);
      return;
    }

    setRepitiendo(false);
    setPorRepetir([]);
    if (sessionId) {
      const final = await api.post<Resumen>(`/sessions/${sessionId}/finish`);

      // El servidor ya ha contado esta lección, así que su versión de las
      // misiones es la buena: se mete en la caché en vez de pedirla otra vez.
      // La ruta y el menú la encuentran ya al día al volver.
      if (final.misiones) queryClient.setQueryData(['misiones'], final.misiones);
      setResumen(final);
    }
  }

  if (isPending) return <Centrado>Cargando la lección…</Centrado>;
  if (isError || !data) return <Centrado>No pudimos cargar la lección.</Centrado>;

  if (cerrada) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <MascotaConMensaje
          especie={protagonista.especie}
          atuendo={null}
          estado={protagonista.animo.espera}
          mensaje={cerrada}
        />
        <Boton tamano="grande" onClick={() => navegar('/ruta')} className="mt-8">
          VOLVER A MI RUTA
        </Boton>
      </div>
    );
  }

  if (resumen)
    return (
      <PantallaResumen
        resumen={resumen}
        protagonista={protagonista}
        secundario={secundario}
        codigo={code ?? ''}
        onSalir={() => navegar('/ruta')}
      />
    );

  if (!ejercicio) return <Centrado>Esta lección no tiene ejercicios todavía.</Centrado>;

  // El total incluye las repescas: si no, la barra llegaría al final y después
  // seguirían apareciendo preguntas, que es desconcertante. Y `repescas` solo
  // crece, así que la barra nunca retrocede.
  const total = ejercicios.length + repescas;
  const progreso = Math.min(100, (contestados / total) * 100);

  /*
    Qué le está pasando al personaje.

    Manda lo que acaba de ocurrir; y cuando no ocurre nada, manda el reloj. Ese
    orden es el que hace que esté PRESENTE en vez de pegado: sin la segunda
    mitad, entre pregunta y pregunta se quedaría en la misma pose respirando, y
    eso se lee como una imagen con un efecto encima.
  */
  const momento: Momento = correccion
    ? momentoDe(correccion, ejercicio.difficulty, racha)
    : presencia;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-4 sm:px-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navegar('/ruta')}
          aria-label="Salir de la lección"
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-xl text-xl text-[var(--texto-suave)] transition hover:text-[var(--texto)]"
        >
          ✕
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--superficie)]">
          {/* La barra avanza con una curva que frena al final, no lineal: se
              nota el avance sin que parezca que va a seguir corriendo. */}
          <div
            className="h-full rounded-full bg-marca-600 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <span className="text-xs text-[var(--texto-suave)]">
          {Math.min(contestados + 1, total)}/{total}
        </span>
      </header>

      {/*
        La `key` es lo que hace que el ejercicio entre animado.
        Sin ella React reutiliza el mismo nodo al cambiar de pregunta, la
        animación no vuelve a arrancar y el siguiente ejercicio aparece de golpe,
        como si la pantalla hubiera parpadeado. Con ella se monta uno nuevo cada
        vez y se ve de dónde viene.
      */}
      {/*
        Decir que este ya se falló cambia cómo se afronta: se lee con cuidado
        en vez de ir en automático. Callarlo y repreguntarlo a secas parece un
        error de la aplicación, como si se hubiera perdido el sitio.
      */}
      <Compania
        personaje={protagonista}
        estado={protagonista.animo[momento]}
        dice={dicho ?? undefined}
      />

      {repitiendo && (
        <p className="mt-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[var(--texto-aviso)]">
          <span aria-hidden>↻</span>
          Esta la fallaste antes
        </p>
      )}

      <main
        key={`${ejercicio.code}-${repitiendo ? 'rep' : 'ini'}`}
        className="mt-4 flex-1 animate-entrada"
      >
        {ejercicio.type === 'read_aloud' ? (
          <>
            {imitando ? (
              <Shadowing
                ejercicio={{ code: ejercicio.code }}
                onTerminado={() => setVozHecha(true)}
              />
            ) : (
              <LeerEnVozAlta
                ejercicio={ejercicio as unknown as Parameters<typeof LeerEnVozAlta>[0]['ejercicio']}
                onTerminado={() => setVozHecha(true)}
              />
            )}

            {/*
              El cambio va DEBAJO y en pequeño, no arriba como dos pestañas.
              Arriba obligaría a elegir antes de haber visto la frase, y quien
              no sepa qué es el shadowing elegiría a ciegas; aquí se ofrece
              cuando ya se sabe qué se está mirando. No borra lo hecho: `vozHecha`
              se queda, así que probar lo otro nunca quita el paso ya dado.
            */}
            <button
              type="button"
              onClick={() => setImitando((antes) => !antes)}
              className="mt-6 w-full rounded-xl px-4 py-3 text-sm text-[var(--texto-suave)] underline underline-offset-4"
            >
              {imitando ? 'Mejor lo leo yo' : 'Imitar el ritmo del modelo'}
            </button>
          </>
        ) : ejercicio.type === 'speak_prompt' ? (
          <HablarLibre
            ejercicio={ejercicio as unknown as Parameters<typeof HablarLibre>[0]['ejercicio']}
            onTerminado={() => setVozHecha(true)}
          />
        ) : (
          <Ejercicio
            ejercicio={ejercicio}
            bloqueado={correccion !== null}
            onCambio={setRespuesta}
            resultado={correccion}
          />
        )}
      </main>

      {correccion && (
        <HojaCorreccion
          correccion={correccion}
          yaSeVeArriba={seMarcaEnElEjercicio(ejercicio)}
          personaje={protagonista}
          momento={momento}
        />
      )}

      <div className="sticky bottom-0 bg-[var(--fondo)] py-4">
        {correccion ? (
          <Boton
            tono={correccion.isCorrect ? 'acierto' : 'marca'}
            tamano="grande"
            onClick={() => void siguiente()}
          >
            {esUltimo ? 'TERMINAR' : 'CONTINUAR'}
          </Boton>
        ) : necesitaVoz ? (
          <Boton
            tono={vozHecha ? 'acierto' : 'suave'}
            tamano="grande"
            onClick={() => void siguiente()}
          >
            {vozHecha ? (esUltimo ? 'TERMINAR' : 'CONTINUAR') : 'Saltar por ahora'}
          </Boton>
        ) : (
          <Boton
            tamano="grande"
            onClick={() => void comprobar()}
            disabled={respuesta === null || enviando || !sessionId}
          >
            {enviando ? 'REVISANDO…' : 'COMPROBAR'}
          </Boton>
        )}
      </div>
    </div>
  );
}

/**
 * Cuánto hace que no tocas nada, dicho en momentos.
 *
 * Es la mitad de que el personaje esté PRESENTE. La otra mitad son las
 * reacciones, pero esas solo ocurren un segundo cada minuto; lo que se ve el
 * resto del tiempo es esto. Un dibujo que respira y ya está se lee como una
 * ilustración con un efecto encima, y se deja de mirar a los dos minutos.
 *
 * Los tres escalones son: se entera de que estás ahí, se cansa de esperar y se
 * duerme. Cuándo pasa de uno a otro lo decide la `paciencia` de cada personaje,
 * no una constante de esta pantalla, porque aburrirse antes que los demás es
 * carácter: Rufo ronca mientras Ulises sigue dándole vueltas.
 *
 * Se escucha en `window` y no en el ejercicio a propósito. El ejercicio lo pinta
 * otro componente con sus propios campos, y engancharse a él obligaría a que
 * cada tipo de ejercicio se acordara de avisar. En la ventana se enteran todos
 * gratis, incluido el que solo se toca con el dedo.
 *
 * Con `prefers-reduced-motion` se queda quieto en reposo. No se pierde nada:
 * que se aburra no es información, es compañía, y quien pide menos estímulo
 * está pidiendo exactamente que eso no ocurra. Las reacciones a acertar y
 * fallar sí se mantienen, porque esas SÍ dicen algo.
 */
function usePresencia(paciencia: number, quieto: boolean): Momento {
  const [fase, setFase] = useState<Momento>('atento');

  useEffect(() => {
    if (quieto) {
      setFase('reposo');
      return;
    }

    let relojes: ReturnType<typeof setTimeout>[] = [];
    const despertar = () => {
      for (const reloj of relojes) clearTimeout(reloj);
      // El comparador no es un adorno: sin él, cada tecla pulsada volvería a
      // pintar la pantalla entera para dejarla exactamente igual.
      setFase((antes) => (antes === 'atento' ? antes : 'atento'));
      relojes = [
        setTimeout(() => setFase('reposo'), 2000),
        setTimeout(() => setFase('espera'), paciencia * 1000),
        setTimeout(() => setFase('sopor'), paciencia * 3000),
      ];
    };

    despertar();
    window.addEventListener('keydown', despertar);
    window.addEventListener('pointerdown', despertar);
    return () => {
      for (const reloj of relojes) clearTimeout(reloj);
      window.removeEventListener('keydown', despertar);
      window.removeEventListener('pointerdown', despertar);
    };
  }, [paciencia, quieto]);

  return fase;
}

/**
 * El personaje acompañando, entre la cabecera y el ejercicio.
 *
 * VA EN EL FLUJO, NO FLOTANDO, y eso es la decisión entera de este componente.
 * Un personaje en una esquina fija es lo primero que se le ocurre a cualquiera
 * y es lo que tapa el último renglón del ejercicio justo en la pantalla más
 * pequeña, que es donde más falta hace verlo. Aquí no puede tapar nada porque
 * no se solapa con nada.
 *
 * Y la altura es FIJA, diga algo o no. Si la tira creciera al aparecer el
 * bocadillo, el ejercicio daría un salto hacia abajo cada vez que al personaje
 * le diera por hablar, que es la peor forma posible de llamar la atención:
 * pierdes el sitio donde estabas leyendo.
 *
 * Por eso el bocadillo se corta a dos líneas en vez de crecer. Dos líneas caben
 * en la tira a 320 px; la tercera la corta, y prefiero una frase cortada a un
 * ejercicio que se mueve.
 */
function Compania({
  personaje,
  estado,
  dice,
}: {
  personaje: Personaje;
  estado: EstadoMascota;
  dice?: string;
}) {
  return (
    <div className="mt-2 flex h-14 items-center gap-2">
      <Mascota
        especie={personaje.especie}
        atuendo={null}
        estado={estado}
        tamano={48}
        className="shrink-0"
      />
      {dice && (
        <p className="relative min-w-0 animate-entrada rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-3 py-1.5 text-sm leading-snug">
          {/* Pico del bocadillo, encajado en el hueco del `gap-2`. */}
          <span
            aria-hidden
            className="absolute -left-[7px] top-1/2 size-3 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-[var(--borde)] bg-[var(--superficie)]"
          />
          <span className="line-clamp-2">{dice}</span>
        </p>
      )}
    </div>
  );
}

/** El panel que sube al responder: lo más importante de toda la pantalla. */
/**
 * ¿El propio ejercicio ya pinta cuál era la buena?
 *
 * Los que se responden eligiendo la marcan en verde en su sitio. Repetirla
 * abajo en grande hace leer dos veces lo mismo y roba sitio a la explicación,
 * que es lo que de verdad enseña. Los que se escriben sí la necesitan: ahí no
 * hay nada que marcar.
 */
function seMarcaEnElEjercicio(ejercicio: {
  type: string;
  prompt: Record<string, unknown>;
}): boolean {
  if (ejercicio.type === 'multiple_choice') return true;
  const opciones = ejercicio.prompt.choices;
  return ejercicio.type === 'fill_blank' && Array.isArray(opciones) && opciones.length > 0;
}

function HojaCorreccion({
  correccion,
  yaSeVeArriba,
  personaje,
  momento,
}: {
  correccion: Correccion;
  yaSeVeArriba: boolean;
  personaje: Personaje;
  momento: Momento;
}) {
  const { isCorrect, feedback } = correccion;
  const [verPorque, setVerPorque] = useState(false);

  return (
    <div
      role="status"
      className={cn(
        'mt-6 animate-subir rounded-2xl p-5',
        !isCorrect && correccion.score === 0 && 'animate-temblor',
        isCorrect
          ? 'bg-emerald-50 dark:bg-emerald-950/30'
          : correccion.score > 0
            ? 'bg-amber-50 dark:bg-amber-950/30'
            : 'bg-red-50 dark:bg-red-950/30',
      )}
    >
      <div className="flex items-center gap-3">
        {/*
          El de esta lección, reaccionando a lo que pasó. Quién es y qué cara
          pone lo decide `reparto.ts`, no esta pantalla: aquí solo se dice QUÉ
          ha ocurrido y el personaje se lo toma a su manera. Nala no se inmuta,
          Tuco se acerca a leerlo contigo.

          Va sin atuendo a propósito: la ropa es de la mascota que llevas
          puesta, que es tuya. Esta no lo es, es la que da la clase.
        */}
        <Mascota
          especie={personaje.especie}
          atuendo={null}
          estado={personaje.animo[momento]}
          tamano={52}
          className="shrink-0"
        />
        <p
          className={cn(
            'text-lg font-extrabold',
            isCorrect
              ? 'text-emerald-700 dark:text-emerald-300'
              : correccion.score > 0
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-red-700 dark:text-red-300',
          )}
        >
          {feedback.message_es}
        </p>
      </div>

      {feedback.correcta && !yaSeVeArriba && (
        <p className="mt-3 font-[var(--font-lectura)] text-lg">
          {feedback.diff ? <TextoComparado diff={feedback.diff} /> : feedback.correcta}
        </p>
      )}

      {feedback.errores.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {feedback.errores.map((error, i) => (
            <li key={`${error.category}-${i}`} className="text-sm">
              <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-xs font-medium dark:bg-white/10">
                {NOMBRE_CATEGORIA[error.category] ?? error.category}
              </span>{' '}
              {/* Sin repetir la respuesta: ya se muestra arriba en grande. */}
              {error.explicacion_es ?? 'Revísalo.'}
            </li>
          ))}
        </ul>
      )}

      {feedback.explicacion_es && (
        <div className="mt-3">
          {verPorque ? (
            <p className="text-sm text-[var(--texto-suave)]">{feedback.explicacion_es}</p>
          ) : (
            <button
              type="button"
              onClick={() => setVerPorque(true)}
              className="-mx-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold underline underline-offset-4"
            >
              ¿Por qué?
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** La frase correcta, marcando qué palabra falló. */
/**
 * Qué acaba de pasar, en el vocabulario del reparto.
 *
 * Esto dice el HECHO; la cara la pone cada personaje. Separarlo es lo que
 * permite que Nala y Tuco vivan el mismo acierto de dos maneras sin que esta
 * pantalla sepa nada de ninguno de los dos.
 *
 * `racha` sale también con un ejercicio difícil acertado a la primera, porque
 * significan lo mismo: esto no ha salido gratis. Reaccionar igual a lo fácil y
 * a lo difícil deja la reacción sin valor, que es el problema de fondo de
 * felicitar por todo.
 */
function momentoDe(correccion: Correccion, dificultad: number, racha: number): Momento {
  if (!correccion.isCorrect) {
    // Casi: la idea estaba y falló la forma. Ni es un acierto ni es un fallo.
    return correccion.score > 0 ? 'casi' : 'fallo';
  }
  return dificultad >= 3 || racha >= 3 ? 'racha' : 'acierto';
}

function TextoComparado({ diff }: { diff: Correccion['feedback']['diff'] }) {
  return (
    <span>
      {(diff ?? []).map((parte, i) => {
        if (parte.tipo === 'sobra') return null;

        const texto = parte.esperado ?? '';
        return (
          <span
            key={`${texto}-${i}`}
            className={cn(
              'mr-1.5 inline-block',
              parte.tipo === 'igual'
                ? ''
                : 'rounded bg-red-200/70 px-1 font-semibold dark:bg-red-900/50',
            )}
          >
            {texto}
          </span>
        );
      })}
    </span>
  );
}

function PantallaResumen({
  resumen,
  protagonista,
  secundario,
  codigo,
  onSalir,
}: {
  resumen: Resumen;
  protagonista: Personaje;
  secundario: Personaje;
  codigo: string;
  onSalir: () => void;
}) {
  const porcentaje = Math.round(resumen.accuracy * 100);
  // No es lo mismo terminar bien que terminar a rastras, y el personaje lo
  // sabe. Los tres escalones son los de antes; lo que cambia es que ahora cada
  // uno se lo toma a su manera en vez de haber una única cara para todos.
  const comoFue: Momento = porcentaje >= 80 ? 'final' : porcentaje >= 50 ? 'acierto' : 'casi';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 text-center">
      {porcentaje >= 80 && <Confeti />}

      {/*
        Entran con la animación larga, la única de la aplicación: es el premio
        por haber terminado y merece un segundo entero.

        Aquí sale también el secundario, y es el único sitio donde sale. Es lo
        que convierte cinco dibujos sueltos en un reparto: hasta que no ves a
        dos juntos y con caras distintas, no hay nadie, hay una mascota.
      */}
      <div className="flex animate-revelar items-end justify-center gap-1">
        <Mascota
          especie={protagonista.especie}
          atuendo={null}
          estado={protagonista.animo[comoFue]}
          tamano={124}
        />
        <Mascota
          especie={secundario.especie}
          atuendo={null}
          estado={secundario.animo.reposo}
          tamano={84}
        />
      </div>

      {/*
        Lo que dice el que ha dado la clase, en lugar de un «¡Muy bien!».

        El titular de antes felicitaba por haber llegado al final, que es
        felicitar por existir: sale igual acertando nueve de diez que una de
        diez, solo que con otro adjetivo. Y «Sigue practicando» es peor, porque
        es lo mismo con cara de consuelo. Lo que de verdad dice cómo ha ido son
        los dos números de abajo, que ya estaban y no mienten.
      */}
      <h1
        className="mt-4 animate-crecer text-balance text-2xl font-extrabold sm:text-3xl"
        style={{ animationDelay: '250ms', animationFillMode: 'backwards' }}
      >
        {fraseDe(protagonista, 'final', codigo)}
      </h1>

      <p className="mt-2 text-[var(--texto-suave)]">
        Acertaste {resumen.score} de {resumen.total}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <Dato valor={porcentaje} sufijo="%" etiqueta="Aciertos" retraso={200} />
        <Dato valor={resumen.xpEarned} prefijo="+" etiqueta="XP" retraso={450} />
      </div>

      {/*
        Los desafíos, aquí mismo y ya movidos. Este es EL momento en que una
        misión se convierte en algo: se acaba de hacer el trabajo y la barra
        está un paso más allá de donde estaba al empezar. Verlo mañana al
        entrar no es lo mismo, porque para entonces ya no se recuerda dónde
        estaba.
      */}
      {resumen.misiones && (
        <div className="mt-8 rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-4 text-left">
          <ListaDeMisiones datos={resumen.misiones} compacto />
        </div>
      )}

      <Boton tamano="grande" onClick={onSalir} className="mt-8">
        VOLVER A MI RUTA
      </Boton>
    </div>
  );
}

/**
 * Una cifra del resumen.
 *
 * Entran una después de otra y suben contando. Es el único momento de la
 * lección en que merece la pena hacer esperar medio segundo: se acaba de
 * terminar algo y el número es el premio.
 */
function Dato({
  valor,
  etiqueta,
  retraso,
  prefijo = '',
  sufijo = '',
}: {
  valor: number;
  etiqueta: string;
  retraso: number;
  prefijo?: string;
  sufijo?: string;
}) {
  const contado = useContador(valor, 1000);

  return (
    <div
      className="animate-crecer rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-4"
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <p
        className="text-2xl font-extrabold tabular-nums text-marca-600 dark:text-marca-400"
        aria-label={`${prefijo}${valor}${sufijo} ${etiqueta}`}
      >
        <span aria-hidden>
          {prefijo}
          {contado}
          {sufijo}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-[var(--texto-suave)]">{etiqueta}</p>
    </div>
  );
}

function Centrado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <p className="text-[var(--texto-suave)]">{children}</p>
    </div>
  );
}
