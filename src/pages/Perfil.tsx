import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useContador } from '@/lib/contador';
import { Boton } from '@/components/Boton';
import { Birrete, Estrella, Llama } from '@/components/iconos';
import { Mascota } from '@/components/Mascota';
import { EnLoQueMasFallas } from '@/components/EnLoQueMasFallas';
import { Insignia } from '@/components/logros/Insignia';
import { ASPECTOS, type CodigoLogro } from '@/components/logros/aspecto';
import { MedallaDelMes } from '@/components/logros/MedallaDelMes';
import { RachaConAmigo } from '@/components/logros/RachaConAmigo';
import { useSesion } from '@/store/sesion';

interface DatosPerfil {
  email: string;
  displayName: string;
  nativeLanguage: string;
  timezone: string;
  dailyGoalMinutes: number;
  createdAt: string;
  level: { code: string; titleEs: string; cefr: string } | null;
}

/** Solo lo que pinta esta pantalla. La consulta la comparte con el panel de inicio. */
interface Progreso {
  xpTotal: number;
  xpHoy: number;
  leccionesCompletadas: number;
  racha: { currentDays: number; longestDays: number };
}

interface LogroEnPerfil {
  code: CodigoLogro;
  titulo: string;
  medida: string;
  cuenta: number;
  grado: number;
  gradoMaximo: number;
  metaDelGrado: number | null;
  metaSiguiente: number | null;
  unidad: [string, string];
  conseguidoEn: string | null;
}

interface MedallaDeMes {
  mes: string;
  dias: number;
  hacenFalta: number;
  ganada: boolean;
  enCurso: boolean;
}

interface RachaDeAmigo {
  amistadId: string;
  displayName: string;
  dias: number;
  mejor: number;
  viva: boolean;
}

interface VistaDeLogros {
  logros: LogroEnPerfil[];
  medallas: MedallaDeMes[];
  diasPorMedalla: number;
  rachasConAmigos: RachaDeAmigo[];
  ventanaDias: number;
  nuevos: Array<{ code: CodigoLogro; titulo: string; grado: number; meta: number }>;
}

const META_MINIMA = 5;
const META_MAXIMA = 120;

const FORMATO_FECHA = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const FORMATO_MES = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });

/**
 * Convierte un fallo de la API en algo que se pueda hacer.
 *
 * El 404 tiene su propio texto porque significa que ese endpoint todavía no
 * está desplegado, y decirle a alguien «revisa tu conexión» cuando lo que pasa
 * es que la función aún no existe le hace perder el rato buscando su fallo.
 */
function explicar(error: unknown, accion: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return `${accion} todavía no está disponible en el servidor. Inténtalo dentro de un rato.`;
    }
    return error.message;
  }
  return 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.';
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : FORMATO_FECHA.format(fecha);
}

/** «1 lección» / «27 lecciones», con el sustantivo que manda el servidor. */
function plural(cuantos: number, unidad: readonly [string, string]): string {
  return `${cuantos} ${cuantos === 1 ? unidad[0] : unidad[1]}`;
}

/**
 * El perfil: quién eres, qué llevas hecho y qué te propones al día.
 *
 * EL ORDEN, QUE ES LA DECISIÓN DE LA PANTALLA
 *
 * Arriba el resumen —racha, nivel y experiencia—, porque es lo que se viene a
 * mirar. Debajo, en este orden: las rachas con amigos, el calendario de
 * medallas y los logros. Va de lo que cambia hoy a lo que cambia en meses, que
 * es también de lo más vivo a lo más de archivo.
 *
 * Los ajustes —nombre, cuenta y meta diaria— se quedan al final. Se tocan una
 * vez al mes y estaban antes en medio de todo.
 *
 * LOS BLOQUES SE CAEN POR SEPARADO, A PROPÓSITO
 *
 * Son tres consultas distintas. Si `/logros` falla, siguen viéndose la racha y
 * los ajustes; si falla `/me/profile`, siguen viéndose las insignias. Una
 * pantalla que se queda en blanco entera porque una de tres cosas no cargó es
 * una pantalla que no sirve nunca.
 *
 * A 320 PX
 *
 * La rejilla de logros es lo apretado de aquí: dos columnas de 140 px con la
 * insignia de 64 px centrada y el texto debajo. Se probó a tres columnas y el
 * título se partía en cuatro líneas; a una, la pantalla medía dos pantallas y
 * media. El resumen de arriba va a tres columnas porque son tres cifras cortas,
 * y el calendario a cuatro porque un escudo de 56 px se reconoce por la forma
 * sin necesidad de leerlo.
 */
export function Perfil() {
  const navegar = useNavigate();
  const usuario = useSesion((estado) => estado.usuario);

  const consultaPerfil = useQuery({
    queryKey: ['perfil'],
    queryFn: () => api.get<DatosPerfil>('/me/profile'),
  });

  // Misma clave que el panel de inicio: entrar aquí no vuelve a pedir lo mismo.
  const consultaProgreso = useQuery({
    queryKey: ['progreso'],
    queryFn: () => api.get<Progreso>('/progress'),
  });

  const consultaLogros = useQuery({
    queryKey: ['logros'],
    queryFn: () => api.get<VistaDeLogros>('/logros'),
    retry: false,
  });

  const perfil = consultaPerfil.data;
  const progreso = consultaProgreso.data;
  const logros = consultaLogros.data;
  const nombre = perfil?.displayName ?? usuario?.displayName ?? 'Tu perfil';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Mascota estado="feliz" tamano={68} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-[var(--texto-suave)]">Tu perfil</p>
            <h1 className="truncate text-xl font-bold">{nombre}</h1>
          </div>
        </div>
        {/*
          Aquí había un «Volver». Desde que hay barra abajo, el perfil es una
          sección raíz —se entra desde cualquier sitio y se sale por la barra—,
          así que volver atrás ya no significa nada concreto.

          Lo que sí hacía falta es una puerta a los ajustes y a la seguridad, que
          cuelgan de la cuenta. Sin ella, la única entrada a `/menu` era la
          hamburguesa de la ruta, y el día que esa hamburguesa desaparezca se
          quedarían sin camino los ajustes, la seguridad y el botón de salir.
        */}
        <button
          type="button"
          onClick={() => navegar('/menu')}
          aria-label="Más opciones, ajustes y seguridad"
          className="-mr-2 min-h-12 shrink-0 rounded-xl px-3 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Más
        </button>
      </header>

      <Resumen progreso={progreso} perfil={perfil} error={consultaProgreso.error} />

      {/*
        En lo que más fallas, que antes vivía en la portada. Va aquí, pegado al
        resumen: lo que llevas hecho y lo que se te atraganta se leen juntos, y
        esta es la pantalla a la que se entra a mirarse, no la de cada día.
      */}
      <EnLoQueMasFallas />

      {logros && logros.nuevos.length > 0 && <LoNuevo nuevos={logros.nuevos} />}

      <RachasDeAmigos consulta={consultaLogros} />
      <Calendario consulta={consultaLogros} />
      <Logros consulta={consultaLogros} />

      {consultaPerfil.isPending && (
        <p className="mt-8 text-center text-[var(--texto-suave)]">Cargando tus datos…</p>
      )}

      {consultaPerfil.isError && (
        <div
          role="alert"
          className="mt-8 animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5"
          style={{ animationFillMode: 'backwards' }}
        >
          <h2 className="font-bold">No pudimos cargar tus datos</h2>
          <p className="mt-1 text-sm text-[var(--texto-suave)]">
            {explicar(consultaPerfil.error, 'Ver tu perfil')} Mientras tanto puedes seguir con tus
            lecciones con normalidad.
          </p>
          <Boton
            tono="suave"
            ancho={false}
            className="mt-4 min-h-12"
            onClick={() => void consultaPerfil.refetch()}
            disabled={consultaPerfil.isFetching}
          >
            {consultaPerfil.isFetching ? 'Reintentando…' : 'Reintentar'}
          </Boton>
        </div>
      )}

      {perfil && (
        <>
          <TarjetaNombre perfil={perfil} />
          <TarjetaCuenta perfil={perfil} />
          <TarjetaMeta perfil={perfil} />
        </>
      )}
    </div>
  );
}

/**
 * Racha, nivel y experiencia: las tres cifras de arriba.
 *
 * Tres y no cuatro. Son las que contestan «¿cómo voy?» sin pensar, y a 320 px
 * tres columnas dejan 90 px por cifra, que es lo justo para un número grande.
 * La cuarta que había antes —la racha más larga— se fue a la insignia de
 * constancia, que es donde significa algo: allí es un logro y aquí era un dato.
 */
function Resumen({
  progreso,
  perfil,
  error,
}: {
  progreso: Progreso | undefined;
  perfil: DatosPerfil | undefined;
  error: unknown;
}) {
  if (error) {
    return (
      <p className="mt-6 text-sm text-[var(--texto-suave)]">{explicar(error, 'Ver tu progreso')}</p>
    );
  }

  const dias = progreso?.racha.currentDays ?? 0;

  return (
    <section className="mt-6" aria-label="Tu resumen">
      <div className="grid grid-cols-3 gap-2">
        <Cifra
          icono={<Llama tamano={20} />}
          valor={dias}
          texto={dias === 1 ? 'día de racha' : 'días de racha'}
          etiqueta={`${dias} ${dias === 1 ? 'día de racha' : 'días de racha'}`}
          retraso={0}
        />
        <Cifra
          icono={<Birrete tamano={20} />}
          crudo={perfil?.level?.cefr ?? '—'}
          texto={perfil?.level ? 'tu nivel' : 'sin nivel'}
          etiqueta={
            perfil?.level
              ? `Tu nivel es ${perfil.level.titleEs}, ${perfil.level.cefr}`
              : 'Todavía no elegiste nivel'
          }
          retraso={70}
        />
        <Cifra
          icono={<Estrella tamano={20} />}
          valor={progreso?.xpTotal ?? 0}
          texto="de experiencia"
          etiqueta={`${progreso?.xpTotal ?? 0} de experiencia`}
          retraso={140}
        />
      </div>
    </section>
  );
}

/**
 * Una cifra del resumen, subiendo contando.
 *
 * El número que se ve queda oculto para quien escucha la página: el lector lee
 * la etiqueta, que ya trae el valor final, y no tres cifras seguidas mientras
 * la cuenta avanza.
 *
 * `crudo` es para lo que no es un número —el nivel—, que no se cuenta hacia
 * arriba porque «A2» no tiene por dónde subir.
 */
function Cifra({
  icono,
  valor,
  crudo,
  texto,
  etiqueta,
  retraso,
}: {
  icono: ReactNode;
  valor?: number;
  crudo?: string;
  texto: string;
  etiqueta: string;
  retraso: number;
}) {
  const contado = useContador(valor ?? 0);

  return (
    <div
      className="animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] px-2 py-3 text-center"
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      {/* El dibujo va centrado en su propia fila, como estaba el emoji. `flex`
          para que la caja mida el icono y no el renglón de texto. */}
      <p className="flex justify-center">{icono}</p>
      <p className="mt-1 truncate text-xl font-extrabold tabular-nums" aria-label={etiqueta}>
        <span aria-hidden>{crudo ?? contado}</span>
      </p>
      <p aria-hidden className="text-[0.65rem] leading-tight text-[var(--texto-suave)]">
        {texto}
      </p>
    </div>
  );
}

/**
 * Lo que se acaba de ganar.
 *
 * Es texto y no confeti. El servidor manda cada grado nuevo una sola vez, así
 * que esto aparece justo después de cruzarlo y no vuelve; y como es un aviso
 * escrito, quien pidió menos movimiento se entera exactamente igual que quien
 * no. Una celebración que solo existe si algo se mueve es una celebración que
 * alguna gente no recibe.
 */
function LoNuevo({ nuevos }: { nuevos: VistaDeLogros['nuevos'] }) {
  /*
    Se queda el grado más alto de cada logro. La primera visita de alguien que
    ya llevaba meses en la aplicación otorga todos los escalones de golpe, y
    anunciar «Lecciones 1, Lecciones 2, Lecciones 3» sería leerle la escalera
    en vez de darle la noticia, que es que ya va por el tercero.
  */
  const cumbres = new Map<string, VistaDeLogros['nuevos'][number]>();
  for (const uno of nuevos) {
    const antes = cumbres.get(uno.code);
    if (!antes || uno.grado > antes.grado) cumbres.set(uno.code, uno);
  }

  const lista = [...cumbres.values()];

  return (
    <p
      role="status"
      className="mt-4 rounded-2xl border-2 border-acento-400 bg-acento-300/25 px-4 py-3 text-sm font-bold"
    >
      {lista.length === 1
        ? `¡Nuevo! Has ganado «${lista[0]!.titulo}», grado ${lista[0]!.grado}.`
        : `¡Nuevo! ${lista.length} insignias: ${lista
            .map((uno) => `${uno.titulo} (grado ${uno.grado})`)
            .join(', ')}.`}
    </p>
  );
}

/** Un título de sección, con su cuentita al lado cuando hay algo que contar. */
function Titulo({ children, nota }: { children: string; nota?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
        {children}
      </h2>
      {nota && <span className="shrink-0 text-xs text-[var(--texto-suave)]">{nota}</span>}
    </div>
  );
}

/**
 * Las rachas con los amigos.
 *
 * Va antes que las medallas y los logros porque es lo único de esta pantalla
 * que cambia hoy y porque es lo que trae a alguien de vuelta. Va DESPUÉS del
 * resumen, y no arriba del todo, por lo mismo que no hay avisos: este perfil es
 * primero tuyo y luego de con quién lo compartes.
 */
function RachasDeAmigos({
  consulta,
}: {
  consulta: ReturnType<typeof useQuery<VistaDeLogros, Error>>;
}) {
  const navegar = useNavigate();
  const { data, isPending, isError, error } = consulta;

  if (isPending) {
    return (
      <section className="mt-8">
        <Titulo>Rachas con amigos</Titulo>
        <p className="mt-3 text-sm text-[var(--texto-suave)]">Contando los días…</p>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="mt-8">
        <Titulo>Rachas con amigos</Titulo>
        <p className="mt-3 text-sm text-[var(--texto-suave)]">
          {explicar(error, 'Ver tus logros')}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <Titulo>Rachas con amigos</Titulo>

      {data.rachasConAmigos.length === 0 ? (
        /*
          El caso del primer día. No se enseña una lista vacía ni un hueco: se
          dice qué es esto y por dónde se empieza, porque un perfil recién hecho
          sin amigos es el estado normal de todo el mundo al principio.
        */
        <div className="mt-3 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4">
          <p className="text-sm text-[var(--texto-suave)]">
            Cuando alguien de tu lista y tú practiquéis el mismo día, aquí aparecerán los días que
            lleváis juntos. No pasa nada si un día falta uno: la cuenta aguanta.
          </p>
          <Boton
            tono="suave"
            ancho={false}
            className="mt-3 min-h-12"
            onClick={() => navegar('/liga')}
          >
            Añadir a alguien
          </Boton>
        </div>
      ) : (
        <>
          <ul className="mt-3 grid gap-2">
            {data.rachasConAmigos.map((amigo) => (
              <RachaConAmigo key={amigo.amistadId} {...amigo} />
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--texto-suave)]">
            Cuenta los días en que practicasteis los dos. Si un día falta uno, la cuenta aguanta; si
            faltan dos seguidos, se termina y queda vuestro récord de los últimos {data.ventanaDias}{' '}
            días.
          </p>
        </>
      )}
    </section>
  );
}

/** El calendario de medallas: un mes por escudo, del más reciente al más viejo. */
function Calendario({ consulta }: { consulta: ReturnType<typeof useQuery<VistaDeLogros, Error>> }) {
  const { data } = consulta;
  if (!data) return null;

  const ganadas = data.medallas.filter((mes) => mes.ganada).length;

  return (
    <section className="mt-8">
      <Titulo nota={ganadas === 1 ? '1 ganada' : `${ganadas} ganadas`}>Tus meses</Titulo>

      <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {data.medallas.map((mes) => (
          <MedallaDelMes key={mes.mes} {...mes} />
        ))}
      </ul>

      <p className="mt-3 text-xs text-[var(--texto-suave)]">
        Un mes se gana practicando {data.diasPorMedalla} días, que son unos tres por semana. Los
        meses flojos también salen: esto es lo que hiciste, no una nota.
      </p>
    </section>
  );
}

/** La rejilla de insignias. Todas salen siempre, ganadas y sin ganar. */
function Logros({ consulta }: { consulta: ReturnType<typeof useQuery<VistaDeLogros, Error>> }) {
  const { data, isPending } = consulta;

  if (isPending) {
    return (
      <section className="mt-8">
        <Titulo>Tus logros</Titulo>
        <p className="mt-3 text-sm text-[var(--texto-suave)]">Contando lo que llevas…</p>
      </section>
    );
  }

  if (!data) return null;

  const ganados = data.logros.reduce((suma, logro) => suma + logro.grado, 0);
  const posibles = data.logros.reduce((suma, logro) => suma + logro.gradoMaximo, 0);

  return (
    <section className="mt-8">
      <Titulo nota={`${ganados} de ${posibles}`}>Tus logros</Titulo>

      {/*
        Dos columnas y no tres. A 320 px, tres dejan 88 px por tarjeta y
        «Conversaciones enteras» se parte en cuatro líneas; con dos hay 140 px y
        entra en dos. En pantallas anchas se pasa a tres, que es cuando el
        título deja de partirse.
      */}
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.logros.map((logro, indice) => (
          <TarjetaDeLogro key={logro.code} logro={logro} retraso={indice * 60} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Una insignia con todo lo que hay que saber de ella, escrito.
 *
 * No se pulsa. Se pensó abrir un detalle al tocarla, como hacen otras
 * aplicaciones, y se descartó: lo que ese detalle diría —qué mide y cuánto
 * falta— cabe en la propia tarjeta, y así no hay nada que alcanzar con el
 * teclado ni nada que se quede escondido para quien no sepa que ahí se pulsa.
 */
function TarjetaDeLogro({ logro, retraso }: { logro: LogroEnPerfil; retraso: number }) {
  const aspecto = ASPECTOS[logro.code];
  const ganado = logro.grado > 0;

  /*
    Cuánto del siguiente grado se lleva. Se mide DESDE el grado anterior y no
    desde cero: con 190 de 200 después de haber pasado los 75, un anillo desde
    cero estaría casi lleno desde el principio y no se movería en semanas.
  */
  const suelo = logro.metaDelGrado ?? 0;
  const techo = logro.metaSiguiente;
  const avance =
    techo === null ? 1 : Math.min(1, Math.max(0, (logro.cuenta - suelo) / (techo - suelo)));

  const falta = techo === null ? null : Math.max(techo - logro.cuenta, 0);

  return (
    <li
      className={cn(
        'flex animate-entrada flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center',
        ganado ? cn(aspecto.borde, aspecto.tinte) : 'border-[var(--hueco)] bg-[var(--superficie)]',
      )}
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <Insignia code={logro.code} grado={logro.grado} avance={avance} />

      <p className="text-xs font-extrabold leading-tight">{logro.titulo}</p>

      {/*
        La cifra grande. Es lo que se viene a mirar, y lleva su unidad escrita
        al lado para que «27» no sea un número suelto sin sustantivo.
      */}
      <p className="text-base font-extrabold leading-none tabular-nums">
        {logro.cuenta}
        <span className="ml-1 text-[0.65rem] font-bold text-[var(--texto-suave)]">
          {logro.cuenta === 1 ? logro.unidad[0] : logro.unidad[1]}
        </span>
      </p>

      {/*
        La barra del siguiente grado, con su número al lado. La barra no dice
        nada que no diga el texto de debajo; está para poder comparar seis
        logros de un vistazo sin leer seis frases.
      */}
      <div
        aria-hidden
        className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[var(--hueco)]', aspecto.color)}
      >
        <div
          className={cn('h-full rounded-full bg-current', !ganado && 'opacity-70')}
          style={{ width: `${Math.round(avance * 100)}%` }}
        />
      </div>

      <p className="text-[0.65rem] leading-tight text-[var(--texto-suave)]">
        {techo === null ? (
          <span className="font-bold">Grado máximo</span>
        ) : (
          <>
            {ganado ? `Grado ${logro.grado} de ${logro.gradoMaximo}. ` : ''}
            Te {falta === 1 ? 'falta' : 'faltan'} {plural(falta ?? 0, logro.unidad)}
          </>
        )}
      </p>

      {/*
        Cuándo se ganó. Es lo que convierte una cifra en un recuerdo, que es de
        lo que va todo esto. Solo el mes: el día exacto no le importa a nadie y
        en 140 px no cabe.
      */}
      {logro.conseguidoEn && (
        <p className="text-[0.6rem] text-[var(--texto-suave)]">
          en {FORMATO_MES.format(new Date(logro.conseguidoEn))}
        </p>
      )}

      <span className="sr-only">{logro.medida}</span>
    </li>
  );
}

/**
 * El nombre, editable donde se lee.
 *
 * Si el guardado falla, el borrador se queda escrito y el campo sigue abierto:
 * lo último que quiere alguien a quien acaba de fallarle el servidor es volver
 * a teclear lo mismo.
 */
function TarjetaNombre({ perfil }: { perfil: DatosPerfil }) {
  const clienteConsultas = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(perfil.displayName);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: (displayName: string) => api.patch<DatosPerfil>('/me/profile', { displayName }),
    onSuccess: (actualizado) => {
      clienteConsultas.setQueryData(['perfil'], actualizado);

      // La cabecera de la ruta y el saludo leen el nombre de la sesión, no de
      // esta consulta. Sin esto, el perfil enseñaría el nombre nuevo y el resto
      // de la app el viejo hasta la próxima recarga.
      const usuario = useSesion.getState().usuario;
      if (usuario) {
        useSesion.getState().setSesion({ ...usuario, displayName: actualizado.displayName });
      }

      setEditando(false);
    },
  });

  function abrir() {
    setBorrador(perfil.displayName);
    setErrorLocal(null);
    guardar.reset();
    setEditando(true);
  }

  function cancelar() {
    setEditando(false);
    setErrorLocal(null);
    guardar.reset();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const limpio = borrador.trim();

    if (limpio.length < 2) {
      setErrorLocal('Escribe al menos dos letras para que sepamos cómo llamarte.');
      return;
    }
    if (limpio.length > 80) {
      setErrorLocal('Ese nombre es demasiado largo. Deja como mucho 80 letras.');
      return;
    }

    setErrorLocal(null);
    guardar.mutate(limpio);
  }

  const errorServidor = guardar.error
    ? (guardar.error instanceof ApiError && guardar.error.fieldErrors.displayName) ||
      explicar(guardar.error, 'Cambiar tu nombre')
    : null;
  const error = errorLocal ?? errorServidor;

  return (
    <section className="mt-8 rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5">
      {editando ? (
        <form onSubmit={enviar} noValidate>
          <label htmlFor="perfil-nombre" className="text-sm font-medium">
            ¿Cómo quieres que te llamemos?
          </label>
          <input
            id="perfil-nombre"
            type="text"
            value={borrador}
            onChange={(evento) => setBorrador(evento.target.value)}
            autoComplete="given-name"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'perfil-nombre-error' : undefined}
            className={cn(
              'mt-1.5 min-h-12 w-full rounded-xl border bg-[var(--fondo)] px-4 py-3 text-base outline-none transition',
              error
                ? 'border-[var(--color-fallo)]'
                : 'border-[var(--borde)] focus:border-marca-500',
            )}
          />

          {error && (
            <p
              id="perfil-nombre-error"
              role="alert"
              className="mt-1.5 text-sm text-[var(--texto-fallo)]"
            >
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Boton type="submit" disabled={guardar.isPending} className="min-h-12">
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Boton>
            <Boton
              type="button"
              tono="suave"
              onClick={cancelar}
              disabled={guardar.isPending}
              className="min-h-12"
            >
              Cancelar
            </Boton>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
              Tu nombre
            </p>
            <p className="mt-1 truncate text-lg font-bold">{perfil.displayName}</p>
          </div>
          <Boton
            type="button"
            tono="suave"
            ancho={false}
            onClick={abrir}
            className="min-h-12 shrink-0"
          >
            Cambiar
          </Boton>
        </div>
      )}
    </section>
  );
}

/** Los datos que no se tocan desde aquí: correo, nivel y antigüedad. */
function TarjetaCuenta({ perfil }: { perfil: DatosPerfil }) {
  return (
    <section className="mt-3 rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5">
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
        Tu cuenta
      </h2>

      <dl className="mt-3 grid gap-3">
        <Fila termino="Correo" valor={perfil.email} />
        <Fila
          termino="Nivel que cursas"
          valor={
            perfil.level
              ? `${perfil.level.titleEs} · ${perfil.level.cefr}`
              : 'Todavía no elegiste nivel'
          }
        />
        <Fila termino="Tu cuenta es de" valor={formatearFecha(perfil.createdAt)} />
      </dl>
    </section>
  );
}

function Fila({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className="text-sm text-[var(--texto-suave)]">{termino}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{valor}</dd>
    </div>
  );
}

/**
 * La meta diaria en minutos.
 *
 * Se guarda con su propio botón y no al soltar el campo: una meta que se
 * guardara sola mientras escribes «30» pasaría antes por 3 minutos.
 */
function TarjetaMeta({ perfil }: { perfil: DatosPerfil }) {
  const clienteConsultas = useQueryClient();
  const [minutos, setMinutos] = useState(String(perfil.dailyGoalMinutes));
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [guardada, setGuardada] = useState(false);

  const guardar = useMutation({
    mutationFn: (dailyGoalMinutes: number) =>
      api.patch<DatosPerfil>('/me/profile', { dailyGoalMinutes }),
    onSuccess: (actualizado) => {
      clienteConsultas.setQueryData(['perfil'], actualizado);
      setMinutos(String(actualizado.dailyGoalMinutes));
      setGuardada(true);
    },
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setGuardada(false);

    const valor = Number(minutos);
    if (!Number.isInteger(valor) || valor < META_MINIMA || valor > META_MAXIMA) {
      setErrorLocal(
        `Escribe minutos enteros entre ${META_MINIMA} y ${META_MAXIMA}. Con 10 al día ya se avanza.`,
      );
      return;
    }

    setErrorLocal(null);
    guardar.mutate(valor);
  }

  const errorServidor = guardar.error
    ? (guardar.error instanceof ApiError && guardar.error.fieldErrors.dailyGoalMinutes) ||
      explicar(guardar.error, 'Cambiar tu meta diaria')
    : null;
  const error = errorLocal ?? errorServidor;
  const sinCambios = Number(minutos) === perfil.dailyGoalMinutes;

  return (
    <section className="mt-3 rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5">
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
        Tu meta diaria
      </h2>

      <form onSubmit={enviar} className="mt-3" noValidate>
        <label htmlFor="perfil-meta" className="text-sm">
          Minutos que quieres practicar cada día
        </label>

        <div className="mt-1.5 flex flex-wrap items-start gap-2">
          <input
            id="perfil-meta"
            type="number"
            inputMode="numeric"
            min={META_MINIMA}
            max={META_MAXIMA}
            step={5}
            value={minutos}
            onChange={(evento) => {
              setMinutos(evento.target.value);
              setGuardada(false);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'perfil-meta-error' : 'perfil-meta-ayuda'}
            className={cn(
              'min-h-12 w-28 rounded-xl border bg-[var(--fondo)] px-4 py-3 text-base tabular-nums outline-none transition',
              error
                ? 'border-[var(--color-fallo)]'
                : 'border-[var(--borde)] focus:border-marca-500',
            )}
          />
          <Boton
            type="submit"
            ancho={false}
            disabled={guardar.isPending || sinCambios}
            className="min-h-12"
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar meta'}
          </Boton>
        </div>

        {error ? (
          <p id="perfil-meta-error" role="alert" className="mt-2 text-sm text-[var(--texto-fallo)]">
            {error}
          </p>
        ) : (
          <p id="perfil-meta-ayuda" className="mt-2 text-xs text-[var(--texto-suave)]">
            Entre {META_MINIMA} y {META_MAXIMA} minutos.{' '}
            {guardada && <span className="text-[var(--texto-acierto)]">Meta guardada.</span>}
          </p>
        )}
      </form>
    </section>
  );
}
