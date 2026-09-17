import { cn } from '@/lib/cn';

type Tono = 'marca' | 'acento' | 'acierto' | 'fallo' | 'suave';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tono?: Tono;
  ancho?: boolean;
  tamano?: 'normal' | 'grande';
}

/**
 * Botón con profundidad.
 *
 * El borde inferior grueso lo hace parecer una tecla que se hunde al pulsarla.
 * En móvil esa respuesta física es la diferencia entre una web y algo que se
 * siente como una app.
 */
const TONOS: Record<Tono, string> = {
  marca: 'bg-marca-600 border-marca-800 text-white hover:bg-marca-500',
  acento: 'bg-acento-500 border-acento-600 text-white hover:bg-acento-400',
  acierto: 'bg-emerald-500 border-emerald-700 text-white hover:bg-emerald-400',
  fallo: 'bg-red-500 border-red-700 text-white hover:bg-red-400',
  suave: 'bg-[var(--superficie)] border-[var(--hueco)] text-[var(--texto)] hover:border-marca-400',
};

export function Boton({
  tono = 'marca',
  ancho = true,
  tamano = 'normal',
  className,
  children,
  ...resto
}: Props) {
  return (
    <button
      {...resto}
      className={cn(
        'boton-3d rounded-2xl font-bold tracking-wide transition',
        'disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400',
        'dark:disabled:border-slate-800 dark:disabled:bg-slate-700 dark:disabled:text-slate-500',
        tamano === 'grande' ? 'px-6 py-4 text-base' : 'px-5 py-3 text-sm',
        ancho && 'w-full',
        TONOS[tono],
        className,
      )}
    >
      {children}
    </button>
  );
}
