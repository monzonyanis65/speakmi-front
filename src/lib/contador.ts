import { useEffect, useRef, useState } from 'react';

/**
 * Un número que sube contando hasta su valor.
 *
 * Un «+30 XP» que aparece de golpe se lee y se olvida. El mismo número subiendo
 * durante medio segundo se mira, y mirarlo es justo el premio por haber
 * terminado la lección. Es el detalle más barato que más se nota.
 *
 * Frena al final en vez de ir a velocidad constante, que es como se mueven las
 * cosas de verdad: arranca rápido y se posa.
 */
export function useContador(destino: number, duracionMs = 900): number {
  const [valor, setValor] = useState(0);
  const fotograma = useRef<number>(0);

  useEffect(() => {
    // Quien pidió menos movimiento no quiere ver números bailando: se le da el
    // resultado y en paz.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || destino <= 0) {
      setValor(destino);
      return;
    }

    const inicio = performance.now();

    const paso = (ahora: number) => {
      const avance = Math.min(1, (ahora - inicio) / duracionMs);
      // Curva que desacelera: 1 - (1-t)^3.
      const suave = 1 - (1 - avance) ** 3;
      setValor(Math.round(destino * suave));
      if (avance < 1) fotograma.current = requestAnimationFrame(paso);
    };

    fotograma.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(fotograma.current);
  }, [destino, duracionMs]);

  return valor;
}
