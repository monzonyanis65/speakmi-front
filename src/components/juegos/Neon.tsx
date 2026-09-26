import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Mascota } from '@/components/Mascota';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { Aviso, CabeceraJuego, Contador, Racha } from './Tablero';
import { Destello, PuntosGanados } from './efectos';
import { loQueSumaElSiguiente, puntosDelServidor } from './puntos';
import type {
  CasoDeNeon,
  DocumentoDelCaso,
  Marcador,
  PasoDelCaso,
  PersonaDelCaso,
  RondaDeNeon,
  VeredictoDeNeon,
} from './tipos';

/**
 * NEON, «Sombras de neón»: una novela negra que se juega leyendo.
 *
 * Llega un caso con cuatro documentos en inglés y tres sospechosos. Primero se
 * contesta a lo que NO está escrito en ninguna línea —lo que sale de cruzar
 * dos—, después se interroga eligiendo con qué registro se le habla a cada uno,
 * y al final se acusa.
 *
 *
 * POR QUÉ ESTE JUEGO NO TIENE RELOJ, Y NO ES UN OLVIDO
 *
 * Los otros nueve de la casa premian el reflejo: la palabra que cae, la carta
 * de segundo y medio, la partícula en tres segundos. Este va al revés a
 * propósito. Darse cuenta de que dos frases no pueden ser ciertas a la vez no
 * se hace deprisa: deprisa se adivina. Poner un cronómetro aquí convertiría la
 * comprensión lectora en una carrera de escaneo, que es exactamente la
 * habilidad que este juego NO quiere entrenar.
 *
 * De ahí sale otra cosa que ningún otro juego puede tener: la solución se queda
 * entera en el servidor. Sin reloj, esperar la respuesta de la red no le quita
 * nada a nadie, así que no hay ninguna razón para mandar por delante las
 * respuestas de un juego que consiste en averiguarlas.
 *
 *
 * EL EXPEDIENTE SIEMPRE A MANO
 *
 * Dos pestañas, CASO y EXPEDIENTE, y se puede saltar entre ellas sin perder
 * nada. No es una comodidad: es lo que separa este juego de una prueba de
 * memoria. Lo que se mide es si sabes encontrar la grieta leyendo, no si te has
 * aprendido cuatro documentos. Con la pestaña delante, no acordarse de la hora
 * exacta deja de ser un fallo y volver a mirarla pasa a ser justo lo que hace
 * un detective.
 *
 *
 * LA CONSECUENCIA DE EQUIVOCARSE DE REGISTRO
 *
 * No resta puntos: cierra puertas. Cada sospechoso aguanta dos deslices de
 * registro; al segundo se levanta y te quedas sin los turnos que le quedaban,
 * o sea sin los puntos que habrías sacado con ellos. Tutear a un directivo
 * cuesta literalmente el resto de la conversación, que era lo que se pidió.
 *
 *
 * EL MARCADOR ES EL DEL SERVIDOR
 *
 * Cada respuesta se manda y se ESPERA antes de contar nada. Los otros juegos no
 * pueden permitírselo —con una carta de 1,6 segundos hay que pintar el veredicto
 * al instante y mandar el aviso por detrás—, así que ahí el número de la
 * pantalla puede acabar un punto por encima del que cierra el servidor si una
 * petición se pierde. Aquí no: si la petición falla, no se cuenta nada y se
 * ofrece reintentar. El número que sube durante la partida es exactamente el que
 * sale al final.
 */

/** Cómo se llama cada fase en la chapa de arriba del panel. */
const NOMBRE_DE_FASE = {
  expediente: 'Expediente',
  interrogatorio: 'Interrogatorio',
  acusacion: 'Acusación',
} as const;

/** Y el rótulo de cada clase de deducción, que dice qué se está pidiendo. */
const NOMBRE_DE_TIPO = {
  cruce: 'Contradicción',
  inferencia: 'Deducción',
  lexico: 'Qué quiso decir',
} as const;

const NOMBRE_DE_DOCUMENTO = {
  correo: '✉️',
  registro: '▤',
  medico: '✚',
  transcripcion: '❝',
  ficha: '▣',
  nota: '✎',
} as const;

/**
 * Las rayas horizontales del panel.
 *
 * Es todo el «efecto pantalla» que lleva este juego y no se mueve, así que no
 * hace falta apagarlo con `prefers-reduced-motion`: es textura, no animación.
 * Va como degradado repetido y no como imagen porque una imagen serían
 * kilobytes de más en una PWA por tres rayas.
 */
const RAYAS =
  'repeating-linear-gradient(to bottom, rgba(148,233,255,0.05) 0px, rgba(148,233,255,0.05) 1px, transparent 1px, transparent 4px)';

export function Neon({
  ronda,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeNeon;
  onResponder: (rondaId: string, answer: string) => Promise<VeredictoDeNeon>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();

  const caso = ronda.caso;

  const [empezado, setEmpezado] = useState(false);
  const [pestana, setPestana] = useState<'caso' | 'expediente'>('caso');
  const [indice, setIndice] = useState(0);
  const [elegida, setElegida] = useState<number | null>(null);
  const [veredicto, setVeredicto] = useState<VeredictoDeNeon | null>(null);
  const [fallóElEnvío, setFallóElEnvío] = useState(false);

  const [aciertos, setAciertos] = useState(0);
  const [contestadas, setContestadas] = useState(0);
  const [racha, setRacha] = useState(0);
  /*
    La racha viva se rompe al fallar; la que PAGA es la más larga de la partida.
    Se guarda aparte para que el marcador de arriba enseñe exactamente lo que va
    a cerrar el servidor.
  */
  const [rachaMaxima, setRachaMaxima] = useState(0);

  /** Cuántas veces se ha errado el registro con cada sospechoso. */
  const [recelos, setRecelos] = useState<Record<string, number>>({});
  /** Lo que ha ido soltando cada uno. Es la libreta, y se consulta. */
  const [revelaciones, setRevelaciones] = useState<string[]>([]);

  const cerrados = useMemo(
    () =>
      new Set(
        Object.entries(recelos)
          .filter(([, cuantos]) => cuantos >= ronda.recelosParaCerrarse)
          .map(([quien]) => quien),
      ),
    [recelos, ronda.recelosParaCerrarse],
  );

  const paso = caso.pasos[indice];
  const persona = personaDe(caso, paso?.personaId);
  const puntuacion = puntosDelServidor('NEON', aciertos, rachaMaxima);

  /*
    El «vas por la 5 de 14», y esto tuvo un fallo que solo se ve jugando.

    El total baja cuando un sospechoso se levanta, porque sus turnos ya no se
    van a jugar: eso es correcto y es la consecuencia hecha número. Lo que
    estaba mal era CUÁNTAS llevas: se contaban las preguntas anteriores que
    seguían siendo jugables, así que al cerrar a alguien las suyas —ya
    contestadas— dejaban de contar y el marcador retrocedía. Jugando se veía un
    «8 de 14» convertirse en «5 de 8», que se lee como que el juego ha perdido
    la cuenta.
  */
  const contestadasAntes = contestadas - (veredicto ? 1 : 0);
  const quedanPorDelante = useMemo(
    () =>
      // El `+ 1` es la pregunta de AHORA, que cuenta siempre. Sin él, la
      // respuesta que acaba de cerrar a un sospechoso se descontaba a sí misma
      // —su dueño ya está en `cerrados`— y el total bajaba de más.
      caso.pasos.slice(indice + 1).filter((uno) => !uno.personaId || !cerrados.has(uno.personaId))
        .length + 1,
    [caso.pasos, indice, cerrados],
  );
  const jugables = contestadasAntes + quedanPorDelante;

  const marcador = useRef<Marcador>({ puntuacion: 0, aciertos: 0, total: 0 });
  marcador.current = { puntuacion, aciertos, total: contestadas };

  const terminado = useRef(false);
  const terminar = useCallback(() => {
    if (terminado.current) return;
    terminado.current = true;
    onFin(marcador.current);
  }, [onFin]);

  /**
   * Manda la respuesta y ESPERA antes de contar nada.
   *
   * Es lo contrario de lo que hacen CAEN o FALSOS_AMIGOS, y la diferencia es
   * que aquí se puede: no hay carta agotándose mientras se espera. A cambio se
   * gana que el marcador de la pantalla y el del servidor sean el mismo número
   * siempre, sin excepciones y sin depender de que no se pierda una petición.
   */
  const responder = useCallback(
    async (cual: number) => {
      if (!paso || elegida !== null || veredicto) return;

      setElegida(cual);
      setFallóElEnvío(false);

      let salida: VeredictoDeNeon;
      try {
        salida = await onResponder(paso.id, String(cual));
      } catch {
        // No se cuenta nada: ni acierto, ni fallo, ni racha. Se puede reintentar
        // la misma pregunta, que es lo único honesto cuando el servidor no ha
        // llegado a enterarse de la respuesta.
        setElegida(null);
        setFallóElEnvío(true);
        return;
      }

      const acerto = salida.isCorrect;
      const nuevaRacha = acerto ? racha + 1 : 0;

      setVeredicto(salida);
      setContestadas((n) => n + 1);
      setRacha(nuevaRacha);
      setRachaMaxima((mejor) => Math.max(mejor, nuevaRacha));
      if (acerto) setAciertos((n) => n + 1);

      const suelta = salida.feedback?.revelacion;
      if (suelta) setRevelaciones((antes) => [...antes, suelta]);

      // Errar el registro con alguien le sube el recelo. Al segundo se levanta.
      if (!acerto && paso.fase === 'interrogatorio' && paso.personaId) {
        const quien = paso.personaId;
        setRecelos((antes) => ({ ...antes, [quien]: (antes[quien] ?? 0) + 1 }));
      }

      if (!acerto) sonar('fallo');
      else if (nuevaRacha >= 2) sonar('combo', { racha: nuevaRacha });
      else sonar('acierto');
    },
    [paso, elegida, veredicto, onResponder, racha],
  );

  /**
   * A la siguiente pregunta, saltándose a quien ya se haya levantado.
   *
   * El salto es la consecuencia entera de equivocarse de registro: esas
   * preguntas no se contestan, así que sus puntos no se ganan. La acusación
   * final no pertenece a nadie, así que nunca se salta: se puede llegar a
   * acusar habiendo cerrado a los tres, y con lo que digan los documentos basta
   * para acertar.
   */
  const continuar = useCallback(() => {
    setVeredicto(null);
    setElegida(null);

    let siguiente = indice + 1;
    while (
      siguiente < caso.pasos.length &&
      caso.pasos[siguiente]!.personaId &&
      cerrados.has(caso.pasos[siguiente]!.personaId!)
    ) {
      siguiente += 1;
    }

    if (siguiente >= caso.pasos.length) {
      terminar();
      return;
    }

    setIndice(siguiente);
    setPestana('caso');
  }, [indice, caso.pasos, cerrados, terminar]);

  /*
    El teclado, que aquí tiene que poder con TODO el juego: elegir con 1 a 4,
    seguir con Intro y abrir el expediente con la E. Un juego de leer sin
    teclado deja fuera a quien no toca la pantalla, y este es justo el que más
    rato se pasa leyendo.
  */
  const accion = useRef({ responder, continuar, empezado, veredicto, paso });
  accion.current = { responder, continuar, empezado, veredicto, paso };

  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

      const actual = accion.current;

      if (evento.key === 'Enter' || evento.key === ' ') {
        if (!actual.empezado) {
          evento.preventDefault();
          setEmpezado(true);
          return;
        }
        if (actual.veredicto) {
          evento.preventDefault();
          actual.continuar();
        }
        return;
      }

      if (evento.key === 'e' || evento.key === 'E') {
        if (!actual.empezado) return;
        evento.preventDefault();
        setPestana((cual) => (cual === 'caso' ? 'expediente' : 'caso'));
        return;
      }

      const numero = Number(evento.key);
      if (!Number.isInteger(numero) || numero < 1) return;
      if (!actual.empezado || actual.veredicto || !actual.paso) return;
      if (numero > actual.paso.opciones.length) return;

      evento.preventDefault();
      void actual.responder(numero - 1);
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  if (!empezado) {
    return <Briefing caso={caso} onEmpezar={() => setEmpezado(true)} onSalir={onSalir} />;
  }

  if (!paso) return null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-3 py-3 sm:px-4">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold leading-none tabular-nums">
            {Math.min(contestadasAntes + 1, jugables)}
            <span className="text-base font-bold text-[var(--texto-suave)]">/{jugables}</span>
          </p>
          <p className="truncate text-xs text-[var(--texto-suave)]">{caso.titulo}</p>
        </div>
        <Contador
          etiqueta="Puntos"
          valor={puntuacion}
          tono={aciertos > 0 ? 'acierto' : 'normal'}
          vivo
        >
          {veredicto?.isCorrect && (
            <PuntosGanados key={contestadas} puntos={loQueSumaElSiguiente('NEON', aciertos - 1)} />
          )}
        </Contador>
      </CabeceraJuego>

      {veredicto && !menosMovimiento && (
        <Destello key={contestadas} senal={veredicto.isCorrect ? 'acierto' : 'fallo'} />
      )}

      <Pestanas actual={pestana} cuantos={caso.documentos.length} onCambiar={setPestana} />

      {pestana === 'expediente' ? (
        <Expediente caso={caso} revelaciones={revelaciones} cerrados={cerrados} />
      ) : (
        <div className="mt-3 flex-1">
          <Pinganillo
            paso={paso}
            veredicto={veredicto}
            persona={persona}
            racha={racha}
            seCerro={!!persona && cerrados.has(persona.id)}
          />

          <div className="mt-2 min-h-8">
            <Racha racha={racha} />
          </div>

          <Panel paso={paso} persona={persona} recelos={recelos} tope={ronda.recelosParaCerrarse} />

          <ol className="mt-3 grid gap-2">
            {paso.opciones.map((opcion, numero) => (
              <li key={opcion.texto}>
                <BotonDeOpcion
                  numero={numero}
                  texto={opcion.texto}
                  enIngles={paso.fase === 'interrogatorio'}
                  esperando={elegida === numero && !veredicto}
                  elegida={elegida === numero}
                  esLaBuena={
                    !!veredicto &&
                    (veredicto.isCorrect
                      ? elegida === numero
                      : opcion.texto === veredicto.feedback?.correcta)
                  }
                  bloqueada={elegida !== null || !!veredicto}
                  onPulsar={() => void responder(numero)}
                />
              </li>
            ))}
          </ol>

          {fallóElEnvío && (
            <div className="mt-3">
              <Aviso tono="aviso">
                No pudimos mandar esa respuesta, así que no cuenta. Vuelve a elegir cuando tengas
                conexión: la pregunta sigue abierta y no has perdido nada.
              </Aviso>
            </div>
          )}

          {veredicto && (
            <Veredicto
              veredicto={veredicto}
              esElFinal={paso.fase === 'acusacion'}
              seCierra={!!persona && cerrados.has(persona.id)}
              persona={persona}
              onContinuar={continuar}
            />
          )}

          <p className="mt-4 pb-2 text-center text-[11px] leading-snug text-[var(--texto-suave)]">
            Con teclado: 1 a {paso.opciones.length} para elegir, E para el expediente, Intro para
            seguir.
          </p>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────  LA ENTRADA  ──────────────────────────── */

/**
 * El caso, antes de empezar.
 *
 * Existe porque un expediente en frío no es un caso: es una lista de correos.
 * Milo cuenta en tres líneas qué ha pasado y dónde, y eso es lo que convierte
 * leer cuatro documentos en querer saber quién fue. Dura lo que se tarda en
 * leerlo y no vuelve a aparecer.
 */
function Briefing({
  caso,
  onEmpezar,
  onSalir,
}: {
  caso: CasoDeNeon;
  onEmpezar: () => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-3 py-3 sm:px-4">
      <CabeceraJuego onSalir={onSalir} />

      <div className="flex flex-1 flex-col justify-center">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-500/40 bg-slate-950 px-4 py-8 text-center">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: RAYAS }}
          />
          {/*
            El resplandor del rótulo, que es un borrón desenfocado DETRÁS del
            texto y no una sombra sobre las letras. Sobre las letras, a 320 px y
            con el cuerpo pequeño, el neón emborrona justo lo que hay que leer.
          */}
          {!menosMovimiento && (
            <span
              aria-hidden
              className="animate-destello pointer-events-none absolute left-1/2 top-10 h-16 w-48 -translate-x-1/2 rounded-full bg-cyan-400/30 blur-2xl"
            />
          )}

          <p className="relative font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80">
            Caso abierto
          </p>
          <h1
            className="relative mt-2 text-3xl font-extrabold leading-tight text-cyan-100"
            style={{ textShadow: '0 0 18px rgba(34,211,238,0.45)' }}
          >
            {caso.titulo}
          </h1>
          <p className="relative mt-2 text-xs uppercase tracking-widest text-fuchsia-300/80">
            {caso.lugar}
          </p>
        </div>

        <div className="mt-6">
          <MiloDice estado="pensando" texto={caso.gancho} />
        </div>

        <p className="mt-6 text-sm leading-relaxed text-[var(--texto-suave)]">
          Los documentos están en inglés y se pueden consultar en cualquier momento desde la pestaña{' '}
          <strong className="text-[var(--texto)]">EXPEDIENTE</strong>. Esto no es de memoria: es de
          leer.
        </p>

        <button
          type="button"
          onClick={onEmpezar}
          autoFocus
          className="boton-3d mt-8 min-h-14 w-full rounded-2xl border-2 border-cyan-900 bg-cyan-700 text-lg font-extrabold text-white hover:bg-cyan-600"
        >
          ABRIR EL EXPEDIENTE
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────  LAS PESTAÑAS  ──────────────────────────── */

/**
 * CASO y EXPEDIENTE.
 *
 * Dos pestañas y no una ventana emergente, y a 320 px esa decisión se nota: un
 * cuadro flotante sobre un móvil estrecho deja el documento en una columna de
 * nada con la pregunta asomando por los bordes. Cambiando de pestaña, cada cosa
 * se lleva el ancho entero, que es todo el que hay.
 */
function Pestanas({
  actual,
  cuantos,
  onCambiar,
}: {
  actual: 'caso' | 'expediente';
  cuantos: number;
  onCambiar: (cual: 'caso' | 'expediente') => void;
}) {
  return (
    <div
      role="tablist"
      className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[var(--superficie)] p-1"
    >
      {(['caso', 'expediente'] as const).map((cual) => (
        <button
          key={cual}
          type="button"
          role="tab"
          aria-selected={actual === cual}
          onClick={() => onCambiar(cual)}
          className={cn(
            'min-h-10 rounded-lg px-2 text-xs font-extrabold uppercase tracking-wide transition',
            actual === cual
              ? 'bg-cyan-700 text-white'
              : 'text-[var(--texto-suave)] hover:text-[var(--texto)]',
          )}
        >
          {cual === 'caso' ? 'Caso' : `Expediente (${cuantos})`}
        </button>
      ))}
    </div>
  );
}

/* ────────────────────────────  MILO  ──────────────────────────── */

/**
 * Milo por el pinganillo.
 *
 * Aquí no acompaña: trabaja. Avisa de a quién tienes delante antes de abrir la
 * boca, se pone nervioso cuando un sospechoso se cierra y celebra cuando cae la
 * contradicción. Lo que NO hace nunca es dar la respuesta: cuando empuja,
 * empuja hacia dónde mirar.
 */
function Pinganillo({
  paso,
  veredicto,
  persona,
  racha,
  seCerro,
}: {
  paso: PasoDelCaso;
  veredicto: VeredictoDeNeon | null;
  persona: PersonaDelCaso | null;
  racha: number;
  seCerro: boolean;
}) {
  if (veredicto) {
    if (seCerro) {
      return (
        <MiloDice
          estado="triste"
          texto={`${persona?.nombre.split(' ')[0] ?? 'Se'} se ha levantado. Lo que le quedaba por contar se queda con él.`}
        />
      );
    }
    if (veredicto.isCorrect) {
      return (
        <MiloDice
          estado={racha >= 3 ? 'orgulloso' : 'celebrando'}
          texto={
            racha >= 3 ? `${racha} seguidas. Estás dentro.` : '¡Ahí! Eso no se leía a la primera.'
          }
        />
      );
    }
    return <MiloDice estado="animando" texto="Vuelve al expediente. La línea está ahí." />;
  }

  if (paso.avisoDeMilo) return <MiloDice estado="sorprendido" texto={paso.avisoDeMilo} />;

  if (paso.fase === 'acusacion') {
    return <MiloDice estado="pensando" texto="Última. Di un nombre y cerramos el caso." />;
  }

  if (paso.fase === 'interrogatorio') {
    return (
      <MiloDice
        estado="escuchando"
        texto={`Te escucho. Cuidado con cómo se lo dices a ${persona?.nombre.split(' ')[0] ?? 'este'}.`}
      />
    );
  }

  return <MiloDice estado="pensando" texto="Tómate lo que necesites. Aquí no corre el reloj." />;
}

/** Milo pequeño y su línea, en una tira estrecha que cabe en 320 px. */
function MiloDice({
  estado,
  texto,
}: {
  estado: 'pensando' | 'celebrando' | 'animando' | 'escuchando' | 'sorprendido' | 'triste' | 'orgulloso'; // prettier-ignore
  texto: string;
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] px-2 py-1.5"
    >
      <Mascota estado={estado} tamano={38} className="shrink-0" />
      <p className="min-w-0 text-[13px] leading-snug text-[var(--texto-suave)]">{texto}</p>
    </div>
  );
}

/* ────────────────────────────  LA PREGUNTA  ──────────────────────────── */

/**
 * El panel oscuro: la pantalla del terminal.
 *
 * Va oscuro en los dos temas, y es a propósito. Es lo que se está mirando —una
 * pantalla dentro de una habitación— así que no tiene por qué cambiar de color
 * porque el cuarto esté encendido; lo que hay alrededor sí sigue el tema. El
 * contraste de dentro lo controla este archivo: cian 100 y 300 sobre pizarra
 * 950 pasan de largo el 4.5 que hace falta, y eso no depende del ajuste de
 * nadie.
 */
function Panel({
  paso,
  persona,
  recelos,
  tope,
}: {
  paso: PasoDelCaso;
  persona: PersonaDelCaso | null;
  recelos: Record<string, number>;
  tope: number;
}) {
  return (
    <section className="relative mt-2 overflow-hidden rounded-2xl border border-cyan-500/40 bg-slate-950 px-3 py-3">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: RAYAS }}
      />

      <div className="relative flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-cyan-300">
          {NOMBRE_DE_FASE[paso.fase]}
        </span>
        {paso.tipo && (
          <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-fuchsia-300">
            {NOMBRE_DE_TIPO[paso.tipo]}
          </span>
        )}
        {persona && <Guardia persona={persona} fallos={recelos[persona.id] ?? 0} tope={tope} />}
      </div>

      {/* La frase del expediente sobre la que se pregunta, tal cual y en inglés. */}
      {paso.cita && (
        <blockquote
          lang="en"
          className="relative mt-3 border-l-2 border-cyan-400/60 pl-3 text-[13px] italic leading-relaxed text-slate-200"
        >
          «{paso.cita.texto}»
          <cite className="mt-1 block font-mono text-[10px] not-italic uppercase tracking-widest text-cyan-300/70">
            {paso.cita.docId}
          </cite>
        </blockquote>
      )}

      {/*
        Lo que suelta el sospechoso: inglés grande y traducción pequeña debajo.

        La traducción está porque lo que se entrena en este turno NO es entender
        su frase, es elegir con qué registro se le contesta. Sin ella, quien no
        pille una palabra falla por otra cosa distinta de la que se mide, y eso
        es un falso fallo con otro nombre.
      */}
      {paso.dice && (
        <div className="relative mt-3">
          <p
            lang="en"
            className="text-[17px] font-semibold leading-snug text-cyan-50"
            style={{ textShadow: '0 0 14px rgba(34,211,238,0.25)' }}
          >
            «{paso.dice}»
          </p>
          {paso.traduccion && (
            <p className="mt-1.5 text-[12px] leading-snug text-slate-400">{paso.traduccion}</p>
          )}
        </div>
      )}

      <p className="relative mt-3 text-[15px] font-bold leading-snug text-slate-100">
        {paso.fase === 'interrogatorio' ? `Objetivo: ${paso.enunciado}` : paso.enunciado}
      </p>

      {/*
        La ficha, DEBAJO de la pregunta y siempre a la vista.

        Es lo que hace que el registro se pueda preguntar sin trampa. Sin la
        ficha delante, elegir entre «Would you mind…» y «Start talking» sería
        cuestión de gusto y las dos serían defendibles; con ella, la buena se
        deduce del expediente igual que la contradicción. Lo que queda por
        hacer, que es lo difícil, es reconocer cuál de las cuatro frases
        inglesas está en ese registro.
      */}
      {persona && (
        <div className="relative mt-3 rounded-xl bg-slate-900/80 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-300/80">
            Ficha de personal
          </p>
          <p className="mt-1 text-[13px] font-bold text-slate-100">
            {persona.nombre}
            <span className="font-normal text-slate-400"> · {persona.cargo}</span>
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-300">{persona.comoTratarle}</p>
        </div>
      )}
    </section>
  );
}

/**
 * La guardia del sospechoso: cuántos deslices le quedan.
 *
 * Es información y no adorno, así que va escrita además de en puntos: si la
 * consecuencia de errar el registro es perder la conversación, lo mínimo es
 * avisar de cuánto queda para que pase.
 */
function Guardia({
  persona,
  fallos,
  tope,
}: {
  persona: PersonaDelCaso;
  fallos: number;
  tope: number;
}) {
  return (
    <span className="ml-auto inline-flex items-center gap-1">
      <span className="sr-only">
        {persona.nombre} aguanta {Math.max(tope - fallos, 0)} deslices más antes de levantarse.
      </span>
      {Array.from({ length: tope }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            i < tope - fallos ? 'bg-emerald-400' : 'bg-red-500/70',
          )}
        />
      ))}
    </span>
  );
}

/**
 * Una opción.
 *
 * Lleva su número delante porque se puede contestar con el teclado, y el número
 * tiene que estar a la vista o la tecla no existe para quien no lo sepa. El
 * texto va alineado a la izquierda y con `break-words`: son frases enteras, y
 * centradas en 320 px se leen fatal.
 */
function BotonDeOpcion({
  numero,
  texto,
  enIngles,
  esperando,
  elegida,
  esLaBuena,
  bloqueada,
  onPulsar,
}: {
  numero: number;
  texto: string;
  enIngles: boolean;
  esperando: boolean;
  elegida: boolean;
  esLaBuena: boolean;
  bloqueada: boolean;
  onPulsar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPulsar}
      disabled={bloqueada}
      className={cn(
        'flex min-h-12 w-full items-start gap-2 rounded-2xl border-2 px-3 py-2.5 text-left transition',
        esLaBuena
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50'
          : elegida
            ? 'border-red-500 bg-red-50 dark:bg-red-950/50'
            : 'border-[var(--borde)] bg-[var(--superficie)]',
        bloqueada && !elegida && !esLaBuena && 'opacity-50',
        !bloqueada && 'hover:border-cyan-500',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold',
          esLaBuena
            ? 'bg-emerald-600 text-white'
            : elegida
              ? 'bg-red-600 text-white'
              : 'bg-[var(--hueco)] text-[var(--texto-suave)]',
        )}
      >
        {esperando ? '…' : numero + 1}
      </span>
      <span
        {...(enIngles ? { lang: 'en' } : {})}
        className="min-w-0 break-words text-[13px] font-medium leading-snug"
      >
        {texto}
      </span>
    </button>
  );
}

/* ────────────────────────────  EL VEREDICTO  ──────────────────────────── */

/**
 * Lo que se aprende, que es todo lo que este juego tiene que dar al fallar.
 *
 * `refuta` es la línea del expediente que desmiente lo que se eligió, y es lo
 * que separa esto de un examen: fallar sin ver por qué es fallar dos veces, una
 * ahora y otra la próxima vez. Va primero y en grande; el «por qué la buena era
 * la buena» va debajo, porque sin haber entendido el propio error no sirve.
 */
function Veredicto({
  veredicto,
  esElFinal,
  seCierra,
  persona,
  onContinuar,
}: {
  veredicto: VeredictoDeNeon;
  esElFinal: boolean;
  seCierra: boolean;
  persona: PersonaDelCaso | null;
  onContinuar: () => void;
}) {
  const acerto = veredicto.isCorrect;
  const detalle = veredicto.feedback ?? {};

  return (
    <div
      role="status"
      className={cn(
        'mt-3 rounded-2xl px-3 py-3',
        acerto ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40',
      )}
    >
      <p
        className={cn(
          'text-base font-extrabold leading-tight',
          acerto ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-fallo)]',
        )}
      >
        {detalle.message_es ?? (acerto ? 'Eso es.' : 'No.')}
      </p>

      {/* Lo que contesta el sospechoso a LO QUE SE LE DIJO, se acierte o no. */}
      {detalle.reaccion && (
        <p lang="en" className="mt-2 text-[13px] italic leading-relaxed text-[var(--texto)]">
          {detalle.reaccion}
        </p>
      )}

      {!acerto && detalle.refuta && (
        <div className="mt-2 rounded-xl bg-[var(--superficie)] px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--texto-suave)]">
            Lo que dice el expediente
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--texto)]">{detalle.refuta}</p>
        </div>
      )}

      {!acerto && detalle.correcta && (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--texto)]">
          Era: <strong className="font-bold">{detalle.correcta}</strong>
        </p>
      )}

      {detalle.porQue && (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--texto-suave)]">
          {detalle.porQue}
        </p>
      )}

      {detalle.revelacion && (
        <p className="mt-2 rounded-xl bg-cyan-500/10 px-3 py-2 text-[13px] font-semibold leading-relaxed text-[var(--texto)]">
          <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-700 dark:text-cyan-300">
            A la libreta ·{' '}
          </span>
          {detalle.revelacion}
        </p>
      )}

      {seCierra && (
        <p className="mt-2 text-[13px] font-bold leading-relaxed text-[var(--texto-fallo)]">
          {persona?.nombre ?? 'El sospechoso'} se levanta. Te quedas sin lo que le faltaba por
          contar.
        </p>
      )}

      {detalle.cierre && (
        <p className="mt-3 border-t border-[var(--borde)] pt-3 text-[13px] leading-relaxed text-[var(--texto)]">
          {detalle.cierre}
        </p>
      )}

      <button
        type="button"
        onClick={onContinuar}
        autoFocus
        className="boton-3d mt-3 min-h-12 w-full rounded-2xl border-2 border-cyan-900 bg-cyan-700 font-extrabold text-white hover:bg-cyan-600"
      >
        {esElFinal ? 'CERRAR EL CASO' : 'SEGUIR'}
      </button>
    </div>
  );
}

/* ────────────────────────────  EL EXPEDIENTE  ──────────────────────────── */

/**
 * Los documentos, las fichas y la libreta.
 *
 * En acordeón y con uno solo abierto a la vez. Con los cuatro desplegados, a
 * 320 px la pestaña son mil píxeles de desplazamiento y volver al que
 * interesaba cuesta más que leerlo; con uno abierto se navega por los títulos,
 * que es como se usa una carpeta de verdad.
 */
function Expediente({
  caso,
  revelaciones,
  cerrados,
}: {
  caso: CasoDeNeon;
  revelaciones: string[];
  cerrados: Set<string>;
}) {
  const [abierto, setAbierto] = useState<string | null>(caso.documentos[0]?.id ?? null);

  return (
    <div className="mt-3 flex-1 pb-4">
      <ul className="grid gap-2">
        {caso.documentos.map((documento) => (
          <li key={documento.id}>
            <Documento
              documento={documento}
              abierto={abierto === documento.id}
              onAbrir={() => setAbierto((cual) => (cual === documento.id ? null : documento.id))}
            />
          </li>
        ))}
      </ul>

      {/*
        La libreta: lo que han soltado los sospechosos.

        Sin esto, acertar un interrogatorio daba puntos y nada más, y lo que
        suelta un sospechoso es justo lo que hace falta para la acusación. Aquí
        queda anotado y se puede volver a leer, igual que los documentos.
      */}
      <h2 className="mt-5 font-mono text-[11px] uppercase tracking-widest text-[var(--texto-suave)]">
        Libreta ({revelaciones.length})
      </h2>
      {revelaciones.length === 0 ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--texto-suave)]">
          Todavía no has sacado nada de nadie. Lo que sueltan los sospechosos se apunta aquí.
        </p>
      ) : (
        <ul className="mt-2 grid gap-1.5">
          {revelaciones.map((linea, i) => (
            <li
              key={`${i}-${linea.slice(0, 12)}`}
              className="rounded-xl border-l-2 border-cyan-500 bg-[var(--superficie)] px-3 py-2 text-[13px] leading-relaxed"
            >
              {linea}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-5 font-mono text-[11px] uppercase tracking-widest text-[var(--texto-suave)]">
        Personas ({caso.personas.length})
      </h2>
      <ul className="mt-2 grid gap-2">
        {caso.personas.map((persona) => (
          <li
            key={persona.id}
            className="rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] px-3 py-2"
          >
            <p className="text-[13px] font-bold">
              {persona.nombre}
              <span className="font-normal text-[var(--texto-suave)]"> · {persona.cargo}</span>
              {cerrados.has(persona.id) && (
                <span className="ml-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--texto-fallo)]">
                  se cerró
                </span>
              )}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--texto-suave)]">
              {persona.comoTratarle}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Documento({
  documento,
  abierto,
  onAbrir,
}: {
  documento: DocumentoDelCaso;
  abierto: boolean;
  onAbrir: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950">
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={abierto}
        className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span aria-hidden className="shrink-0 text-base text-cyan-300">
          {NOMBRE_DE_DOCUMENTO[documento.tipo]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-cyan-100">
            {documento.titulo}
          </span>
          {(documento.de ?? documento.cuando) && (
            <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-cyan-300/60">
              {[documento.de, documento.cuando].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <span aria-hidden className="shrink-0 text-cyan-300/70">
          {abierto ? '▾' : '▸'}
        </span>
      </button>

      {abierto && (
        <div className="relative border-t border-cyan-500/20 px-3 py-3">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: RAYAS }}
          />

          {documento.para && (
            <p className="relative font-mono text-[10px] uppercase tracking-wide text-cyan-300/60">
              Para: {documento.para}
            </p>
          )}

          {/*
            El cuerpo: inglés, sin traducir y con `leading-relaxed`.

            El interlineado holgado no es estética. A 320 px un párrafo inglés de
            cuarenta palabras en un móvil son seis líneas muy juntas, y leyendo
            en un idioma que no es el tuyo se salta de renglón continuamente.
          */}
          <div className="relative mt-1 grid gap-2">
            {documento.lineas.map((linea, i) => (
              <p
                key={`${i}-${linea.slice(0, 12)}`}
                lang="en"
                className="break-words text-[13px] leading-relaxed text-slate-200"
              >
                {linea}
              </p>
            ))}
          </div>

          {documento.glosario.length > 0 && (
            <dl className="relative mt-3 grid gap-1 border-t border-cyan-500/20 pt-2">
              {documento.glosario.map((palabra) => (
                <div key={palabra.en} className="flex flex-wrap gap-x-2 text-[11px] leading-snug">
                  <dt lang="en" className="font-bold text-cyan-300">
                    {palabra.en}
                  </dt>
                  <dd className="min-w-0 text-slate-400">{palabra.es}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────  AYUDANTES  ──────────────────────────── */

function personaDe(caso: CasoDeNeon, id: string | undefined): PersonaDelCaso | null {
  if (!id) return null;
  return caso.personas.find((persona) => persona.id === id) ?? null;
}
