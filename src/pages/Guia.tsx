import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Explicacion } from '@/components/Explicacion';
import { MascotaConMensaje } from '@/components/Mascota';

interface Regla {
  code: string;
  kind: string;
  titleEs: string;
  explanationMd: string | null;
}

const NOMBRE_TIPO: Record<string, string> = {
  grammar: 'Gramática',
  vocab: 'Vocabulario',
  function: 'Para qué sirve',
  pronunciation: 'Pronunciación',
};

const COLOR_TIPO: Record<string, string> = {
  grammar: 'bg-marca-100 text-marca-800 dark:bg-marca-900/50 dark:text-marca-200',
  vocab: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
  function: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100',
  pronunciation: 'bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100',
};

/**
 * La guía de una unidad: sus reglas, explicadas y juntas.
 *
 * Existe porque la corrección de un ejercicio explica ese fallo concreto y nada
 * más. Quien quiere entender la regla entera, antes de empezar o después de
 * tropezar tres veces con lo mismo, no tenía dónde mirar. Las explicaciones ya
 * estaban escritas en el contenido; lo único que faltaba era enseñarlas.
 */
export function Guia() {
  const navegar = useNavigate();
  const { code } = useParams<{ code: string }>();

  const { data, isPending, isError } = useQuery({
    queryKey: ['guia', code],
    queryFn: () =>
      api.get<{ unitCode: string; skills: Regla[] }>(`/curriculum/units/${code!}/guide`),
    enabled: Boolean(code),
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--texto-suave)]">{code?.replace('-', ' · ') ?? 'Guía'}</p>
          <h1 className="text-xl font-bold">Las reglas de esta unidad</h1>
        </div>
        <button
          type="button"
          onClick={() => navegar(-1)}
          className="-mr-2 shrink-0 rounded-xl px-3 py-2.5 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      {isPending && (
        <p className="mt-10 text-center text-[var(--texto-suave)]">Cargando la guía…</p>
      )}

      {isError && (
        <div className="mt-8">
          <MascotaConMensaje
            estado="pensando"
            mensaje="Esta unidad todavía no tiene guía. Puedes empezar las lecciones igual."
          />
        </div>
      )}

      <div className="mt-6 grid gap-4">
        {data?.skills.map((regla, indice) => (
          <section
            key={regla.code}
            className="animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5"
            style={{ animationDelay: `${indice * 70}ms`, animationFillMode: 'backwards' }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-bold leading-tight">{regla.titleEs}</h2>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  COLOR_TIPO[regla.kind] ?? 'bg-[var(--fondo)] text-[var(--texto-suave)]',
                )}
              >
                {NOMBRE_TIPO[regla.kind] ?? regla.kind}
              </span>
            </div>

            {regla.explanationMd && (
              <div className="mt-3 text-[var(--texto-suave)]">
                <Explicacion texto={regla.explanationMd} />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
