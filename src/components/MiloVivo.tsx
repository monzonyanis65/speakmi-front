import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';

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
 *
 * Y sobre todo: esto no es un dibujo de frente que agita las alas. Gira la
 * cabeza de verdad, pone caras y puede darse la vuelta entera. Cómo se
 * consigue eso sin tener un modelo en tres dimensiones está explicado abajo,
 * donde pone EL GIRO.
 */

/*
  Por qué todos los pivotes de este archivo van en PORCENTAJE y no en píxeles.

  La librería marca cada elemento que anima con `transform-box: fill-box`, y eso
  cambia qué significa un pivote: `originX: '60px'` deja de ser «el punto 60 del
  lienzo» y pasa a ser «60 píxeles desde el borde izquierdo de ESTA pieza». Como
  cada pieza tiene su caja, el mismo número cae en un sitio distinto en cada una.

  Estuvo escrito en píxeles y medido en el navegador salió así: la cabeza giraba
  alrededor de x≈94 en vez de 60, o sea por fuera del cráneo, y el ojo se
  estrechaba alrededor de un punto 50 píxeles a su derecha, así que al girar se
  deslizaba en vez de quedarse donde estaba. Se veía casi bien, que es lo peor
  que le puede pasar a un fallo así.

  En porcentaje no hay ambigüedad y además se dice sola la intención: 50%/100% es
  «por el suelo», 50%/50% es «sobre sí mismo», 100%/0% es «colgando de su
  esquina». Si alguien vuelve a poner píxeles aquí, esto se rompe sin avisar.
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
  /** Los párpados. Rápidos y sin rebote: un parpadeo que rebota da susto. */
  parpado: { type: 'spring' as const, stiffness: 900, damping: 42, mass: 0.2 },
  /** La cara al cambiar de mueca. Con algo de rebote, que es lo que da gracia. */
  mueca: { type: 'spring' as const, stiffness: 260, damping: 16, mass: 0.7 },
  /** La vuelta entera. Poco amortiguada: se pasa de largo y vuelve. */
  vuelta: { type: 'spring' as const, stiffness: 55, damping: 13, mass: 1 },
};

/**
 * Las muecas.
 *
 * Cada una es un juego de números, no un dibujo: a dónde van las cejas, cuánto
 * se cierran los ojos, cuánto se abre el pico y cómo se ladea la cabeza. Como
 * son números y cada uno cuelga de un resorte, el paso de una cara a otra lo
 * calcula la física, y no hay que dibujar ni un solo fotograma intermedio. Ahí
 * está la diferencia con tener seis ilustraciones y cambiar de una a otra: el
 * camino entre dos caras es infinito y siempre distinto.
 *
 * Las cejas son el añadido más rentable de todo el archivo. Milo no las tenía,
 * y son dos trazos: con ellas el mismo pájaro pasa de sorprendido a pícaro sin
 * tocar nada más de la cara.
 */
const MUECAS = {
  neutral: { ceja: 0, cejaGiro: 0, ojo: 1, pico: 1, ladeo: 0 },
  feliz: { ceja: -1.5, cejaGiro: -7, ojo: 0.72, pico: 1.3, ladeo: -3 },
  sorpresa: { ceja: -4.5, cejaGiro: 0, ojo: 1.32, pico: 1.6, ladeo: -5 },
  pensando: { ceja: -1, cejaGiro: 15, ojo: 0.88, pico: 0.9, ladeo: 7 },
  travieso: { ceja: 1.6, cejaGiro: -17, ojo: 0.78, pico: 1.1, ladeo: 5 },
  triste: { ceja: 2.2, cejaGiro: 19, ojo: 0.68, pico: 0.85, ladeo: 9 },
};

export type Mueca = keyof typeof MUECAS;

/** El orden en que se van poniendo solas cuando nadie dice cuál. */
const RONDA: Mueca[] = ['neutral', 'feliz', 'sorpresa', 'travieso', 'pensando', 'triste'];

/**
 * Si esta persona pidió menos movimiento en su sistema.
 *
 * Se lee a mano y no con `useReducedMotion` de la librería porque esa guarda la
 * consulta la primera vez que se monta cualquier componente y ya no la vuelve a
 * mirar. En la aplicación da igual; en las pruebas significa que el ajuste no
 * se puede comprobar, y este es justo el sitio donde importa comprobarlo.
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
  /** Qué cara pone. Sin decir ninguna, las va pasando sola. */
  mueca?: Mueca;
}

export function MiloVivo({ tamano = 240, className, mueca }: Props) {
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

  // Los párpados. 1 es el ojo abierto del todo.
  const parpado = useMotionValue(1);
  const parpadoSuave = useSpring(parpado, RESORTE.parpado);

  // La mueca, repartida en un valor por rasgo.
  const ceja = useMotionValue(0);
  const cejaGiro = useMotionValue(0);
  const ojoAlto = useMotionValue(1);
  const picoAlto = useMotionValue(1);
  const ladeo = useMotionValue(0);
  const cejaSuave = useSpring(ceja, RESORTE.mueca);
  const cejaGiroSuave = useSpring(cejaGiro, RESORTE.mueca);
  const ojoAltoSuave = useSpring(ojoAlto, RESORTE.mueca);
  const picoAltoSuave = useSpring(picoAlto, RESORTE.mueca);
  const ladeoSuave = useSpring(ladeo, RESORTE.cabeza);

  // Cuántas vueltas lleva dadas. Es un número que crece, no un ángulo: así la
  // vuelta se pide sumando uno y el resorte se encarga del resto.
  const vuelta = useMotionValue(0);

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

  /*
    El parpadeo.

    Cerrar y abrir son dos órdenes seguidas, no una animación de ida y vuelta:
    se manda cerrar, y en cuanto el párpado ha llegado abajo se manda abrir. El
    resorte es rígido y está muy amortiguado, así que el gesto entero dura lo
    que dura un parpadeo de verdad sin que nadie haya escrito cuánto.

    De vez en cuando parpadea dos veces seguidas, que es lo que hace la gente y
    lo que rompe la sospecha de que hay un temporizador detrás.
  */
  useEffect(() => {
    if (quieto) return;
    let vivo = true;
    const relojes: ReturnType<typeof setTimeout>[] = [];

    const siguiente = () => {
      if (!vivo) return;
      const doble = Math.random() < 0.25;
      cerrar(doble ? 180 : 2200 + Math.random() * 3200);
    };

    const cerrar = (luego: number) => {
      if (!vivo) return;
      parpado.set(0.05);
      relojes.push(
        setTimeout(() => {
          if (!vivo) return;
          parpado.set(1);
          relojes.push(setTimeout(siguiente, luego));
        }, 95),
      );
    };

    relojes.push(setTimeout(siguiente, 900));
    return () => {
      vivo = false;
      relojes.forEach(clearTimeout);
    };
  }, [parpado, quieto]);

  /*
    Las muecas: la que le digan, o dando la ronda si no le dicen ninguna.

    Aguantar cada cara unos segundos y pasar a la siguiente es lo que convierte
    un dibujo en alguien que está ahí. Quieto no cambia de cara solo, pero sí
    obedece si se la piden: no moverse por su cuenta no es lo mismo que no
    poder reaccionar.
  */
  useEffect(() => {
    const poner = (cual: Mueca) => {
      const m = MUECAS[cual];
      ceja.set(m.ceja);
      cejaGiro.set(m.cejaGiro);
      ojoAlto.set(m.ojo);
      picoAlto.set(m.pico);
      ladeo.set(m.ladeo);
    };

    if (mueca) {
      poner(mueca);
      return;
    }

    poner('neutral');
    if (quieto) return;

    let paso = 0;
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout>;

    const rodar = () => {
      if (!vivo) return;
      paso += 1;
      poner(RONDA[paso % RONDA.length]!);
      reloj = setTimeout(rodar, 2400 + Math.random() * 1400);
    };

    reloj = setTimeout(rodar, 2600);
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [mueca, quieto, ceja, cejaGiro, ojoAlto, picoAlto, ladeo]);

  /** Darse la vuelta entera. Una vuelta más sobre las que lleve. */
  const darLaVuelta = () => {
    if (quieto) return;
    animate(vuelta, Math.round(vuelta.get()) + 1, RESORTE.vuelta);
  };

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
  const sombraX = useTransform(alientoSuave, [0, 1], [1.06, 0.94]);
  const alaLejanaGiro = useTransform(cabezaX, [-1, 1], [10, -14]);
  const alaCercanaGiro = useTransform(cabezaX, [-1, 1], [-14, 10]);

  /*
    EL GIRO. Esto es lo que hace que no sea una calcomanía.

    Un personaje plano de frente no puede girarse: por mucho que se le mueva la
    cabeza de lado a lado, sigue siendo la misma cara mirando al frente, solo
    que desplazada. Lo que se hace aquí es aprovechar que este pájaro no es un
    dibujo cerrado sino unas cuantas figuras con sus coordenadas: si esas
    coordenadas se mueven como se moverían al girar una cabeza, la cabeza gira.

    Tres cosas a la vez, y las tres hacen falta:

      1. Los rasgos se desplazan hacia el lado al que mira.
      2. El PICO se desplaza MÁS que los ojos. Sobresale del cráneo, así que al
         girar recorre más camino que algo pegado a la superficie. Esa
         diferencia es el paralaje, y es lo que da el volumen: sin ella la cara
         se desliza entera y se lee como una pegatina resbalando.
      3. El ojo de FUERA se estrecha y se acerca al otro, porque se está yendo
         al borde de una esfera. El de dentro casi no cambia.

    Con eso, de frente a tres cuartos no hay ningún dibujo nuevo: son los
    mismos círculos en otro sitio, y el resorte hace el camino.
  */
  const giroCabeza = useTransform(cabezaX, [-1, 1], [-7, 7]);
  const cabezaPx = useTransform(cabezaX, [-1, 1], [-5, 5]);
  const cabezaPy = useTransform(cabezaY, [-1, 1], [-3.5, 3.5]);
  const inclinacion = useTransform([giroCabeza, ladeoSuave], ([g, l]: number[]) => g! + l!);

  /*
    El pico viaja MÁS que cualquier rasgo pegado al cráneo, y por bastante.
    Sobresale de la cara, así que al girar describe un arco más grande que los
    ojos, que van pegados a la superficie. Medido en el navegador: el pico
    recorre el doble que el ojo. Igualarlos deja la cara deslizándose en bloque.
  */
  const picoDesvio = useTransform(cabezaX, [-1, 1], [-17, 17]);
  // El copete va en lo alto del cráneo, así que acompaña como los ojos.
  const copeteDesvio = useTransform(cabezaX, [-1, 1], [-8, 8]);
  // Cada ojo se desplaza distinto según sea el de dentro o el de fuera.
  const ojoIzqX = useTransform(cabezaX, (v) => v * 8 + Math.max(0, v) * 5);
  const ojoDerX = useTransform(cabezaX, (v) => v * 8 + Math.min(0, v) * 5);
  // Y el de fuera se estrecha, que es lo que lo manda al borde de la esfera.
  const ojoIzqAncho = useTransform(cabezaX, (v) => 1 - Math.max(0, v) * 0.45);
  const ojoDerAncho = useTransform(cabezaX, (v) => 1 - Math.max(0, -v) * 0.45);

  // Las pupilas llegan hasta el borde del ojo, sin salirse.
  const pupilaX = useTransform(miradaX, [-1, 1], [-2.6, 2.6]);
  const pupilaY = useTransform(miradaY, [-1, 1], [-2.2, 2.2]);

  /*
    El alto de los ojos junta la mueca con el parpadeo.

    Entrecerrar los ojos de felicidad y cerrarlos para parpadear son lo mismo
    en distinto grado, así que se multiplican: así se puede parpadear estando
    contento sin que un gesto pise al otro. Sumarlos o ponerlos en capas
    distintas daría un ojo que se cierra de más o que se queda a medias.
  */
  const ojoEscalaY = useTransform([ojoAltoSuave, parpadoSuave], ([m, p]: number[]) => m! * p!);

  // El cuerpo acompaña muy poco: si acompaña mucho, se desmonta.
  const cuerpoPx = useTransform(cuerpoX, [-1, 1], [-2, 2]);
  // La cola va al revés que el cuerpo, como un contrapeso.
  const giroCola = useTransform(cuerpoX, [-1, 1], [6, -6]);

  /*
    La vuelta entera.

    El cuerpo se estrecha hasta casi desaparecer y vuelve a abrirse, que es lo
    que se ve cuando algo gira sobre su eje. En el momento en que estaría de
    espaldas se apaga la cara y se enciende la nuca, así que la vuelta se
    completa de verdad en vez de quedarse en un guiño.

    El ancho nunca llega a cero: a cero el navegador deja de dibujar la figura y
    se ve un parpadeo feo justo en el punto que más se mira.
  */
  const anguloVuelta = useTransform(vuelta, (v) => v * Math.PI * 2);
  const coseno = useTransform(anguloVuelta, (a) => Math.cos(a));
  const anchoVuelta = useTransform(coseno, (c) => Math.max(0.06, Math.abs(c)));
  const deFrente = useTransform(coseno, (c) => (c >= 0 ? 1 : 0));
  const deEspaldas = useTransform(coseno, (c) => (c < 0 ? 1 : 0));

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
        className="cursor-pointer select-none overflow-visible"
        style={{ x: cuerpoPx }}
        // Al entrar aparece con el mismo resorte, no con un desvanecido.
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={RESORTE.cabeza}
        whileTap={{ scale: 0.94 }}
        onClick={darLaVuelta}
      >
        {/* La sombra se encoge cuando el cuerpo sube: es lo que lo ata al suelo. */}
        <motion.ellipse
          cx="60"
          cy="107"
          ry="3.5"
          className="fill-black/10 dark:fill-black/40"
          style={{ scaleX: sombraX }}
          rx="26"
        />

        {/*
          La capa de la vuelta. Va por fuera de la del aliento porque las dos
          escriben el ancho, y en un mismo elemento la segunda se come a la
          primera: el pájaro dejaría de respirar mientras gira.
        */}
        <motion.g style={{ scaleX: anchoVuelta, originX: '50%' }}>
          {/*
            Lo que respira es el cuerpo, no el dibujo entero.
            Moviendo el SVG completo subían también las patas y la sombra, y el
            pájaro levitaba en bloque en vez de coger aire. La sombra se queda
            quieta en el suelo y solo se estrecha, que es lo que ata la figura.
          */}
          <motion.g
            style={{
              y: subida,
              scaleX: escalaX,
              scaleY: escalaY,
              originX: '50%',
              originY: '100%',
            }}
          >
            <motion.path
              d="M22 78 L4 92 L26 88 Z"
              className="fill-marca-700"
              style={{ rotate: giroCola, originX: '100%', originY: '0%' }}
            />

            <motion.ellipse
              cx="88"
              cy="68"
              rx="10"
              ry="16"
              className="fill-marca-800"
              style={{ rotate: alaLejanaGiro, originX: '0%', originY: '0%' }}
              whileHover={{ rotate: -38 }}
              transition={RESORTE.ala}
            />

            <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-marca-600" />

            {/*
              La barriga clara también se da la vuelta. Se veía la pechera
              estando de espaldas, que es de las cosas que rompen el truco al
              instante: un pájaro visto por detrás no enseña la tripa. En su
              lugar se enciende el lomo, más oscuro, que es lo que taparían las
              alas plegadas.
            */}
            <motion.ellipse
              cx="62"
              cy="74"
              rx="22"
              ry="24"
              className="fill-marca-100"
              style={{ opacity: deFrente }}
            />
            <motion.ellipse
              cx="60"
              cy="72"
              rx="20"
              ry="26"
              className="fill-marca-700"
              style={{ opacity: deEspaldas }}
            />

            <motion.ellipse
              cx="32"
              cy="68"
              rx="12"
              ry="18"
              className="fill-marca-700"
              style={{ rotate: alaCercanaGiro, originX: '100%', originY: '0%' }}
              whileHover={{ rotate: -46 }}
              transition={RESORTE.ala}
            />

            {/* La cabeza: se mueve, se inclina y gira hacia donde mira. */}
            <motion.g
              style={{
                x: cabezaPx,
                y: cabezaPy,
                rotate: inclinacion,
                originX: '50%',
                originY: '100%',
              }}
            >
              {/*
                El copete, dentro de la cabeza y antes que el cráneo para que
                asome por detrás. Estuvo fuera del grupo y se quedaba clavado en
                el aire mientras la cabeza giraba debajo: el pájaro parecía
                llevarlo puesto en vez de tenerlo.
              */}
              <motion.path
                d="M55 20 L60 26 L65 20 Z"
                className="fill-marca-700"
                style={{ x: copeteDesvio }}
              />

              <circle cx="60" cy="42" r="26" className="fill-marca-600" />

              {/* La cara. Se apaga cuando está de espaldas. */}
              <motion.g style={{ opacity: deFrente }}>
                <Ceja cx={50} alto={cejaSuave} giro={cejaGiroSuave} desvio={ojoIzqX} lado={-1} />
                <Ceja cx={70} alto={cejaSuave} giro={cejaGiroSuave} desvio={ojoDerX} lado={1} />

                <Ojo
                  cx={50}
                  pupilaX={pupilaX}
                  pupilaY={pupilaY}
                  desvio={ojoIzqX}
                  ancho={ojoIzqAncho}
                  alto={ojoEscalaY}
                />
                <Ojo
                  cx={70}
                  pupilaX={pupilaX}
                  pupilaY={pupilaY}
                  desvio={ojoDerX}
                  ancho={ojoDerAncho}
                  alto={ojoEscalaY}
                />

                {/* El pico, que es lo que más viaja al girar. */}
                <motion.path
                  d="M54 52 L60 60 L66 52 Z"
                  className="fill-amber-400"
                  style={{ x: picoDesvio, scaleY: picoAltoSuave, originY: '0%' }}
                />
              </motion.g>

              {/*
                La nuca, para cuando se da la vuelta. Sin cara y más oscura: es
                lo único que hay que dibujar aparte para que la vuelta se
                complete en vez de quedarse en un guiño.
              */}
              <motion.g style={{ opacity: deEspaldas }}>
                <circle cx="60" cy="42" r="26" className="fill-marca-700" />
                <ellipse cx="60" cy="36" rx="14" ry="10" className="fill-marca-800" opacity="0.5" />
              </motion.g>
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
        </motion.g>
      </motion.svg>
    </div>
  );
}

/**
 * Una ceja.
 *
 * Es un trazo y hace la mitad del trabajo de la cara. Acompaña al ojo en el
 * giro, porque una ceja que se queda quieta mientras el ojo se va al borde se
 * despega de la cara al momento.
 */
function Ceja({
  cx,
  alto,
  giro,
  desvio,
  lado,
}: {
  cx: number;
  alto: MotionValue<number>;
  giro: MotionValue<number>;
  desvio: MotionValue<number>;
  /** -1 la izquierda, 1 la derecha. Las cejas se arquean en espejo. */
  lado: number;
}) {
  const giroPropio = useTransform(giro, (g) => g * lado);

  return (
    <motion.g style={{ x: desvio, y: alto }}>
      <motion.path
        d={`M${cx - 7} 28 Q${cx} 24 ${cx + 7} 28`}
        className="stroke-marca-800"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        style={{ rotate: giroPropio, originX: '50%', originY: '50%' }}
      />
    </motion.g>
  );
}

/**
 * Un ojo con su pupila.
 *
 * El ancho lo manda el giro de la cabeza y el alto lo mandan la mueca y el
 * parpadeo juntos. Van en capas separadas a propósito: si el mismo elemento
 * llevara los dos, uno se comería al otro y el ojo no se podría estrechar por
 * el giro mientras se cierra por el parpadeo.
 */
function Ojo({
  cx,
  pupilaX,
  pupilaY,
  desvio,
  ancho,
  alto,
}: {
  cx: number;
  pupilaX: MotionValue<number>;
  pupilaY: MotionValue<number>;
  desvio: MotionValue<number>;
  ancho: MotionValue<number>;
  alto: MotionValue<number>;
}) {
  return (
    <motion.g style={{ x: desvio, scaleX: ancho, originX: '50%' }}>
      <motion.g style={{ scaleY: alto, originY: '50%' }}>
        <circle cx={cx} cy={40} r="9" fill="white" />
        <motion.g style={{ x: pupilaX, y: pupilaY }}>
          <circle cx={cx} cy={41} r="4.5" className="fill-slate-900" />
        </motion.g>
        {/* El brillo no se mueve con la pupila: está en la córnea, no dentro. */}
        <circle cx={cx + 2} cy={38} r="1.6" fill="white" opacity={0.9} />
      </motion.g>
    </motion.g>
  );
}
