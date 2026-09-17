import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { NOMBRE_CATEGORIA } from '@/components/ejercicios/tipos';

interface Progreso {
  xpTotal: number;
  xpHoy: number;
  leccionesCompletadas: number;
  racha: { currentDays: number; longestDays: number };
  repasosPendientes: number;
  dominio: Array<{ skillCode: string; titleEs: string; mastery: number; attempts: number }>;
  debilidades: Array<{
    category: string;
    veces: number;
    ultimoEjemplo: string | null;
    ultimoEsperado: string | null;
  }>;
}

/**
 * Cabecera del panel de inicio.
 *
 * El orden importa: primero lo que toca hacer hoy, luego lo que cuesta, y la
 * racha en pequeño. Es lo contrario de Duolingo a propósito, porque la racha
 * mide asistencia y lo que aquí interesa medir es competencia.
 */
export function PanelInicio() {
  const navegar = useNavigate();

  const { data } = useQuery({
    queryKey: ['progreso'],
    queryFn: () => api.get<Progreso>('/progress'),
    // Siempre fresco al volver a esta pantalla: si acabas de fallar algo en una
    // lección, el aviso de repaso tiene que aparecer al instante, no en 30 segundos.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (!data) return null;

  const debilidad = data.debilidades[0];
  const flojo = data.dominio.find((skill) => skill.attempts >= 2 && skill.mastery < 0.7);

  return (
    <div className="grid gap-3">
      {data.repasosPendientes > 0 && (
        <button
          type="button"
          onClick={() => navegar('/repaso')}
          className="flex items-center gap-4 rounded-2xl bg-acento-500 p-4 text-left text-white transition hover:bg-acento-600"
        >
          <span className="text-2xl" aria-hidden>
            🔄
          </span>
          <span className="flex-1">
            <span className="block font-semibold">
              {data.repasosPendientes === 1
                ? 'Tienes 1 repaso pendiente'
                : `Tienes ${data.repasosPendientes} repasos pendientes`}
            </span>
            <span className="block text-sm text-amber-50">
              Cosas que fallaste y toca volver a ver
            </span>
          </span>
          <span aria-hidden>›</span>
        </button>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Dato
          valor={String(data.racha.currentDays)}
          etiqueta={data.racha.currentDays === 1 ? 'día' : 'días'}
          icono="🔥"
        />
        <Dato valor={String(data.xpTotal)} etiqueta="XP" icono="⭐" />
        <Dato valor={String(data.leccionesCompletadas)} etiqueta="lecciones" icono="📘" />
      </div>

      {(debilidad ?? flojo) && (
        <div className="rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--texto-suave)]">
            En lo que más fallas
          </p>

          {debilidad && (
            <p className="mt-2">
              <span className="font-semibold">
                {NOMBRE_CATEGORIA[debilidad.category] ?? debilidad.category}
              </span>
              <span className="text-[var(--texto-suave)]">
                {' '}
                · {debilidad.veces} {debilidad.veces === 1 ? 'vez' : 'veces'}
              </span>
            </p>
          )}

          {debilidad?.ultimoEjemplo && debilidad.ultimoEsperado && (
            <p className="mt-1 text-sm text-[var(--texto-suave)]">
              Escribiste{' '}
              <span className="text-[var(--color-fallo)]">{debilidad.ultimoEjemplo}</span> donde iba{' '}
              <span className="text-[var(--color-acierto)]">{debilidad.ultimoEsperado}</span>
            </p>
          )}

          {flojo && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--texto-suave)]">{flojo.titleEs}</span>
                <span className="text-[var(--texto-suave)]">
                  {Math.round(flojo.mastery * 100)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--fondo)]">
                <div
                  className={cn(
                    'h-full rounded-full',
                    flojo.mastery < 0.4 ? 'bg-[var(--color-fallo)]' : 'bg-[var(--color-aviso)]',
                  )}
                  style={{ width: `${Math.max(flojo.mastery * 100, 4)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Dato({ valor, etiqueta, icono }: { valor: string; etiqueta: string; icono: string }) {
  return (
    <div className="rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] p-3 text-center">
      <p className="text-lg" aria-hidden>
        {icono}
      </p>
      <p className="mt-0.5 text-xl font-bold">{valor}</p>
      <p className="text-xs text-[var(--texto-suave)]">{etiqueta}</p>
    </div>
  );
}
