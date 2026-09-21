import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';

/**
 * Milo, movido con física en vez de con fotogramas.
 *
 * El Milo de siempre se mueve con animaciones de CSS: se declara dónde empieza
 * y dónde acaba cada cosa, y el navegador rellena el medio a velocidad fija.
 * Eso vale para un latido o un parpadeo, pero se nota mecánico en cualquier
 * cosa que responda a algo, porque todo tarda exactamente lo mismo pase lo que
 * pase.
 *
 * Aquí no hay duraciones. Cada parte cuelga de un resorte con su propia
 * rigidez, amortiguación y masa, así que el tiempo que tarda en llegar lo
 * decide la distancia que tenga que recorrer. Un ojo que sigue al cursor a dos
 * centímetros llega enseguida; el mismo ojo cruzando la pantalla acelera,
 * frena y se pasa un poco antes de asentarse. Eso es lo que se lee como vivo.
 *
 * Las masas están escogidas para que las partes no lleguen a la vez: la cabeza
 * es más pesada que los ojos y llega después, y esa diferencia de unas décimas
 * es la que hace que parezca un cuerpo y no un dibujo con piezas pegadas.
 */

/** Resortes, de lo más ligero a lo más pesado. */
const RESORTE = {
  /** Las pupilas. Casi sin inercia: el ojo llega antes que la cabeza. */
  mirada: { type: 'spring' as const, stiffness: 420, damping: 24, mass: 0.35 },
  /** La cabeza. Pesa, así que se queda atrás y rebota al parar. */
  cabeza: { type: 'spring' as const, stiffness: 140, damping: 14, mass: 1.1 },
  /** El cuerpo. El más lento de todos: apenas acompaña. */
  cuerpo: { type: 'spring' as const, stiffness: 90, damping: 16, mass: 1.6 },
  /** Las alas al reaccionar. Blandas, para que se noten sueltas. */
  ala: { type: 'spring' as const, stiffness: 180, damping: 10, mass: 0.6 },
};

/**
 * Si esta persona pidió menos movimiento en su sistema.
 *
 * Se lee a mano y no con `useReducedMotion` de la librería porque esa guarda la
 * consulta la primera vez que se monta cualquier componente y ya no la vuelve a
 * mirar. En la aplicación da igual; en las pruebas significa que el ajuste no se
 * puede comprobar, y este es justo el sitio donde importa comprobarlo.
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

interface Props {
  tamano?: number;
  className?: string;
}

export function MiloVivo({ tamano = 240, className }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  /*
    Quien pide menos movimiento no recibe ni respiración ni seguimiento.

    Es norma del proyecto y aquí importa más que en otras pantallas: un
    personaje que persigue el cursor por toda la página es justo lo que marea
    a quien activa ese ajuste. Se queda quieto y mirando al frente, que sigue
    siendo un pájaro.
  */
  const quieto = useMenosMovimiento();

  // Dónde está el cursor respecto al centro del personaje, de -1 a 1.
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Cada parte sigue a ese valor con su propio resorte. De aquí sale el
  // desfase entre ojos, cabeza y cuerpo: mismos datos, distinta inercia.
  const miradaX = useSpring(x, RESORTE.mirada);
  const miradaY = useSpring(y, RESORTE.mirada);
  const cabezaX = useSpring(x, RESORTE.cabeza);
  const cabezaY = useSpring(y, RESORTE.cabeza);
  const cuerpoX = useSpring(x, RESORTE.cuerpo);

  /*
    El aliento, también con resorte.

    Se hace empujando un valor entre dos extremos y dejando que el resorte
    viaje: como está poco amortiguado, se pasa de largo y vuelve, y ese
    sobreimpulso es lo que da la sensación de aire entrando y saliendo. Con una
    animación de ida y vuelta a velocidad constante se ve el bucle enseguida.
  */
  const aliento = useMotionValue(0);
  const alientoSuave = useSpring(aliento, { stiffness: 26, damping: 9, mass: 1.4 });

  useEffect(() => {
    let vivo = true;
    let arriba = true;

    if (quieto) return;

    const respirar = () => {
      if (!vivo) return;
      arriba = !arriba;
      aliento.set(arriba ? 1 : 0);
      // El tiempo entre inspiraciones varía: respirar a compás es de máquina.
      setTimeout(respirar, 1500 + Math.random() * 900);
    };

    respirar();
    return () => {
      vivo = false;
    };
  }, [aliento, quieto]);

  useEffect(() => {
    if (quieto) return;

    const alMover = (evento: PointerEvent) => {
      const caja = contenedor.current?.getBoundingClientRect();
      if (!caja) return;

      // Se normaliza por una distancia fija y no por el tamaño de la ventana:
      // así el personaje reacciona igual de vivo en un móvil que en un monitor
      // grande, en vez de quedarse quieto porque «todavía está cerca».
      const ALCANCE = 320;
      const dx = (evento.clientX - (caja.left + caja.width / 2)) / ALCANCE;
      const dy = (evento.clientY - (caja.top + caja.height / 2)) / ALCANCE;

      x.set(Math.max(-1, Math.min(1, dx)));
      y.set(Math.max(-1, Math.min(1, dy)));
    };

    // Al salir el cursor vuelve al centro, con su resorte: no se queda mirando
    // a una esquina para siempre.
    const alSalir = () => {
      x.set(0);
      y.set(0);
    };

    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerleave', alSalir);
    return () => {
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerleave', alSalir);
    };
  }, [x, y, quieto]);

  /*
    El estiramiento es ASIMÉTRICO, y ahí está medio efecto.

    Un ser vivo que coge aire se alarga y se estrecha a la vez, conservando más
    o menos el volumen. Escalar los dos ejes igual lo hincha como un globo, que
    es justo lo que delata a un dibujo.
  */
  const escalaY = useTransform(alientoSuave, [0, 1], [0.975, 1.035]);
  const escalaX = useTransform(alientoSuave, [0, 1], [1.025, 0.978]);
  // Al inflarse sube un poco: el peso se desplaza, no se queda clavado.
  const subida = useTransform(alientoSuave, [0, 1], [1.5, -2.5]);

  // La cabeza se inclina hacia donde mira, no solo se desplaza.
  const giroCabeza = useTransform(cabezaX, [-1, 1], [-7, 7]);
  const cabezaPx = useTransform(cabezaX, [-1, 1], [-5, 5]);
  const cabezaPy = useTransform(cabezaY, [-1, 1], [-3.5, 3.5]);

  // Las pupilas llegan hasta el borde del ojo, sin salirse.
  const pupilaX = useTransform(miradaX, [-1, 1], [-2.6, 2.6]);
  const pupilaY = useTransform(miradaY, [-1, 1], [-2.2, 2.2]);

  // El cuerpo acompaña muy poco: si acompaña mucho, se desmonta.
  const cuerpoPx = useTransform(cuerpoX, [-1, 1], [-2, 2]);
  // La cola va al revés que el cuerpo, como un contrapeso.
  const giroCola = useTransform(cuerpoX, [-1, 1], [6, -6]);

  return (
    <div
      ref={contenedor}
      className={className ?? 'flex min-h-dvh w-full items-center justify-center bg-[var(--fondo)]'}
    >
      <motion.svg
        viewBox="0 0 120 120"
        width={tamano}
        height={tamano}
        role="img"
        aria-label="Milo, el pájaro de Speakmi"
        className="select-none overflow-visible"
        style={{ x: cuerpoPx }}
        // Al entrar aparece con el mismo resorte, no con un desvanecido.
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={RESORTE.cabeza}
        whileTap={{ scale: 0.94 }}
      >
        {/* La sombra se encoge cuando el cuerpo sube: es lo que lo ata al suelo. */}
        <motion.ellipse
          cx="60"
          cy="107"
          ry="3.5"
          className="fill-black/10 dark:fill-black/40"
          style={{ scaleX: useTransform(alientoSuave, [0, 1], [1.06, 0.94]) }}
          rx="26"
        />

        {/* Todo el bicho respira: el estiramiento cuelga de aquí. */}
        {/*
          Lo que respira es el cuerpo, no el dibujo entero.
          Moviendo el SVG completo subían también las patas y la sombra, y el
          pájaro levitaba en bloque en vez de coger aire. La sombra se queda
          quieta en el suelo y solo se estrecha, que es lo que ata la figura.
        */}
        <motion.g
          style={{ y: subida, scaleX: escalaX, scaleY: escalaY, originX: '60px', originY: '104px' }}
        >
          <motion.path
            d="M22 78 L4 92 L26 88 Z"
            className="fill-marca-700"
            style={{ rotate: giroCola, originX: '24px', originY: '82px' }}
          />

          <motion.ellipse
            cx="88"
            cy="68"
            rx="10"
            ry="16"
            className="fill-marca-800"
            style={{
              rotate: useTransform(cabezaX, [-1, 1], [10, -14]),
              originX: '84px',
              originY: '58px',
            }}
            whileHover={{ rotate: -38 }}
            transition={RESORTE.ala}
          />

          <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-marca-600" />
          <ellipse cx="62" cy="74" rx="22" ry="24" className="fill-marca-100" />

          <motion.ellipse
            cx="32"
            cy="68"
            rx="12"
            ry="18"
            className="fill-marca-700"
            style={{
              rotate: useTransform(cabezaX, [-1, 1], [-14, 10]),
              originX: '36px',
              originY: '58px',
            }}
            whileHover={{ rotate: -46 }}
            transition={RESORTE.ala}
          />

          <path d="M55 20 L60 26 L65 20 Z" className="fill-marca-700" />

          {/* La cabeza: se mueve y se inclina hacia donde mira. */}
          <motion.g
            style={{
              x: cabezaPx,
              y: cabezaPy,
              rotate: giroCabeza,
              originX: '60px',
              originY: '62px',
            }}
          >
            <circle cx="60" cy="42" r="26" className="fill-marca-600" />

            <Ojo cx={50} pupilaX={pupilaX} pupilaY={pupilaY} />
            <Ojo cx={70} pupilaX={pupilaX} pupilaY={pupilaY} />

            <motion.path
              d="M54 52 L60 60 L66 52 Z"
              className="fill-amber-400"
              style={{ scaleY: useTransform(alientoSuave, [0, 1], [1, 1.12]), originY: '52px' }}
            />
          </motion.g>
          {/* Las patas van con el cuerpo: si se quedan clavadas mientras el
              tronco sube, las piernas se estiran como un chicle. */}
          <path
            d="M50 100 L50 108 M46 108 L56 108"
            className="stroke-amber-400"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M70 100 L70 108 M64 108 L74 108"
            className="stroke-amber-400"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </motion.g>
      </motion.svg>
    </div>
  );
}

/**
 * Un ojo con su pupila.
 *
 * El párpado no está: el parpadeo pide un temporizador y aquí se ha querido
 * dejar solo lo que responde a la física y al cursor, para que se vea de dónde
 * viene cada cosa.
 */
function Ojo({
  cx,
  pupilaX,
  pupilaY,
}: {
  cx: number;
  pupilaX: MotionValue<number>;
  pupilaY: MotionValue<number>;
}) {
  return (
    <g>
      <circle cx={cx} cy={40} r="9" fill="white" />
      <motion.g style={{ x: pupilaX, y: pupilaY }}>
        <circle cx={cx} cy={41} r="4.5" className="fill-slate-900" />
        {/* El brillo no se mueve con la pupila: está en la córnea, no dentro. */}
      </motion.g>
      <circle cx={cx + 2} cy={38} r="1.6" fill="white" opacity={0.9} />
    </g>
  );
}
