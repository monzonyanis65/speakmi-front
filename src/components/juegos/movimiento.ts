/**
 * El mismo hook de siempre, que ahora vive en `@/lib/movimiento`.
 *
 * Se mudó porque dejó de ser cosa de los juegos: el sonido lo pregunta desde
 * `lib/` y no puede depender de una carpeta de componentes. Aquí queda el
 * reenvío para no tener que tocar los cuatro juegos de golpe.
 */
export { useMenosMovimiento } from '@/lib/movimiento';
