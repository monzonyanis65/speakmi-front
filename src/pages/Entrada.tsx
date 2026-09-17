import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { entrar, registrar, tieneNivel } from '@/lib/auth';
import { cn } from '@/lib/cn';

/**
 * Primera pantalla de la app: entrar o crear cuenta.
 *
 * Al terminar, quien ya tiene un nivel activo va directo a su ruta, y quien
 * todavía no lo eligió pasa antes por la pantalla de niveles.
 */
export function Entrada() {
  const navegar = useNavigate();

  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErrores({});
    setErrorGeneral(null);
    setEnviando(true);

    try {
      if (modo === 'crear') {
        await registrar({ email, password, displayName });
        // Una cuenta nueva nunca tiene nivel: se le pregunta cómo quiere empezar.
        navegar('/empezar', { replace: true });
        return;
      }

      await entrar({ email, password });
      navegar((await tieneNivel()) ? '/ruta' : '/empezar', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrores(error.fieldErrors);
        if (Object.keys(error.fieldErrors).length === 0) setErrorGeneral(error.message);
      } else {
        setErrorGeneral('No pudimos conectar. Revisa tu conexión.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Speakmi</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--texto-suave)]">
          Aprende inglés hablando. Te escucha, te corrige palabra por palabra y conversa contigo.
        </p>
      </header>

      <div className="mt-8 flex rounded-2xl bg-[var(--superficie)] p-1 ring-1 ring-[var(--borde)]">
        <Pestana activa={modo === 'entrar'} onClick={() => cambiarModo('entrar')}>
          Ya tengo cuenta
        </Pestana>
        <Pestana activa={modo === 'crear'} onClick={() => cambiarModo('crear')}>
          Soy nuevo
        </Pestana>
      </div>

      <form onSubmit={(e) => void enviar(e)} className="mt-6 grid gap-4" noValidate>
        {modo === 'crear' && (
          <Campo
            etiqueta="¿Cómo te llamas?"
            valor={displayName}
            onChange={setDisplayName}
            error={errores.displayName}
            autoComplete="given-name"
          />
        )}

        <Campo
          etiqueta="Correo"
          tipo="email"
          valor={email}
          onChange={setEmail}
          error={errores.email}
          autoComplete="email"
        />

        <Campo
          etiqueta="Contraseña"
          tipo="password"
          valor={password}
          onChange={setPassword}
          error={errores.password}
          autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
          ayuda={modo === 'crear' ? 'Al menos 8 caracteres' : undefined}
        />

        {errorGeneral && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorGeneral}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="mt-2 rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700"
        >
          {enviando ? 'Un momento…' : modo === 'crear' ? 'Crear mi cuenta' : 'Entrar'}
        </button>
      </form>

      {modo === 'entrar' && (
        <button
          type="button"
          onClick={() => navegar('/recuperar')}
          className="mt-6 text-center text-sm text-marca-600 underline-offset-4 hover:underline dark:text-marca-400"
        >
          Se me olvidó la contraseña
        </button>
      )}
    </div>
  );

  function cambiarModo(nuevo: 'entrar' | 'crear') {
    setModo(nuevo);
    setErrores({});
    setErrorGeneral(null);
  }
}

function Pestana({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        'flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition',
        activa ? 'bg-marca-600 text-white' : 'text-[var(--texto-suave)] hover:text-[var(--texto)]',
      )}
    >
      {children}
    </button>
  );
}

interface CampoProps {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  tipo?: string;
  error?: string;
  ayuda?: string;
  autoComplete?: string;
}

function Campo({
  etiqueta,
  valor,
  onChange,
  tipo = 'text',
  error,
  ayuda,
  autoComplete,
}: CampoProps) {
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
