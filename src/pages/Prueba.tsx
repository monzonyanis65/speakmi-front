import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { guardarNivel } from '@/lib/auth';
import { NIVELES } from '@/data/niveles';
import { cn } from '@/lib/cn';

interface Pregunta {
  id: string;
  question: string;
  options: string[];
}

interface Resultado {
  suggestedLevel: string;
  score: number;
  total: number;
}

/**
 * Prueba de nivel.
 *
 * Una pregunta por pantalla, sin marcha atrás ni temporizador. No se dice si se
 * acertó: no es un examen que se apruebe, es una forma de encontrar el punto de
 * partida. Al final se sugiere un nivel y la persona decide.
 */
export function Prueba() {
  const navegar = useNavigate();
  const [indice, setIndice] = useState(0);
  const [respuestas, setRespuestas] = useState<Array<{ id: string; answer: number }>>([]);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['prueba'],
    queryFn: () => api.get<{ questions: Pregunta[] }>('/placement/questions'),
  });

  const enviar = useMutation({
    mutationFn: (answers: Array<{ id: string; answer: number }>) =>
      api.post<Resultado>('/placement/submit', { answers }),
    onSuccess: setResultado,
  });

  const preguntas = data?.questions ?? [];
  const pregunta = preguntas[indice];

  function responder(opcion: number) {
    if (!pregunta) return;

    const acumuladas = [...respuestas, { id: pregunta.id, answer: opcion }];
    setRespuestas(acumuladas);

    if (indice + 1 < preguntas.length) {
      setIndice(indice + 1);
    } else {
      enviar.mutate(acumuladas);
    }
  }

  async function empezarEnNivel(codigo: string) {
    setGuardando(true);
    try {
      await guardarNivel(codigo);
      navegar('/ruta', { replace: true });
    } finally {
      setGuardando(false);
    }
  }

  if (isPending) {
    return <Centrado>Preparando la prueba…</Centrado>;
  }

  if (enviar.isPending) {
    return <Centrado>Calculando tu nivel…</Centrado>;
  }

  if (resultado) {
    const nivel = NIVELES.find((n) => n.codigo === resultado.suggestedLevel);

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="text-center">
          <p className="text-sm text-[var(--texto-suave)]">
            Acertaste {resultado.score} de {resultado.total}
          </p>
          <h1 className="mt-2 text-2xl font-bold">Empieza por el nivel {nivel?.numero}</h1>
          {nivel && (
            <p className="mt-3 text-[var(--texto-suave)]">
              {nivel.titulo}. {nivel.descripcion}
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-3">
          <button
            type="button"
            disabled={guardando}
            onClick={() => void empezarEnNivel(resultado.suggestedLevel)}
            className="rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700 disabled:bg-slate-300"
          >
            {guardando ? 'Guardando…' : 'Empezar aquí'}
          </button>

          <button
            type="button"
            onClick={() => navegar('/nivel')}
            className="rounded-2xl border border-[var(--borde)] px-6 py-4 font-medium transition hover:border-marca-400"
          >
            Prefiero elegir otro nivel
          </button>
        </div>
      </div>
    );
  }

  if (!pregunta) {
    return <Centrado>No pudimos cargar la prueba.</Centrado>;
  }

  const progreso = ((indice + 1) / preguntas.length) * 100;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--superficie)]">
          <div
            className="h-full rounded-full bg-marca-600 transition-all"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <span className="text-xs text-[var(--texto-suave)]">
          {indice + 1}/{preguntas.length}
        </span>
      </div>

      <div className="mt-12 flex-1">
        <p className="text-sm text-[var(--texto-suave)]">Completa la frase</p>
        <p className="mt-3 font-[var(--font-lectura)] text-xl leading-relaxed">
          {pregunta.question}
        </p>

        <div className="mt-8 grid gap-3">
          {pregunta.options.map((opcion, posicion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => responder(posicion)}
              className={cn(
                'rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] px-5 py-4 text-left text-base transition',
                'hover:border-marca-500 hover:bg-marca-50 dark:hover:bg-marca-600/20',
              )}
            >
              {opcion}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-[var(--texto-suave)]">
        Si no lo sabes, elige la que te suene mejor. Para eso es la prueba.
      </p>
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
