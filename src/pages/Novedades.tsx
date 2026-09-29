import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { MascotaConMensaje } from '@/components/Mascota';
import { Aviso } from '@/components/juegos/Tablero';

/**
 * El muro de novedades.
 *
 * EL PROBLEMA QUE MANDA SOBRE TODA ESTA PANTALLA
 *
 * Un muro vacío es peor que no tener muro. Quien abre la app el primer día, lee
 * «aquí saldrá lo que hagan tus amigos» y debajo no ve nada, aprende en tres
 * segundos que esta pestaña no sirve y no vuelve a entrar. Y la salida fácil
 * —llenarlo de gente inventada— está prohibida en esta app desde el primer día,
 * porque en cuanto se nota se deja de creer también lo que sí es verdad.
 *
 * LA SALIDA: ESTE MURO NO ES DE TUS AMIGOS, ES DE TU GENTE, Y TÚ ERES PARTE
 *
 * El servidor manda lo que ha pasado en tu círculo, y tu círculo eres tú, tus
 * amigos y quien sigues. Sin nadie añadido, las tarjetas son TUS días: lo que
 * sumaste ayer, cuántas lecciones hiciste. Eso es información de verdad, sale
 * de la XP que ganaste y hoy no está en ninguna otra pantalla. Cuando añades a
 * alguien, sus días se mezclan con los tuyos y esta pantalla no cambia de forma.
 *
 * Queda un solo vacío posible: cuenta recién hecha que todavía no ha estudiado.
 * Ahí abajo no hay un cartel de «vuelve luego», hay las dos únicas cosas que
 * cambian ese estado —empezar una lección y pasar tu código— y el motivo
 * explicado en una frase.
 *
 * QUÉ SE VE DE OTRA PERSONA
 *
 * Su nombre para mostrar y el número del hecho: la XP de ese día, las monedas
 * de un regalo, el puesto del podio. Ni su correo, ni su identificador, ni su
 * nivel, ni su racha. Las tarjetas de un regalo, un toque o un «te siguió» solo
 * las ven las dos personas implicadas.
 */

interface Reaccion {
  emoji: string;
  cuantas: number;
  mia: boolean;
}

interface Tarjeta {
  clave: string;
  tipo: string;
  cuando: string;
  quien: string;
  soyYo: boolean;
  otro: string | null;
  esSobreMi: boolean;
  dato: number | null;
  extra: number | null;
  reacciones: Reaccion[];
}

interface Division {
  numero: number;
  codigo: string;
  nombre: string;
}

interface VistaDelMuro {
  tarjetas: Tarjeta[];
  circulo: number;
  soloEstoyYo: boolean;
  codigo: string;
  reacciones: string[];
  dias: number;
  escalera: Division[];
}

function explicar(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.';
}

export function Novedades() {
  const navegar = useNavigate();
  const cliente = useQueryClient();

  const consulta = useQuery({
    queryKey: ['muro'],
    queryFn: () => api.get<VistaDelMuro>('/social/muro'),
    retry: false,
  });

  const reaccionar = useMutation({
    mutationFn: (datos: { clave: string; emoji: string }) =>
      api.post<VistaDelMuro>('/social/muro/reaccion', datos),
    // El servidor devuelve el muro entero ya recalculado, así que se guarda tal
    // cual en vez de volver a pedirlo: los contadores los cuenta él, y pedirlo
    // otra vez sería enseñar durante un instante una cifra vieja.
    onSuccess: (vista) => cliente.setQueryData(['muro'], vista),
  });

  const { data, isPending, isError, error } = consulta;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Novedades</h1>
        <button
          type="button"
          onClick={() => navegar('/ruta')}
          className="-mr-2 flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      {isPending && (
        <p className="mt-6 text-sm text-[var(--texto-suave)]">Mirando qué ha pasado…</p>
      )}

      {isError && (
        <div className="mt-6">
          <Aviso tono="aviso">{explicar(error)}</Aviso>
        </div>
      )}

      {data && (
        <div className="mt-6 grid gap-4">
          {data.tarjetas.length === 0 ? (
            <TodaviaNadaPasa codigo={data.codigo} />
          ) : (
            <>
              {data.soloEstoyYo && <SoloEstasTu codigo={data.codigo} />}

              <ul className="grid gap-2">
                {data.tarjetas.map((tarjeta) => (
                  <TarjetaDeNovedad
                    key={tarjeta.clave}
                    tarjeta={tarjeta}
                    escalera={data.escalera}
                    reacciones={data.reacciones}
                    guardando={reaccionar.isPending}
                    onReaccionar={(emoji) => reaccionar.mutate({ clave: tarjeta.clave, emoji })}
                  />
                ))}
              </ul>

              <p className="text-center text-xs text-[var(--texto-suave)]">
                Aquí salen los últimos {data.dias} días. Los regalos y los toques solo los veis los
                dos.
              </p>
            </>
          )}

          {reaccionar.isError && <Aviso>{explicar(reaccionar.error)}</Aviso>}
        </div>
      )}
    </div>
  );
}

/**
 * Lo que se enseña cuando no ha pasado absolutamente nada.
 *
 * Solo le ocurre a una cuenta recién hecha que todavía no ha estudiado, y es el
 * único caso en el que este muro está de verdad vacío. No dice «vuelve luego»:
 * dice por qué está vacío y pone las dos cosas que lo llenan, empezando por la
 * que depende de ti sola.
 */
function TodaviaNadaPasa({ codigo }: { codigo: string }) {
  const navegar = useNavigate();

  return (
    <section className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4">
      <MascotaConMensaje
        estado="pensando"
        tamano={70}
        mensaje="Aquí todavía no ha pasado nada, y no voy a inventarme a nadie para rellenarlo."
      />

      <h2 className="mt-4 font-bold">Tu primera novedad la haces tú</h2>

      <p className="mt-2 text-sm text-[var(--texto-suave)]">
        Este muro cuenta lo que hacéis tú y tu gente. Con una lección aparece tu primer día; con tu
        código, aparecen los demás.
      </p>

      <div className="mt-4 grid gap-3">
        <Boton onClick={() => navegar('/ruta')}>Empezar una lección</Boton>
        <CodigoParaCompartir codigo={codigo} />
      </div>
    </section>
  );
}

/** El aviso de que por aquí todavía solo pasas tú, con la forma de arreglarlo. */
function SoloEstasTu({ codigo }: { codigo: string }) {
  return (
    <section className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4">
      <h2 className="text-sm font-bold">Por ahora aquí solo estás tú</h2>
      <p className="mt-1 text-xs text-[var(--texto-suave)]">
        Lo de abajo es tuyo: lo que has sumado cada día. Pásale tu código a quien estudie contigo y
        sus días se mezclarán con los tuyos.
      </p>
      <div className="mt-3">
        <CodigoParaCompartir codigo={codigo} />
      </div>
    </section>
  );
}

/** El código, grande y seleccionable. Es lo único que hay que sacar de la app. */
function CodigoParaCompartir({ codigo }: { codigo: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-[var(--texto-suave)]">
      <span className="shrink-0">Tu código:</span>
      <code className="min-w-0 flex-1 truncate rounded-xl bg-[var(--fondo)] px-3 py-2 text-base font-extrabold tracking-widest text-[var(--texto)]">
        {codigo}
      </code>
    </p>
  );
}

/**
 * Una tarjeta.
 *
 * El icono va marcado como decorativo y la frase lo dice todo: un emoji leído
 * en voz alta por un lector de pantalla no añade nada a «Marta sumó 120 XP», y
 * repetido cuarenta veces estorba.
 */
function TarjetaDeNovedad({
  tarjeta,
  escalera,
  reacciones,
  guardando,
  onReaccionar,
}: {
  tarjeta: Tarjeta;
  escalera: Division[];
  reacciones: string[];
  guardando: boolean;
  onReaccionar: (emoji: string) => void;
}) {
  return (
    <li
      className={cn(
        'rounded-2xl border-2 p-3',
        tarjeta.soyYo || tarjeta.esSobreMi
          ? 'border-marca-300 bg-marca-50 dark:border-marca-700 dark:bg-marca-900/40'
          : 'border-[var(--hueco)] bg-[var(--superficie)]',
      )}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-xl">
          {ICONOS[tarjeta.tipo] ?? '•'}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm">{frase(tarjeta, escalera)}</p>
          <p className="mt-0.5 text-xs text-[var(--texto-suave)]">{cuando(tarjeta.cuando)}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {reacciones.map((emoji) => {
          const puesta = tarjeta.reacciones.find((reaccion) => reaccion.emoji === emoji);

          return (
            <button
              key={emoji}
              type="button"
              disabled={guardando}
              aria-pressed={puesta?.mia ?? false}
              aria-label={`Reaccionar con ${emoji}`}
              onClick={() => onReaccionar(emoji)}
              className={cn(
                'flex min-h-11 items-center gap-1 rounded-xl px-2.5 text-sm disabled:opacity-60',
                puesta?.mia
                  ? 'bg-marca-200 font-bold dark:bg-marca-700'
                  : 'hover:bg-[var(--fondo)]',
              )}
            >
              <span aria-hidden>{emoji}</span>
              {puesta && <span className="text-xs tabular-nums">{puesta.cuantas}</span>}
            </button>
          );
        })}
      </div>
    </li>
  );
}

const ICONOS: Record<string, string> = {
  DIA: '📈',
  SIGUIO: '👀',
  REGALO: '🎁',
  TOQUE: '👋',
  SUBIO_DIVISION: '⬆️',
  PODIO: '🥇',
  DESAFIO_LOGRADO: '🧰',
};

/**
 * La frase de cada tipo de hecho.
 *
 * El servidor no manda texto: manda un tipo, dos nombres y un número. Se escribe
 * aquí porque es lenguaje de la pantalla —cambia entre «tú» y un nombre según
 * quién mira— y porque así nada de lo que una persona escriba puede acabar
 * pintado en el muro de otra.
 */
function frase(tarjeta: Tarjeta, escalera: Division[]): string {
  const quien = tarjeta.soyYo ? 'Tú' : tarjeta.quien;
  const otro = tarjeta.otro ?? 'alguien';

  switch (tarjeta.tipo) {
    case 'DIA': {
      const lecciones =
        tarjeta.extra && tarjeta.extra > 0
          ? ` en ${tarjeta.extra} ${tarjeta.extra === 1 ? 'lección' : 'lecciones'}`
          : '';
      return tarjeta.soyYo
        ? `Sumaste ${tarjeta.dato} XP${lecciones}.`
        : `${quien} sumó ${tarjeta.dato} XP${lecciones}.`;
    }

    case 'SIGUIO':
      return tarjeta.esSobreMi ? `${tarjeta.quien} te siguió.` : `Empezaste a seguir a ${otro}.`;

    case 'REGALO':
      return tarjeta.esSobreMi
        ? `${tarjeta.quien} te mandó un regalo de ${tarjeta.dato} monedas.`
        : `Le mandaste ${tarjeta.dato} monedas a ${otro}.`;

    // El toque no dice nunca «no has estudiado». Dice lo único que un toque
    // sabe de verdad, que es que alguien se acordó.
    case 'TOQUE':
      return tarjeta.esSobreMi ? `${tarjeta.quien} se acordó de ti.` : `Te acordaste de ${otro}.`;

    case 'SUBIO_DIVISION': {
      const nombre =
        escalera.find((division) => division.numero === tarjeta.dato)?.nombre ?? 'la siguiente';
      return tarjeta.soyYo
        ? `Subiste a la División ${nombre}.`
        : `${quien} subió a la División ${nombre}.`;
    }

    case 'PODIO':
      return tarjeta.soyYo
        ? `Quedaste ${tarjeta.dato}.º en tu división.`
        : `${quien} quedó ${tarjeta.dato}.º en su división.`;

    case 'DESAFIO_LOGRADO':
      return tarjeta.soyYo
        ? `Tú y ${otro} llegasteis a vuestro objetivo.`
        : `${tarjeta.quien} y tú llegasteis a vuestro objetivo.`;

    default:
      return `${quien} hizo algo.`;
  }
}

const RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const FECHA = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Hace cuánto fue.
 *
 * Relativo hasta la semana y fecha a partir de ahí. «Hace 9 días» obliga a
 * contar hacia atrás con los dedos; «el martes 16 de septiembre» se entiende de
 * una vez. `Intl.RelativeTimeFormat` viene con el navegador: no hace falta
 * ninguna librería de fechas para nueve líneas.
 */
function cuando(iso: string): string {
  const minutos = Math.round((Date.parse(iso) - Date.now()) / 60_000);

  if (minutos > -60) return RELATIVO.format(Math.min(minutos, 0), 'minute');
  if (minutos > -60 * 24) return RELATIVO.format(Math.round(minutos / 60), 'hour');
  if (minutos > -60 * 24 * 7) return RELATIVO.format(Math.round(minutos / (60 * 24)), 'day');

  return FECHA.format(new Date(iso));
}
