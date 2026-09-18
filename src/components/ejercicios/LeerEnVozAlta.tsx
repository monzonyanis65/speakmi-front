import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { escuchar, estaDisponible, type SesionEscucha } from '@/lib/reconocimiento';

interface PalabraLeida {
  wordIndex: number;
  word: string;
  heard: string | null;
  score: number;
  verdict: 'correct' | 'mispronounced' | 'omitted' | 'inserted';
}

interface Informe {
  words: PalabraLeida[];
  accuracy: number;
  completeness: number;
  transcript: string;
  aprobado: boolean;
  palabrasParaTrabajar: Array<{ word: string; hint?: string }>;
}

interface Props {
  ejercicio: {
    code: string;
    prompt: {
      instruction_es: string;
      referenceText: string;
      trickyWords?: Array<{ word: string; hint: string; ipa?: string }>;
    };
  };
  onTerminado: (aprobado: boolean) => void;
}

/**
 * Leer en voz alta.
 *
 * El navegador escucha, el servidor alinea lo dicho con el texto y devuelve qué
 * palabra falló. Esta es la pantalla que justifica la app: ninguna otra cosa que
 * hagas escribiendo te dice si te entenderían al hablar.
 */
export function LeerEnVozAlta({ ejercicio, onTerminado }: Props) {
  const [estado, setEstado] = useState<'listo' | 'escuchando' | 'evaluando' | 'hecho'>('listo');
  const [parcial, setParcial] = useState('');
  const [informe, setInforme] = useState<Informe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sesion = useRef<SesionEscucha | null>(null);
  const inicio = useRef<number>(0);
  // El reconocedor puede avisar de que terminó más de una vez. Sin esto, una
  // lectura se evaluaría dos veces y el aviso de "no te escuchamos" se quedaría
  // pegado junto al resultado bueno.
  const yaEvaluado = useRef(false);

  const soportado = estaDisponible();
  const { referenceText, trickyWords } = ejercicio.prompt;

  // Si se sale a mitad, se corta el micrófono. Dejarlo abierto sería feo.
  useEffect(() => () => sesion.current?.cancelar(), []);

  function empezar() {
    setError(null);
    setParcial('');
    setInforme(null);
    yaEvaluado.current = false;
    inicio.current = Date.now();

    const abierta = escuchar({
      idioma: 'en-US',
      onParcial: setParcial,
      onFinal: (texto) => void evaluar(texto),
      onError: (motivo) =>
        setError(
          motivo === 'not-allowed'
            ? 'Necesitamos permiso para usar el micrófono.'
            : 'No pudimos escucharte. Inténtalo otra vez.',
        ),
    });

    if (!abierta) {
      setError('Tu navegador no puede escuchar. Prueba con Chrome o Edge.');
      return;
    }

    sesion.current = abierta;
    setEstado('escuchando');
  }

  function parar() {
    sesion.current?.detener();
    setEstado('evaluando');
  }

  async function evaluar(transcripcion: string) {
    if (yaEvaluado.current) return;

    if (!transcripcion.trim()) {
      // Puede llegar vacío si se corta antes de que el reconocedor entregue algo.
      // No se marca como evaluado: si el texto llega después, todavía cuenta.
      setError('No te escuchamos. Acércate al micrófono e inténtalo otra vez.');
      setEstado('listo');
      return;
    }

    yaEvaluado.current = true;
    setError(null);
    setEstado('evaluando');
    try {
      const resultado = await api.post<Informe>('/speech/read-aloud', {
        referenceText,
        transcript: transcripcion,
        exerciseCode: ejercicio.code,
        durationMs: Date.now() - inicio.current,
        ...(trickyWords
          ? { trickyWords: trickyWords.map(({ word, hint }) => ({ word, hint })) }
          : {}),
      });
      setInforme(resultado);
      setEstado('hecho');
      onTerminado(resultado.aprobado);
    } catch {
      setError('No pudimos evaluar tu lectura. Inténtalo otra vez.');
      setEstado('listo');
    }
  }

  if (!soportado) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--borde)] p-8 text-center">
        <p className="text-3xl" aria-hidden>
          🔇
        </p>
        <p className="mt-3 font-medium">Tu navegador no puede escucharte</p>
        <p className="mt-1 text-sm text-[var(--texto-suave)]">
          La lectura en voz alta funciona en Chrome, Edge y Android. Puedes saltar este ejercicio.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-[var(--texto-suave)]">{ejercicio.prompt.instruction_es}</p>

      <div className="mt-5 rounded-2xl bg-[var(--superficie)] p-5">
        <p className="font-[var(--font-lectura)] text-xl leading-relaxed">
          {informe ? <TextoCorregido palabras={informe.words} /> : referenceText}
        </p>
      </div>

      {trickyWords && trickyWords.length > 0 && !informe && (
        <div className="mt-4 grid gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--texto-suave)]">
            Ojo con estas
          </p>
          {trickyWords.map((tricky) => (
            <p key={tricky.word} className="text-sm">
              <span className="font-semibold">{tricky.word}</span>{' '}
              <span className="text-[var(--texto-suave)]">{tricky.hint}</span>
            </p>
          ))}
        </div>
      )}

      {estado === 'escuchando' && (
        <div className="mt-5 rounded-2xl bg-marca-50 p-4 dark:bg-marca-900/30">
          <p className="text-sm text-marca-700 dark:text-marca-300">{parcial || 'Te escucho…'}</p>
        </div>
      )}

      {informe && <Resultado informe={informe} />}

      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--color-fallo)]">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col items-center">
        {estado === 'listo' && (
          <>
            <button
              type="button"
              onClick={empezar}
              aria-label="Empezar a leer"
              className="flex size-20 items-center justify-center rounded-full bg-marca-600 text-3xl text-white transition hover:bg-marca-700"
            >
              🎤
            </button>
            <p className="mt-3 text-sm text-[var(--texto-suave)]">Toca y lee en voz alta</p>
          </>
        )}

        {estado === 'escuchando' && (
          <>
            <button
              type="button"
              onClick={parar}
              aria-label="Terminé de leer"
              className="flex size-20 animate-pulse items-center justify-center rounded-full bg-[var(--color-fallo)] text-3xl text-white"
            >
              ■
            </button>
            <p className="mt-3 text-sm text-[var(--texto-suave)]">Toca cuando termines</p>
          </>
        )}

        {estado === 'evaluando' && (
          <p className="text-sm text-[var(--texto-suave)]">Escuchando lo que dijiste…</p>
        )}

        {estado === 'hecho' && (
          <button
            type="button"
            onClick={empezar}
            className="rounded-2xl border border-[var(--borde)] px-6 py-3 text-sm font-medium transition hover:border-marca-400"
          >
            Intentarlo otra vez
          </button>
        )}
      </div>
    </div>
  );
}

/** El texto con cada palabra pintada según cómo sonó. */
function TextoCorregido({ palabras }: { palabras: PalabraLeida[] }) {
  return (
    <span>
      {palabras
        .filter((palabra) => palabra.verdict !== 'inserted')
        .map((palabra, i) => (
          <span
            key={`${palabra.word}-${i}`}
            title={palabra.heard ? `Oímos: ${palabra.heard}` : 'No te oímos decirla'}
            className={cn(
              'mr-1.5 inline-block rounded px-1',
              palabra.verdict === 'correct'
                ? 'text-emerald-800 dark:text-emerald-300'
                : palabra.verdict === 'mispronounced'
                  ? 'bg-amber-200/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-red-200/60 text-red-900 line-through dark:bg-red-900/40 dark:text-red-200',
            )}
          >
            {palabra.word}
          </span>
        ))}
    </span>
  );
}

function Resultado({ informe }: { informe: Informe }) {
  const exactitud = Math.round(informe.accuracy * 100);

  return (
    <div className="mt-5">
      <div className="flex gap-3">
        <Medida valor={`${exactitud}%`} etiqueta="bien dichas" />
        <Medida valor={`${Math.round(informe.completeness * 100)}%`} etiqueta="del texto" />
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm">
        <span className="inline-block size-2 rounded-full bg-emerald-500" /> bien
        <span className="ml-2 inline-block size-2 rounded-full bg-amber-400" /> dudosa
        <span className="ml-2 inline-block size-2 rounded-full bg-red-400" /> no se oyó
      </p>

      {informe.palabrasParaTrabajar.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--borde)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--texto-suave)]">
            Para la próxima
          </p>
          <ul className="mt-2 grid gap-1.5">
            {informe.palabrasParaTrabajar.map((palabra) => (
              <li key={palabra.word} className="text-sm">
                <span className="font-semibold">{palabra.word}</span>
                {palabra.hint && (
                  <span className="text-[var(--texto-suave)]"> · {palabra.hint}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Medida({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-[var(--superficie)] p-3 text-center">
      <p className="text-xl font-bold text-marca-600 dark:text-marca-400">{valor}</p>
      <p className="text-xs text-[var(--texto-suave)]">{etiqueta}</p>
    </div>
  );
}
