import type { Cuenta } from '@/lib/lecturas';
import { ASPECTO } from '@/components/lecturas/aspecto';
import { cn } from '@/lib/cn';

interface Props {
  cuenta: Cuenta;
}

/**
 * Cuánto te queda por saber de este texto.
 *
 *
 * LO QUE SE CUENTA Y CÓMO SE DICE
 *
 * Lo primero y en negrita es lo que queda por descubrir, no lo que ya sabes. Y
 * eso último es un cambio que hubo que hacer al enterarme de cómo trabaja el
 * servidor: las doscientas palabras funcionales del inglés —the, of, and— llegan
 * marcadas como sabidas de fábrica, y los números como ignorados, sin que nadie
 * las haya tocado. Está bien hecho, porque si no un artículo empezaría con
 * doscientas cincuenta «por aprender» que cualquiera de B1 ya sabe. Pero
 * significa que el contador de sabidas NO es mérito de quien lee, y ponerle
 * «Sabes 108» delante sería regalarle un trofeo por abrir la pantalla.
 *
 * Así que esto no dice «sabes»: dice cuántas quedan y de cuántas. Es el estado
 * DEL TEXTO, no una nota. Y «por descubrir» en vez de «sin saber» porque nadie
 * ha fallado nada todavía: traer un artículo nuevo no puede parecer una deuda,
 * cuando traer artículos nuevos es exactamente lo que hay que querer hacer aquí.
 *
 * La barra lleva los mismos colores que el texto y en el mismo orden en que se
 * avanza —sabida, en marcha, por descubrir—, así que crece por la izquierda a
 * medida que se lee. Ni rojo ni verde: en esta aplicación el rojo es fallar y el
 * verde acertar, y no conocer una palabra de un artículo que acabas de pegar no
 * es ni una cosa ni la otra.
 *
 * La leyenda no es adorno: sin ella, los colores del texto son cuatro decisiones
 * de alguien y hay que adivinarlas. Con ella, el artículo coloreado se lee
 * entero de un vistazo.
 */
export function Progreso({ cuenta }: Props) {
  const ancho = (parte: number) => (cuenta.total === 0 ? 0 : (parte / cuenta.total) * 100);

  return (
    <div>
      {/*
        Una sola línea, y no dos columnas. A 320 px «Sabes 108 de 410 palabras»
        y «301 por descubrir» en los extremos partían las dos en dos renglones, y
        la cabecera fija se comía un cuarto de la pantalla del móvil.
      */}
      <p className="text-sm tabular-nums">
        <span className="font-bold">{cuenta.porDescubrir} por descubrir</span>
        <span className="text-[var(--texto-suave)]"> de {cuenta.total} palabras</span>
      </p>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={cuenta.porcentaje}
        aria-label="Parte del texto que ya no te frena"
        className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-[var(--borde)]"
      >
        <div
          className="bg-marca-600 dark:bg-marca-400"
          style={{ width: `${ancho(cuenta.sabida)}%` }}
        />
        <div
          className="bg-marca-300 dark:bg-marca-700"
          style={{ width: `${ancho(cuenta.aprendiendo)}%` }}
        />
        <div
          className="bg-acento-300 dark:bg-acento-500"
          style={{ width: `${ancho(cuenta.nueva)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Qué significa cada color del texto.
 *
 * Va SUELTA y fuera de la cabecera fija, aunque lo natural sea pegarla debajo de
 * la barra. El motivo es de sitio y se midió: en un móvil de 568 de alto, la
 * cabecera con leyenda ocupaba 150 px y el panel de una palabra otros 295, así
 * que con el panel abierto quedaban 123 px de texto a la vista, dos renglones y
 * medio. La leyenda se lee una vez y ya no hace falta; el texto hace falta todo
 * el rato. Así que la leyenda se queda arriba del artículo y se va con el
 * scroll, y la cabecera baja a 90 px.
 */
export function Leyenda() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {(['nueva', 'aprendiendo', 'sabida'] as const).map((estado) => (
        <li key={estado} className="flex items-center gap-1.5 text-xs text-[var(--texto-suave)]">
          <span aria-hidden className={cn('size-2.5 rounded-full', ASPECTO[estado].punto)} />
          {ASPECTO[estado].nombre}
        </li>
      ))}
    </ul>
  );
}
