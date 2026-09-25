import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { decir, hayVoz, hayVozInglesa, vozInglesaYa } from '@/lib/voz';
import type { Correccion, PropsEjercicio } from './tipos';

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
    case 'minimal_pair':
      return <ParMinimo {...props} />;
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

/**
 * Un orden al azar de `cuantos` posiciones, con Fisher-Yates.
 *
 * No con `sort(() => Math.random() - 0.5)`, que es el atajo de siempre y sale
 * torcido: el comparador tiene que ser consistente y ese no lo es, así que el
 * resultado depende del algoritmo de ordenación. Medido en este Node con
 * cuatro elementos, cada uno se quedaba en su sitio el 28 % de las veces en
 * lugar del 25 %, y el orden original salía 1,5 veces más de lo que debía.
 *
 * Es una fuga pequeña, pero es gratis no tenerla.
 */
function barajarIndices(cuantos: number): number[] {
  const orden = Array.from({ length: cuantos }, (_, i) => i);
  for (let i = cuantos - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [orden[i], orden[j]] = [orden[j]!, orden[i]!];
  }
  return orden;
}

function OpcionMultiple({ ejercicio, bloqueado, onCambio, resultado }: PropsEjercicio) {
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
      {/*
        Los saltos de línea del enunciado se respetan.

        En los ejercicios de lectura el enunciado son DOS cosas pegadas: un texto
        corto y, tras una línea en blanco, la pregunta sobre él. Sin esto se
        pintaban seguidos, y la pregunta quedaba escondida al final del párrafo
        como si formara parte de la historia. Pasa en la prueba de nivel y en el
        examen de nivel, que es donde viven esos textos.
      */}
      <p className="mt-3 whitespace-pre-line font-[var(--font-lectura)] text-xl leading-relaxed">
        {prompt.question}
      </p>

      <div className="mt-6 grid gap-3">
        {prompt.options.map((opcion, indice) => {
          const marca = marcaDe({ resultado, texto: opcion.text, esLaElegida: elegida === indice });

          return (
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
                'flex items-center gap-3 rounded-2xl border px-5 py-4 text-left text-base transition',
                CLASE_MARCA[marca],
                marca === 'buena' && 'animate-crecer',
                marca === 'mala' && 'animate-temblor',
                marca === 'ninguna' &&
                  (elegida === indice
                    ? 'border-marca-600 bg-marca-50 ring-2 ring-marca-600/30 dark:bg-marca-600/20'
                    : 'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400'),
                marca === 'ninguna' && 'disabled:opacity-60',
              )}
            >
              <span className="flex-1">{opcion.text}</span>
              {/* El color no puede ser la única señal: hay quien no distingue
                  el verde del rojo, y un icono lo resuelve sin texto extra. */}
              {marca !== 'ninguna' && (
                <span aria-label={marca === 'buena' ? 'Correcta' : 'Tu respuesta'}>
                  {marca === 'buena' ? '✓' : '✕'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Una ficha de opción, la de los huecos.
 *
 * Es la misma lógica de colores que la opción múltiple, en un componente
 * aparte porque son dos formas distintas: aquí las fichas van en fila y son
 * pequeñas, allí ocupan el ancho.
 */
function BotonOpcion({
  texto,
  bloqueado,
  elegida,
  marca,
  onElegir,
  clase,
}: {
  texto: string;
  bloqueado: boolean;
  elegida: boolean;
  marca: Marca;
  onElegir: () => void;
  /** Para colocarla: el par mínimo las pone a lo ancho y escalonadas. */
  clase?: string;
}) {
  return (
    <button
      type="button"
      disabled={bloqueado}
      aria-pressed={elegida}
      onClick={onElegir}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-base transition',
        CLASE_MARCA[marca],
        marca === 'buena' && 'animate-crecer',
        marca === 'mala' && 'animate-temblor',
        marca === 'ninguna' &&
          (elegida
            ? 'border-marca-600 bg-marca-50 dark:bg-marca-600/20'
            : 'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400'),
        marca === 'ninguna' && 'disabled:opacity-60',
        clase,
      )}
    >
      {texto}
      {marca !== 'ninguna' && (
        <span aria-label={marca === 'buena' ? 'Correcta' : 'Tu respuesta'}>
          {marca === 'buena' ? '✓' : '✕'}
        </span>
      )}
    </button>
  );
}

type Marca = 'buena' | 'mala' | 'ninguna';

/*
  Tonos oscuros con texto blanco, no los claros. Un verde pálido con texto
  verde no llega al contraste mínimo, y este es justo el momento en que hay que
  poder leer bien.
*/
const CLASE_MARCA: Record<Marca, string> = {
  buena: 'border-emerald-800 bg-emerald-800 text-white',
  mala: 'border-red-700 bg-red-700 text-white',
  ninguna: '',
};

/**
 * Cómo se pinta una opción una vez corregida.
 *
 * La buena se marca siempre, la hayas elegido o no: si solo se tachara la tuya,
 * te quedarías sin saber cuál era. La tuya se marca en rojo solo si fallaste,
 * porque si acertaste ya está en verde por ser la buena.
 */
function marcaDe({
  resultado,
  texto,
  esLaElegida,
}: {
  resultado?: Correccion | null;
  texto: string;
  esLaElegida: boolean;
}): Marca {
  if (!resultado) return 'ninguna';
  if (resultado.isCorrect) return esLaElegida ? 'buena' : 'ninguna';

  const correcta = resultado.feedback.correcta?.trim().toLowerCase();
  if (correcta && texto.trim().toLowerCase() === correcta) return 'buena';
  return esLaElegida ? 'mala' : 'ninguna';
}

function Hueco({ ejercicio, bloqueado, onCambio, resultado }: PropsEjercicio) {
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
            <BotonOpcion
              key={opcion}
              texto={opcion}
              bloqueado={bloqueado}
              elegida={valor === opcion}
              marca={marcaDe({ resultado, texto: opcion, esLaElegida: valor === opcion })}
              onElegir={() => fijar(opcion)}
            />
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

  // Se barajan las de la derecha para que emparejar tenga algo de mérito: el
  // 85 % del contenido trae `pairs: [0,1,2,3]`, porque al escribir un ejercicio
  // uno pone cada pareja en su fila. Sin barajar se resuelve sin leer.
  const [ordenDerecha, setOrdenDerecha] = useState(() => barajarIndices(prompt.right.length));

  useEffect(() => {
    setPares(prompt.left.map(() => null));
    setActiva(null);
    // También el orden, y no es un detalle: este componente NO lleva `key`, así
    // que React reutiliza la misma instancia de un ejercicio al siguiente. Sin
    // esto, el segundo emparejamiento de una lección hereda el orden del
    // primero, y si tiene distinto número de parejas quedan botones en blanco.
    setOrdenDerecha(barajarIndices(prompt.right.length));
  }, [ejercicio.code, prompt.left, prompt.right]);

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
              // Cuál está elegida se contaba solo con el color del borde. Quien
              // no lo ve pulsaba una palabra y no pasaba nada perceptible.
              aria-pressed={activa === indice}
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
              className="inline-flex min-h-11 items-center rounded-lg border border-[var(--borde)] px-3 text-sm transition hover:border-marca-400 disabled:opacity-60"
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
  const voz = useVozInglesa();
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

  if (voz !== 'si') {
    // Mientras se averigua no se enseña nada: la lista de voces tarda segundos
    // y un aviso que aparece y se va solo es peor que esperar.
    if (voz === 'buscando') return <Instruccion>{prompt.instruction_es}</Instruccion>;
    return (
      <AvisoSinVoz
        instruccion={prompt.instruction_es}
        motivo={voz === 'sinNavegador' ? 'navegador' : 'idioma'}
      />
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

/**
 * Lo que se enseña cuando el navegador no sabe hablar.
 *
 * Está aparte porque lo necesitan todos los ejercicios de oído, y dejar un
 * botón de altavoz que no suena es peor que decirlo.
 */
/**
 * Qué se ve cuando este equipo no puede reproducir inglés.
 *
 * Son dos casos distintos y conviene no confundirlos: o el navegador no sabe
 * hablar, o sabe pero no tiene ninguna voz inglesa instalada. El segundo es el
 * corriente en un Windows en español, y tiene arreglo en tres toques, así que
 * se explica en vez de mandar a cambiar de navegador.
 */
function AvisoSinVoz({
  instruccion,
  motivo,
}: {
  instruccion: string;
  motivo: 'navegador' | 'idioma';
}) {
  return (
    <div>
      <Instruccion>{instruccion}</Instruccion>
      <div className="mt-6 rounded-2xl border border-dashed border-[var(--borde)] p-6 text-center text-sm text-[var(--texto-suave)]">
        {motivo === 'navegador' ? (
          <p>
            Este navegador no puede leer en voz alta, así que este ejercicio no se puede hacer aquí.
            Prueba con Chrome, o sáltalo.
          </p>
        ) : (
          <>
            <p className="font-medium text-[var(--texto)]">
              No hay ninguna voz en inglés en este equipo.
            </p>
            <p className="mt-2">
              No lo leemos con una voz española a propósito: pronunciaría mal y aprenderías el
              sonido equivocado.
            </p>
            <p className="mt-2">
              En Windows: Configuración → Hora e idioma → Voz → Agregar voces. Mientras tanto,
              sáltalo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * ¿Se puede reproducir inglés aquí? Se resuelve una vez y se recuerda.
 *
 * Preguntarlo es asíncrono porque la lista de voces tarda segundos en llegar,
 * y mientras tanto no se puede decidir qué enseñar.
 */
type EstadoVoz = 'buscando' | 'si' | 'sinNavegador' | 'sinIdioma';

function useVozInglesa(): EstadoVoz {
  // Se arranca con lo que ya se sabe. Si la lista está publicada, y lo está
  // salvo en los primeros segundos, no se pasa nunca por «buscando» y la
  // pantalla no parpadea.
  const [estado, setEstado] = useState<EstadoVoz>(() => {
    if (!hayVoz()) return 'sinNavegador';
    const ya = vozInglesaYa();
    return ya === 'si' ? 'si' : ya === 'no' ? 'sinIdioma' : 'buscando';
  });

  useEffect(() => {
    if (estado !== 'buscando') return;
    void hayVozInglesa().then((hay) => setEstado(hay ? 'si' : 'sinIdioma'));
  }, [estado]);

  return estado;
}

/** Las dos respuestas posibles. El servidor espera justo estos números. */
const MISMA = 0;
const DISTINTAS = 1;

/** Lo que se lee en el botón. */
const ROTULO_PAR = ['La misma palabra', 'Dos palabras distintas'];

/**
 * Cómo se pinta cada una de las dos respuestas, una vez corregida.
 *
 * No hace falta mirar el texto que manda el servidor: con dos opciones, saber
 * si se acertó y cuál se eligió basta para deducirlo todo. Si acertaste, la
 * tuya es la buena; si fallaste, la buena es la otra.
 *
 * Se hizo así después de probar la vía fácil, que era comparar con la frase
 * exacta de `feedback.correcta`. Eso ataba el color de un botón a la redacción
 * de un mensaje del servidor: cambiar «Eran» por «Era» allí habría dejado de
 * marcar nada aquí, sin que fallara ninguna prueba ni ningún tipo.
 */
function marcaDelPar({
  resultado,
  valor,
  elegida,
}: {
  resultado?: Correccion | null;
  valor: number;
  elegida: number | null;
}): Marca {
  if (!resultado || elegida === null) return 'ninguna';

  const buena = resultado.isCorrect ? elegida : elegida === MISMA ? DISTINTAS : MISMA;
  if (valor === buena) return 'buena';
  return valor === elegida ? 'mala' : 'ninguna';
}

/** Silencio entre las dos palabras. Pegadas se oyen como una sola. */
const PAUSA_MS = 350;

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/**
 * Par mínimo: suenan dos palabras y hay que decir si son la misma.
 *
 * Las palabras no se escriben nunca, ni siquiera el sonido en el que hay que
 * fijarse, que suele nombrarlas («la i de _sheep_»). Ese aviso llega con la
 * corrección, cuando ya no puede chivar la respuesta.
 *
 * Los tres botones de escuchar no son de adorno: cada palabra suelta sirve para
 * fijarla, y las dos seguidas para compararlas, que es como se oye de verdad la
 * diferencia entre una vocal larga y una corta.
 */
function ParMinimo({ ejercicio, bloqueado, onCambio, resultado }: PropsEjercicio) {
  const voz = useVozInglesa();
  const [elegida, setElegida] = useState<number | null>(null);
  // Qué se está oyendo ahora mismo, para que el altavoz que vibra sea el suyo.
  const [fuente, setFuente] = useState<'a' | 'b' | 'par' | null>(null);
  const [veces, setVeces] = useState(0);
  const montado = useRef(true);
  const prompt = ejercicio.prompt as {
    instruction_es: string;
    speakA: string;
    speakB: string;
    focus_es: string;
  };

  useEffect(() => {
    setElegida(null);
    setVeces(0);
  }, [ejercicio.code]);

  // Las palabras pueden seguir sonando cuando ya se pasó de ejercicio.
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const ambas = [prompt.speakA, prompt.speakB];
  const sonando = fuente !== null;

  async function reproducir(cual: 'a' | 'b' | 'par', velocidad: number) {
    if (sonando) return;
    setFuente(cual);
    setVeces((oidas) => oidas + 1);

    const palabras = cual === 'par' ? ambas : [ambas[cual === 'a' ? 0 : 1]!];

    for (const [indice, palabra] of palabras.entries()) {
      if (!montado.current) break;
      // El silencio va en medio, no al final: si no, se espera por nada.
      if (indice > 0) await esperar(PAUSA_MS);
      await decir(palabra, { velocidad });
    }

    if (montado.current) setFuente(null);
  }

  if (voz !== 'si') {
    // Mientras se averigua no se enseña nada: la lista de voces tarda segundos
    // y un aviso que aparece y se va solo es peor que esperar.
    if (voz === 'buscando') return <Instruccion>{prompt.instruction_es}</Instruccion>;
    return (
      <AvisoSinVoz
        instruccion={prompt.instruction_es}
        motivo={voz === 'sinNavegador' ? 'navegador' : 'idioma'}
      />
    );
  }

  return (
    <div>
      <Instruccion>{prompt.instruction_es}</Instruccion>

      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="flex items-center gap-5">
          {(['a', 'b'] as const).map((cual, indice) => (
            <button
              key={cual}
              type="button"
              onClick={() => void reproducir(cual, 0.9)}
              disabled={sonando}
              // Sin esto se oyen dos botones iguales y no se sabe cuál es cuál.
              aria-label={`Escuchar la ${indice === 0 ? 'primera' : 'segunda'} palabra`}
              style={{ animationDelay: `${indice * 80}ms`, animationFillMode: 'backwards' }}
              className="flex size-20 animate-entrada flex-col items-center justify-center gap-0.5 rounded-full bg-marca-600 text-white shadow-lg transition hover:bg-marca-500 disabled:opacity-70"
            >
              <span className="text-2xl" aria-hidden>
                {fuente === cual ? '🔈' : '🔊'}
              </span>
              <span className="text-sm font-bold" aria-hidden>
                {indice + 1}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void reproducir('par', 0.9)}
          disabled={sonando}
          style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}
          className="animate-entrada rounded-xl border border-[var(--borde)] bg-[var(--superficie)] px-4 py-2.5 text-sm font-bold transition hover:border-marca-400 disabled:opacity-60"
        >
          Las dos seguidas
        </button>

        <button
          type="button"
          onClick={() => void reproducir('par', 0.55)}
          disabled={sonando}
          className="rounded-xl px-4 py-2.5 text-sm font-bold text-marca-600 hover:bg-marca-50 disabled:opacity-60 dark:text-marca-400 dark:hover:bg-marca-900/30"
        >
          🐢 Más despacio
        </button>

        <p className="text-xs text-[var(--texto-suave)]">
          {veces > 0
            ? `Las has oído ${veces} ${veces === 1 ? 'vez' : 'veces'}. Repítelas cuantas quieras.`
            : 'Escúchalas y decide.'}
        </p>
      </div>

      <div className="mt-6 grid gap-3">
        {[MISMA, DISTINTAS].map((valor) => (
          <BotonOpcion
            key={valor}
            texto={ROTULO_PAR[valor]!}
            bloqueado={bloqueado}
            elegida={elegida === valor}
            marca={marcaDelPar({ resultado, valor, elegida })}
            onElegir={() => {
              setElegida(valor);
              onCambio(valor);
            }}
            // Sin `animate-entrada`: aquí la animación que importa es la de la
            // corrección, y dos animaciones en el mismo elemento se pisan.
            clase="justify-center"
          />
        ))}
      </div>

      {/* Solo al corregir: antes diría qué escuchar, pero nombrando las palabras. */}
      {resultado && (
        <p className="mt-4 text-center text-xs text-[var(--texto-suave)]">
          Lo que distingue este par: {prompt.focus_es}
        </p>
      )}
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
