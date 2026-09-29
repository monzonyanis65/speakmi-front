import { cn } from '@/lib/cn';
import { useContador } from '@/lib/contador';
import { pinturaDe } from '@/lib/divisiones';

/**
 * El podio de la semana pasada.
 *
 * QUÉ SE COPIA Y QUÉ NO
 *
 * De las apps que llevan años haciendo esto se copia el OFICIO, no el dibujo:
 * tres alturas distintas para que el primero se vea sin leer nada, la fila
 * propia resaltada, y el número subiendo contando en vez de aparecer. Lo que no
 * se copia son sus personajes, sus trofeos ni sus divisiones, que son suyos.
 * Aquí las divisiones llevan nuestros nombres y el adorno es una corona
 * dibujada a mano en cuatro trazos.
 *
 * POR QUÉ EL SEGUNDO VA A LA IZQUIERDA
 *
 * Porque así se lee en cualquier podio: plata, oro, bronce. Puesto en orden
 * 1-2-3 el bloque más alto quedaría en un extremo y la forma dejaría de decir
 * quién ganó; hay que leer los números para enterarse, que es justo lo que un
 * podio ahorra.
 *
 * A 320 PX
 *
 * Tres columnas iguales de algo más de noventa píxeles. El nombre se corta con
 * puntos suspensivos en vez de partirse en dos líneas, porque si una columna
 * crece las tres dejan de estar alineadas por abajo y el podio se deshace.
 */

export interface PuestoDelPodio {
  displayName: string;
  xp: number;
  puesto: number;
  soyYo: boolean;
}

interface Props {
  puestos: PuestoDelPodio[];
  /** El código de la división, que decide el color de los bloques. */
  division: string;
}

/** Las alturas, en el orden en que se pintan: 2.º, 1.º, 3.º. */
const ESCALONES = [
  { puesto: 2, alto: 'h-14' },
  { puesto: 1, alto: 'h-20' },
  { puesto: 3, alto: 'h-10' },
] as const;

export function Podio({ puestos, division }: Props) {
  const pintura = pinturaDe(division);

  return (
    <ol className="mt-4 flex items-end justify-center gap-2">
      {ESCALONES.map(({ puesto, alto }) => {
        const quien = puestos.find((fila) => fila.puesto === puesto);
        if (!quien) return null;

        return (
          <li key={puesto} className="flex min-w-0 flex-1 flex-col items-center">
            {puesto === 1 && <Corona />}

            <p
              className={cn(
                'w-full truncate text-center text-xs font-bold',
                quien.soyYo && 'text-marca-700 dark:text-marca-300',
              )}
            >
              {quien.soyYo ? 'Tú' : quien.displayName}
            </p>

            <p className="text-center text-[0.7rem] text-[var(--texto-suave)] tabular-nums">
              <XpQueSube destino={quien.xp} /> XP
            </p>

            <div
              className={cn(
                'mt-1 grid w-full place-items-center rounded-t-xl text-lg font-extrabold text-white',
                alto,
                pintura.bloque,
                // La fila propia se resalta con un aro, no con otro color: el
                // color ya lo usa la división y dos significados en el mismo
                // sitio no se distinguen.
                quien.soyYo && 'ring-3 ring-marca-600 dark:ring-marca-300',
              )}
            >
              {puesto}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Un número que sube contando.
 *
 * `useContador` ya respeta `prefers-reduced-motion`: con menos movimiento pone
 * el valor final de una vez. Quien pidió menos estímulo recibe LA MISMA
 * información, solo que sin el viaje.
 */
function XpQueSube({ destino }: { destino: number }) {
  return <>{useContador(destino, 700)}</>;
}

/**
 * La corona del primero.
 *
 * Dibujada aquí en un SVG de cuatro trazos, no importada de ningún sitio: es
 * media docena de coordenadas y añadir una librería de iconos por esto sería
 * meter cien kilobytes para ahorrar seis líneas. `aria-hidden` porque el puesto
 * ya va escrito dentro del bloque y una corona anunciada en voz alta no añade
 * nada.
 */
function Corona() {
  return (
    <svg
      viewBox="0 0 24 16"
      aria-hidden
      className="mb-1 h-4 w-6 text-acento-500 dark:text-acento-400"
      fill="currentColor"
    >
      <path d="M2 14h20l-2-11-5 5-3-6-3 6-5-5z" />
    </svg>
  );
}
