import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useContador } from '@/lib/contador';
import { Boton } from '@/components/Boton';
import { Mascota } from '@/components/Mascota';
import { useSesion } from '@/store/sesion';

interface DatosPerfil {
  email: string;
  displayName: string;
  nativeLanguage: string;
  timezone: string;
  dailyGoalMinutes: number;
  createdAt: string;
  level: { code: string; titleEs: string; cefr: string } | null;
}

/** Solo lo que pinta esta pantalla. La consulta la comparte con el panel de inicio. */
interface Progreso {
  xpTotal: number;
  xpHoy: number;
  leccionesCompletadas: number;
  racha: { currentDays: number; longestDays: number };
}

const META_MINIMA = 5;
const META_MAXIMA = 120;

const FORMATO_FECHA = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Convierte un fallo de la API en algo que se pueda hacer.
 *
 * El 404 tiene su propio texto porque significa que ese endpoint todavía no
 * está desplegado, y decirle a alguien «revisa tu conexión» cuando lo que pasa
 * es que la función aún no existe le hace perder el rato buscando su fallo.
 */
function explicar(error: unknown, accion: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return `${accion} todavía no está disponible en el servidor. Inténtalo dentro de un rato.`;
    }
    return error.message;
  }
  return 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.';
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : FORMATO_FECHA.format(fecha);
}

/**
 * El perfil: quién eres, qué llevas hecho y qué te propones al día.
 *
 * Los bloques se caen por separado a propósito. El perfil y el progreso son dos
 * consultas distintas, así que si una falla la otra sigue pintando: se ve la
 * racha aunque el perfil no cargue, y al revés. Mientras `/me/profile` se
 * termina en el backend, el nombre de la cabecera sale de la sesión guardada,
 * que es lo que la app ya sabe sin preguntarle a nadie.
 */
export function Perfil() {
  const navegar = useNavigate();
  const usuario = useSesion((estado) => estado.usuario);

  const consultaPerfil = useQuery({
    queryKey: ['perfil'],
    queryFn: () => api.get<DatosPerfil>('/me/profile'),
  });

  // Misma clave que el panel de inicio: entrar aquí no vuelve a pedir lo mismo.
  const consultaProgreso = useQuery({
    queryKey: ['progreso'],
    queryFn: () => api.get<Progreso>('/progress'),
  });

  const perfil = consultaPerfil.data;
  const progreso = consultaProgreso.data;
  const nombre = perfil?.displayName ?? usuario?.displayName ?? 'Tu perfil';

  const cifras = progreso
    ? [
        { icono: '⭐', valor: progreso.xpTotal, etiqueta: 'de experiencia' },
        {
          icono: '🔥',
          valor: progreso.racha.currentDays,
          etiqueta: progreso.racha.currentDays === 1 ? 'día de racha' : 'días de racha',
        },
        { icono: '🏅', valor: progreso.racha.longestDays, etiqueta: 'tu racha más larga' },
        {
          icono: '📘',
          valor: progreso.leccionesCompletadas,
          etiqueta:
            progreso.leccionesCompletadas === 1 ? 'lección terminada' : 'lecciones terminadas',
        },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Mascota estado="feliz" tamano={68} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-[var(--texto-suave)]">Tu perfil</p>
            <h1 className="truncate text-xl font-bold">{nombre}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navegar(-1)}
          className="-mr-2 min-h-12 shrink-0 rounded-xl px-3 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      {consultaPerfil.isPending && (
        <p className="mt-10 text-center text-[var(--texto-suave)]">Cargando tu perfil…</p>
      )}

      {consultaPerfil.isError && (
        <div
          role="alert"
          className="mt-6 animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5"
          style={{ animationFillMode: 'backwards' }}
        >
          <h2 className="font-bold">No pudimos cargar tus datos</h2>
          <p className="mt-1 text-sm text-[var(--texto-suave)]">
            {explicar(consultaPerfil.error, 'Ver tu perfil')} Mientras tanto puedes seguir con tus
            lecciones con normalidad.
          </p>
          <Boton
            tono="suave"
            ancho={false}
            className="mt-4 min-h-12"
            onClick={() => void consultaPerfil.refetch()}
            disabled={consultaPerfil.isFetching}
          >
            {consultaPerfil.isFetching ? 'Reintentando…' : 'Reintentar'}
          </Boton>
        </div>
      )}

      {perfil && (
        <>
          <TarjetaNombre perfil={perfil} retraso={0} />
          <TarjetaCuenta perfil={perfil} retraso={70} />
        </>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
          Tus cifras
        </h2>

        {consultaProgreso.isError ? (
          <p className="mt-3 text-sm text-[var(--texto-suave)]">
            {explicar(consultaProgreso.error, 'Ver tu progreso')}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {cifras.map((cifra, indice) => (
              <Cifra key={cifra.etiqueta} {...cifra} retraso={140 + indice * 70} />
            ))}
          </div>
        )}
      </section>

      {perfil && <TarjetaMeta perfil={perfil} retraso={420} />}
    </div>
  );
}

/**
 * Una cifra del perfil, subiendo contando.
 *
 * El número que se ve queda oculto para quien escucha la página: el lector lee
 * la etiqueta del párrafo, que ya trae el valor final, y no cuatro cifras
 * seguidas mientras la cuenta avanza.
 */
function Cifra({
  icono,
  valor,
  etiqueta,
  retraso,
}: {
  icono: string;
  valor: number;
  etiqueta: string;
  retraso: number;
}) {
  const contado = useContador(valor);

  return (
    <div
      className="animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-4 text-center"
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <p className="text-lg" aria-hidden>
        {icono}
      </p>
      <p
        className="mt-0.5 text-2xl font-extrabold tabular-nums"
        aria-label={`${valor} ${etiqueta}`}
      >
        <span aria-hidden>{contado}</span>
      </p>
      <p className="text-xs text-[var(--texto-suave)]">{etiqueta}</p>
    </div>
  );
}

/**
 * El nombre, editable donde se lee.
 *
 * Si el guardado falla, el borrador se queda escrito y el campo sigue abierto:
 * lo último que quiere alguien a quien acaba de fallarle el servidor es volver
 * a teclear lo mismo.
 */
function TarjetaNombre({ perfil, retraso }: { perfil: DatosPerfil; retraso: number }) {
  const clienteConsultas = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(perfil.displayName);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: (displayName: string) => api.patch<DatosPerfil>('/me/profile', { displayName }),
    onSuccess: (actualizado) => {
      clienteConsultas.setQueryData(['perfil'], actualizado);

      // La cabecera de la ruta y el saludo leen el nombre de la sesión, no de
      // esta consulta. Sin esto, el perfil enseñaría el nombre nuevo y el resto
      // de la app el viejo hasta la próxima recarga.
      const usuario = useSesion.getState().usuario;
      if (usuario) {
        useSesion.getState().setSesion({ ...usuario, displayName: actualizado.displayName });
      }

      setEditando(false);
    },
  });

  function abrir() {
    setBorrador(perfil.displayName);
    setErrorLocal(null);
    guardar.reset();
    setEditando(true);
  }

  function cancelar() {
    setEditando(false);
    setErrorLocal(null);
    guardar.reset();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const limpio = borrador.trim();

    if (limpio.length < 2) {
      setErrorLocal('Escribe al menos dos letras para que sepamos cómo llamarte.');
      return;
    }
    if (limpio.length > 80) {
      setErrorLocal('Ese nombre es demasiado largo. Deja como mucho 80 letras.');
      return;
    }

    setErrorLocal(null);
    guardar.mutate(limpio);
  }

  const errorServidor = guardar.error
    ? (guardar.error instanceof ApiError && guardar.error.fieldErrors.displayName) ||
      explicar(guardar.error, 'Cambiar tu nombre')
    : null;
  const error = errorLocal ?? errorServidor;

  return (
    <section
      className="mt-6 animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5"
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      {editando ? (
        <form onSubmit={enviar} noValidate>
          <label htmlFor="perfil-nombre" className="text-sm font-medium">
            ¿Cómo quieres que te llamemos?
          </label>
          <input
            id="perfil-nombre"
            type="text"
            value={borrador}
            onChange={(evento) => setBorrador(evento.target.value)}
            autoComplete="given-name"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'perfil-nombre-error' : undefined}
            className={cn(
              'mt-1.5 min-h-12 w-full rounded-xl border bg-[var(--fondo)] px-4 py-3 text-base outline-none transition',
              error
                ? 'border-[var(--color-fallo)]'
                : 'border-[var(--borde)] focus:border-marca-500',
            )}
          />

          {error && (
            <p
              id="perfil-nombre-error"
              role="alert"
              className="mt-1.5 text-sm text-[var(--color-fallo)]"
            >
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Boton type="submit" disabled={guardar.isPending} className="min-h-12">
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Boton>
            <Boton
              type="button"
              tono="suave"
              onClick={cancelar}
              disabled={guardar.isPending}
              className="min-h-12"
            >
              Cancelar
            </Boton>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
              Tu nombre
            </p>
            <p className="mt-1 truncate text-lg font-bold">{perfil.displayName}</p>
          </div>
          <Boton
            type="button"
            tono="suave"
            ancho={false}
            onClick={abrir}
            className="min-h-12 shrink-0"
          >
            Cambiar
          </Boton>
        </div>
      )}
    </section>
  );
}

/** Los datos que no se tocan desde aquí: correo, nivel y antigüedad. */
function TarjetaCuenta({ perfil, retraso }: { perfil: DatosPerfil; retraso: number }) {
  return (
    <section
      className="mt-3 animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5"
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
        Tu cuenta
      </h2>

      <dl className="mt-3 grid gap-3">
        <Fila termino="Correo" valor={perfil.email} />
        <Fila
          termino="Nivel que cursas"
          valor={
            perfil.level
              ? `${perfil.level.titleEs} · ${perfil.level.cefr}`
              : 'Todavía no elegiste nivel'
          }
        />
        <Fila termino="Tu cuenta es de" valor={formatearFecha(perfil.createdAt)} />
      </dl>
    </section>
  );
}

function Fila({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className="text-sm text-[var(--texto-suave)]">{termino}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{valor}</dd>
    </div>
  );
}

/**
 * La meta diaria en minutos.
 *
 * Se guarda con su propio botón y no al soltar el campo: una meta que se
 * guardara sola mientras escribes «30» pasaría antes por 3 minutos.
 */
function TarjetaMeta({ perfil, retraso }: { perfil: DatosPerfil; retraso: number }) {
  const clienteConsultas = useQueryClient();
  const [minutos, setMinutos] = useState(String(perfil.dailyGoalMinutes));
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [guardada, setGuardada] = useState(false);

  const guardar = useMutation({
    mutationFn: (dailyGoalMinutes: number) =>
      api.patch<DatosPerfil>('/me/profile', { dailyGoalMinutes }),
    onSuccess: (actualizado) => {
      clienteConsultas.setQueryData(['perfil'], actualizado);
      setMinutos(String(actualizado.dailyGoalMinutes));
      setGuardada(true);
    },
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setGuardada(false);

    const valor = Number(minutos);
    if (!Number.isInteger(valor) || valor < META_MINIMA || valor > META_MAXIMA) {
      setErrorLocal(
        `Escribe minutos enteros entre ${META_MINIMA} y ${META_MAXIMA}. Con 10 al día ya se avanza.`,
      );
      return;
    }

    setErrorLocal(null);
    guardar.mutate(valor);
  }

  const errorServidor = guardar.error
    ? (guardar.error instanceof ApiError && guardar.error.fieldErrors.dailyGoalMinutes) ||
      explicar(guardar.error, 'Cambiar tu meta diaria')
    : null;
  const error = errorLocal ?? errorServidor;
  const sinCambios = Number(minutos) === perfil.dailyGoalMinutes;

  return (
    <section
      className="mt-6 animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5"
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
        Tu meta diaria
      </h2>

      <form onSubmit={enviar} className="mt-3" noValidate>
        <label htmlFor="perfil-meta" className="text-sm">
          Minutos que quieres practicar cada día
        </label>

        <div className="mt-1.5 flex flex-wrap items-start gap-2">
          <input
            id="perfil-meta"
            type="number"
            inputMode="numeric"
            min={META_MINIMA}
            max={META_MAXIMA}
            step={5}
            value={minutos}
            onChange={(evento) => {
              setMinutos(evento.target.value);
              setGuardada(false);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'perfil-meta-error' : 'perfil-meta-ayuda'}
            className={cn(
              'min-h-12 w-28 rounded-xl border bg-[var(--fondo)] px-4 py-3 text-base tabular-nums outline-none transition',
              error
                ? 'border-[var(--color-fallo)]'
                : 'border-[var(--borde)] focus:border-marca-500',
            )}
          />
          <Boton
            type="submit"
            ancho={false}
            disabled={guardar.isPending || sinCambios}
            className="min-h-12"
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar meta'}
          </Boton>
        </div>

        {error ? (
          <p id="perfil-meta-error" role="alert" className="mt-2 text-sm text-[var(--color-fallo)]">
            {error}
          </p>
        ) : (
          <p id="perfil-meta-ayuda" className="mt-2 text-xs text-[var(--texto-suave)]">
            Entre {META_MINIMA} y {META_MAXIMA} minutos.{' '}
            {guardada && <span className="text-[var(--color-acierto)]">Meta guardada.</span>}
          </p>
        )}
      </form>
    </section>
  );
}
