import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { Mascota } from '@/components/Mascota';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { Aviso, CabeceraJuego, Contador, Racha } from './Tablero';
import { Destello, PuntosGanados } from './efectos';
import { loQueSumaElSiguiente, puntosDelServidor } from './puntos';
import type {
  EncargoDeMercado,
  FeedbackDeForja,
  FeedbackDeRegateo,
  Marcador,
  RespuestaDeMercado,
  RondaDeMercado,
} from './tipos';

/**
 * EL MERCADO DE CONTRABANDO: el único juego de la casa en el que no se
 * responde, se FABRICA.
 *
 * Llega un cliente al puesto y pide algo en español, sin decir cómo se dice:
 * «que la lámpara ya está arreglada, y sin decir cuándo». En la mesa de trabajo
 * hay un cajón de runas de sintaxis —trozos de frase— y con ellas hay que
 * montar el objeto EXACTO que pidió. Después viene la caja, y ahí el cliente
 * regatea: contestarle con el verbo compuesto equivocado le ofende y cuesta un
 * sello de reputación.
 *
 *
 * POR QUÉ ESTO NO ES UN ORDENAR-PALABRAS
 *
 * Porque en el cajón SOBRAN RUNAS, y esa es toda la diferencia. Este
 * repositorio ya se comió el fallo contrario y está contado entero en
 * `back/src/shared/barajar.ts`: los 63 ejercicios de ordenar palabras traían
 * las fichas ya en orden, así que se aprobaban los 63 pulsando «enviar» sin
 * leer. Y aunque hubieran venido revueltas, con las fichas justas el juego se
 * resuelve sabiendo el orden de las palabras inglesas, que es mucho más fácil
 * que saber qué tiempo verbal pide el encargo.
 *
 * Aquí cada encargo trae dos o tres señuelos además de las piezas buenas, y
 * cada señuelo le disputa el sitio a una pieza concreta: `was` contra
 * `has been`, `since` contra `for`, `hand-braiding` contra `hand-braided`.
 * Todos caben, todos existen, ninguno se puede tachar sin saber inglés. Está
 * medido por fuerza bruta en `back/tests/mercado.test.ts`: quien sepa
 * perfectamente el orden de las palabras inglesas pero no la gramática del
 * encargo acierta alrededor de uno de cada treinta y cinco.
 *
 *
 * POR QUÉ SE TOCA Y NO SE ARRASTRA
 *
 * El encargo hablaba de arrastrar, y CAEN ya explica por qué lo quitó: una
 * diana que se mueve no se puede arrastrar sin elegir entre que se te escape
 * del dedo o que se congele mientras la sujetas. Aquí las piezas están quietas,
 * así que ese argumento no vale y había que decidir de nuevo.
 *
 * Se toca igualmente, por otro motivo. En 320 px una runa mide unos 90 px de
 * ancho y el cajón tiene siete; arrastrar una pieza hasta un hueco concreto de
 * una fila que además se va reorganizando es puntería fina en un espacio
 * diminuto, y en un móvil el dedo tapa justo lo que hay que mirar. Tocando, el
 * gesto es el mismo que ya usan PAREJAS y CAEN, funciona igual con el dedo y
 * con el teclado, y REORDENAR —que es lo que un arrastre haría bien— se
 * resuelve con las flechas de la mesa: se toca una runa puesta y se mueve de
 * sitio sin sacarla. Eso es lo que un ordenar-palabras normal no deja hacer.
 *
 *
 * QUÉ CUESTA CADA COSA
 *
 * Forjar mal NO cuesta reputación. Equivocarse de tiempo verbal es exactamente
 * para lo que se viene a este juego, y cobrarlo dos veces sería castigar por
 * aprender. Lo que cuesta un sello es ofender al cliente en el regateo, que no
 * es un error de conocimiento sino de trato. Con tres sellos se puede ofender
 * dos veces y seguir jugando; a la tercera, el puesto se cierra.
 *
 *
 * LA PUNTUACIÓN LA CUENTA EL SERVIDOR
 *
 * Y aquí, además, el servidor es quien CORRIGE: la ronda llega sin soluciones,
 * así que cada forja y cada regateo viajan y se espera la respuesta. Eso lo
 * permite no tener reloj. El número que se ve subir sale de `puntos.ts`, que es
 * la misma fórmula que cerrará la partida, contada sobre los aciertos que el
 * propio servidor acaba de devolver.
 */

/**
 * El feedback del servidor, puesto en forma antes de pintarlo.
 *
 * No es paranoia gratuita: lo que llega es `unknown` para el tipado de la API,
 * y si un día el servidor mandara una corrección sin `senuelos` —un despliegue
 * a medias, una versión vieja— el `.map` reventaría la pantalla entera en
 * mitad de la partida. Un campo que falta tiene que verse como un hueco, no
 * como un juego roto.
 */
function comoForja(feedback: unknown): FeedbackDeForja {
  const suyo = (feedback ?? {}) as Partial<FeedbackDeForja>;
  return {
    message_es: suyo.message_es ?? '',
    correcta: suyo.correcta ?? '',
    tuya: suyo.tuya ?? '',
    leccionEs: suyo.leccionEs ?? '',
    senuelos: Array.isArray(suyo.senuelos) ? suyo.senuelos : [],
  };
}

function comoRegateo(feedback: unknown): FeedbackDeRegateo {
  const suyo = (feedback ?? {}) as Partial<FeedbackDeRegateo>;
  return {
    message_es: suyo.message_es ?? '',
    correcta: suyo.correcta ?? '',
    significadoEs: suyo.significadoEs ?? '',
    dijiste: suyo.dijiste ?? '',
    dijisteSignificado: suyo.dijisteSignificado ?? '',
    ofende: suyo.ofende === true,
    leccionEs: suyo.leccionEs ?? '',
  };
}

/** El identificador de cada mitad de un cliente, como lo espera el servidor. */
function claveDe(encargoId: string, fase: 'forja' | 'regateo'): string {
  return `${encargoId}-${fase}`;
}

type Fase = 'forja' | 'resultado-forja' | 'regateo' | 'resultado-regateo';

interface Entregado {
  acierto: boolean;
  feedback: FeedbackDeForja;
}

interface Cobrado {
  acierto: boolean;
  ofende: boolean;
  feedback: FeedbackDeRegateo;
}

export function Mercado({
  ronda,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeMercado;
  onResponder: (rondaId: string, answer: string | string[]) => Promise<RespuestaDeMercado>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();

  const [indice, setIndice] = useState(0);
  const [fase, setFase] = useState<Fase>('forja');

  /** Las runas puestas en la mesa, en el orden en que se montó la frase. */
  const [mesa, setMesa] = useState<string[]>([]);
  /** Cuál está seleccionada para moverla o quitarla. */
  const [elegida, setElegida] = useState<string | null>(null);

  const [entregado, setEntregado] = useState<Entregado | null>(null);
  const [cobrado, setCobrado] = useState<Cobrado | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const [reputacion, setReputacion] = useState(ronda.reputacion);
  const [aciertos, setAciertos] = useState(0);
  const [contestadas, setContestadas] = useState(0);
  const [racha, setRacha] = useState(0);
  const [rachaMaxima, setRachaMaxima] = useState(0);

  const encargo: EncargoDeMercado | undefined = ronda.encargos[indice];

  // La misma cuenta que hará el servidor al cerrar. Ver `puntos.ts`, que explica
  // por qué se calcula también aquí en vez de esperar al final.
  const puntuacion = puntosDelServidor('MERCADO', aciertos, rachaMaxima);

  const marcador = useRef<Marcador>({ puntuacion: 0, aciertos: 0, total: 0 });
  marcador.current = { puntuacion, aciertos, total: contestadas };

  const cerrada = useRef(false);
  const terminar = useCallback(() => {
    if (cerrada.current) return;
    cerrada.current = true;
    onFin(marcador.current);
  }, [onFin]);

  /** Apunta lo que acaba de corregir el servidor, que es lo único que cuenta. */
  const anotar = useCallback((acierto: boolean) => {
    setContestadas((n) => n + 1);
    setRacha((anterior) => {
      const nueva = acierto ? anterior + 1 : 0;
      setRachaMaxima((mejor) => Math.max(mejor, nueva));
      return nueva;
    });
    if (acierto) setAciertos((n) => n + 1);
  }, []);

  const runasPuestas = useMemo(() => {
    if (!encargo) return [];
    const porId = new Map(encargo.runas.map((runa) => [runa.id, runa.texto]));
    return mesa.map((id) => ({ id, texto: porId.get(id) ?? '' }));
  }, [encargo, mesa]);

  const enElCajon = useMemo(
    () => (encargo ? encargo.runas.filter((runa) => !mesa.includes(runa.id)) : []),
    [encargo, mesa],
  );

  const poner = useCallback((runaId: string) => {
    setMesa((anterior) => (anterior.includes(runaId) ? anterior : [...anterior, runaId]));
    setElegida(null);
    sonar('tic');
  }, []);

  const quitar = useCallback((runaId: string) => {
    setMesa((anterior) => anterior.filter((id) => id !== runaId));
    setElegida((actual) => (actual === runaId ? null : actual));
    sonar('tic');
  }, []);

  /**
   * Mueve una runa puesta un sitio a la izquierda o a la derecha.
   *
   * Es lo que hace un arrastre y lo que un ordenar-palabras normal no tiene:
   * allí, para colocar una pieza en medio, hay que sacar todas las de detrás.
   * Aquí se elige la runa y se empuja, con el dedo o con las flechas.
   */
  const mover = useCallback((runaId: string, direccion: -1 | 1) => {
    setMesa((anterior) => {
      const desde = anterior.indexOf(runaId);
      const hasta = desde + direccion;
      if (desde < 0 || hasta < 0 || hasta >= anterior.length) return anterior;
      const copia = [...anterior];
      copia[desde] = copia[hasta]!;
      copia[hasta] = runaId;
      return copia;
    });
  }, []);

  /**
   * Manda una mitad al servidor y espera.
   *
   * Se espera de verdad —no se pinta el resultado antes— porque la ronda llegó
   * SIN soluciones: aquí el navegador no sabe si acertó hasta que se lo dicen.
   * Es lo que permite que este juego no tenga la grieta de los demás, y lo
   * puede permitir porque no hay reloj: nadie pierde una partida por trescientos
   * milisegundos de red mientras monta una frase.
   */
  const mandar = useCallback(
    async (fasePedida: 'forja' | 'regateo', respuesta: string | string[]) => {
      if (!encargo || enviando) return null;
      setEnviando(true);
      setFallo(null);
      try {
        return await onResponder(claveDe(encargo.id, fasePedida), respuesta);
      } catch {
        setFallo('No pudimos entregarlo. Inténtalo otra vez.');
        return null;
      } finally {
        setEnviando(false);
      }
    },
    [encargo, enviando, onResponder],
  );

  const forjar = useCallback(async () => {
    if (!encargo || mesa.length === 0 || fase !== 'forja') return;

    const corregida = await mandar('forja', mesa);
    if (!corregida) return;

    const acierto = corregida.isCorrect;
    anotar(acierto);
    setEntregado({ acierto, feedback: comoForja(corregida.feedback) });
    setFase('resultado-forja');
    sonar(acierto ? 'acierto' : 'fallo', { racha: racha + 1 });
  }, [anotar, encargo, fase, mandar, mesa, racha]);

  const regatear = useCallback(
    async (opcionId: string) => {
      if (!encargo || fase !== 'regateo') return;

      const corregida = await mandar('regateo', opcionId);
      if (!corregida) return;

      const acierto = corregida.isCorrect;
      /*
        `ofende` se lee DEL FEEDBACK y no del primer nivel de la respuesta.

        Salió jugando de verdad: el servicio de juegos devuelve siempre
        `{ isCorrect, feedback }` —es la forma que comparten los diez juegos— y
        el `ofende` que calcula `corregirRegateo` viaja dentro del feedback.
        Leyéndolo de fuera venía `undefined` y ofender no costaba ningún sello:
        el marcador de reputación era un adorno que nunca bajaba.
      */
      const feedback = comoRegateo(corregida.feedback);
      const ofende = feedback.ofende;
      anotar(acierto);
      setCobrado({ acierto, ofende, feedback });
      setFase('resultado-regateo');

      if (ofende) setReputacion((sellos) => Math.max(0, sellos - 1));
      // El fallo que solo pierde la venta se lleva un tic seco; el gruñido se
      // reserva para el que además ofende, que es el único que cuesta algo. Es
      // la misma regla que sigue CAEN: sonar el castigo grande en el fallo
      // barato es lo que hace que se juegue con miedo.
      sonar(acierto ? 'acierto' : ofende ? 'fallo' : 'tic', { racha: racha + 1 });
    },
    [anotar, encargo, fase, mandar, racha],
  );

  const seguir = useCallback(() => {
    if (fase === 'resultado-forja') {
      setFase('regateo');
      return;
    }
    if (fase !== 'resultado-regateo') return;

    setEntregado(null);
    setCobrado(null);
    setMesa([]);
    setElegida(null);
    setFase('forja');
    setIndice((n) => n + 1);
  }, [fase]);

  /*
    Se acabó: o no quedan clientes, o el puesto se cerró por reputación.

    La reputación la lleva esta pantalla a partir del `ofende` que devuelve el
    servidor, y no al revés. No hace falta que el servidor la sepa: cerrar antes
    solo significa menos respuestas, o sea MENOS puntos, así que no hay nada que
    ganar tirándola.
  */
  const puestoCerrado = reputacion === 0 && fase === 'resultado-regateo';
  const seAcabo = !encargo;

  useEffect(() => {
    if (seAcabo) terminar();
  }, [seAcabo, terminar]);

  /*
    Jugar sin tocar la pantalla.

    Del 1 al 9 se coge una runa del cajón por su número, y del 1 al 4 se elige
    la respuesta del regateo. Retroceso quita la última puesta; con una runa
    elegida, las flechas la mueven de sitio y Suprimir la saca. Enter forja y
    Enter sigue. Va en la ventana y no en un contenedor con foco porque las
    runas del cajón se renumeran al poner y quitar, y un orden de tabulación que
    cambia solo es peor que no tener ninguno; los botones siguen siendo botones
    y el tabulador sigue funcionando para quien lo prefiera.
  */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

      // En un campo de texto no hay campos en este juego, pero el botón de
      // salir sí recibe foco: el espacio tiene que seguir pulsándolo.
      const enBoton = (evento.target as HTMLElement | null)?.tagName === 'BUTTON';

      if (fase === 'resultado-forja' || fase === 'resultado-regateo') {
        if (evento.key === 'Enter' || (evento.key === ' ' && !enBoton)) {
          evento.preventDefault();
          if (!puestoCerrado) seguir();
        }
        return;
      }

      if (fase === 'regateo') {
        const numero = Number(evento.key);
        const opcion = encargo?.regateo.opciones[numero - 1];
        if (!Number.isInteger(numero) || !opcion) return;
        evento.preventDefault();
        void regatear(opcion.id);
        return;
      }

      if (evento.key === 'Enter') {
        evento.preventDefault();
        void forjar();
        return;
      }

      if (elegida && (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight')) {
        evento.preventDefault();
        mover(elegida, evento.key === 'ArrowLeft' ? -1 : 1);
        return;
      }

      if (evento.key === 'Backspace' || evento.key === 'Delete') {
        evento.preventDefault();
        const objetivo = elegida ?? mesa[mesa.length - 1];
        if (objetivo) quitar(objetivo);
        return;
      }

      const numero = Number(evento.key);
      const runa = enElCajon[numero - 1];
      if (!Number.isInteger(numero) || !runa) return;
      evento.preventDefault();
      poner(runa.id);
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [
    elegida,
    encargo,
    enElCajon,
    fase,
    forjar,
    mesa,
    mover,
    poner,
    puestoCerrado,
    quitar,
    regatear,
    seguir,
  ]);

  if (!encargo) return <Cerrando onSalir={onSalir} />;

  const enResultado = fase === 'resultado-forja' || fase === 'resultado-regateo';
  const ultimoAcierto = fase === 'resultado-forja' ? entregado?.acierto : cobrado?.acierto;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-3 py-3 sm:px-4">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <Reputacion sellos={reputacion} total={ronda.reputacion} />
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
            Cliente {indice + 1} de {ronda.encargos.length}
          </p>
        </div>
        <Contador
          etiqueta="Puntos"
          valor={puntuacion}
          tono={aciertos > 0 ? 'acierto' : 'normal'}
          vivo
        >
          {enResultado && ultimoAcierto === true && (
            <PuntosGanados
              key={contestadas}
              puntos={loQueSumaElSiguiente('MERCADO', aciertos - 1)}
            />
          )}
        </Contador>
      </CabeceraJuego>

      {enResultado && ultimoAcierto !== undefined && (
        <Destello key={contestadas} senal={ultimoAcierto ? 'acierto' : 'fallo'} />
      )}

      <div className="mt-1 flex min-h-8 items-center justify-center">
        <Racha racha={racha} />
      </div>

      <Puesto
        encargo={encargo}
        fase={fase}
        entregado={entregado}
        cobrado={cobrado}
        menosMovimiento={menosMovimiento}
      />

      {fallo && (
        <div className="mt-2">
          <Aviso>{fallo}</Aviso>
        </div>
      )}

      {fase === 'forja' && (
        <Taller
          runasPuestas={runasPuestas}
          enElCajon={enElCajon}
          elegida={elegida}
          enviando={enviando}
          onElegir={setElegida}
          onPoner={poner}
          onQuitar={quitar}
          onMover={mover}
          onForjar={() => void forjar()}
        />
      )}

      {fase === 'resultado-forja' && entregado && (
        <LoQueEnsena
          titulo={entregado.feedback.message_es}
          acierto={entregado.acierto}
          onSeguir={seguir}
          textoBoton="A COBRAR"
        >
          <p
            className="text-base font-extrabold leading-snug text-[var(--texto-acierto)]"
            lang="en"
          >
            {entregado.feedback.correcta}
          </p>
          {!entregado.acierto && (
            <p
              className="mt-1 text-sm font-bold leading-snug text-[var(--texto-fallo)] line-through"
              lang="en"
            >
              {entregado.feedback.tuya}
            </p>
          )}
          {entregado.feedback.senuelos.map((senuelo) => (
            <p key={senuelo.texto} className="mt-2 text-xs leading-snug">
              <span lang="en" className="font-bold">
                {senuelo.texto}
              </span>
              : {senuelo.porQue}
            </p>
          ))}
          {entregado.feedback.leccionEs && <MiloDice texto={entregado.feedback.leccionEs} />}
        </LoQueEnsena>
      )}

      {fase === 'regateo' && (
        <Caja
          encargo={encargo}
          entregado={entregado}
          enviando={enviando}
          onElegir={(opcionId) => void regatear(opcionId)}
        />
      )}

      {fase === 'resultado-regateo' && cobrado && (
        <LoQueEnsena
          titulo={cobrado.feedback.message_es}
          acierto={cobrado.acierto}
          onSeguir={seguir}
          textoBoton={
            indice + 1 >= ronda.encargos.length ? 'CERRAR EL PUESTO' : 'SIGUIENTE CLIENTE'
          }
          cerrado={puestoCerrado}
          onCerrar={terminar}
        >
          <p
            className="text-base font-extrabold leading-snug text-[var(--texto-acierto)]"
            lang="en"
          >
            {cobrado.feedback.correcta}
          </p>
          <p className="text-xs text-[var(--texto-suave)]">= {cobrado.feedback.significadoEs}</p>

          {!cobrado.acierto && (
            <p className="mt-2 text-xs leading-snug">
              Tú dijiste{' '}
              <span lang="en" className="font-bold text-[var(--texto-fallo)]">
                {cobrado.feedback.dijiste}
              </span>
              , que es {cobrado.feedback.dijisteSignificado}.
            </p>
          )}

          {cobrado.feedback.leccionEs && <MiloDice texto={cobrado.feedback.leccionEs} />}

          {puestoCerrado && (
            <p className="mt-2 text-sm font-bold text-[var(--texto-fallo)]">
              Se acabaron los sellos. El mercado te cierra el puesto por hoy.
            </p>
          )}
        </LoQueEnsena>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* El puesto: el cliente, lo que pide y Milo mirando desde al lado.    */
/* ------------------------------------------------------------------ */

/**
 * El cliente con su bocadillo, y Milo asomado desde el puesto de al lado.
 *
 * Milo NO reacciona mientras se monta la frase, y eso es a propósito: si
 * pusiera cara de susto al colocar un señuelo, estaría dando la respuesta, y
 * entonces el banco de runas dejaría de servir para nada. Mira y piensa
 * mientras se trabaja; reacciona cuando ya no hay nada que delatar.
 */
function Puesto({
  encargo,
  fase,
  entregado,
  cobrado,
  menosMovimiento,
}: {
  encargo: EncargoDeMercado;
  fase: Fase;
  entregado: Entregado | null;
  cobrado: Cobrado | null;
  menosMovimiento: boolean;
}) {
  const enRegateo = fase === 'regateo' || fase === 'resultado-regateo';

  return (
    <section className="mt-1 flex items-start gap-2">
      <span aria-hidden className="mt-1 shrink-0 text-3xl leading-none" title={encargo.clienteEs}>
        {encargo.emoji}
      </span>

      <div
        className={cn(
          'relative min-w-0 flex-1 rounded-2xl border-2 bg-[var(--superficie)] px-3 py-2',
          cobrado?.ofende
            ? 'border-red-400 dark:border-red-700'
            : 'border-amber-300 dark:border-amber-800',
          !menosMovimiento && 'animate-entrada',
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--texto-suave)]">
          {encargo.clienteEs}
          <span className="ml-1 rounded-full bg-[var(--hueco)] px-1.5 py-px text-[9px] font-extrabold">
            {encargo.nivel}
          </span>
        </p>

        {enRegateo ? (
          <>
            <p className="mt-1 text-[11px] leading-snug text-[var(--texto-suave)]">
              {encargo.regateo.contextoEs}
            </p>
            <p lang="en" className="mt-1 text-base font-bold leading-snug">
              «{encargo.regateo.clienteEn}»
            </p>
          </>
        ) : (
          <p lang="es" className="mt-1 text-sm font-bold leading-snug">
            «{encargo.demandaEs}»
          </p>
        )}
      </div>

      <div className="shrink-0 self-end">
        <Mascota especie="PET_MILO" estado={estadoDeMilo(fase, entregado, cobrado)} tamano={52} />
      </div>
    </section>
  );
}

/**
 * Qué cara pone Milo, que es el del puesto de al lado.
 *
 * Reacciona a lo que pasa y nunca antes: piensa mientras se monta el objeto,
 * escucha mientras el cliente regatea, celebra la venta buena y se lleva las
 * alas a la cara cuando le sueltas una grosería a un cliente. Lo importante es
 * lo que NO hace: durante la forja no cambia de cara pase lo que pase, porque
 * cualquier reacción a una runa colocada sería la respuesta.
 */
function estadoDeMilo(fase: Fase, entregado: Entregado | null, cobrado: Cobrado | null) {
  if (fase === 'forja') return 'pensando' as const;
  if (fase === 'resultado-forja') return entregado?.acierto ? 'celebrando' : ('animando' as const);
  if (fase === 'regateo') return 'escuchando' as const;
  if (cobrado?.ofende) return 'sorprendido' as const;
  if (cobrado?.acierto) return entregado?.acierto ? 'orgulloso' : ('feliz' as const);
  return 'animando' as const;
}

/** Lo que dice Milo al acabar un cliente: la lección, no la corrección. */
function MiloDice({ texto }: { texto: string }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[var(--hueco)] px-2.5 py-2 text-xs leading-snug">
      <span aria-hidden className="text-sm leading-none">
        🦉
      </span>
      <span>
        <span className="sr-only">Milo dice: </span>
        {texto}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* La mesa de trabajo y el cajón de runas.                             */
/* ------------------------------------------------------------------ */

/**
 * La mesa de trabajo: arriba el objeto que se está forjando, abajo el cajón.
 *
 * El objeto se pinta como UNA barra continua y no como fichas sueltas: las
 * runas van pegadas, con una costura fina entre ellas y las puntas redondeadas
 * solo en los extremos. Importa porque lo que se está haciendo es una cosa, no
 * una lista, y verla crecer de izquierda a derecha es la mitad de la gracia.
 *
 * Debajo va la frase leída como se leería de verdad, con su mayúscula y su
 * punto. Ese renglón es lo que dice si el objeto está terminado, y es a
 * propósito lo único que lo dice: el servidor NO manda cuántas runas hacen
 * falta, porque mandarlo dejaría el encargo en «elige 4 de 7».
 */
function Taller({
  runasPuestas,
  enElCajon,
  elegida,
  enviando,
  onElegir,
  onPoner,
  onQuitar,
  onMover,
  onForjar,
}: {
  runasPuestas: Array<{ id: string; texto: string }>;
  enElCajon: Array<{ id: string; texto: string }>;
  elegida: string | null;
  enviando: boolean;
  onElegir: (runaId: string | null) => void;
  onPoner: (runaId: string) => void;
  onQuitar: (runaId: string) => void;
  onMover: (runaId: string, direccion: -1 | 1) => void;
  onForjar: () => void;
}) {
  const sitio = elegida ? runasPuestas.findIndex((runa) => runa.id === elegida) : -1;
  const frase = leerFrase(runasPuestas.map((runa) => runa.texto));

  return (
    <div className="mt-2 flex flex-1 flex-col">
      <h2 className="text-[10px] font-bold uppercase tracking-wide text-[var(--texto-suave)]">
        La mesa de trabajo
      </h2>

      <div
        className={cn(
          'mt-1 min-h-[76px] rounded-2xl border-2 border-dashed p-2',
          runasPuestas.length > 0
            ? 'border-amber-400 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30'
            : 'border-[var(--borde)]',
        )}
      >
        {runasPuestas.length === 0 ? (
          <p className="px-1 py-3 text-center text-xs text-[var(--texto-suave)]">
            Toca las runas de abajo para montar lo que el cliente pide.
          </p>
        ) : (
          <ul className="flex flex-wrap items-center gap-y-1.5" aria-label="El objeto que forjas">
            {runasPuestas.map((runa, posicion) => (
              <li key={runa.id} className="flex items-center">
                <button
                  type="button"
                  lang="en"
                  aria-pressed={elegida === runa.id}
                  onClick={() => onElegir(elegida === runa.id ? null : runa.id)}
                  className={cn(
                    // Las runas van pegadas y solo se redondean los extremos:
                    // lo que se monta es un objeto, no una lista de fichas.
                    'min-h-[44px] border-y-2 px-2 py-1 text-sm font-extrabold leading-tight',
                    'border-amber-600 bg-amber-200 text-amber-950',
                    'dark:border-amber-500 dark:bg-amber-900 dark:text-amber-50',
                    posicion === 0 && 'rounded-l-lg border-l-2',
                    posicion === runasPuestas.length - 1 && 'rounded-r-lg border-r-2',
                    elegida === runa.id && 'ring-2 ring-marca-500',
                  )}
                >
                  {runa.texto}
                </button>
                {posicion < runasPuestas.length - 1 && (
                  // La costura entre dos piezas forjadas.
                  <span
                    aria-hidden
                    className="h-[38px] w-px bg-amber-600/60 dark:bg-amber-400/40"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lo que se lee, que es lo único que dice si el objeto está terminado. */}
      <p
        lang="en"
        className={cn(
          'mt-1.5 min-h-[1.5rem] text-center text-sm italic leading-snug',
          runasPuestas.length > 0 ? 'text-[var(--texto)]' : 'text-[var(--texto-suave)]',
        )}
      >
        {frase || '…'}
      </p>

      {/*
        La barra de la runa elegida. Ocupa su sitio siempre, con runa elegida o
        sin ella: si apareciera al tocar una, el cajón de abajo daría un salto
        justo cuando se está apuntando a él.
      */}
      <div className="mt-1 flex h-11 items-center justify-center gap-1.5">
        {elegida ? (
          <>
            <button
              type="button"
              aria-label="Mover la runa a la izquierda"
              disabled={sitio <= 0}
              onClick={() => onMover(elegida, -1)}
              className="flex size-11 items-center justify-center rounded-xl border-2 border-[var(--borde)] text-lg disabled:opacity-30"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => onQuitar(elegida)}
              className="min-h-11 rounded-xl border-2 border-[var(--borde)] px-3 text-xs font-bold"
            >
              Sacar de la mesa
            </button>
            <button
              type="button"
              aria-label="Mover la runa a la derecha"
              disabled={sitio < 0 || sitio >= runasPuestas.length - 1}
              onClick={() => onMover(elegida, 1)}
              className="flex size-11 items-center justify-center rounded-xl border-2 border-[var(--borde)] text-lg disabled:opacity-30"
            >
              ▶
            </button>
          </>
        ) : (
          <p className="text-[11px] text-[var(--texto-suave)]">
            Toca una runa puesta para moverla o sacarla.
          </p>
        )}
      </div>

      <h2 className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[var(--texto-suave)]">
        El cajón de runas
        <span className="ml-1 font-normal normal-case tracking-normal">
          — sobran algunas, no las uses todas
        </span>
      </h2>

      <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Runas disponibles">
        {enElCajon.map((runa, posicion) => (
          <li key={runa.id}>
            <button
              type="button"
              lang="en"
              aria-keyshortcuts={posicion < 9 ? String(posicion + 1) : undefined}
              onClick={() => onPoner(runa.id)}
              className="relative min-h-[44px] rounded-xl border-2 border-[var(--borde)] bg-[var(--superficie)] pl-4 pr-2 text-sm font-bold leading-tight transition hover:border-amber-500 active:scale-95"
            >
              {posicion < 9 && (
                <span
                  aria-hidden
                  className="absolute left-1 top-1 text-[9px] font-black text-[var(--texto-suave)]"
                >
                  {posicion + 1}
                </span>
              )}
              {runa.texto}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 pb-2">
        <Boton tamano="grande" disabled={runasPuestas.length === 0 || enviando} onClick={onForjar}>
          {enviando ? 'ENTREGANDO…' : 'FORJAR Y ENTREGAR'}
        </Boton>
      </div>
    </div>
  );
}

/** La frase montada tal y como se lee. La mayúscula y el punto los pone aquí. */
function leerFrase(piezas: readonly string[]): string {
  const texto = piezas.join(' ').trim();
  if (!texto) return '';
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`;
}

/* ------------------------------------------------------------------ */
/* La caja: el regateo.                                                */
/* ------------------------------------------------------------------ */

/**
 * El regateo, que es donde se ofende.
 *
 * Cuatro respuestas y las cuatro son verbos compuestos que existen y se usan:
 * eso es lo que impide contestar tachando «esto no se dice», que sería acertar
 * sin saber nada. Lo único que queda es saber cuál significa lo que hace falta
 * decir, y una de ellas es además una grosería.
 */
function Caja({
  encargo,
  entregado,
  enviando,
  onElegir,
}: {
  encargo: EncargoDeMercado;
  entregado: Entregado | null;
  enviando: boolean;
  onElegir: (opcionId: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-1 flex-col">
      {/*
        Lo que hay encima del mostrador.

        Se enseña porque el regateo pasa DESPUÉS de entregar y, sin esto, quien
        acaba de fallar la forja llega a la caja sin acordarse de qué le dio al
        cliente. Y porque narrativamente es lo que hay delante de los dos
        mientras discuten el precio.
      */}
      {entregado && (
        <p className="mb-3 rounded-xl bg-[var(--hueco)] px-3 py-2 text-xs leading-snug">
          <span className="font-bold uppercase tracking-wide text-[var(--texto-suave)]">
            En el mostrador:{' '}
          </span>
          <span lang="en" className={cn('font-bold', !entregado.acierto && 'line-through')}>
            {entregado.acierto ? entregado.feedback.correcta : entregado.feedback.tuya}
          </span>
          {!entregado.acierto && (
            <span className="text-[var(--texto-suave)]"> — no era lo que pedía.</span>
          )}
        </p>
      )}

      <h2 className="text-[10px] font-bold uppercase tracking-wide text-[var(--texto-suave)]">
        El regateo — ¿qué le contestas?
      </h2>

      <ul className="mt-2 grid gap-2">
        {encargo.regateo.opciones.map((opcion, posicion) => (
          <li key={opcion.id}>
            <button
              type="button"
              lang="en"
              disabled={enviando}
              aria-keyshortcuts={String(posicion + 1)}
              onClick={() => onElegir(opcion.id)}
              className="flex min-h-[52px] w-full items-center gap-2 rounded-xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-3 py-2 text-left text-sm font-bold leading-snug transition hover:border-amber-500 active:scale-[0.98] disabled:opacity-60"
            >
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--hueco)] text-[11px] font-black"
              >
                {posicion + 1}
              </span>
              <span className="min-w-0">I'll {opcion.texto}.</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] leading-snug text-[var(--texto-suave)]">
        Cuidado: una de ellas le sienta mal y te cuesta un sello.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Piezas pequeñas.                                                    */
/* ------------------------------------------------------------------ */

/**
 * Los sellos del puesto.
 *
 * Van en dibujo Y en texto para lectores de pantalla, igual que las vidas de
 * CAEN: el sello se cuenta de un vistazo sin leer, y el texto es lo que oye
 * quien no distingue los apagados de los encendidos.
 */
function Reputacion({ sellos, total }: { sellos: number; total: number }) {
  return (
    <p className="flex items-center gap-1 text-base leading-none">
      <span aria-hidden>
        {'🏅'.repeat(sellos)}
        <span className="opacity-30 grayscale">{'🏅'.repeat(Math.max(0, total - sellos))}</span>
      </span>
      <span className="sr-only">
        Reputación: {sellos} {sellos === 1 ? 'sello' : 'sellos'} de {total}
      </span>
    </p>
  );
}

/**
 * El panel que enseña, que es donde está el juego.
 *
 * Aparece después de cada mitad y lleva SIEMPRE la respuesta buena, se haya
 * acertado o no. Sin esto, fallar sería un castigo mudo: quien se equivoca de
 * tiempo verbal se iría sin saber cuál era, que es justo lo que había venido a
 * aprender.
 */
function LoQueEnsena({
  titulo,
  acierto,
  onSeguir,
  textoBoton,
  cerrado = false,
  onCerrar,
  children,
}: {
  titulo: string;
  acierto: boolean;
  onSeguir: () => void;
  textoBoton: string;
  cerrado?: boolean;
  onCerrar?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 flex flex-1 flex-col">
      <div
        role="status"
        className={cn(
          'rounded-2xl border-2 px-3 py-3',
          acierto
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
            : 'border-red-400 bg-red-50 dark:bg-red-950/40',
        )}
      >
        <p
          className={cn(
            'text-sm font-extrabold',
            acierto ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-fallo)]',
          )}
        >
          {titulo}
        </p>
        <div className="mt-2">{children}</div>
      </div>

      <div className="mt-auto pb-2 pt-3">
        {cerrado ? (
          <Boton tamano="grande" onClick={onCerrar}>
            VER EL RESULTADO
          </Boton>
        ) : (
          <Boton tamano="grande" onClick={onSeguir}>
            {textoBoton}
          </Boton>
        )}
      </div>
    </div>
  );
}

function Cerrando({ onSalir }: { onSalir: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <p className="text-center text-[var(--texto-suave)]">Cerrando el puesto…</p>
      <button
        type="button"
        onClick={onSalir}
        className="mt-4 min-h-12 text-sm text-[var(--texto-suave)] underline"
      >
        Volver a los juegos
      </button>
    </div>
  );
}
