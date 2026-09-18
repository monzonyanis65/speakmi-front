import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { salir } from '@/lib/auth';
import { useSesion } from '@/store/sesion';
import { cn } from '@/lib/cn';
import { PanelInicio } from '@/components/PanelInicio';
import { NivelVacio } from '@/components/NivelVacio';
import { MascotaConMensaje } from '@/components/Mascota';

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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
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
          className="-mr-2 shrink-0 rounded-xl px-3 py-2.5 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Salir
        </button>
      </header>

      {/*
        En pantalla ancha, el saludo y el panel se van a una columna lateral y la
        ruta ocupa la principal. En móvil siguen uno encima de otro.
      */}
      <div className="mt-5 lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8">
        <div className="lg:order-2 lg:sticky lg:top-6">
          <MascotaConMensaje
            estado="feliz"
            mensaje={`¡Hola de nuevo! ${data?.units[0]?.titleEs ? `Hoy toca ${data.units[0].titleEs.toLowerCase()}.` : 'Vamos a practicar un rato.'}`}
          />
          <div className="mt-5">
            <PanelInicio />
          </div>
        </div>

        <div className="lg:order-1 lg:min-w-0">
          {isPending && (
            <p className="mt-10 text-center text-[var(--texto-suave)]">Cargando tu ruta…</p>
          )}

          {isError && (
            <p className="mt-10 text-center text-[var(--color-fallo)]">
              No pudimos cargar tu ruta. Inténtalo de nuevo en un momento.
            </p>
          )}

          {data?.units.length === 0 && (
            <NivelVacio {...(codigoNivel ? { nivel: codigoNivel } : {})} />
          )}

          <div className="mt-8 grid min-w-0 gap-8 lg:mt-0">
            {data?.units.map((unidad) => (
              <section key={unidad.code} className="min-w-0">
                <div className="animate-entrada rounded-2xl border-b-4 border-marca-800 bg-marca-600 p-5 text-white">
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

                <ol className="mt-4 grid min-w-0 gap-3">
                  {unidad.lessons.map((leccion, indice) => (
                    <li key={leccion.code} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => navegar(`/leccion/${leccion.code}`)}
                        style={{ animationDelay: `${indice * 60}ms` }}
                        className={cn(
                          'boton-3d flex w-full min-w-0 animate-entrada items-center gap-4 rounded-2xl',
                          'border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4 text-left',
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
                          <span className="mt-0.5 block font-bold leading-tight">
                            {leccion.titleEs}
                          </span>
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
      </div>
    </div>
  );
}
