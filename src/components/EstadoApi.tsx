import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Salud {
  status: 'ok' | 'degraded';
  version: string;
  environment: string;
  checks: { database: { ok: boolean; latencyMs: number } };
}

/**
 * Indicador de conexión con la API.
 *
 * Es una pieza de desarrollo: sirve para ver de un vistazo si el backend responde
 * y si la base de datos está levantada. Se retirará cuando la app tenga contenido real.
 */
export function EstadoApi() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['salud'],
    queryFn: () => api.get<Salud>('/health'),
    retry: 1,
    refetchInterval: 30_000,
  });

  const estado = isPending
    ? { texto: 'Conectando…', color: 'bg-slate-400' }
    : isError
      ? { texto: 'API sin responder', color: 'bg-[var(--color-fallo)]' }
      : data?.checks.database.ok
        ? {
            texto: `API y base de datos al día · v${data.version}`,
            color: 'bg-[var(--color-acierto)]',
          }
        : { texto: 'API en pie, base de datos apagada', color: 'bg-[var(--color-aviso)]' };

  return (
    <div className="flex items-center justify-center gap-2 text-xs text-[var(--texto-suave)]">
      <span className={cn('size-2 rounded-full', estado.color)} aria-hidden />
      <span>{estado.texto}</span>
    </div>
  );
}
