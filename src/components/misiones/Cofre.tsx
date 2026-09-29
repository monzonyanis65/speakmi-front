/**
 * El cofre del desafío del mes.
 *
 * Dibujado a mano en SVG, sin imágenes y sin librerías: son doce formas, pesa
 * menos que un icono descargado y se adapta al tema claro y al oscuro solo con
 * cambiar dos colores. Lo importante es que tiene DOS estados y se distinguen
 * de lejos: cerrado con candado mientras falta, abierto con luz cuando ya está.
 *
 * No copia el cofre de nadie: es una caja de madera con refuerzos, que es lo que
 * es un cofre desde antes de que existieran las aplicaciones. Lo que se imita de
 * los buenos es el OFICIO —que la tapa se levante de verdad, que la luz salga
 * de dentro y no esté pintada encima— y eso no es de nadie.
 *
 * La tapa abierta está girada sobre su bisagra, no desplazada: girar sobre el
 * borde de atrás es lo que hace que parezca una tapa y no un trozo suelto.
 */
export function Cofre({ abierto, tamano = 56 }: { abierto: boolean; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 64 64"
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id="cofre-madera" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="cofre-tapa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <radialGradient id="cofre-luz" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/*
        La luz va DEBAJO de la tapa y encima del cuerpo, así que al abrirse
        parece que sale de dentro. Pintada encima de todo sería una mancha.
      */}
      {abierto && <circle cx="32" cy="30" r="24" fill="url(#cofre-luz)" />}

      {/* Cuerpo */}
      <rect x="10" y="30" width="44" height="24" rx="3" fill="url(#cofre-madera)" />
      <rect
        x="10"
        y="30"
        width="44"
        height="24"
        rx="3"
        fill="none"
        stroke="#451a03"
        strokeWidth="2"
      />
      {/* Refuerzos verticales */}
      <rect x="18" y="30" width="3" height="24" fill="#451a03" opacity="0.45" />
      <rect x="43" y="30" width="3" height="24" fill="#451a03" opacity="0.45" />

      {/* La tapa, girada sobre su bisagra de atrás cuando se abre */}
      <g
        style={{
          transformOrigin: '32px 30px',
          transform: abierto ? 'rotate(-38deg)' : 'none',
          transition: 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <path
          d="M10 30 A22 16 0 0 1 54 30 Z"
          fill="url(#cofre-tapa)"
          stroke="#451a03"
          strokeWidth="2"
        />
        <rect x="18" y="16" width="3" height="14" fill="#451a03" opacity="0.4" />
        <rect x="43" y="16" width="3" height="14" fill="#451a03" opacity="0.4" />
      </g>

      {/* La cerradura. Con candado mientras falta; sin él cuando ya está. */}
      <rect x="28" y="30" width="8" height="10" rx="1.5" fill="#fbbf24" stroke="#78350f" />
      {!abierto && <circle cx="32" cy="35" r="1.8" fill="#78350f" />}

      {/* Lo que sale al abrirlo: tres chispas, ninguna encima del texto. */}
      {abierto && (
        <g fill="#fbbf24">
          <circle cx="18" cy="16" r="2.5" />
          <circle cx="46" cy="12" r="2" />
          <circle cx="32" cy="6" r="3" />
        </g>
      )}
    </svg>
  );
}
