import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { escuchar, estaDisponible, type SesionEscucha } from '@/lib/reconocimiento';
import { grabar, type Grabacion } from '@/lib/grabacion';
import { wavDesdeGrabacion, PICO_MINIMO } from '@/lib/wav';
import { Cerrar, Micro } from '@/components/iconos';

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
  /*
    El audio de lo que dices, que al terminar transcribe el servidor.

    El reconocedor del navegador entrega texto al instante y gratis, pero con
    habla libre y acento se equivoca mucho: de una respuesta entera sacaba un
    «OK» y se comía el resto. Esto es lo mismo que ya hace la llamada, y por el
    mismo motivo.
  */
  const grabacion = useRef<Grabacion | null>(null);
  const inicio = useRef(0);
  const yaEvaluado = useRef(false);
  /** Qué intento es el de ahora, para que uno viejo no pise al nuevo. */
  const turno = useRef(0);
  /** El tope de `parar`, por si el reconocedor no avisa de que terminó. */
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { prompt } = ejercicio;
  const minimo = prompt.minSeconds || 15;

  useEffect(() => {
    setEstado('listo');
    setParcial('');
    setSegundos(0);
    setInforme(null);
    setError(null);
    yaEvaluado.current = false;
    return () => soltar();
  }, [ejercicio.code]);

  /**
   * Devuelve el micrófono.
   *
   * Se llama en TODOS los caminos que dejan de escuchar, y no solo en el bueno:
   * al fallar el micrófono, al no entender nada y antes de volver a empezar. Lo
   * que no se suelta el sistema no se lo da a nadie más, y en un iPhone eso no
   * se ve como un error sino como que el siguiente ejercicio de voz ya no oye.
   */
  function soltar() {
    turno.current += 1;
    clearTimeout(espera.current);
    sesion.current?.cancelar();
    sesion.current = null;
    grabacion.current?.cancelar();
    grabacion.current = null;
  }

  // El reloj corre solo mientras se graba.
  useEffect(() => {
    if (estado !== 'grabando') return;
    const reloj = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(reloj);
  }, [estado]);

  /**
   * Lo que dijiste, preferiendo lo que oiga el servidor.
   *
   * Aquí el servidor no es el plan B: es el que oye mejor. El reconocedor del
   * navegador va bien leyendo una frase que ya conoce, pero hablando libre y
   * con acento se pierde —de una respuesta entera sacaba «OK»— y encima no
   * avisa de que se perdió: entrega esas dos letras como si fueran todo lo que
   * se dijo, y el ejercicio te regaña por no haber hablado.
   *
   * Si el servidor no puede, se sigue con lo del navegador, que es mejor que
   * nada.
   */
  async function loQueSeDijo(delNavegador: string): Promise<string> {
    const abierta = grabacion.current;
    grabacion.current = null;
    if (!abierta) return delNavegador.trim();

    const crudo = await abierta.terminar();
    if (!crudo || crudo.size < 1000) return delNavegador.trim();

    /*
      Antes de preguntar, mirar si hay voz dentro.

      Un micrófono que se abre y no capta entrega ceros, y quien transcribe
      ceros no devuelve vacío: se inventa una frase. Puntuar esa invención sería
      decirle a alguien que habló cuando no lo hizo.
    */
    const medido = await wavDesdeGrabacion(crudo);
    if (medido && medido.pico < PICO_MINIMO) return '';

    try {
      const oido = await api.post<{ text: string }>('/speech/transcribe', crudo, {
        timeoutMs: 20_000,
      });
      const texto = oido.text.trim();
      if (texto) return texto;
    } catch {
      // Sin Whisper se sigue con lo que entendió el navegador.
    }

    return delNavegador.trim();
  }

  async function evaluar(delNavegador: string) {
    // El reconocedor puede avisar dos veces de que terminó. Sin esto se
    // enviaría el mismo intento por duplicado.
    if (yaEvaluado.current) return;
    yaEvaluado.current = true;

    clearTimeout(espera.current);
    const duracion = (Date.now() - inicio.current) / 1000;
    const mio = turno.current;

    // Transcribir lleva unos segundos, así que se dice ya que se está en ello.
    setEstado('evaluando');
    const texto = await loQueSeDijo(delNavegador);

    // Mientras se transcribía se cambió de ejercicio o se volvió a empezar.
    if (mio !== turno.current) return;

    if (!texto) {
      soltar();
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
    // Si quedó una escucha viva de un intento anterior, se cierra antes de abrir
    // otra: dos reconocedores a la vez no se reparten el micrófono, se lo quitan.
    soltar();
    setError(null);
    setParcial('');
    setSegundos(0);
    setInforme(null);
    yaEvaluado.current = false;
    inicio.current = Date.now();
    setEstado('grabando');

    const mio = turno.current;

    sesion.current = escuchar({
      idioma: 'en-US',
      onParcial: setParcial,
      // Al hablar libre no hay texto de referencia con el que comparar, así
      // que no hay forma de elegir entre alternativas: se usa la más probable.
      onFinal: (oido) => void evaluar(oido.texto),
      onError: () => {
        /*
          Que se rinda el reconocedor ya no es el final.

          Si la grabación sigue viva, se sigue escuchando solo con ella: al
          parar, transcribe el servidor. Es lo mismo que hace la llamada, y es
          lo que convierte «el micrófono no respondió» en un ejercicio que se
          puede terminar igual.
        */
        if (grabacion.current) return;
        sesion.current?.cancelar();
        sesion.current = null;
        setEstado('listo');
        setError('El micrófono no respondió. Dale permiso al navegador y prueba otra vez.');
      },
    });

    // La grabación va aparte y sin esperarla: el reconocedor ya está escuchando
    // y no tiene por qué perderse el principio de la frase mientras esto abre.
    void grabar().then((nueva) => {
      if (!nueva) return;
      if (mio !== turno.current) {
        nueva.cancelar();
        return;
      }
      grabacion.current = nueva;
    });
  }

  /**
   * Terminar de hablar.
   *
   * Pararlo dispara `onFinal`, que es quien evalúa. Pero si el reconocedor no
   * llegó a arrancar —en iOS pasa— ese aviso no llega nunca y la pantalla se
   * queda colgada. El tope evalúa igual con lo grabado; `evaluar` se protege
   * sola contra entrar dos veces.
   */
  function parar() {
    sesion.current?.detener();
    setEstado('evaluando');
    clearTimeout(espera.current);
    espera.current = setTimeout(() => void evaluar(''), 1500);
  }

  if (!estaDisponible()) {
    return (
      <div>
        <p className="text-sm text-[var(--texto-suave)]">{prompt.instruction_es}</p>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--borde)] p-6 text-center text-sm text-[var(--texto-suave)]">
          Este navegador no puede escuchar. Abre la app en Chrome o en Edge para hacer los
          ejercicios de hablar, o sáltalo por ahora.
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
          onClick={() => (estado === 'grabando' ? parar() : empezar())}
          disabled={estado === 'evaluando'}
          className={cn(
            'flex size-24 items-center justify-center rounded-full text-4xl text-white shadow-lg transition disabled:opacity-70',
            estado === 'grabando'
              ? 'animate-pulse bg-red-600 hover:bg-red-500'
              : 'bg-marca-600 hover:bg-marca-500',
          )}
          aria-label={estado === 'grabando' ? 'Terminar de hablar' : 'Empezar a hablar'}
        >
          <span aria-hidden>
            {estado === 'grabando' ? <Cerrar tamano={20} /> : <Micro tamano={20} />}
          </span>
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
        <p role="alert" className="mt-4 text-center text-sm text-[var(--texto-fallo)]">
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
