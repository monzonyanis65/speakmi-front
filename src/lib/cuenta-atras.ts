/**
 * Cuánto falta, dicho como lo diría una persona.
 *
 * «7 horas» y no «6 h 52 min»: la cifra exacta no sirve para nada —nadie
 * programa su tarde por doce minutos— y encima obliga a refrescar la pantalla
 * cada minuto para que no mienta. Redondeando a la hora, el número aguanta
 * media hora sin quedarse viejo. Por debajo de una hora sí se dicen los
 * minutos, porque ahí la diferencia entre «20 min» y «1 hora» sí cambia lo que
 * uno hace con su tarde.
 *
 * Vive fuera del componente del cofre porque no dibuja nada y porque así se
 * puede probar el formato sin montar una pantalla entera.
 */
export function faltan(minutos: number): string {
  if (minutos <= 0) return 'ahora';
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.round(minutos / 60);
  return horas === 1 ? '1 hora' : `${horas} horas`;
}
