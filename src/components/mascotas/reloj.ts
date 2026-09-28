/**
 * Un solo `requestAnimationFrame` para todos los Milos de la pantalla.
 *
 * Milo no sale una vez: sale en once juegos, en la ruta, en las lecciones, en
 * la llamada y en la tienda, y en la tienda salen VARIOS a la vez —el
 * escaparate, la rejilla de mascotas y la de atuendos, que pinta un Milo por
 * prenda—. Con un bucle por componente, esa pantalla arranca seis o siete
 * `requestAnimationFrame` que el navegador tiene que planificar por separado,
 * cada uno con su cierre y su comprobación de si sigue vivo.
 *
 * El coste de verdad no es el bucle: es que cada uno despierta al navegador por
 * su cuenta. Con uno solo hay una lista y una pasada, y el resto del gasto es
 * el que ya habría: calcular la postura y pintar.
 *
 * Y de propina sale algo que no se puede tener con bucles sueltos: TODOS LOS
 * MILOS COMPARTEN EL MISMO RELOJ. El desfase entre ellos lo pone cada uno con
 * su semilla, así que no van sincronizados, pero tampoco van a la deriva: dos
 * Milos montados con diez segundos de diferencia miden el tiempo desde el mismo
 * origen y su relación no cambia.
 */

type Paso = (t: number, dt: number) => void;

const abonados = new Set<Paso>();
let pedido: number | null = null;
let anterior = 0;
let origen = 0;

/**
 * El tope de salto entre fotogramas.
 *
 * Al volver de una pestaña en segundo plano, el navegador entrega un `dt` de
 * todo lo que estuvo fuera: minutos, a veces. Sin tope, la mirada se teletransporta
 * y cualquier integración que dependa del paso se va a tomar viento en un solo
 * fotograma. 64 ms son cuatro fotogramas de 60 Hz: suficiente para absorber un
 * tirón y poco para que se note.
 */
const SALTO_MAXIMO = 64;

function latido(ahora: number) {
  pedido = null;
  if (abonados.size === 0) return;

  const dt = Math.min(SALTO_MAXIMO, ahora - anterior);
  anterior = ahora;
  const t = ahora - origen;

  /*
    Se recorre una copia a propósito.

    Un Milo puede darse de baja DENTRO de su propio paso —pasa cuando React
    desmonta la pantalla a mitad de fotograma— y modificar el conjunto mientras
    se recorre deja fuera al siguiente de la lista sin avisar. Es un Milo que se
    queda congelado un fotograma de cada tanto, que es justo la clase de fallo
    que nadie consigue reproducir.
  */
  for (const paso of [...abonados]) paso(t, dt);

  if (abonados.size > 0) pedido = requestAnimationFrame(latido);
}

/**
 * Apunta a este Milo al reloj. Devuelve cómo darse de baja.
 *
 * El bucle arranca con el primer abonado y se para solo cuando se va el último:
 * una pantalla sin mascota no debe dejar un `requestAnimationFrame` girando en
 * vacío, que es lo que impide que el navegador baje la frecuencia en un móvil.
 */
export function abonar(paso: Paso): () => void {
  abonados.add(paso);

  if (pedido === null) {
    // El origen se fija con el primero que llega, no al cargar el módulo: entre
    // una cosa y otra pueden pasar segundos, y arrancar el ciclo del salto a
    // mitad de la caída deja al primer Milo aterrizando sin haber saltado.
    const ahora = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (abonados.size === 1) origen = ahora;
    anterior = ahora;
    pedido = requestAnimationFrame(latido);
  }

  return () => {
    abonados.delete(paso);
    if (abonados.size === 0 && pedido !== null) {
      cancelAnimationFrame(pedido);
      pedido = null;
    }
  };
}

/** Cuántos Milos hay ahora mismo colgados del reloj. Lo usan las pruebas. */
export function abonadosActivos(): number {
  return abonados.size;
}
