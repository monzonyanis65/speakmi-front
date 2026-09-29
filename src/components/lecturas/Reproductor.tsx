import { useCallback, useEffect, useRef, useState } from 'react';
import { audioDeParrafo, urlDeAudio, type AudioLectura } from '@/lib/lecturas';
import { cn } from '@/lib/cn';

interface Props {
  id: string;
  /** La voz del texto entero, cuando es cortito. Casi siempre `null`. */
  audioEntero: AudioLectura | null;
  totalParrafos: number;
  /** Qué párrafo suena ahora, para que el texto lo señale. `null` si ninguno. */
  sonando: number | null;
  onSonando: (parrafo: number | null) => void;
}

const VELOCIDADES = [0.75, 1, 1.25] as const;

/**
 * Escuchar el texto mientras se lee.
 *
 *
 * POR QUÉ VA PÁRRAFO A PÁRRAFO
 *
 * Porque un artículo entero no cabe en una petición: mil palabras son unos seis
 * mil caracteres de síntesis y varios megas de base64, y la función que lo
 * serviría vive segundos. Así que la voz se pide por párrafos y según hace
 * falta.
 *
 * Eso, que empezó siendo una limitación, es lo que hace que esto ENSEÑE. Con el
 * audio partido por párrafos se puede señalar el párrafo que está sonando sin
 * estimar nada: el navegador dice cuándo empieza y cuándo acaba cada trozo. No
 * es palabra por palabra —para eso harían falta marcas de tiempo, y el servidor
 * no manda ninguna—, pero es sincronía DE VERDAD. La alternativa, repartir la
 * duración entre las letras y avanzar un resaltado, se desajusta con la primera
 * pausa del narrador y para el tercer párrafo estaría señalando una palabra
 * mientras suena otra: enseñándole a alguien una pronunciación que no es.
 *
 *
 * CUANDO NO HAY VOZ, SE DICE
 *
 * Hoy la ruta contesta 204 siempre, porque la clave de Azure está vacía. Lo
 * fácil sería pintar el reproductor igualmente y dejarlo gris: se ve más
 * completo y no hay que explicar nada. Sería mentira dos veces —hay un botón de
 * play que no suena, y no se dice por qué— y además rompe lo único que importa,
 * que es que el texto SE PUEDA LEER. Así que se pregunta una vez por el primer
 * párrafo y, si no hay, no hay reproductor: hay una línea que lo cuenta.
 */
export function Reproductor({ id, audioEntero, totalParrafos, sonando, onSonando }: Props) {
  const elemento = useRef<HTMLAudioElement>(null);
  /** Lo ya descargado, por párrafo. Se vuelve a un párrafo muy a menudo. */
  const descargados = useRef(new Map<number, string>());

  const [hayVoz, setHayVoz] = useState<'preguntando' | 'si' | 'no'>('preguntando');
  const [cargando, setCargando] = useState(false);
  const [velocidad, setVelocidad] = useState<number>(1);

  /** El audio de un párrafo, descargado una sola vez. */
  const urlDe = useCallback(
    async (parrafo: number): Promise<string | null> => {
      const guardado = descargados.current.get(parrafo);
      if (guardado) return guardado;

      const audio = parrafo === 0 && audioEntero ? audioEntero : await audioDeParrafo(id, parrafo);
      if (!audio) return null;

      const url = urlDeAudio(audio);
      if (url) descargados.current.set(parrafo, url);
      return url;
    },
    [id, audioEntero],
  );

  /*
    Una sola pregunta al abrir: ¿hay voz para el primer párrafo?

    Si la hay, la habrá para los demás; si no, no la hay para ninguno, porque lo
    que falta es la clave del sintetizador y no un párrafo concreto. Preguntar
    por los veinte para poder pintar el botón sería veinte peticiones para
    enterarse de un «no».
  */
  useEffect(() => {
    let vivo = true;
    void urlDe(0).then((url) => {
      if (vivo) setHayVoz(url ? 'si' : 'no');
    });
    return () => {
      vivo = false;
    };
  }, [urlDe]);

  // Al salir del artículo, soltar los audios. Son varios megas por texto.
  useEffect(() => {
    const cache = descargados.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  useEffect(() => {
    const nodo = elemento.current;
    if (!nodo) return;
    // La velocidad se aplica al reproducir y no al generar: oír el mismo audio
    // a 0,75 no es otro archivo. `preservesPitch` evita que suene grave.
    nodo.playbackRate = velocidad;
    nodo.preservesPitch = true;
  }, [velocidad, sonando]);

  const arrancar = useCallback(
    async (parrafo: number) => {
      const nodo = elemento.current;
      if (!nodo || parrafo < 0 || parrafo >= totalParrafos) {
        onSonando(null);
        return;
      }

      setCargando(true);
      const url = await urlDe(parrafo);
      setCargando(false);
      if (!url) {
        onSonando(null);
        return;
      }

      nodo.src = url;
      nodo.playbackRate = velocidad;
      nodo.preservesPitch = true;
      onSonando(parrafo);

      // En jsdom y en algún navegador `play()` no devuelve promesa; y cuando la
      // devuelve puede rechazarla por falta de gesto previo. Ni una cosa ni la
      // otra puede tirar la pantalla de leer.
      const promesa: unknown = nodo.play();
      if (promesa instanceof Promise) promesa.catch(() => onSonando(null));
    },
    [onSonando, totalParrafos, urlDe, velocidad],
  );

  if (hayVoz === 'preguntando') {
    return (
      <p className="px-1 text-sm text-[var(--texto-suave)]">Mirando si hay voz para este texto…</p>
    );
  }

  if (hayVoz === 'no') {
    return (
      <p className="rounded-xl border border-dashed border-[var(--borde)] px-3 py-2.5 text-sm text-[var(--texto-suave)]">
        <span aria-hidden>🔇 </span>
        Este texto todavía no tiene voz: el servidor no tiene ninguna configurada. Se lee igual, y
        cuando la haya aparecerá aquí un reproductor.
      </p>
    );
  }

  const enMarcha = sonando !== null;

  function alternar() {
    const nodo = elemento.current;
    if (!nodo) return;
    if (sonando === null) {
      void arrancar(0);
    } else if (nodo.paused) {
      const promesa: unknown = nodo.play();
      if (promesa instanceof Promise) promesa.catch(() => undefined);
    } else {
      nodo.pause();
      onSonando(null);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-3">
      <audio
        ref={elemento}
        // Al acabar un párrafo entra el siguiente. Es lo que convierte veinte
        // audios sueltos en escuchar el artículo: nadie va a pulsar play veinte
        // veces mientras lee.
        onEnded={() => void arrancar((sonando ?? 0) + 1)}
        onError={() => onSonando(null)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={alternar}
          aria-label={enMarcha ? 'Pausar la lectura en voz alta' : 'Escuchar el texto'}
          className="boton-3d flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-marca-900 bg-marca-700 text-xl text-white"
        >
          <span aria-hidden>{enMarcha ? '❚❚' : '▶'}</span>
        </button>

        <button
          type="button"
          disabled={!enMarcha || sonando === 0}
          onClick={() => void arrancar((sonando ?? 0) - 1)}
          aria-label="Párrafo anterior"
          className="boton-3d flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--hueco)] bg-[var(--fondo)] text-sm font-bold disabled:opacity-40"
        >
          <span aria-hidden>↺</span>
        </button>

        <button
          type="button"
          disabled={!enMarcha || sonando === totalParrafos - 1}
          onClick={() => void arrancar((sonando ?? 0) + 1)}
          aria-label="Párrafo siguiente"
          className="boton-3d flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--hueco)] bg-[var(--fondo)] text-sm font-bold disabled:opacity-40"
        >
          <span aria-hidden>↻</span>
        </button>

        {/*
          Dice por dónde va, en párrafos, porque es la unidad en la que suena de
          verdad. Un reloj de minutos y segundos sería mentira: no hay un audio
          continuo del que medir el minuto tres.
        */}
        <p aria-live="polite" className="min-w-0 flex-1 text-sm text-[var(--texto-suave)]">
          {cargando
            ? 'Cargando la voz…'
            : enMarcha
              ? `Suena el párrafo ${(sonando ?? 0) + 1} de ${totalParrafos}`
              : 'Se escucha párrafo a párrafo, y el texto va señalando cuál suena'}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--texto-suave)]">Velocidad</span>
        {VELOCIDADES.map((valor) => (
          <button
            key={valor}
            type="button"
            aria-pressed={velocidad === valor}
            onClick={() => setVelocidad(valor)}
            className={cn(
              'min-h-11 rounded-lg border-2 px-3 text-sm font-bold',
              velocidad === valor
                ? 'border-marca-700 bg-marca-600 text-white'
                : 'border-[var(--hueco)] bg-[var(--fondo)]',
            )}
          >
            {valor}×
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-[var(--texto-suave)]">
        Se señala el párrafo que suena, no la palabra: el servidor manda la voz sin marcas de
        tiempo, y repartirlas a ojo acabaría señalando la palabra equivocada.
      </p>
    </div>
  );
}
