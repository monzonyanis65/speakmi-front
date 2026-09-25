import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { MascotaConMensaje } from '@/components/Mascota';
import { Aviso } from '@/components/juegos/Tablero';

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
 */

interface FilaDeLiga {
  displayName: string;
  xp: number;
  puesto: number;
  soyYo: boolean;
}

interface VistaDeLaLiga {
  semana: { empiezaEn: string; terminaEn: string };
  estado: 'viva' | 'faltan' | 'fuera';
  participantes: number;
  minimo: number;
  tabla: FilaDeLiga[];
  miPuesto: number | null;
  miXp: number;
  tuSemanaPasada: {
    xp: number;
    puesto: number | null;
    participantes: number | null;
    monedas: number | null;
  };
  premioNuevo: { puesto: number; monedas: number } | null;
}

interface Amigo {
  amistadId: string;
  displayName: string;
  xpSemana: number;
  racha: number;
}

interface VistaDeAmigos {
  codigo: string;
  maximo: number;
  yo: { displayName: string; xpSemana: number; racha: number };
  amigos: Amigo[];
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
          🏆 La semana pasada acabaste {ordinal(data.premioNuevo.puesto)} y ganaste{' '}
          {data.premioNuevo.monedas} monedas.
        </p>
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
  const faltan = Math.max(datos.minimo - datos.participantes, 0);

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
        {datos.participantes === 0
          ? 'todavía no ha sumado XP nadie'
          : datos.participantes === 1
            ? 'ha sumado XP una persona'
            : `han sumado XP ${datos.participantes} personas`}
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
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">Esta semana</h2>
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

  const invalidar = async () => {
    await cliente.invalidateQueries({ queryKey: ['amigos'] });
    await cliente.invalidateQueries({ queryKey: ['liga'] });
  };

  const anadir = useMutation({
    mutationFn: (escrito: string) =>
      api.post<{ nombre: string }>('/social/amigos', { codigo: escrito }),
    onSuccess: async () => {
      setCodigo('');
      await invalidar();
    },
  });

  const quitar = useMutation({
    mutationFn: (amistadId: string) => api.delete<void>(`/social/amigos/${amistadId}`),
    onSuccess: invalidar,
  });

  const rotar = useMutation({
    mutationFn: () => api.post<{ codigo: string }>('/social/codigo'),
    onSuccess: invalidar,
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
    { amistadId: 'yo', ...data.yo, soyYo: true },
    ...data.amigos.map((amigo) => ({ ...amigo, soyYo: false })),
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
          Pásaselo a quien quieras. Quien lo tenga puede añadirte y ver tu nombre y tu XP de la
          semana. Nadie ve tu correo.
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

      <form
        onSubmit={enviar}
        className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4"
      >
        <label htmlFor="codigo-amigo" className="text-sm font-bold">
          Añadir a alguien
        </label>
        <p className="mt-1 text-xs text-[var(--texto-suave)]">
          Escribe su código. Da igual con guion o sin él.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="codigo-amigo"
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
            {anadir.isPending ? 'Añadiendo…' : 'Añadir'}
          </Boton>
        </div>

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
                  'flex items-center gap-3 rounded-2xl border-2 p-3',
                  quien.soyYo
                    ? 'border-marca-400 bg-marca-50 dark:border-marca-600 dark:bg-marca-900/50'
                    : 'border-[var(--hueco)] bg-[var(--superficie)]',
                )}
              >
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
              </li>
            ))}
          </ul>
        )}

        {quitar.isError && (
          <div className="mt-3">
            <Aviso>{explicar(quitar.error)}</Aviso>
          </div>
        )}
      </section>
    </div>
  );
}
