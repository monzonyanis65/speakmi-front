import { cn } from '@/lib/cn';

/**
 * El coleccionable de temporada: un mosaico que se va montando.
 *
 * LA DECISIÓN DE DISEÑO QUE SOSTIENE TODO ESTO
 *
 * Las doce piezas no son doce cromos distintos: son doce trozos de UN dibujo.
 * Cada casilla enseña su recorte del árbol del festival, así que el premio de
 * conseguir una pieza no es «ya tengo la número 7», es ver aparecer una rama
 * que continúa la de al lado. Eso resuelve dos cosas de golpe:
 *
 *   1. NO HAY PIEZAS REPETIDAS, y por tanto no hay ninguna pieza que se
 *      resista. En el original las piezas salen al azar, se acumulan las
 *      repetidas y entonces se vende la que falta por 400 gemas. Aquí el
 *      mosaico se rellena en orden: la tercera pieza es la tercera casilla,
 *      siempre. No queda ni un hueco por el que se pudiera colar una tienda de
 *      piezas, y esa es la razón de fondo.
 *
 *   2. CABE EN 320 px. Doce cromos ilustrados a mano son doce dibujos que a
 *      74 px de ancho no se distinguen. Doce recortes de un dibujo grande se
 *      leen precisamente PORQUE están juntos: lo que se mira es el árbol, no la
 *      casilla.
 *
 * El dibujo mide 120x160 y se parte en tres columnas por cuatro filas de 40x40.
 * Cada casilla es un `<svg>` con su `viewBox` desplazado al trozo que le toca,
 * que es todo el truco: un solo dibujo, doce ventanas.
 */

/** Cuántas columnas tiene el mosaico. Tres es lo que cabe holgado en 320 px. */
const COLUMNAS_POR_DEFECTO = 3;
const LADO = 40;

/**
 * El árbol del festival.
 *
 * Dibujado con la paleta que ya existe —marca y acento— y sin un solo color
 * nuevo. No se parece a nada de Duolingo a propósito: lo que se copia de ellos
 * es el oficio (una rejilla de piezas con las conseguidas encendidas), no su
 * arte, que es suyo.
 *
 * Está repartido para que las doce casillas tengan algo dentro. Las cuatro
 * esquinas eran el riesgo: una casilla vacía no se lee como «todavía no la
 * tienes», se lee como que la aplicación está rota. Por eso hay hojas sueltas
 * arriba y hojarasca abajo.
 */
function Arbol() {
  return (
    <g>
      {/* Suelo */}
      <path d="M0 146 Q60 138 120 146 L120 160 L0 160 Z" className="fill-marca-100" />

      {/* Tronco y dos raíces */}
      <path d="M53 92 Q50 120 44 148 L76 148 Q70 120 67 92 Z" className="fill-acento-600" />
      <path d="M53 108 Q44 118 40 112" className="stroke-acento-600" strokeWidth="4" fill="none" />
      <path d="M67 104 Q78 116 84 108" className="stroke-acento-600" strokeWidth="4" fill="none" />

      {/* La copa: círculos que se pisan, del más oscuro al más claro */}
      <circle cx="60" cy="52" r="42" className="fill-acento-600" />
      <circle cx="34" cy="58" r="27" className="fill-acento-500" />
      <circle cx="86" cy="58" r="27" className="fill-acento-500" />
      <circle cx="60" cy="40" r="32" className="fill-acento-500" />
      <circle cx="46" cy="30" r="21" className="fill-acento-400" />
      <circle cx="80" cy="34" r="18" className="fill-acento-300" />
      <circle cx="30" cy="46" r="13" className="fill-acento-300" />
      <circle cx="94" cy="50" r="12" className="fill-acento-400" />

      {/* Frutos: lo que da un punto de color que no es naranja */}
      <circle cx="52" cy="46" r="4" className="fill-rose-500" />
      <circle cx="74" cy="56" r="4" className="fill-rose-500" />
      <circle cx="38" cy="66" r="3.5" className="fill-rose-400" />
      <circle cx="90" cy="68" r="3.5" className="fill-rose-400" />

      {/* Hojas sueltas en las esquinas de arriba, para que no queden vacías */}
      <g className="fill-acento-400">
        <path d="M10 14 Q17 8 14 20 Q7 22 10 14 Z" />
        <path d="M108 10 Q115 6 111 17 Q104 18 108 10 Z" />
        <path d="M104 22 Q112 20 107 30 Q100 28 104 22 Z" />
        <path d="M14 30 Q22 28 17 38 Q10 36 14 30 Z" />
      </g>

      {/* Hojarasca en el suelo, por lo mismo: las cuatro esquinas de abajo */}
      <g className="fill-acento-500">
        <path d="M6 140 Q16 134 14 146 Q4 148 6 140 Z" />
        <path d="M24 148 Q34 142 32 153 Q22 155 24 148 Z" />
        <path d="M92 144 Q102 138 100 150 Q90 152 92 144 Z" />
        <path d="M106 152 Q116 147 113 157 Q104 158 106 152 Z" />
      </g>
      <g className="fill-rose-400">
        <path d="M8 154 Q16 150 14 158 Q6 159 8 154 Z" />
        <path d="M60 152 Q70 147 67 157 Q58 158 60 152 Z" />
      </g>
    </g>
  );
}

/**
 * Una casilla del mosaico.
 *
 * La conseguida enseña su recorte del árbol; la que falta enseña el mismo
 * recorte casi apagado, y ahí hay una decisión: podría enseñarse en negro y
 * sería más «misterioso». Se ve en gris clarísimo porque lo que mueve a seguir
 * no es la sorpresa —el dibujo entero está a la vista desde el primer día— sino
 * ver cuánto falta para completarlo. Es la misma razón por la que en la tienda
 * lo que no te alcanza se queda a la vista con el precio en rojo.
 */
function Casilla({
  indice,
  columnas,
  conseguida,
}: {
  indice: number;
  columnas: number;
  conseguida: boolean;
}) {
  const columna = indice % columnas;
  const fila = Math.floor(indice / columnas);

  return (
    <div
      className={cn(
        'relative aspect-square overflow-hidden rounded-lg border-2',
        conseguida
          ? 'border-acento-500 bg-[var(--fondo)]'
          : 'border-dashed border-[var(--hueco)] bg-[var(--fondo)]',
      )}
    >
      <svg
        viewBox={`${columna * LADO} ${fila * LADO} ${LADO} ${LADO}`}
        className={cn('size-full', !conseguida && 'opacity-15 saturate-0')}
        aria-hidden="true"
      >
        <Arbol />
      </svg>

      {/*
        El número de la casilla que falta. Sin él, doce cuadrados grises son un
        error de carga; con él son doce sitios que hay que llenar.
      */}
      {!conseguida && (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center text-xs font-bold text-[var(--texto-suave)]"
        >
          {indice + 1}
        </span>
      )}
    </div>
  );
}

export interface RecompensaTemporada {
  at: number;
  itemCode: string;
  nameEs: string;
  descriptionEs: string;
  coins: number;
  ganada: boolean;
}

export interface Temporada {
  code: string;
  nameEs: string;
  descriptionEs: string;
  emoji: string;
  piezas: number;
  total: number;
  columnas: number;
  terminaEl: string;
  diasQueQuedan: number;
  recompensas: RecompensaTemporada[];
}

/**
 * El evento entero: el mosaico, la barra del premio mayor y los premios.
 *
 * El orden importa. Primero lo que se tiene (el mosaico), después cuánto falta
 * para el premio grande, y al final la lista de los tres premios. Al revés
 * —premios arriba— la pantalla empieza pidiendo y no dando, que es exactamente
 * la sensación que hay que evitar en un evento que no cobra nada.
 */
export function Mosaico({ temporada }: { temporada: Temporada }) {
  const columnas = temporada.columnas > 0 ? temporada.columnas : COLUMNAS_POR_DEFECTO;
  const conseguidas = Math.min(Math.max(temporada.piezas, 0), temporada.total);
  const completo = conseguidas >= temporada.total;
  const porcentaje = temporada.total > 0 ? (conseguidas / temporada.total) * 100 : 0;

  return (
    <section className="mt-6" aria-labelledby="titulo-temporada">
      <h2
        id="titulo-temporada"
        className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]"
      >
        Evento de temporada
      </h2>

      <div className="mt-3 animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden className="text-3xl leading-none">
            {temporada.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold leading-tight">{temporada.nameEs}</h3>
            <p className="mt-0.5 text-sm text-[var(--texto-suave)]">{temporada.descriptionEs}</p>
          </div>
        </div>

        {/*
          El mosaico. Es una imagen y no una lista de doce botones: no hay nada
          que pulsar en una pieza, así que doce casillas enfocables serían doce
          paradas del tabulador que no llevan a ningún sitio. El dibujo entero
          se anuncia de una vez con lo único que hace falta saber.
        */}
        <div
          role="img"
          aria-label={`El árbol del festival: ${conseguidas} de ${temporada.total} piezas colocadas`}
          /*
            El mosaico no crece con la pantalla: se queda en el ancho de un
            móvil y se centra. Es un dibujo de tres por cuatro, y estirado a los
            672 px del contenedor cada casilla pasaba a medir 220 px, con lo que
            las que faltan dejaban de leerse como «un hueco del dibujo» y
            pasaban a ser seis cuadros grises vacíos ocupando media pantalla.
            Un dibujo tiene un tamaño bueno; no es una rejilla de contenido.
          */
          className="mx-auto mt-4 grid max-w-[18rem] gap-1.5"
          style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: temporada.total }, (_, indice) => (
            <Casilla
              key={indice}
              indice={indice}
              columnas={columnas}
              conseguida={indice < conseguidas}
            />
          ))}
        </div>

        {/*
          La barra del premio mayor.

          Lleva su número escrito al lado a propósito: una barra sola obliga a
          estimar a ojo cuánto falta, y quien no distingue bien el relleno del
          fondo no se entera de nada. El texto es lo que informa; la barra es lo
          que se siente.
        */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold">{completo ? '¡Árbol completo!' : 'Premio mayor'}</p>
            <p className="text-sm font-bold tabular-nums">
              {conseguidas} / {temporada.total} piezas
            </p>
          </div>

          <div
            className="mt-1.5 h-3 overflow-hidden rounded-full bg-[var(--hueco)]"
            role="progressbar"
            aria-valuenow={conseguidas}
            aria-valuemin={0}
            aria-valuemax={temporada.total}
            aria-label="Piezas del festival conseguidas"
          >
            <div
              className="h-full rounded-full bg-acento-500 transition-[width] duration-500"
              style={{ width: `${porcentaje}%` }}
            />
          </div>

          <p className="mt-1.5 text-xs text-[var(--texto-suave)]">
            {completo
              ? 'Ya tienes todo lo del festival. Pruébatelo en «Tus cosas».'
              : `Las piezas se ganan abriendo cofres. Quedan ${temporada.diasQueQuedan} ${temporada.diasQueQuedan === 1 ? 'día' : 'días'} de festival.`}
          </p>
        </div>

        {/* Los tres premios, con el que falta y el que ya es tuyo bien separados. */}
        <ul className="mt-4 grid gap-2">
          {temporada.recompensas.map((premio) => (
            <li
              key={premio.itemCode}
              className={cn(
                'flex items-center gap-3 rounded-xl border-2 p-3',
                premio.ganada
                  ? 'border-marca-600 bg-marca-50 dark:bg-marca-600/20'
                  : 'border-[var(--borde)]',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums',
                  premio.ganada
                    ? 'bg-marca-600 text-white'
                    : 'bg-[var(--fondo)] text-[var(--texto-suave)]',
                )}
              >
                {premio.ganada ? '✓' : premio.at}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">{premio.nameEs}</p>
                <p className="text-xs text-[var(--texto-suave)]">
                  {premio.ganada
                    ? 'Ya es tuyo'
                    : `Con ${premio.at} piezas${premio.coins > 0 ? ` y ${premio.coins} monedas` : ''}`}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/*
          Esta frase es el resumen de la única decisión de producto que se tomó
          en contra de lo que pedían las capturas, y por eso está escrita donde
          la gente la lee y no solo en un comentario del código.
        */}
        <p className="mt-3 text-xs text-[var(--texto-suave)]">
          Nada de esto se compra. Las piezas solo se ganan practicando.
        </p>
      </div>
    </section>
  );
}
