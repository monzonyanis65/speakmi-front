import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import { emojiDe } from '@/data/emoji-vocabulario';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { Boton } from '@/components/Boton';
import { CabeceraJuego, Contador, Racha } from './Tablero';
import { Destello } from './efectos';
import { puntosDelServidor } from './puntos';
import type { Marcador, OlaDeLluvia, RespuestaCorregida, RondaDeLluvia } from './tipos';

/**
 * CAEN, «Lluvia de palabras»: el único juego de la casa que se mueve.
 *
 * Caen palabras en inglés desde las nubes y abajo esperan cuatro cestas con
 * significados en español. Hay que llevar cada una a su cesta antes de que
 * toque el suelo. Lo que se escapa cuesta una vida; con tres vidas gastadas se
 * acabó. Cada ola cae un poco más deprisa que la anterior.
 *
 *
 * QUÉ ENTRENA, QUE NO ES LO MISMO QUE PAREJAS
 *
 * Parejas entrena vocabulario con tiempo para pensar. Aquí hay un suelo
 * acercándose, y eso cambia la habilidad: no vale traducir en la cabeza, hay
 * que reconocer. Es la diferencia entre saberse una palabra y tenerla
 * disponible, que es la que separa leer inglés de hablarlo.
 *
 *
 * CÓMO SE JUEGA, Y POR QUÉ NO SE ARRASTRA
 *
 * Se toca la palabra y luego su cesta; o directamente la cesta, y va la palabra
 * más baja, que es la que corre prisa. Con teclado, las teclas 1 a 4.
 *
 * El arrastre estaba en el encargo y se cayó al probarlo. Arrastrar una diana
 * que se mueve obliga a elegir entre dos cosas malas: o la palabra sigue
 * cayendo mientras la llevas —y entonces se te escapa del dedo, porque el dedo
 * va en línea recta y ella no— o se para mientras la sujetas, y entonces
 * sujetarla indefinidamente es la mejor forma de jugar: agarras la difícil, la
 * congelas y colocas las demás. Los dos toques no tienen ninguno de los dos
 * problemas, funcionan en 320 px y son exactamente los mismos gestos que ya usa
 * PAREJAS.
 *
 *
 * QUÉ PASA AL FALLAR
 *
 * Dos fallos distintos, y a propósito no cuestan lo mismo:
 *
 *   - meterla en la cesta equivocada rompe la racha y cuenta como fallo, pero
 *     NO quita vida. Si quitara, lo racional con una palabra dudosa sería no
 *     arriesgar y dejarla caer, que es lo contrario de lo que se quiere;
 *   - dejar que llegue al suelo sí quita vida, porque el tiempo es el juego.
 *
 * En los dos casos la palabra se queda un segundo enseñando lo que significaba.
 * Ese segundo es el único sitio donde se aprende la que no te sabías, y sin él
 * el fallo sería solo un castigo mudo. El sonido de fallo es el que ya existe
 * —un gruñido corto que cae— y no hay sacudida de pantalla: jugar con miedo
 * hace que se abandone, no que se acierte.
 *
 *
 * LA PUNTUACIÓN LA CUENTA EL SERVIDOR
 *
 * Lo que sale de aquí son dos identificadores por palabra: cuál era y a qué
 * cesta fue (o `suelo` si se escapó). El servidor los corrige contra la ola que
 * él mismo sorteó y lleva la cuenta. Lo que se ve subir en pantalla es la misma
 * fórmula de `puntos.ts`, así que el número del final es el mismo que el de la
 * partida; si alguna de esas avisadas se pierde por el camino, la del servidor
 * será MENOR, nunca mayor.
 *
 * Los avisos van en cola y de uno en uno, no en paralelo: el servidor calcula
 * la racha máxima en el orden en que le llegan las respuestas, y dos avisos que
 * se adelanten entre sí le harían contar una racha que no existió.
 */

/** Cuánto tarda una palabra en llegar al suelo en la primera ola. */
const CAIDA_INICIAL = 8200;

/** Y lo más rápido que llega a caer, por mucho que se avance. */
const CAIDA_MINIMA = 4400;

/**
 * Cuánto se acelera cada ola: un 8 %.
 *
 * CALIBRADO JUGANDO, QUE ERA EL ENCARGO
 *
 * El objetivo era rondar el 85 % de aciertos, que es donde la investigación
 * sitúa el punto en el que más se aprende: por encima aburre, por debajo se
 * abandona. Lo que salió de jugar partidas enteras:
 *
 *   - a 6 s la primera ola se fallaban las dos primeras palabras de la partida
 *     siempre, y no por no saberlas: por no haber terminado de leer las cuatro
 *     cestas. Ese fallo no mide nada;
 *   - a 10 s sobraba tiempo para traducir en la cabeza, que es justo lo que
 *     este juego no quiere que se haga;
 *   - con un 15 % de aceleración por ola, la sexta era un muro y las partidas
 *     se acababan siempre en la misma;
 *   - con 8.2 s y un 8 %, la última ola cae en 4.6 s —casi la mitad que la
 *     primera, se nota mucho— y la partida se acaba por vidas o por olas según
 *     el día, que es lo que se buscaba.
 */
const ACELERACION = 0.92;

/** Cuánto tarda en entrar la siguiente palabra de la misma ola. */
const ENTRADA_INICIAL = 1800;
const ENTRADA_MINIMA = 1000;

/**
 * El respiro antes de la primera palabra.
 *
 * Las cestas hay que leerlas, y leer cuatro significados en español cuesta
 * alrededor de un segundo y medio. Sin este respiro, la primera palabra de la
 * partida se pierde siempre, y perder por no haber podido mirar todavía es la
 * peor forma posible de empezar un juego.
 */
const PREPARACION = 1700;

/** Y entre ola y ola, que además es lo que dura el cartel de «más rápido». */
const ENTRE_OLAS = 1200;

/** Lo que se queda cada final a la vista antes de quitar la palabra. */
const MIRAR = { acierto: 340, mala: 1000, suelo: 1300 } as const;

/** El alto de una palabra, que es lo que empieza escondido sobre el campo. */
const ALTO_PALABRA = 78;

/** Lo que manda el navegador cuando una palabra llegó al suelo. */
const SUELO = 'suelo';

type Final = 'acierto' | 'mala' | 'suelo';

interface PalabraDeOla {
  id: string;
  en: string;
  cestaId: string;
}

/** Una palabra en el aire. */
interface Cayendo {
  palabra: PalabraDeOla;
  /** Lo que significaba. Se enseña al fallar, que es cuando hace falta. */
  es: string;
  emoji: string | null;
  carril: number;
  duracion: number;
  bamboleo: number;
  estado: 'cae' | Final;
  /** A dónde vuela al entrar en la cesta, en píxeles desde donde estaba. */
  vuelo?: { dx: number; dy: number };
}

export function Lluvia({
  ronda,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeLluvia;
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();
  const partida = usePartida(ronda, onResponder, onFin, menosMovimiento);

  /*
    Quien pidió menos movimiento no juega a una versión capada: juega por
    turnos. Es el mismo vocabulario, las mismas cestas, la misma puntuación y el
    mismo servidor contándola; lo único que no hay es tiempo corriendo. Apagar
    las animaciones y dejar las palabras clavadas a media caída no sería
    accesible, sería un juego roto.
  */
  if (menosMovimiento) {
    return <PorTurnos ronda={ronda} partida={partida} onSalir={onSalir} />;
  }

  return <Arcade ronda={ronda} partida={partida} onSalir={onSalir} />;
}

/* ------------------------------------------------------------------ */
/* El marcador, que es lo único que comparten las dos formas de jugar. */
/* ------------------------------------------------------------------ */

interface EstadoDelMarcador {
  vidas: number;
  aciertos: number;
  fallos: number;
  racha: number;
  rachaMaxima: number;
}

interface Anotacion {
  tipo: Final;
  /**
   * Si este fallo se cobra en vidas, que no es lo mismo en las dos versiones.
   *
   * Cayendo, lo que cuesta vida es el suelo: equivocarse de cesta ya se paga
   * con la racha rota, y cobrarlo además en vidas haría que lo racional con una
   * palabra dudosa fuera dejarla caer en vez de intentarlo.
   *
   * Por turnos no hay suelo, porque no hay prisa. Si allí el fallo tampoco
   * costara nada, las tres vidas serían un adorno y la partida no se podría
   * perder: se acabaría igual acertando las veinticuatro que fallándolas todas.
   * Así que allí lo que se cobra es el error, que es lo único que queda.
   */
  cuestaVida: boolean;
}

function reducir(estado: EstadoDelMarcador, accion: Anotacion): EstadoDelMarcador {
  if (accion.tipo === 'acierto') {
    const racha = estado.racha + 1;
    return {
      ...estado,
      aciertos: estado.aciertos + 1,
      racha,
      rachaMaxima: Math.max(estado.rachaMaxima, racha),
    };
  }

  return {
    ...estado,
    fallos: estado.fallos + 1,
    racha: 0,
    vidas: accion.cuestaVida ? Math.max(0, estado.vidas - 1) : estado.vidas,
  };
}

interface Partida {
  estado: EstadoDelMarcador;
  puntuacion: number;
  /** Apunta una palabra resuelta y devuelve qué pasó, ya contado. */
  anotar: (palabra: PalabraDeOla, destino: string) => Resultado;
  /** Cierra la partida cuando el servidor tenga ya todas las caídas. */
  terminar: () => void;
}

interface Resultado {
  final: Final;
  acierto: boolean;
  /** Lo que sube el marcador con esta palabra. */
  suma: number;
  racha: number;
  vidas: number;
  seAcabo: boolean;
}

function usePartida(
  ronda: RondaDeLluvia,
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>,
  onFin: (marcador: Marcador) => void,
  /** Por turnos el fallo cuesta vida; cayendo, solo lo cuesta el suelo. */
  porTurnos: boolean,
): Partida {
  const [estado, despachar] = useReducer(reducir, {
    vidas: ronda.vidas,
    aciertos: 0,
    fallos: 0,
    racha: 0,
    rachaMaxima: 0,
  });

  /*
    La copia adelantada del marcador.

    Hace falta porque al resolver una palabra hay que saber EN EL ACTO si esa
    era la última vida y con qué racha suena el acierto, y el estado de React
    todavía no ha cambiado. Se calcula con el mismo reductor, que es puro, así
    que la copia y el estado no se pueden separar.
  */
  const espejo = useRef(estado);

  const cola = useRef<Promise<unknown>>(Promise.resolve());

  const avisar = useCallback(
    (rondaId: string, answer: string) => {
      cola.current = cola.current
        .then(() =>
          // Un reintento y no más. Si el segundo también falla, la cuenta del
          // servidor se quedará corta, que es el lado bueno por el que fallar:
          // nunca de más.
          onResponder(rondaId, answer).catch(() => onResponder(rondaId, answer)),
        )
        .catch(() => undefined);
    },
    [onResponder],
  );

  const anotar = useCallback(
    (palabra: PalabraDeOla, destino: string): Resultado => {
      const acierto = destino === palabra.cestaId;
      const final: Final = acierto ? 'acierto' : destino === SUELO ? 'suelo' : 'mala';

      const accion: Anotacion = {
        tipo: final,
        cuestaVida: final === 'suelo' || (porTurnos && final === 'mala'),
      };

      const antes = espejo.current;
      const despues = reducir(antes, accion);
      espejo.current = despues;
      despachar(accion);

      avisar(palabra.id, destino);

      return {
        final,
        acierto,
        suma:
          puntosDelServidor('CAEN', despues.aciertos, despues.rachaMaxima) -
          puntosDelServidor('CAEN', antes.aciertos, antes.rachaMaxima),
        racha: despues.racha,
        vidas: despues.vidas,
        seAcabo: despues.vidas === 0,
      };
    },
    [avisar, porTurnos],
  );

  const cerrada = useRef(false);
  const terminar = useCallback(() => {
    if (cerrada.current) return;
    cerrada.current = true;

    const suyo = espejo.current;
    const fin: Marcador = {
      puntuacion: puntosDelServidor('CAEN', suyo.aciertos, suyo.rachaMaxima),
      aciertos: suyo.aciertos,
      total: suyo.aciertos + suyo.fallos,
    };

    /*
      El final espera a que el servidor tenga todas las caídas.

      Sin esta espera, el `/fin` puede adelantar a las últimas respuestas y el
      servidor cerraría la partida contando menos aciertos de los que hubo. Se
      vería una puntuación en la partida y otra más baja en la pantalla final,
      que es exactamente lo que hace que un juego parezca trucado.
    */
    void cola.current.then(
      () => onFin(fin),
      () => onFin(fin),
    );
  }, [onFin]);

  return {
    estado,
    puntuacion: puntosDelServidor('CAEN', estado.aciertos, estado.rachaMaxima),
    anotar,
    terminar,
  };
}

/* ----------------------------------- */
/* La versión que se mueve.            */
/* ----------------------------------- */

function Arcade({
  ronda,
  partida,
  onSalir,
}: {
  ronda: RondaDeLluvia;
  partida: Partida;
  onSalir: () => void;
}) {
  const olas = ronda.olas;
  // Sueltos de la partida: los dos son estables, y meterla entera en las
  // dependencias de un efecto lo rearma con cada punto que se marca.
  const { anotar, terminar } = partida;
  const campo = useRef<HTMLDivElement>(null);
  const alto = useRef(0);
  const [listo, setListo] = useState(false);

  const [olaIndice, setOlaIndice] = useState(0);
  const [vivas, setVivas] = useState<Cayendo[]>([]);
  const [elegida, setElegida] = useState<string | null>(null);
  const [cartel, setCartel] = useState<string | null>(null);
  const [acabando, setAcabando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [premio, setPremio] = useState<{ id: number; cesta: string; puntos: number } | null>(null);
  const [golpe, setGolpe] = useState<{ id: number; senal: 'combo' | 'fallo' } | null>(null);
  const [cestaTocada, setCestaTocada] = useState<{
    id: number;
    cesta: string;
    bien: boolean;
  } | null>(null);

  const ola = olas[olaIndice];
  const pendientes = useRef(0);
  const relojes = useRef<number[]>([]);
  const nodos = useRef(new Map<string, HTMLElement>());
  const cestas = useRef(new Map<string, HTMLElement>());
  const contador = useRef(0);

  /*
    El alto del campo, medido y no supuesto.

    El recorrido de la caída va en píxeles porque los porcentajes de
    `translateY` se calculan sobre el propio elemento, no sobre el padre. Se
    mide una vez al montar y se vuelve a medir si la ventana cambia: girar el
    móvil a media partida cambia el suelo de sitio.
  */
  useLayoutEffect(() => {
    const nodo = campo.current;
    if (!nodo) return;

    const medir = () => {
      /*
        Si la medida sale cero se juega igual, con media pantalla de recorrido.

        Pasa en un entorno sin maquetación —las pruebas— y podría pasar en un
        navegador que pinte tarde. Quedarse esperando una medida buena dejaría
        la pantalla montada y sin caer nada, que se lee como un juego roto; con
        el respaldo, lo peor que pasa es que el suelo no esté exactamente donde
        se ve.
      */
      const medida = nodo.getBoundingClientRect().height || Math.round(window.innerHeight * 0.45);
      alto.current = medida;
      setListo(true);
    };

    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const apuntar = useCallback((id: string, nodo: HTMLElement | null) => {
    if (nodo) nodos.current.set(id, nodo);
    else nodos.current.delete(id);
  }, []);

  const apuntarCesta = useCallback((id: string, nodo: HTMLElement | null) => {
    if (nodo) cestas.current.set(id, nodo);
    else cestas.current.delete(id);
  }, []);

  /** Suelta las palabras de la ola, una detrás de otra. */
  useEffect(() => {
    if (!listo || acabando || !ola) return;

    const caida = Math.max(CAIDA_MINIMA, Math.round(CAIDA_INICIAL * ACELERACION ** olaIndice));
    const entrada = Math.max(
      ENTRADA_MINIMA,
      Math.round(ENTRADA_INICIAL * ACELERACION ** olaIndice),
    );
    const espera = olaIndice === 0 ? PREPARACION : ENTRE_OLAS;
    const carriles = barajar([0, 1, 2]);

    pendientes.current = ola.palabras.length;

    const suyos = ola.palabras.map((palabra, indice) =>
      window.setTimeout(
        () => {
          setVivas((anteriores) => [
            ...anteriores,
            {
              palabra,
              es: ola.cestas.find((cesta) => cesta.id === palabra.cestaId)?.es ?? '',
              // Con el significado, para que el dibujo no diga otra cosa que la
              // cesta: «book» es un libro o es reservar, y no el mismo emoji.
              emoji: emojiDe(
                palabra.en,
                ola.cestas.find((cesta) => cesta.id === palabra.cestaId)?.es,
              ),
              carril: carriles[indice % carriles.length] ?? indice,
              duracion: caida,
              // Cada una se bambolea a su ritmo: tres cosas cayendo al mismo
              // compás se leen como una sola cosa con tres cabezas.
              bamboleo: 2400 + indice * 500,
              estado: 'cae',
            },
          ]);
        },
        espera + indice * entrada,
      ),
    );

    relojes.current.push(...suyos);
    return () => suyos.forEach((reloj) => window.clearTimeout(reloj));
  }, [listo, acabando, ola, olaIndice]);

  /** El cartel de que la cosa se acelera, a partir de la segunda ola. */
  useEffect(() => {
    if (olaIndice === 0 || acabando) return;
    setCartel(olaIndice + 1 === olas.length ? '¡Última ola!' : '¡Más rápido!');
    const reloj = window.setTimeout(() => setCartel(null), ENTRE_OLAS);
    return () => window.clearTimeout(reloj);
  }, [olaIndice, olas.length, acabando]);

  const acabar = useCallback(() => {
    setAcabando(true);
    // Se vacía la MISMA lista en vez de cambiarla por otra: la limpieza del
    // desmontaje se quedó con esta referencia, y cambiarla dejaría sueltos los
    // relojes que se apunten después.
    relojes.current.forEach((reloj) => window.clearTimeout(reloj));
    relojes.current.length = 0;
  }, []);

  /** Una palabra se resuelve: entra en una cesta o toca el suelo. */
  const resolver = useCallback(
    (viva: Cayendo, destino: string) => {
      if (viva.estado !== 'cae') return;

      const resultado = anotar(viva.palabra, destino);
      contador.current += 1;
      const marca = contador.current;

      // A dónde vuela la palabra si entró: del sitio donde está al centro de su
      // cesta. Se mide ahora, con la palabra todavía cayendo, porque después
      // estará parada en otro sitio.
      let vuelo: { dx: number; dy: number } | undefined;
      if (resultado.acierto) {
        const desde = nodos.current.get(viva.palabra.id)?.getBoundingClientRect();
        const hasta = cestas.current.get(destino)?.getBoundingClientRect();
        if (desde && hasta) {
          vuelo = {
            dx: Math.round(hasta.left + hasta.width / 2 - (desde.left + desde.width / 2)),
            dy: Math.round(hasta.top + hasta.height / 2 - (desde.top + desde.height / 2)),
          };
        }
      }

      setVivas((anteriores) =>
        anteriores.map((otra) =>
          otra.palabra.id === viva.palabra.id
            ? { ...otra, estado: resultado.final, ...(vuelo ? { vuelo } : {}) }
            : otra,
        ),
      );
      setElegida((actual) => (actual === viva.palabra.id ? null : actual));

      if (resultado.acierto) {
        setPremio({ id: marca, cesta: destino, puntos: resultado.suma });
        setCestaTocada({ id: marca, cesta: destino, bien: true });
        setAviso(`Bien: ${viva.palabra.en} es ${viva.es}. ${resultado.suma} puntos.`);
        // El combo sube de tono con la racha; a partir de dos ya se nota que
        // esta no vale lo mismo que la anterior.
        sonar(resultado.racha >= 2 ? 'combo' : 'acierto', { racha: resultado.racha });
        if (resultado.racha === 3 || resultado.racha === 6 || resultado.racha === 10) {
          setGolpe({ id: marca, senal: 'combo' });
        }
      } else {
        if (destino !== SUELO) setCestaTocada({ id: marca, cesta: destino, bien: false });
        setAviso(
          destino === SUELO
            ? `Se escapó ${viva.palabra.en}: era ${viva.es}. Te quedan ${resultado.vidas} vidas.`
            : `Esa no: ${viva.palabra.en} es ${viva.es}.`,
        );
        /*
          Los dos fallos no suenan igual, igual que no cuestan lo mismo.

          La cesta equivocada se lleva un tic seco: se ha oído que no, y a otra
          cosa. El gruñido de `fallo` —que baja una octava y dura un cuarto de
          segundo— se reserva para lo único que de verdad quita algo, que es que
          la palabra llegue al suelo. Sonar el castigo grande en el fallo barato
          es lo que hace que se juegue con miedo, y quien juega con miedo deja
          de arriesgar y deja de aprender.
        */
        sonar(destino === SUELO ? 'fallo' : 'tic');
        if (destino === SUELO) setGolpe({ id: marca, senal: 'fallo' });
      }

      const mirar = MIRAR[resultado.final];

      relojes.current.push(
        window.setTimeout(() => {
          setVivas((anteriores) =>
            anteriores.filter((otra) => otra.palabra.id !== viva.palabra.id),
          );
        }, mirar),
      );

      pendientes.current -= 1;

      /*
        Última vida gastada: se para todo, incluido el reloj que iba a quitar
        esta palabra de la pantalla. Se queda puesta a propósito, con su
        traducción, debajo del cartel del final: la última que se escapó es la
        que más ganas hay de mirar.
      */
      if (resultado.seAcabo) {
        acabar();
        return;
      }

      if (pendientes.current === 0) {
        relojes.current.push(
          window.setTimeout(() => {
            if (olaIndice + 1 >= olas.length) acabar();
            else setOlaIndice(olaIndice + 1);
          }, mirar + 250),
        );
      }
    },
    [anotar, olaIndice, olas.length, acabar],
  );

  /** La que corre más prisa: la que lleva más tiempo cayendo. */
  const urgente = vivas.find((viva) => viva.estado === 'cae');
  const enJuego = elegida
    ? (vivas.find((viva) => viva.palabra.id === elegida && viva.estado === 'cae') ?? urgente)
    : urgente;

  const aLaCesta = useCallback(
    (cestaId: string) => {
      if (!enJuego) return;
      resolver(enJuego, cestaId);
    },
    [enJuego, resolver],
  );

  /*
    Las teclas 1 a 4, que es lo que hace este juego jugable sin ratón.

    Van en la ventana y no en un contenedor con foco a propósito: aquí las
    dianas se mueven, y un orden de tabulación que cambia solo cada vez que
    entra una palabra es peor que no tener ninguno. Con las cestas numeradas en
    pantalla, una tecla por cesta es directo y no depende de dónde esté el foco.
  */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
      const numero = Number(evento.key);
      if (!Number.isInteger(numero) || numero < 1 || !ola || numero > ola.cestas.length) return;
      const cesta = ola.cestas[numero - 1];
      if (!cesta) return;
      evento.preventDefault();
      aLaCesta(cesta.id);
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [ola, aLaCesta]);

  /**
   * El final: un momento para ver la última palabra y se cierra.
   *
   * Depende de `terminar` y no de la partida entera. La partida es un objeto
   * nuevo en cada render, así que con ella en las dependencias esto se rearmaba
   * con cada cambio del marcador: el sonido de final se repetía y el cierre no
   * llegaba nunca, porque el reloj volvía a empezar cada vez.
   */
  useEffect(() => {
    if (!acabando) return;
    sonar('fin');
    const reloj = window.setTimeout(terminar, 1400);
    return () => window.clearTimeout(reloj);
  }, [acabando, terminar]);

  useEffect(() => {
    if (!premio) return;
    const reloj = window.setTimeout(() => setPremio(null), 800);
    return () => window.clearTimeout(reloj);
  }, [premio]);

  useEffect(() => {
    if (!cestaTocada) return;
    const reloj = window.setTimeout(() => setCestaTocada(null), 520);
    return () => window.clearTimeout(reloj);
  }, [cestaTocada]);

  useEffect(() => {
    const todos = relojes.current;
    return () => todos.forEach((reloj) => window.clearTimeout(reloj));
  }, []);

  const { vidas, racha } = partida.estado;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col px-3 py-3 sm:px-4">
      <Cabecera
        partida={partida}
        cuenta="olas"
        van={olaIndice + 1}
        total={olas.length}
        vidasTotales={ronda.vidas}
        onSalir={onSalir}
      />

      <p className="mt-1 text-center text-[11px] leading-snug text-[var(--texto-suave)]">
        Toca una cesta y va la palabra más baja.
        <span className="hidden min-[360px]:inline"> Con teclado, del 1 al 4.</span>
      </p>

      {/* Lo que acaba de pasar, para quien no ve la pantalla. */}
      <p role="status" aria-live="polite" className="sr-only">
        {aviso}
      </p>

      {/*
        El cielo.

        `overflow-hidden` no es cosmético: es lo que esconde las palabras
        mientras esperan encima del campo, y sin él aparecerían flotando sobre
        la cabecera antes de empezar a caer.
      */}
      <div
        ref={campo}
        /*
          El cielo de noche va más oscuro que la superficie de las tarjetas.

          Con el degradado de antes —slate-800 a slate-900— la palabra, que es
          de `--superficie`, era del mismo color que el cielo y se sostenía solo
          con su borde: un contorno fucsia hueco. Bajando el cielo a slate-950,
          la tarjeta vuelve a ser un objeto delante del fondo, que es lo que hay
          que ver de un vistazo mientras cae.
        */
        className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-2xl border-2 border-sky-200 bg-linear-to-b from-sky-100 to-sky-50 dark:border-slate-800 dark:from-slate-950 dark:to-black"
      >
        <Chaparron />
        <Nubes />

        {vivas.map((viva) => (
          <PalabraQueCae
            key={viva.palabra.id}
            viva={viva}
            elegida={enJuego?.palabra.id === viva.palabra.id}
            caida={alto.current}
            parada={acabando}
            apuntar={apuntar}
            onElegir={() => setElegida(viva.palabra.id)}
            onSuelo={() => resolver(viva, SUELO)}
          />
        ))}

        {/* El suelo: una línea que se ve venir. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2 bg-linear-to-t from-emerald-600/70 to-transparent dark:from-emerald-500/50"
        />

        {cartel && (
          <p
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-2xl font-black text-fuchsia-700 drop-shadow-sm dark:text-fuchsia-300"
            style={{ animation: `lluvia-cartel ${ENTRE_OLAS}ms ease-out forwards` }}
          >
            {cartel}
          </p>
        )}

        {acabando && (
          <div className="absolute inset-0 grid place-items-center bg-[var(--fondo)]/85">
            <p className="animate-crecer text-center text-xl font-extrabold">
              {vidas === 0 ? 'Se acabaron las vidas' : '¡Aguantaste hasta el final!'}
            </p>
          </div>
        )}
      </div>

      <ul className="mt-2 grid grid-cols-4 gap-1.5" aria-label="Cestas">
        {(ola ?? olas[olas.length - 1])?.cestas.map((cesta, indice) => (
          <li key={cesta.id}>
            <Cesta
              numero={indice + 1}
              texto={cesta.es}
              esperando={Boolean(enJuego) && !acabando}
              tocada={cestaTocada?.cesta === cesta.id ? cestaTocada : null}
              premio={premio?.cesta === cesta.id ? premio : null}
              apuntar={apuntarCesta}
              id={cesta.id}
              onSoltar={() => aLaCesta(cesta.id)}
            />
          </li>
        ))}
      </ul>

      {/*
        La tira de la racha ocupa su sitio SIEMPRE, con racha o sin ella.

        Si apareciera al llegar a dos seguidas, el campo —que es lo que queda en
        medio— encogería treinta píxeles, y el suelo se movería debajo de tres
        palabras que están cayendo con la distancia vieja apuntada. Un juego en
        el que el suelo se mueve al ir bien no hay forma de aprenderlo.
      */}
      <div className="mt-2 flex h-8 shrink-0 items-center justify-center">
        <Racha racha={racha} />
      </div>

      {golpe && <Destello key={golpe.id} senal={golpe.senal} />}
    </div>
  );
}

/* ----------------------------------- */
/* Las piezas que se pintan.           */
/* ----------------------------------- */

function Cabecera({
  partida,
  cuenta,
  van,
  total,
  vidasTotales,
  onSalir,
}: {
  partida: Partida;
  /**
   * Qué se está contando, porque no es lo mismo en las dos versiones.
   *
   * Cayendo se cuentan OLAS, que es lo que marca el ritmo y lo que avisa de
   * que la siguiente viene más rápida. Por turnos no hay olas —las cestas
   * cambian cada tres palabras y ya está—, así que lo que sitúa a quien juega
   * es por qué palabra va. Poner «Ola 7 de 24» donde no hay olas es contarle
   * al jugador algo que no está pasando.
   */
  cuenta: 'olas' | 'palabras';
  van: number;
  total: number;
  vidasTotales: number;
  onSalir: () => void;
}) {
  const { vidas } = partida.estado;

  return (
    <CabeceraJuego onSalir={onSalir}>
      <div className="min-w-0 flex-1">
        {/*
          Las vidas van en corazones Y en número. El corazón se cuenta de un
          vistazo sin leer, que es lo que hace falta a media caída; el número es
          lo que lee quien no distingue los corazones apagados de los encendidos.
        */}
        <p className="flex items-center gap-1 text-lg leading-none">
          <span aria-hidden>
            {'❤️'.repeat(vidas)}
            <span className="opacity-30 grayscale">{'❤️'.repeat(vidasTotales - vidas)}</span>
          </span>
          <span className="sr-only">
            {vidas} {vidas === 1 ? 'vida' : 'vidas'} de {vidasTotales}
          </span>
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">
          {cuenta === 'olas' ? 'Ola' : 'Palabra'} {van} de {total}
        </p>
      </div>
      <Contador etiqueta="Puntos" valor={partida.puntuacion} vivo />
    </CabeceraJuego>
  );
}

/**
 * Una palabra cayendo.
 *
 * Son cuatro capas y cada una mueve una sola cosa, que es lo que permite tocar
 * una sin estropear las otras:
 *
 *   1. el carril, que solo dice en qué columna cae (no se anima nunca);
 *   2. la caída, con la animación de CSS: es la única que recorre el campo, va
 *      en `transform` y por eso la mueve el compositor sin repintar nada;
 *   3. el vuelo a la cesta, una transición que se activa al atrapar la palabra
 *      y que se compone con la caída en vez de pelearse con ella;
 *   4. el bamboleo, que sigue su ritmo aparte para que una palabra atrapada no
 *      se quede tiesa de golpe.
 *
 * Con las cuatro en el mismo elemento habría que reescribir el `transform`
 * entero desde JavaScript en cada fotograma, que es exactamente lo que hay que
 * no hacer.
 */
function PalabraQueCae({
  viva,
  elegida,
  caida,
  parada,
  apuntar,
  onElegir,
  onSuelo,
}: {
  viva: Cayendo;
  elegida: boolean;
  caida: number;
  parada: boolean;
  apuntar: (id: string, nodo: HTMLElement | null) => void;
  onElegir: () => void;
  onSuelo: () => void;
}) {
  const cayendo = viva.estado === 'cae';
  const fallada = viva.estado === 'mala' || viva.estado === 'suelo';

  return (
    <div
      aria-hidden={!cayendo || undefined}
      className="absolute w-[30%] -translate-x-1/2"
      style={{ left: `${18 + viva.carril * 32}%`, top: -ALTO_PALABRA }}
    >
      <div
        style={{
          // El recorrido, en píxeles medidos: de escondida encima del campo a
          // con los pies en el suelo.
          ['--lluvia-caida' as string]: `${caida}px`,
          animation: `lluvia-caer ${viva.duracion}ms linear forwards`,
          animationPlayState: cayendo && !parada ? 'running' : 'paused',
        }}
        /*
          Tocó el suelo: se acabó la animación de caída.

          Se compara `target` con `currentTarget` y no el nombre de la
          animación porque las capas de dentro también tienen las suyas y sus
          avisos burbujean hasta aquí; lo que hay que distinguir es de QUIÉN es
          el aviso, y eso lo dice el destino. Además el nombre no viaja en todos
          los entornos, así que comprobarlo dejaría este final sin probar.
        */
        onAnimationEnd={(evento) => {
          if (evento.target === evento.currentTarget && cayendo && !parada) onSuelo();
        }}
      >
        <div
          ref={(nodo) => apuntar(viva.palabra.id, nodo)}
          style={{
            transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1), opacity 320ms ease-out',
            ...(viva.vuelo
              ? {
                  transform: `translate3d(${viva.vuelo.dx}px, ${viva.vuelo.dy}px, 0) scale(0.12)`,
                  opacity: 0,
                }
              : {}),
            ...(viva.estado === 'mala' ? { opacity: 0.15 } : {}),
          }}
        >
          <div
            style={{
              animation: fallada
                ? 'lluvia-salpicar 420ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                : `lluvia-bambolear ${viva.bamboleo}ms ease-in-out infinite`,
            }}
          >
            <button
              type="button"
              disabled={!cayendo}
              onClick={onElegir}
              aria-label={`${viva.palabra.en}, cayendo`}
              className={cn(
                // 78 px de alto y casi un tercio del ancho: a 320 px son 96×78,
                // muy por encima de los 44 px de zona táctil incluso mientras
                // se mueve.
                'flex h-[78px] w-full flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 text-center shadow-lg',
                viva.estado === 'cae' &&
                  'border-fuchsia-400 bg-[var(--superficie)] dark:border-fuchsia-500',
                elegida && cayendo && 'ring-4 ring-fuchsia-400/60',
                viva.estado === 'acierto' &&
                  'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60',
                fallada && 'border-red-400 bg-red-50 dark:bg-red-950/60',
              )}
            >
              {viva.emoji && !fallada && (
                <span aria-hidden className="text-2xl leading-none">
                  {viva.emoji}
                </span>
              )}

              <span
                lang="en"
                className={cn(
                  'block w-full break-words font-extrabold leading-tight',
                  tamanoDe(viva.palabra.en, Boolean(viva.emoji) && !fallada),
                )}
              >
                {viva.palabra.en}
              </span>

              {/*
                Al fallar aparece lo que significaba. Es el único rato del juego
                en el que se aprende la palabra que no te sabías, y por eso el
                fallo dura más en pantalla que el acierto.
              */}
              {fallada && (
                <span className="block w-full break-words text-[11px] font-bold leading-tight text-[var(--texto-fallo)]">
                  {viva.es}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Una cesta.
 *
 * No es un rectángulo con texto: tiene borde de mimbre —un degradado repetido,
 * que pesa cero— y una boca más oscura arriba. Importa porque lo que se pide es
 * «meter algo dentro de algo», y en un rectángulo plano no se mete nada.
 *
 * Cuando hay una palabra elegida, las cuatro se levantan un poco. Es la forma
 * de decir «ahora te toca a ti» sin escribirlo, y es lo que enseña el segundo
 * toque a quien entra por primera vez.
 */
function Cesta({
  id,
  numero,
  texto,
  esperando,
  tocada,
  premio,
  apuntar,
  onSoltar,
}: {
  id: string;
  numero: number;
  texto: string;
  esperando: boolean;
  tocada: { id: number; bien: boolean } | null;
  premio: { id: number; puntos: number } | null;
  apuntar: (id: string, nodo: HTMLElement | null) => void;
  onSoltar: () => void;
}) {
  return (
    <button
      type="button"
      ref={(nodo) => apuntar(id, nodo)}
      onClick={onSoltar}
      aria-label={`Cesta ${numero}: ${texto}`}
      className="relative block min-h-[76px] w-full"
      style={
        tocada
          ? { animation: `lluvia-engullir 420ms cubic-bezier(0.34, 1.56, 0.64, 1)` }
          : undefined
      }
    >
      <span
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-b-xl rounded-t-md border-2 px-0.5 pt-1.5 transition-transform duration-200',
          esperando && '-translate-y-1',
          tocada?.bien === true
            ? 'border-emerald-600 bg-emerald-100 dark:bg-emerald-900'
            : tocada?.bien === false
              ? 'border-red-500 bg-red-100 dark:bg-red-950'
              : 'border-amber-700 bg-amber-100 dark:border-amber-600 dark:bg-amber-950/70',
        )}
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(120,53,15,0.16) 0 3px, transparent 3px 8px), repeating-linear-gradient(0deg, rgba(120,53,15,0.12) 0 3px, transparent 3px 9px)',
        }}
      >
        {/* La boca de la cesta, más oscura: es lo que la hace parecer hueca. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5 rounded-t-md bg-amber-800 dark:bg-amber-700"
        />

        <span
          aria-hidden
          className="text-[10px] font-black leading-none text-amber-900 dark:text-amber-300"
        >
          {numero}
        </span>

        <span
          className={cn(
            'block w-full hyphens-auto break-words font-bold leading-[1.1] text-amber-950 dark:text-amber-100',
            texto.length <= 9 ? 'text-sm' : texto.length <= 15 ? 'text-[11px]' : 'text-[10px]',
          )}
        >
          {texto}
        </span>
      </span>

      {premio && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white shadow"
            style={{ animation: 'lluvia-premio 800ms ease-out forwards' }}
          >
            +{premio.puntos}
          </span>
          <Chispas />
        </>
      )}
    </button>
  );
}

/** Las seis chispas del acierto. Puro adorno, y por eso se van solas. */
function Chispas() {
  const chispas = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const angulo = (Math.PI / 5) * i + Math.PI;
        return {
          id: i,
          sx: `${Math.round(Math.cos(angulo) * 34)}px`,
          sy: `${Math.round(Math.sin(angulo) * 30)}px`,
        };
      }),
    [],
  );

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-visible">
      {chispas.map((chispa) => (
        <span
          key={chispa.id}
          className="absolute left-1/2 top-1/3 text-[11px] leading-none"
          style={{
            ['--sx' as string]: chispa.sx,
            ['--sy' as string]: chispa.sy,
            animation: 'lluvia-chispa 620ms ease-out forwards',
          }}
        >
          ✨
        </span>
      ))}
    </span>
  );
}

/**
 * El chaparrón del fondo.
 *
 * Doce gotas y ni una más, con `aria-hidden`: no significan nada, y para quien
 * no ve la pantalla sería ruido. Lo que hacen es que el cielo esté vivo también
 * en los segundos en los que no cae ninguna palabra, que en la primera ola son
 * casi la mitad. Se sortean una vez y no vuelven a calcularse.
 */
function Chaparron() {
  const gotas = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        izquierda: Math.round(Math.random() * 96),
        duracion: 1.5 + Math.random() * 1.6,
        retraso: -Math.random() * 3,
        alto: 8 + Math.round(Math.random() * 10),
      })),
    [],
  );

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {gotas.map((gota) => (
        <span
          key={gota.id}
          className="absolute top-0 w-px rounded-full bg-sky-500/70 dark:bg-sky-300/50"
          style={{
            left: `${gota.izquierda}%`,
            height: `${gota.alto}px`,
            animation: `lluvia-gota ${gota.duracion}s linear ${gota.retraso}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/** Dos nubes cruzando el cielo, de donde salen las palabras. */
function Nubes() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 overflow-hidden">
      {/*
        La capa que se mueve ocupa TODO el ancho y lleva la nube dentro.

        Los porcentajes de `translate3d` se miden sobre el propio elemento, no
        sobre el padre: puestos en el emoji, la nube recorría treinta píxeles y
        se quedaba temblando en una esquina. Sobre una capa del ancho del campo,
        el mismo -20 %..120 % es cruzar el cielo entero.
      */}
      <span
        className="absolute inset-x-0 top-1 block"
        style={{ animation: 'lluvia-nube 38s linear infinite' }}
      >
        <span className="text-4xl opacity-70">☁️</span>
      </span>
      <span
        className="absolute inset-x-0 top-8 block"
        style={{ animation: 'lluvia-nube 56s linear infinite', animationDelay: '-22s' }}
      >
        <span className="text-2xl opacity-50">☁️</span>
      </span>
    </span>
  );
}

/* ----------------------------------- */
/* La versión sin movimiento.          */
/* ----------------------------------- */

/**
 * El mismo juego, por turnos.
 *
 * Quien pide menos movimiento no puede jugar a esquivar un suelo que se acerca,
 * así que aquí no se acerca nada: la palabra espera quieta y no hay prisa. Lo
 * que sostiene el juego cambia de sitio —ya no cuesta vida tardar, cuesta vida
 * equivocarse— y con eso siguen valiendo las tres vidas, la racha, la
 * puntuación y el servidor contándola, que son las mismas de arriba.
 *
 * Y sigue enseñando la traducción al fallar, que es lo que hace que una partida
 * perdida no haya sido tiempo tirado.
 */
function PorTurnos({
  ronda,
  partida,
  onSalir,
}: {
  ronda: RondaDeLluvia;
  partida: Partida;
  onSalir: () => void;
}) {
  const turnos: Array<{ ola: OlaDeLluvia; palabra: PalabraDeOla; es: string }> = useMemo(
    () =>
      ronda.olas.flatMap((ola) =>
        ola.palabras.map((palabra) => ({
          ola,
          palabra,
          es: ola.cestas.find((cesta) => cesta.id === palabra.cestaId)?.es ?? '',
        })),
      ),
    [ronda.olas],
  );

  const [indice, setIndice] = useState(0);
  const [respuesta, setRespuesta] = useState<{ cestaId: string; acierto: boolean } | null>(null);

  const turno = turnos[indice];
  const { vidas } = partida.estado;
  const { terminar } = partida;
  const seAcabo = vidas === 0 || !turno;

  useEffect(() => {
    if (seAcabo) terminar();
  }, [seAcabo, terminar]);

  if (!turno) {
    return <Cerrando onSalir={onSalir} />;
  }

  const responder = (cestaId: string) => {
    if (respuesta) return;
    const resultado = partida.anotar(turno.palabra, cestaId);
    setRespuesta({ cestaId, acierto: resultado.acierto });
  };

  const siguiente = () => {
    setRespuesta(null);
    setIndice((n) => n + 1);
  };

  const emoji = emojiDe(turno.palabra.en, turno.es);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-4">
      <Cabecera
        partida={partida}
        cuenta="palabras"
        van={indice + 1}
        total={turnos.length}
        vidasTotales={ronda.vidas}
        onSalir={onSalir}
      />

      <p className="mt-2 text-xs leading-snug text-[var(--texto-suave)]">
        Por turnos y sin prisa: elige en qué cesta va cada palabra. Aquí no se cae nada, pero tres
        errores acaban la partida.
      </p>

      <div className="flex flex-1 flex-col justify-center py-6">
        <div
          className={cn(
            'mx-auto flex w-full max-w-xs flex-col items-center gap-1 rounded-2xl border-2 p-4 text-center',
            respuesta?.acierto === true
              ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50'
              : respuesta
                ? 'border-red-500 bg-red-50 dark:bg-red-950/50'
                : 'border-fuchsia-400 bg-[var(--superficie)]',
          )}
        >
          {emoji && (
            <span aria-hidden className="text-4xl leading-none">
              {emoji}
            </span>
          )}
          <span lang="en" className="block text-2xl font-extrabold leading-tight">
            {turno.palabra.en}
          </span>
          {respuesta && (
            <span
              className={cn(
                'block text-sm font-bold',
                respuesta.acierto ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-fallo)]',
              )}
            >
              {respuesta.acierto ? '¡A la cesta!' : `Era: ${turno.es}`}
            </span>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2" aria-label="Cestas">
        {turno.ola.cestas.map((cesta, numero) => (
          <li key={cesta.id}>
            <button
              type="button"
              disabled={Boolean(respuesta)}
              onClick={() => responder(cesta.id)}
              className={cn(
                'flex min-h-[56px] w-full items-center justify-center rounded-xl border-2 px-2 py-2 text-center text-sm font-bold leading-tight',
                respuesta && cesta.id === turno.palabra.cestaId
                  ? 'border-emerald-600 bg-emerald-50 text-[var(--texto-acierto)] dark:bg-emerald-950/50'
                  : respuesta?.cestaId === cesta.id
                    ? 'border-red-500 bg-red-50 text-[var(--texto-fallo)] dark:bg-red-950/50'
                    : 'border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100',
              )}
            >
              <span className="sr-only">Cesta {numero + 1}: </span>
              {cesta.es}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 min-h-14">
        {respuesta && !seAcabo && (
          <Boton tamano="grande" onClick={siguiente}>
            SIGUIENTE
          </Boton>
        )}
      </div>
    </div>
  );
}

function Cerrando({ onSalir }: { onSalir: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <p className="text-center text-[var(--texto-suave)]">Guardando la partida…</p>
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

/* ----------------------------------- */
/* Cosas pequeñas.                     */
/* ----------------------------------- */

/**
 * Qué tamaño aguanta la palabra dentro de la tarjeta que cae.
 *
 * El vocabulario va de «tall» a «do someone a favor», y una talla única deja la
 * corta ridícula o la larga cortada. Cortarla no es opción: es lo que hay que
 * leer, y encima leerlo deprisa.
 */
function tamanoDe(texto: string, conEmoji: boolean): string {
  const largo = texto.length;
  if (largo <= 6) return conEmoji ? 'text-base' : 'text-xl';
  if (largo <= 11) return conEmoji ? 'text-sm' : 'text-lg';
  if (largo <= 17) return conEmoji ? 'text-xs' : 'text-sm';
  return 'text-[10px]';
}

function barajar<T>(lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copia[i]!;
    const b = copia[j]!;
    copia[i] = b;
    copia[j] = a;
  }
  return copia;
}
