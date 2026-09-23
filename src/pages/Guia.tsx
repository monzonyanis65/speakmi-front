import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useState } from 'react';
import { Explicacion } from '@/components/Explicacion';
import { decir, hayVoz } from '@/lib/voz';
import { MascotaConMensaje } from '@/components/Mascota';

interface Regla {
  code: string;
  kind: string;
  titleEs: string;
  explanationMd: string | null;
}

interface Palabra {
  lemma: string;
  translationEs: string;
  ipaUs: string | null;
  exampleEn: string | null;
  exampleEs: string | null;
}

const NOMBRE_TIPO: Record<string, string> = {
  grammar: 'Gramática',
  vocab: 'Vocabulario',
  function: 'Para qué sirve',
  pronunciation: 'Pronunciación',
};

const COLOR_TIPO: Record<string, string> = {
  grammar: 'bg-marca-100 text-marca-800 dark:bg-marca-900/50 dark:text-marca-200',
  vocab: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
  function: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100',
  pronunciation: 'bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100',
};

/**
 * La guía de una unidad: sus reglas, explicadas y juntas.
 *
 * Existe porque la corrección de un ejercicio explica ese fallo concreto y nada
 * más. Quien quiere entender la regla entera, antes de empezar o después de
 * tropezar tres veces con lo mismo, no tenía dónde mirar. Las explicaciones ya
 * estaban escritas en el contenido; lo único que faltaba era enseñarlas.
 */
export function Guia() {
  const navegar = useNavigate();
  const { code } = useParams<{ code: string }>();

  const { data, isPending, isError } = useQuery({
    queryKey: ['guia', code],
    queryFn: () =>
      api.get<{ unitCode: string; vocab: Palabra[]; skills: Regla[] }>(
        `/curriculum/units/${code!}/guide`,
      ),
    enabled: Boolean(code),
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--texto-suave)]">{code?.replace('-', ' · ') ?? 'Guía'}</p>
          <h1 className="text-xl font-bold">Las reglas de esta unidad</h1>
        </div>
        <button
          type="button"
          onClick={() => navegar(-1)}
          className="-mr-2 flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      {isPending && (
        <p className="mt-10 text-center text-[var(--texto-suave)]">Cargando la guía…</p>
      )}

      {isError && (
        <div className="mt-8">
          <MascotaConMensaje
            estado="pensando"
            mensaje="Esta unidad todavía no tiene guía. Puedes empezar las lecciones igual."
          />
        </div>
      )}

      {data && data.vocab.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
            Frases clave
          </h2>
          <div className="mt-3 grid gap-2">
            {data.vocab
              .filter((palabra) => palabra.exampleEn)
              .map((palabra, indice) => (
                <FraseClave key={palabra.lemma} palabra={palabra} retraso={indice * 60} />
              ))}
          </div>
        </section>
      )}

      <h2 className="mt-8 text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
        Las reglas
      </h2>

      <div className="mt-3 grid gap-4">
        {data?.skills.map((regla, indice) => (
          <section
            key={regla.code}
            className="animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-5"
            style={{ animationDelay: `${indice * 70}ms`, animationFillMode: 'backwards' }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-bold leading-tight">{regla.titleEs}</h2>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  COLOR_TIPO[regla.kind] ?? 'bg-[var(--fondo)] text-[var(--texto-suave)]',
                )}
              >
                {NOMBRE_TIPO[regla.kind] ?? regla.kind}
              </span>
            </div>

            {regla.explanationMd && (
              <div className="mt-3 text-[var(--texto-suave)]">
                <Explicacion texto={regla.explanationMd} />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Una frase clave de la unidad, con su traducción y su botón para oírla.
 *
 * Se oye con el sintetizador del navegador, el mismo que usa el dictado. Leer
 * una frase en inglés sin saber cómo suena sirve de poco: se aprende escrita y
 * luego no se reconoce al oírla.
 */
function FraseClave({ palabra, retraso }: { palabra: Palabra; retraso: number }) {
  const [sonando, setSonando] = useState(false);

  async function reproducir() {
    if (sonando || !palabra.exampleEn) return;
    setSonando(true);
    await decir(palabra.exampleEn, { velocidad: 0.9 });
    setSonando(false);
  }

  return (
    <div
      className="flex animate-entrada items-start gap-3 rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-3"
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      {hayVoz() && (
        <button
          type="button"
          onClick={() => void reproducir()}
          disabled={sonando}
          aria-label={`Escuchar «${palabra.exampleEn ?? palabra.lemma}»`}
          className="boton-3d grid size-11 shrink-0 place-items-center rounded-xl border-marca-900 bg-marca-700 text-lg text-white hover:bg-marca-600 disabled:opacity-70"
        >
          <span aria-hidden>{sonando ? '🔈' : '🔊'}</span>
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="font-[var(--font-lectura)] leading-snug">{palabra.exampleEn}</p>
        <p className="mt-0.5 text-sm text-[var(--texto-suave)]">{palabra.exampleEs}</p>
        <p className="mt-1 text-xs text-[var(--texto-suave)]">
          <span className="font-semibold">{palabra.lemma}</span>
          {palabra.ipaUs ? ` · ${palabra.ipaUs}` : ''} · {palabra.translationEs}
        </p>
      </div>
    </div>
  );
}
