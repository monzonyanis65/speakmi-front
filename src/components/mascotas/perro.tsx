import { type DefinicionEspecie } from './tipos';

/**
 * Tuco, el perro.
 *
 * Las orejas caídas cuelgan a los lados del cráneo y las dos son distintas de
 * tamaño: con las dos iguales la cara se lee como un icono simétrico, y basta
 * un par de píxeles de diferencia para que parezca dibujada a mano.
 */
export const PERRO: DefinicionEspecie = {
  etiqueta: 'Tuco, el perro de Speakmi',
  anclajes: { coronilla: 16, anchoCabeza: 26, ojos: 40, cuello: 66 },

  // Cola corta y gruesa: el mismo balanceo se lee como un rabo contento.
  cola: (
    <path
      d="M24 80 C 12 76 4 82 6 92"
      fill="none"
      className="stroke-amber-700"
      strokeWidth="7"
      strokeLinecap="round"
    />
  ),
  origenCola: '24px 82px',

  cuerpo: (
    <>
      <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-amber-500" />
      <ellipse cx="62" cy="74" rx="22" ry="24" className="fill-amber-100" />
    </>
  ),

  alaLejana: <ellipse cx="86" cy="70" rx="9" ry="15" className="fill-amber-700" />,
  alaCercana: <ellipse cx="34" cy="70" rx="11" ry="17" className="fill-amber-600" />,

  orejas: (
    <>
      <ellipse cx="34" cy="46" rx="9" ry="19" className="fill-amber-700" />
      <ellipse cx="86" cy="44" rx="8" ry="17" className="fill-amber-700" />
    </>
  ),

  cabeza: (
    <>
      <circle cx="60" cy="42" r="26" className="fill-amber-500" />
      {/* La mancha de un ojo: lo que distingue a un perro de un oso redondo. */}
      <circle cx="70" cy="40" r="13" className="fill-amber-600" />
      <ellipse cx="60" cy="55" rx="15" ry="11" className="fill-amber-100" />
    </>
  ),

  bocaCerrada: (
    <>
      <ellipse cx="60" cy="48" rx="5.5" ry="4" className="fill-slate-900" />
      <path
        d="M60 52 L60 55 M60 55 Q54 61 49 55 M60 55 Q66 61 71 55"
        fill="none"
        className="stroke-slate-800"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  bocaAbierta: (
    <>
      <ellipse cx="60" cy="48" rx="5.5" ry="4" className="fill-slate-900" />
      <path d="M48 56 Q60 72 72 56 Z" className="fill-rose-300" />
      <path d="M55 64 Q60 74 65 64 Z" className="fill-rose-400" />
    </>
  ),

  patas: (
    <>
      <ellipse cx="52" cy="104" rx="8" ry="5" className="fill-amber-600" />
      <ellipse cx="68" cy="104" rx="8" ry="5" className="fill-amber-600" />
    </>
  ),
};
