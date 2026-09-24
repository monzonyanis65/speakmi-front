import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useMenosMovimiento } from '@/lib/movimiento';

/**
 * La capa que se ve cuando pasa algo.
 *
 * Un juego no se distingue de un formulario por las reglas, se distingue por lo
 * que ocurre entre una respuesta y la siguiente: el destello verde, el «+40» que
 * sube flotando, el temblor del fallo, las monedas cayendo al final. Nada de
 * esto cambia una sola cifra —la puntuación la cierra el servidor—, pero es lo
 * que hace que la respuesta siguiente importe.
 *
 * Todo lo de aquí desaparece con `prefers-reduced-motion`: devuelve `null` y ya.
 * No se queda a medias ni se sustituye por una versión «suave», porque todo lo
 * que dicen estos efectos está dicho también con letras y color en la pantalla
 * que hay debajo. Son adorno, y el adorno se quita entero.
 */

/** El fogonazo de la respuesta, de borde a borde. */
export function Destello({ senal }: { senal: 'acierto' | 'fallo' | 'combo' }) {
  const menosMovimiento = useMenosMovimiento();
  const [vivo, setVivo] = useState(true);

  if (menosMovimiento || !vivo) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40"
      style={{ background: FONDOS[senal] }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: senal === 'combo' ? 0.7 : 0.5, times: [0, 0.12, 1] }}
      onAnimationComplete={() => setVivo(false)}
    />
  );
}

/*
  Los tres fogonazos.

  Van desde abajo y difuminados, no como un rectángulo de color: un flash plano
  a pantalla completa molesta a la vista y tapa el ejercicio justo cuando hay que
  leer la corrección. Así se percibe por el rabillo del ojo y no interrumpe.
*/
const FONDOS: Record<'acierto' | 'fallo' | 'combo', string> = {
  acierto: 'radial-gradient(120% 70% at 50% 100%, rgba(16,185,129,0.45), transparent 70%)',
  fallo: 'radial-gradient(120% 70% at 50% 100%, rgba(239,68,68,0.38), transparent 70%)',
  combo: 'radial-gradient(120% 80% at 50% 100%, rgba(245,158,11,0.5), transparent 72%)',
};

/**
 * Los puntos que acabas de ganar, subiendo y desapareciendo.
 *
 * El número es el de verdad: la diferencia entre lo que valía tu marcador antes
 * y lo que vale ahora, con la misma fórmula que usa el servidor al cerrar la
 * partida. Enseñar aquí un número inventado que luego no cuadra con el final es
 * la forma más rápida de que un juego se lea como una estafa.
 *
 * Quien pidió menos movimiento no lo ve, y no pierde nada: el marcador de al
 * lado ya cambió.
 *
 * Lleva chapa de color y no va como letra suelta: sube justo por encima de la
 * etiqueta del contador, y sin fondo se leían «+65» y «PUNTOS» uno encima del
 * otro.
 */
export function PuntosGanados({ puntos }: { puntos: number }) {
  const menosMovimiento = useMenosMovimiento();
  if (menosMovimiento || puntos <= 0) return null;

  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute right-0 top-full z-10 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-sm font-extrabold tabular-nums text-white shadow-sm"
      initial={{ opacity: 0, y: 0, scale: 0.7 }}
      animate={{ opacity: [0, 1, 1, 0], y: -34, scale: [0.7, 1.15, 1, 1] }}
      transition={{ duration: 0.9, times: [0, 0.15, 0.6, 1], ease: 'easeOut' }}
    >
      +{puntos}
    </motion.span>
  );
}

/**
 * Las monedas del final.
 *
 * Caen las que de verdad has ganado, hasta doce: si ganaste tres monedas y caen
 * veinte, la próxima vez ya no te crees ninguna. Reutilizan la animación `caer`
 * del confeti, que lleva ahí desde el final de las lecciones.
 */
export function LluviaDeMonedas({ cantidad }: { cantidad: number }) {
  const menosMovimiento = useMenosMovimiento();
  const monedas = useMemo(
    () =>
      Array.from({ length: Math.min(Math.max(cantidad, 0), 12) }, (_, i) => ({
        id: i,
        izquierda: 8 + Math.random() * 84,
        retraso: Math.random() * 0.5,
        duracion: 1.4 + Math.random() * 0.8,
        tamano: 18 + Math.random() * 14,
      })),
    [cantidad],
  );

  if (menosMovimiento || monedas.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {monedas.map((moneda) => (
        <span
          key={moneda.id}
          className="absolute top-0"
          style={{
            left: `${moneda.izquierda}%`,
            fontSize: `${moneda.tamano}px`,
            lineHeight: 1,
            animation: `caer ${moneda.duracion}s ease-in ${moneda.retraso}s forwards`,
          }}
        >
          🪙
        </span>
      ))}
    </div>
  );
}

/**
 * Un número que da un salto cada vez que cambia.
 *
 * Sin esto, el marcador cambia de 40 a 50 y nadie lo ve: el ojo estaba en el
 * ejercicio. El salto dura un cuarto de segundo y no mueve nada de alrededor,
 * porque va con `tabular-nums` y ancho fijo.
 */
export function NumeroVivo({ valor, className }: { valor: number | string; className?: string }) {
  const menosMovimiento = useMenosMovimiento();
  const [saltar, setSaltar] = useState(false);

  useEffect(() => {
    if (menosMovimiento) return;
    setSaltar(true);
    const reloj = setTimeout(() => setSaltar(false), 260);
    return () => clearTimeout(reloj);
  }, [valor, menosMovimiento]);

  return (
    <span
      className={cn(
        'inline-block tabular-nums transition-transform duration-200',
        saltar && 'scale-125',
        className,
      )}
    >
      {valor}
    </span>
  );
}
