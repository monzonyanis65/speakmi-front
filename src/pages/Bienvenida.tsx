import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NIVELES } from '@/data/niveles';
import { guardarNivel } from '@/lib/auth';
import { useSesion } from '@/store/sesion';
import { TarjetaNivel } from '@/components/TarjetaNivel';

/**
 * Elegir el nivel. Se llega aquí después de entrar, y solo la primera vez o
 * cuando la persona quiere cambiarse de nivel.
 */
export function Bienvenida() {
  const navegar = useNavigate();
  const usuario = useSesion((estado) => estado.usuario);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continuar() {
    if (!seleccionado) return;
    setGuardando(true);
    setError(null);
    try {
      await guardarNivel(seleccionado);
      navegar('/ruta', { replace: true });
    } catch {
      setError('No pudimos guardar tu nivel. Inténtalo otra vez.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8 sm:px-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {usuario ? `Bienvenido, ${usuario.displayName}` : 'Elige tu nivel'}
        </h1>
        <p className="mt-2 text-[var(--texto-suave)]">Dinos por dónde vas y armamos tu ruta.</p>
      </header>

      <section className="mt-10 flex-1">
        <h2 className="text-lg font-semibold">¿Por dónde empiezas?</h2>
        <p className="mt-1 text-sm text-[var(--texto-suave)]">
          Elige el nivel que estás cursando. Podrás cambiarlo cuando quieras.
        </p>

        {/* El hueco de abajo deja sitio a la barra fija, para que no tape el último nivel. */}
        <div className="mt-5 grid gap-3 pb-28">
          {NIVELES.map((nivel) => (
            <TarjetaNivel
              key={nivel.codigo}
              nivel={nivel}
              seleccionado={seleccionado === nivel.codigo}
              onSeleccionar={setSeleccionado}
            />
          ))}
        </div>
      </section>

      {/* Barra fija abajo: en móvil el pulgar llega sin estirar la mano. */}
      <div className="sticky bottom-0 mt-8 bg-gradient-to-t from-[var(--fondo)] via-[var(--fondo)] to-transparent pb-2 pt-6">
        {error && (
          <p role="alert" className="mb-3 text-center text-sm text-[var(--color-fallo)]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void continuar()}
          disabled={!seleccionado || guardando}
          className="w-full rounded-2xl bg-marca-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-marca-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
        >
          {guardando ? 'Guardando…' : seleccionado ? 'Empezar' : 'Elige un nivel para empezar'}
        </button>

        <button
          type="button"
          onClick={() => navegar('/prueba')}
          className="mt-3 w-full text-center text-xs text-marca-600 underline-offset-4 hover:underline dark:text-marca-400"
        >
          ¿No sabes cuál es el tuyo? Haz la prueba de nivel
        </button>
      </div>
    </div>
  );
}
