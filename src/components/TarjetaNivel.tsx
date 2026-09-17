import { cn } from '@/lib/cn';
import type { Nivel } from '@/data/niveles';

interface Props {
  nivel: Nivel;
  seleccionado: boolean;
  onSeleccionar: (codigo: string) => void;
}

export function TarjetaNivel({ nivel, seleccionado, onSeleccionar }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSeleccionar(nivel.codigo)}
      aria-pressed={seleccionado}
      className={cn(
        'group w-full rounded-2xl border p-4 text-left transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        seleccionado
          ? 'border-marca-600 bg-marca-50 shadow-sm ring-2 ring-marca-600/30 dark:border-marca-400 dark:bg-marca-600/20'
          : 'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold transition',
            seleccionado
              ? 'bg-marca-600 text-white'
              : 'bg-[var(--fondo)] text-[var(--texto-suave)] group-hover:bg-marca-100 group-hover:text-marca-700',
          )}
        >
          {nivel.numero}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{nivel.titulo}</h3>
            <span className="shrink-0 rounded-full bg-[var(--fondo)] px-2 py-0.5 text-xs font-medium text-[var(--texto-suave)]">
              {nivel.cefr}
            </span>
          </div>

          <p className="mt-1 text-sm text-[var(--texto-suave)]">{nivel.descripcion}</p>

          <p className="mt-2 font-[var(--font-lectura)] text-sm italic text-marca-600 dark:text-marca-400">
            “{nivel.ejemplo}”
          </p>
        </div>
      </div>
    </button>
  );
}
