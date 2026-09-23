import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NIVELES, TRAMOS } from '@/data/niveles';
import { guardarNivel } from '@/lib/auth';
import { useSesion } from '@/store/sesion';
import { TarjetaNivel } from '@/components/TarjetaNivel';
import { Boton } from '@/components/Boton';
import { cn } from '@/lib/cn';

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

        {/*
          Agrupados por tramo del Marco Común Europeo, no en una lista de ocho.

          Ocho niveles seguidos no dicen dónde acaba uno y empieza otro, y sobre
          todo no dicen nada fuera de esta aplicación: nadie pone «nivel 5» en un
          currículum. Con los tramos, elegir deja de ser «¿voy por el 4 o por el
          5?» —que casi nadie sabe— y pasa a ser «¿soy A2?», que es la pregunta
          que la gente sí sabe contestar.

          El hueco de abajo deja sitio a la barra fija, para que no tape el
          último nivel.
        */}
        <div className="mt-6 grid gap-8 pb-28">
          {TRAMOS.map((tramo) => {
            const suyos = NIVELES.filter((n) => tramo.niveles.includes(n.codigo));

            return (
              <section key={tramo.letra} aria-labelledby={`tramo-${tramo.letra}`}>
                <div className="flex items-baseline gap-3">
                  <span
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-sm font-bold',
                      suyos.length > 0
                        ? 'bg-marca-600 text-white'
                        : 'bg-[var(--superficie)] text-[var(--texto-suave)]',
                    )}
                  >
                    {tramo.letra}
                  </span>
                  <h3 id={`tramo-${tramo.letra}`} className="font-semibold">
                    {tramo.nombre}
                  </h3>
                  {suyos.length > 0 && (
                    <span className="text-xs text-[var(--texto-suave)]">
                      {suyos.length} {suyos.length === 1 ? 'nivel' : 'niveles'}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-[var(--texto-suave)]">{tramo.resumen}</p>

                {/*
                  Qué sabes hacer, cuánto cuesta llegar y qué papel equivale.

                  Van plegados porque son cinco o seis frases por tramo y con seis
                  tramos la pantalla de elegir nivel se convertiría en un tratado.
                  Plegado, quien sepa su nivel elige en dos segundos y quien no lo
                  sepa tiene dónde mirar. Un `details` nativo y no un desplegable
                  hecho a mano: funciona sin JavaScript, se abre con el teclado y
                  el buscador del navegador encuentra el texto de dentro.
                */}
                <details className="group/detalle mt-2">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-marca-600 hover:underline dark:text-marca-400">
                    Qué significa {tramo.letra}
                    <span className="ml-1 inline-block transition-transform group-open/detalle:rotate-90">
                      ›
                    </span>
                  </summary>

                  <div className="mt-2 rounded-2xl bg-[var(--superficie)] p-4 text-sm">
                    <ul className="grid gap-1.5">
                      {tramo.puedes.map((cosa) => (
                        <li key={cosa} className="flex gap-2">
                          <span aria-hidden className="text-marca-600 dark:text-marca-400">
                            ·
                          </span>
                          <span>{cosa}</span>
                        </li>
                      ))}
                    </ul>

                    <dl className="mt-3 grid gap-1 border-t border-[var(--borde)] pt-3 text-xs text-[var(--texto-suave)]">
                      <div className="flex gap-2">
                        <dt className="font-semibold">Clases hasta aquí:</dt>
                        <dd>{tramo.horas}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="shrink-0 font-semibold">Equivale a:</dt>
                        <dd>{tramo.examenes.join(' · ')}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="font-semibold">El Marco lo llama:</dt>
                        <dd>{tramo.bloque}</dd>
                      </div>
                    </dl>
                  </div>
                </details>

                {suyos.length > 0 ? (
                  <div className="mt-3 grid gap-3">
                    {suyos.map((nivel) => (
                      <TarjetaNivel
                        key={nivel.codigo}
                        nivel={nivel}
                        seleccionado={seleccionado === nivel.codigo}
                        onSeleccionar={setSeleccionado}
                      />
                    ))}
                  </div>
                ) : (
                  /*
                    Se dice que todavía no está, en vez de esconderlo. Cortar la
                    lista en B1 daría a entender que ahí se acaba el inglés.
                  */
                  <p className="mt-3 rounded-2xl border border-dashed border-[var(--borde)] px-4 py-3 text-sm text-[var(--texto-suave)]">
                    Todavía no hay curso de este tramo. Llegará.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </section>

      {/*
        Barra fija abajo: en móvil el pulgar llega sin estirar la mano.

        El degradado es solo la franja de arriba, y debajo el fondo es opaco. Lo
        tenía todo degradado, y en una pantalla de 320 el segundo botón se parte
        en dos líneas: la parte de arriba seguía siendo transparente y el texto
        de la tarjeta de detrás se leía a través de los botones.
      */}
      <div className="sticky bottom-0 mt-8">
        <div className="h-6 bg-gradient-to-t from-[var(--fondo)] to-transparent" aria-hidden />
        <div className="bg-[var(--fondo)] pb-2">
          {error && (
            <p role="alert" className="mb-3 text-center text-sm text-[var(--texto-fallo)]">
              {error}
            </p>
          )}

          <Boton
            tamano="grande"
            onClick={() => void continuar()}
            disabled={!seleccionado || guardando}
          >
            {guardando ? 'GUARDANDO…' : seleccionado ? 'EMPEZAR' : 'Elige un nivel para empezar'}
          </Boton>

          <button
            type="button"
            onClick={() => navegar('/prueba')}
            className="mt-2 min-h-11 w-full rounded-xl py-3 text-center text-sm font-bold text-marca-600 hover:bg-marca-50 dark:text-marca-400 dark:hover:bg-marca-900/30"
          >
            ¿No sabes cuál es el tuyo? Haz la prueba de nivel
          </button>
        </div>
      </div>
    </div>
  );
}
