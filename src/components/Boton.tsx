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
/**
 * Los fondos son oscuros a propósito: el texto va en blanco y por debajo de
 * estos tonos no llegaría al contraste mínimo que exige la accesibilidad.
 */
const TONOS: Record<Tono, string> = {
  marca: 'bg-marca-700 border-marca-900 text-white hover:bg-marca-600',
  acento: 'bg-acento-600 border-acento-600 text-white hover:bg-acento-500',
  acierto: 'bg-emerald-800 border-emerald-900 text-white hover:bg-emerald-700',
  fallo: 'bg-red-600 border-red-800 text-white hover:bg-red-500',
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
        // Un botón apagado sigue teniendo que leerse: antes tenía 1.9:1 de
        // contraste y no se distinguía el texto del fondo.
        'disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-300 disabled:text-slate-600',
        'dark:disabled:border-slate-900 dark:disabled:bg-slate-700 dark:disabled:text-slate-300',
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
