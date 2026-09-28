import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import {
  direccionDeGoogle,
  entrar,
  proveedoresDeEntrada,
  recuperarSesion,
  registrar,
  tieneNivel,
} from '@/lib/auth';
import { cn } from '@/lib/cn';
import { Mascota } from '@/components/Mascota';
import { Boton } from '@/components/Boton';

const LARGO_MINIMO = 8;

/**
 * Qué decirle a quien vuelve de Google sin haber entrado.
 *
 * El servidor devuelve el tracking code en la dirección, no el mensaje: un texto
 * en la barra del navegador se puede reescribir, y entonces cualquiera podría
 * mandar un enlace que muestre el aviso que quiera en NUESTRA pantalla de
 * acceso. Con un código, lo peor que consigue es un mensaje del catálogo.
 */
const AVISOS_DE_GOOGLE: Record<string, string> = {
  'AUTH-010': 'Entrar con Google no está disponible ahora mismo. Usa tu correo y tu contraseña.',
  'AUTH-011':
    'Google no nos confirmó que ese correo sea tuyo, así que no abrimos tu cuenta. Entra con tu contraseña.',
  'AUTH-008': 'Tu cuenta está desactivada.',
};

const AVISO_GENERICO = 'No pudimos completar la entrada con Google. Vuelve a intentarlo.';

/**
 * Primera pantalla de la app: entrar o crear cuenta.
 *
 * Al terminar, quien ya tiene un nivel activo va directo a su ruta, y quien
 * todavía no lo eligió pasa antes por la pantalla de niveles.
 */
export function Entrada() {
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();

  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  /*
    Con qué se puede entrar lo dice el servidor. Si no contesta, o si el cliente
    de Google no está configurado, el botón sencillamente no aparece: un botón
    que lleva a una pantalla rota es peor que no tenerlo.
  */
  const proveedores = useQuery({
    queryKey: ['proveedores-de-entrada'],
    queryFn: proveedoresDeEntrada,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const hayGoogle = proveedores.data?.google.disponible ?? false;

  const resultadoGoogle = parametros.get('google');

  useEffect(() => {
    if (!resultadoGoogle) return;

    // Se limpia la dirección antes de nada: sin esto, recargar la página
    // repetiría el aviso —o el intento de recuperar la sesión— para siempre.
    setParametros({}, { replace: true });

    // Quien pulsó «cancelar» en la pantalla de Google no se equivocó en nada.
    // Enseñarle un error rojo por haber cambiado de opinión sobra.
    if (resultadoGoogle === 'cancelado') return;

    if (resultadoGoogle !== 'ok') {
      setErrorGeneral(AVISOS_DE_GOOGLE[resultadoGoogle] ?? AVISO_GENERICO);
      return;
    }

    /*
      El servidor ya dejó puesta la cookie de refresco; el token de acceso se
      pide aquí en vez de traerlo en la dirección, que lo dejaría escrito en el
      historial del navegador y en los registros de cualquier proxy del camino.
    */
    setEnviando(true);
    void (async () => {
      try {
        if (!(await recuperarSesion())) {
          setErrorGeneral(AVISO_GENERICO);
          return;
        }
        navegar((await tieneNivel()) ? '/ruta' : '/empezar', { replace: true });
      } finally {
        setEnviando(false);
      }
    })();
  }, [resultadoGoogle, setParametros, navegar]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErrorGeneral(null);

    if (modo === 'crear') {
      /*
        La comprobación de que las dos coinciden se queda aquí y no viaja al
        servidor. Lo que se está evitando es una errata al teclear, y una errata
        es cosa del teclado de quien escribe: mandarla al servidor solo añadiría
        una segunda copia de la contraseña en el cuerpo de la petición y en
        cualquier registro que lo capture, sin proteger de nada más.
      */
      if (repetida !== password) {
        setErrores({ repetida: 'Las dos contraseñas no coinciden. Vuelve a escribirla.' });
        return;
      }
      if (password.length < LARGO_MINIMO) {
        setErrores({ password: `La contraseña necesita al menos ${LARGO_MINIMO} caracteres.` });
        return;
      }
    }

    setErrores({});
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
        <div className="flex justify-center">
          <Mascota estado="animando" tamano={130} />
        </div>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-marca-600 dark:text-marca-400">
          Speakmi
        </h1>
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

      {hayGoogle && (
        <>
          <BotonDeGoogle modo={modo} />
          <Separador />
        </>
      )}

      <form onSubmit={(e) => void enviar(e)} className="mt-6 grid gap-4" noValidate>
        {modo === 'crear' && (
          <Campo
            etiqueta="¿Cómo te llamas?"
            valor={displayName}
            onChange={setDisplayName}
            error={errores.displayName}
            autoComplete="name"
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
          nombreHablado="la contraseña"
        />

        {/*
          El segundo campo solo existe al crear la cuenta.
          Hasta ahora una errata al teclear la contraseña dejaba a alguien fuera
          de su propia cuenta para siempre: no hay envío de correo, así que el
          «he olvidado mi contraseña» no lleva a ninguna parte.
        */}
        {modo === 'crear' && (
          <Campo
            etiqueta="Repite la contraseña"
            tipo="password"
            valor={repetida}
            onChange={setRepetida}
            error={errores.repetida}
            autoComplete="new-password"
            ayuda="Tiene que ser igual que la de arriba"
            nombreHablado="la contraseña repetida"
          />
        )}

        {errorGeneral && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorGeneral}
          </p>
        )}

        <Boton type="submit" disabled={enviando} tamano="grande" className="mt-2">
          {enviando ? 'Un momento…' : modo === 'crear' ? 'CREAR MI CUENTA' : 'ENTRAR'}
        </Boton>
      </form>

      {modo === 'entrar' && (
        <button
          type="button"
          onClick={() => navegar('/recuperar')}
          className="mx-auto mt-5 rounded-xl px-4 py-3 text-center text-sm font-bold text-marca-600 hover:bg-marca-50 dark:text-marca-400 dark:hover:bg-marca-900/30"
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
    // La repetida no se arrastra entre pestañas: quedaba rellenada de antes y
    // el aviso de «no coinciden» aparecía sin que nadie hubiera escrito nada.
    setRepetida('');
  }
}

/**
 * El botón de Google.
 *
 * Es un enlace de verdad y no un `onClick`: el servidor contesta con una
 * redirección a Google, y eso tiene que ser una navegación del navegador para
 * que al volver pueda poner la cookie de sesión. Con `fetch` no funcionaría.
 */
function BotonDeGoogle({ modo }: { modo: 'entrar' | 'crear' }) {
  return (
    <a
      href={direccionDeGoogle()}
      className={cn(
        'boton-3d mt-6 flex min-h-14 items-center justify-center gap-3 rounded-2xl px-5',
        'border-[var(--hueco)] bg-[var(--superficie)] text-[var(--texto)]',
        'font-bold tracking-wide transition hover:border-marca-400',
      )}
    >
      <LogoDeGoogle />
      <span className="text-sm">
        {modo === 'crear' ? 'Crear cuenta con Google' : 'Entrar con Google'}
      </span>
    </a>
  );
}

/**
 * La G de Google, dibujada aquí.
 *
 * Sus condiciones de marca piden este logotipo y no otro. Va como SVG en línea
 * en vez de como imagen de sus servidores: son cuatro trazados, no hay que
 * esperar a una descarga en la primera pantalla de la aplicación, y de paso no
 * se le cuenta a Google quién abre Speakmi antes de haber pulsado nada.
 */
function LogoDeGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function Separador() {
  return (
    <div className="mt-6 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-[var(--borde)]" />
      <span className="text-xs font-medium text-[var(--texto-suave)]">o con tu correo</span>
      <span className="h-px flex-1 bg-[var(--borde)]" />
    </div>
  );
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
        'min-h-11 flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition',
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
  /**
   * Cómo nombrar este campo dentro del botón de ver la contraseña. La etiqueta
   * a secas no sirve: «Ver repite la contraseña» no se entiende al oírlo.
   */
  nombreHablado?: string;
}

function Campo({
  etiqueta,
  valor,
  onChange,
  tipo = 'text',
  error,
  ayuda,
  autoComplete,
  nombreHablado,
}: CampoProps) {
  /*
    La etiqueta apunta al campo con `htmlFor` en vez de envolverlo, y la ayuda y
    el error quedan FUERA de ella.

    Envolviéndolo, el nombre accesible del campo sale de todo el texto que hay
    dentro de la etiqueta: un lector de pantalla anunciaba «Contraseña Al menos
    8 caracteres», con la ayuda pegada al nombre y repetida otra vez por el
    `aria-describedby`. Fuera, el nombre es «Contraseña» y la ayuda se lee
    después, que es su sitio.

    El error, además, lleva `role="alert"`: sin él aparece sin que nadie se
    entere, porque el foco sigue en el botón de enviar.
  */
  const id = useId();
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;

  const [visible, setVisible] = useState(false);
  const esClave = tipo === 'password';

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>

      <div className="relative">
        <input
          id={id}
          type={esClave && visible ? 'text' : tipo}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
          className={cn(
            'w-full rounded-xl border bg-[var(--superficie)] px-4 py-3 text-base outline-none transition',
            esClave && 'pr-14',
            error ? 'border-[var(--color-fallo)]' : 'border-[var(--borde)] focus:border-marca-500',
          )}
        />

        {/*
          Poder mirar lo que se ha escrito es la otra mitad del arreglo. Repetir
          a ciegas una contraseña que tampoco se ve es teclear dos veces el mismo
          error, y en un móvil con las letras juntas pasa constantemente.
        */}
        {esClave && (
          <button
            type="button"
            onClick={() => setVisible((antes) => !antes)}
            aria-pressed={visible}
            // Con dos campos de contraseña en la misma pantalla, dos botones que
            // solo dicen «Ver» no se distinguen al recorrerlos con un lector.
            aria-label={`${visible ? 'Ocultar' : 'Ver'} ${nombreHablado ?? etiqueta.toLowerCase()}`}
            className="absolute inset-y-0 right-0 flex min-h-11 w-14 items-center justify-center rounded-r-xl text-xs font-bold text-marca-600 hover:bg-marca-50 dark:text-marca-400 dark:hover:bg-marca-900/30"
          >
            {visible ? 'Ocultar' : 'Ver'}
          </button>
        )}
      </div>

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
