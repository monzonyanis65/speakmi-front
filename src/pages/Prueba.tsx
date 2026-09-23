import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { guardarNivel } from '@/lib/auth';
import { NIVELES, tramoDe } from '@/data/niveles';
import { Ejercicio } from '@/components/ejercicios/Ejercicio';
import { LeerEnVozAlta } from '@/components/ejercicios/LeerEnVozAlta';
import type { EjercicioPublico, Respuesta } from '@/components/ejercicios/tipos';

type Destreza = 'gramatica' | 'escritura' | 'lectura' | 'escucha' | 'pronunciacion';

interface EjercicioDePrueba extends EjercicioPublico {
  level: string;
  skill: Destreza;
}

interface Resultado {
  suggestedLevel: string;
  score: number;
  total: number;
  porDestreza: Array<{ skill: Destreza; aciertos: number; total: number }>;
}

interface Respondida {
  code: string;
  answer: unknown;
  transcript?: string;
  alternatives?: string[];
}

/** Cómo se llama cada destreza cuando hay que enseñársela a alguien. */
const NOMBRE_DESTREZA: Record<Destreza, string> = {
  gramatica: 'Gramática',
  escritura: 'Escritura',
  lectura: 'Lectura',
  escucha: 'Escucha',
  pronunciacion: 'Pronunciación',
};

/**
 * Prueba de nivel.
 *
 * Un ejercicio por pantalla, sin marcha atrás ni temporizador. No se dice si se
 * acertó: no es un examen que se apruebe, es una forma de encontrar el punto de
 * partida. Al final se sugiere un nivel y la persona decide.
 *
 * Mide CINCO destrezas, no una. Durante mucho tiempo fueron veinticuatro huecos
 * con cuatro opciones, y eso no es saber inglés: se puede reconocer la forma
 * correcta en una lista y no ser capaz de escribir una frase ni de entender una
 * dicha en voz alta. Usa los mismos ejercicios que las lecciones —que ya estaban
 * construidos— en vez de un formato propio más pobre.
 */
export function Prueba() {
  const navegar = useNavigate();
  const [indice, setIndice] = useState(0);
  const [respuestas, setRespuestas] = useState<Respondida[]>([]);
  const [actual, setActual] = useState<Respuesta | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['prueba'],
    queryFn: () => api.get<{ exercises: EjercicioDePrueba[] }>('/placement/exercises'),
  });

  const enviar = useMutation({
    mutationFn: (answers: Respondida[]) => api.post<Resultado>('/placement/submit', { answers }),
    onSuccess: setResultado,
  });

  const ejercicios = data?.exercises ?? [];
  const ejercicio = ejercicios[indice];

  function avanzar(respondida: Respondida) {
    const acumuladas = [...respuestas, respondida];
    setRespuestas(acumuladas);
    setActual(null);

    if (indice + 1 < ejercicios.length) {
      setIndice(indice + 1);
    } else {
      enviar.mutate(acumuladas);
    }
  }

  async function empezarEnNivel(codigo: string) {
    setGuardando(true);
    try {
      await guardarNivel(codigo);
      navegar('/ruta', { replace: true });
    } finally {
      setGuardando(false);
    }
  }

  if (isPending) return <Centrado>Preparando la prueba…</Centrado>;
  if (enviar.isPending) return <Centrado>Calculando tu nivel…</Centrado>;

  if (resultado) {
    const nivel = NIVELES.find((n) => n.codigo === resultado.suggestedLevel);
    const tramo = tramoDe(resultado.suggestedLevel);

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="text-center">
          <p className="text-sm text-[var(--texto-suave)]">
            Acertaste {resultado.score} de {resultado.total}
          </p>

          {/*
            El tramo va primero y en grande, y el nivel del curso debajo.

            «Estás en A2» es la frase que la persona se lleva puesta: es lo que
            dice en una entrevista y lo que le permite compararse con alguien que
            estudió en otro sitio. «Nivel 5» solo significa algo aquí dentro.
          */}
          {tramo && (
            <p className="mt-4 text-5xl font-extrabold tracking-tight text-marca-600 dark:text-marca-400">
              {nivel?.cefr ?? tramo.letra}
            </p>
          )}
          <h1 className="mt-2 text-2xl font-bold">
            {tramo ? tramo.nombre : `Nivel ${nivel?.numero}`}
          </h1>
          {tramo && <p className="mt-2 text-sm text-[var(--texto-suave)]">{tramo.resumen}</p>}

          {nivel && (
            <p className="mt-4 rounded-2xl bg-[var(--superficie)] px-4 py-3 text-sm text-[var(--texto-suave)]">
              Empiezas por el <span className="font-semibold">nivel {nivel.numero}</span>:{' '}
              {nivel.titulo.toLowerCase()}. {nivel.descripcion}
            </p>
          )}
        </div>

        {/*
          El desglose por destreza, que dice algo que el nivel no dice.

          Dos personas con el mismo número de aciertos pueden necesitar cosas
          muy distintas: quien lee bien y no entiende nada hablado tiene un
          problema concreto, y verlo escrito al empezar vale más que un número
          global. No cambia el nivel; cambia dónde poner el esfuerzo.
        */}
        {resultado.porDestreza.length > 0 && (
          <div className="mt-8 rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] p-4">
            <p className="text-sm font-semibold">Cómo te fue en cada parte</p>
            <ul className="mt-3 grid gap-2">
              {resultado.porDestreza.map((d) => (
                <li key={d.skill} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-[var(--texto-suave)]">
                    {NOMBRE_DESTREZA[d.skill]}
                  </span>
                  {/*
                    Una destreza que se saltó entera se dice con palabras, no con
                    una barra vacía y un «0/0». Quien no tiene micrófono se
                    encontraba la fila de pronunciación a cero y parecía un
                    suspenso, cuando es exactamente lo contrario: no se midió.
                  */}
                  {d.total === 0 ? (
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
                          style={{ width: `${(d.aciertos / d.total) * 100}%` }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right tabular-nums text-[var(--texto-suave)]">
                        {d.aciertos}/{d.total}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 grid gap-3">
          <button
            type="button"
            disabled={guardando}
            onClick={() => void empezarEnNivel(resultado.suggestedLevel)}
            className="rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700 disabled:bg-slate-300"
          >
            {guardando ? 'Guardando…' : 'Empezar aquí'}
          </button>

          <button
            type="button"
            onClick={() => navegar('/nivel')}
            className="rounded-2xl border border-[var(--borde)] px-6 py-4 font-medium transition hover:border-marca-400"
          >
            Prefiero elegir otro nivel
          </button>
        </div>
      </div>
    );
  }

  if (!ejercicio) return <Centrado>No pudimos cargar la prueba.</Centrado>;

  const progreso = ((indice + 1) / ejercicios.length) * 100;
  const esDeVoz = ejercicio.type === 'read_aloud' || ejercicio.type === 'speak_prompt';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--superficie)]">
          <div
            className="h-full rounded-full bg-marca-600 transition-all"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <span className="text-xs text-[var(--texto-suave)]">
          {indice + 1}/{ejercicios.length}
        </span>
      </div>

      <div className="mt-10 flex-1">
        {esDeVoz ? (
          /*
            Los de voz se pintan con su propio componente y se pasan solos al
            terminar: no hay botón de «siguiente» que pulsar después de hablar.

            Se manda la transcripción, no el aprobado que devolvió el navegador.
            Aquí la nota decide el nivel del curso entero, así que se vuelve a
            corregir en el servidor.
          */
          <LeerEnVozAlta
            ejercicio={ejercicio as unknown as Parameters<typeof LeerEnVozAlta>[0]['ejercicio']}
            onTerminado={(_aprobado, dicho) =>
              avanzar({
                code: ejercicio.code,
                answer: null,
                transcript: dicho.texto,
                alternatives: dicho.alternativas,
              })
            }
          />
        ) : (
          <Ejercicio ejercicio={ejercicio} bloqueado={false} onCambio={setActual} />
        )}
      </div>

      {!esDeVoz && (
        <button
          type="button"
          disabled={actual === null || actual === ''}
          onClick={() => avanzar({ code: ejercicio.code, answer: actual })}
          className="mt-6 rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700 disabled:bg-slate-300 dark:disabled:bg-slate-700"
        >
          {indice + 1 < ejercicios.length ? 'Siguiente' : 'Terminar'}
        </button>
      )}

      {/*
        Saltar, y no es una comodidad: sin esto la prueba puede ser IMPOSIBLE de
        terminar. En un equipo sin voces en inglés instaladas, los dictados se
        pintan con un aviso y sin caja donde escribir; sin micrófono, las
        lecturas en voz alta no arrancan. Ocho de los veinticuatro ejercicios son
        de oído o de voz: quien no pueda hacerlos se quedaba encerrado en la
        pantalla, sin nivel y sin poder empezar el curso.

        Lo que se salta no cuenta ni a favor ni en contra: se descuenta del total
        de su nivel. Contarlo como fallo colocaría por debajo de su sitio a quien
        solo tiene el equipo mal configurado.
      */}
      <button
        type="button"
        onClick={() => avanzar({ code: ejercicio.code, answer: null })}
        className="mt-3 rounded-xl px-4 py-2 text-sm text-[var(--texto-suave)] underline underline-offset-4 transition hover:text-[var(--texto)]"
      >
        No puedo hacer este, saltar
      </button>

      <p className="mt-4 text-center text-xs text-[var(--texto-suave)]">
        Si no lo sabes, responde lo que te suene mejor. Para eso es la prueba.
      </p>
    </div>
  );
}

function Centrado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <p className="text-[var(--texto-suave)]">{children}</p>
    </div>
  );
}
