import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { hayVozInglesa } from '@/lib/voz';
import { MascotaConMensaje } from '@/components/Mascota';
import { Aviso } from '@/components/juegos/Tablero';
import {
  CODIGOS,
  FICHAS,
  type CodigoJuego,
  type JuegoDelCatalogo,
} from '@/components/juegos/tipos';

/**
 * Los juegos.
 *
 * Es el único sitio de la aplicación donde hay reloj, récord y premio, y esa es
 * la diferencia: en la ruta se estudia, aquí se juega. Lo que las lecciones no
 * pueden dar es prisa, y la prisa es justo lo que separa saberse una regla de
 * poder usarla hablando.
 *
 * Cada tarjeta dice PARA QUÉ sirve su juego, y no por cortesía: cuatro juegos
 * sin explicar son cuatro botones de colores, y nadie vuelve a un botón de
 * colores.
 */
export function Juegos() {
  const navegar = useNavigate();
  const [hayVoz, setHayVoz] = useState<boolean | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['juegos'],
    queryFn: () => api.get<{ games: JuegoDelCatalogo[] }>('/games'),
    // Un solo intento: si el servidor no está, se enseña el catálogo de todas
    // formas y quien entra lo ve al momento en vez de mirar un hueco.
    retry: false,
  });

  useEffect(() => {
    let vivo = true;
    void hayVozInglesa().then((hay) => {
      if (vivo) setHayVoz(hay);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const delServidor = new Map((data?.games ?? []).map((juego) => [juego.code, juego]));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Juegos</h1>
        <button
          type="button"
          onClick={() => navegar('/ruta')}
          className="-mr-2 flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      <div className="mt-6">
        <MascotaConMensaje
          estado="animando"
          mensaje="Cinco minutos aquí valen por media lección. Elige con qué quieres pelearte hoy."
        />
      </div>

      {isError && (
        <div className="mt-6">
          <Aviso tono="aviso">
            No pudimos cargar tus marcas. Los juegos siguen ahí, pero hasta que volvamos a conectar
            no verás tu récord ni ganarás monedas.
          </Aviso>
        </div>
      )}

      <div className="mt-6 grid gap-3">
        {CODIGOS.map((codigo, indice) => (
          <Tarjeta
            key={codigo}
            codigo={codigo}
            {...(delServidor.get(codigo) ? { juego: delServidor.get(codigo)! } : {})}
            cargando={isPending}
            sinVoz={codigo === 'ESCUCHA' && hayVoz === false}
            retraso={indice * 70}
            onJugar={() => navegar(`/juegos/${codigo}`)}
          />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--texto-suave)]">
        Las partidas dan monedas para la tienda. Los récords solo te los ganas tú.
      </p>
    </div>
  );
}

function Tarjeta({
  codigo,
  juego,
  cargando,
  sinVoz,
  retraso,
  onJugar,
}: {
  codigo: CodigoJuego;
  juego?: JuegoDelCatalogo;
  cargando: boolean;
  sinVoz: boolean;
  retraso: number;
  onJugar: () => void;
}) {
  const ficha = FICHAS[codigo];
  const titulo = juego?.titleEs ?? ficha.titulo;
  const descripcion = juego?.descripcionEs ?? ficha.descripcion;

  return (
    <button
      type="button"
      onClick={onJugar}
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
      className="boton-3d flex w-full animate-entrada items-start gap-3 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4 text-left"
    >
      <span
        aria-hidden
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
          ficha.color,
        )}
      >
        {ficha.icono}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-bold">{titulo}</span>
          {/* Para qué sirve, pegado al nombre. Es lo que decide cuál se toca. */}
          <span className="text-xs font-semibold text-marca-700 dark:text-marca-300">
            entrena {ficha.entrena}
          </span>
        </span>

        <span className="mt-0.5 block text-sm text-[var(--texto-suave)]">{descripcion}</span>

        {sinVoz && (
          <span className="mt-2 block text-xs font-semibold text-[var(--texto-aviso)]">
            Necesita una voz en inglés y tu equipo no tiene ninguna
          </span>
        )}

        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {cargando ? (
            <span className="text-[var(--texto-suave)]">Buscando tu marca…</span>
          ) : juego && juego.mejorPuntuacion !== null ? (
            <span className="font-bold tabular-nums">
              <span aria-hidden>🏆 </span>
              {juego.mejorPuntuacion} puntos
            </span>
          ) : (
            <span className="text-[var(--texto-suave)]">
              {juego ? 'Sin marca todavía. Pon la primera.' : 'Marca no disponible'}
            </span>
          )}

          {juego && juego.jugadasHoy > 0 && (
            <span className="text-[var(--texto-suave)] tabular-nums">
              {juego.jugadasHoy} {juego.jugadasHoy === 1 ? 'partida hoy' : 'partidas hoy'}
            </span>
          )}
        </span>
      </span>

      <span aria-hidden className="mt-3 shrink-0 text-[var(--texto-suave)]">
        ›
      </span>
    </button>
  );
}
