import { type DefinicionEspecie } from './tipos';

/**
 * Milo, el pájaro de Speakmi.
 *
 * Es un mynah, el ave que mejor imita la voz humana, que es justo lo que hace la
 * app: escucha cómo hablas y te devuelve cómo deberías sonar.
 *
 * Es el original y se conserva píxel a píxel al separarlo del esqueleto: es la
 * mascota que sale en todas las pantallas que ya existen, así que cualquier
 * retoque «de paso» se vería en la aplicación entera.
 */
export const MILO: DefinicionEspecie = {
  etiqueta: 'Milo, el pájaro de Speakmi',
  anclajes: { coronilla: 16, anchoCabeza: 26, ojos: 40, cuello: 66 },

  cola: <path d="M22 78 L4 92 L26 88 Z" className="fill-marca-700" />,
  origenCola: '24px 82px',

  cuerpo: (
    <>
      <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-marca-600" />
      <ellipse cx="62" cy="74" rx="22" ry="24" className="fill-marca-100" />
    </>
  ),

  // El ala de allá es más pequeña y más oscura: sin esa diferencia el pájaro se
  // ve plano, como recortado en papel.
  alaLejana: <ellipse cx="86" cy="68" rx="10" ry="16" className="fill-marca-800" />,
  alaCercana: <ellipse cx="34" cy="68" rx="12" ry="18" className="fill-marca-700" />,

  orejas: <path d="M52 32 Q58 18 66 30 Q60 26 52 32 Z" className="fill-marca-700" />,
  cabeza: <circle cx="60" cy="42" r="26" className="fill-marca-600" />,

  bocaCerrada: <path d="M54 50 L66 50 L60 58 Z" className="fill-acento-500" />,
  bocaAbierta: (
    <>
      <path d="M54 52 L66 52 L60 62 Z" className="fill-acento-500" />
      <path d="M54 52 L66 52 L60 47 Z" className="fill-acento-400" />
    </>
  ),

  patas: (
    <>
      <path
        d="M52 100 L52 108 M46 108 L58 108"
        stroke="#f59e0b"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M68 100 L68 108 M62 108 L74 108"
        stroke="#f59e0b"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  ),
};
