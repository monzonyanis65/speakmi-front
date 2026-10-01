import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { ICONOS, type ClaveIconoDoble } from '@/components/iconos';
import {
  ALTO_BARRA,
  DESTINOS,
  HUECO_BARRA,
  esElDestinoActual,
  hayBarraEn,
} from '@/lib/barra-inferior';

/**
 * El marco de la aplicación: el contenido y, debajo, la barra.
 *
 * El hueco para la barra se reserva AQUÍ, una sola vez, y no en cada pantalla.
 * Con veintitantas pantallas, dejarlo a cada una significa que la mitad se
 * olvida y su último botón queda tapado; y las que lo recuerden quedarán mal el
 * día que la barra cambie de alto. Reservarlo aquí también garantiza lo
 * contrario: donde no hay barra no hay hueco, y no sobra una franja vacía al
 * final de una lección.
 */
export function MarcoConBarra({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const conBarra = hayBarraEn(pathname);

  return (
    <>
      <div style={conBarra ? { paddingBottom: HUECO_BARRA } : undefined}>{children}</div>
      {conBarra && <BarraInferior />}
    </>
  );
}

/**
 * El dibujo de un destino, resuelto por nombre.
 *
 * Existe para que `barra-inferior.ts` pueda seguir siendo una lista de datos
 * sin React dentro. Es la única indirección del archivo y se paga aquí, en una
 * línea, en vez de en el sitio que se lee para entender la navegación.
 */
function Icono({ icono, relleno }: { icono: ClaveIconoDoble; relleno: boolean }) {
  const Dibujo = ICONOS[icono];
  return <Dibujo relleno={relleno} tamano={24} />;
}

/**
 * La barra de abajo.
 *
 * POR QUÉ LAS ETIQUETAS SON PEQUEÑAS Y SIGUEN ESTANDO
 *
 * A 320 px —el móvil más estrecho que sigue vivo— cada destino sale a 64 px
 * justos, y quitando los 4 px de aire quedan 60 px para la palabra. Medido en
 * el navegador con la Nunito de la casa en negrita, «Aprender», que es la más
 * larga de las cinco, ocupa:
 *
 *     10 px → 43.9    11 px → 48.3    12 px → 52.7    13 px → 57.1    14 px → 61.5
 *
 * Así que 14 px no entra: se saldría 1.5 px y habría que cortar la palabra. Y
 * 13 px entra con 2.9 px de margen, que es nada. Se eligió 12 px, que deja 7.3
 * de los 60 —un 12 % de margen— y es el cuerpo que usan las barras de Android.
 * Las tipografías de reserva (Segoe UI, system-ui, la genérica) se midieron
 * también y son como mucho un 1 % más anchas: 53.3 px en el peor caso, dentro
 * de los 60.
 *
 * Va en `text-xs` (rem) y no en píxeles fijos para que siga a quien tenga
 * agrandada la letra del navegador. Es la decisión incómoda de las dos: con la
 * letra al 125 % la palabra pasa de los 60 px y el `truncate` la recorta. Se
 * prefiere eso a clavar 12 px y no hacer ni caso a quien no ve de cerca; y el
 * `truncate` garantiza que lo que se rompa sea una palabra y no la página
 * entera desbordándose a lo ancho.
 *
 * La alternativa era dejar solo los iconos y esconder la etiqueta para el
 * lector de pantalla. No se hizo: un icono sin palabra se adivina, y aquí hay
 * dos —tienda y liga— que son los dos premios y se confunden entre sí.
 *
 * ZONA PULSABLE: 64 × 56 px a 320 px de ancho. Los dos lados por encima de 44.
 */
export function BarraInferior() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Secciones de Speakmi"
      /*
        z-40 y no z-50: por encima del contenido, pero por debajo del aviso de
        versión nueva, que es momentáneo y tiene que poder taparla.

        El relleno de abajo es el hueco del indicador de inicio del iPhone. Sin
        él la barra se pega al borde y el sistema se come la fila de iconos.
      */
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[var(--borde)] bg-[var(--superficie)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full max-w-md">
        {DESTINOS.map((destino) => {
          const actual = esElDestinoActual(destino, pathname);

          return (
            <li key={destino.a} className="min-w-0 flex-1">
              <Link
                to={destino.a}
                // Lo que marca dónde estás para quien no ve la pantalla. El
                // color y la pestaña de arriba cuentan lo mismo para quien sí.
                aria-current={actual ? 'page' : undefined}
                style={{ height: ALTO_BARRA }}
                className={cn(
                  'relative flex min-w-0 flex-col items-center justify-center gap-1 px-0.5',
                  'text-xs font-bold leading-none',
                  // La pestaña de arriba es un borde pintado, no una animación:
                  // quien pide menos movimiento tiene que ver lo mismo.
                  actual
                    ? 'text-marca-700 before:absolute before:inset-x-2.5 before:top-0 before:h-[3px] before:rounded-b-full before:bg-marca-600 dark:text-marca-300'
                    : 'text-[var(--texto-suave)]',
                )}
              >
                {/*
                  Relleno donde estás, línea donde no.

                  Es la segunda señal de «estás aquí», y es la que funciona sin
                  color: la pestaña de arriba y el morado se pierden para quien
                  no distingue bien los tonos, pero un icono macizo al lado de
                  cuatro huecos se ve siempre. Decorativo: la palabra de debajo
                  ya lo dice, y es la que oye el lector de pantalla.
                */}
                <Icono icono={destino.icono} relleno={actual} />

                <span className="w-full truncate text-center">{destino.etiqueta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
