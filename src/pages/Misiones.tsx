import { useNavigate } from 'react-router-dom';
import { MascotaConMensaje } from '@/components/Mascota';
import { ListaDeMisiones } from '@/components/misiones/Misiones';
import { useMisiones } from '@/components/misiones/consulta';
import type { Misiones as DatosMisiones } from '@/components/misiones/tipos';

/**
 * La pantalla de los desafíos.
 *
 * QUÉ DICE MILO Y POR QUÉ IMPORTA
 *
 * Milo es quien pone el tono, y el tono de esta pantalla es la mitad del
 * trabajo. Una misión sin cumplir NO se regaña: si al entrar con cero hechas
 * Milo pusiera cara de decepción, el panel pasaría de ser una invitación a ser
 * una factura, y el sitio donde se te recuerda lo que no hiciste es un sitio al
 * que no se vuelve. Así que aquí sólo hay tres tonos —vamos allá, ya casi, lo
 * lograste— y ninguno de ellos es un reproche.
 *
 * No lleva confeti. La celebración de este módulo es el cofre abriéndose y la
 * barra llenándose, que están donde ocurre la cosa; treinta papelitos cayendo
 * encima de una pantalla a la que se entra a mirar cuánto falta sería celebrar
 * el hecho de haber mirado.
 */

function mensajeDeMilo(datos: DatosMisiones): {
  estado: 'feliz' | 'animando' | 'celebrando';
  texto: string;
} {
  const cumplidas = datos.diarias.filter((m) => m.cumplida).length;

  if (datos.diarias.length > 0 && cumplidas === datos.diarias.length) {
    return { estado: 'celebrando', texto: '¡Hecho! Mañana te pongo otros tres.' };
  }
  if (cumplidas > 0) {
    const faltan = datos.diarias.length - cumplidas;
    return {
      estado: 'animando',
      texto: faltan === 1 ? 'Te queda uno. Está ahí mismo.' : `Te quedan ${faltan}. Vas bien.`,
    };
  }
  return { estado: 'feliz', texto: 'Tres cosas pequeñas para hoy. Con una ya empiezas.' };
}

export function Misiones() {
  const navegar = useNavigate();
  const { data, isPending, isError } = useMisiones();

  const milo = data ? mensajeDeMilo(data) : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Desafíos</h1>
        <button
          type="button"
          onClick={() => navegar('/ruta')}
          className="-mr-2 flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      {milo && (
        <div className="mt-6">
          <MascotaConMensaje estado={milo.estado} mensaje={milo.texto} />
        </div>
      )}

      {isPending && <p className="mt-10 text-center text-[var(--texto-suave)]">Un momento…</p>}

      {isError && (
        <p role="alert" className="mt-10 text-center text-[var(--texto-fallo)]">
          No pudimos cargar tus desafíos. Inténtalo de nuevo en un momento.
        </p>
      )}

      {data && (
        <div className="mt-6">
          <ListaDeMisiones datos={data} />
        </div>
      )}
    </div>
  );
}
