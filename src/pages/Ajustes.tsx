import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { aplicarTema, temaGuardado, type Tema } from '@/lib/tema';
import {
  avisarAhora,
  estadoDelPermiso,
  pedirPermiso,
  type EstadoPermiso,
} from '@/lib/recordatorio';
import { SelectorDeVoz } from '@/components/SelectorDeVoz';
import { CLAVE_HORA, usePreferencias } from '@/lib/preferencias';
import { useMenosMovimiento } from '@/lib/movimiento';
import { despertarSonido, sonar, useSonido } from '@/lib/sonido';

const TEMAS: Array<{ valor: Tema; titulo: string; icono: string }> = [
  { valor: 'auto', titulo: 'Como el sistema', icono: '🌓' },
  { valor: 'claro', titulo: 'Claro', icono: '☀️' },
  { valor: 'oscuro', titulo: 'Oscuro', icono: '🌙' },
];

/** Ajustes: voz, tema y recordatorios. */
export function Ajustes() {
  const navegar = useNavigate();
  const [tema, setTema] = useState<Tema>(temaGuardado);
  const [permiso, setPermiso] = useState<EstadoPermiso>(estadoDelPermiso);
  const [hora, setHora] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_HORA) ?? '19:00';
    } catch {
      return '19:00';
    }
  });
  const [probado, setProbado] = useState(false);
  const { preferencias, guardar } = usePreferencias();

  useEffect(() => aplicarTema(tema), [tema]);

  // Lo que venga de la cuenta manda: puede haberse cambiado en otro aparato.
  useEffect(() => {
    if (preferencias) setTema(preferencias.theme);
  }, [preferencias]);

  function cambiarTema(nuevo: Tema) {
    setTema(nuevo);
    guardar.mutate({ theme: nuevo });
  }

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_HORA, hora);
    } catch {
      // Sin memoria se usa la hora por defecto en la próxima visita.
    }
  }, [hora]);

  async function activarAvisos() {
    const resultado = await pedirPermiso();
    setPermiso(resultado);
    if (resultado === 'concedido') guardar.mutate({ reminderEnabled: true, reminderTime: hora });
  }

  function cambiarHora(nueva: string) {
    setHora(nueva);
    guardar.mutate({ reminderEnabled: true, reminderTime: nueva });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Ajustes</h1>
        <button
          type="button"
          onClick={() => navegar('/menu')}
          className="-mr-2 flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      <div className="mt-6 grid gap-4">
        <Bloque titulo="Cómo se ve" retraso={0}>
          <div className="grid grid-cols-3 gap-2">
            {TEMAS.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                onClick={() => cambiarTema(opcion.valor)}
                aria-pressed={tema === opcion.valor}
                className={cn(
                  'rounded-xl border px-3 py-3 text-center transition',
                  tema === opcion.valor
                    ? 'border-marca-600 bg-marca-50 dark:bg-marca-600/20'
                    : 'border-[var(--borde)] hover:border-marca-400',
                )}
              >
                <span aria-hidden className="block text-xl">
                  {opcion.icono}
                </span>
                <span className="mt-1 block text-xs font-medium">{opcion.titulo}</span>
              </button>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Sonido de los juegos" retraso={70}>
          <SonidoDeLosJuegos />
        </Bloque>

        <div
          style={{ animationDelay: '140ms', animationFillMode: 'backwards' }}
          className="animate-entrada"
        >
          <SelectorDeVoz />
        </div>

        <Bloque titulo="Recordatorios" retraso={210}>
          {permiso === 'sin-soporte' ? (
            <p className="text-sm text-[var(--texto-suave)]">
              Este navegador no sabe mostrar avisos. Prueba con Chrome o Edge.
            </p>
          ) : permiso === 'denegado' ? (
            <p className="text-sm text-[var(--texto-suave)]">
              Bloqueaste los avisos para esta página. Para volver a activarlos hay que permitirlos
              desde el candado de la barra de direcciones: desde aquí ya no se puede pedir.
            </p>
          ) : permiso === 'sin-pedir' ? (
            <>
              <p className="text-sm text-[var(--texto-suave)]">
                Te avisamos una vez al día para que no se te pase practicar.
              </p>
              <button
                type="button"
                onClick={() => void activarAvisos()}
                className="boton-3d mt-3 w-full rounded-xl border-2 border-marca-900 bg-marca-700 px-4 py-3 text-sm font-bold text-white hover:bg-marca-600"
              >
                Activar avisos
              </button>
            </>
          ) : (
            <>
              <label htmlFor="hora-aviso" className="block text-sm font-medium">
                A qué hora
              </label>
              <input
                id="hora-aviso"
                type="time"
                value={hora}
                onChange={(e) => cambiarHora(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--borde)] bg-[var(--superficie)] px-4 py-3 text-base outline-none focus:border-marca-500"
              />

              <button
                type="button"
                onClick={() => setProbado(avisarAhora())}
                className="mt-3 w-full rounded-xl border border-[var(--borde)] px-4 py-3 text-sm font-bold hover:border-marca-400"
              >
                Ver cómo se vería
              </button>
              {probado && (
                <p className="mt-2 text-xs text-[var(--texto-suave)]">
                  Si no lo has visto, tu sistema tiene los avisos silenciados.
                </p>
              )}

              {/*
                Esto hay que decirlo. Una página web no puede despertarse sola a
                una hora: eso lo hace una app instalada o un servidor que empuje
                el aviso, y todavía no tenemos ninguna de las dos. Prometer un
                aviso que no va a llegar es peor que no ofrecerlo.
              */}
              <p className="mt-4 rounded-xl bg-[var(--fondo)] p-3 text-xs text-[var(--texto-suave)]">
                El aviso salta cuando abres Speakmi después de esa hora, no con la aplicación
                cerrada. Para que llegue con la app cerrada hace falta instalarla en la pantalla de
                inicio, y aun así el navegador decide. Lo estamos preparando.
              </p>
            </>
          )}
        </Bloque>
      </div>
    </div>
  );
}

/**
 * El interruptor del sonido de los juegos.
 *
 * Está en los ajustes y no escondido dentro de una partida porque es lo primero
 * que busca quien acaba de hacer sonar un pitido en una oficina en silencio.
 *
 * Al encenderlo suena un acierto. Dos motivos: se comprueba en el momento que de
 * verdad hay sonido —y a qué volumen—, y sobre todo el propio toque es el gesto
 * que el navegador exige para dejar sonar nada. Sin él, el audio no arrancaría
 * hasta el toque siguiente.
 */
function SonidoDeLosJuegos() {
  const { encendido, cambiar } = useSonido();
  const menosMovimiento = useMenosMovimiento();

  function alternar() {
    const nuevo = !encendido;
    // Primero el gesto, después el ajuste: al revés, `despertarSonido` todavía
    // vería el sonido apagado y no crearía nada.
    cambiar(nuevo);
    if (nuevo) {
      despertarSonido();
      sonar('acierto');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        role="switch"
        aria-checked={encendido}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[var(--borde)] px-4 py-2 text-left hover:border-marca-400"
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold">
            {encendido ? 'Con sonido' : 'En silencio'}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--texto-suave)]">
            Pitidos de acierto, fallo, racha y reloj. Solo en este aparato.
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            'flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors',
            encendido ? 'bg-marca-600' : 'bg-[var(--hueco)]',
          )}
        >
          <span
            className={cn(
              'size-5 rounded-full bg-white transition-transform',
              encendido && 'translate-x-5',
            )}
          />
        </span>
      </button>

      {/*
        Hay que decirlo: con «menos movimiento» pedido en el sistema, el juego se
        queda mudo aunque este interruptor esté encendido. Sin este aviso, quien
        lo tenga puesto lo enciende, no oye nada y da por hecho que está roto.
      */}
      {menosMovimiento && (
        <p className="mt-3 rounded-xl bg-[var(--fondo)] p-3 text-xs text-[var(--texto-suave)]">
          Tu sistema pide menos movimiento y menos estímulo, así que los juegos están mudos de todas
          formas. Se puede cambiar en las opciones de accesibilidad del sistema.
        </p>
      )}
    </>
  );
}

function Bloque({
  titulo,
  retraso,
  children,
}: {
  titulo: string;
  retraso: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-4"
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
        {titulo}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
