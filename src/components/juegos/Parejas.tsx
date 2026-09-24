import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { CabeceraJuego, Contador } from './Tablero';
import { useMenosMovimiento } from './movimiento';
import type { Marcador, RondaDeParejas } from './tipos';

/**
 * Parejas: juntar cada palabra inglesa con la española.
 *
 * Entrena vocabulario, y lo entrena de la única forma que sirve: reconociendo.
 * Traducir con calma no es lo que pasa en una conversación; lo que pasa es que
 * oyes «borrow» y tienes medio segundo para saber si te la están pidiendo o te
 * la están dando.
 *
 *
 * POR QUÉ NO SE PREGUNTA AL SERVIDOR ANTES DE PINTAR EL ACIERTO
 *
 * La ronda llega con las parejas completas, `en` y `es` juntas: quien juega ya
 * tiene la solución en el navegador. Esperar un viaje de ida y vuelta para
 * confirmar algo que se sabe aquí mismo añade entre cien y trescientos
 * milisegundos a cada toque, y en un juego de emparejar eso se siente como si la
 * pantalla dudara. Se marca al instante y se avisa al servidor después, sin
 * bloquear nada: si ese aviso falla, la partida sigue igual de bien.
 */

/** Segundos de margen por pareja antes de que el bonus empiece a doler. */
const MARGEN_POR_PAREJA = 10;

/** Lo que cuesta un fallo, en segundos de bonus. */
const CASTIGO_POR_FALLO = 3;

type Lado = 'en' | 'es';

interface Seleccion {
  lado: Lado;
  id: string;
}

export function Parejas({
  ronda,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeParejas;
  /** Avisa al servidor. No se espera y no importa si falla: ver el comentario de arriba. */
  onResponder: (rondaId: string, answer: string) => void;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  const parejas = ronda.parejas;

  // Las dos columnas se barajan por separado. Con el mismo orden a los dos lados
  // el juego se resuelve mirando la altura, sin leer una sola palabra.
  const columnaEn = useMemo(() => barajar(parejas), [parejas]);
  const columnaEs = useMemo(() => barajar(parejas), [parejas]);

  const [hechas, setHechas] = useState<string[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [fallando, setFallando] = useState<Seleccion[] | null>(null);
  const [fallos, setFallos] = useState(0);
  const [transcurrido, setTranscurrido] = useState(0);
  const [ultima, setUltima] = useState<string | null>(null);

  const bonus = Math.max(
    0,
    parejas.length * MARGEN_POR_PAREJA - transcurrido - fallos * CASTIGO_POR_FALLO,
  );
  const puntuacion = hechas.length * 10 + bonus;

  const terminado = useRef(false);
  const marcador = useRef<Marcador>({ puntuacion: 0, aciertos: 0, total: parejas.length });
  marcador.current = { puntuacion, aciertos: hechas.length, total: parejas.length };

  // El cronómetro. Sube en vez de bajar: aquí nadie pierde por tiempo, solo se
  // gana menos. Un juego de vocabulario con cuenta atrás premia a quien ya se lo
  // sabe y castiga justo a quien viene a aprenderlo.
  useEffect(() => {
    const inicio = Date.now();
    const reloj = setInterval(() => {
      setTranscurrido(Math.floor((Date.now() - inicio) / 1000));
    }, 1000);
    return () => clearInterval(reloj);
  }, []);

  useEffect(() => {
    if (parejas.length > 0 && hechas.length === parejas.length && !terminado.current) {
      terminado.current = true;
      // Un respiro para ver la última pareja encajar antes de saltar al final.
      const espera = setTimeout(() => onFin(marcador.current), 600);
      return () => clearTimeout(espera);
    }
    return undefined;
  }, [hechas.length, parejas.length, onFin]);

  function elegir(lado: Lado, id: string) {
    if (hechas.includes(id) || fallando) return;

    if (!seleccion || seleccion.lado === lado) {
      setSeleccion({ lado, id });
      return;
    }

    if (seleccion.id === id) {
      const pareja = parejas.find((p) => p.id === id);
      setHechas((anteriores) => [...anteriores, id]);
      setSeleccion(null);
      if (pareja) {
        setUltima(`${pareja.en}, ${pareja.es}`);
        onResponder(pareja.id, pareja.es);
      }
      return;
    }

    setFallos((n) => n + 1);
    setFallando([seleccion, { lado, id }]);
    setSeleccion(null);
  }

  // El fallo se ve un momento y se deshace solo: obligar a tocar otra vez para
  // borrarlo convierte cada error en dos gestos.
  useEffect(() => {
    if (!fallando) return;
    const espera = setTimeout(() => setFallando(null), 650);
    return () => clearTimeout(espera);
  }, [fallando]);

  function estadoDe(lado: Lado, id: string): 'hecha' | 'elegida' | 'mal' | 'nada' {
    if (hechas.includes(id)) return 'hecha';
    if (fallando?.some((s) => s.lado === lado && s.id === id)) return 'mal';
    if (seleccion?.lado === lado && seleccion.id === id) return 'elegida';
    return 'nada';
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-4">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold leading-none tabular-nums">
            {hechas.length}
            <span className="text-base font-bold text-[var(--texto-suave)]">/{parejas.length}</span>
          </p>
          <p className="text-xs text-[var(--texto-suave)]">parejas</p>
        </div>
        {/* El tiempo y nada más. El bonus y los puntos se calculan por debajo y
            los cierra el servidor: enseñar aquí una cifra que luego sale otra en
            la pantalla final es lo que hace que un juego parezca trucado. */}
        <Contador etiqueta="Tiempo" valor={reloj(transcurrido)} />
      </CabeceraJuego>

      <p className="mt-3 text-sm text-[var(--texto-suave)]">
        Toca una palabra de cada lado. Cuanto antes las juntes y menos falles, mejor.
      </p>

      {/* Lo que acaba de encajar, para quien no ve la pantalla. */}
      <p role="status" className="sr-only">
        {ultima ? `Pareja hecha: ${ultima}.` : ''}
      </p>

      <div className="mt-5 flex flex-1 gap-2">
        <Columna titulo="Inglés">
          {columnaEn.map((pareja) => (
            <Ficha
              key={pareja.id}
              texto={pareja.en}
              idioma="en"
              estado={estadoDe('en', pareja.id)}
              quieto={menosMovimiento}
              onClick={() => elegir('en', pareja.id)}
            />
          ))}
        </Columna>

        <Columna titulo="Español">
          {columnaEs.map((pareja) => (
            <Ficha
              key={pareja.id}
              texto={pareja.es}
              estado={estadoDe('es', pareja.id)}
              quieto={menosMovimiento}
              onClick={() => elegir('es', pareja.id)}
            />
          ))}
        </Columna>
      </div>
    </div>
  );
}

function Columna({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <h2 className="mb-2 text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
        {titulo}
      </h2>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function Ficha({
  texto,
  idioma,
  estado,
  quieto,
  onClick,
}: {
  texto: string;
  idioma?: 'en';
  estado: 'hecha' | 'elegida' | 'mal' | 'nada';
  quieto: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      lang={idioma}
      disabled={estado === 'hecha'}
      aria-pressed={estado === 'elegida'}
      onClick={onClick}
      className={cn(
        // 48 px de alto: por debajo de eso el dedo falla y en un juego de tocar
        // rápido fallar el dedo se vive como si el juego no respondiera.
        'flex min-h-12 items-center justify-center break-words rounded-2xl border-2 px-2 py-2 text-center text-sm font-semibold transition',
        estado === 'nada' && 'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400',
        estado === 'elegida' &&
          'border-marca-600 bg-marca-50 ring-2 ring-marca-600/30 dark:bg-marca-600/25',
        estado === 'mal' && 'border-red-500 bg-red-50 text-[var(--texto-fallo)] dark:bg-red-950/40',
        estado === 'mal' && !quieto && 'animate-temblor',
        // Hecha: se apaga pero no desaparece. Que el hueco siga ahí deja ver lo
        // que ya se resolvió, y eso es media lección de vocabulario.
        estado === 'hecha' &&
          'border-emerald-600 bg-emerald-50 text-[var(--texto-acierto)] opacity-70 dark:bg-emerald-950/30',
      )}
    >
      {estado === 'hecha' && (
        <span aria-label="Hecha" className="mr-1">
          ✓
        </span>
      )}
      {texto}
    </button>
  );
}

function barajar<T>(lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copia[i]!;
    const b = copia[j]!;
    copia[i] = b;
    copia[j] = a;
  }
  return copia;
}

/** Los segundos, en minutos y segundos, que a partir del minuto ya no se leen. */
function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
