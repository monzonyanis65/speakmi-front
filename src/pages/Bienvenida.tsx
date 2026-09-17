import { useState } from 'react';
import { NIVELES } from '@/data/niveles';
import { TarjetaNivel } from '@/components/TarjetaNivel';
import { EstadoApi } from '@/components/EstadoApi';

/**
 * Primera pantalla: elegir el nivel.
 *
 * Todavía no guarda nada en el servidor. Cuando exista la autenticación, esta
 * elección pasará a user_levels. Ver la fase 2 del plan de implementación.
 */
export function Bienvenida() {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8 sm:px-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Speakmi</h1>
        <p className="mt-2 text-[var(--texto-suave)]">
          Aprende inglés hablando. Te escucha, te corrige palabra por palabra y conversa contigo.
        </p>
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
        <button
          type="button"
          disabled={!seleccionado}
          className="w-full rounded-2xl bg-marca-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-marca-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
        >
          {seleccionado ? 'Empezar' : 'Elige un nivel para empezar'}
        </button>

        <p className="mt-3 text-center text-xs text-[var(--texto-suave)]">
          ¿No sabes cuál es el tuyo? Pronto podrás hacer una prueba de nivel.
        </p>

        <div className="mt-4">
          <EstadoApi />
        </div>
      </div>
    </div>
  );
}
