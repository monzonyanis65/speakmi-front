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
    /*
      La corona se apoya en la frente, no en lo alto del cráneo.

      Con la base a ocho píxeles de la coronilla y el ancho entero de la cabeza,
      las puntas subían justo a la franja donde nacen las orejas: en el búho los
      penachos reaparecían en los huecos entre punta y punta —parecían
      atravesarla— y en el zorro una oreja salía por la punta de la derecha. Los
      anclajes estaban bien medidos; lo que faltaba era que la corona contase con
      las orejas. Bajándola tres píxeles y metiéndola diez por cada lado, todas
      las orejas de punta —gato, zorro y penachos del búho— pasan POR FUERA del
      contorno de la corona y se ven enteras por encima, en vez de partidas.
    */
    const base = coronilla + 11;
    const w = ancho - 10;
    // Las puntas laterales, a cinco píxeles de las esquinas de la diadema.
    const punta = w - 5;
    return (
      <g aria-hidden="true">
        <path
          d={`M${60 - w} ${base} L${60 - punta} ${base - 11} L55 ${base - 4} L60 ${base - 16} L65 ${base - 4} L${60 + punta} ${base - 11} L${60 + w} ${base} Z`}
          className="fill-acento-400"
        />
        <rect
          x={60 - w + 2}
          y={base - 2}
          width={w * 2 - 4}
          height="7"
          rx="2"
          className="fill-acento-500"
        />
        <circle cx={60 - punta} cy={base + 1.5} r="2" className="fill-rose-400" />
        <circle cx="60" cy={base + 1.5} r="2.2" className="fill-rose-500" />
        <circle cx={60 + punta} cy={base + 1.5} r="2" className="fill-rose-400" />
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

  /*
    Las tres prendas del festival de otoño.

    Se dibujan aquí, con los mismos cuatro anclajes que las de la tienda, y esa
    es toda la razón de que el coleccionable premie ATUENDOS y no otra cosa: ya
    existía un sistema de vestir que calcula la ropa a partir de dónde tiene
    cada animal la coronilla, los ojos y el cuello, así que un disfraz nuevo son
    veinte líneas y sale bien en los cinco animales. Inventar un segundo sistema
    de disfraces para el evento habría sido escribir veinte dibujos y veinte
    sitios donde algo se puede torcer.

    Cada una cuelga de un anclaje distinto —cabeza, ojos y cuello— y eso tampoco
    es casual: así las tres se distinguen de un vistazo puestas sobre el mismo
    animal, que es lo único que hace que valga la pena juntar las doce piezas.
    Y ninguna usa color nuevo: la paleta de marca y de acento que ya existe da
    de sobra para el otoño.
  */
  if (atuendo === 'OUTFIT_HOJAS') {
    // Una guirnalda apoyada en la frente, como la corona, pero abierta por
    // arriba: cinco hojas nacidas de una rama fina que rodea el cráneo. Las
    // puntas se quedan DENTRO del ancho de la cabeza para que las orejas de
    // punta del gato y del zorro sigan asomando enteras por fuera.
    const base = coronilla + 10;
    const w = ancho - 6;
    const hoja = (x: number, y: number, giro: number, escala: number) => (
      <g transform={`translate(${x} ${y}) rotate(${giro}) scale(${escala})`}>
        <path d="M0 0 Q 6 -7 0 -13 Q -6 -7 0 0 Z" className="fill-acento-500" />
        <path d="M0 -1 L0 -11" className="stroke-acento-600" strokeWidth="1.2" fill="none" />
      </g>
    );

    return (
      <g aria-hidden="true">
        <path
          d={`M${60 - w} ${base} Q 60 ${base - 7} ${60 + w} ${base}`}
          fill="none"
          className="stroke-acento-600"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {hoja(60 - w + 2, base - 1, -38, 0.95)}
        {hoja(60 - w / 2, base - 4, -18, 1.05)}
        {hoja(60, base - 6, 0, 1.15)}
        {hoja(60 + w / 2, base - 4, 18, 1.05)}
        {hoja(60 + w - 2, base - 1, 38, 0.95)}
        {/* Dos bayas, que es lo que separa una guirnalda de un matojo. */}
        <circle cx={60 - w / 4} cy={base - 1} r="2.2" className="fill-rose-500" />
        <circle cx={60 + w / 4} cy={base - 1} r="2.2" className="fill-rose-500" />
      </g>
    );
  }

  if (atuendo === 'OUTFIT_ANTIFAZ') {
    /*
      Va en la línea de los ojos, como las gafas, pero al revés: las gafas TAPAN
      los ojos con cristal opaco y el antifaz los deja ver por dos huecos. Los
      ojos están en (50,40) y (70,40) en las cinco especies, así que los huecos
      son fijos; lo que depende del cráneo es hasta dónde llega por los lados.

      EL COLOR NO ES DECORACIÓN. La primera versión iba en `marca-700`, que es
      exactamente el azul del que está hecho Milo, así que sobre la mascota que
      tiene todo el mundo desde el primer día el antifaz no se veía: se veía a
      Milo con dos manchas blancas en los ojos. Una prenda tiene que contrastar
      con los CINCO animales, y eso deja fuera la paleta de marca (el pájaro),
      el naranja del acento (el zorro) y los grises (el búho). El rosa oscuro es
      el único hueco que queda, y es el mismo que ya usaba la bufanda, que lleva
      desde el principio viéndose bien en los cinco.
    */
    const alto = 18;
    const arriba = ojos - 9;
    return (
      <g aria-hidden="true">
        <path
          d={`M${60 - ancho - 2} ${ojos - 3} Q 60 ${arriba - 4} ${60 + ancho + 2} ${ojos - 3}
              Q ${60 + ancho} ${arriba + alto} 60 ${arriba + alto - 2}
              Q ${60 - ancho} ${arriba + alto} ${60 - ancho - 2} ${ojos - 3} Z`}
          className="fill-rose-700"
        />
        {/* El filo dorado de arriba: lo que lo hace de fiesta y no de ladrón. */}
        <path
          d={`M${60 - ancho - 2} ${ojos - 3} Q 60 ${arriba - 4} ${60 + ancho + 2} ${ojos - 3}`}
          fill="none"
          className="stroke-acento-400"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Los dos huecos. Del color del fondo no: de un tono que deja ver. */}
        <ellipse cx="50" cy={ojos} rx="7.5" ry="5.5" className="fill-[var(--superficie)]" />
        <ellipse cx="70" cy={ojos} rx="7.5" ry="5.5" className="fill-[var(--superficie)]" />
        {/* La pluma de la fiesta, a un lado para no tapar nada. */}
        <path
          d={`M${60 + ancho - 2} ${arriba - 1} Q ${60 + ancho + 10} ${arriba - 16} ${60 + ancho + 2} ${arriba - 22}`}
          fill="none"
          className="stroke-acento-400"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx={60 - ancho + 4} cy={ojos - 5} r="2" className="fill-acento-300" />
      </g>
    );
  }

  if (atuendo === 'OUTFIT_CAPA') {
    /*
      El premio mayor, y por eso es el único que se ve desde lejos.

      DOS VUELOS, NO UN DELANTAL. La primera versión era una sola pieza que iba
      de hombro a hombro, y sobre el zorro se veía lo que era: un rectángulo
      azul tapándole la barriga entera. Una capa tapando el cuerpo no es una
      capa, es un babero, y además se come lo único que da vida al dibujo —la
      barriga que respira y el ala que saluda—. Así que la capa son dos caídas
      que cuelgan POR FUERA del cuerpo, a los lados, más el cuello y el broche.
      Eso es además como se lleva una capa: abierta por delante.

      Y va en rosa oscuro con forro dorado por lo mismo que el antifaz: en la
      paleta de marca se confundía con Milo entero.
    */
    const hombro = cuello - 2;
    const largo = cuello + 38;

    // Una caída: sale del hombro, se abre hacia fuera y termina en punta.
    // `lado` es -1 a la izquierda y +1 a la derecha, que es todo lo que cambia.
    const caida = (lado: number) => {
      const dentro = 60 + lado * (ancho - 4);
      const fuera = 60 + lado * (ancho + 16);
      const pie = 60 + lado * (ancho + 4);
      return `M${dentro} ${hombro}
              Q ${fuera - lado * 2} ${hombro + 20} ${fuera} ${largo - 4}
              L ${pie} ${largo + 2}
              Q ${dentro + lado * 4} ${hombro + 18} ${dentro - lado * 8} ${hombro} Z`;
    };

    return (
      <g aria-hidden="true">
        <path d={caida(-1)} className="fill-rose-700" />
        <path d={caida(1)} className="fill-rose-700" />

        {/* El forro dorado del filo de abajo, que es lo que le da peso. */}
        <path
          d={`M${60 - ancho - 16} ${largo - 4} L${60 - ancho - 4} ${largo + 2}`}
          className="stroke-acento-300"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d={`M${60 + ancho + 16} ${largo - 4} L${60 + ancho + 4} ${largo + 2}`}
          className="stroke-acento-300"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* El cuello alzado, estrecho: cruza los hombros y no sube a la cara. */}
        <path
          d={`M${60 - ancho - 2} ${hombro + 2} Q 60 ${hombro + 10} ${60 + ancho + 2} ${hombro + 2}
              Q 60 ${hombro - 5} ${60 - ancho - 2} ${hombro + 2} Z`}
          className="fill-rose-600"
        />
        <circle cx="60" cy={hombro + 3} r="3.4" className="fill-acento-400" />
        <circle cx="60" cy={hombro + 3} r="1.4" className="fill-acento-300" />
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
