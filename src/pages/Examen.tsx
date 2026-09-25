import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { NIVELES } from '@/data/niveles';
import { Confeti } from '@/components/Confeti';
import { Ejercicio } from '@/components/ejercicios/Ejercicio';
import { LeerEnVozAlta } from '@/components/ejercicios/LeerEnVozAlta';
import type { EjercicioPublico, Respuesta } from '@/components/ejercicios/tipos';

type Destreza = 'gramatica' | 'escritura' | 'lectura' | 'escucha' | 'pronunciacion';

interface Pregunta extends EjercicioPublico {
  unitCode: string;
  skill: Destreza;
  /** Si se puede pasar de largo sin que cuente como fallo. */
  saltable: boolean;
}

interface Resultado {
  aprobado: boolean;
  score: number;
  answered: number;
  total: number;
  minimo: number;
  levelCode: string;
  siguienteNivel: string | null;
  cursoTerminado: boolean;
  xpEarned: number;
  coinsEarned: number;
  porDestreza: Array<{ skill: Destreza; aciertos: number; total: number }>;
  porUnidad: Array<{ unitCode: string; aciertos: number; total: number }>;
  flojas: string[];
}

const NOMBRE_DESTREZA: Record<Destreza, string> = {
  gramatica: 'Gramática',
  escritura: 'Escritura',
  lectura: 'Lectura',
  escucha: 'Escucha',
  pronunciacion: 'Pronunciación',
};

/**
 * El examen de nivel.
 *
 * Una pregunta por pantalla, sin marcha atrás y —esto es lo importante— SIN
 * decir si se acertó. Una lección corrige al momento porque está enseñando; un
 * examen que corrige al momento deja de medir: se aprende del gesto de la
 * pantalla y se ajusta la siguiente respuesta.
 *
 * Lo que sí se dice, y con detalle, es al final: cuánto hizo falta, cuánto se
 * sacó, y en qué unidad y en qué destreza se falló. «Suspendiste» a secas no le
 * dice a nadie qué hacer después, y quien no sabe qué hacer no vuelve.
 *
 * Cada respuesta se manda en cuanto se da. Si se cierra la pestaña a la séptima,
 * al volver se sigue por la octava con las seis primeras ya contadas.
 */
export function Examen() {
  const navegar = useNavigate();
  const [indice, setIndice] = useState(0);
  const [actual, setActual] = useState<Respuesta | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['examen', 'empezar'],
    queryFn: () =>
      api.post<{ intento: number; preguntas: Pregunta[]; respondidas: string[] }>(
        '/exam/empezar',
        {},
      ),
    // Un examen no se vuelve a pedir solo al volver a la pestaña: abriría otra
    // petición a mitad y las preguntas cambiarían debajo.
    refetchOnWindowFocus: false,
    retry: false,
  });

  const terminar = useMutation({
    mutationFn: () => api.post<Resultado>('/exam/terminar', {}),
    onSuccess: async (final) => {
      setResultado(final);

      /*
        El nivel puede haber cambiado: la ruta tiene que enterarse.

        Lo que NO se puede invalidar es la consulta que abre el examen. Se
        invalidó al principio con la clave `['examen']` entera, que la incluye, y
        el resultado fue que al aprobar la pantalla intentaba abrir el examen del
        nivel NUEVO —cuyas lecciones, claro, no están hechas—, recibía un 403 y
        borraba el parte de notas para enseñar «no pudimos abrir el examen».
        Aprobabas y la pantalla te decía que algo había fallado.
      */
      await queryClient.invalidateQueries({ queryKey: ['mi-nivel'] });
      await queryClient.invalidateQueries({ queryKey: ['examen', 'estado'] });
      await queryClient.invalidateQueries({ queryKey: ['nivel'] });
    },
  });

  const preguntas = data?.preguntas ?? [];

  // Se retoma por la primera sin contestar, no por el principio.
  useEffect(() => {
    if (!data) return;
    const hechas = new Set(data.respondidas);
    const siguiente = data.preguntas.findIndex((p) => !hechas.has(p.code));
    setIndice(siguiente === -1 ? data.preguntas.length : siguiente);
  }, [data]);

  const pregunta = preguntas[indice];

  async function enviar(cuerpo: {
    code: string;
    answer: unknown;
    transcript?: string;
    alternatives?: string[];
  }) {
    setEnviando(true);
    try {
      await api.post('/exam/respuesta', cuerpo);
      setActual(null);
      if (indice + 1 < preguntas.length) setIndice(indice + 1);
      else await terminar.mutateAsync();
    } finally {
      setEnviando(false);
    }
  }

  /**
   * Repetir sin recargar la página.
   *
   * Se borra lo de la vuelta anterior y se vuelve a pedir el examen, que abre un
   * intento nuevo. Una recarga entera del navegador funcionaría igual, pero
   * apaga y enciende la aplicación —sesión, tema, caché— para algo que es
   * simplemente empezar otra vez.
   */
  function reintentar() {
    setResultado(null);
    setIndice(0);
    setActual(null);
    void refetch();
  }

  // El parte de notas va antes que nada: una vez corregido el examen, lo que
  // haga la consulta de abrirlo ya no puede tapar la nota.
  if (resultado) return <Informe resultado={resultado} onReintentar={reintentar} />;

  if (isPending) return <Centrado>Preparando tu examen…</Centrado>;

  if (isError) {
    return (
      <Centrado>
        <span className="block text-center">
          No pudimos abrir el examen. Vuelve a la ruta y termina las lecciones que te falten.
          <button
            type="button"
            onClick={() => navegar('/ruta')}
            className="mt-6 block w-full rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white"
          >
            Volver a mi ruta
          </button>
        </span>
      </Centrado>
    );
  }

  if (terminar.isPending) return <Centrado>Corrigiendo…</Centrado>;

  if (!pregunta) return <Centrado>No pudimos cargar el examen.</Centrado>;

  const progreso = ((indice + 1) / preguntas.length) * 100;
  const esDeVoz = pregunta.type === 'read_aloud' || pregunta.type === 'speak_prompt';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--superficie)]">
          <div
            className="h-full rounded-full bg-marca-600 transition-all"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-[var(--texto-suave)]">
          {indice + 1}/{preguntas.length}
        </span>
      </div>

      <p className="mt-2 text-xs text-[var(--texto-suave)]">
        Examen del nivel · {NOMBRE_DESTREZA[pregunta.skill]}
      </p>

      <div className="mt-8 flex-1">
        {esDeVoz ? (
          /*
            Se manda la transcripción, no el aprobado que devolvió el navegador.
            Aquí la nota decide si se cambia de nivel, así que se vuelve a
            corregir en el servidor.
          */
          <LeerEnVozAlta
            ejercicio={pregunta as unknown as Parameters<typeof LeerEnVozAlta>[0]['ejercicio']}
            onTerminado={(_aprobado, dicho) =>
              void enviar({
                code: pregunta.code,
                answer: null,
                transcript: dicho.texto,
                alternatives: dicho.alternativas,
              })
            }
          />
        ) : (
          <Ejercicio ejercicio={pregunta} bloqueado={enviando} onCambio={setActual} />
        )}
      </div>

      {!esDeVoz && (
        <button
          type="button"
          disabled={actual === null || actual === '' || enviando}
          onClick={() => void enviar({ code: pregunta.code, answer: actual })}
          className="mt-6 min-h-14 rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700 disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
        >
          {indice + 1 < preguntas.length ? 'Siguiente' : 'Terminar el examen'}
        </button>
      )}

      {/*
        Saltar, pero solo donde hace falta un aparato.

        Un dictado no se puede hacer sin voces en inglés instaladas y una lectura
        en voz alta no se puede hacer sin micrófono: eso es un problema de
        equipo, no de inglés, y lo saltado se descuenta del total en vez de
        contar como fallo. En las preguntas de escribir o de elegir no hay botón,
        porque ahí no hay avería que valga: no contestar es no saberlo.
      */}
      {pregunta.saltable && (
        <button
          type="button"
          disabled={enviando}
          onClick={() => void enviar({ code: pregunta.code, answer: null })}
          className="mt-3 min-h-11 rounded-xl px-4 py-2 text-sm text-[var(--texto-suave)] underline underline-offset-4 transition hover:text-[var(--texto)]"
        >
          No puedo hacer esta, saltar
        </button>
      )}

      <p className="mt-4 text-center text-xs text-[var(--texto-suave)]">
        No se dice si aciertas hasta el final. Responde lo mejor que puedas.
      </p>
    </div>
  );
}

/** El parte de cómo fue: la nota, el desglose y qué hacer ahora. */
function Informe({ resultado, onReintentar }: { resultado: Resultado; onReintentar: () => void }) {
  const navegar = useNavigate();
  const siguiente = NIVELES.find((n) => n.codigo === resultado.siguienteNivel);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      {resultado.aprobado && <Confeti />}

      <div className="text-center">
        <p className="text-sm text-[var(--texto-suave)]">
          Acertaste {resultado.score} de {resultado.answered}
          {resultado.answered < resultado.total && ' (saltaste el resto)'}
        </p>

        <h1
          className={`mt-3 text-4xl font-extrabold tracking-tight ${
            resultado.aprobado
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {resultado.aprobado ? '¡Aprobado!' : 'Casi'}
        </h1>

        {/*
          El número que hacía falta va siempre, se apruebe o no. Saber que eran
          nueve y que sacaste ocho es una información accionable; «suspendiste»
          es solo un disgusto.
        */}
        <p className="mt-2 text-sm text-[var(--texto-suave)]">
          {resultado.aprobado
            ? `Hacían falta ${resultado.minimo}.`
            : `Hacían falta ${resultado.minimo} de ${resultado.answered}. Te faltaron ${
                resultado.minimo - resultado.score
              }.`}
        </p>

        {resultado.aprobado && resultado.xpEarned > 0 && (
          <p className="mt-3 text-sm font-semibold text-marca-600 dark:text-marca-400">
            +{resultado.xpEarned} XP · +{resultado.coinsEarned} monedas
          </p>
        )}
      </div>

      {/*
        Fin de curso. No estaba contemplado en ninguna parte de la aplicación, y
        llegar al final del último nivel y que no pasara nada era la peor manera
        posible de terminar meses de trabajo.
      */}
      {resultado.cursoTerminado && (
        <div className="mt-6 rounded-2xl border border-marca-300 bg-marca-50 p-5 text-center dark:border-marca-700 dark:bg-marca-600/15">
          <p className="text-2xl font-extrabold">Terminaste el curso</p>
          <p className="mt-2 text-sm text-[var(--texto-suave)]">
            Ese era el último nivel. A partir de aquí lo que mantiene el inglés no son lecciones
            nuevas: es usarlo. Tienes el repaso, los juegos y las conversaciones abiertos para
            siempre.
          </p>
        </div>
      )}

      {resultado.aprobado && siguiente && (
        <div className="mt-6 rounded-2xl bg-[var(--superficie)] px-4 py-3 text-center text-sm text-[var(--texto-suave)]">
          Pasas al <span className="font-semibold">nivel {siguiente.numero}</span>:{' '}
          {siguiente.titulo.toLowerCase()}. {siguiente.descripcion}
        </div>
      )}

      {/* Qué unidad falló, que es por donde hay que volver. */}
      {!resultado.aprobado && resultado.flojas.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] p-4">
          <p className="text-sm font-semibold">Por dónde volver</p>
          <ul className="mt-3 grid gap-2">
            {resultado.flojas.map((unidad) => (
              <li key={unidad}>
                <button
                  type="button"
                  onClick={() => navegar(`/guia/${unidad}`)}
                  className="min-h-11 w-full rounded-xl border border-[var(--borde)] px-4 py-2 text-left text-sm transition hover:border-marca-400"
                >
                  Guía de la unidad {unidad.replace('-', ' · ')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Desglose
        titulo="Por destreza"
        filas={resultado.porDestreza.map((d) => ({
          clave: d.skill,
          nombre: NOMBRE_DESTREZA[d.skill],
          ...d,
        }))}
      />

      <Desglose
        titulo="Por unidad"
        filas={resultado.porUnidad.map((u) => ({
          clave: u.unitCode,
          nombre: u.unitCode.replace('-', ' · '),
          ...u,
        }))}
      />

      <div className="mt-8 grid gap-3">
        <button
          type="button"
          onClick={() => navegar('/ruta', { replace: true })}
          className="min-h-14 rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700"
        >
          {/* Al acabar el curso no hay nivel nuevo que empezar, y prometerlo
              sería la última cosa que lee quien terminó el curso. */}
          {resultado.aprobado && !resultado.cursoTerminado
            ? 'Empezar el nivel nuevo'
            : 'Volver a mi ruta'}
        </button>

        {/*
          Repetir en el momento, sin espera. Una espera no enseña nada: solo
          castiga, y a quien está a punto de dejarlo le da la excusa que le
          faltaba. Lo que hace que repetir no sea trampa es que el examen
          siguiente no es este: cambian siete u ocho preguntas de las doce.
        */}
        {!resultado.aprobado && (
          <button
            type="button"
            onClick={onReintentar}
            className="min-h-14 rounded-2xl border border-[var(--borde)] px-6 py-4 font-medium transition hover:border-marca-400"
          >
            Intentarlo otra vez
          </button>
        )}
      </div>
    </div>
  );
}

interface Fila {
  clave: string;
  nombre: string;
  aciertos: number;
  total: number;
}

function Desglose({ titulo, filas }: { titulo: string; filas: Fila[] }) {
  if (filas.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] p-4">
      <p className="text-sm font-semibold">{titulo}</p>
      <ul className="mt-3 grid gap-2">
        {filas.map((fila) => (
          <li key={fila.clave} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 text-[var(--texto-suave)]">{fila.nombre}</span>
            {/*
              Lo que se saltó entero se dice con palabras, no con una barra vacía
              y un «0/0»: quien no tiene micrófono se encontraba la fila de
              pronunciación a cero y parecía un suspenso, cuando es lo contrario.
            */}
            {fila.total === 0 ? (
              <span className="flex-1 text-xs italic text-[var(--texto-suave)]">
                no la hiciste, no cuenta
              </span>
            ) : (
              <>
                <span
                  className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--fondo)]"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full bg-marca-600"
                    style={{ width: `${(fila.aciertos / fila.total) * 100}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right tabular-nums text-[var(--texto-suave)]">
                  {fila.aciertos}/{fila.total}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Centrado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-sm text-[var(--texto-suave)]">{children}</div>
    </div>
  );
}
