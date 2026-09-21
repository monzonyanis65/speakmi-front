import { type AnclajesEspecie, type Atuendo } from './tipos';

/**
 * La ropa, dibujada una sola vez para los cinco animales.
 *
 * La alternativa era veinte dibujos (cuatro atuendos por cinco especies) y
 * veinte sitios donde se puede torcer un gorro. Aquí cada prenda se calcula a
 * partir de los cuatro anclajes que declara la especie, así que un animal nuevo
 * hereda el vestuario entero con solo decir dónde tiene la coronilla.
 *
 * Todo se dibuja en coordenadas del lienzo de 120x120 y sin ninguna clase
 * `animate-`: el movimiento lo pone la capa de la que cuelga esta, que es la de
 * la cabeza. Colgado ahí, el gorro se ladea con ella sin escribir una línea.
 */
export function CapaAtuendo({
  atuendo,
  anclajes,
}: {
  atuendo: Atuendo;
  anclajes: AnclajesEspecie;
}) {
  const { coronilla, anchoCabeza: ancho, ojos, cuello } = anclajes;

  if (atuendo === 'OUTFIT_GORRO') {
    // El borde va catorce píxeles por debajo de la coronilla: lo justo para que
    // la gorra se apoye en el cráneo y no para flotando encima. Un par de
    // píxeles más abajo y la cinta cruzaba los ojos, que con la gorra puesta
    // dejaban a los cinco animales con cara de sueño incluso al sorprenderse.
    const borde = coronilla + 14;
    // La copa es más ancha que alta, y eso no es estética: con una media
    // circunferencia, la gorra se tragaba las orejas del gato y del zorro y los
    // cinco animales pasaban a ser la misma cara redonda con sombrero.
    const alto = ancho * 0.72;
    return (
      <g aria-hidden="true">
        <path
          d={`M${60 - ancho} ${borde} A ${ancho} ${alto} 0 0 1 ${60 + ancho} ${borde} Z`}
          className="fill-acento-500"
        />
        {/*
          La visera sale hacia el lado y no hacia delante: de frente taparía los
          ojos, que es lo único del dibujo que no se puede tapar.
        */}
        <path
          d={`M${60 - ancho} ${borde} Q ${60 - ancho - 20} ${borde - 1} ${60 - ancho - 22} ${borde + 6} Q ${60 - ancho - 10} ${borde + 8} ${60 - ancho} ${borde + 5} Z`}
          className="fill-acento-600"
        />
        <rect
          x={60 - ancho}
          y={borde - 4}
          width={ancho * 2}
          height="6"
          rx="3"
          className="fill-acento-600"
        />
        <circle cx="60" cy={borde - alto + 2} r="2.5" className="fill-acento-300" />
      </g>
    );
  }

  if (atuendo === 'OUTFIT_CORONA') {
    // Ocho píxeles por debajo de la coronilla: lo justo para que la corona
    // abrace la cabeza y las orejas de punta asomen por encima de las puntas.
    const base = coronilla + 8;
    return (
      <g aria-hidden="true">
        <path
          d={`M${60 - ancho + 4} ${base} L${60 - ancho + 10} ${base - 14} L56 ${base - 6} L60 ${base - 18} L64 ${base - 6} L${60 + ancho - 10} ${base - 14} L${60 + ancho - 4} ${base} Z`}
          className="fill-acento-400"
        />
        <rect
          x={60 - ancho + 2}
          y={base - 2}
          width={ancho * 2 - 4}
          height="7"
          rx="2"
          className="fill-acento-500"
        />
        <circle cx={60 - ancho + 10} cy={base + 1.5} r="2" className="fill-rose-400" />
        <circle cx="60" cy={base + 1.5} r="2.2" className="fill-rose-500" />
        <circle cx={60 + ancho - 10} cy={base + 1.5} r="2" className="fill-rose-400" />
      </g>
    );
  }

  if (atuendo === 'OUTFIT_GAFAS') {
    // Los ojos están en (50,40) y (70,40) en las cinco especies, así que las
    // lentes no dependen del ancho de la cabeza; las patillas sí, que son las
    // que tienen que llegar al borde del cráneo.
    return (
      <g aria-hidden="true">
        <path
          d={`M38.5 ${ojos - 4} L${60 - ancho - 4} ${ojos - 2} M81.5 ${ojos - 4} L${60 + ancho + 4} ${ojos - 2}`}
          fill="none"
          className="stroke-slate-700"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect x="38.5" y={ojos - 8} width="21" height="17" rx="6" className="fill-slate-800" />
        <rect x="60.5" y={ojos - 8} width="21" height="17" rx="6" className="fill-slate-800" />
        <rect x="58" y={ojos - 4} width="4" height="3.5" rx="1.5" className="fill-slate-700" />
        {/* El destello es lo que convierte dos manchas negras en cristal. */}
        <path
          d={`M42 ${ojos + 3} L49 ${ojos - 5}`}
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.35"
        />
        <path
          d={`M64 ${ojos + 3} L71 ${ojos - 5}`}
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.35"
        />
      </g>
    );
  }

  // Bufanda. Va en el cuello, que es justo el punto sobre el que gira la cabeza:
  // la vuelta se queda quieta y solo la caída acompaña al ladeo, que es como se
  // mueve una bufanda de verdad.
  return (
    <g aria-hidden="true">
      <path
        d={`M72 ${cuello + 4} Q80 ${cuello + 18} 74 ${cuello + 28} L66 ${cuello + 26} Q72 ${cuello + 14} 68 ${cuello + 6} Z`}
        className="fill-rose-600"
      />
      <path
        d={`M66 ${cuello + 26} L64 ${cuello + 32} M70 ${cuello + 27} L69 ${cuello + 33} M74 ${cuello + 28} L74 ${cuello + 34}`}
        fill="none"
        className="stroke-rose-600"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={`M36 ${cuello - 4} Q60 ${cuello + 8} 84 ${cuello - 4} L82 ${cuello + 4} Q60 ${cuello + 16} 38 ${cuello + 4} Z`}
        className="fill-rose-500"
      />
      <circle cx="74" cy={cuello + 2} r="6" className="fill-rose-500" />
    </g>
  );
}
