import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Ejercicio } from '@/components/ejercicios/Ejercicio';
import { LeerEnVozAlta } from '@/components/ejercicios/LeerEnVozAlta';
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
      setResumen(final);
    }
  }

  if (isPending) return <Centrado>Cargando la lección…</Centrado>;
  if (isError || !data) return <Centrado>No pudimos cargar la lección.</Centrado>;

  if (cerrada) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <MascotaConMensaje estado="pensando" mensaje={cerrada} />
        <Boton tamano="grande" onClick={() => navegar('/ruta')} className="mt-8">
          VOLVER A MI RUTA
        </Boton>
      </div>
    );
  }

  if (resumen) return <PantallaResumen resumen={resumen} onSalir={() => navegar('/ruta')} />;

  if (!ejercicio) return <Centrado>Esta lección no tiene ejercicios todavía.</Centrado>;

  // El total incluye las repescas: si no, la barra llegaría al final y después
  // seguirían apareciendo preguntas, que es desconcertante. Y `repescas` solo
  // crece, así que la barra nunca retrocede.
  const total = ejercicios.length + repescas;
  const progreso = Math.min(100, (contestados / total) * 100);

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
      {repitiendo && (
        <p className="mt-6 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[var(--texto-aviso)]">
          <span aria-hidden>↻</span>
          Esta la fallaste antes
        </p>
      )}

      <main
        key={`${ejercicio.code}-${repitiendo ? 'rep' : 'ini'}`}
        className="mt-6 flex-1 animate-entrada"
      >
        {ejercicio.type === 'read_aloud' ? (
          <LeerEnVozAlta
            ejercicio={ejercicio as unknown as Parameters<typeof LeerEnVozAlta>[0]['ejercicio']}
            onTerminado={() => setVozHecha(true)}
          />
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
          dificultad={ejercicio.difficulty}
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
  dificultad,
}: {
  correccion: Correccion;
  yaSeVeArriba: boolean;
  dificultad: number;
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
          Milo reacciona a lo que pasó, no siempre igual. Presume solo cuando
          el ejercicio era difícil: felicitar lo mismo por lo fácil y por lo
          difícil hace que la felicitación no signifique nada. Y al fallar se
          entristece un poco, que es un «uy», no un castigo.
        */}
        <Mascota estado={reaccionA(correccion, dificultad)} tamano={52} className="shrink-0" />
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
/** Cómo se lo toma Milo. */
function reaccionA(correccion: Correccion, dificultad: number): EstadoMascota {
  if (correccion.isCorrect) return dificultad >= 3 ? 'orgulloso' : 'celebrando';
  // Casi acertado, solo erratas: ni celebra ni se hunde.
  if (correccion.score > 0) return 'pensando';
  return 'triste';
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

function PantallaResumen({ resumen, onSalir }: { resumen: Resumen; onSalir: () => void }) {
  const porcentaje = Math.round(resumen.accuracy * 100);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 text-center">
      {porcentaje >= 80 && <Confeti />}

      {/* Milo entra con la animación larga, la única de la aplicación: es el
          premio por haber terminado y merece un segundo entero. */}
      <div className="flex animate-revelar justify-center">
        <Mascota
          estado={porcentaje >= 80 ? 'celebrando' : porcentaje >= 50 ? 'feliz' : 'animando'}
          tamano={150}
        />
      </div>

      <h1
        className="mt-4 animate-crecer text-3xl font-extrabold"
        style={{ animationDelay: '250ms', animationFillMode: 'backwards' }}
      >
        {porcentaje >= 80 ? '¡Muy bien!' : porcentaje >= 50 ? 'Vas bien' : 'Sigue practicando'}
      </h1>

      <p className="mt-2 text-[var(--texto-suave)]">
        Acertaste {resumen.score} de {resumen.total}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <Dato valor={porcentaje} sufijo="%" etiqueta="Aciertos" retraso={200} />
        <Dato valor={resumen.xpEarned} prefijo="+" etiqueta="XP" retraso={450} />
      </div>

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
