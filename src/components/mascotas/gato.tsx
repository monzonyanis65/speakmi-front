import { type DefinicionEspecie } from './tipos';

/**
 * Nala, la gata.
 *
 * Los cambios que la hacen gata son todos de silueta: orejas en punta, hocico
 * partido en dos y una cola de cuerda en vez de plumas. El cráneo mantiene el
 * mismo círculo que Milo a propósito, para que la ropa le siente igual de bien
 * sin necesitar una talla propia.
 */
export const GATO: DefinicionEspecie = {
  etiqueta: 'Nala, la gata de Speakmi',
  anclajes: { coronilla: 16, anchoCabeza: 26, ojos: 40, cuello: 66 },
  // Finas y un tono más oscuras que el pelaje: una gata no tiene cejas de
  // verdad, así que se leen como pelo marcado y no pueden pesar más que eso.
  cejas: { y: 27, ancho: 7, arco: 3.2, grosor: 2.5, color: 'stroke-slate-700' },

  // La cola de gato es un trazo, no un triángulo: así el balanceo se lee como
  // un latigazo suave y no como una aleta rígida. Arranca dentro del cuerpo y
  // va un tono más oscura que la pata de acá: con las dos del mismo gris se
  // fundían en una sola mancha y la pose en jarras no se distinguía.
  cola: (
    <path
      d="M42 90 C 38 88 32 80 24 82 C 8 86 2 68 14 58"
      fill="none"
      className="stroke-slate-600"
      strokeWidth="7"
      strokeLinecap="round"
    />
  ),
  origenCola: '24px 82px',

  cuerpo: (
    <>
      <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-slate-400" />
      <ellipse cx="62" cy="74" rx="22" ry="24" className="fill-slate-100" />
    </>
  ),

  alaLejana: <ellipse cx="86" cy="70" rx="9" ry="15" className="fill-slate-600" />,
  alaCercana: <ellipse cx="32" cy="73" rx="10.5" ry="19" className="fill-slate-500" />,

  orejas: (
    <>
      <path d="M40 28 L34 8 L56 20 Z" className="fill-slate-500" />
      <path d="M42 25 L38 13 L50 20 Z" className="fill-pink-300" />
      <path d="M80 28 L86 8 L64 20 Z" className="fill-slate-500" />
      <path d="M78 25 L82 13 L70 20 Z" className="fill-pink-300" />
    </>
  ),

  cabeza: (
    <>
      <circle cx="60" cy="42" r="26" className="fill-slate-400" />
      <ellipse cx="54" cy="54" rx="8" ry="6" className="fill-slate-100" />
      <ellipse cx="66" cy="54" rx="8" ry="6" className="fill-slate-100" />
      {/* Los bigotes salen del cráneo porque no se mueven con la boca. */}
      <path
        d="M44 52 L30 49 M44 56 L30 58 M76 52 L90 49 M76 56 L90 58"
        fill="none"
        className="stroke-slate-200"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),

  hocico: <path d="M56 49 L64 49 L60 54 Z" className="fill-pink-400" />,

  /*
    Las seis bocas de un hocico partido.

    Las tres cerradas son trazos: la omega de siempre, la misma más abierta para
    la sonrisa, y para la pena un arco al revés que ya no sale de la nariz sino
    que cruza por debajo. Ese cambio de dibujo importa: una omega girada del
    revés sigue pareciendo una omega, y hasta que la línea no pasa por debajo de
    las comisuras no se lee como boca triste.

    Las tres abiertas son la misma boca rosa en tres tallas y tres proporciones.
  */
  bocas: {
    cerrada: (
      <path
        d="M60 54 L60 56 M60 56 Q55 60 51 55 M60 56 Q65 60 69 55"
        fill="none"
        className="stroke-slate-700"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
    sonrisa: (
      <path
        d="M60 54 L60 57 M60 57 Q54 64 48.5 56 M60 57 Q66 64 71.5 56"
        fill="none"
        className="stroke-slate-700"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
    pena: (
      <path
        d="M60 54 L60 57 M51.5 62 Q60 55.5 68.5 62"
        fill="none"
        className="stroke-slate-700"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
    ancha: (
      <>
        <ellipse cx="60" cy="59" rx="9.5" ry="3.4" className="fill-pink-400" />
        <ellipse cx="60" cy="60" rx="4.5" ry="1.6" className="fill-pink-200" />
      </>
    ),
    redonda: (
      <>
        <ellipse cx="60" cy="60" rx="4.4" ry="4.4" className="fill-pink-400" />
        <ellipse cx="60" cy="61.5" rx="2" ry="1.8" className="fill-pink-200" />
      </>
    ),
    abierta: (
      <>
        <ellipse cx="60" cy="60" rx="7" ry="5" className="fill-pink-400" />
        <ellipse cx="60" cy="62" rx="3.5" ry="2.5" className="fill-pink-200" />
      </>
    ),
  },
  // Justo debajo de la nariz: la boca de un gato cuelga de ahí.
  origenBoca: '60px 55px',

  patas: (
    <>
      <ellipse cx="52" cy="104" rx="8" ry="5" className="fill-slate-500" />
      <ellipse cx="68" cy="104" rx="8" ry="5" className="fill-slate-500" />
    </>
  ),
};
