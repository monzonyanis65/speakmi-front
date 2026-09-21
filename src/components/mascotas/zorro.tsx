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

  cola: (
    <>
      <path d="M26 84 C 4 84 0 60 16 52 C 14 70 20 78 30 90 Z" className="fill-orange-600" />
      <ellipse cx="13" cy="56" rx="7" ry="6" className="fill-orange-50" />
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

  bocaCerrada: (
    <path
      d="M60 57 Q55 62 51 58 M60 57 Q65 62 69 58"
      fill="none"
      className="stroke-stone-700"
      strokeWidth="2"
      strokeLinecap="round"
    />
  ),
  bocaAbierta: (
    <>
      <ellipse cx="60" cy="62" rx="6.5" ry="5" className="fill-stone-800" />
      <ellipse cx="60" cy="64" rx="3" ry="2.2" className="fill-rose-300" />
    </>
  ),
  origenBoca: '60px 57px',

  patas: (
    <>
      <ellipse cx="52" cy="104" rx="8" ry="5" className="fill-stone-800" />
      <ellipse cx="68" cy="104" rx="8" ry="5" className="fill-stone-800" />
    </>
  ),
};
