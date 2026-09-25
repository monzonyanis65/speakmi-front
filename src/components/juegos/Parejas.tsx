import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { emojiDe } from '@/data/emoji-vocabulario';
import { useMenosMovimiento } from '@/lib/movimiento';
import { CabeceraJuego, Contador } from './Tablero';
import type { Marcador, RondaDeParejas } from './tipos';

/**
 * Parejas: un memorama para juntar cada palabra inglesa con su significado.
 *
 * Entrena vocabulario, y lo entrena de la única forma que sirve: reconociendo.
 * Traducir con calma no es lo que pasa en una conversación; lo que pasa es que
 * oyes «borrow» y tienes medio segundo para saber si te la están pidiendo o te
 * la están dando.
 *
 *
 * POR QUÉ LAS CARTAS ESTÁN BOCA ABAJO
 *
 * Antes eran dos columnas de texto, todo a la vista, y se resolvía por
 * eliminación: cuando quedaban dos, ya no hacía falta saberse ninguna. Boca
 * abajo no hay eliminación posible, y cada volteo te enseña la palabra otra vez.
 * Esa repetición —ver «seafood 🦐» cuatro veces buscando su pareja— es más
 * vocabulario del que dejaba la lista.
 *
 *
 * POR QUÉ EL DORSO DICE SI ES INGLÉS O ESPAÑOL
 *
 * En un memorama normal todos los dorsos son iguales porque todas las cartas
 * juegan igual. Aquí no: una carta inglesa nunca casa con otra inglesa. Con los
 * dorsos mudos, la mitad de los volteos serían inglés con inglés, que no es
 * difícil, es inútil. Marcados, cada volteo es una apuesta de verdad. Y va
 * escrito «EN»/«ES», no solo el color, porque el color no lo ve todo el mundo.
 *
 *
 * POR QUÉ EL DIBUJO SOLO ESTÁ EN LA CARTA INGLESA
 *
 * Si «cat» y «gato» llevaran los dos un 🐱, se emparejaría mirando los
 * monigotes y el juego dejaría de entrenar vocabulario. El dibujo va en el lado
 * inglés, que es el que hay que aprender a reconocer; el español se lee.
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

/**
 * Cuánto se quedan arriba las dos cartas que no eran pareja.
 *
 * Un segundo entero, y no es generosidad: ese segundo es donde se aprende. Si se
 * dan la vuelta en cuanto fallas, no te ha dado tiempo de leer la que
 * levantaste, y volverás a levantarla igual de ciego dentro de tres jugadas.
 */
const MIRAR_EL_FALLO = 1000;

type Lado = 'en' | 'es';

interface Seleccion {
  lado: Lado;
  id: string;
}

interface CartaDelTablero {
  /** Único en el tablero: la misma pareja aparece dos veces, una por lado. */
  clave: string;
  id: string;
  lado: Lado;
  texto: string;
  emoji: string | null;
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

  // Las dos mitades caen revueltas en el mismo tablero. Barajar una sola vez por
  // ronda: rebarajar en cada render sería mover las cartas bajo el dedo.
  const cartas = useMemo<CartaDelTablero[]>(
    () =>
      barajar(
        parejas.flatMap((pareja) => [
          {
            clave: `${pareja.id}-en`,
            id: pareja.id,
            lado: 'en' as const,
            texto: pareja.en,
            // Con el significado: el mismo dibujo no vale para los dos
            // sentidos de una palabra, y aquí enseñaría la pareja equivocada.
            emoji: emojiDe(pareja.en, pareja.es),
          },
          {
            clave: `${pareja.id}-es`,
            id: pareja.id,
            lado: 'es' as const,
            texto: pareja.es,
            emoji: null,
          },
        ]),
      ),
    [parejas],
  );

  const [hechas, setHechas] = useState<string[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [fallando, setFallando] = useState<Seleccion[] | null>(null);
  const [fallos, setFallos] = useState(0);
  const [transcurrido, setTranscurrido] = useState(0);
  const [ultima, setUltima] = useState<string | null>(null);
  const [fallada, setFallada] = useState<string | null>(null);

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
      const espera = setTimeout(() => onFin(marcador.current), 700);
      return () => clearTimeout(espera);
    }
    return undefined;
  }, [hechas.length, parejas.length, onFin]);

  function elegir(lado: Lado, id: string) {
    if (hechas.includes(id) || fallando) return;

    // Dos del mismo lado no es un fallo, es cambiar de idea: se baja la primera
    // y se levanta la segunda. Penalizar eso sería cobrar por algo que el propio
    // tablero ya impide que sirva de nada.
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
    setFallada(textoDe(cartas, seleccion) + ' y ' + textoDe(cartas, { lado, id }));
    setSeleccion(null);
  }

  // El fallo se ve un momento y se deshace solo: obligar a tocar otra vez para
  // borrarlo convierte cada error en dos gestos.
  useEffect(() => {
    if (!fallando) return;
    const espera = setTimeout(() => setFallando(null), MIRAR_EL_FALLO);
    return () => clearTimeout(espera);
  }, [fallando]);

  function estadoDe(lado: Lado, id: string): EstadoCarta {
    if (hechas.includes(id)) return 'hecha';
    if (fallando?.some((s) => s.lado === lado && s.id === id)) return 'mal';
    if (seleccion?.lado === lado && seleccion.id === id) return 'elegida';
    return 'abajo';
  }

  const hechasPorCiento = parejas.length > 0 ? (hechas.length / parejas.length) * 100 : 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-3 py-4 sm:px-4">
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

      {/* Cuánto llevas, sin números: de un vistazo y sin leer. */}
      <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--borde)]">
        <div
          className="h-full rounded-full bg-marca-600 transition-[width] duration-300"
          style={{ width: `${hechasPorCiento}%` }}
        />
      </div>

      <p className="mt-3 text-xs leading-snug text-[var(--texto-suave)]">
        Levanta una carta <span className="font-bold text-marca-700 dark:text-marca-300">EN</span> y
        una <span className="font-bold text-amber-700 dark:text-amber-300">ES</span>. Si son la
        misma palabra, se quedan.
      </p>

      {/* Lo que acaba de pasar, para quien no ve la pantalla. */}
      <p role="status" className="sr-only">
        {ultima ? `Pareja hecha: ${ultima}.` : ''}
      </p>
      <p role="status" className="sr-only">
        {fallando && fallada ? `${fallada} no eran pareja. Se dan la vuelta.` : ''}
      </p>

      {/*
        El tablero se queda en medio de lo que sobre.

        En una pantalla alta, doce cartas pegadas arriba dejan media pantalla de
        nada debajo y el juego parece que se cortó. Centrado, el pulgar cae donde
        están las cartas, que en un móvil es el único sitio que importa.
      */}
      <div className="flex flex-1 flex-col justify-center py-4">
        <ul aria-label="Tablero de cartas" className="grid grid-cols-3 gap-2 sm:gap-3">
          {cartas.map((carta, indice) => (
            <li
              key={carta.clave}
              // La entrada escalonada vive en el `li` y no en el botón a
              // propósito: el botón cambia de clases al fallar, y si la entrada
              // estuviera ahí, cada fallo volvería a estrenar la carta.
              className={cn(!menosMovimiento && 'animate-entrada')}
              style={
                menosMovimiento
                  ? undefined
                  : { animationDelay: `${indice * 35}ms`, animationFillMode: 'backwards' }
              }
            >
              <Carta
                carta={carta}
                numero={indice + 1}
                estado={estadoDe(carta.lado, carta.id)}
                quieto={menosMovimiento}
                onClick={() => elegir(carta.lado, carta.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type EstadoCarta = 'abajo' | 'elegida' | 'mal' | 'hecha';

const IDIOMA = {
  en: { sigla: 'EN', nombre: 'inglés' },
  es: { sigla: 'ES', nombre: 'español' },
} as const;

/**
 * Una carta.
 *
 * El volteo es lo único que separa un memorama de una lista de botones, así que
 * está hecho con dos caras de verdad —una a 0° y otra a 180°, las dos con la
 * trasera oculta— y no cambiando el contenido de golpe. La diferencia se nota:
 * con el giro real ves de dónde sale la palabra, y al girar hacia atrás ves
 * adónde vuelve, que es justo lo que hay que memorizar.
 *
 * Con `prefers-reduced-motion` no gira: cambia. Se quita la transición (no se
 * acorta: quitarla) y las caras se intercambian sin recorrido. El juego se
 * entiende igual porque la información nunca estuvo en el movimiento, estaba en
 * qué cara se ve.
 */
function Carta({
  carta,
  numero,
  estado,
  quieto,
  onClick,
}: {
  carta: CartaDelTablero;
  numero: number;
  estado: EstadoCarta;
  quieto: boolean;
  onClick: () => void;
}) {
  const arriba = estado !== 'abajo';
  const idioma = IDIOMA[carta.lado];
  const esIngles = carta.lado === 'en';

  return (
    <button
      type="button"
      disabled={estado === 'hecha'}
      onClick={onClick}
      // Boca abajo no hay texto que leer, así que el nombre lo pone la etiqueta:
      // qué carta es, que está boca abajo y de qué idioma. Boca arriba se quita
      // y manda el contenido, que así conserva su `lang` y se pronuncia bien.
      {...(arriba ? {} : { 'aria-label': `Carta ${numero}, boca abajo, ${idioma.nombre}` })}
      className={cn(
        // Cuadrada: a 320 px cada carta queda en 90 px de lado, muy por encima de
        // los 44 px de zona táctil, y las cuatro filas caben sin arrastrar.
        'block aspect-square w-full rounded-2xl outline-offset-2 perspective-midrange',
        estado === 'mal' && !quieto && 'animate-temblor',
      )}
    >
      <span
        className={cn(
          'relative block size-full transform-3d',
          !quieto && 'transition-transform duration-300 ease-out',
          arriba && 'rotate-y-180',
        )}
      >
        <Dorso sigla={idioma.sigla} ingles={esIngles} />
        <Frente carta={carta} estado={estado} oculta={!arriba} quieto={quieto} />
      </span>
    </button>
  );
}

/**
 * El dorso.
 *
 * La trama de puntos no es decoración gratuita: doce rectángulos planos e
 * idénticos se leen como una tabla, y una tabla no invita a tocarla. Con la
 * trama parecen cartas, y a una carta se le da la vuelta.
 */
function Dorso({ sigla, ingles }: { sigla: string; ingles: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute inset-0 flex items-center justify-center rounded-2xl backface-hidden',
        'border-2 shadow-sm',
        ingles ? 'border-marca-800 bg-marca-600' : 'border-amber-800 bg-amber-600',
      )}
      style={{
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1.4px), linear-gradient(135deg, rgba(255,255,255,0.18), rgba(0,0,0,0.22))',
        backgroundSize: '9px 9px, 100% 100%',
      }}
    >
      <span className="rounded-lg bg-white/90 px-2 py-0.5 text-xs font-extrabold tracking-wider text-slate-900">
        {sigla}
      </span>
    </span>
  );
}

/**
 * La cara buena.
 *
 * El emoji ocupa la mitad de arriba cuando lo hay. Cuando no —una preposición,
 * un pasado irregular—, la palabra sube de tamaño y se queda con todo el sitio.
 * Poner ahí un signo de interrogación o una bombilla genérica sería peor: en una
 * carta que se mira medio segundo, el dibujo manda sobre el texto, y un dibujo
 * que no significa nada es un dibujo que engaña.
 */
function Frente({
  carta,
  estado,
  oculta,
  quieto,
}: {
  carta: CartaDelTablero;
  estado: EstadoCarta;
  oculta: boolean;
  quieto: boolean;
}) {
  const esIngles = carta.lado === 'en';

  return (
    <span
      aria-hidden={oculta || undefined}
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl',
        'border-2 px-1 text-center backface-hidden rotate-y-180',
        estado !== 'mal' && estado !== 'hecha' && 'bg-[var(--superficie)]',
        estado !== 'mal' &&
          estado !== 'hecha' &&
          (esIngles
            ? 'border-marca-500 ring-2 ring-marca-500/25'
            : 'border-amber-500 ring-2 ring-amber-500/25'),
        estado === 'mal' &&
          'border-red-500 bg-red-50 text-[var(--texto-fallo)] ring-2 ring-red-500/30 dark:bg-red-950/50',
        // Hecha: se queda puesta y marcada. Que el tablero acabe lleno de cartas
        // verdes con su palabra a la vista es media lección de vocabulario.
        estado === 'hecha' &&
          'border-emerald-600 bg-emerald-50 text-[var(--texto-acierto)] dark:bg-emerald-950/40',
      )}
    >
      {/* La sigla del dorso, repetida pequeñita arriba. Sirve para leer un
          tablero medio resuelto sin tener que reconocer cada palabra. */}
      <span
        aria-hidden
        className={cn(
          'absolute left-1 top-1 text-[8px] font-extrabold tracking-wider',
          esIngles ? 'text-marca-600 dark:text-marca-300' : 'text-amber-700 dark:text-amber-400',
        )}
      >
        {esIngles ? 'EN' : 'ES'}
      </span>

      {carta.emoji && (
        <span aria-hidden className="text-2xl leading-none sm:text-3xl">
          {carta.emoji}
        </span>
      )}

      <span
        {...(esIngles ? { lang: 'en' } : {})}
        className={cn(
          'block w-full hyphens-auto break-words font-bold leading-tight',
          tamanoDe(carta.texto, Boolean(carta.emoji)),
        )}
      >
        {carta.texto}
      </span>

      {estado === 'hecha' && (
        <>
          {/* El único premio visual del acierto, y va aquí y no en la carta
              entera: animar la carta pisaría el giro y la dejaría con la cara
              de atrás a la vista. */}
          <span
            aria-hidden
            className={cn(
              'absolute right-1 top-1 text-xs font-black text-[var(--texto-acierto)]',
              !quieto && 'animate-crecer',
            )}
          >
            ✓
          </span>
          <span className="sr-only"> (pareja hecha)</span>
        </>
      )}
    </span>
  );
}

/**
 * Qué tamaño de letra aguanta ese texto dentro de 90 px.
 *
 * Se mide por longitud y no con una sola clase para todos porque el vocabulario
 * va de «key» a «en realidad, la verdad es que», y una talla única deja la
 * corta ridícula o la larga cortada. Cortar la traducción no es una opción: es
 * justo lo que hay que leer.
 */
function tamanoDe(texto: string, conEmoji: boolean): string {
  const largo = texto.length;
  if (largo <= 7) return conEmoji ? 'text-sm sm:text-base' : 'text-base sm:text-lg';
  if (largo <= 13) return conEmoji ? 'text-xs sm:text-sm' : 'text-sm sm:text-base';
  if (largo <= 20) return 'text-[10px] sm:text-xs';
  return 'text-[9px] leading-[1.15] sm:text-[11px]';
}

function textoDe(cartas: readonly CartaDelTablero[], donde: Seleccion): string {
  return cartas.find((c) => c.lado === donde.lado && c.id === donde.id)?.texto ?? '';
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
