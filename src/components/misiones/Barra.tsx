import { avance } from './tipos';

/**
 * La barra que se llena, que es la pieza que hace que una misión exista.
 *
 * POR QUÉ TIENE PESO
 *
 * Una barra que salta a su sitio no se mira. La transición va en 700 ms con una
 * curva que arranca deprisa y se posa —la misma idea que el contador de XP— y
 * eso es lo que hace que al terminar una lección se VEA moverse. Sin ese medio
 * segundo, la misión avanza en el instante en que la pantalla se repinta y
 * nadie se entera de que ha pasado algo.
 *
 * POR QUÉ EL NÚMERO VA SIEMPRE AL LADO
 *
 * Porque la barra es la sensación y el número es el dato. «Casi llena» no vale
 * para decidir si merece la pena una lección más; «2/3» sí. Y porque la barra
 * sola no se puede leer con un lector de pantalla ni distinguir por alguien que
 * no separa el verde del gris.
 *
 * QUÉ PASA CON `prefers-reduced-motion`
 *
 * El bloque global de `index.css` deja la transición en 0,01 ms, así que la
 * barra aparece llena en su sitio. No se pierde nada: el número, el texto y el
 * color siguen ahí. Lo que se pierde es el adorno, que es justo lo que se pidió
 * quitar.
 */
export function Barra({
  hecho,
  objetivo,
  cumplida,
  etiqueta,
}: {
  hecho: number;
  objetivo: number;
  cumplida: boolean;
  /** Qué mide esta barra, para quien la oye en vez de verla. */
  etiqueta: string;
}) {
  const porcentaje = avance(hecho, objetivo) * 100;

  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={objetivo}
        aria-valuenow={hecho}
        aria-valuetext={`${hecho} de ${objetivo}`}
        className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--hueco)]"
      >
        <div
          className={
            cumplida
              ? 'h-full rounded-full bg-[var(--color-acierto)] transition-[width] duration-700 ease-out'
              : 'h-full rounded-full bg-marca-500 transition-[width] duration-700 ease-out'
          }
          style={{ width: `${porcentaje}%` }}
        >
          {/*
            El brillo de arriba. Es lo que separa una barra de un rectángulo de
            color: da volumen sin costar un solo píxel de imagen. Va dentro del
            relleno para que se recorte con él.
          */}
          <span
            aria-hidden
            className="block h-1/2 rounded-full bg-white/25"
            style={{ margin: '2px 4px 0' }}
          />
        </div>
      </div>

      <span
        aria-hidden
        className={
          cumplida
            ? 'shrink-0 text-sm font-bold tabular-nums text-[var(--texto-acierto)]'
            : 'shrink-0 text-sm font-bold tabular-nums text-[var(--texto-suave)]'
        }
      >
        {hecho}/{objetivo}
      </span>
    </div>
  );
}
