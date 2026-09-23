import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { setToken } from '@/lib/auth';
import { Boton } from '@/components/Boton';
import { useSesion } from '@/store/sesion';

const LARGO_MINIMO = 8;

interface Fuerza {
  nivel: 0 | 1 | 2 | 3;
  texto: string;
  color: string;
}

/**
 * Lo floja o fuerte que es una contraseña, medida por lo único que importa de
 * verdad: cuánto ocupa.
 *
 * No se piden mayúsculas ni símbolos a propósito. Esa clase de reglas produce
 * «Perro2024!», que es corta y previsible, en vez de cuatro palabras seguidas,
 * que es larga y no se olvida. El único mínimo duro son ocho caracteres,
 * porque es lo que valida el servidor.
 */
function medirFuerza(clave: string): Fuerza {
  if (clave.length < LARGO_MINIMO) {
    return {
      nivel: 0,
      texto: `Demasiado corta: mínimo ${LARGO_MINIMO} caracteres`,
      color: 'bg-[var(--color-fallo)]',
    };
  }
  if (clave.length < 12) {
    return { nivel: 1, texto: 'Floja: alárgala un poco más', color: 'bg-[var(--color-fallo)]' };
  }
  if (clave.length < 16) {
    return { nivel: 2, texto: 'Aceptable', color: 'bg-[var(--color-aviso)]' };
  }
  return { nivel: 3, texto: 'Fuerte', color: 'bg-[var(--color-acierto)]' };
}

/**
 * Reparte el fallo del servidor al campo que le toca.
 *
 * Lo importante está en AUTH-001: es el mismo código que devuelve el inicio de
 * sesión, y su mensaje habla del correo y de la contraseña. Aquí no hay correo
 * que valga, así que se reescribe y se pinta bajo la contraseña actual, que es
 * lo único que puede haber fallado.
 */
function repartirError(error: unknown): { actual?: string; nueva?: string; general?: string } {
  if (!error) return {};

  if (!(error instanceof ApiError)) {
    return { general: 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.' };
  }

  const campos = error.fieldErrors;
  if (campos.currentPassword ?? campos.newPassword) {
    return { actual: campos.currentPassword, nueva: campos.newPassword };
  }

  if (error.code === 'AUTH-001') {
    return { actual: 'Esa no es tu contraseña actual. Vuelve a escribirla.' };
  }

  if (error.status === 404) {
    return {
      general:
        'Cambiar la contraseña todavía no está disponible en el servidor. Inténtalo dentro de un rato.',
    };
  }

  return { general: error.message };
}

/**
 * Seguridad: cambiar la contraseña y echar a todos los dispositivos.
 *
 * Las dos cosas van juntas porque se hacen seguidas: quien sospecha que alguien
 * más entró a su cuenta cambia la clave y acto seguido quiere cerrar lo demás.
 */
export function Seguridad() {
  const navegar = useNavigate();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--texto-suave)]">Tu cuenta</p>
          <h1 className="text-xl font-bold">Seguridad</h1>
        </div>
        <button
          type="button"
          onClick={() => navegar(-1)}
          className="-mr-2 min-h-12 shrink-0 rounded-xl px-3 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      <CambiarContrasena retraso={0} />
      <CerrarTodo retraso={70} />
    </div>
  );
}

/** El formulario de cambio de contraseña, con su medidor y sus tres campos. */
function CambiarContrasena({ retraso }: { retraso: number }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erroresLocales, setErroresLocales] = useState<Record<string, string>>({});
  const [hecho, setHecho] = useState(false);

  const cambiar = useMutation({
    mutationFn: (datos: { currentPassword: string; newPassword: string }) =>
      api.post<void>('/auth/change-password', datos),
    onSuccess: () => {
      setActual('');
      setNueva('');
      setRepetida('');
      setHecho(true);
    },
  });

  const fuerza = medirFuerza(nueva);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setHecho(false);
    cambiar.reset();

    // Todo lo que se puede comprobar aquí se comprueba aquí. Mandar dos
    // contraseñas que ni siquiera coinciden para que el servidor conteste que
    // no es hacerle esperar por nada.
    const fallos: Record<string, string> = {};
    if (actual.length === 0) fallos.actual = 'Escribe la contraseña con la que entras ahora.';
    if (nueva.length < LARGO_MINIMO) {
      fallos.nueva = `La nueva necesita al menos ${LARGO_MINIMO} caracteres. Cuanto más larga, mejor.`;
    } else if (nueva === actual) {
      fallos.nueva = 'Esa es la que ya tienes. Escribe una distinta.';
    }
    if (repetida !== nueva) {
      fallos.repetida = 'Las dos nuevas no coinciden. Vuelve a escribirla abajo.';
    }

    setErroresLocales(fallos);
    if (Object.keys(fallos).length > 0) return;

    cambiar.mutate({ currentPassword: actual, newPassword: nueva });
  }

  const delServidor = repartirError(cambiar.error);
  const errorActual = erroresLocales.actual ?? delServidor.actual;
  const errorNueva = erroresLocales.nueva ?? delServidor.nueva;
  const errorRepetida = erroresLocales.repetida;

  return (
    <section
      className="mt-6 animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5"
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <h2 className="font-bold">Cambiar tu contraseña</h2>
      <p className="mt-1 text-sm text-[var(--texto-suave)]">
        Necesitas la que usas ahora. Las demás sesiones abiertas siguen como estaban.
      </p>

      <form onSubmit={enviar} className="mt-4 grid gap-4" noValidate>
        <Campo
          id="seg-actual"
          etiqueta="Tu contraseña actual"
          valor={actual}
          onChange={setActual}
          autoComplete="current-password"
          error={errorActual}
        />

        <div>
          <Campo
            id="seg-nueva"
            etiqueta="Tu contraseña nueva"
            valor={nueva}
            onChange={setNueva}
            autoComplete="new-password"
            error={errorNueva}
            describedBy="seg-nueva-fuerza"
          />

          <div className="mt-2 flex items-center gap-2" id="seg-nueva-fuerza">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[1, 2, 3].map((tramo) => (
                <span
                  key={tramo}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors duration-200',
                    nueva.length > 0 && fuerza.nivel >= tramo ? fuerza.color : 'bg-[var(--hueco)]',
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-[var(--texto-suave)]" aria-live="polite">
              {nueva.length > 0
                ? fuerza.texto
                : 'Cuatro palabras seguidas valen más que un símbolo'}
            </span>
          </div>
        </div>

        <Campo
          id="seg-repetida"
          etiqueta="Repite la nueva"
          valor={repetida}
          onChange={setRepetida}
          autoComplete="new-password"
          error={errorRepetida}
        />

        {delServidor.general && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {delServidor.general}
          </p>
        )}

        {hecho && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            Contraseña cambiada. Úsala la próxima vez que entres.
          </p>
        )}

        <Boton type="submit" disabled={cambiar.isPending} className="min-h-12">
          {cambiar.isPending ? 'Cambiando…' : 'Cambiar contraseña'}
        </Boton>
      </form>
    </section>
  );
}

/**
 * Cerrar la sesión en todos los dispositivos.
 *
 * Pide confirmación porque se echa también a quien pulsa: si estás en el móvil,
 * el móvil también se queda fuera. Sin ese aviso, la mitad de la gente lo
 * pulsaría creyendo que solo afecta «a los otros».
 */
function CerrarTodo({ retraso }: { retraso: number }) {
  const navegar = useNavigate();
  const clienteConsultas = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);

  const cerrar = useMutation({
    mutationFn: () => api.post<{ cerradas: number }>('/auth/logout-all'),
    onSuccess: () => {
      // El servidor ya invalidó los refrescos; aquí se tira lo que quedaba en
      // memoria para que la app no siga pintando datos de una sesión muerta.
      setToken(null);
      useSesion.getState().cerrar();
      clienteConsultas.clear();
      navegar('/', { replace: true });
    },
  });

  const error = cerrar.error
    ? cerrar.error instanceof ApiError && cerrar.error.status === 404
      ? 'Cerrar las demás sesiones todavía no está disponible en el servidor. Mientras tanto, cambia tu contraseña aquí arriba.'
      : cerrar.error instanceof ApiError
        ? cerrar.error.message
        : 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.'
    : null;

  return (
    <section
      className="mt-3 animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5"
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <h2 className="font-bold">Cerrar sesión en todos los dispositivos</h2>
      <p className="mt-1 text-sm text-[var(--texto-suave)]">
        Útil si entraste en un ordenador prestado o si crees que alguien más tiene tu contraseña.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {confirmando ? (
        <div className="mt-4">
          <p className="text-sm font-medium">
            Esto también te saca de aquí. Tendrás que volver a entrar con tu correo y tu contraseña.
          </p>
          <div className="mt-3 flex gap-2">
            <Boton
              type="button"
              tono="fallo"
              onClick={() => cerrar.mutate()}
              disabled={cerrar.isPending}
              className="min-h-12"
            >
              {cerrar.isPending ? 'Cerrando…' : 'Sí, cerrar todo'}
            </Boton>
            <Boton
              type="button"
              tono="suave"
              onClick={() => setConfirmando(false)}
              disabled={cerrar.isPending}
              className="min-h-12"
            >
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        <Boton
          type="button"
          tono="suave"
          ancho={false}
          onClick={() => {
            cerrar.reset();
            setConfirmando(true);
          }}
          className="mt-4 min-h-12"
        >
          Cerrar todas las sesiones
        </Boton>
      )}
    </section>
  );
}

interface CampoProps {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  autoComplete: string;
  error?: string;
  describedBy?: string;
}

/** Un campo de contraseña con su etiqueta de verdad y su error debajo. */
function Campo({ id, etiqueta, valor, onChange, autoComplete, error, describedBy }: CampoProps) {
  const ayuda = [error ? `${id}-error` : null, describedBy ?? null].filter(Boolean).join(' ');

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        type="password"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={ayuda.length > 0 ? ayuda : undefined}
        className={cn(
          'mt-1.5 min-h-12 w-full rounded-xl border bg-[var(--fondo)] px-4 py-3 text-base outline-none transition',
          error ? 'border-[var(--color-fallo)]' : 'border-[var(--borde)] focus:border-marca-500',
        )}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-[var(--texto-fallo)]">
          {error}
        </p>
      )}
    </div>
  );
}
