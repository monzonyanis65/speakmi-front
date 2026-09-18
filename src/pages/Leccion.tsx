import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Ejercicio } from '@/components/ejercicios/Ejercicio';
import { LeerEnVozAlta } from '@/components/ejercicios/LeerEnVozAlta';
import { HablarLibre } from '@/components/ejercicios/HablarLibre';
import { useContador } from '@/lib/contador';
import { Mascota } from '@/components/Mascota';
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
  const [indice, setIndice] = useState(0);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [correccion, setCorreccion] = useState<Correccion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [vozHecha, setVozHecha] = useState(false);

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
      .catch(() => setSessionId(null));
  }, [code, sessionId]);

  const ejercicios = data?.exercises ?? [];
  const ejercicio = ejercicios[indice];
  const esUltimo = indice + 1 >= ejercicios.length;
  const necesitaVoz = ejercicio ? SIN_TECLADO.has(ejercicio.type) : false;

  async function comprobar() {
    if (!ejercicio || !sessionId || respuesta === null) return;
    setEnviando(true);
    try {
      const resultado = await api.post<Correccion>(`/sessions/${sessionId}/answer`, {
        exerciseCode: ejercicio.code,
        answer: respuesta,
      });
      setCorreccion(resultado);
    } finally {
      setEnviando(false);
    }
  }

  async function siguiente() {
    setCorreccion(null);
    setRespuesta(null);
    setVozHecha(false);

    if (!esUltimo) {
      setIndice(indice + 1);
      return;
    }

    if (sessionId) {
      const final = await api.post<Resumen>(`/sessions/${sessionId}/finish`);
      setResumen(final);
    }
  }

  if (isPending) return <Centrado>Cargando la lección…</Centrado>;
  if (isError || !data) return <Centrado>No pudimos cargar la lección.</Centrado>;

  if (resumen) return <PantallaResumen resumen={resumen} onSalir={() => navegar('/ruta')} />;

  if (!ejercicio) return <Centrado>Esta lección no tiene ejercicios todavía.</Centrado>;

  const progreso = (indice / ejercicios.length) * 100;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-4 sm:px-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navegar('/ruta')}
          aria-label="Salir de la lección"
          className="-ml-2 rounded-xl px-3 py-2 text-xl text-[var(--texto-suave)] transition hover:text-[var(--texto)]"
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
          {indice + 1}/{ejercicios.length}
        </span>
      </header>

      {/*
        La `key` es lo que hace que el ejercicio entre animado.
        Sin ella React reutiliza el mismo nodo al cambiar de pregunta, la
        animación no vuelve a arrancar y el siguiente ejercicio aparece de golpe,
        como si la pantalla hubiera parpadeado. Con ella se monta uno nuevo cada
        vez y se ve de dónde viene.
      */}
      <main key={ejercicio.code} className="mt-10 flex-1 animate-entrada">
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
        <HojaCorreccion correccion={correccion} yaSeVeArriba={seMarcaEnElEjercicio(ejercicio)} />
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
function seMarcaEnElEjercicio(ejercicio: { type: string; prompt: Record<string, unknown> }): boolean {
  if (ejercicio.type === 'multiple_choice') return true;
  const opciones = ejercicio.prompt.choices;
  return ejercicio.type === 'fill_blank' && Array.isArray(opciones) && opciones.length > 0;
}

function HojaCorreccion({
  correccion,
  yaSeVeArriba,
}: {
  correccion: Correccion;
  yaSeVeArriba: boolean;
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
        <Mascota estado={isCorrect ? 'celebrando' : 'pensando'} tamano={52} className="shrink-0" />
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
              className="-mx-2 rounded-lg px-2 py-2 text-sm font-bold underline underline-offset-4"
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
