import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Ejercicio } from '@/components/ejercicios/Ejercicio';
import { LeerEnVozAlta } from '@/components/ejercicios/LeerEnVozAlta';
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

// Los que se responden con la voz y no con el teclado.
const SIN_TECLADO = new Set(['speak_prompt', 'listen_type']);

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
          className="text-xl text-[var(--texto-suave)] transition hover:text-[var(--texto)]"
        >
          ✕
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--superficie)]">
          <div
            className="h-full rounded-full bg-marca-600 transition-all duration-300"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <span className="text-xs text-[var(--texto-suave)]">
          {indice + 1}/{ejercicios.length}
        </span>
      </header>

      <main className="mt-10 flex-1">
        {ejercicio.type === 'read_aloud' ? (
          <LeerEnVozAlta
            ejercicio={ejercicio as unknown as Parameters<typeof LeerEnVozAlta>[0]['ejercicio']}
            onTerminado={() => setVozHecha(true)}
          />
        ) : (
          <Ejercicio
            ejercicio={ejercicio}
            bloqueado={correccion !== null}
            onCambio={setRespuesta}
          />
        )}
      </main>

      {correccion && <HojaCorreccion correccion={correccion} />}

      <div className="sticky bottom-0 bg-[var(--fondo)] py-4">
        {correccion ? (
          <button
            type="button"
            onClick={() => void siguiente()}
            className="w-full rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700"
          >
            {esUltimo ? 'Terminar' : 'Continuar'}
          </button>
        ) : ejercicio.type === 'read_aloud' ? (
          <button
            type="button"
            onClick={() => void siguiente()}
            className={
              vozHecha
                ? 'w-full rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700'
                : 'w-full rounded-2xl border border-[var(--borde)] px-6 py-4 font-medium transition hover:border-marca-400'
            }
          >
            {vozHecha ? (esUltimo ? 'Terminar' : 'Continuar') : 'Saltar por ahora'}
          </button>
        ) : necesitaVoz ? (
          <button
            type="button"
            onClick={() => void siguiente()}
            className="w-full rounded-2xl border border-[var(--borde)] px-6 py-4 font-medium transition hover:border-marca-400"
          >
            Saltar por ahora
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void comprobar()}
            disabled={respuesta === null || enviando || !sessionId}
            className="w-full rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700"
          >
            {enviando ? 'Revisando…' : 'Comprobar'}
          </button>
        )}
      </div>
    </div>
  );
}

/** El panel que sube al responder: lo más importante de toda la pantalla. */
function HojaCorreccion({ correccion }: { correccion: Correccion }) {
  const { isCorrect, feedback } = correccion;
  const [verPorque, setVerPorque] = useState(false);

  return (
    <div
      role="status"
      className={cn(
        'mt-6 rounded-2xl p-5',
        isCorrect
          ? 'bg-emerald-50 dark:bg-emerald-950/30'
          : correccion.score > 0
            ? 'bg-amber-50 dark:bg-amber-950/30'
            : 'bg-red-50 dark:bg-red-950/30',
      )}
    >
      <p
        className={cn(
          'font-semibold',
          isCorrect
            ? 'text-emerald-700 dark:text-emerald-300'
            : correccion.score > 0
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-red-700 dark:text-red-300',
        )}
      >
        {isCorrect ? '✓' : '✕'} {feedback.message_es}
      </p>

      {feedback.correcta && (
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
              {error.explicacion_es ??
                (error.expected ? `Debía ser «${error.expected}».` : 'Revísalo.')}
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
              className="text-sm underline underline-offset-4"
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
      <p className="text-5xl" aria-hidden>
        {porcentaje >= 80 ? '🎉' : porcentaje >= 50 ? '💪' : '📚'}
      </p>

      <h1 className="mt-4 text-2xl font-bold">
        {porcentaje >= 80 ? '¡Muy bien!' : porcentaje >= 50 ? 'Vas bien' : 'Sigue practicando'}
      </h1>

      <p className="mt-2 text-[var(--texto-suave)]">
        Acertaste {resumen.score} de {resumen.total}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <Dato valor={`${porcentaje}%`} etiqueta="Aciertos" />
        <Dato valor={`+${resumen.xpEarned}`} etiqueta="XP" />
      </div>

      <button
        type="button"
        onClick={onSalir}
        className="mt-8 rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700"
      >
        Volver a mi ruta
      </button>
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="rounded-2xl bg-[var(--superficie)] p-4">
      <p className="text-2xl font-bold text-marca-600 dark:text-marca-400">{valor}</p>
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
