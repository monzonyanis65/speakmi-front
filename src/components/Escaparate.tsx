import { useEffect, useState } from 'react';
import { Mascota, type EstadoMascota } from '@/components/Mascota';
import type { Atuendo, Especie } from '@/components/mascotas';
import { NOMBRE_ESPECIE } from '@/lib/mascota-contexto';

/**
 * Los gestos que se van encadenando en el escaparate.
 *
 * Se enseña moviéndose porque es lo único que distingue a este personaje de una
 * pegatina, y es justo lo que se está comprando. Un animal quieto en una ficha
 * de tienda no dice nada de cómo se va a ver luego en la aplicación.
 *
 * El orden no es aleatorio: empieza tranquilo, se anima, celebra y vuelve a la
 * calma. Así se ve el recorrido entero sin que parezca que tiene un tic.
 */
const GUION: Array<{ estado: EstadoMascota; duracion: number }> = [
  { estado: 'neutral', duracion: 2600 },
  { estado: 'feliz', duracion: 1800 },
  { estado: 'animando', duracion: 2200 },
  { estado: 'celebrando', duracion: 2000 },
  { estado: 'orgulloso', duracion: 2200 },
  { estado: 'sorprendido', duracion: 1400 },
];

interface Props {
  especie: Especie;
  atuendo: Atuendo | null;
  /** Qué se está probando, para decirlo en palabras además de enseñarlo. */
  pie?: string;
}

/**
 * El escaparate: el personaje a tamaño grande, en movimiento.
 *
 * No usa ninguna librería de animación. Todo el movimiento ya existía en el
 * componente de la mascota, hecho con CSS; lo único que faltaba era enseñarlo
 * en vez de un emoji. Traer una librería habría significado rehacer los cinco
 * animales como recursos externos para conseguir exactamente lo que ya se ve.
 */
export function Escaparate({ especie, atuendo, pie }: Props) {
  const [paso, setPaso] = useState(0);

  // Al cambiar de animal se vuelve a empezar: si no, un animal nuevo aparecía a
  // mitad de una celebración y no se le veía la cara de reposo.
  useEffect(() => setPaso(0), [especie, atuendo]);

  useEffect(() => {
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (quieto) return;

    const actual = GUION[paso % GUION.length]!;
    const reloj = setTimeout(() => setPaso((n) => n + 1), actual.duracion);
    return () => clearTimeout(reloj);
  }, [paso]);

  const gesto = GUION[paso % GUION.length]!.estado;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--fondo)] px-4 pb-4 pt-6">
      {/*
        Un foco detrás, muy suave. Es lo que separa «una figura sobre un fondo»
        de «una figura en un sitio», y cuesta un degradado.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 size-64 -translate-x-1/2 rounded-full bg-marca-500/10 blur-2xl"
      />

      <div className="relative flex flex-col items-center">
        <Mascota estado={gesto} especie={especie} atuendo={atuendo} tamano={160} />

        {/* La sombra del suelo. Sin ella el animal parece estar cayendo. */}
        <div
          aria-hidden
          className="-mt-3 h-3 w-24 rounded-[50%] bg-black/10 blur-[2px] dark:bg-black/40"
        />

        <p className="mt-3 text-lg font-extrabold">{NOMBRE_ESPECIE[especie]}</p>
        {pie && <p className="mt-0.5 text-center text-xs text-[var(--texto-suave)]">{pie}</p>}
      </div>
    </div>
  );
}
