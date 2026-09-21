import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useNombreMascota } from '@/lib/mascota-contexto';
import { Boton } from '@/components/Boton';
import { Mascota } from '@/components/Mascota';
import { NOMBRE_CATEGORIA } from '@/components/ejercicios/tipos';

interface Escenario {
  code: string;
  titleEs: string;
  descripcionEs: string;
  primeraFrase: string;
}

interface Estado {
  listo: boolean;
  proveedores: Array<{ nombre: string; listo: boolean }>;
}

interface Correccion {
  hasErrors: boolean;
  corrected: string;
  errors: Array<{ category: string; original: string; correction: string; explanation_es: string }>;
  praise_es?: string;
}

interface Turno {
  de: 'tu' | 'milo';
  texto: string;
  correccion?: Correccion | null;
}

interface Resumen {
  summary_es: string;
  wentWell_es: string[];
  toImprove_es: string[];
  phrases: Array<{ en: string; es: string }>;
}

/**
 * Conversación con el tutor.
 *
 * Mientras se habla no se corrige: las correcciones llegan con cada turno pero
 * se guardan calladas y se enseñan al final. Interrumpir a alguien que está
 * intentando hablar en otro idioma es la forma más rápida de que deje de hacerlo.
 */
export function Conversar() {
  const navegar = useNavigate();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [escenario, setEscenario] = useState<Escenario | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const nombre = useNombreMascota();
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<{ resumen: Resumen; correcciones: Correccion[] } | null>(
    null,
  );
  const finDelChat = useRef<HTMLDivElement>(null);

  const { data: estado } = useQuery({
    queryKey: ['tutor-estado'],
    queryFn: () => api.get<Estado>('/tutor/status'),
  });

  const { data: escenarios } = useQuery({
    queryKey: ['escenarios'],
    queryFn: () => api.get<{ scenarios: Escenario[] }>('/tutor/scenarios'),
    enabled: estado?.listo === true,
  });

  useEffect(() => {
    finDelChat.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turnos, pensando]);

  async function empezar(elegido: Escenario) {
    setError(null);
    try {
      const inicio = await api.post<{ conversationId: string; opening: string }>(
        '/tutor/conversations',
        { scenarioCode: elegido.code },
      );
      setConversationId(inicio.conversationId);
      setEscenario(elegido);
      setTurnos([{ de: 'milo', texto: inicio.opening }]);
    } catch {
      setError('No pudimos empezar la conversación.');
    }
  }

  async function enviar() {
    const mensaje = texto.trim();
    if (!mensaje || !conversationId || pensando) return;

    setTexto('');
    setTurnos((previos) => [...previos, { de: 'tu', texto: mensaje }]);
    setPensando(true);
    setError(null);

    try {
      const respuesta = await api.post<{ reply: string; correction: Correccion | null }>(
        `/tutor/conversations/${conversationId}/turn`,
        { text: mensaje },
      );

      setTurnos((previos) => {
        const copia = [...previos];
        const ultimo = copia[copia.length - 1];
        // La corrección se guarda junto a tu turno, pero no se muestra todavía.
        if (ultimo?.de === 'tu') ultimo.correccion = respuesta.correction;
        return [...copia, { de: 'milo', texto: respuesta.reply }];
      });
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'TUT-001'
          ? 'El tutor no está configurado todavía.'
          : 'No pudimos responder. Inténtalo otra vez.',
      );
    } finally {
      setPensando(false);
    }
  }

  async function terminar() {
    if (!conversationId) return;
    setPensando(true);
    try {
      const final = await api.post<{ resumen: Resumen; correcciones: Correccion[] }>(
        `/tutor/conversations/${conversationId}/finish`,
      );
      setResumen(final);
    } finally {
      setPensando(false);
    }
  }

  // --- Tutor sin configurar ------------------------------------------------
  if (estado && !estado.listo) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 text-center">
        <div className="flex justify-center">
          <Mascota estado="pensando" tamano={130} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">Me falta la voz</h1>
        <p className="mt-3 text-[var(--texto-suave)]">
          Para conversar necesito una clave de IA. Son gratuitas y se pone en un minuto.
        </p>
        <div className="mt-6 rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-4 text-left text-sm">
          <p className="font-bold">Cómo activarlo</p>
          <ol className="mt-2 grid list-decimal gap-1.5 pl-4 text-[var(--texto-suave)]">
            <li>Entra en console.groq.com y crea una clave gratis.</li>
            <li>Pégala en el archivo .env del backend, en GROQ_API_KEY.</li>
            <li>Reinicia el servidor y vuelve aquí.</li>
          </ol>
          <p className="mt-3 text-xs text-[var(--texto-suave)]">
            También vale una de aistudio.google.com en GEMINI_API_KEY.
          </p>
        </div>
        <Boton tono="suave" tamano="grande" className="mt-6" onClick={() => navegar('/ruta')}>
          Volver
        </Boton>
      </div>
    );
  }

  // --- Informe final -------------------------------------------------------
  if (resumen) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <div className="text-center">
          <Mascota estado="celebrando" tamano={120} className="mx-auto" />
          <h1 className="mt-3 text-2xl font-extrabold">¡Conversación terminada!</h1>
          <p className="mt-2 text-[var(--texto-suave)]">{resumen.resumen.summary_es}</p>
        </div>

        {resumen.resumen.wentWell_es.length > 0 && (
          <Bloque titulo="Lo que hiciste bien" tono="acierto">
            {resumen.resumen.wentWell_es.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </Bloque>
        )}

        {resumen.correcciones.length > 0 && (
          <div className="mt-5 rounded-2xl border-2 border-[var(--borde)] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--texto-suave)]">
              Correcciones
            </p>
            <ul className="mt-3 grid gap-3">
              {resumen.correcciones.flatMap((correccion) =>
                correccion.errors.map((fallo) => (
                  <li key={`${fallo.original}-${fallo.correction}`} className="text-sm">
                    <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-xs font-bold dark:bg-white/10">
                      {NOMBRE_CATEGORIA[fallo.category] ?? fallo.category}
                    </span>
                    <p className="mt-1">
                      <span className="text-[var(--color-fallo)] line-through">
                        {fallo.original}
                      </span>{' '}
                      <span className="text-[var(--color-acierto)]">{fallo.correction}</span>
                    </p>
                    <p className="text-[var(--texto-suave)]">{fallo.explanation_es}</p>
                  </li>
                )),
              )}
            </ul>
          </div>
        )}

        {resumen.resumen.phrases.length > 0 && (
          <Bloque titulo="Para la próxima vez" tono="marca">
            {resumen.resumen.phrases.map((frase) => (
              <li key={frase.en}>
                <span className="font-bold">{frase.en}</span>
                <span className="text-[var(--texto-suave)]"> · {frase.es}</span>
              </li>
            ))}
          </Bloque>
        )}

        <Boton tamano="grande" className="mt-6" onClick={() => navegar('/ruta')}>
          VOLVER A MI RUTA
        </Boton>
      </div>
    );
  }

  // --- Elegir escenario ----------------------------------------------------
  if (!conversationId) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <div className="text-center">
          <Mascota estado="animando" tamano={110} className="mx-auto" />
          <h1 className="mt-3 text-2xl font-extrabold">¿De qué hablamos?</h1>
          <p className="mt-2 text-sm text-[var(--texto-suave)]">
            Elige una situación. No te corrijo mientras hablamos: eso lo vemos al final.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          {escenarios?.scenarios.map((opcion, indice) => (
            <button
              key={opcion.code}
              type="button"
              onClick={() => void empezar(opcion)}
              style={{ animationDelay: `${indice * 60}ms` }}
              className="boton-3d animate-entrada rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4 text-left hover:border-marca-400"
            >
              <p className="font-bold">{opcion.titleEs}</p>
              <p className="mt-1 text-sm text-[var(--texto-suave)]">{opcion.descripcionEs}</p>
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-[var(--color-fallo)]">{error}</p>}

        <Boton tono="suave" className="mt-6" onClick={() => navegar('/ruta')}>
          Volver
        </Boton>
      </div>
    );
  }

  // --- Conversación --------------------------------------------------------
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navegar('/ruta')}
          aria-label="Salir"
          className="-ml-2 rounded-xl px-3 py-2 text-xl text-[var(--texto-suave)]"
        >
          ✕
        </button>
        <p className="truncate text-sm font-bold">{escenario?.titleEs}</p>
        <button
          type="button"
          onClick={() => void terminar()}
          className="text-sm font-bold text-marca-600 dark:text-marca-400"
        >
          Terminar
        </button>
      </header>

      <div className="mt-6 flex-1 space-y-4 overflow-y-auto pb-4">
        {turnos.map((turno, indice) => (
          <div
            key={indice}
            className={cn('flex animate-entrada gap-2', turno.de === 'tu' && 'justify-end')}
          >
            {turno.de === 'milo' && (
              <Mascota estado="neutral" tamano={40} className="mt-1 shrink-0 self-end" />
            )}
            <div
              className={cn(
                'max-w-[78%] rounded-2xl px-4 py-3 font-[var(--font-lectura)]',
                turno.de === 'tu'
                  ? 'bg-marca-600 text-white'
                  : 'border-2 border-[var(--borde)] bg-[var(--superficie)]',
              )}
            >
              {turno.texto}
            </div>
          </div>
        ))}

        {pensando && (
          <div className="flex items-end gap-2">
            <Mascota estado="pensando" tamano={40} className="shrink-0" />
            <div className="rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-4 py-3">
              <span
                className="inline-flex items-end gap-1"
                role="status"
                aria-label={`${nombre} está pensando`}
              >
                <Punto retraso="0s" />
                <Punto retraso="0.15s" />
                <Punto retraso="0.3s" />
              </span>
            </div>
          </div>
        )}

        <div ref={finDelChat} />
      </div>

      {error && <p className="mb-2 text-sm text-[var(--color-fallo)]">{error}</p>}

      <div className="sticky bottom-0 flex gap-2 bg-[var(--fondo)] py-3">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void enviar();
          }}
          placeholder="Escribe en inglés…"
          autoComplete="off"
          className="flex-1 rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-4 py-3 outline-none focus:border-marca-500"
        />
        <Boton ancho={false} onClick={() => void enviar()} disabled={!texto.trim() || pensando}>
          Enviar
        </Boton>
      </div>
    </div>
  );
}

/**
 * Uno de los tres puntos de «está pensando».
 *
 * El desfase entre ellos es corto a propósito: si se separan mucho parecen tres
 * cosas distintas, y si van a la vez parece un fallo. Con poco más de un
 * décimo de segundo se lee como una onda que los recorre.
 */
function Punto({ retraso }: { retraso: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2 animate-puntear rounded-full bg-[var(--texto-suave)]"
      style={{ animationDelay: retraso }}
    />
  );
}

function Bloque({
  titulo,
  tono,
  children,
}: {
  titulo: string;
  tono: 'acierto' | 'marca';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'mt-5 rounded-2xl p-4',
        tono === 'acierto'
          ? 'bg-emerald-50 dark:bg-emerald-950/30'
          : 'bg-marca-50 dark:bg-marca-900/30',
      )}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--texto-suave)]">
        {titulo}
      </p>
      <ul className="mt-2 grid gap-1.5 text-sm">{children}</ul>
    </div>
  );
}
