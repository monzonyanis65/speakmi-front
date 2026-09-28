import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { proveedoresDeEntrada } from '@/lib/auth';
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

  /*
    Antes esta pantalla enseñaba el formulario pasara lo que pasara, y el
    servidor contestaba «si ese correo tiene cuenta, te enviamos instrucciones».
    No era verdad: `forgot-password` genera el código y lo guarda, pero no hay
    ningún servicio de correo que lo mande, así que quien llegaba aquí esperaba
    un mensaje que no iba a llegar nunca. Se pregunta al servidor y se dice lo
    que hay.
  */
  const proveedores = useQuery({
    queryKey: ['proveedores-de-entrada'],
    queryFn: proveedoresDeEntrada,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const hayCorreo = proveedores.data?.correo.disponible ?? false;
  const hayGoogle = proveedores.data?.google.disponible ?? false;
  // En local el código llega en la respuesta, así que el formulario sigue
  // sirviendo para recorrer el flujo aunque no haya servicio de correo.
  const sePuedeProbar = hayCorreo || (proveedores.data?.correo.pruebaLocal ?? false);

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
          {paso === 'cambiar'
            ? 'Pega el código que recibiste y escribe tu contraseña nueva.'
            : hayCorreo
              ? 'Escribe tu correo y te mandamos cómo volver a entrar.'
              : // Prometer un correo que no se va a enviar es peor que no decir
                // nada: deja esperando a quien se quedó fuera de su cuenta.
                'Esto es lo que podemos hacer hoy por ti.'}
        </p>
      </header>

      {aviso && (
        <p className="mt-6 rounded-xl bg-marca-50 px-4 py-3 text-sm text-marca-700 dark:bg-marca-900/30 dark:text-marca-200">
          {aviso}
        </p>
      )}

      {!proveedores.isLoading && !hayCorreo && paso === 'pedir' && (
        <div
          role="status"
          className="mt-6 rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-5 text-sm"
        >
          <p className="font-bold">Todavía no podemos mandarte el correo.</p>
          <p className="mt-2 text-[var(--texto-suave)]">
            {hayGoogle
              ? 'Speakmi aún no tiene servicio de correo, así que no hay forma de enviarte el enlace. Si tu cuenta usa la misma dirección que tu cuenta de Google, entra con Google: te dejará dentro y desde Seguridad podrás ponerte una contraseña nueva.'
              : 'Speakmi aún no tiene servicio de correo, así que no hay forma de enviarte el enlace. De momento no podemos devolverte el acceso desde aquí.'}
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => void (paso === 'pedir' ? pedirCodigo(e) : cambiarClave(e))}
        className={cn('mt-6 grid gap-4', !sePuedeProbar && paso === 'pedir' && 'hidden')}
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
          <p role="alert" className="text-sm text-[var(--texto-fallo)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="mt-2 rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700 disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
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
  /*
    La etiqueta apunta al campo y la ayuda queda fuera de ella.

    Envolviendo el campo, el nombre accesible salía de TODO el texto de dentro
    de la etiqueta: se anunciaba «Contraseña nueva Al menos 8 caracteres», con
    la ayuda pegada al nombre y leída otra vez por el `aria-describedby`.

    El error, además, lleva `role="alert"`: sin él aparece sin que nadie se
    entere, porque el foco sigue en el botón de enviar.
  */
  const id = useId();
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
        className={cn(
          'rounded-xl border bg-[var(--superficie)] px-4 py-3 text-base outline-none transition',
          error ? 'border-[var(--color-fallo)]' : 'border-[var(--borde)] focus:border-marca-500',
        )}
      />
      {error ? (
        <span id={idError} role="alert" className="text-sm text-[var(--texto-fallo)]">
          {error}
        </span>
      ) : ayuda ? (
        <span id={idAyuda} className="text-xs text-[var(--texto-suave)]">
          {ayuda}
        </span>
      ) : null}
    </div>
  );
}
