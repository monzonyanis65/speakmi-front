import { Fragment } from 'react';
import { trozosParaPintar, type Palabra, type Parrafo } from '@/lib/lecturas';
import { ASPECTO, CLASE_MARCA, CLASE_PALABRA } from '@/components/lecturas/aspecto';
import { cn } from '@/lib/cn';

interface Props {
  parrafos: readonly Parrafo[];
  /** Qué palabra tiene el panel abierto, para señalarla en el texto. */
  seleccion: { parrafo: number; i: number } | null;
  /** Qué párrafo está sonando, o `null`. */
  sonando: number | null;
  onTocar: (palabra: Palabra, parrafo: number, boton: HTMLButtonElement) => void;
}

/**
 * El artículo, con cada palabra tocable.
 *
 *
 * POR QUÉ TANTO AIRE ENTRE RENGLONES
 *
 * Porque cada palabra es un botón, y un botón que se pulsa con el pulgar
 * necesita cuarenta y cuatro píxeles de alto. Una línea de texto normal mide
 * veinte. Así que o el renglón crece, o hay que aceptar que en un móvil de 320
 * se falla una de cada tres palabras y se acaba marcando la de al lado.
 *
 * El interlineado de 2.7 sale de ahí y no de una decisión tipográfica: es
 * exactamente lo que ocupan los botones sin que las cajas de dos renglones
 * seguidos se pisen. Se pisarían sin verse —el relleno es transparente— y el
 * síntoma sería un toque que marca la palabra del renglón de arriba, que es de
 * las cosas más difíciles de entender cuando te pasa. Medido con Playwright: 45
 * píxeles de alto por botón y 0 de solapamiento entre renglones.
 *
 * El precio es scroll: el mismo artículo ocupa casi el doble. Lo doy por bueno
 * porque un texto que no se puede tocar bien no sirve para esto, y porque un
 * texto de estudio con aire se lee mejor de todas formas.
 *
 *
 * LA PUNTUACIÓN NO SE TOCA, Y NO SE REESCRIBE
 *
 * Lo que va entre dos palabras sale de rebanar el propio texto del párrafo por
 * las posiciones que manda el servidor (ver `trozosParaPintar`), así que las
 * comas, las comillas y los guiones salen exactamente como se pegaron. Y no son
 * botones: tocar una coma no enseña nada y en cambio le roba sitio al pulgar que
 * iba a la palabra de al lado.
 */
export function TextoTocable({ parrafos, seleccion, sonando, onTocar }: Props) {
  return (
    <article
      lang="en"
      /*
        `break-words` es la red por si alguien pega un texto con una URL de
        cuarenta caracteres: partirla es feo, pero desbordar la pantalla a lo
        ancho rompe la lectura entera en un móvil.
      */
      className="font-lectura text-[1.0625rem] leading-[2.7] break-words sm:text-lg"
    >
      {parrafos.map((parrafo) => (
        <p
          key={parrafo.indice}
          aria-current={sonando === parrafo.indice ? 'true' : undefined}
          /*
            El párrafo que suena. El relleno y el margen negativo están SIEMPRE,
            suene o no: si aparecieran al empezar a sonar, el texto se movería
            justo cuando hay que seguirlo con la vista. Lo único que cambia es el
            color de fondo.
          */
          className={cn(
            '-mx-2 mt-6 rounded-xl px-2 first:mt-0',
            sonando === parrafo.indice && 'bg-marca-500/10',
          )}
        >
          {parrafo.palabras.length === 0
            ? // Por si el servidor manda el párrafo sin trocear: se lee igual,
              // aunque de momento no se pueda tocar nada.
              parrafo.texto
            : trozosParaPintar(parrafo).map((trozo) =>
                trozo.tipo === 'relleno' ? (
                  <Fragment key={trozo.clave}>{trozo.texto}</Fragment>
                ) : (
                  <Palabrita
                    key={trozo.palabra.i}
                    palabra={trozo.palabra}
                    parrafo={parrafo.indice}
                    seleccionada={
                      seleccion?.parrafo === parrafo.indice && seleccion.i === trozo.palabra.i
                    }
                    onTocar={onTocar}
                  />
                ),
              )}
        </p>
      ))}
    </article>
  );
}

interface PalabritaProps {
  palabra: Palabra;
  parrafo: number;
  seleccionada: boolean;
  onTocar: (palabra: Palabra, parrafo: number, boton: HTMLButtonElement) => void;
}

function Palabrita({ palabra, parrafo, seleccionada, onTocar }: PalabritaProps) {
  if (!palabra.lema) return <span>{palabra.texto}</span>;

  return (
    <button
      type="button"
      lang="en"
      data-estado={palabra.estado}
      data-lema={palabra.lema}
      aria-haspopup="dialog"
      aria-expanded={seleccionada}
      aria-label={`${palabra.texto}, ${ASPECTO[palabra.estado].nombre}`}
      onClick={(evento) => onTocar(palabra, parrafo, evento.currentTarget)}
      className={cn(
        CLASE_PALABRA,
        /*
          El anillo va con `ring` y no con `border` a propósito: `ring` es una
          sombra y no ocupa sitio, así que señalar la palabra tocada no recoloca
          el párrafo. Es la misma regla que hace que los cuatro estados midan
          igual.
        */
        seleccionada && 'ring-2 ring-marca-600 dark:ring-marca-300',
      )}
    >
      {/*
        El color va aquí dentro y no en el botón: así se ciñe a las letras en vez
        de pintar el punto de toque entero. Ver `CLASE_PALABRA`.
      */}
      <span className={cn(CLASE_MARCA, ASPECTO[palabra.estado].clase)}>{palabra.texto}</span>
    </button>
  );
}
