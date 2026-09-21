import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSesion } from '@/store/sesion';
import { PanelInicio } from '@/components/PanelInicio';
import { NivelVacio } from '@/components/NivelVacio';
import { MascotaConMensaje } from '@/components/Mascota';
import { NodoLeccion, type EstadoNodo } from '@/components/NodoLeccion';

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
            <p className="mt-10 text-center text-[var(--color-fallo)]">
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
                      className="boton-3d shrink-0 rounded-xl border-2 border-marca-200 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-marca-700 hover:bg-marca-50"
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
          </div>
        </div>
      </div>
    </div>
  );
}
