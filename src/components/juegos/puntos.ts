import type { CodigoJuego } from './tipos';

/**
 * La puntuación, con la fórmula del servidor.
 *
 * Esto es una copia a mano de `puntosDe` en `back/src/modules/games/games.catalogo.ts`,
 * y está copiada a propósito. Quien juega necesita ver los puntos subir MIENTRAS
 * juega —un marcador que solo aparece al final no engancha a nadie—, y lo único
 * peor que no enseñarlos es enseñar unos que no cuadren con los del final. Ya
 * pasó: se veía subir 118 durante la partida y la pantalla final ponía 60. Eso
 * no se lee como un fallo, se lee como una estafa.
 *
 * Así que el navegador calcula exactamente lo mismo que calculará el servidor a
 * partir de sus propios aciertos. La cifra de la pantalla final sigue siendo la
 * del servidor, sin excepción; esta solo tiene que coincidir con ella.
 *
 * Si algún día cambia la fórmula de allí, cambia aquí. Es el precio de poder
 * enseñar un número honesto en vivo.
 *
 *
 * POR QUÉ CADENA VA AL CUADRADO
 *
 * En cadena el primer fallo acaba la partida, así que el décimo acierto es
 * muchísimo más difícil que el primero y tiene que pagar más: el que hace `n`
 * acierto sube el marcador en `10n - 5`, o sea el primero vale 5 y el décimo
 * vale 95. Esa escalera ES el juego.
 */
export function puntosDelServidor(
  code: CodigoJuego,
  aciertos: number,
  /**
   * La racha más larga de la partida.
   *
   * Hace falta porque CONTRARRELOJ y ESCUCHA pagan un bono por encadenar. Sin
   * él, la racha que se enseña creciendo —con el sonido subiendo de tono y las
   * llamas— no valía nada: pagaba lo mismo acertar diez seguidas que diez
   * alternando con fallos.
   */
  rachaMaxima = 0,
): number {
  const buenos = Math.max(aciertos, 0);
  if (code === 'CADENA') return buenos * buenos * 5;

  /*
    PAREJAS lleva además un bono por rapidez que calcula el servidor con su
    propio reloj, y que aquí NO se intenta adivinar: enseñar en vivo un número
    que luego no cuadre con el final es exactamente lo que había que evitar.
    Durante la partida se ve la base; el bono aparece al cerrar, sumando.
  */
  const racha = Math.max(rachaMaxima, 0);
  return buenos * 10 + racha * racha * 2;
}

/** Lo que sumaría el siguiente acierto. Es lo que se enseña flotando al acertar. */
export function loQueSumaElSiguiente(code: CodigoJuego, aciertos: number): number {
  return puntosDelServidor(code, aciertos + 1) - puntosDelServidor(code, aciertos);
}
