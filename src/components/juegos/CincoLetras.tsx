import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { Mascota } from '@/components/Mascota';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { Aviso, CabeceraJuego } from './Tablero';
import type {
  EstadoDeCincoLetras,
  EstadoLetra,
  IntentoCorregido,
  IntentoDeCincoLetras,
  Marcador,
  ResultadoFinal,
  RondaDeCincoLetras,
} from './tipos';

/**
 * Cinco letras: la palabra del día.
 *
 * Es el único juego diario, y eso es lo que le faltaba al apartado entero. Los
 * otros se acaban y no dejan nada esperando; este sí, y sin castigar a nadie:
 * no hay racha que perder, es que mañana hay otra palabra.
 *
 *
 * LO QUE NO ESTÁ EN ESTE ARCHIVO
 *
 * La palabra. No está, y no por despiste: si estuviera —aunque fuera para
 * «comprobar de mentira mientras responde el servidor», como hace ESCUCHA— se
 * leería en el código de la página o en la pestaña de red, y el juego dejaría de
 * existir. Aquí se manda la palabra escrita y el servidor devuelve el COLOR de
 * cada letra. Solo al acabar llega la palabra, que es cuando hay que enseñarla.
 *
 * Por eso tampoco se adivina nada en local cuando la petición falla: se dice que
 * no se pudo enviar y el intento no se gasta.
 *
 *
 * EL COLOR NUNCA VA SOLO
 *
 * Verde y amarillo es justo el par que no distingue la forma más común de
 * daltonismo, y este juego es ENTERO esos dos colores. Cada casilla lleva
 * además una marca —✓ en su sitio, ↔ en otro sitio, ✕ no está— que se repite en
 * las teclas, se explica en una leyenda debajo del tablero y se dice con
 * palabras en el nombre accesible de cada casilla.
 */

const LARGO = 5;
const INTENTOS = 6;

/** Cuánto tarda en voltearse una casilla, y cuánto espera la siguiente. */
const VOLTEO_MS = 320;
const ESCALON_MS = 240;

export function CincoLetras({
  ronda,
  onIntentar,
  onTerminar,
  onSalir,
}: {
  ronda: RondaDeCincoLetras;
  /** Manda la palabra escrita y devuelve los colores. Lanza si no se pudo. */
  onIntentar: (palabra: string) => Promise<IntentoCorregido>;
  onTerminar: (marcador: Marcador) => Promise<ResultadoFinal>;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();

  const [intentos, setIntentos] = useState<IntentoDeCincoLetras[]>(ronda.intentos);
  const [estado, setEstado] = useState<EstadoDeCincoLetras>(ronda.estado);
  const [palabra, setPalabra] = useState(ronda.palabra ?? null);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Cambia en cada rechazo para volver a disparar la sacudida de la fila. */
  const [sacudida, setSacudida] = useState(0);
  /** La última fila se está volteando: hasta que acabe no se cuenta nada. */
  const [volteando, setVolteando] = useState(false);

  const [resultado, setResultado] = useState<ResultadoFinal | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [noSeGuardo, setNoSeGuardo] = useState(false);

  /** Si al entrar ya estaba jugada. Se congela: luego cambia y no significaría lo mismo. */
  const [yaVenia] = useState(() => ronda.estado !== 'jugando');

  const acabado = estado !== 'jugando' && !volteando;

  /*
    Las filas que ya CUENTAN.

    Mientras la última se voltea, sus colores todavía no se han visto, así que ni
    las teclas se pintan ni se dice que la partida terminó. Adelantarlo destripa
    el volteo, que es la mitad de la gracia: se sabría el resultado antes de ver
    girar la primera casilla.
  */
  const letrasSabidas = useMemo(
    () => loQueSeSabe(volteando ? intentos.slice(0, -1) : intentos),
    [intentos, volteando],
  );

  const escribir = useCallback(
    (letra: string) => {
      setAviso(null);
      setBorrador((actual) => (actual.length >= LARGO ? actual : actual + letra.toUpperCase()));
    },
    [setBorrador],
  );

  const borrar = useCallback(() => {
    setAviso(null);
    setBorrador((actual) => actual.slice(0, -1));
  }, []);

  const rechazar = useCallback((texto: string) => {
    setAviso(texto);
    setSacudida((n) => n + 1);
    sonar('fallo');
  }, []);

  const enviar = useCallback(async () => {
    if (enviando || volteando || estado !== 'jugando') return;

    if (borrador.length < LARGO) {
      rechazar(`Faltan letras: la palabra tiene ${LARGO}.`);
      return;
    }

    setEnviando(true);
    try {
      const corregido = await onIntentar(borrador);
      setIntentos(corregido.intentos);
      setEstado(corregido.estado);
      if (corregido.palabra) setPalabra(corregido.palabra);
      setBorrador('');
      setAviso(null);
      setVolteando(true);
    } catch (error) {
      // Ni se adivina el color ni se gasta el intento: lo escrito sigue ahí para
      // volver a mandarlo.
      rechazar(error instanceof Error ? error.message : 'No pudimos enviar tu palabra.');
    } finally {
      setEnviando(false);
    }
  }, [borrador, enviando, estado, onIntentar, rechazar, volteando]);

  /** Se acabó el volteo de la última fila. */
  useEffect(() => {
    if (!volteando) return;
    const espera = menosMovimiento ? 0 : (LARGO - 1) * ESCALON_MS + VOLTEO_MS;
    const reloj = setTimeout(() => setVolteando(false), espera);
    return () => clearTimeout(reloj);
  }, [volteando, menosMovimiento]);

  /*
    El sonido de la fila, cuando ya se ha visto entera.

    Arranca en el número de intentos con el que se entró para que volver a una
    partida a medias no suene a nada: lo que suena es lo que acabas de hacer.
  */
  const sonado = useRef(ronda.intentos.length);
  useEffect(() => {
    if (volteando || intentos.length === sonado.current) return;
    sonado.current = intentos.length;

    if (estado === 'ganada') sonar('record');
    else if (estado === 'perdida') sonar('fallo');
    else sonar('tic');
  }, [volteando, intentos.length, estado]);

  /*
    Cerrar la partida en el servidor, una sola vez.

    Se cierra también cuando al entrar ya estaba acabada: el servidor devuelve lo
    mismo sin volver a pagar, y así no se pierden las monedas de quien cerró la
    pestaña antes de que saliera esta petición.
  */
  const cerrado = useRef(false);
  useEffect(() => {
    if (!acabado || cerrado.current) return;
    cerrado.current = true;

    const ganada = estado === 'ganada';
    setGuardando(true);

    onTerminar({
      puntuacion: puntosDe(intentos.length, ganada),
      aciertos: ganada ? 1 : 0,
      total: intentos.length,
    })
      .then(setResultado)
      .catch(() => setNoSeGuardo(true))
      .finally(() => setGuardando(false));
  }, [acabado, estado, intentos.length, onTerminar]);

  /** Las monedas caen cuando ya se sabe cuántas son. */
  useEffect(() => {
    if (!resultado || resultado.monedas <= 0) return;
    const reloj = setTimeout(() => sonar('moneda'), 400);
    return () => clearTimeout(reloj);
  }, [resultado]);

  /*
    El teclado físico.

    Se escucha en la ventana, no en un campo de texto: un `input` de verdad
    abriría el teclado del sistema encima del tablero en el móvil, y este juego
    trae el suyo. Cuando el foco está en una tecla de la pantalla no se hace
    nada, porque entonces el navegador ya va a pulsarla por su cuenta y si no se
    contaría dos veces.
  */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
      if ((evento.target as HTMLElement | null)?.closest('button, input, textarea')) return;

      if (evento.key === 'Enter') {
        evento.preventDefault();
        void enviar();
      } else if (evento.key === 'Backspace') {
        evento.preventDefault();
        borrar();
      } else if (/^[a-zA-Z]$/.test(evento.key)) {
        evento.preventDefault();
        escribir(evento.key);
      }
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [enviar, borrar, escribir]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-2 py-4 sm:px-4">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold leading-none">
            Cinco letras <span className="text-[var(--texto-suave)]">#{ronda.numero}</span>
          </p>
          <p className="text-xs text-[var(--texto-suave)]">
            {acabado
              ? 'La palabra de hoy'
              : `${ronda.intentosMaximos - intentos.length} ${
                  ronda.intentosMaximos - intentos.length === 1 ? 'intento' : 'intentos'
                }`}
          </p>
        </div>
      </CabeceraJuego>

      <Tablero
        intentos={intentos}
        borrador={borrador}
        volteando={volteando}
        sacudida={sacudida}
        menosMovimiento={menosMovimiento}
      />

      <Leyenda />

      {/* Lo que acaba de pasar, dicho con palabras para quien no ve los colores. */}
      <p role="status" className="sr-only">
        {volteando || intentos.length === 0 ? '' : enPalabras(intentos[intentos.length - 1]!)}
      </p>

      {aviso && (
        <div className="mt-3">
          <Aviso tono="aviso">{aviso}</Aviso>
        </div>
      )}

      {/*
        El hueco entre el tablero y el teclado, que no puede quedarse en blanco.

        Es donde se explica lo único que este juego tiene y los otros no: que hay
        UNA palabra, la misma para todo el mundo, y que mañana hay otra. Quien
        entra por primera vez no tiene por qué saberlo, y si no se dice aquí el
        final —«vuelve mañana»— llega como un castigo en vez de como la regla.
      */}
      {!acabado && (
        <div className="grid flex-1 content-center justify-items-center gap-1 px-2 py-4 text-center">
          <p className="text-sm text-[var(--texto-suave)]">
            Una palabra al día, la misma para todo el mundo.
          </p>
          <p className="text-xs text-[var(--texto-suave)]">
            Escríbela abajo o con tu teclado. Mañana hay otra.
          </p>
        </div>
      )}

      {acabado ? (
        <Final
          estado={estado}
          palabra={palabra}
          numero={ronda.numero}
          intentos={intentos}
          resultado={resultado}
          guardando={guardando}
          noSeGuardo={noSeGuardo}
          yaVenia={yaVenia}
          menosMovimiento={menosMovimiento}
          onSalir={onSalir}
        />
      ) : (
        <Teclado
          sabidas={letrasSabidas}
          ocupado={enviando || volteando}
          onLetra={escribir}
          onBorrar={borrar}
          onEnviar={() => void enviar()}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * La cuadrícula: seis filas de cinco.
 *
 * Se pintan siempre las seis, también las vacías. Enseñar solo las jugadas
 * haría que el tablero creciera a cada intento y que no se supiera de un vistazo
 * cuántos quedan, que es la información que decide si se arriesga o no.
 */
function Tablero({
  intentos,
  borrador,
  volteando,
  sacudida,
  menosMovimiento,
}: {
  intentos: IntentoDeCincoLetras[];
  borrador: string;
  volteando: boolean;
  sacudida: number;
  menosMovimiento: boolean;
}) {
  const filaEnCurso = intentos.length;

  return (
    /*
      17rem a 320 px y 19rem en cuanto hay sitio.

      A 320 con barra de desplazamiento quedan 289 px útiles: un tablero de 19rem
      (304) se sale por la derecha y corta la quinta columna, que es exactamente
      la letra que más se mira. Se comprobó ahí antes que en ninguna parte.
    */
    <div className="mx-auto mt-4 grid w-full max-w-[17rem] gap-1.5 min-[360px]:max-w-[19rem]">
      {Array.from({ length: INTENTOS }, (_, fila) => {
        const jugada = intentos[fila];

        if (jugada) {
          return (
            <Fila
              key={fila}
              letras={jugada.letras}
              // Solo la última recién enviada se voltea; las de antes ya se vieron.
              volteo={volteando && fila === intentos.length - 1 && !menosMovimiento}
            />
          );
        }

        if (fila === filaEnCurso) {
          return (
            <Fila
              key={`${fila}-${sacudida}`}
              letras={enBlanco(borrador)}
              sacudir={sacudida > 0 && !menosMovimiento}
            />
          );
        }

        return <Fila key={fila} letras={enBlanco('')} />;
      })}
    </div>
  );
}

function Fila({
  letras,
  volteo = false,
  sacudir = false,
}: {
  letras: Array<LetraEnCasilla>;
  volteo?: boolean;
  sacudir?: boolean;
}) {
  /*
    El volteo, sin keyframes.

    Cada casilla nace de canto —girada 90 grados sobre su eje horizontal, o sea
    invisible— y se endereza con una transición y un retraso creciente. El color
    ya está puesto desde el principio: no se ve porque la casilla está de perfil,
    y aparece cuando gira. Es exactamente lo que hace el original, y así no hay
    que declarar una animación en el CSS global que cualquier limpieza pueda
    llevarse por delante.
  */
  const [abiertas, setAbiertas] = useState(!volteo);

  useEffect(() => {
    if (abiertas) return;
    const cuadro = requestAnimationFrame(() => setAbiertas(true));
    return () => cancelAnimationFrame(cuadro);
  }, [abiertas]);

  return (
    <div
      className={cn('grid grid-cols-5 gap-1.5 [perspective:600px]', sacudir && 'animate-temblor')}
    >
      {letras.map((casilla, i) => (
        <div
          key={i}
          // Con letra es una imagen con nombre, para que un lector de pantalla
          // pueda repasar el tablero casilla a casilla. Vacía no se anuncia:
          // treinta «casilla vacía» seguidas tapan lo que sí importa.
          {...(casilla.letra
            ? { role: 'img', 'aria-label': nombreDeCasilla(casilla, i) }
            : { 'aria-hidden': true })}
          className={cn(
            'grid aspect-square place-items-center rounded-lg border-2 text-2xl font-extrabold uppercase',
            'relative select-none transition-transform ease-out',
            ASPECTO_CASILLA[casilla.estado ?? (casilla.letra ? 'escrita' : 'vacia')],
          )}
          style={
            volteo
              ? {
                  transitionDuration: `${VOLTEO_MS}ms`,
                  transitionDelay: `${i * ESCALON_MS}ms`,
                  transform: abiertas ? 'rotateX(0deg)' : 'rotateX(-90deg)',
                }
              : undefined
          }
        >
          <span aria-hidden>{casilla.letra}</span>

          {/*
            La marca que hace que el color no vaya solo. Pequeña y en la esquina
            para que no compita con la letra, pero de un tamaño que se lee: es lo
            único que distingue verde de amarillo para quien no los separa.
          */}
          {casilla.estado && (
            <span aria-hidden className="absolute right-0.5 top-0 text-[11px] leading-tight">
              {MARCAS[casilla.estado]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Qué significa cada marca, escrito. Sin esto, las marcas son adornos. */
function Leyenda() {
  return (
    <ul className="mx-auto mt-3 flex max-w-[17rem] flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-[var(--texto-suave)] min-[360px]:max-w-[19rem]">
      {(['sitio', 'otra', 'no'] as const).map((estado) => (
        <li key={estado} className="flex items-center gap-1">
          <span
            aria-hidden
            className={cn(
              'grid size-4 place-items-center rounded text-[9px] font-bold',
              ASPECTO_CASILLA[estado],
            )}
          >
            {MARCAS[estado]}
          </span>
          {NOMBRES[estado]}
        </li>
      ))}
    </ul>
  );
}

/**
 * El teclado de la pantalla.
 *
 * Tres filas de QWERTY, como el original y como cualquier teclado de móvil: se
 * busca la tecla sin leerla porque ya se sabe dónde está. Las teclas se van
 * pintando con lo que ya se sabe de cada letra, que es media ayuda del juego.
 *
 * A 320 px de ancho, diez teclas en una fila salen a unos 27 px cada una y no
 * hay forma de que sean más anchas: diez por 44 son 440 px, más que la pantalla.
 * Lo que sí se puede es que sean ALTAS —52 px— y que no haya nada pegado a
 * ellas, que es lo que de verdad evita pulsar la de al lado.
 */
function Teclado({
  sabidas,
  ocupado,
  onLetra,
  onBorrar,
  onEnviar,
}: {
  sabidas: Map<string, EstadoLetra>;
  ocupado: boolean;
  onLetra: (letra: string) => void;
  onBorrar: () => void;
  onEnviar: () => void;
}) {
  return (
    <div className="mt-auto grid gap-1.5 pt-4">
      {FILAS_TECLADO.map((fila, indice) => (
        <div key={indice} className="flex justify-center gap-1">
          {indice === 2 && (
            <Tecla ancha ocupado={ocupado} onPulsar={onEnviar} etiqueta="Enviar la palabra">
              ENVIAR
            </Tecla>
          )}

          {[...fila].map((letra) => (
            <Tecla
              key={letra}
              estado={sabidas.get(letra)}
              ocupado={ocupado}
              onPulsar={() => onLetra(letra)}
              etiqueta={nombreDeTecla(letra, sabidas.get(letra))}
            >
              {letra}
            </Tecla>
          ))}

          {indice === 2 && (
            <Tecla ancha ocupado={ocupado} onPulsar={onBorrar} etiqueta="Borrar la última letra">
              <span aria-hidden>⌫</span>
            </Tecla>
          )}
        </div>
      ))}
    </div>
  );
}

function Tecla({
  children,
  etiqueta,
  estado,
  ancha = false,
  ocupado,
  onPulsar,
}: {
  children: React.ReactNode;
  etiqueta: string;
  estado?: EstadoLetra;
  ancha?: boolean;
  ocupado: boolean;
  onPulsar: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      disabled={ocupado}
      onClick={(evento) => {
        /*
          Al pulsarla con el dedo o el ratón se le quita el foco.

          Si se lo queda, el ENTER del teclado físico vuelve a pulsar ESA tecla
          en vez de enviar la palabra, y quien escribe a máquina se queda
          encerrado sin saber por qué. Cuando se llega a la tecla tabulando
          (`detail` en cero) el foco sí se respeta, que es de lo que depende
          poder jugar sin ratón.
        */
        if (evento.detail > 0) evento.currentTarget.blur();
        onPulsar();
      }}
      className={cn(
        'boton-3d grid min-h-[52px] place-items-center rounded-lg border-b-4 text-sm font-extrabold uppercase',
        ancha ? 'flex-[1.6] px-1 text-[11px]' : 'flex-1',
        // `min-w-0` deja que las diez teclas quepan a 320 px repartiéndose el
        // sitio; sin él, el contenido las empuja y la fila se sale de la pantalla.
        'min-w-0',
        estado ? ASPECTO_TECLA[estado] : 'border-[var(--hueco)] bg-[var(--superficie)]',
      )}
    >
      <span className="flex items-center gap-0.5">
        {children}
        {estado && (
          <span aria-hidden className="text-[9px] leading-none opacity-90">
            {MARCAS[estado]}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * El final: se acabó por hoy.
 *
 * No hay «otra partida», y esa ausencia es el juego. Lo que hay es la palabra,
 * lo que se ganó y los cuadraditos para contarlo sin destriparla.
 */
function Final({
  estado,
  palabra,
  numero,
  intentos,
  resultado,
  guardando,
  noSeGuardo,
  yaVenia,
  menosMovimiento,
  onSalir,
}: {
  estado: EstadoDeCincoLetras;
  palabra: string | null;
  numero: number;
  intentos: IntentoDeCincoLetras[];
  resultado: ResultadoFinal | null;
  guardando: boolean;
  noSeGuardo: boolean;
  yaVenia: boolean;
  menosMovimiento: boolean;
  onSalir: () => void;
}) {
  const ganada = estado === 'ganada';
  const [copiado, setCopiado] = useState(false);
  const [noSeCopio, setNoSeCopio] = useState(false);

  const cuadraditos = useMemo(() => enCuadraditos(intentos), [intentos]);
  const texto = `Speakmi · Cinco letras #${numero}\n${ganada ? intentos.length : 'X'}/${INTENTOS}\n\n${cuadraditos}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setNoSeCopio(false);
      sonar('acierto');
    } catch {
      // Sin permiso de portapapeles, o sin portapapeles. Los cuadraditos están
      // ahí abajo para copiarlos a mano, que es lo único que hacía falta.
      setNoSeCopio(true);
    }
  }

  return (
    <div className="mt-auto pt-5">
      <div className="flex items-center gap-3">
        <div className={cn('shrink-0', !menosMovimiento && 'animate-crecer')}>
          <Mascota estado={ganada ? 'celebrando' : 'animando'} tamano={64} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-lg font-extrabold leading-tight',
              ganada ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto)]',
            )}
          >
            {!ganada
              ? 'Hoy no salió'
              : intentos.length === 1
                ? '¡A la primera!'
                : intentos.length <= 3
                  ? '¡Muy bien!'
                  : '¡Esa era!'}
          </p>
          {/*
            El titular dice cómo fue, no cuándo. Quien vuelve a entrar por la
            tarde ya sabe que jugó; lo que quiere ver es si la sacó y cuál era.
            Que ya está jugada se dice debajo, que es donde importa.
          */}
          <p className="text-sm text-[var(--texto-suave)]">
            {yaVenia && 'Ya la jugaste hoy. '}
            {palabra ? (
              <>
                La palabra era{' '}
                <strong lang="en" className="font-extrabold text-[var(--texto)]">
                  {palabra}
                </strong>
                .
              </>
            ) : (
              'Mañana hay otra.'
            )}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Dato
          etiqueta="Intentos"
          valor={ganada ? `${intentos.length}/${INTENTOS}` : `X/${INTENTOS}`}
        />
        <Dato etiqueta="Puntos" valor={resultado ? resultado.puntuacion : '—'} />
        <Dato
          etiqueta="Monedas"
          valor={resultado ? `+${resultado.monedas}` : '—'}
          destacado={!!resultado && resultado.monedas > 0}
        />
      </dl>

      {guardando && (
        <p role="status" className="mt-3 text-center text-sm text-[var(--texto-suave)]">
          Guardando la partida…
        </p>
      )}

      {noSeGuardo && (
        <div className="mt-3">
          <Aviso tono="aviso">
            No pudimos guardar la partida, así que no suma monedas. La palabra de hoy ya está
            jugada; vuelve mañana.
          </Aviso>
        </div>
      )}

      {/*
        Los cuadraditos, que son lo que se comparte.

        No llevan ni una letra: dicen cómo fue sin decir cuál era, que es lo que
        permite enseñárselo a alguien que todavía no ha jugado.
      */}
      <pre
        aria-label="Tu resultado en cuadraditos, para compartir"
        className="mt-4 overflow-x-auto rounded-2xl bg-[var(--superficie)] p-3 text-center text-base leading-tight"
      >
        {cuadraditos}
      </pre>

      {noSeCopio && (
        <p className="mt-2 text-center text-xs text-[var(--texto-aviso)]">
          Tu navegador no nos deja copiar. Selecciona los cuadraditos de arriba.
        </p>
      )}

      <div className="mt-4 grid gap-2">
        <Boton tamano="grande" tono={copiado ? 'acierto' : 'marca'} onClick={() => void copiar()}>
          {copiado ? '¡COPIADO!' : 'COMPARTIR RESULTADO'}
        </Boton>
        <Boton tono="suave" onClick={onSalir}>
          Volver a los juegos
        </Boton>
      </div>

      <p className="mt-3 text-center text-xs text-[var(--texto-suave)]">
        Mañana hay otra palabra, la misma para todo el mundo.
      </p>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: string | number;
  destacado?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] px-2 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">{etiqueta}</dt>
      <dd
        className={cn(
          'mt-0.5 text-lg font-extrabold tabular-nums',
          destacado && 'text-[var(--texto-aviso)]',
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

interface LetraEnCasilla {
  letra: string;
  /** Sin estado: casilla vacía o escrita pero todavía sin enviar. */
  estado?: EstadoLetra;
}

const FILAS_TECLADO = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

/**
 * Las tres marcas.
 *
 * `✓` está en su sitio, `↔` está pero hay que moverla, `✕` no está. Se eligieron
 * porque significan algo por sí solas: una marca arbitraria habría que
 * aprendérsela, y esto se juega una vez al día.
 */
const MARCAS: Record<EstadoLetra, string> = { sitio: '✓', otra: '↔', no: '✕' };

const NOMBRES: Record<EstadoLetra, string> = {
  sitio: 'en su sitio',
  otra: 'en otro sitio',
  no: 'no está',
};

/*
  Los fondos van en el tono 700 (600 para el gris) y la letra en blanco porque es
  el punto en que los tres pasan de 4.5 de contraste. Con el amarillo típico de
  este juego —un ámbar claro— la letra blanca se queda en 2, y la palabra deja de
  leerse justo en las casillas que más se miran.
*/
const ASPECTO_CASILLA: Record<EstadoLetra | 'vacia' | 'escrita', string> = {
  sitio: 'border-emerald-800 bg-emerald-700 text-white',
  otra: 'border-amber-800 bg-amber-700 text-white',
  no: 'border-slate-700 bg-slate-600 text-white',
  vacia: 'border-[var(--borde)] bg-[var(--superficie)]',
  escrita: 'border-marca-500 bg-[var(--superficie)] text-[var(--texto)]',
};

const ASPECTO_TECLA: Record<EstadoLetra, string> = {
  sitio: 'border-emerald-900 bg-emerald-700 text-white',
  otra: 'border-amber-900 bg-amber-700 text-white',
  no: 'border-slate-800 bg-slate-600 text-white',
};

const CUADROS: Record<EstadoLetra, string> = { sitio: '🟩', otra: '🟨', no: '⬛' };

/** Una fila sin enviar: lo escrito y el resto en blanco. */
function enBlanco(borrador: string): LetraEnCasilla[] {
  return Array.from({ length: LARGO }, (_, i) => ({ letra: borrador[i] ?? '' }));
}

/**
 * Lo que ya se sabe de cada letra, para pintar el teclado.
 *
 * Una letra puede salir de dos colores en intentos distintos —amarilla en uno y
 * verde en otro— y la tecla se queda con el MEJOR de los dos. Al revés sería
 * mentir: una tecla que vuelve de verde a amarillo dice que la letra ya no está
 * donde la acabas de encontrar.
 */
function loQueSeSabe(intentos: IntentoDeCincoLetras[]): Map<string, EstadoLetra> {
  const rango: Record<EstadoLetra, number> = { no: 0, otra: 1, sitio: 2 };
  const sabidas = new Map<string, EstadoLetra>();

  for (const intento of intentos) {
    for (const { letra, estado } of intento.letras) {
      const antes = sabidas.get(letra);
      if (!antes || rango[estado] > rango[antes]) sabidas.set(letra, estado);
    }
  }

  return sabidas;
}

function nombreDeCasilla(casilla: LetraEnCasilla, posicion: number): string {
  if (!casilla.letra) return `Casilla ${posicion + 1}, vacía`;
  if (!casilla.estado) return `Casilla ${posicion + 1}, ${casilla.letra}`;
  return `${casilla.letra}, ${NOMBRES[casilla.estado]}`;
}

function nombreDeTecla(letra: string, estado?: EstadoLetra): string {
  return estado ? `${letra}, ${NOMBRES[estado]}` : letra;
}

/** El último intento, dicho con palabras para quien no ve los colores. */
function enPalabras(intento: IntentoDeCincoLetras): string {
  return `${intento.palabra}: ${intento.letras
    .map(({ letra, estado }) => `${letra} ${NOMBRES[estado]}`)
    .join(', ')}.`;
}

/** El resultado en cuadraditos, sin una sola letra. */
function enCuadraditos(intentos: IntentoDeCincoLetras[]): string {
  return intentos
    .map((intento) => intento.letras.map(({ estado }) => CUADROS[estado]).join(''))
    .join('\n');
}

/**
 * Los puntos, con la misma cuenta que hace el servidor al cerrar.
 *
 * Se calculan aquí también para poder enseñarlos sin esperar a la respuesta, no
 * para decidirlos: lo que vale es lo que devuelva `/fin`, y es lo que se pinta en
 * cuanto llega.
 */
/* No se exporta: sacarla de aquí rompería el refresco en caliente de todo el
   archivo, y fuera no la necesita nadie —quien manda es `/fin`. */
function puntosDe(intentosUsados: number, ganada: boolean): number {
  if (!ganada) return 0;
  return (INTENTOS - Math.min(Math.max(intentosUsados, 1), INTENTOS) + 1) * 10;
}
