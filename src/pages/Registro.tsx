import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { entrar, guardarNivel, registrar } from '@/lib/auth';
import { useSesion } from '@/store/sesion';
import { NIVELES } from '@/data/niveles';
import { cn } from '@/lib/cn';

/**
 * Crear cuenta o entrar.
 *
 * Se llega aquí después de elegir el nivel, igual que en el curso real: primero
 * dices por dónde vas y luego te apuntas. El nivel elegido se guarda en cuanto
 * hay sesión.
 */
export function Registro() {
  const navegar = useNavigate();
  const { nivelPendiente, setNivelPendiente } = useSesion();

  const [modo, setModo] = useState<'crear' | 'entrar'>('crear');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const nivel = NIVELES.find((n) => n.codigo === nivelPendiente);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErrores({});
    setErrorGeneral(null);
    setEnviando(true);

    try {
      if (modo === 'crear') {
        await registrar({ email, password, displayName });
      } else {
        await entrar({ email, password });
      }

      if (nivelPendiente) {
        await guardarNivel(nivelPendiente);
        setNivelPendiente(null);
      }

      navegar('/ruta', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrores(error.fieldErrors);
        // Si el fallo es de un campo concreto ya se muestra debajo del campo.
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
        <h1 className="text-2xl font-bold">
          {modo === 'crear' ? 'Crea tu cuenta' : 'Entra en tu cuenta'}
        </h1>
        {nivel && modo === 'crear' && (
          <p className="mt-2 text-sm text-[var(--texto-suave)]">
            Empezarás por el nivel {nivel.numero}, {nivel.titulo.toLowerCase()}.
          </p>
        )}
      </header>

      <form onSubmit={(e) => void enviar(e)} className="mt-8 grid gap-4" noValidate>
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
          {enviando ? 'Un momento…' : modo === 'crear' ? 'Empezar' : 'Entrar'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setModo(modo === 'crear' ? 'entrar' : 'crear');
          setErrores({});
          setErrorGeneral(null);
        }}
        className="mt-6 text-sm text-marca-600 underline-offset-4 hover:underline dark:text-marca-400"
      >
        {modo === 'crear' ? '¿Ya tienes cuenta? Entra aquí' : '¿Eres nuevo? Crea tu cuenta'}
      </button>
    </div>
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
