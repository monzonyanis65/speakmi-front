import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { escuchar, estaDisponible, type SesionEscucha } from '@/lib/reconocimiento';

interface Informe {
  aprobado: boolean;
  score: number;
  message_es: string;
  logros_es: string[];
  mejoras_es: string[];
  faltaron: string[];
  transcript: string;
  seconds: number;
}

interface Props {
  ejercicio: {
    code: string;
    prompt: {
      instruction_es: string;
      task_en: string;
      mustInclude?: string[];
      minSeconds: number;
    };
  };
  onTerminado: (aprobado: boolean) => void;
}

/**
 * Hablar libre.
 *
 * No hay respuesta correcta: se propone una tarea y la persona dice algo. El
 * navegador transcribe, el servidor juzga si cumplió lo que se pedía y devuelve
 * qué salió bien y qué no.
 *
 * El contador de segundos está a la vista a propósito. Sin él nadie sabe cuánto
 * lleva hablando, y lo normal es cortarse a los cinco segundos creyendo que ya
 * está.
 */
export function HablarLibre({ ejercicio, onTerminado }: Props) {
  const [estado, setEstado] = useState<'listo' | 'grabando' | 'evaluando' | 'hecho'>('listo');
  const [parcial, setParcial] = useState('');
  const [segundos, setSegundos] = useState(0);
  const [informe, setInforme] = useState<Informe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sesion = useRef<SesionEscucha | null>(null);
  const inicio = useRef(0);
  const yaEvaluado = useRef(false);

  const { prompt } = ejercicio;
  const minimo = prompt.minSeconds || 15;

  useEffect(() => {
    setEstado('listo');
    setParcial('');
    setSegundos(0);
    setInforme(null);
    setError(null);
    yaEvaluado.current = false;
    return () => sesion.current?.cancelar();
  }, [ejercicio.code]);

  // El reloj corre solo mientras se graba.
  useEffect(() => {
    if (estado !== 'grabando') return;
    const reloj = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(reloj);
  }, [estado]);

  async function evaluar(texto: string) {
    // El reconocedor puede avisar dos veces de que terminó. Sin esto se
    // enviaría el mismo intento por duplicado.
    if (yaEvaluado.current) return;
    yaEvaluado.current = true;

    const duracion = (Date.now() - inicio.current) / 1000;

    if (!texto.trim()) {
      setEstado('listo');
      setError('No se te oyó nada. Comprueba el micrófono y vuelve a intentarlo.');
      yaEvaluado.current = false;
      return;
    }

    setEstado('evaluando');
    try {
      const resultado = await api.post<Informe>('/speech/speak-prompt', {
        task_en: prompt.task_en,
        transcript: texto,
        seconds: Math.round(duracion),
        minSeconds: minimo,
        ...(prompt.mustInclude ? { mustInclude: prompt.mustInclude } : {}),
        // El servidor busca la rúbrica con este código: no la tenemos aquí, y
        // mejor así, porque es parte de la solución del ejercicio.
        exerciseCode: ejercicio.code,
      });
      setInforme(resultado);
      setEstado('hecho');
      onTerminado(resultado.aprobado);
    } catch {
      setEstado('listo');
      setError('No pudimos evaluar lo que dijiste. Inténtalo otra vez en un momento.');
      yaEvaluado.current = false;
    }
  }

  function empezar() {
    setError(null);
    setParcial('');
    setSegundos(0);
    setInforme(null);
    yaEvaluado.current = false;
    inicio.current = Date.now();
    setEstado('grabando');

    sesion.current = escuchar({
      idioma: 'en-US',
      onParcial: setParcial,
      onFinal: (texto) => void evaluar(texto),
      onError: () => {
        setEstado('listo');
        setError('El micrófono no respondió. Dale permiso al navegador y prueba otra vez.');
      },
    });
  }

  if (!estaDisponible()) {
    return (
      <div>
        <p className="text-sm text-[var(--texto-suave)]">{prompt.instruction_es}</p>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--borde)] p-6 text-center text-sm text-[var(--texto-suave)]">
          Este navegador no puede escuchar. Abre la app en Chrome o en Edge para hacer los ejercicios
          de hablar, o sáltalo por ahora.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-[var(--texto-suave)]">{prompt.instruction_es}</p>

      <p className="mt-3 font-[var(--font-lectura)] text-xl leading-relaxed">{prompt.task_en}</p>

      {prompt.mustInclude && prompt.mustInclude.length > 0 && (
        <div className="mt-4 rounded-xl bg-[var(--superficie)] p-3">
          <p className="text-xs font-medium text-[var(--texto-suave)]">Tienes que usar:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {prompt.mustInclude.map((palabra) => (
              <span
                key={palabra}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium',
                  informe?.faltaron.includes(palabra)
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                    : informe
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                      : 'bg-[var(--fondo)] text-[var(--texto)]',
                )}
              >
                {palabra}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => (estado === 'grabando' ? sesion.current?.detener() : empezar())}
          disabled={estado === 'evaluando'}
          className={cn(
            'flex size-24 items-center justify-center rounded-full text-4xl text-white shadow-lg transition disabled:opacity-70',
            estado === 'grabando'
              ? 'animate-pulse bg-red-600 hover:bg-red-500'
              : 'bg-marca-600 hover:bg-marca-500',
          )}
          aria-label={estado === 'grabando' ? 'Terminar de hablar' : 'Empezar a hablar'}
        >
          <span aria-hidden>{estado === 'grabando' ? '⏹' : '🎤'}</span>
        </button>

        <p className="text-sm font-medium">
          {estado === 'grabando' && `${segundos}s de ${minimo}s`}
          {estado === 'evaluando' && 'Escuchando lo que dijiste…'}
          {estado === 'listo' && !informe && 'Toca y habla en inglés'}
          {estado === 'hecho' && 'Puedes volver a intentarlo si quieres'}
        </p>

        {estado === 'grabando' && (
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[var(--superficie)]">
            <div
              className="h-full rounded-full bg-marca-600 transition-all"
              style={{ width: `${Math.min(100, (segundos / minimo) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {parcial && estado === 'grabando' && (
        <p className="mt-6 text-center font-[var(--font-lectura)] text-lg italic text-[var(--texto-suave)]">
          {parcial}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-[var(--color-fallo)]">
          {error}
        </p>
      )}

      {informe && (
        <div className="mt-6 rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] p-4">
          <p className="font-bold">
            <span aria-hidden>{informe.aprobado ? '✅ ' : '💪 '}</span>
            {informe.message_es}
          </p>

          <p className="mt-3 font-[var(--font-lectura)] text-sm italic text-[var(--texto-suave)]">
            Te oímos decir: «{informe.transcript}»
          </p>

          {informe.logros_es.length > 0 && (
            <ul className="mt-3 grid gap-1 text-sm">
              {informe.logros_es.map((linea) => (
                <li key={linea} className="flex gap-2">
                  <span aria-hidden>✓</span>
                  <span>{linea}</span>
                </li>
              ))}
            </ul>
          )}

          {informe.mejoras_es.length > 0 && (
            <ul className="mt-2 grid gap-1 text-sm text-[var(--texto-suave)]">
              {informe.mejoras_es.map((linea) => (
                <li key={linea} className="flex gap-2">
                  <span aria-hidden>→</span>
                  <span>{linea}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
