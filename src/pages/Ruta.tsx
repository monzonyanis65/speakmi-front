import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSesion } from '@/store/sesion';
import { PanelInicio } from '@/components/PanelInicio';
import { NivelVacio } from '@/components/NivelVacio';
import { MascotaConMensaje } from '@/components/Mascota';
import { NodoLeccion, type EstadoNodo } from '@/components/NodoLeccion';

interface EstadoExamen {
  levelCode: string | null;
  leccionesHechas: number;
  leccionesTotales: number;
  desbloqueado: boolean;
  /** Si el nivel tiene examen escrito. Un nivel nuevo puede no tenerlo todavía. */
  hayExamen: boolean;
  aprobado: boolean;
  intentos: number;
  enCurso: boolean;
  ultimo: { score: number; answered: number; minimo: number; aprobado: boolean } | null;
  cursoTerminado: boolean;
}

interface Leccion {
  code: string;
  titleEs: string;
  type: string;
  estMinutes: number;
  xpReward: number;
  exercisesCount: number;
  /** Solo llega si hay sesión. Sin ella se pintan todas como pendientes. */
  completed?: boolean;
}

interface Unidad {
  code: string;
  titleEs: string;
  titleEn: string;
  canDoStatements: string[];
  lessons: Leccion[];
}

interface RespuestaNivel {
  level: { code: string; titleEs: string; cefr: string };
  units: Unidad[];
}

const ICONO: Record<string, string> = {
  vocab: '📖',
  grammar: '🧩',
  reading: '📰',
  listening: '🎧',
  speaking: '🎤',
  conversation: '💬',
  review: '🔄',
  checkpoint: '🏁',
};

const NOMBRE_TIPO: Record<string, string> = {
  vocab: 'Vocabulario',
  grammar: 'Gramática',
  reading: 'Lectura',
  listening: 'Escucha',
  speaking: 'Hablar',
  conversation: 'Conversación',
  review: 'Repaso',
  checkpoint: 'Prueba de unidad',
};

/**
 * El saludo de Milo, con el título de la primera unidad dentro.
 *
 * Muchos títulos son preguntas («¿Cómo te llamas?»), así que no se les puede
 * pegar un punto detrás ni bajarles la mayúscula sin más: quedaba «Hoy toca
 * ¿cómo te llamas?.». Se entrecomilla y se respeta tal cual está escrito.
 */
function saludo(titulo?: string): string {
  if (!titulo) return '¡Hola de nuevo! Vamos a practicar un rato.';
  return `¡Hola de nuevo! Hoy toca «${titulo}».`;
}

/**
 * Cuál es la lección por la que toca seguir, en todo el nivel.
 *
 * Una sola en toda la pantalla, no una por unidad: el cartel de «empezar» deja
 * de significar nada si aparece cuatro veces. Es la primera sin hacer leyendo
 * de arriba abajo.
 */
function codigoActual(unidades: Unidad[]): string | null {
  for (const unidad of unidades) {
    const pendiente = unidad.lessons.find((leccion) => !leccion.completed);
    if (pendiente) return pendiente.code;
  }
  return null;
}

/**
 * En qué estado se pinta una lección.
 *
 * El curso va en orden: solo se abre la siguiente sin hacer. Lo de más adelante
 * queda cerrado con candado, a la vista pero sin poder tocarlo.
 *
 * Esto se decidió al revés al principio, dejándolo todo abierto para no tratar
 * a un adulto como si no supiera qué repasar. La contra pesa más: sin orden se
 * salta uno lo que le cuesta, que es justo lo que había que practicar. Lo ya
 * hecho sí se puede repetir cuantas veces se quiera.
 */
function estadoDe(leccion: Leccion, actual: string | null): EstadoNodo {
  if (leccion.completed) return 'hecha';
  return leccion.code === actual ? 'actual' : 'bloqueada';
}

/**
 * Cuánto se aparta del centro cada nodo, entre -1 y 1.
 *
 * Es un ciclo de ocho: centro, derecha, tope, derecha, centro, izquierda, tope,
 * izquierda. Da una curva suave en vez del zigzag de ida y vuelta, que marea
 * cuando hay veinte lecciones seguidas.
 */
function desvioDe(indice: number): number {
  const CICLO = [0, 0.7, 1, 0.7, 0, -0.7, -1, -0.7];
  return CICLO[indice % CICLO.length] ?? 0;
}

/**
 * Cuántas lecciones hay antes de una unidad.
 *
 * El serpenteo se cuenta sobre el nivel entero. Si cada unidad reiniciara el
 * ciclo, todas las curvas saldrían iguales y siempre hacia el mismo lado, que
 * es justo lo contrario de un camino.
 */
function leccionesAntes(unidades: Unidad[], hasta: number): number {
  return unidades.slice(0, hasta).reduce((total, unidad) => total + unidad.lessons.length, 0);
}

/** La pantalla principal: qué hay por delante en tu nivel. */
export function Ruta() {
  const navegar = useNavigate();
  const usuario = useSesion((estado) => estado.usuario);

  const { data: nivelActivo, isPending: buscandoNivel } = useQuery({
    queryKey: ['mi-nivel'],
    queryFn: () => api.get<{ level: { levelCode: string } | null }>('/me/level'),
  });

  const codigoNivel = nivelActivo?.level?.levelCode;

  const { data, isPending, isError } = useQuery({
    queryKey: ['nivel', codigoNivel],
    queryFn: () => api.get<RespuestaNivel>(`/curriculum/levels/${codigoNivel!}`),
    enabled: Boolean(codigoNivel),
  });

  // El examen del final. Va en consulta aparte porque cambia por su cuenta —se
  // abre al terminar la última lección— y porque el temario se puede cachear y
  // esto no.
  const { data: examen } = useQuery({
    queryKey: ['examen', 'estado', codigoNivel],
    queryFn: () => api.get<EstadoExamen>('/exam'),
    enabled: Boolean(codigoNivel),
  });

  // Sin nivel no hay ruta que enseñar, así que se vuelve a elegirlo. Esto pasa
  // si alguien entra por la barra de direcciones antes de haberlo escogido.
  useEffect(() => {
    if (nivelActivo && !nivelActivo.level) navegar('/empezar', { replace: true });
  }, [nivelActivo, navegar]);

  // Una consulta apagada se queda en «pending» para siempre, y eso dejaba el
  // «Cargando tu ruta…» clavado en pantalla. Solo se espera cuando de verdad
  // hay algo en camino.
  const cargando = buscandoNivel || (Boolean(codigoNivel) && isPending);

  // Dónde se retoma. Se calcula una vez para toda la pantalla.
  const actual = codigoActual(data?.units ?? []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--texto-suave)]">Hola, {usuario?.displayName}</p>
          <h1 className="truncate text-xl font-bold">
            {data?.level.titleEs ?? 'Tu ruta'}
            {data && (
              <span className="ml-2 rounded-full bg-[var(--superficie)] px-2 py-0.5 text-xs font-medium text-[var(--texto-suave)]">
                {data.level.cefr}
              </span>
            )}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navegar('/menu')}
          aria-label="Tu cuenta"
          className="-mr-2 flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          <span aria-hidden className="text-xl">
            ☰
          </span>
        </button>
      </header>

      {/*
        En pantalla ancha, el saludo y el panel se van a una columna lateral y la
        ruta ocupa la principal. En móvil siguen uno encima de otro.
      */}
      <div className="mt-5 lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8">
        <div className="lg:order-2 lg:sticky lg:top-6">
          <MascotaConMensaje estado="feliz" mensaje={saludo(data?.units[0]?.titleEs)} />
          <div className="mt-5">
            <PanelInicio />
          </div>
        </div>

        <div className="lg:order-1 lg:min-w-0">
          {cargando && (
            <p className="mt-10 text-center text-[var(--texto-suave)]">Cargando tu ruta…</p>
          )}

          {isError && (
            <p role="alert" className="mt-10 text-center text-[var(--texto-fallo)]">
              No pudimos cargar tu ruta. Inténtalo de nuevo en un momento.
            </p>
          )}

          {data?.units.length === 0 && (
            <NivelVacio {...(codigoNivel ? { nivel: codigoNivel } : {})} />
          )}

          <div className="mt-8 grid min-w-0 gap-8 lg:mt-0">
            {data?.units.map((unidad, iUnidad) => (
              <section key={unidad.code} className="min-w-0">
                <div className="animate-entrada rounded-2xl border-b-4 border-marca-800 bg-marca-600 p-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-marca-100">
                        {unidad.code.replace('-', ' · ')}
                      </p>
                      <h2 className="mt-1 text-lg font-bold">{unidad.titleEs}</h2>
                    </div>

                    {/* La salida a las reglas explicadas. Va aquí, junto al
                        título, porque es donde se mira cuando uno no entiende
                        de qué va la unidad. */}
                    <button
                      type="button"
                      onClick={() => navegar(`/guia/${unidad.code}`)}
                      // Blanco con letra de marca, no un morado sobre otro morado: dos
                      // tonos vecinos de la misma familia no llegan al contraste
                      // mínimo y el botón se pierde dentro de la cabecera.
                      className="boton-3d min-h-11 shrink-0 rounded-xl border-2 border-marca-200 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-marca-700 hover:bg-marca-50"
                    >
                      Guía
                    </button>
                  </div>
                  {unidad.canDoStatements.length > 0 && (
                    <ul className="mt-3 grid gap-1.5">
                      {unidad.canDoStatements.map((frase) => (
                        <li key={frase} className="flex gap-2 text-sm text-marca-50">
                          <span aria-hidden>✓</span>
                          <span>{frase}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* La línea de puntos va detrás y sujeta visualmente el camino:
                    sin ella los nodos parecen sueltos en vez de un recorrido. */}
                <ol className="relative mt-6 grid min-w-0 justify-items-center gap-5 before:absolute before:inset-y-4 before:left-1/2 before:-z-10 before:w-0.5 before:-translate-x-1/2 before:border-l-4 before:border-dotted before:border-[var(--borde)]">
                  {unidad.lessons.map((leccion, indice) => (
                    <NodoLeccion
                      key={leccion.code}
                      titulo={leccion.titleEs}
                      tipo={NOMBRE_TIPO[leccion.type] ?? leccion.type}
                      icono={ICONO[leccion.type] ?? '📘'}
                      estado={estadoDe(leccion, actual)}
                      desvio={desvioDe(leccionesAntes(data.units, iUnidad) + indice)}
                      retraso={indice * 70}
                      onAbrir={() => navegar(`/leccion/${leccion.code}`)}
                    />
                  ))}
                </ol>
              </section>
            ))}

            {data && data.units.length > 0 && examen && (
              <ExamenDelNivel estado={examen} onAbrir={() => navegar('/examen')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * El final del camino.
 *
 * Antes no había nada aquí: se terminaba la última lección del nivel y la ruta
 * se acababa sin más, como una escalera que da a una pared. Ahora hay una
 * puerta, y se ve desde el principio aunque esté cerrada: saber que al final hay
 * un examen cambia cómo se hacen las veinte lecciones de antes.
 */
function ExamenDelNivel({ estado, onAbrir }: { estado: EstadoExamen; onAbrir: () => void }) {
  const navegar = useNavigate();
  const faltan = Math.max(0, estado.leccionesTotales - estado.leccionesHechas);

  /*
    Un nivel puede tener sus cuatro unidades escritas y todavía no tener examen:
    el contenido se escribe nivel a nivel y el banco de preguntas va detrás. Sin
    este caso, quien terminara ese nivel vería «te quedan 0 lecciones» para
    siempre y se quedaría encerrado en él. Mientras el examen no exista, se dice
    y se deja pasar a mano, que es como se pasaba antes de que hubiera examen.
  */
  if (!estado.hayExamen) {
    return (
      <section className="min-w-0 rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] p-5">
        <h2 className="text-lg font-bold">Final del nivel</h2>
        <p className="mt-2 text-sm text-[var(--texto-suave)]">
          Este nivel todavía no tiene examen. Cuando termines sus lecciones puedes pasar al
          siguiente tú mismo.
        </p>
        <button
          type="button"
          onClick={() => navegar('/nivel')}
          className="mt-4 min-h-11 rounded-xl border border-[var(--borde)] px-4 py-2 text-sm font-medium transition hover:border-marca-400"
        >
          Elegir otro nivel
        </button>
      </section>
    );
  }

  const nodo: EstadoNodo = estado.aprobado ? 'hecha' : estado.desbloqueado ? 'actual' : 'bloqueada';

  return (
    <section className="min-w-0">
      <div className="animate-entrada rounded-2xl border-b-4 border-slate-900 bg-slate-800 p-5 text-white dark:border-black dark:bg-slate-900">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
          Final del nivel
        </p>
        <h2 className="mt-1 text-lg font-bold">Examen del nivel</h2>
        <p className="mt-2 text-sm text-slate-200">
          {estado.aprobado
            ? estado.cursoTerminado
              ? 'Lo aprobaste, y con él el curso entero.'
              : 'Aprobado. Ya estás en el nivel siguiente.'
            : estado.desbloqueado
              ? 'Doce preguntas de todo el nivel, con material que no has visto en las lecciones. Hay que acertar tres de cada cuatro.'
              : `Se abre cuando termines las ${estado.leccionesTotales} lecciones. Te ${
                  faltan === 1 ? 'queda' : 'quedan'
                } ${faltan}.`}
        </p>

        {/*
          Cómo fue la última vez, con el número que hacía falta al lado. Un
          «suspendiste» a secas no dice qué distancia había; «ocho de doce,
          hacían falta nueve» sí, y es lo que hace que se vuelva a intentar.
        */}
        {!estado.aprobado && estado.ultimo && (
          <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm text-slate-100">
            La última vez sacaste {estado.ultimo.score} de {estado.ultimo.answered}; hacían falta{' '}
            {estado.ultimo.minimo}. Puedes repetirlo cuando quieras: el examen no es el mismo.
          </p>
        )}
      </div>

      <ol className="relative mt-6 grid min-w-0 justify-items-center before:absolute before:inset-y-4 before:left-1/2 before:-z-10 before:w-0.5 before:-translate-x-1/2 before:border-l-4 before:border-dotted before:border-[var(--borde)]">
        <NodoLeccion
          titulo={estado.enCurso ? 'Seguir el examen' : 'Examen del nivel'}
          tipo="Examen"
          icono="🏆"
          estado={nodo}
          desvio={0}
          retraso={0}
          onAbrir={onAbrir}
        />
      </ol>

      {/*
        Fin de curso. Aprobar el último nivel no abre ninguno nuevo, y quedarse
        mirando la misma ruta terminada sin que nadie diga nada sería la peor
        manera de acabar meses de trabajo.
      */}
      {estado.cursoTerminado && (
        <div className="mt-6 rounded-2xl border border-marca-300 bg-marca-50 p-5 text-center dark:border-marca-700 dark:bg-marca-600/15">
          <p className="text-xl font-extrabold">Terminaste el curso</p>
          <p className="mt-2 text-sm text-[var(--texto-suave)]">
            No hay más niveles por delante. Lo que mantiene el inglés a partir de aquí no son
            lecciones nuevas: es usarlo. El repaso, los juegos y las conversaciones siguen ahí todos
            los días.
          </p>
        </div>
      )}
    </section>
  );
}
