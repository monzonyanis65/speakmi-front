import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { MascotaConMensaje } from '@/components/Mascota';
import { Aviso } from '@/components/juegos/Tablero';
import { Podio } from '@/components/Podio';
import { pinturaDe } from '@/lib/divisiones';

/**
 * La liga y los amigos.
 *
 * EL PROBLEMA QUE MANDA SOBRE EL DISEÑO DE ESTA PANTALLA
 *
 * Esta app todavía no tiene usuarios. Una clasificación con tres nombres no
 * motiva: desanima, porque enseña de golpe que aquí no hay nadie. Y la salida
 * fácil —rellenarla con gente inventada— es mentir, y en cuanto se nota deja de
 * creerse también todo lo demás que dice la app.
 *
 * Así que esta pantalla no enseña una tabla hasta que la tabla significa algo, y
 * mientras tanto dice la verdad: cuánta gente hay esta semana y cuánta falta
 * para que la liga arranque. La verdad cabe en una frase y no da vergüenza.
 *
 * QUÉ SE ENSEÑA EN SU LUGAR, QUE ES LO IMPORTANTE
 *
 * Tu semana contra tu semana pasada. Ese bloque va ARRIBA DEL TODO y está
 * siempre, haya liga o no, porque es lo único que funciona el día uno con una
 * sola persona registrada y porque, sinceramente, es contra quien se compite de
 * verdad cuando se aprende un idioma. La liga es un añadido encima.
 *
 * Y los amigos, que funcionan desde el primer día sin mínimos: dos personas ya
 * son una comparación. Por eso son una pestaña propia y no una sección perdida
 * al final de la clasificación.
 *
 * QUÉ SE VE DE OTRA PERSONA
 *
 * Su nombre para mostrar y su XP de la semana. En la lista de amigos, además,
 * su racha. Nada más: el correo no sale nunca, y el servidor ni siquiera manda
 * el identificador de nadie.
 *
 * LAS DIVISIONES, Y POR QUÉ NO ROMPEN NADA DE LO ANTERIOR
 *
 * Cuando se construyó esta pantalla se descartaron a propósito: partir veinte
 * personas en cinco grupos es fabricar cinco tablas de cuatro filas y llamarlas
 * ascenso. Ahora existen, y existen con la misma regla que ya impedía el pueblo
 * fantasma: UNA DIVISIÓN SOLO SE ABRE LA SEMANA EN QUE TIENE CINCO PERSONAS.
 * Las que no llegan no se abren y su gente compite con la de abajo, así que
 * nadie asciende a una división vacía porque una división vacía no se abre.
 *
 * Esta pantalla no decide nada de eso: el servidor manda en qué división
 * compites de verdad y cuántas hay abiertas, y aquí se escribe tal cual, sin
 * disimular que hoy solo hay una.
 */

interface FilaDeLiga {
  displayName: string;
  xp: number;
  puesto: number;
  soyYo: boolean;
}

interface Division {
  numero: number;
  codigo: string;
  nombre: string;
}

interface VistaDeLaLiga {
  semana: { empiezaEn: string; terminaEn: string };
  estado: 'viva' | 'faltan' | 'fuera';
  participantes: number;
  participantesTotales: number;
  minimo: number;
  division: Division;
  divisionGanada: Division;
  faltanParaTuDivision: number | null;
  abiertas: number;
  escalera: Division[];
  tabla: FilaDeLiga[];
  miPuesto: number | null;
  miXp: number;
  tuSemanaPasada: {
    xp: number;
    puesto: number | null;
    participantes: number | null;
    monedas: number | null;
    division: Division | null;
    divisionNueva: Division | null;
  };
  podioAnterior: {
    division: Division;
    participantes: number;
    puestos: FilaDeLiga[];
  } | null;
  premioNuevo: {
    puesto: number;
    monedas: number;
    division: Division;
    divisionNueva: Division;
  } | null;
}

interface Amigo {
  amistadId: string;
  displayName: string;
  xpSemana: number;
  racha: number;
  toquesSilenciados: boolean;
  puedoTocar: boolean;
  motivoDelToque: 'puedes' | 'ya-le-toque' | 'sin-toques-hoy';
  puedoRegalar: boolean;
}

interface Seguido {
  seguimientoId: string;
  displayName: string;
  xpSemana: number;
}

interface Seguidor {
  seguimientoId: string;
  displayName: string;
}

interface VistaDeAmigos {
  codigo: string;
  maximo: number;
  maximoSeguidos: number;
  yo: { displayName: string; xpSemana: number; racha: number };
  amigos: Amigo[];
  seguidos: Seguido[];
  seguidores: Seguidor[];
  toquesApagados: boolean;
  toquesQueMeQuedan: number;
  monedasDelRegalo: number;
}

interface Desafio {
  id: string;
  estado: 'pendiente' | 'vivo' | 'logrado' | 'caducado';
  yoRete: boolean;
  otro: string;
  objetivo: number;
  llevan: number;
  loMio: number;
  loSuyo: number;
  cofre: number;
  terminaEn: string | null;
  cofreNuevo: number | null;
}

interface VistaDeDesafios {
  desafio: Desafio | null;
  cofre: number;
  dias: number;
}

const FORMATO_FIN = new Intl.DateTimeFormat('es', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Explica un fallo de la API en algo que se pueda hacer. */
function explicar(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.';
}

export function Liga() {
  const navegar = useNavigate();
  const [pestana, setPestana] = useState<'liga' | 'amigos'>('liga');

  const consultaLiga = useQuery({
    queryKey: ['liga'],
    queryFn: () => api.get<VistaDeLaLiga>('/social/liga'),
    retry: false,
  });

  /*
    Los amigos solo se piden al abrir su pestaña, y no por ahorrar una petición:
    es esa llamada la que crea el código de amistad la primera vez. Pidiéndolo
    siempre, a todo el mundo se le sortearía un código que quizá no va a usar
    nunca.
  */
  const consultaAmigos = useQuery({
    queryKey: ['amigos'],
    queryFn: () => api.get<VistaDeAmigos>('/social/amigos'),
    enabled: pestana === 'amigos',
    retry: false,
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Liga</h1>
        <button
          type="button"
          onClick={() => navegar('/ruta')}
          className="-mr-2 flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      <nav className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-1">
        {(['liga', 'amigos'] as const).map((cual) => (
          <button
            key={cual}
            type="button"
            onClick={() => setPestana(cual)}
            aria-current={pestana === cual ? 'page' : undefined}
            className={cn(
              'min-h-11 rounded-xl px-3 text-sm font-bold capitalize',
              pestana === cual
                ? 'bg-marca-700 text-white'
                : 'text-[var(--texto-suave)] hover:bg-[var(--fondo)]',
            )}
          >
            {cual}
          </button>
        ))}
      </nav>

      {pestana === 'liga' ? (
        <PanelLiga consulta={consultaLiga} />
      ) : (
        <PanelAmigos consulta={consultaAmigos} />
      )}
    </div>
  );
}

function PanelLiga({ consulta }: { consulta: ReturnType<typeof useQuery<VistaDeLaLiga, Error>> }) {
  const cliente = useQueryClient();
  const { data, isPending, isError, error } = consulta;

  const visibilidad = useMutation({
    mutationFn: (visible: boolean) =>
      api.put<VistaDeLaLiga>('/social/liga/visibilidad', { visible }),
    onSuccess: (vista) => cliente.setQueryData(['liga'], vista),
  });

  if (isPending) {
    return <p className="mt-6 text-sm text-[var(--texto-suave)]">Contando la semana…</p>;
  }

  if (isError || !data) {
    return (
      <div className="mt-6">
        <Aviso tono="aviso">{explicar(error)}</Aviso>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4">
      {data.premioNuevo && (
        <p
          role="status"
          className="rounded-2xl border-2 border-acento-400 bg-acento-300/25 px-4 py-3 text-sm font-bold"
        >
          🏆 La semana pasada acabaste {ordinal(data.premioNuevo.puesto)} en la División{' '}
          {data.premioNuevo.division.nombre} y ganaste {data.premioNuevo.monedas} monedas.
          {data.premioNuevo.divisionNueva.numero > data.premioNuevo.division.numero &&
            ` Subes a la División ${data.premioNuevo.divisionNueva.nombre}.`}
        </p>
      )}

      <TuDivision datos={data} />

      {data.podioAnterior && (
        <PodioDeLaSemanaPasada podio={data.podioAnterior} miPuesto={data.tuSemanaPasada.puesto} />
      )}

      <TuSemana datos={data} />

      {data.estado === 'viva' && <Clasificacion datos={data} />}
      {data.estado === 'faltan' && <FaltaGente datos={data} />}
      {data.estado === 'fuera' && (
        <EstasFuera
          guardando={visibilidad.isPending}
          onVolver={() => visibilidad.mutate(true)}
          error={visibilidad.error}
        />
      )}

      {data.estado !== 'fuera' && (
        <button
          type="button"
          onClick={() => visibilidad.mutate(false)}
          disabled={visibilidad.isPending}
          className="min-h-12 rounded-xl px-4 text-sm text-[var(--texto-suave)] underline underline-offset-4 hover:bg-[var(--superficie)] disabled:opacity-60"
        >
          No quiero aparecer en la liga
        </button>
      )}
    </div>
  );
}

/**
 * En qué división compites, y la verdad sobre cuántas hay.
 *
 * Dice el nombre y el número de las que están ABIERTAS, no las cinco que
 * existen en el código. Enseñar «División 1 de 5» cuando solo hay una abierta
 * sería prometer cuatro ascensos que hoy no se pueden dar, que es la misma
 * mentira que una tabla llena de nombres inventados, solo que más tarde.
 *
 * El nombre va escrito al lado del color, siempre. El color solo repite lo que
 * ya dice la palabra, para que sirva también a quien no los distingue.
 */
function TuDivision({ datos }: { datos: VistaDeLaLiga }) {
  const pintura = pinturaDe(datos.division.codigo);

  return (
    <section className={cn('rounded-2xl border-2 p-4', pintura.borde, pintura.fondo)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <span className={cn('rounded-lg px-2 py-1 text-xs font-extrabold', pintura.pastilla)}>
            División {datos.division.nombre}
          </span>
        </h2>
        <span className="text-xs text-[var(--texto-suave)]">
          {datos.abiertas === 1
            ? 'la única abierta'
            : `${datos.abiertas} de ${datos.escalera.length} abiertas`}
        </span>
      </div>

      <p className="mt-2 text-sm text-[var(--texto-suave)]">
        {datos.abiertas === 1
          ? `Todavía competimos todos juntos. Una división nueva se abre cuando ${datos.minimo} personas llegan a ella: prefiero decírtelo a darte un ascenso a una división vacía.`
          : `Los tres primeros suben de división al acabar la semana. Una división solo se abre cuando tiene ${datos.minimo} personas.`}
      </p>

      {/*
        El caso raro y muy real: subiste la semana pasada y esta semana estás
        compitiendo otra vez abajo porque arriba no hay gente. Callarlo haría
        que el ascenso pareciera un error; contarlo con el número exacto lo
        convierte en algo que se entiende y que además se puede arreglar.
      */}
      {datos.faltanParaTuDivision !== null && (
        <p className="mt-2 border-t border-[var(--hueco)] pt-2 text-sm text-[var(--texto-suave)]">
          Tienes ganada la División {datos.divisionGanada.nombre}, pero todavía no está abierta:
          {datos.faltanParaTuDivision === 1
            ? ' falta 1 persona'
            : ` faltan ${datos.faltanParaTuDivision} personas`}{' '}
          para que sea una liga. Esta semana compites aquí y no la pierdes.
        </p>
      )}
    </section>
  );
}

/**
 * El podio de la semana pasada.
 *
 * Va arriba y solo aparece si la semana pasada hubo liga de verdad. Cuando no
 * la hubo, el servidor no manda nada y aquí no se dibuja un podio vacío con
 * tres huecos, que es lo que más se parece a una promesa incumplida.
 */
function PodioDeLaSemanaPasada({
  podio,
  miPuesto,
}: {
  podio: NonNullable<VistaDeLaLiga['podioAnterior']>;
  miPuesto: number | null;
}) {
  return (
    <section className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold">La semana pasada</h2>
        <span className="text-xs text-[var(--texto-suave)]">
          División {podio.division.nombre} · {podio.participantes} compitiendo
        </span>
      </div>

      <Podio puestos={podio.puestos} division={podio.division.codigo} />

      {miPuesto !== null && (
        <p className="mt-4 rounded-xl bg-[var(--fondo)] px-4 py-3 text-center text-sm font-bold">
          {miPuesto <= 3
            ? `Quedaste ${ordinal(miPuesto)}. Ahí arriba estás tú.`
            : `Quedaste en el puesto n.º ${miPuesto} de ${podio.participantes}.`}
        </p>
      )}
    </section>
  );
}

/**
 * Tu semana contra tu semana pasada.
 *
 * Va arriba y está siempre. Es el bloque que hace que esta pantalla sirva de
 * algo el primer día, cuando todavía no hay contra quién competir, y es además
 * la comparación más honesta que existe: la de la semana pasada sí es un rival
 * a tu medida.
 */
function TuSemana({ datos }: { datos: VistaDeLaLiga }) {
  const pasada = datos.tuSemanaPasada.xp;
  const diferencia = datos.miXp - pasada;
  const fin = new Date(Date.parse(datos.semana.terminaEn) - 60_000);
  const diasQueQuedan = Math.max(
    Math.ceil((Date.parse(datos.semana.terminaEn) - Date.now()) / 86_400_000),
    0,
  );

  return (
    <section className="rounded-2xl border-2 border-marca-200 bg-linear-to-br from-marca-50 to-[var(--superficie)] to-60% p-4 dark:border-marca-800 dark:from-marca-900/50">
      <h2 className="text-sm font-bold text-marca-700 dark:text-marca-300">Tu semana</h2>

      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums">{datos.miXp}</span>
        <span className="text-sm text-[var(--texto-suave)]">XP</span>
      </p>

      <p className="mt-1 text-sm text-[var(--texto-suave)]">
        {pasada === 0 && datos.miXp === 0
          ? 'Todavía no has sumado nada esta semana. Una lección y empiezas.'
          : pasada === 0
            ? 'La semana pasada no sumaste nada. Esta ya va mejor.'
            : diferencia >= 0
              ? `Llevas ${diferencia} XP más que a estas alturas la semana pasada (${pasada}).`
              : `Te faltan ${Math.abs(diferencia)} XP para igualar tu semana pasada (${pasada}).`}
      </p>

      <p className="mt-3 border-t border-[var(--hueco)] pt-3 text-xs text-[var(--texto-suave)]">
        La semana acaba el {FORMATO_FIN.format(fin)}.{' '}
        {diasQueQuedan === 1 ? 'Queda 1 día.' : `Quedan ${diasQueQuedan} días.`}
      </p>

      {datos.tuSemanaPasada.puesto !== null && (
        <p className="mt-2 text-xs text-[var(--texto-suave)]">
          La semana pasada quedaste {ordinal(datos.tuSemanaPasada.puesto)} de{' '}
          {datos.tuSemanaPasada.participantes}.
        </p>
      )}
    </section>
  );
}

/**
 * Lo que se enseña cuando todavía no hay gente.
 *
 * Dice el número exacto de personas que hay y el que hace falta. Un «vuelve
 * pronto» sin cifras se lee como una excusa; un número se lee como un estado, y
 * además se puede hacer algo con él: invitar a alguien.
 */
function FaltaGente({ datos }: { datos: VistaDeLaLiga }) {
  // Se cuenta la gente de TODA la liga y no la de tu división: cuando no hay
  // cinco personas en total, hablar de divisiones sería empezar la casa por el
  // tejado. La división solo importa a partir de que la liga exista.
  const faltan = Math.max(datos.minimo - datos.participantesTotales, 0);

  return (
    <section className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4">
      {/*
        Más pequeña que en otras pantallas: a 320 px el bocadillo se quedaba en
        seis palabras por línea y el mensaje —que es lo que hay que leer aquí—
        parecía una columna de periódico.
      */}
      <MascotaConMensaje
        estado="pensando"
        tamano={70}
        mensaje="Todavía somos pocos para una clasificación. Prefiero decírtelo a llenarla de nombres inventados."
      />

      <h2 className="mt-4 font-bold">La liga aún no ha arrancado</h2>

      <p className="mt-2 text-sm text-[var(--texto-suave)]">
        Esta semana{' '}
        {datos.participantesTotales === 0
          ? 'todavía no ha sumado XP nadie'
          : datos.participantesTotales === 1
            ? 'ha sumado XP una persona'
            : `han sumado XP ${datos.participantesTotales} personas`}
        . Hacen falta {datos.minimo} para que la tabla signifique algo, así que{' '}
        {faltan === 1 ? 'falta 1' : `faltan ${faltan}`}.
      </p>

      <p className="mt-3 text-sm text-[var(--texto-suave)]">
        Mientras tanto compites contra tu semana pasada, que está aquí arriba. Y los amigos
        funcionan ya: pásale tu código a alguien y os veis desde hoy.
      </p>
    </section>
  );
}

function EstasFuera({
  guardando,
  onVolver,
  error,
}: {
  guardando: boolean;
  onVolver: () => void;
  error: unknown;
}) {
  return (
    <section className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4">
      <h2 className="font-bold">Estás fuera de la liga</h2>
      <p className="mt-2 text-sm text-[var(--texto-suave)]">
        Nadie ve tu nombre en la clasificación, y tú tampoco la ves. Tu XP se sigue contando igual,
        y tus amigos te siguen viendo.
      </p>

      {error !== null && error !== undefined && (
        <div className="mt-3">
          <Aviso>{explicar(error)}</Aviso>
        </div>
      )}

      <div className="mt-4">
        <Boton onClick={onVolver} disabled={guardando}>
          {guardando ? 'Un momento…' : 'Volver a la liga'}
        </Boton>
      </div>
    </section>
  );
}

/**
 * La tabla.
 *
 * El servidor manda la cabeza y tus vecinos, no la lista entera, así que entre
 * dos filas puede haber un hueco. Se dibuja con puntos suspensivos en vez de
 * pegar las filas: sin ellos, el 10.º y el 47.º parecerían consecutivos y el
 * puesto dejaría de querer decir nada.
 */
function Clasificacion({ datos }: { datos: VistaDeLaLiga }) {
  let anterior = 0;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold">División {datos.division.nombre}</h2>
        <span className="text-xs text-[var(--texto-suave)]">{datos.participantes} compitiendo</span>
      </div>

      <ol className="mt-3 grid gap-2">
        {datos.tabla.map((fila) => {
          const hayHueco = fila.puesto > anterior + 1;
          anterior = fila.puesto;

          return (
            <li key={`${fila.puesto}-${fila.displayName}`}>
              {hayHueco && (
                <p aria-hidden className="py-1 text-center text-[var(--texto-suave)]">
                  ···
                </p>
              )}

              <div
                className={cn(
                  'flex items-center gap-3 rounded-2xl border-2 p-3',
                  fila.soyYo
                    ? 'border-marca-400 bg-marca-50 dark:border-marca-600 dark:bg-marca-900/50'
                    : 'border-[var(--hueco)] bg-[var(--superficie)]',
                )}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-xl text-sm font-extrabold tabular-nums',
                    medalla(fila.puesto),
                  )}
                >
                  {fila.puesto}
                </span>

                <span className="min-w-0 flex-1 truncate font-bold">
                  {fila.displayName}
                  {fila.soyYo && (
                    <span className="ml-2 text-xs font-bold text-marca-700 dark:text-marca-300">
                      tú
                    </span>
                  )}
                </span>

                <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--texto-suave)]">
                  {fila.xp} XP
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/*
        Se entra en la tabla al sumar el primer punto, así que una cuenta que
        todavía no ha estudiado esta semana ve la clasificación sin salir en
        ella. Sin esta línea parecería un fallo —«¿por qué no estoy?»— cuando lo
        que pasa es que todavía no hay nada que clasificar.
      */}
      {datos.miPuesto === null && (
        <p className="mt-3 rounded-2xl bg-[var(--superficie)] px-4 py-3 text-sm text-[var(--texto-suave)]">
          Todavía no sales en la tabla porque esta semana no has sumado XP. Con la primera lección
          entras.
        </p>
      )}

      <p className="mt-3 text-center text-xs text-[var(--texto-suave)]">
        Se compite con la XP de esta semana. A igual XP va delante quien llegó antes. Los tres
        primeros ganan monedas cuando acabe.
      </p>
    </section>
  );
}

/**
 * El color del puesto.
 *
 * Solo el podio tiene color, y llevan escrito el número dentro: el color no
 * dice nada que no diga la cifra, que es lo que hace que sirva también a quien
 * no distingue el oro del bronce.
 */
function medalla(puesto: number): string {
  if (puesto === 1) return 'bg-acento-400 text-amber-950';
  if (puesto === 2) return 'bg-slate-300 text-slate-900';
  if (puesto === 3) return 'bg-orange-300 text-orange-950';
  return 'bg-[var(--fondo)] text-[var(--texto-suave)]';
}

function ordinal(puesto: number): string {
  return `${puesto}.º`;
}
function PanelAmigos({
  consulta,
}: {
  consulta: ReturnType<typeof useQuery<VistaDeAmigos, Error>>;
}) {
  const cliente = useQueryClient();
  const { data, isPending, isError, error } = consulta;
  const [codigo, setCodigo] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [comoAnadir, setComoAnadir] = useState<'amigo' | 'seguir'>('amigo');

  const invalidar = async () => {
    await cliente.invalidateQueries({ queryKey: ['amigos'] });
    await cliente.invalidateQueries({ queryKey: ['liga'] });
    await cliente.invalidateQueries({ queryKey: ['muro'] });
  };

  const guardarAmigos = (vista: VistaDeAmigos) => cliente.setQueryData(['amigos'], vista);

  const anadir = useMutation({
    mutationFn: (escrito: string) =>
      comoAnadir === 'amigo'
        ? api.post<{ nombre: string }>('/social/amigos', { codigo: escrito })
        : api.post<{ nombre: string }>('/social/seguir', { codigo: escrito }),
    onSuccess: async () => {
      setCodigo('');
      await invalidar();
    },
  });

  const quitar = useMutation({
    mutationFn: (amistadId: string) => api.delete<void>(`/social/amigos/${amistadId}`),
    onSuccess: invalidar,
  });

  const dejarDeSeguir = useMutation({
    mutationFn: (seguimientoId: string) => api.delete<void>(`/social/seguidos/${seguimientoId}`),
    onSuccess: invalidar,
  });

  const quitarSeguidor = useMutation({
    mutationFn: (seguimientoId: string) => api.delete<void>(`/social/seguidores/${seguimientoId}`),
    onSuccess: invalidar,
  });

  const rotar = useMutation({
    mutationFn: () => api.post<{ codigo: string }>('/social/codigo'),
    onSuccess: invalidar,
  });

  const regalar = useMutation({
    mutationFn: (amistadId: string) =>
      api.post<{ nombre: string }>(`/social/amigos/${amistadId}/regalo`),
    onSuccess: invalidar,
  });

  const tocar = useMutation({
    mutationFn: (amistadId: string) =>
      api.post<{ nombre: string }>(`/social/amigos/${amistadId}/toque`),
    onSuccess: invalidar,
  });

  const silenciar = useMutation({
    mutationFn: (datos: { amistadId: string; silenciados: boolean }) =>
      api.put<VistaDeAmigos>(`/social/amigos/${datos.amistadId}/toques`, {
        silenciados: datos.silenciados,
      }),
    onSuccess: guardarAmigos,
  });

  const recibirToques = useMutation({
    mutationFn: (recibir: boolean) => api.put<VistaDeAmigos>('/social/toques', { recibir }),
    onSuccess: guardarAmigos,
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!codigo.trim() || anadir.isPending) return;
    anadir.mutate(codigo.trim());
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles el código sigue a la vista para copiarlo a
      // mano; avisar de que «no se pudo copiar» no añadiría nada que hacer.
    }
  }

  if (isPending) {
    return <p className="mt-6 text-sm text-[var(--texto-suave)]">Buscando a tu gente…</p>;
  }

  if (isError || !data) {
    return (
      <div className="mt-6">
        <Aviso tono="aviso">{explicar(error)}</Aviso>
      </div>
    );
  }

  /*
    Tú, dentro de tu propia lista. Una lista de amigos en la que no sales no es
    una comparación: es un listado de gente que va mejor o peor que nadie.
  */
  const conmigo = [
    { amistadId: 'yo', ...data.yo, soyYo: true as const },
    ...data.amigos.map((amigo) => ({ ...amigo, soyYo: false as const })),
  ].sort((uno, otro) => otro.xpSemana - uno.xpSemana);

  return (
    <div className="mt-6 grid gap-4">
      {/*
        El código va primero y grande. Es lo único de esta pestaña que hay que
        sacar de la app para que sirva —se pega en un mensaje—, y esconderlo
        debajo de la lista obligaría a buscarlo justo cuando alguien te lo pide.
      */}
      <section className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4">
        <h2 className="text-sm font-bold">Tu código</h2>
        <p className="mt-1 text-xs text-[var(--texto-suave)]">
          Pásaselo a quien quieras. Quien lo tenga puede añadirte o seguirte, y ver tu nombre y tu
          XP de la semana. Nadie ve tu correo.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-[var(--fondo)] px-3 py-3 text-lg font-extrabold tracking-widest">
            {data.codigo}
          </code>
          <button
            type="button"
            onClick={() => void copiar(data.codigo)}
            className="boton-3d min-h-12 shrink-0 rounded-xl border-2 border-[var(--hueco)] bg-[var(--superficie)] px-3 text-sm font-bold"
          >
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => rotar.mutate()}
          disabled={rotar.isPending}
          className="mt-3 min-h-11 rounded-xl text-xs text-[var(--texto-suave)] underline underline-offset-4 disabled:opacity-60"
        >
          {rotar.isPending ? 'Cambiando…' : 'Cambiar mi código'}
        </button>
        <p className="text-xs text-[var(--texto-suave)]">
          Si lo compartiste de más, cámbialo: el anterior deja de funcionar y sigues teniendo a los
          que ya tienes.
        </p>
      </section>

      {/*
        Añadir y seguir comparten formulario porque comparten lo único que hace
        falta: el código. Separarlos en dos cajas con dos campos iguales haría
        que quien tiene un código tuviera que decidir antes de saber en qué se
        diferencian, y la diferencia se explica aquí en dos líneas.
      */}
      <form
        onSubmit={enviar}
        className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4"
      >
        <fieldset>
          <legend className="text-sm font-bold">Añadir a alguien</legend>

          {/*
            Dos botones que se marcan, y no un `radiogroup` de verdad. Un grupo
            de radios espera moverse con las flechas y tener una sola parada de
            tabulador; escribirlo a medias es peor que no escribirlo, porque un
            lector de pantalla anuncia un comportamiento que luego no ocurre.
            Con `aria-pressed` se dice exactamente lo que hay: dos botones, cada
            uno alcanzable con el tabulador, y uno de ellos pulsado.
          */}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border-2 border-[var(--hueco)] bg-[var(--fondo)] p-1">
            {(
              [
                ['amigo', 'Ser amigos'],
                ['seguir', 'Solo seguir'],
              ] as const
            ).map(([cual, texto]) => (
              <button
                key={cual}
                type="button"
                aria-pressed={comoAnadir === cual}
                onClick={() => setComoAnadir(cual)}
                className={cn(
                  'min-h-11 rounded-lg px-2 text-xs font-bold',
                  comoAnadir === cual
                    ? 'bg-marca-700 text-white'
                    : 'text-[var(--texto-suave)] hover:bg-[var(--superficie)]',
                )}
              >
                {texto}
              </button>
            ))}
          </div>

          <p className="mt-2 text-xs text-[var(--texto-suave)]">
            {comoAnadir === 'amigo'
              ? 'Ser amigos va en los dos sentidos: os veis, podéis regalaros y desafiaros.'
              : 'Seguir va en un solo sentido: ves lo que hace y se entera de que le sigues, pero no tiene que añadirte.'}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              id="codigo-amigo"
              aria-label="Código de esa persona"
              value={codigo}
              onChange={(evento) => setCodigo(evento.target.value)}
              placeholder="ABCD-EFGH"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-[var(--hueco)] bg-[var(--fondo)] px-3 uppercase tracking-widest placeholder:tracking-normal placeholder:normal-case"
            />
            <Boton
              type="submit"
              ancho={false}
              disabled={anadir.isPending}
              className="sm:w-auto sm:px-6"
            >
              {anadir.isPending ? 'Añadiendo…' : comoAnadir === 'amigo' ? 'Añadir' : 'Seguir'}
            </Boton>
          </div>
        </fieldset>

        {anadir.isError && (
          <div className="mt-3">
            <Aviso>{explicar(anadir.error)}</Aviso>
          </div>
        )}
        {anadir.isSuccess && (
          <p role="status" className="mt-3 text-sm font-bold text-[var(--texto-acierto)]">
            {anadir.data.nombre} ya está en tu lista.
          </p>
        )}
      </form>

      <DesafioConUnAmigo amigos={data.amigos} />

      <section>
        <h2 className="font-bold">
          {data.amigos.length === 0
            ? 'Todavía no tienes a nadie'
            : `Tú y ${data.amigos.length === 1 ? 'tu amigo' : `tus ${data.amigos.length} amigos`}`}
        </h2>

        {data.amigos.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--texto-suave)]">
            Los amigos funcionan desde hoy, aunque la liga todavía no. Pasa tu código por donde
            hables con quien estudie contigo y aparecerá aquí con lo que lleve esta semana.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {conmigo.map((quien) => (
              <li
                key={quien.amistadId}
                className={cn(
                  'rounded-2xl border-2 p-3',
                  quien.soyYo
                    ? 'border-marca-400 bg-marca-50 dark:border-marca-600 dark:bg-marca-900/50'
                    : 'border-[var(--hueco)] bg-[var(--superficie)]',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {quien.soyYo ? 'Tú' : quien.displayName}
                    </span>
                    <span className="block text-xs text-[var(--texto-suave)] tabular-nums">
                      {quien.xpSemana} XP esta semana
                      {quien.racha > 0 &&
                        ` · ${quien.racha} ${quien.racha === 1 ? 'día' : 'días'} de racha`}
                    </span>
                  </span>

                  {!quien.soyYo && (
                    <button
                      type="button"
                      onClick={() => quitar.mutate(quien.amistadId)}
                      disabled={quitar.isPending}
                      aria-label={`Quitar a ${quien.displayName}`}
                      className="min-h-11 shrink-0 rounded-xl px-3 text-xs text-[var(--texto-suave)] underline underline-offset-4 hover:bg-[var(--fondo)] disabled:opacity-60"
                    >
                      Quitar
                    </button>
                  )}
                </div>

                {!quien.soyYo && (
                  <AccionesConUnAmigo
                    amigo={quien}
                    monedasDelRegalo={data.monedasDelRegalo}
                    ocupado={regalar.isPending || tocar.isPending || silenciar.isPending}
                    onRegalar={() => regalar.mutate(quien.amistadId)}
                    onTocar={() => tocar.mutate(quien.amistadId)}
                    onSilenciar={(silenciados) =>
                      silenciar.mutate({ amistadId: quien.amistadId, silenciados })
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {(quitar.isError || regalar.isError || tocar.isError) && (
          <div className="mt-3">
            <Aviso>{explicar(quitar.error ?? regalar.error ?? tocar.error)}</Aviso>
          </div>
        )}

        {regalar.isSuccess && (
          <p role="status" className="mt-3 text-sm font-bold text-[var(--texto-acierto)]">
            {regalar.data.nombre} tiene {data.monedasDelRegalo} monedas más.
          </p>
        )}

        {tocar.isSuccess && (
          <p role="status" className="mt-3 text-sm font-bold text-[var(--texto-acierto)]">
            Listo: a {tocar.data.nombre} le saldrá que te acordaste.
          </p>
        )}
      </section>

      <Toques
        apagados={data.toquesApagados}
        quedan={data.toquesQueMeQuedan}
        guardando={recibirToques.isPending}
        onCambiar={(recibir) => recibirToques.mutate(recibir)}
      />

      <Seguimientos
        seguidos={data.seguidos}
        seguidores={data.seguidores}
        maximo={data.maximoSeguidos}
        ocupado={dejarDeSeguir.isPending || quitarSeguidor.isPending}
        onDejarDeSeguir={(id) => dejarDeSeguir.mutate(id)}
        onQuitarSeguidor={(id) => quitarSeguidor.mutate(id)}
      />
    </div>
  );
}

/**
 * Lo que se le puede hacer a un amigo: regalarle y darle un toque.
 *
 * EL TOQUE ES LO ÚNICO PELIGROSO DE ESTA PANTALLA
 *
 * Visto de cerca, «dar un toque» es mandarle a alguien un aviso que dice «me he
 * dado cuenta de que no estás cumpliendo». Por eso aquí NO se enseña en ningún
 * sitio quién lleva tiempo sin estudiar: el servidor tampoco lo manda, así que
 * no se puede elegir a quién tocar por estar flojo. El botón dice «Acordarme de
 * él» y no «recordarle que estudie», que es la diferencia entre un gesto y un
 * reproche.
 *
 * Y cuando no cabe otro toque, el botón se apaga con el motivo escrito: los
 * motivos son siempre MÍOS —ya le toqué esta semana, ya no me quedan hoy— y
 * nunca suyos. Si el botón dijera «te ha silenciado», silenciar costaría una
 * conversación y casi nadie lo usaría.
 */
function AccionesConUnAmigo({
  amigo,
  monedasDelRegalo,
  ocupado,
  onRegalar,
  onTocar,
  onSilenciar,
}: {
  amigo: Amigo;
  monedasDelRegalo: number;
  ocupado: boolean;
  onRegalar: () => void;
  onTocar: () => void;
  onSilenciar: (silenciados: boolean) => void;
}) {
  const motivos: Record<Amigo['motivoDelToque'], string> = {
    puedes: `Acordarte de ${amigo.displayName}`,
    'ya-le-toque': `Ya te acordaste de ${amigo.displayName} esta semana`,
    'sin-toques-hoy': 'Ya no te quedan toques hoy',
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--hueco)] pt-3">
      <button
        type="button"
        onClick={onRegalar}
        disabled={ocupado || !amigo.puedoRegalar}
        title={amigo.puedoRegalar ? undefined : 'Hoy ya le mandaste uno'}
        className="min-h-11 rounded-xl border-2 border-[var(--hueco)] px-3 text-xs font-bold hover:bg-[var(--fondo)] disabled:opacity-50"
      >
        <span aria-hidden>🎁</span> Regalar {monedasDelRegalo}
      </button>

      <button
        type="button"
        onClick={onTocar}
        disabled={ocupado || !amigo.puedoTocar}
        aria-label={motivos[amigo.motivoDelToque]}
        title={motivos[amigo.motivoDelToque]}
        className="min-h-11 rounded-xl border-2 border-[var(--hueco)] px-3 text-xs font-bold hover:bg-[var(--fondo)] disabled:opacity-50"
      >
        <span aria-hidden>👋</span> Un toque
      </button>

      <button
        type="button"
        onClick={() => onSilenciar(!amigo.toquesSilenciados)}
        disabled={ocupado}
        aria-pressed={amigo.toquesSilenciados}
        className="min-h-11 rounded-xl px-3 text-xs text-[var(--texto-suave)] underline underline-offset-4 hover:bg-[var(--fondo)] disabled:opacity-50"
      >
        {amigo.toquesSilenciados ? 'Volver a oír sus toques' : 'Silenciar sus toques'}
      </button>
    </div>
  );
}

/**
 * El interruptor general de los toques.
 *
 * Hermano del de «no quiero aparecer en la liga», que ya existía, y puesto en el
 * mismo sitio y con la misma forma a propósito: quien busque cómo apagar algo lo
 * va a buscar donde apagó lo otro.
 *
 * Dice además cuántos toques me quedan HOY. Es un dato mío sobre lo que yo puedo
 * hacer, no sobre nadie más, y enseñarlo es lo que hace que el límite se
 * entienda antes de chocar con él.
 */
function Toques({
  apagados,
  quedan,
  guardando,
  onCambiar,
}: {
  apagados: boolean;
  quedan: number;
  guardando: boolean;
  onCambiar: (recibir: boolean) => void;
}) {
  return (
    <section className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4">
      <h2 className="text-sm font-bold">Los toques</h2>
      <p className="mt-1 text-xs text-[var(--texto-suave)]">
        Un toque es un «me acordé de ti» que aparece en el muro de un amigo. No suena, no avisa y
        solo lo veis los dos. Puedes dar {quedan === 1 ? 'uno' : quedan} hoy, y solo uno por semana
        a la misma persona.
      </p>

      <button
        type="button"
        onClick={() => onCambiar(apagados)}
        disabled={guardando}
        aria-pressed={apagados}
        className="mt-3 min-h-12 rounded-xl px-4 text-sm text-[var(--texto-suave)] underline underline-offset-4 hover:bg-[var(--fondo)] disabled:opacity-60"
      >
        {apagados ? 'Volver a recibir toques' : 'No quiero recibir toques'}
      </button>

      {apagados && (
        <p className="text-xs text-[var(--texto-suave)]">
          No te llega ninguno. Quien te lo mande no se entera de que lo apagaste.
        </p>
      )}
    </section>
  );
}

/** A quién sigues y quién te sigue, con la forma de cortar por los dos lados. */
function Seguimientos({
  seguidos,
  seguidores,
  maximo,
  ocupado,
  onDejarDeSeguir,
  onQuitarSeguidor,
}: {
  seguidos: Seguido[];
  seguidores: Seguidor[];
  maximo: number;
  ocupado: boolean;
  onDejarDeSeguir: (id: string) => void;
  onQuitarSeguidor: (id: string) => void;
}) {
  if (seguidos.length === 0 && seguidores.length === 0) return null;

  return (
    <section className="grid gap-4">
      {seguidos.length > 0 && (
        <div>
          <h2 className="font-bold">
            Sigues a {seguidos.length} {seguidos.length === 1 ? 'persona' : 'personas'}
          </h2>
          <p className="mt-1 text-xs text-[var(--texto-suave)]">
            Ves lo que hacen en tus novedades. Caben {maximo}.
          </p>

          <ul className="mt-3 grid gap-2">
            {seguidos.map((quien) => (
              <li
                key={quien.seguimientoId}
                className="flex items-center gap-3 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{quien.displayName}</span>
                  <span className="block text-xs text-[var(--texto-suave)] tabular-nums">
                    {quien.xpSemana} XP esta semana
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onDejarDeSeguir(quien.seguimientoId)}
                  disabled={ocupado}
                  aria-label={`Dejar de seguir a ${quien.displayName}`}
                  className="min-h-11 shrink-0 rounded-xl px-3 text-xs text-[var(--texto-suave)] underline underline-offset-4 hover:bg-[var(--fondo)] disabled:opacity-60"
                >
                  Dejar de seguir
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {seguidores.length > 0 && (
        <div>
          <h2 className="font-bold">
            Te{' '}
            {seguidores.length === 1 ? 'sigue 1 persona' : `siguen ${seguidores.length} personas`}
          </h2>
          {/*
            Se enseña quién te sigue, y se puede quitar. Seguir va en un solo
            sentido, así que la única forma de que no sea vigilancia es que quien
            es seguido lo sepa y pueda cortarlo.
          */}
          <p className="mt-1 text-xs text-[var(--texto-suave)]">
            Ven tu nombre y lo que haces en sus novedades. Puedes quitarles.
          </p>

          <ul className="mt-3 grid gap-2">
            {seguidores.map((quien) => (
              <li
                key={quien.seguimientoId}
                className="flex items-center gap-3 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-3"
              >
                <span className="min-w-0 flex-1 truncate font-bold">{quien.displayName}</span>
                <button
                  type="button"
                  onClick={() => onQuitarSeguidor(quien.seguimientoId)}
                  disabled={ocupado}
                  aria-label={`Quitar a ${quien.displayName} de tus seguidores`}
                  className="min-h-11 shrink-0 rounded-xl px-3 text-xs text-[var(--texto-suave)] underline underline-offset-4 hover:bg-[var(--fondo)] disabled:opacity-60"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * El desafío con un amigo.
 *
 * DOS PERSONAS SUMANDO, NO COMPITIENDO
 *
 * Los dos empujan el mismo número hacia el mismo objetivo y el cofre se abre
 * para los dos o para ninguno. Si fuera un duelo, quien va perdiendo el jueves
 * ya no tendría motivo para estudiar el viernes, que es lo contrario de lo que
 * esta app quiere que pase. Por eso la barra es una sola y debajo se ve lo que
 * ha puesto cada uno: el que va más flojo es el que más falta hace.
 *
 * El objetivo lo pone el servidor a partir de lo que los dos hicieron la semana
 * pasada, y el cofre se abre solo al llegar. No hay botón de «reclamar»: un
 * premio ya ganado no se puede perder por no volver a tiempo.
 */
function DesafioConUnAmigo({ amigos }: { amigos: Amigo[] }) {
  const cliente = useQueryClient();
  const [aQuien, setAQuien] = useState('');

  const consulta = useQuery({
    queryKey: ['desafio'],
    queryFn: () => api.get<VistaDeDesafios>('/social/desafio'),
    retry: false,
  });

  const guardar = (vista: VistaDeDesafios) => {
    cliente.setQueryData(['desafio'], vista);
    void cliente.invalidateQueries({ queryKey: ['amigos'] });
  };

  const proponer = useMutation({
    mutationFn: (amistadId: string) => api.post<VistaDeDesafios>('/social/desafio', { amistadId }),
    onSuccess: guardar,
  });

  const contestar = useMutation({
    mutationFn: (datos: { id: string; acepto: boolean }) =>
      api.put<VistaDeDesafios>(`/social/desafio/${datos.id}`, { acepto: datos.acepto }),
    onSuccess: guardar,
  });

  if (consulta.isPending || consulta.isError || !consulta.data) return null;

  const { desafio, cofre, dias } = consulta.data;

  if (!desafio) {
    if (amigos.length === 0) return null;

    return (
      <section className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4">
        <h2 className="text-sm font-bold">Un desafío con alguien</h2>
        <p className="mt-1 text-xs text-[var(--texto-suave)]">
          Un objetivo de XP común para los dos durante {dias} días. Si llegáis, un cofre de {cofre}{' '}
          monedas para cada uno. El objetivo lo pongo yo según lo que hicisteis la semana pasada.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="desafio-amigo" className="sr-only">
            A quién desafías
          </label>
          <select
            id="desafio-amigo"
            value={aQuien}
            onChange={(evento) => setAQuien(evento.target.value)}
            className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-[var(--hueco)] bg-[var(--fondo)] px-3"
          >
            <option value="">Elige a quién</option>
            {amigos.map((amigo) => (
              <option key={amigo.amistadId} value={amigo.amistadId}>
                {amigo.displayName}
              </option>
            ))}
          </select>

          <Boton
            ancho={false}
            disabled={!aQuien || proponer.isPending}
            onClick={() => proponer.mutate(aQuien)}
            className="sm:w-auto sm:px-6"
          >
            {proponer.isPending ? 'Mandando…' : 'Desafiar'}
          </Boton>
        </div>

        {proponer.isError && (
          <div className="mt-3">
            <Aviso>{explicar(proponer.error)}</Aviso>
          </div>
        )}
      </section>
    );
  }

  if (desafio.estado === 'pendiente') {
    return (
      <section className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4">
        <h2 className="text-sm font-bold">
          {desafio.yoRete ? `Esperando a ${desafio.otro}` : `${desafio.otro} te propone un desafío`}
        </h2>
        <p className="mt-1 text-sm text-[var(--texto-suave)]">
          {desafio.objetivo} XP entre los dos en {dias} días. Si llegáis, {desafio.cofre} monedas
          para cada uno.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {!desafio.yoRete && (
            <Boton
              ancho={false}
              disabled={contestar.isPending}
              onClick={() => contestar.mutate({ id: desafio.id, acepto: true })}
              className="sm:w-auto sm:px-6"
            >
              Acepto
            </Boton>
          )}
          <button
            type="button"
            disabled={contestar.isPending}
            onClick={() => contestar.mutate({ id: desafio.id, acepto: false })}
            className="min-h-12 rounded-xl px-4 text-sm text-[var(--texto-suave)] underline underline-offset-4 hover:bg-[var(--fondo)] disabled:opacity-60"
          >
            {desafio.yoRete ? 'Retirarlo' : 'Ahora no'}
          </button>
        </div>

        {contestar.isError && (
          <div className="mt-3">
            <Aviso>{explicar(contestar.error)}</Aviso>
          </div>
        )}
      </section>
    );
  }

  const logrado = desafio.estado === 'logrado';
  const avance = Math.min(Math.round((desafio.llevan / desafio.objetivo) * 100), 100);

  return (
    <section
      className={cn(
        'rounded-2xl border-2 p-4',
        logrado
          ? 'border-acento-400 bg-acento-300/25'
          : 'border-[var(--hueco)] bg-[var(--superficie)]',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">
          <span aria-hidden>{logrado ? '🧰' : '🤝'}</span> Tú y {desafio.otro}
        </h2>
        <span className="text-xs text-[var(--texto-suave)] tabular-nums">
          {desafio.llevan} / {desafio.objetivo} XP
        </span>
      </div>

      {/*
        La barra es decorativa: el mismo número va escrito al lado en cifras,
        que es lo que lee un lector de pantalla y lo que sirve cuando la barra se
        queda en un pelo de ancho a 320 px.
      */}
      <div
        aria-hidden
        className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--fondo)] ring-1 ring-[var(--hueco)]"
      >
        <div
          className={cn('h-full rounded-full', logrado ? 'bg-acento-500' : 'bg-marca-600')}
          style={{ width: `${avance}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-[var(--texto-suave)] tabular-nums">
        Tú has puesto {desafio.loMio} XP · {desafio.otro}, {desafio.loSuyo} XP
      </p>

      {desafio.cofreNuevo !== null && (
        <p role="status" className="mt-3 text-sm font-bold">
          🧰 Llegasteis. {desafio.cofreNuevo} monedas para cada uno.
        </p>
      )}

      {!logrado && desafio.terminaEn && (
        <p className="mt-2 text-xs text-[var(--texto-suave)]">
          Acaba el {FORMATO_FIN.format(new Date(desafio.terminaEn))}.
        </p>
      )}
    </section>
  );
}
