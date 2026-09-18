import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

interface RespuestaSolicitud {
  message: string;
  /** Solo en desarrollo, mientras no haya envío de correo. */
  codigoDesarrollo?: string;
}

/**
 * Recuperar la contraseña.
 *
 * Dos pasos: pedir el código y usarlo. Mientras no haya servicio de correo, en
 * desarrollo el código se muestra en pantalla para poder probar el flujo.
 */
export function OlvideClave() {
  const navegar = useNavigate();

  const [paso, setPaso] = useState<'pedir' | 'cambiar'>('pedir');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nuevaClave, setNuevaClave] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  async function pedirCodigo(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    setErrores({});

    try {
      const respuesta = await api.post<RespuestaSolicitud>('/auth/forgot-password', { email });
      setAviso(respuesta.message);
      if (respuesta.codigoDesarrollo) setCodigo(respuesta.codigoDesarrollo);
      setPaso('cambiar');
    } catch (e) {
      if (e instanceof ApiError) {
        setErrores(e.fieldErrors);
        if (Object.keys(e.fieldErrors).length === 0) setError(e.message);
      } else {
        setError('No pudimos conectar. Revisa tu conexión.');
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarClave(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    setErrores({});

    try {
      await api.post('/auth/reset-password', { code: codigo, newPassword: nuevaClave });
      navegar('/', { replace: true, state: { mensaje: 'Contraseña cambiada. Ya puedes entrar.' } });
    } catch (e) {
      if (e instanceof ApiError) {
        setErrores(e.fieldErrors);
        if (Object.keys(e.fieldErrors).length === 0) setError(e.message);
      } else {
        setError('No pudimos conectar. Revisa tu conexión.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-bold">
          {paso === 'pedir' ? 'Recupera tu cuenta' : 'Elige una contraseña nueva'}
        </h1>
        <p className="mt-2 text-sm text-[var(--texto-suave)]">
          {paso === 'pedir'
            ? 'Escribe tu correo y te mandamos cómo volver a entrar.'
            : 'Pega el código que recibiste y escribe tu contraseña nueva.'}
        </p>
      </header>

      {aviso && (
        <p className="mt-6 rounded-xl bg-marca-50 px-4 py-3 text-sm text-marca-700 dark:bg-marca-900/30 dark:text-marca-200">
          {aviso}
        </p>
      )}

      <form
        onSubmit={(e) => void (paso === 'pedir' ? pedirCodigo(e) : cambiarClave(e))}
        className="mt-6 grid gap-4"
        noValidate
      >
        {paso === 'pedir' ? (
          <Campo
            etiqueta="Tu correo"
            tipo="email"
            valor={email}
            onChange={setEmail}
            error={errores.email}
            autoComplete="email"
          />
        ) : (
          <>
            <Campo
              etiqueta="Código"
              valor={codigo}
              onChange={setCodigo}
              error={errores.code}
              ayuda="Mientras no haya correo, lo rellenamos por ti en desarrollo"
            />
            <Campo
              etiqueta="Contraseña nueva"
              tipo="password"
              valor={nuevaClave}
              onChange={setNuevaClave}
              error={errores.newPassword}
              autoComplete="new-password"
              ayuda="Al menos 8 caracteres"
            />
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-[var(--color-fallo)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="mt-2 rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700"
        >
          {enviando ? 'Un momento…' : paso === 'pedir' ? 'Enviar' : 'Cambiar contraseña'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => navegar('/')}
        className="mx-auto mt-5 rounded-xl px-4 py-3 text-sm font-bold text-marca-600 hover:bg-marca-50 dark:text-marca-400 dark:hover:bg-marca-900/30"
      >
        Volver
      </button>
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
  tipo = 'text',
  error,
  ayuda,
  autoComplete,
}: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  tipo?: string;
  error?: string;
  ayuda?: string;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{etiqueta}</span>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className={cn(
          'rounded-xl border bg-[var(--superficie)] px-4 py-3 text-base outline-none transition',
          error ? 'border-[var(--color-fallo)]' : 'border-[var(--borde)] focus:border-marca-500',
        )}
      />
      {error ? (
        <span className="text-sm text-[var(--color-fallo)]">{error}</span>
      ) : ayuda ? (
        <span className="text-xs text-[var(--texto-suave)]">{ayuda}</span>
      ) : null}
    </label>
  );
}
