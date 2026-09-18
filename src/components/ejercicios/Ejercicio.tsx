import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { decir, hayVoz } from '@/lib/voz';
import type { PropsEjercicio } from './tipos';

/**
 * Los cinco tipos escritos.
 *
 * Todos comparten la misma interfaz: reciben el enunciado y avisan al padre cada
 * vez que la respuesta cambia. Ninguno sabe si está bien o mal, porque eso lo
 * decide el servidor.
 */
export function Ejercicio(props: PropsEjercicio) {
  switch (props.ejercicio.type) {
    case 'multiple_choice':
      return <OpcionMultiple {...props} />;
    case 'fill_blank':
      return <Hueco {...props} />;
    case 'word_order':
      return <Ordenar {...props} />;
    case 'match_pairs':
      return <Emparejar {...props} />;
    case 'translate_write':
      return <Traducir {...props} />;
    case 'listen_type':
      return <Dictado {...props} />;
    case 'read_aloud':
    case 'speak_prompt':
      return <Pendiente tipo={props.ejercicio.type} />;
    default:
      return <Pendiente tipo={props.ejercicio.type} />;
  }
}

function Instruccion({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--texto-suave)]">{children}</p>;
}

function OpcionMultiple({ ejercicio, bloqueado, onCambio }: PropsEjercicio) {
  const [elegida, setElegida] = useState<number | null>(null);
  const prompt = ejercicio.prompt as {
    instruction_es: string;
    question: string;
    options: Array<{ text: string }>;
  };

  useEffect(() => setElegida(null), [ejercicio.code]);

  return (
    <div>
      <Instruccion>{prompt.instruction_es}</Instruccion>
      <p className="mt-3 font-[var(--font-lectura)] text-xl leading-relaxed">{prompt.question}</p>

      <div className="mt-6 grid gap-3">
        {prompt.options.map((opcion, indice) => (
          <button
            key={opcion.text}
            type="button"
            disabled={bloqueado}
            // Sin esto, quien use lector de pantalla oye cuatro botones iguales
            // y no sabe cuál acaba de marcar.
            aria-pressed={elegida === indice}
            onClick={() => {
              setElegida(indice);
              onCambio(indice);
            }}
            className={cn(
              'rounded-2xl border px-5 py-4 text-left text-base transition disabled:opacity-60',
              elegida === indice
                ? 'border-marca-600 bg-marca-50 ring-2 ring-marca-600/30 dark:bg-marca-600/20'
                : 'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400',
            )}
          >
            {opcion.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Hueco({ ejercicio, bloqueado, onCambio }: PropsEjercicio) {
  const [valor, setValor] = useState('');
  const prompt = ejercicio.prompt as {
    instruction_es: string;
    text: string;
    choices?: string[];
  };

  useEffect(() => setValor(''), [ejercicio.code]);

  const [antes, despues] = prompt.text.split('___');

  function fijar(nuevo: string) {
    setValor(nuevo);
    onCambio(nuevo.trim() ? nuevo : null);
  }

  return (
    <div>
      <Instruccion>{prompt.instruction_es}</Instruccion>

      <p className="mt-3 font-[var(--font-lectura)] text-xl leading-relaxed">
        {antes}
        <span className="mx-1 inline-block min-w-24 border-b-2 border-marca-500 px-2 text-center font-semibold text-marca-600 dark:text-marca-400">
          {valor || ' '}
        </span>
        {despues}
      </p>

      {prompt.choices && prompt.choices.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {prompt.choices.map((opcion) => (
            <button
              key={opcion}
              type="button"
              disabled={bloqueado}
              onClick={() => fijar(opcion)}
              className={cn(
                'rounded-xl border px-4 py-3 text-base transition disabled:opacity-60',
                valor === opcion
                  ? 'border-marca-600 bg-marca-50 dark:bg-marca-600/20'
                  : 'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400',
              )}
            >
              {opcion}
            </button>
          ))}
        </div>
      ) : (
        <input
          type="text"
          value={valor}
          disabled={bloqueado}
          onChange={(e) => fijar(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Escribe aquí"
          className="mt-6 w-full rounded-xl border border-[var(--borde)] bg-[var(--superficie)] px-4 py-3 text-base outline-none focus:border-marca-500 disabled:opacity-60"
        />
      )}
    </div>
  );
}

function Ordenar({ ejercicio, bloqueado, onCambio }: PropsEjercicio) {
  const prompt = ejercicio.prompt as {
    instruction_es: string;
    tokens: string[];
    hint_es?: string;
  };

  const [elegidas, setElegidas] = useState<number[]>([]);

  useEffect(() => setElegidas([]), [ejercicio.code]);

  // Se barajan una vez por ejercicio, no en cada pintado.
  const [orden] = useState(() => prompt.tokens.map((_, i) => i).sort(() => Math.random() - 0.5));

  function actualizar(nuevas: number[]) {
    setElegidas(nuevas);
    onCambio(nuevas.length > 0 ? nuevas.map((i) => prompt.tokens[i]!) : null);
  }

  return (
    <div>
      <Instruccion>{prompt.instruction_es}</Instruccion>

      <div className="mt-4 min-h-16 rounded-2xl border-2 border-dashed border-[var(--borde)] p-3">
        <div className="flex flex-wrap gap-2">
          {elegidas.map((indice, posicion) => (
            <button
              key={`${indice}-${posicion}`}
              type="button"
              disabled={bloqueado}
              onClick={() => actualizar(elegidas.filter((_, p) => p !== posicion))}
              className="rounded-xl bg-marca-600 px-3 py-2 text-white transition hover:bg-marca-700 disabled:opacity-60"
            >
              {prompt.tokens[indice]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {orden
          .filter((indice) => !elegidas.includes(indice))
          .map((indice) => (
            <button
              key={indice}
              type="button"
              disabled={bloqueado}
              onClick={() => actualizar([...elegidas, indice])}
              className="rounded-xl border border-[var(--borde)] bg-[var(--superficie)] px-3 py-2 transition hover:border-marca-400 disabled:opacity-60"
            >
              {prompt.tokens[indice]}
            </button>
          ))}
      </div>

      {prompt.hint_es && (
        <p className="mt-4 text-xs text-[var(--texto-suave)]">Pista: {prompt.hint_es}</p>
      )}
    </div>
  );
}

function Emparejar({ ejercicio, bloqueado, onCambio }: PropsEjercicio) {
  const prompt = ejercicio.prompt as {
    instruction_es: string;
    left: string[];
    right: string[];
  };

  const [pares, setPares] = useState<Array<number | null>>(() => prompt.left.map(() => null));
  const [activa, setActiva] = useState<number | null>(null);

  useEffect(() => {
    setPares(prompt.left.map(() => null));
    setActiva(null);
  }, [ejercicio.code, prompt.left]);

  // Se barajan las de la derecha para que emparejar tenga algo de mérito.
  const [ordenDerecha] = useState(() =>
    prompt.right.map((_, i) => i).sort(() => Math.random() - 0.5),
  );

  function emparejar(indiceDerecha: number) {
    if (activa === null) return;

    const nuevos = pares.map((valor, i) =>
      valor === indiceDerecha ? null : i === activa ? indiceDerecha : valor,
    );
    setPares(nuevos);
    setActiva(null);
    onCambio(nuevos.every((v) => v !== null) ? (nuevos as number[]) : null);
  }

  return (
    <div>
      <Instruccion>{prompt.instruction_es}</Instruccion>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          {prompt.left.map((texto, indice) => (
            <button
              key={texto}
              type="button"
              disabled={bloqueado}
              onClick={() => setActiva(indice)}
              className={cn(
                'rounded-xl border px-3 py-3 text-left text-sm transition disabled:opacity-60',
                activa === indice
                  ? 'border-marca-600 bg-marca-50 dark:bg-marca-600/20'
                  : pares[indice] !== null
                    ? 'border-[var(--color-acierto)] bg-[var(--superficie)]'
                    : 'border-[var(--borde)] bg-[var(--superficie)]',
              )}
            >
              {texto}
              {pares[indice] !== null && (
                <span className="mt-1 block text-xs text-[var(--texto-suave)]">
                  → {prompt.right[pares[indice]!]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          {ordenDerecha.map((indice) => {
            const usada = pares.includes(indice);
            return (
              <button
                key={prompt.right[indice]}
                type="button"
                disabled={bloqueado || activa === null}
                onClick={() => emparejar(indice)}
                className={cn(
                  'rounded-xl border px-3 py-3 text-left text-sm transition disabled:opacity-50',
                  usada
                    ? 'border-[var(--borde)] bg-[var(--fondo)] text-[var(--texto-suave)]'
                    : 'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400',
                )}
              >
                {prompt.right[indice]}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-[var(--texto-suave)]">
        Toca una palabra de la izquierda y luego su significado.
      </p>
    </div>
  );
}

function Traducir({ ejercicio, bloqueado, onCambio }: PropsEjercicio) {
  const [valor, setValor] = useState('');
  const prompt = ejercicio.prompt as {
    instruction_es: string;
    source_es: string;
    wordBank?: string[];
  };

  useEffect(() => setValor(''), [ejercicio.code]);

  function fijar(nuevo: string) {
    setValor(nuevo);
    onCambio(nuevo.trim() ? nuevo : null);
  }

  return (
    <div>
      <Instruccion>{prompt.instruction_es}</Instruccion>

      <p className="mt-3 font-[var(--font-lectura)] text-xl leading-relaxed">{prompt.source_es}</p>

      <textarea
        value={valor}
        disabled={bloqueado}
        onChange={(e) => fijar(e.target.value)}
        rows={3}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="Escríbelo en inglés"
        className="mt-6 w-full resize-none rounded-xl border border-[var(--borde)] bg-[var(--superficie)] px-4 py-3 text-base outline-none focus:border-marca-500 disabled:opacity-60"
      />

      {prompt.wordBank && prompt.wordBank.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {prompt.wordBank.map((palabra) => (
            <button
              key={palabra}
              type="button"
              disabled={bloqueado}
              onClick={() => fijar(`${valor}${valor ? ' ' : ''}${palabra}`)}
              className="rounded-lg border border-[var(--borde)] px-2.5 py-1.5 text-sm transition hover:border-marca-400 disabled:opacity-60"
            >
              {palabra}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Escuchar y escribir.
 *
 * La frase no se enseña nunca: si se viera, el ejercicio sería copiar. Se puede
 * repetir las veces que haga falta, y hay un botón para oírla más despacio,
 * que es lo primero que pide quien está empezando.
 */
function Dictado({ ejercicio, bloqueado, onCambio }: PropsEjercicio) {
  const [valor, setValor] = useState('');
  const [sonando, setSonando] = useState(false);
  const [vecesOida, setVecesOida] = useState(0);
  const montado = useRef(true);
  const prompt = ejercicio.prompt as { instruction_es: string; speakText: string };

  useEffect(() => {
    setValor('');
    setVecesOida(0);
  }, [ejercicio.code]);

  // La frase puede seguir sonando cuando ya se pasó de ejercicio. Si se tocara
  // el estado después, React se quejaría de un cambio sobre algo que ya no está.
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  async function reproducir(velocidad: number) {
    if (sonando) return;
    setSonando(true);
    setVecesOida((veces) => veces + 1);
    await decir(prompt.speakText, { velocidad });
    if (montado.current) setSonando(false);
  }

  // Al entrar suena sola una vez: es lo que se espera de un dictado, y ahorra
  // un toque en el móvil. Los navegadores que lo bloqueen no rompen nada,
  // porque el botón sigue ahí.
  useEffect(() => {
    void reproducir(0.9);
    // Solo al cambiar de ejercicio, no en cada pintada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejercicio.code]);

  function fijar(nuevo: string) {
    setValor(nuevo);
    onCambio(nuevo.trim() ? nuevo : null);
  }

  if (!hayVoz()) {
    return (
      <div>
        <Instruccion>{prompt.instruction_es}</Instruccion>
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--borde)] p-6 text-center text-sm text-[var(--texto-suave)]">
          Este navegador no puede leer en voz alta, así que este ejercicio no se puede hacer aquí.
          Prueba con Chrome, o sáltalo.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Instruccion>{prompt.instruction_es}</Instruccion>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => void reproducir(0.9)}
          disabled={sonando}
          aria-label="Escuchar la frase"
          className="flex size-24 items-center justify-center rounded-full bg-marca-600 text-4xl text-white shadow-lg transition hover:bg-marca-500 disabled:opacity-70"
        >
          <span aria-hidden>{sonando ? '🔈' : '🔊'}</span>
        </button>

        <button
          type="button"
          onClick={() => void reproducir(0.55)}
          disabled={sonando}
          className="rounded-xl px-4 py-2.5 text-sm font-bold text-marca-600 hover:bg-marca-50 disabled:opacity-60 dark:text-marca-400 dark:hover:bg-marca-900/30"
        >
          🐢 Más despacio
        </button>

        <p className="text-xs text-[var(--texto-suave)]">
          {vecesOida > 0
            ? `La has oído ${vecesOida} ${vecesOida === 1 ? 'vez' : 'veces'}. Repítela cuantas quieras.`
            : 'Toca para escucharla.'}
        </p>
      </div>

      <input
        type="text"
        value={valor}
        disabled={bloqueado}
        onChange={(e) => fijar(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Escribe lo que oíste"
        className="mt-6 w-full rounded-xl border border-[var(--borde)] bg-[var(--superficie)] px-4 py-3.5 text-base outline-none focus:border-marca-500 disabled:opacity-60"
      />
    </div>
  );
}

function Pendiente({ tipo }: { tipo: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--borde)] p-8 text-center">
      <p className="text-3xl" aria-hidden>
        🎤
      </p>
      <p className="mt-3 font-medium">Este ejercicio necesita voz</p>
      <p className="mt-1 text-sm text-[var(--texto-suave)]">
        Los ejercicios de tipo {tipo} llegan en la siguiente fase. Por ahora puedes saltarlo.
      </p>
    </div>
  );
}
