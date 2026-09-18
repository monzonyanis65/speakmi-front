import { cn } from '@/lib/cn';

export type EstadoMascota =
  'neutral' | 'feliz' | 'celebrando' | 'pensando' | 'animando' | 'escuchando';

interface Props {
  estado?: EstadoMascota;
  tamano?: number;
  className?: string;
}

/**
 * Milo, el pájaro de Speakmi.
 *
 * Es un mynah, el ave que mejor imita la voz humana, que es justo lo que hace
 * la app: escucha cómo hablas y te devuelve cómo deberías sonar.
 *
 * Está dibujado con formas simples a propósito. Cada parte se anima por separado
 * según el estado, así que un solo personaje sirve para celebrar, escuchar o
 * pensar sin necesitar seis ilustraciones distintas.
 */
export function Mascota({ estado = 'neutral', tamano = 120, className }: Props) {
  const ojoAbierto = estado !== 'pensando';
  const alaArriba = estado === 'celebrando' || estado === 'animando';

  /**
   * Cómo se mueven las alas según lo que esté haciendo.
   *
   * Tres ritmos distintos: aleteo corto al celebrar, saludo amplio y lento al
   * animar, y un vaivén de tres grados el resto del tiempo, que acompaña a la
   * respiración. Cuando escucha se queda quieto a propósito: está atento.
   */
  const movimientoAla =
    estado === 'celebrando'
      ? 'animate-aletear'
      : estado === 'animando'
        ? 'animate-saludar'
        : estado === 'escuchando' || estado === 'pensando'
          ? ''
          : 'animate-ala-calma';

  return (
    <svg
      viewBox="0 0 120 120"
      width={tamano}
      height={tamano}
      role="img"
      aria-label="Milo, el pájaro de Speakmi"
      className={cn(
        'select-none',
        estado === 'celebrando' && 'animate-saltito',
        estado === 'escuchando' && 'animate-latido',
        estado === 'animando' && 'animate-balanceo',
        // Quieto respira. Sin esto parece una pegatina, no un personaje.
        (estado === 'neutral' || estado === 'feliz') && 'animate-respirar',
        className,
      )}
    >
      {/* Ondas de sonido: solo cuando está escuchando */}
      {estado === 'escuchando' && (
        <g className="text-marca-400">
          <circle
            cx="60"
            cy="62"
            r="48"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.35"
            className="animate-onda"
          />
          <circle
            cx="60"
            cy="62"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.2"
            className="animate-onda"
            style={{ animationDelay: '0.6s' }}
          />
        </g>
      )}

      {/* Cola. Se balancea sola: antes era lo único del dibujo que no se movía. */}
      <path
        d="M22 78 L4 92 L26 88 Z"
        className={cn('fill-marca-700', estado !== 'pensando' && 'animate-colear')}
        style={{ transformOrigin: '24px 82px' }}
      />

      {/* Cuerpo */}
      <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-marca-600" />

      {/* Barriga */}
      <ellipse cx="62" cy="74" rx="22" ry="24" className="fill-marca-100" />

      {/*
        Las dos alas. La de la derecha es más pequeña y más oscura: así se lee
        como la que queda del lado de allá, y el pájaro deja de verse plano.
        Van desfasadas y en sentido contrario, porque dos alas perfectamente
        sincronizadas parecen un mecanismo, no un bicho.
      */}
      <g
        className={cn('origin-[82px_66px]', movimientoAla)}
        style={{ animationDelay: '0.08s', animationDirection: 'reverse' }}
      >
        <ellipse cx="86" cy="68" rx="10" ry="16" className="fill-marca-800" />
      </g>

      <g
        className={cn(
          'origin-[38px_66px] transition-transform duration-300',
          movimientoAla,
          // Sin animación (escuchando o pensando) el ala se queda levantada si
          // toca, con la transición de siempre.
          !movimientoAla && alaArriba && '-rotate-45',
        )}
      >
        <ellipse cx="34" cy="68" rx="12" ry="18" className="fill-marca-700" />
      </g>

      {/* Copete */}
      <path d="M52 32 Q58 18 66 30 Q60 26 52 32 Z" className="fill-marca-700" />

      {/* Cabeza */}
      <circle cx="60" cy="42" r="26" className="fill-marca-600" />

      {/* Ojos. Parpadean solos, salvo cuando ya están cerrados de pensar. */}
      <g className={cn(ojoAbierto && 'animate-parpadeo')} style={{ transformOrigin: '60px 40px' }}>
        <circle cx="50" cy="40" r="9" fill="white" />
        <circle cx="70" cy="40" r="9" fill="white" />
        {ojoAbierto ? (
          <>
            <circle cx={estado === 'feliz' ? 51 : 50} cy="41" r="4.5" className="fill-slate-900" />
            <circle cx={estado === 'feliz' ? 71 : 70} cy="41" r="4.5" className="fill-slate-900" />
            <circle cx="52" cy="39" r="1.6" fill="white" />
            <circle cx="72" cy="39" r="1.6" fill="white" />
          </>
        ) : (
          <>
            {/* Ojos cerrados mirando hacia arriba: está pensando */}
            <path
              d="M44 40 Q50 35 56 40"
              stroke="#0f172a"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M64 40 Q70 35 76 40"
              stroke="#0f172a"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </>
        )}
      </g>

      {/* Pico. Abierto cuando celebra o anima: está hablando */}
      {alaArriba ? (
        <g>
          <path d="M54 52 L66 52 L60 62 Z" className="fill-acento-500" />
          <path d="M54 52 L66 52 L60 47 Z" className="fill-acento-400" />
        </g>
      ) : (
        <path d="M54 50 L66 50 L60 58 Z" className="fill-acento-500" />
      )}

      {/* Patas */}
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

      {/* Estrellitas al celebrar */}
      {estado === 'celebrando' && (
        <g className="fill-acento-400">
          <path
            d="M18 26 l2.5 5 5 2.5 -5 2.5 -2.5 5 -2.5 -5 -5 -2.5 5 -2.5 z"
            className="animate-destello"
          />
          <path
            d="M100 40 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 z"
            className="animate-destello"
            style={{ animationDelay: '0.3s' }}
          />
          <path
            d="M96 14 l1.5 3 3 1.5 -3 1.5 -1.5 3 -1.5 -3 -3 -1.5 3 -1.5 z"
            className="animate-destello"
            style={{ animationDelay: '0.6s' }}
          />
        </g>
      )}
    </svg>
  );
}

/** Milo diciendo algo, para las pantallas donde acompaña con un mensaje. */
export function MascotaConMensaje({
  estado = 'neutral',
  mensaje,
  tamano = 90,
}: {
  estado?: EstadoMascota;
  mensaje: string;
  tamano?: number;
}) {
  return (
    <div className="flex items-end gap-3">
      <Mascota estado={estado} tamano={tamano} className="shrink-0" />
      <div className="relative mb-4 flex-1 animate-entrada rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-4 py-3">
        {/* Pico del bocadillo */}
        <span className="absolute -left-2 bottom-4 size-3 rotate-45 border-b-2 border-l-2 border-[var(--borde)] bg-[var(--superficie)]" />
        <p className="text-sm">{mensaje}</p>
      </div>
    </div>
  );
}
