import { useEffect, useState } from 'react';

/**
 * ¿Esta persona pidió menos estímulo?
 *
 * El CSS global ya apaga las animaciones, y para casi todo con eso basta. Un
 * juego no: aquí la tentación es hacer parpadear los últimos segundos, sacudir
 * la pantalla al fallar, tirar confeti y encima pitar. Apagar la animación no
 * arregla eso —deja el elemento quieto en un fotograma cualquiera y no silencia
 * nada—, hay que NO pintarlo y NO sonarlo, y decir lo mismo con color y
 * palabras. Por eso hace falta saberlo también desde JavaScript.
 *
 * Vive en `lib/` y no dentro de los juegos porque lo pregunta gente que no es un
 * juego: el sonido, la mascota, el confeti. Tres copias de la misma media query
 * es la forma más fácil de que un día una de ellas se quede sin actualizar.
 */
export function useMenosMovimiento(): boolean {
  const [menos, setMenos] = useState(quiereMenosMovimiento);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const consulta = window.matchMedia(MEDIA);
    const alCambiar = () => setMenos(consulta.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return menos;
}

/**
 * Lo mismo, pero fuera de React.
 *
 * El sonido se dispara desde un temporizador o desde un manejador suelto, donde
 * no hay ningún componente al que colgarle un hook. Se consulta en el momento de
 * sonar y no una vez al arrancar: quien cambia la preferencia del sistema a
 * media partida espera que se note en el siguiente pitido, no en la siguiente
 * recarga.
 */
export function quiereMenosMovimiento(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MEDIA).matches;
}

const MEDIA = '(prefers-reduced-motion: reduce)';
