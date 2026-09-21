import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { cn } from '@/lib/cn';
import { CapaAtuendo, ESPECIES, NOMBRE_ATUENDO, type Atuendo, type Especie } from './mascotas';
import { useMascotaEquipada } from '@/lib/mascota-contexto';
import {
  aperturaDeVoz,
  ESTADOS_CON_TICS,
  GESTOS,
  RESORTE,
  TICS,
  type PasoDeTic,
  type EstadoMascota,
  type Pose,
} from './mascotas/coreografia';

export type { EstadoMascota, Pose };

export type { Atuendo, Especie };

interface Props {
  estado?: EstadoMascota;
  /** Qué animal es. Por defecto, el que la persona lleve puesto. */
  especie?: Especie;
  /** Lo que lleva puesto, si lleva algo. */
  atuendo?: Atuendo | null;
  /**
   * Cuánto abre la boca al hablar, de 0 a 1. Solo se mira en `hablando`.
   *
   * Existe para la pantalla de llamada: cuando haya audio, quien lo reproduzca
   * podrá pasar aquí el volumen del momento y la boca se abrirá tanto como
   * suene la voz, en lugar de mover siempre lo mismo. Aquí no se lee ningún
   * audio a propósito; esto es solo la entrada por la que llegará.
   *
   * Sin valor, la boca hace su ciclo normal, que es lo correcto mientras no
   * haya nada que medir: una boca que espera datos no puede quedarse quieta.
   */
  intensidad?: number;
  tamano?: number;
  className?: string;
}

/**
 * La mascota de Speakmi.
 *
 * Este archivo es el esqueleto del movimiento, y solo eso. Las formas de cada
 * animal viven en `mascotas/`, y la razón de separarlo es que el movimiento es
 * lo caro: once estados, dos alas desfasadas, parpadeos y seis capas que no
 * pueden reiniciarse al cambiar de estado. Copiar eso cinco veces sería
 * garantizar que dentro de un mes cada animal se mueve un poco distinto.
 *
 *
 * POR QUÉ ESTO VA CON FÍSICA Y NO CON FOTOGRAMAS
 *
 * Durante mucho tiempo todo esto fueron animaciones de CSS: se declaraba dónde
 * empieza y dónde acaba cada gesto y el navegador rellenaba el medio a
 * velocidad fija. Funcionaba, pero se leía como un dibujo con piezas movidas,
 * no como un bicho, y por tres razones concretas:
 *
 *   - Todo tardaba lo mismo pasara lo que pasara. Un ciclo de tres segundos
 *     dura tres segundos tanto si la parte recorre dos píxeles como veinte.
 *   - Todo llegaba a la vez. Un cuerpo de verdad no: la cabeza pesa más que un
 *     párpado y llega después, y la cola llega la última porque solo la
 *     arrastra el cuerpo.
 *   - Todo se repetía idéntico. Un bucle exacto se detecta a la tercera vuelta
 *     y a partir de ahí ya no engaña a nadie.
 *
 * Ahora no hay ni una duración. Cada parte cuelga de un resorte con su rigidez,
 * su amortiguación y SU MASA, y lo que tarda en llegar lo decide la distancia
 * que tenga que recorrer. De ahí salen solos el arranque y la frenada suaves,
 * el sobreimpulso al parar y, sobre todo, el desfase entre partes, que es lo
 * que hace que se lea un cuerpo entero y no un recorte articulado.
 *
 *
 * CÓMO SE DEFINE UN GESTO
 *
 * Cada estado son DOS POSES y un ritmo, y el personaje va de una a otra sin
 * parar. Esa forma de escribirlo es la que trae de propina el principio que más
 * se nota en la animación clásica: la ANTICIPACIÓN. Para que un salto se lea
 * como un salto hay que agacharse antes, así que la pose A de celebrar es el
 * agachado y la B es el aire. No hace falta programar ninguna secuencia: el
 * vaivén entre las dos poses ya es agacharse y saltar.
 *
 * El tiempo entre poses lleva un pellizco de azar. Es barato y es lo que impide
 * que se vea el bucle.
 *
 *
 * LAS CAPAS, Y POR QUÉ SON TANTAS
 *
 *   svg          -> nada: es el lienzo
 *   g cuerpo     -> la pose del estado (agacharse, saltar, hundirse, presumir)
 *   g cabeza     -> el ladeo, que va a su aire y no depende del estado
 *   g habla      -> el acompañamiento de la cabeza mientras habla
 *   g ojos       -> abrir más, parpadear y mirar, cada uno en su nivel
 *   g boca       -> el alto y el ancho de la boca, uno por capa
 *
 * Separarlas es lo que permite que dos gestos ocurran a la vez sin pisarse. En
 * un mismo elemento, la segunda transformación se come a la primera: un ojo que
 * se estrecha por el giro no podría además cerrarse para parpadear.
 */

/**
 * Si esta persona pidió menos movimiento en su sistema.
 *
 * Se lee a mano y no con `useReducedMotion` de la librería porque esa guarda la
 * consulta la primera vez que se monta cualquier componente y ya no la vuelve a
 * mirar. En la aplicación da igual; en las pruebas significa que el ajuste no
 * se puede comprobar.
 */
function useMenosMovimiento(): boolean {
  const consultar = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const [quieto, setQuieto] = useState(consultar);

  useEffect(() => {
    const medio = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!medio) return;

    setQuieto(medio.matches);
    const alCambiar = (e: MediaQueryListEvent) => setQuieto(e.matches);
    medio.addEventListener('change', alCambiar);
    return () => medio.removeEventListener('change', alCambiar);
  }, []);

  return quieto;
}

export function Mascota({
  estado = 'neutral',
  especie,
  atuendo,
  intensidad,
  tamano = 120,
  className,
}: Props) {
  /*
    Sin decir cuál, se usa la que la persona lleva puesta.
    Así ninguna pantalla tiene que acordarse de pasarla: quien compra un gato lo
    ve en todas, y las pruebas de componentes, que no montan el proveedor,
    siguen viendo a Milo sin tocar nada.

    `undefined` y `null` no significan lo mismo en `atuendo`: sin nada es «lo
    que lleve puesto», y `null` expreso es «este sitio va sin ropa», que es lo
    que necesita la tienda para enseñar cómo queda cada prenda.
  */
  const puesto = useMascotaEquipada();
  const cual = especie ?? puesto.especie;
  const prenda = atuendo === undefined ? puesto.atuendo : atuendo;

  /*
    Si la especie no se reconoce, sale Milo.

    Pasa de verdad: el servidor y el navegador se despliegan por separado, así
    que el catálogo puede ofrecer un animal que esta versión de la aplicación
    todavía no sabe dibujar. Antes eso dejaba la pantalla en blanco con un
    «cannot read properties of undefined»; ahora se ve el de siempre, que es
    feo pero no rompe nada.
  */
  const animal = ESPECIES[cual] ?? ESPECIES.PET_MILO;
  const prendaConocida = prenda && prenda in NOMBRE_ATUENDO ? prenda : null;
  const ojoAbierto = estado !== 'pensando' && estado !== 'durmiendo';
  const hablando = estado === 'hablando';
  // La boca se abre al hablar, al celebrar, al animar y al sorprenderse, que es
  // media sorpresa.
  const picoAbierto =
    estado === 'celebrando' || estado === 'animando' || estado === 'sorprendido' || hablando;

  const quieto = useMenosMovimiento();

  // ---- La pose del cuerpo, un valor por parte.
  const y = useMotionValue(0);
  const eX = useMotionValue(1);
  const eY = useMotionValue(1);
  const giro = useMotionValue(0);
  const alaCercana = useMotionValue(0);
  const alaLejana = useMotionValue(0);
  const fueraCercana = useMotionValue(0);
  const fueraLejana = useMotionValue(0);
  const cabezaPose = useMotionValue(0);
  const ojoPose = useMotionValue(1);
  const colaPose = useMotionValue(0);

  /*
    El resorte del cuerpo lo decide el estado, y de ahí sale que un gesto se
    lea rápido o blando. Un salto con el resorte de respirar tarda más en llegar
    que lo que dura el propio salto, así que no llega nunca: se ve lento aunque
    recorra mucho. La librería vuelve a engancharlo al cambiar la configuración,
    así que basta con pasarle otra.
  */
  const resorteCuerpo = GESTOS[estado].resorte ?? RESORTE.cuerpo;
  const ys = useSpring(y, resorteCuerpo);
  const eXs = useSpring(eX, resorteCuerpo);
  const eYs = useSpring(eY, resorteCuerpo);
  const giros = useSpring(giro, resorteCuerpo);
  const alaCercanas = useSpring(alaCercana, RESORTE.alaCercana);
  const alaLejanas = useSpring(alaLejana, RESORTE.alaLejana);
  const fueraCercanas = useSpring(fueraCercana, RESORTE.alaCercana);
  const fueraLejanas = useSpring(fueraLejana, RESORTE.alaLejana);
  const cabezaPoses = useSpring(cabezaPose, RESORTE.cabeza);
  const ojoPoses = useSpring(ojoPose, RESORTE.ojo);
  const colaPoses = useSpring(colaPose, RESORTE.cola);

  /*
    El vaivén entre las dos poses del estado.

    Un temporizador que alterna, y los resortes hacen el viaje. El pellizco de
    azar en el tiempo de espera es lo que impide que el ciclo se vea: con un
    periodo exacto, a la tercera vuelta ya se ha detectado el bucle.
  */
  useEffect(() => {
    const gesto = GESTOS[estado];

    const poner = (p: Pose) => {
      y.set(p.y);
      eX.set(p.eX);
      eY.set(p.eY);
      giro.set(p.giro);
      alaCercana.set(p.alaCercana);
      alaLejana.set(p.alaLejana);
      fueraCercana.set(p.fueraCercana ?? 0);
      fueraLejana.set(p.fueraLejana ?? 0);
      cabezaPose.set(p.cabeza);
      ojoPose.set(p.ojo);
      colaPose.set(p.cola);
    };

    /*
      Quien pide menos movimiento se queda en la pose B, la soltada.

      Es la que cuenta el estado: el celebrando en el aire y el triste hundido.
      Dejarlo en la A lo habría dejado agachado, que es la mitad de un gesto y
      no se entiende sin la otra mitad.
    */
    if (quieto) {
      poner(gesto.b);
      return;
    }

    let vivo = true;
    let enB = false;
    let reloj: ReturnType<typeof setTimeout>;
    let ciclos = 0;

    /*
      Un gesto suelto: se reproduce paso a paso y luego se vuelve al vaivén.

      Mientras dura, el vaivén no toca nada: si siguiera corriendo por debajo,
      le pisaría las poses a media sacudida y el tic se quedaría en un temblor.
    */
    const hacerAlgo = (pasos: PasoDeTic[]) => {
      let i = 0;
      const paso = () => {
        if (!vivo) return;
        if (i >= pasos.length) {
          enB = false;
          latir();
          return;
        }
        const actual = pasos[i]!;
        poner({ ...gesto.a, ...actual.pose });
        reloj = setTimeout(paso, actual.aguanta);
        i += 1;
      };
      paso();
    };

    const latir = () => {
      if (!vivo) return;
      ciclos += 1;

      /*
        De vez en cuando hace otra cosa, y solo en los estados tranquilos.

        La probabilidad es baja y además tiene que haber respirado unas cuantas
        veces antes: un personaje que se estira nada más aparecer en pantalla no
        parece vivo, parece que le han dado al play.
      */
      const puede = ESTADOS_CON_TICS.includes(estado) && ciclos > 3;
      if (puede && Math.random() < 0.16) {
        const cuales = Object.keys(TICS);
        hacerAlgo(TICS[cuales[Math.floor(Math.random() * cuales.length)]!]!);
        return;
      }

      enB = !enB;
      poner(enB ? gesto.b : gesto.a);
      reloj = setTimeout(latir, gesto.ritmo * (0.85 + Math.random() * 0.3));
    };

    latir();
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [
    estado,
    quieto,
    y,
    eX,
    eY,
    giro,
    alaCercana,
    alaLejana,
    fueraCercana,
    fueraLejana,
    cabezaPose,
    ojoPose,
    colaPose,
  ]);

  /*
    El ladeo de la cabeza, que va a su aire.

    No depende del estado y es deliberado: es el gesto que hace que la mascota
    parezca estar atendiendo a algo en vez de esperando a que le den cuerda. Se
    ladea a un lado, aguanta un rato largo y vuelve, con esperas desiguales.
  */
  const ladeo = useMotionValue(0);
  const ladeos = useSpring(ladeo, RESORTE.cabeza);

  useEffect(() => {
    if (quieto) return;
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout>;

    const ladear = () => {
      if (!vivo) return;
      // A veces a un lado, a veces al otro, a veces recto: si siempre alternara
      // se volvería un metrónomo.
      const donde = Math.random();
      ladeo.set(donde < 0.4 ? -5 : donde < 0.8 ? 5 : 0);
      reloj = setTimeout(ladear, 2800 + Math.random() * 4200);
    };

    reloj = setTimeout(ladear, 1200 + Math.random() * 2000);
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [ladeo, quieto]);

  /*
    El parpadeo.

    Cerrar y abrir son dos órdenes seguidas, no una animación de ida y vuelta.
    De vez en cuando parpadea dos veces seguidas, que es lo que hace la gente y
    lo que rompe la sospecha de que hay un temporizador detrás.
  */
  const parpado = useMotionValue(1);
  const parpados = useSpring(parpado, RESORTE.parpado);

  useEffect(() => {
    // Con los ojos ya cerrados no hay nada que parpadear.
    if (quieto || !ojoAbierto) {
      parpado.set(1);
      return;
    }
    let vivo = true;
    const relojes: ReturnType<typeof setTimeout>[] = [];

    const siguiente = () => {
      if (!vivo) return;
      cerrar(Math.random() < 0.25 ? 200 : 2400 + Math.random() * 3600);
    };

    const cerrar = (luego: number) => {
      if (!vivo) return;
      parpado.set(0.06);
      relojes.push(
        setTimeout(() => {
          if (!vivo) return;
          parpado.set(1);
          relojes.push(setTimeout(siguiente, luego));
        }, 95),
      );
    };

    relojes.push(setTimeout(siguiente, 700 + Math.random() * 1500));
    return () => {
      vivo = false;
      relojes.forEach(clearTimeout);
    };
  }, [parpado, quieto, ojoAbierto]);

  /*
    La mirada: las pupilas se van a un sitio y se quedan un rato.

    Antes era un vaivén continuo de siete segundos, y un ojo que se desplaza sin
    parar no mira, deambula. Mirar es ir a un punto, sostenerlo y saltar a otro.
  */
  const miraX = useMotionValue(0);
  const miraY = useMotionValue(0);
  const miraXs = useSpring(miraX, RESORTE.mirada);
  const miraYs = useSpring(miraY, RESORTE.mirada);

  useEffect(() => {
    if (quieto || !ojoAbierto) {
      miraX.set(0);
      miraY.set(0);
      return;
    }
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout>;

    const mirar = () => {
      if (!vivo) return;
      // Vuelve al centro a menudo: la mirada de frente es la que conecta.
      if (Math.random() < 0.45) {
        miraX.set(0);
        miraY.set(0);
      } else {
        miraX.set((Math.random() - 0.5) * 3.6);
        miraY.set((Math.random() - 0.5) * 2.4);
      }
      reloj = setTimeout(mirar, 900 + Math.random() * 2200);
    };

    reloj = setTimeout(mirar, 600 + Math.random() * 1200);
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [miraX, miraY, quieto, ojoAbierto]);

  /*
    La boca al hablar.

    El alto y el ancho van desfasados a propósito: desfasados dan las formas que
    se ven cuadro a cuadro en alguien hablando —alta y estrecha, ancha y baja,
    casi una línea— sin repetir la combinación. Sincronizados solo dan un pico
    que se abre y se cierra.

    `intensidad` manda en CUÁNTO abre, no en cada cuánto: el ritmo de las
    sílabas es del idioma y no del volumen, y acelerarlo con la voz alta
    parecería un dibujo animado antiguo. El suelo de 0,3 tampoco es capricho: un
    micrófono nunca lee cero en mitad de una palabra, y una mandíbula que se
    para del todo a media frase no se lee como silencio, se lee como que la
    aplicación se ha colgado.
  */
  const bocaAlto = useMotionValue(1);
  const bocaAncho = useMotionValue(1);
  const bocaAltos = useSpring(bocaAlto, RESORTE.boca);
  const bocaAnchos = useSpring(bocaAncho, RESORTE.boca);
  const cabezaHabla = useMotionValue(0);
  const cabezaHablas = useSpring(cabezaHabla, RESORTE.cabeza);

  const tope = useRef(1);
  tope.current = aperturaDeVoz(intensidad);

  useEffect(() => {
    if (!hablando || quieto) {
      bocaAlto.set(1);
      bocaAncho.set(1);
      cabezaHabla.set(0);
      return;
    }
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout>;

    const silaba = () => {
      if (!vivo) return;
      const t = tope.current;
      // Cada sílaba es una forma distinta, no un ciclo. De ahí que no se lea
      // como una mandíbula con muelle.
      bocaAlto.set(1 + (0.15 + Math.random() * 0.75) * t);
      bocaAncho.set(1 - (0.05 + Math.random() * 0.3) * t);
      cabezaHabla.set((Math.random() - 0.5) * 3);
      reloj = setTimeout(silaba, 110 + Math.random() * 130);
    };

    silaba();
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [hablando, quieto, bocaAlto, bocaAncho, cabezaHabla]);

  // El ladeo propio del estado y el que la cabeza hace por su cuenta se suman:
  // son dos cosas distintas que tienen que poder pasar a la vez.
  const cabezaGiro = useTransform(
    [cabezaPoses, ladeos, cabezaHablas],
    ([p, l, h]: number[]) => p! + l! + h!,
  );

  /*
    El alto de los ojos junta la pose con el parpadeo multiplicándolos.

    Entornar los ojos de felicidad y cerrarlos para parpadear son lo mismo en
    distinto grado, así que se multiplican: así se puede parpadear estando
    contento sin que un gesto pise al otro.
  */
  const ojoEscala = useTransform([ojoPoses, parpados], ([p, b]: number[]) => p! * b!);

  /*
    Las alas están en lados opuestos, así que «levantar» es girar en un sentido
    en una y en el contrario en la otra. La coreografía se escribe en grados
    hacia arriba, sin más, y la inversión se hace aquí: teniendo que acordarse
    en cada pose, se olvida, y de hecho se olvidó.

    La salida lateral va en dirección contraria por el mismo motivo, y arrastra
    una pizca de subida: un brazo que se separa del cuerpo también se eleva.
  */
  const giroAlaCercana = useTransform(alaCercanas, (v) => v);
  const giroAlaLejana = useTransform(alaLejanas, (v) => -v);
  const xAlaCercana = useTransform(fueraCercanas, (v) => -v);
  const xAlaLejana = useTransform(fueraLejanas, (v) => v);
  const yAlaCercana = useTransform(fueraCercanas, (v) => -v * 0.5);
  const yAlaLejana = useTransform(fueraLejanas, (v) => -v * 0.5);

  // Dormido los párpados caen relajados; pensando se arquean hacia arriba, que
  // es lo que distingue a alguien con los ojos cerrados de alguien dormido.
  const parpadosCerrados =
    estado === 'durmiendo'
      ? ['M44 40 Q50 45 56 40', 'M64 40 Q70 45 76 40']
      : ['M44 40 Q50 35 56 40', 'M64 40 Q70 35 76 40'];

  /*
    `transform-box: view-box` en todo lo que pivota, y no es opcional.

    La librería marca por su cuenta lo que anima con `transform-box: fill-box`, y
    con eso un pivote escrito en píxeles deja de contarse desde el lienzo y pasa
    a contarse desde el borde de cada pieza. Los pivotes de aquí son del lienzo
    —el cuello de cada especie, la bisagra de cada boca, la línea del suelo— así
    que hay que decirle expresamente que los deje en coordenadas del lienzo.

    Sin esto la cabeza gira alrededor de un punto que cae fuera del cráneo. Se
    ve casi bien, que es lo que hace que un fallo así dure meses.
  */
  const enLienzo = { transformBox: 'view-box' as const };

  /*
    Y el pivote hay que darlo partido en dos, no como una cadena.

    La librería solo mira `originX` y `originY`; un `transformOrigin` entero se
    lo pasa por alto y escribe su valor por defecto, «50% 50%», que es el centro
    de la pieza. Con eso la cabeza volvía a ladear por el centro del cráneo, como
    una pegatina, en vez de por el cuello. Las especies declaran su pivote como
    una cadena de dos medidas —así se lee bien en sus archivos— y aquí se parte.
  */
  const pivote = (donde: string) => {
    const [ejeX, ejeY] = donde.split(/\s+/);
    return { originX: ejeX, originY: ejeY, ...enLienzo };
  };
  const cuello = `60px ${animal.anclajes.cuello}px`;

  return (
    <svg
      viewBox="0 0 120 120"
      width={tamano}
      height={tamano}
      role="img"
      aria-label={
        prendaConocida
          ? `${animal.etiqueta}, con ${NOMBRE_ATUENDO[prendaConocida]}`
          : animal.etiqueta
      }
      className={cn('select-none', className)}
    >
      {/* Ondas de sonido: solo cuando está escuchando */}
      {estado === 'escuchando' && (
        <g className="text-marca-400">
          <circle
            cx="60"
            cy="62"
            r="48"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.35"
            className="animate-onda"
          />
          <circle
            cx="60"
            cy="62"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.2"
            className="animate-onda"
            style={{ animationDelay: '0.6s' }}
          />
        </g>
      )}

      {/*
        El cuerpo: la pose del estado entera cuelga de aquí.

        El pivote está en la línea del suelo, y=108, que es donde apoyan las
        patas de las cinco especies. Escalando desde el centro las patas se
        movían con todo lo demás y el animal levitaba en bloque en vez de coger
        aire; con el pivote en el suelo se quedan plantadas y lo que crece es el
        cuerpo hacia arriba, que es lo que hace un pecho al llenarse. Se nota
        sobre todo en el escaparate de la tienda, que dibuja una sombra fija
        debajo: antes las patas se despegaban de su propia sombra en cada
        inspiración.

        Las patas van dentro a propósito. Sacarlas fuera para dejarlas quietas
        estiraría las piernas de Milo y del búho, que son líneas de y=100 a
        y=108, como un chicle mientras el cuerpo sube sin ellas.
      */}
      <motion.g
        data-capa="cuerpo"
        style={{
          y: ys,
          scaleX: eXs,
          scaleY: eYs,
          rotate: giros,
          originX: '60px',
          originY: '108px',
          ...enLienzo,
        }}
      >
        {/*
          Cola. El giro lo pone esta capa y la forma la pone la especie, porque
          una cola de zorro pesa donde no pesa una de pájaro y pide otro pivote.
          Lleva el resorte más pesado de todos: una cola no se mueve sola, la
          arrastra el cuerpo, y llega tarde.
        */}
        <motion.g data-capa="cola" style={{ rotate: colaPoses, ...pivote(animal.origenCola) }}>
          {animal.cola}
        </motion.g>

        {/* Cuerpo y barriga */}
        {animal.cuerpo}

        {/*
          Los dos miembros de delante. El de la derecha es más pequeño y más
          oscuro: así se lee como el que queda del lado de allá, y el animal deja
          de verse plano. Llevan resortes distintos, no un desfase fijo: al
          arrancar y frenar de forma distinta nunca coinciden, y dos alas
          perfectamente sincronizadas parecen un mecanismo, no un bicho.
        */}
        <motion.g
          style={{
            rotate: giroAlaLejana,
            x: xAlaLejana,
            y: yAlaLejana,
            originX: '82px',
            originY: '66px',
            ...enLienzo,
          }}
          data-capa="ala-lejana"
        >
          {animal.alaLejana}
        </motion.g>

        <motion.g
          style={{
            rotate: giroAlaCercana,
            x: xAlaCercana,
            y: yAlaCercana,
            originX: '38px',
            originY: '66px',
            ...enLienzo,
          }}
          data-capa="ala-cercana"
        >
          {animal.alaCercana}
        </motion.g>

        {/*
          La cabeza y la cara. El origen está en el cuello, no en la cabeza, para
          que gire como si tuviera una y no como una pegatina rotando sobre sí
          misma.
        */}
        <motion.g style={{ rotate: cabezaGiro, ...pivote(cuello) }} data-capa="cabeza">
          {/* Orejas, penachos o copete: detrás del cráneo para que asomen. */}
          {animal.orejas}

          {/* Cráneo, y lo que va debajo de los ojos: mejillas, discos, antifaz. */}
          {animal.cabeza}

          {/*
            Los ojos, en capas. Abrir más, parpadear y mirar son tres cosas que
            tienen que poder ocurrir a la vez, y en un mismo elemento la segunda
            transformación se come a la primera.

            Son idénticos en las cinco especies, y no por pereza: son la parte
            que más se mira y la única con tres ciclos encima. Si cada animal
            moviera los suyos, cada animal tendría su forma de romperse.
          */}
          <motion.g
            style={{ scaleY: ojoEscala, originX: '60px', originY: '40px', ...enLienzo }}
            data-capa="ojos"
          >
            <circle cx="50" cy="40" r="9" fill="white" />
            <circle cx="70" cy="40" r="9" fill="white" />

            {/*
              La mirada. Se queda montada aunque los ojos estén cerrados y solo
              se apaga. Si se desmontara, al volver de pensar arrancaría de cero
              y se notaría el salto.
            */}
            <motion.g
              className={cn(
                'transition-opacity duration-200',
                ojoAbierto ? 'opacity-100' : 'opacity-0',
              )}
              style={{ x: miraXs, y: miraYs }}
              data-capa="mirada"
            >
              <circle
                cx={estado === 'feliz' ? 51 : 50}
                cy="41"
                r="4.5"
                className="fill-slate-900"
              />
              <circle
                cx={estado === 'feliz' ? 71 : 70}
                cy="41"
                r="4.5"
                className="fill-slate-900"
              />
              <circle cx="52" cy="39" r="1.6" fill="white" />
              <circle cx="72" cy="39" r="1.6" fill="white" />
            </motion.g>

            {/* Párpados cerrados: arqueados al pensar, caídos al dormir. */}
            <g
              className={cn(
                'transition-opacity duration-200',
                ojoAbierto ? 'opacity-0' : 'opacity-100',
              )}
            >
              <path
                d={parpadosCerrados[0]}
                stroke="#0f172a"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d={parpadosCerrados[1]}
                stroke="#0f172a"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            </g>
          </motion.g>

          {/*
            La nariz o el morro, si la especie los tiene sueltos. Van aquí y no
            dentro de la boca porque al hablar la boca se encoge, y una nariz
            dibujada dentro se encogería con la mandíbula. Se pinta antes que la
            boca para que en los hocicos largos la lengua le quede por debajo.
          */}
          {animal.hocico}

          {/*
            La boca. Las dos versiones están siempre puestas y se cruzan en
            opacidad; antes se sustituía una por otra y el pico aparecía de golpe
            justo cuando empezaba a hablar, que es cuando más se ve.
          */}
          <g
            className={cn(
              'transition-opacity duration-200',
              picoAbierto ? 'opacity-0' : 'opacity-100',
            )}
          >
            {animal.bocaCerrada}
          </g>
          <g
            className={cn(
              'transition-opacity duration-200',
              picoAbierto ? 'opacity-100' : 'opacity-0',
            )}
          >
            {/*
              Hablar no es cruzar las dos bocas a golpes: eso se lee como un pico
              que se abre y se cierra. Lo que se hace es deformar la boca
              abierta, que es lo que pasa de verdad al hablar, y por eso la
              cerrada se apaga entera mientras dura.

              Alto y ancho en capas distintas porque son dos transformaciones y
              en el mismo elemento la segunda anula a la primera.
            */}
            <motion.g
              style={{ scaleY: bocaAltos, ...pivote(animal.origenBoca) }}
              data-capa="mandibula"
            >
              <motion.g
                style={{ scaleX: bocaAnchos, ...pivote(animal.origenBoca) }}
                data-capa="mandibula-ancho"
              >
                {animal.bocaAbierta}
              </motion.g>
            </motion.g>
          </g>

          {/*
            La ropa, lo último de la capa de la cabeza.

            Cuelga de aquí y no del svg por una razón sola: esta capa es la que
            se ladea, así que el gorro se ladea con ella. Colgado más arriba se
            quedaría clavado mientras la cabeza gira debajo, que es exactamente
            el efecto de pegatina que costó tanto quitar.
          */}
          {prendaConocida && <CapaAtuendo atuendo={prendaConocida} anclajes={animal.anclajes} />}
        </motion.g>

        {/* Patas */}
        {animal.patas}
      </motion.g>

      {/* Estrellitas al celebrar */}
      {estado === 'celebrando' && (
        <g className="fill-acento-400">
          <path
            d="M18 26 l2.5 5 5 2.5 -5 2.5 -2.5 5 -2.5 -5 -5 -2.5 5 -2.5 z"
            className="animate-destello"
          />
          <path
            d="M100 40 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 z"
            className="animate-destello"
            style={{ animationDelay: '0.3s' }}
          />
          <path
            d="M96 14 l1.5 3 3 1.5 -3 1.5 -1.5 3 -1.5 -3 -3 -1.5 3 -1.5 z"
            className="animate-destello"
            style={{ animationDelay: '0.6s' }}
          />
        </g>
      )}

      {/*
        Las zetas de dormir. Reutilizan el flotar del cartel de empezar en vez
        de estrenar animación: el gesto es el mismo, subir despacio, y una
        animación menos es una cosa menos que mantener afinada.
      */}
      {estado === 'durmiendo' && (
        <g className="fill-marca-400" aria-hidden="true">
          <text
            x="86"
            y="28"
            fontSize="15"
            fontWeight="700"
            opacity="0.7"
            className="animate-flotar"
          >
            z
          </text>
          <text
            x="99"
            y="15"
            fontSize="10"
            fontWeight="700"
            opacity="0.45"
            className="animate-flotar"
            style={{ animationDelay: '0.7s' }}
          >
            z
          </text>
        </g>
      )}
    </svg>
  );
}

/** La mascota diciendo algo, para las pantallas donde acompaña con un mensaje. */
export function MascotaConMensaje({
  estado = 'neutral',
  // Sin valor por defecto a propósito: poniendo 'PET_MILO' aquí se le pasaría
  // a `Mascota` una especie expresa, y entonces ya no miraría la que la persona
  // lleva puesta. Un defecto puesto por comodidad que anula la elección.
  especie,
  atuendo,
  mensaje,
  tamano = 90,
}: {
  estado?: EstadoMascota;
  especie?: Especie;
  atuendo?: Atuendo | null;
  mensaje: string;
  tamano?: number;
}) {
  return (
    <div className="flex items-end gap-3">
      <Mascota
        estado={estado}
        especie={especie}
        atuendo={atuendo}
        tamano={tamano}
        className="shrink-0"
      />
      <div className="relative mb-4 flex-1 animate-entrada rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-4 py-3">
        {/* Pico del bocadillo */}
        <span className="absolute -left-2 bottom-4 size-3 rotate-45 border-b-2 border-l-2 border-[var(--borde)] bg-[var(--superficie)]" />
        <p className="text-sm">{mensaje}</p>
      </div>
    </div>
  );
}
