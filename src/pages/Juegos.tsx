import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { hayVozInglesa } from '@/lib/voz';
import { MascotaConMensaje } from '@/components/Mascota';
import { Aviso } from '@/components/juegos/Tablero';
import { ASPECTOS } from '@/components/juegos/aspecto';
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
 *
 *
 * POR QUÉ LA TARJETA ES ASÍ Y NO UN PÁRRAFO
 *
 * Eran cuatro rectángulos del mismo blanco con un iconito de doce píxeles y la
 * marca escondida en la última línea, en gris, del tamaño de una nota al pie.
 * Un escaparate en el que hay que leerlo todo para elegir no es un escaparate.
 *
 * Ahora cada juego tiene tres cosas que se ven antes de leer: su color, su
 * icono grande y su récord en una tira aparte. El récord sube de categoría a
 * propósito: es lo único de esta pantalla que es TUYO, y es la razón por la que
 * se vuelve. Un número que hay que buscar no invita a batirlo.
 *
 * El color nunca lleva información que no esté también escrita: el naranja no
 * significa nada que no diga «entrena la velocidad» dos líneas más abajo.
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
  const aspecto = ASPECTOS[codigo];
  const titulo = juego?.titleEs ?? ficha.titulo;
  const descripcion = juego?.descripcionEs ?? ficha.descripcion;

  return (
    <button
      type="button"
      onClick={onJugar}
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
      className={cn(
        'boton-3d flex w-full animate-entrada flex-col rounded-2xl border-2 p-3 text-left',
        // El lavado va de la esquina de arriba a la izquierda —donde está el
        // icono— hacia el fondo normal, y se acaba antes de la mitad para no
        // teñir el texto.
        'bg-linear-to-br to-[var(--superficie)] to-55%',
        aspecto.lavado,
        aspecto.borde,
      )}
    >
      <span className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br text-3xl shadow-sm',
            aspecto.degradado,
          )}
        >
          {ficha.icono}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="min-w-0 flex-1 text-lg font-extrabold leading-tight">{titulo}</span>
            <span aria-hidden className="mt-0.5 shrink-0 text-[var(--texto-suave)]">
              ›
            </span>
          </span>

          {/* Para qué sirve, pegado al nombre. Es lo que decide cuál se toca. */}
          <span className={cn('block text-xs font-bold', aspecto.texto)}>
            entrena {ficha.entrena}
          </span>
        </span>
      </span>

      <span className="mt-2 block text-sm leading-snug text-[var(--texto-suave)]">
        {descripcion}
      </span>

      {sinVoz && (
        <span className="mt-2 block text-xs font-semibold text-[var(--texto-aviso)]">
          Necesita una voz en inglés y tu equipo no tiene ninguna
        </span>
      )}

      <Marca cargando={cargando} juego={juego} aspecto={aspecto} />
    </button>
  );
}

/**
 * Tu mejor marca, en su propia tira.
 *
 * Separada del texto y con fondo porque es de otra naturaleza: todo lo demás en
 * la tarjeta es igual para todo el mundo, y esto es solo tuyo. Cuando todavía no
 * hay marca no se pone un cero —un cero se lee como que jugaste y lo hiciste
 * fatal—, se dice que el sitio está libre.
 */
function Marca({
  cargando,
  juego,
  aspecto,
}: {
  cargando: boolean;
  juego?: JuegoDelCatalogo;
  aspecto: (typeof ASPECTOS)[CodigoJuego];
}) {
  if (cargando) {
    return (
      <span className="mt-3 flex min-h-12 items-center rounded-xl bg-[var(--fondo)] px-3">
        <span className="text-xs text-[var(--texto-suave)]">Buscando tu marca…</span>
      </span>
    );
  }

  if (!juego) {
    return (
      <span className="mt-3 flex min-h-12 items-center rounded-xl bg-[var(--fondo)] px-3">
        <span className="text-xs text-[var(--texto-suave)]">Marca no disponible</span>
      </span>
    );
  }

  const hayRecord = juego.mejorPuntuacion !== null;

  return (
    <span
      className={cn(
        'mt-3 flex min-h-12 items-center gap-2 rounded-xl px-3 py-2',
        hayRecord ? aspecto.tinte : 'bg-[var(--fondo)]',
      )}
    >
      <span aria-hidden className="text-lg leading-none">
        {hayRecord ? '🏆' : '🎯'}
      </span>

      <span className="min-w-0 flex-1">
        {hayRecord ? (
          <>
            <span className="block text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
              Tu récord
            </span>
            <span className={cn('block font-extrabold leading-tight tabular-nums', aspecto.texto)}>
              {juego.mejorPuntuacion} puntos
            </span>
          </>
        ) : (
          <span className="block text-xs font-semibold text-[var(--texto-suave)]">
            Sin marca todavía. Pon la primera.
          </span>
        )}
      </span>

      {juego.jugadasHoy > 0 && (
        <span className="shrink-0 text-right text-[10px] leading-tight text-[var(--texto-suave)] tabular-nums">
          {juego.jugadasHoy} {juego.jugadasHoy === 1 ? 'partida hoy' : 'partidas hoy'}
        </span>
      )}
    </span>
  );
}
