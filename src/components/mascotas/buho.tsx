import { type DefinicionEspecie } from './tipos';

/**
 * Ulises, el búho.
 *
 * Es el único que ensancha el cráneo, y por eso es el único que declara unos
 * anclajes distintos: los discos faciales necesitan sitio y una cabeza redonda
 * de radio 26 los apretaría contra los bordes. Ese par de píxeles de más es
 * justo lo que existen los anclajes para absorber.
 */
export const BUHO: DefinicionEspecie = {
  etiqueta: 'Ulises, el búho de Speakmi',
  anclajes: { coronilla: 17, anchoCabeza: 28, ojos: 40, cuello: 66 },

  cola: (
    <>
      <path d="M24 80 L6 96 L30 92 Z" className="fill-teal-800" />
      <path d="M26 84 L12 98 L30 96 Z" className="fill-teal-700" />
    </>
  ),
  origenCola: '26px 82px',

  cuerpo: (
    <>
      <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-teal-600" />
      <ellipse cx="62" cy="74" rx="22" ry="24" className="fill-teal-100" />
      {/* Moteado del pecho: tres marcas bastan para que se lea como plumón. */}
      <ellipse cx="54" cy="70" rx="3" ry="2" className="fill-teal-300" />
      <ellipse cx="66" cy="76" rx="3" ry="2" className="fill-teal-300" />
      <ellipse cx="58" cy="84" rx="3" ry="2" className="fill-teal-300" />
    </>
  ),

  // Alas grandes y pegadas al cuerpo: un búho posado es casi todo ala.
  alaLejana: <ellipse cx="86" cy="66" rx="11" ry="20" className="fill-teal-800" />,
  alaCercana: <ellipse cx="32" cy="71" rx="12.5" ry="23" className="fill-teal-700" />,

  orejas: (
    <>
      <path d="M44 22 L38 4 L56 16 Z" className="fill-teal-700" />
      <path d="M76 22 L82 4 L64 16 Z" className="fill-teal-700" />
    </>
  ),

  cabeza: (
    <>
      <ellipse cx="60" cy="42" rx="28" ry="25" className="fill-teal-600" />
      <circle cx="50" cy="40" r="13" className="fill-teal-100" />
      <circle cx="70" cy="40" r="13" className="fill-teal-100" />
    </>
  ),

  bocaCerrada: <path d="M55 50 L65 50 L60 59 Z" className="fill-acento-500" />,
  bocaAbierta: (
    <>
      <path d="M55 52 L65 52 L60 63 Z" className="fill-acento-500" />
      <path d="M55 52 L65 52 L60 46 Z" className="fill-acento-400" />
    </>
  ),
  origenBoca: '60px 52px',

  patas: (
    <>
      <path
        d="M52 100 L52 108 M46 108 L58 108"
        fill="none"
        className="stroke-acento-600"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M68 100 L68 108 M62 108 L74 108"
        fill="none"
        className="stroke-acento-600"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  ),
};
