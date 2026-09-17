import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { salir } from '@/lib/auth';
import { useSesion } from '@/store/sesion';
import { cn } from '@/lib/cn';

interface Leccion {
  code: string;
  titleEs: string;
  type: string;
  estMinutes: number;
  xpReward: number;
  exercisesCount: number;
}

interface Unidad {
  code: string;
  titleEs: string;
  titleEn: string;
  canDoStatements: string[];
  lessons: Leccion[];
}

interface RespuestaNivel {
  level: { code: string; titleEs: string; cefr: string };
  units: Unidad[];
}

const ICONO: Record<string, string> = {
  vocab: '📖',
  grammar: '🧩',
  reading: '📰',
  listening: '🎧',
  speaking: '🎤',
  conversation: '💬',
  review: '🔄',
  checkpoint: '🏁',
};

const NOMBRE_TIPO: Record<string, string> = {
  vocab: 'Vocabulario',
  grammar: 'Gramática',
  reading: 'Lectura',
  listening: 'Escucha',
  speaking: 'Hablar',
  conversation: 'Conversación',
  review: 'Repaso',
  checkpoint: 'Prueba de unidad',
};

/** La pantalla principal: qué hay por delante en tu nivel. */
export function Ruta() {
  const navegar = useNavigate();
  const usuario = useSesion((estado) => estado.usuario);

  const { data: nivelActivo } = useQuery({
    queryKey: ['mi-nivel'],
    queryFn: () => api.get<{ level: { levelCode: string } | null }>('/me/level'),
  });

  const codigoNivel = nivelActivo?.level?.levelCode;

  const { data, isPending, isError } = useQuery({
    queryKey: ['nivel', codigoNivel],
    queryFn: () => api.get<RespuestaNivel>(`/curriculum/levels/${codigoNivel!}`),
    enabled: Boolean(codigoNivel),
  });

  async function cerrarSesion() {
    await salir();
    navegar('/', { replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--texto-suave)]">Hola, {usuario?.displayName}</p>
          <h1 className="truncate text-xl font-bold">
            {data?.level.titleEs ?? 'Tu ruta'}
            {data && (
              <span className="ml-2 rounded-full bg-[var(--superficie)] px-2 py-0.5 text-xs font-medium text-[var(--texto-suave)]">
                {data.level.cefr}
              </span>
            )}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="shrink-0 text-sm text-[var(--texto-suave)] underline-offset-4 hover:underline"
        >
          Salir
        </button>
      </header>

      {isPending && (
        <p className="mt-10 text-center text-[var(--texto-suave)]">Cargando tu ruta…</p>
      )}

      {isError && (
        <p className="mt-10 text-center text-[var(--color-fallo)]">
          No pudimos cargar tu ruta. Inténtalo de nuevo en un momento.
        </p>
      )}

      {data?.units.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--borde)] p-8 text-center">
          <p className="font-medium">Todavía no hay contenido en este nivel.</p>
          <p className="mt-1 text-sm text-[var(--texto-suave)]">
            Estamos preparándolo. Mientras tanto puedes cambiar de nivel.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-8">
        {data?.units.map((unidad) => (
          <section key={unidad.code}>
            <div className="rounded-2xl bg-marca-600 p-5 text-white">
              <p className="text-xs font-medium uppercase tracking-wide text-marca-100">
                {unidad.code.replace('-', ' · ')}
              </p>
              <h2 className="mt-1 text-lg font-bold">{unidad.titleEs}</h2>
              {unidad.canDoStatements.length > 0 && (
                <ul className="mt-3 grid gap-1.5">
                  {unidad.canDoStatements.map((frase) => (
                    <li key={frase} className="flex gap-2 text-sm text-marca-50">
                      <span aria-hidden>✓</span>
                      <span>{frase}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ol className="mt-4 grid gap-3">
              {unidad.lessons.map((leccion, indice) => (
                <li key={leccion.code}>
                  <button
                    type="button"
                    onClick={() => navegar(`/leccion/${leccion.code}`)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] p-4 text-left transition',
                      'hover:border-marca-400',
                    )}
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--fondo)] text-2xl">
                      {ICONO[leccion.type] ?? '📘'}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--texto-suave)]">
                          {indice + 1}. {NOMBRE_TIPO[leccion.type] ?? leccion.type}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate font-semibold">{leccion.titleEs}</span>
                      <span className="mt-1 block text-xs text-[var(--texto-suave)]">
                        {leccion.exercisesCount} ejercicios · {leccion.estMinutes} min ·{' '}
                        {leccion.xpReward} XP
                      </span>
                    </span>

                    <span aria-hidden className="text-[var(--texto-suave)]">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
