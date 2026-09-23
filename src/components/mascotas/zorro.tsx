import { type DefinicionEspecie } from './tipos';

/**
 * Rufo, el zorro.
 *
 * La cola es lo que la define y por eso es la única que pivota más atrás: con
 * el origen del pájaro, una cola de este tamaño barría medio lienzo en cada
 * ciclo. Moviendo el punto de giro al arranque de la cola, el mismo balanceo
 * queda como un peso que acompaña en vez de un abanico.
 */
export const ZORRO: DefinicionEspecie = {
  etiqueta: 'Rufo, el zorro de Speakmi',
  anclajes: { coronilla: 16, anchoCabeza: 26, ojos: 40, cuello: 66 },
  // Las orejas bajan hasta y=28 por los lados, así que la ceja tiene que caber
  // entre las dos: más ancha o más alta y se le monta encima al arranque de la
  // oreja, que es de un naranja parecido y las funde en una sola mancha.
  cejas: { y: 27, ancho: 6.8, arco: 3.4, grosor: 2.7, color: 'stroke-orange-800' },

  cola: (
    <>
      {/*
        La cola arranca en (46,88), bien dentro de la elipse del cuerpo, y el
        cuerpo se pinta encima: así nace de la silueta en vez de quedar pegada
        por fuera, que era lo que la hacía leerse como una coma suelta.
      */}
      <path
        d="M46 88 C 28 96 13 92 11 76 C 10 66 12 58 16 53"
        fill="none"
        className="stroke-orange-600"
        strokeWidth="15"
        strokeLinecap="round"
      />
      {/*
        La punta blanca es el mismo trazo con el mismo grosor, solo que el
        último tramo: no puede sobresalir de la cola ni despegarse de ella.
      */}
      <path
        d="M11.4 63 C 11 58 13 55 16 53"
        fill="none"
        className="stroke-orange-50"
        strokeWidth="15"
        strokeLinecap="round"
      />
    </>
  ),
  origenCola: '28px 86px',

  cuerpo: (
    <>
      <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-orange-500" />
      <ellipse cx="62" cy="74" rx="22" ry="24" className="fill-orange-50" />
    </>
  ),

  alaLejana: <ellipse cx="86" cy="70" rx="9" ry="16" className="fill-orange-700" />,
  alaCercana: <ellipse cx="34" cy="70" rx="11" ry="18" className="fill-orange-600" />,

  orejas: (
    <>
      <path d="M40 28 L32 6 L58 18 Z" className="fill-orange-600" />
      <path d="M42 25 L37 12 L50 19 Z" className="fill-stone-700" />
      <path d="M80 28 L88 6 L62 18 Z" className="fill-orange-600" />
      <path d="M78 25 L83 12 L70 19 Z" className="fill-stone-700" />
    </>
  ),

  cabeza: (
    <>
      <circle cx="60" cy="42" r="26" className="fill-orange-500" />
      {/* El antifaz claro baja en punta: es lo que alarga el morro sin dibujarlo. */}
      <path d="M60 40 Q42 54 47 63 Q60 69 73 63 Q78 54 60 40 Z" className="fill-orange-50" />
    </>
  ),

  hocico: <path d="M56 52 Q60 48 64 52 Q60 58 56 52 Z" className="fill-stone-800" />,

  /*
    Las seis bocas, todas dentro del antifaz claro, que es lo que hace de morro.
    Fuera de él, el trazo oscuro se pierde contra el naranja del cráneo, así que
    ni la sonrisa puede ser tan ancha como la del perro ni la boca abierta puede
    bajar tanto: el antifaz acaba en y=69.
  */
  bocas: {
    cerrada: (
      <path
        d="M60 57 Q55 62 51 58 M60 57 Q65 62 69 58"
        fill="none"
        className="stroke-stone-700"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
    sonrisa: (
      <path
        d="M60 57 Q54 64.5 49 58.5 M60 57 Q66 64.5 71 58.5"
        fill="none"
        className="stroke-stone-700"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
    pena: (
      <path
        d="M52 64 Q60 57.5 68 64"
        fill="none"
        className="stroke-stone-700"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
    ancha: (
      <>
        <ellipse cx="60" cy="61" rx="8.5" ry="3.2" className="fill-stone-800" />
        <ellipse cx="60" cy="62" rx="4" ry="1.5" className="fill-rose-300" />
      </>
    ),
    redonda: <ellipse cx="60" cy="62" rx="4" ry="4.2" className="fill-stone-800" />,
    abierta: (
      <>
        <ellipse cx="60" cy="62" rx="6.5" ry="5" className="fill-stone-800" />
        <ellipse cx="60" cy="64" rx="3" ry="2.2" className="fill-rose-300" />
      </>
    ),
  },
  origenBoca: '60px 57px',

  patas: (
    <>
      <ellipse cx="52" cy="104" rx="8" ry="5" className="fill-stone-800" />
      <ellipse cx="68" cy="104" rx="8" ry="5" className="fill-stone-800" />
    </>
  ),
};
