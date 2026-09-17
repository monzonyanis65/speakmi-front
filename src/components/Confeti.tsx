import { useMemo } from 'react';

const COLORES = ['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#818cf8', '#fcd34d'];

/**
 * Confeti para celebrar.
 *
 * Son treinta trozos de papel cayendo, hechos con CSS. Sin librerías ni canvas:
 * pesa nada y en un móvil modesto no se atasca.
 *
 * Se usa con moderación, solo al terminar algo. Si celebras cada acierto, dejas
 * de celebrar nada.
 */
export function Confeti({ cantidad = 30 }: { cantidad?: number }) {
  const trozos = useMemo(
    () =>
      Array.from({ length: cantidad }, (_, i) => ({
        id: i,
        izquierda: Math.random() * 100,
        retraso: Math.random() * 0.6,
        duracion: 2 + Math.random() * 1.5,
        color: COLORES[i % COLORES.length]!,
        ancho: 6 + Math.random() * 6,
        alto: 10 + Math.random() * 8,
        redondo: Math.random() > 0.6,
      })),
    [cantidad],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {trozos.map((trozo) => (
        <span
          key={trozo.id}
          className="absolute top-0"
          style={{
            left: `${trozo.izquierda}%`,
            width: `${trozo.ancho}px`,
            height: `${trozo.alto}px`,
            backgroundColor: trozo.color,
            borderRadius: trozo.redondo ? '50%' : '2px',
            animation: `caer ${trozo.duracion}s ease-in ${trozo.retraso}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
