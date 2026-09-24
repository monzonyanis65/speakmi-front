import { useEffect, useState } from 'react';

/**
 * ¿Esta persona pidió menos movimiento?
 *
 * El CSS global ya apaga las animaciones, y para casi todo con eso basta. Un
 * juego con reloj no: aquí la tentación es hacer parpadear los últimos segundos,
 * sacudir la pantalla al fallar y tirar confeti al final. Apagar la animación no
 * arregla eso —deja el elemento quieto en un fotograma cualquiera—, hay que NO
 * pintarlo y decir lo mismo con color y palabras. Por eso hace falta saberlo
 * también desde JavaScript.
 */
export function useMenosMovimiento(): boolean {
  const [menos, setMenos] = useState(() => consultar());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const alCambiar = () => setMenos(consulta.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return menos;
}

function consultar(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
