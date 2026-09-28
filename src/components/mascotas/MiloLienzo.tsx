import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { dibujarMilo, type Cuadro } from './dibujo';
import {
  ALCANCE_MIRADA,
  DirectorDeTics,
  mezclarPoses,
  parpadeoEn,
  poseDelMomento,
  poseQuieta,
  seguirMirada,
  TRANSICION,
} from './motor';
import { abonar } from './reloj';
import {
  aperturaDeVoz,
  ESTADOS_CON_TICS,
  GESTOS,
  visemaDeVoz,
  type EstadoMascota,
} from './coreografia';
import { type Atuendo, type Visema } from './tipos';

/**
 * Milo pintado en un lienzo, con el motor de física nuevo.
 *
 * Solo pinta a Milo. Las otras cuatro especies siguen con el esqueleto SVG de
 * `Mascota.tsx`, y eso es una decisión, no un olvido: el encargo era el motor de
 * Milo, y un motor a mano por animal es justo lo que la separación entre formas
 * y esqueleto se inventó para evitar. Está dicho en el informe y es el hueco
 * más grande que queda.
 *
 *
 * CUÁNTO CUESTA ESTO, QUE ES LA PREGUNTA DE VERDAD
 *
 * Milo se pinta a 38 px en Sombras de Neón, a 44 en Escucha y a 52 en el
 * Mercado, y en esas pantallas ya hay un juego animando. Un bucle de 60
 * fotogramas por segundo por cada Milo, encima de eso, no es gratis. Aquí se
 * paga de cuatro maneras:
 *
 *   1. UN SOLO RELOJ para todos los Milos (`reloj.ts`). Da igual cuántos haya
 *      en la pantalla: hay un `requestAnimationFrame` y una lista.
 *   2. SOLO SE ANIMA EL QUE SE VE. Un observador de intersección da de baja al
 *      Milo que se sale de la pantalla. En la tienda hay siete y se ven dos.
 *   3. POR DEBAJO DE 64 px SE PINTA MENOS. El degradado de la sombra, el
 *      desplazamiento de la pupila y el brillo del ojo miden menos de un píxel
 *      a ese tamaño: quitarlos no se ve, y son la mitad de las órdenes de
 *      dibujo del fotograma.
 *   4. POR DEBAJO DE 40 px NO SE ANIMA EN REPOSO. Ver el razonamiento en
 *      `MINIMO_ANIMADO`.
 */

/**
 * Por debajo de esto, Milo no anima de continuo: solo reacciona.
 *
 * A 38 px el pájaro entero mide como una letra. El salto de doce unidades se
 * queda en 3,8 px, el aleteo en menos de dos, y lo que se ve no es un personaje
 * moviéndose: es una mancha índigo que vibra al lado de un texto. Gastar un
 * fotograma de un juego en eso es pagar por empeorar la pantalla.
 *
 * Pero apagarlo del todo tampoco sirve, porque a ese tamaño Milo está haciendo
 * un trabajo concreto: en Sombras de Neón es el que dice si has acertado. Así
 * que se anima CUANDO CAMBIA EL ESTADO y se para al terminar. Se ve la
 * reacción, que es lo único que ahí significa algo, y en reposo cuesta cero.
 */
const MINIMO_ANIMADO = 40;

/** Cuánto dura la reacción de un Milo pequeño antes de volver a pararse. */
const REACCION = 1100;

/** Por debajo de esto se pintan menos detalles. Ver `Cuadro.simple`. */
const MINIMO_DETALLE = 64;

/**
 * Cuánto sobresale el lienzo de su propia caja, en tanto por uno.
 *
 * El SVG llevaba `overflow-visible` porque el dibujo ocupa el lienzo entero y
 * cualquier postura que suba se sale. Un lienzo de mapa de bits NO tiene esa
 * opción: lo que se pinta fuera del mapa se pierde, sin aviso y sin recorte
 * visible, simplemente no está.
 *
 * Medido con el salto completo: con el estiramiento de 1,32 pivotando en el
 * suelo, la coronilla sube de y=16 a 108 − 92·1,32 = −13,4, y con las doce
 * unidades de altura llega a −25,4. Un margen de 26 unidades arriba lo cubre
 * con dos de sobra. A los lados basta con doce: lo que más se sale es el ala
 * saludando, que llega a x≈19 menos su medio grosor.
 *
 * El elemento se coloca con posición absoluta DENTRO de una caja del tamaño
 * pedido, así que la maquetación de las treinta pantallas que lo usan no se
 * entera: por fuera sigue midiendo `tamano`.
 */
const MARGEN = { arriba: 0.22, lados: 0.1, abajo: 0.06 };

/**
 * Dónde está el puntero, con UN SOLO oyente para todos los Milos.
 *
 * El mismo argumento que el reloj compartido: siete Milos en la tienda son
 * siete `pointermove` que el navegador tiene que repartir en cada movimiento
 * del ratón, y todos quieren exactamente el mismo dato. Se guarda en
 * coordenadas de ventana y cada Milo lo traduce a las suyas cuando le toca
 * pintar.
 */
const puntero = { x: 0, y: 0, visto: false };
let oyendo = false;

function escucharPuntero() {
  if (oyendo || typeof window === 'undefined') return;
  oyendo = true;
  const apuntar = (x: number, y: number) => {
    puntero.x = x;
    puntero.y = y;
    puntero.visto = true;
  };
  window.addEventListener('pointermove', (e) => apuntar(e.clientX, e.clientY), { passive: true });
  // El táctil también, que es por donde entra la mayoría: en un móvil el dedo
  // es el cursor, y un Milo que solo mira ratones no mira a casi nadie.
  window.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (t) apuntar(t.clientX, t.clientY);
    },
    { passive: true },
  );
}

interface Props {
  estado: EstadoMascota;
  atuendo: Atuendo | null;
  intensidad?: number;
  tamano: number;
  etiqueta: string;
  className?: string;
  /** Con movimiento reducido se pinta un solo fotograma y no se anima nada. */
  quieto: boolean;
}

export function MiloLienzo({
  estado,
  atuendo,
  intensidad,
  tamano,
  etiqueta,
  className,
  quieto,
}: Props) {
  const refLienzo = useRef<HTMLCanvasElement | null>(null);

  /*
    El puente entre React y el bucle.

    React sabe cuándo cambia el estado o el tamaño; el bucle sabe qué hacer con
    esa noticia. Van por aquí y no por las dependencias del efecto porque volver
    a montar el bucle reiniciaría el ciclo del salto, el parpadeo y el cruce de
    la boca: Milo empezaría a celebrar desde el suelo cada vez que un juego le
    cambia la cara.
  */
  const avisar = useRef<((porCambioDeEstado: boolean) => void) | null>(null);
  const cambiarDeEstado = useRef<((anterior: EstadoMascota) => void) | null>(null);
  const anterior = useRef(estado);

  /*
    Lo que cambia desde fuera se lee de una caja, no de las dependencias.

    El bucle se monta una vez y tiene que durar. Metiendo `estado` o
    `intensidad` en las dependencias del efecto, cada respuesta de un juego
    desmontaría y volvería a montar el abono al reloj, y con él se reiniciarían
    el ciclo del salto, el parpadeo y el cruce de la boca. El resultado se ve:
    Milo empieza a celebrar desde el suelo en vez de desde donde estaba.
  */
  const vivos = useRef({ estado, atuendo, intensidad, tamano, quieto });
  vivos.current = { estado, atuendo, intensidad, tamano, quieto };

  useEffect(() => {
    const lienzo = refLienzo.current;
    if (!lienzo) return;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return;

    escucharPuntero();

    /*
      El estado interno del motor.

      Vive aquí dentro y no en React a propósito: son valores que cambian
      sesenta veces por segundo y ninguno de ellos debe provocar un dibujado de
      React. Un `useState` para la mirada sería sesenta renders por segundo por
      cada Milo, que es exactamente lo que este archivo existe para evitar.
    */
    const yo = {
      /** El número propio de este Milo: lo que impide que dos vayan a la vez. */
      desfase: Math.random(),
      miraX: 0,
      miraY: 0,
      inercia: 0,
      yAnterior: 0,
      boca: GESTOS[vivos.current.estado].boca as Visema,
      bocaPrevia: GESTOS[vivos.current.estado].boca as Visema,
      cruce: 1,
      bocaAlto: 1,
      bocaAncho: 1,
      siguienteSilaba: 0,
      caja: null as DOMRect | null,
      cajaVista: -1e9,
      tics: new DirectorDeTics(),
      /*
        De dónde viene y cuándo empezó a venir.

        Es lo que paga la única deuda que este motor tenía con el de resortes:
        allí cada parte colgaba de un muelle, así que al cambiar de estado salía
        hacia la postura nueva y se pasaba un poco. Una función del tiempo
        contesta la postura nueva desde el primer fotograma, o sea que sin esto
        Milo pasa de tranquilo a celebrando EN UN FOTOGRAMA. Eso es un corte, no
        una reacción.
      */
      desde: null as EstadoMascota | null,
      cambioEn: 0,
    };

    /** El tamaño real del mapa de bits, con el margen y la densidad de pantalla. */
    let escala = 1;
    let anchoMundo = 120;
    let altoMundo = 120;
    let desX = 0;
    let desY = 0;

    const medir = () => {
      const { tamano: lado } = vivos.current;
      const izq = lado * MARGEN.lados;
      const arr = lado * MARGEN.arriba;
      const anchoCss = lado + izq * 2;
      const altoCss = lado + arr + lado * MARGEN.abajo;

      /*
        El escalado de retina, que es lo que separa un dibujo nítido de uno
        borroso. El mapa de bits se hace `dpr` veces más grande que el elemento
        y luego se escala el contexto: así una línea de un píxel es un píxel de
        pantalla y no dos medios grises.

        Se topa en 2. Hay móviles con 3 y hasta 3,5, y a 3,5 un Milo de 130 px
        ocupa un mapa de 455 px de lado por cuatro canales: 828 KB de memoria de
        vídeo por mascota, para una diferencia que a ese tamaño ya no ve nadie.
      */
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      lienzo.style.width = `${anchoCss}px`;
      lienzo.style.height = `${altoCss}px`;
      lienzo.style.left = `${-izq}px`;
      lienzo.style.top = `${-arr}px`;
      lienzo.width = Math.round(anchoCss * dpr);
      lienzo.height = Math.round(altoCss * dpr);

      escala = (lado / 120) * dpr;
      desX = izq * dpr;
      desY = arr * dpr;
      anchoMundo = lienzo.width;
      altoMundo = lienzo.height;
    };

    medir();

    /*
      El último instante pintado.

      Se guarda porque hay fotogramas sueltos que no vienen del reloj: al
      montar, al cambiar de tamaño y al volver a entrar en pantalla. Pintándolos
      con un cero, un Milo que lleva cinco segundos celebrando daría un
      fotograma de vuelta al suelo antes de seguir, y eso se ve como un tirón.
    */
    let ultimoT = 0;

    /** Un fotograma entero: calcular la postura y pintarla. */
    const pintar = (t: number, dt: number) => {
      ultimoT = t;
      const { estado: ahora, atuendo: ropa, intensidad: fuerza, quieto: parado } = vivos.current;
      const gesto = GESTOS[ahora];

      /*
        Con movimiento reducido se pide la postura de reposo del estado, no un
        fotograma del ciclo con el reloj parado.

        Parecen lo mismo y no lo son, y se vio en las capturas: con el reloj en
        cero, `poseDelMomento` sigue leyendo el desfase propio de cada Milo, así
        que cada uno se quedaba clavado en un punto distinto de su ciclo. En
        reposo solo daba variedad; celebrando dejaba a unos aplastados contra el
        suelo y a otros colgados del aire a media altura. Congelar una animación
        en un fotograma cualquiera es exactamente lo que hace apagar el CSS, y
        es lo que este motor tenía que evitar.
      */
      const reloj = parado ? 0 : t;
      const tic = parado ? null : yo.tics.paso(reloj, ESTADOS_CON_TICS.includes(ahora));
      let pose = parado ? poseQuieta(ahora) : poseDelMomento(ahora, reloj, yo.desfase, tic);

      /*
        Y si viene de otro estado, se sale de aquel hacia este.

        El estado de antes se sigue calculando mientras dura la transición, no
        se congela: un cuerpo que deja de respirar durante un cuarto de segundo
        mientras cambia de gesto se nota, aunque nadie sepa decir qué pasó.
      */
      if (yo.desde && !parado) {
        const avance = (reloj - yo.cambioEn) / TRANSICION;
        if (avance >= 1) yo.desde = null;
        else pose = mezclarPoses(poseDelMomento(yo.desde, reloj, yo.desfase, tic), pose, avance);
      }

      // La inercia: hacia dónde va el cuerpo. Es lo que dobla los codos hacia
      // atrás al arrancar y los suelta al frenar.
      if (dt > 0 && !parado) {
        const velocidad = (pose.y - yo.yAnterior) / dt;
        yo.inercia += (Math.max(-1, Math.min(1, velocidad * 12)) - yo.inercia) * 0.18;
      }
      yo.yAnterior = pose.y;

      // ---- Los párpados, con su propio reloj.
      const parpado = parado ? 1 : parpadeoEn(reloj, yo.desfase);

      // ---- La mirada, siguiendo al puntero con interpolación lineal.
      if (!parado && puntero.visto) {
        if (reloj - yo.cajaVista > 250) {
          yo.caja = lienzo.getBoundingClientRect();
          yo.cajaVista = reloj;
        }
        const caja = yo.caja;
        if (caja && caja.width > 0) {
          const cx = caja.left + caja.width / 2;
          const cy = caja.top + caja.height / 2;
          // Se normaliza contra media pantalla y no contra el tamaño de Milo:
          // contra su tamaño, un cursor a 200 px de un Milo de 44 saturaría
          // siempre y los ojos se quedarían clavados en el extremo.
          const ref = Math.max(240, window.innerWidth / 2);
          const objX = Math.max(-1, Math.min(1, (puntero.x - cx) / ref)) * ALCANCE_MIRADA.x;
          const objY = Math.max(-1, Math.min(1, (puntero.y - cy) / ref)) * ALCANCE_MIRADA.y;
          yo.miraX = seguirMirada(yo.miraX, objX, dt);
          yo.miraY = seguirMirada(yo.miraY, objY, dt);
        }
      } else {
        yo.miraX = seguirMirada(yo.miraX, 0, dt);
        yo.miraY = seguirMirada(yo.miraY, 0, dt);
      }

      // ---- La boca.
      const hablando = ahora === 'hablando' && !parado;
      if (hablando) {
        if (reloj >= yo.siguienteSilaba) {
          const tope = aperturaDeVoz(fuerza);
          let cual = visemaDeVoz(tope, Math.random());
          // Nunca dos veces la misma seguida: repetir es lo que delata que hay
          // un mecanismo detrás y no alguien diciendo algo.
          if (cual === yo.boca) cual = visemaDeVoz(tope, Math.random());
          ponerBoca(cual);
          // El alto y el ancho van desfasados: sincronizados solo dan un pico
          // que se abre y se cierra, desfasados dan las formas que se ven
          // cuadro a cuadro en alguien hablando.
          yo.bocaAlto = 1 + (0.05 + Math.random() * 0.2) * tope;
          yo.bocaAncho = 1 - (0.03 + Math.random() * 0.14) * tope;
          yo.siguienteSilaba = reloj + 110 + Math.random() * 130;
        }
      } else {
        ponerBoca(gesto.boca);
        yo.bocaAlto += (1 - yo.bocaAlto) * 0.25;
        yo.bocaAncho += (1 - yo.bocaAncho) * 0.25;
      }
      // El cruce de una boca a otra dura 110 ms. Es el más seco de todo el
      // motor y tiene que serlo: al hablar cambia cada 120, y con un cruce
      // blando las seis bocas se quedarían medio encendidas a la vez.
      if (yo.cruce < 1) yo.cruce = Math.min(1, yo.cruce + dt / 110);

      const cuadro: Cuadro = {
        pose,
        estado: ahora,
        parpado,
        miraX: yo.miraX,
        miraY: yo.miraY,
        inercia: yo.inercia,
        boca: yo.boca,
        bocaPrevia: yo.bocaPrevia,
        cruce: yo.cruce,
        bocaAlto: yo.bocaAlto,
        bocaAncho: yo.bocaAncho,
        atuendo: ropa,
        t: reloj,
        simple: vivos.current.tamano < MINIMO_DETALLE,
      };

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, anchoMundo, altoMundo);
      ctx.setTransform(escala, 0, 0, escala, desX, desY);
      dibujarMilo(ctx, cuadro);
    };

    const ponerBoca = (cual: Visema) => {
      if (cual === yo.boca) return;
      yo.bocaPrevia = yo.boca;
      yo.boca = cual;
      yo.cruce = 0;
    };

    // ---- Quién decide si este Milo corre o está parado.
    let soltar: (() => void) | null = null;
    let paradaPequeno: ReturnType<typeof setTimeout> | null = null;

    const arrancar = () => {
      if (soltar) return;
      soltar = abonar(pintar);
    };
    const parar = () => {
      soltar?.();
      soltar = null;
    };

    /*
      El Milo pequeño: se anima al cambiar de estado y se vuelve a parar.

      Se programa aquí dentro y no con un efecto de React porque el corte tiene
      que caer en el mismo sitio que el bucle: con un efecto aparte, un cambio
      de estado durante la reacción dejaría dos relojes compitiendo por pararlo.
    */
    /** Que el estado de antes siga contando mientras Milo sale de él. */
    const arrancarTransicion = (anterior: EstadoMascota) => {
      if (anterior === vivos.current.estado) return;
      yo.desde = anterior;
      yo.cambioEn = ultimoT;
    };

    const reaccionar = () => {
      if (paradaPequeno) clearTimeout(paradaPequeno);
      arrancar();
      paradaPequeno = setTimeout(() => {
        parar();
        paradaPequeno = null;
      }, REACCION);
    };

    let visible = true;
    const pequeno = () => vivos.current.tamano < MINIMO_ANIMADO;

    const decidir = (porCambioDeEstado: boolean) => {
      // Cambiar el tamaño del mapa de bits lo borra, así que medir siempre va
      // seguido de pintar. Aquí es barato: esto lo llama React cuando algo
      // cambia, no el reloj.
      medir();

      if (vivos.current.quieto) {
        // Un solo fotograma y a dormir. Sigue teniendo cara: la postura que sale
        // del reloj en cero es la de reposo del estado, no un fotograma suelto.
        parar();
        pintar(0, 16);
        return;
      }
      if (!visible) {
        parar();
        return;
      }
      if (pequeno()) {
        // En reposo, quieto; al cambiar de estado, una reacción corta.
        if (porCambioDeEstado) reaccionar();
        pintar(ultimoT, 16);
        return;
      }
      arrancar();
      // Un fotograma ya, sin esperar al reloj: si no, hay un instante en blanco
      // al montar, y en la rejilla de siete Milos de la tienda eso se ve como
      // que la pantalla carga a trompicones.
      pintar(ultimoT, 16);
    };

    decidir(false);
    avisar.current = decidir;
    cambiarDeEstado.current = arrancarTransicion;

    /*
      Solo se anima el que se ve.

      En la tienda hay un Milo por atuendo más el del escaparate, y en una
      pantalla de móvil se ven dos. Los otros cinco no tienen por qué gastar
      nada. También cubre el caso de la ruta, donde Milo se queda muy por
      encima del pliegue en cuanto bajas.
    */
    let observador: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observador = new IntersectionObserver(
        (entradas) => {
          const dentro = entradas[0]?.isIntersecting ?? true;
          if (dentro === visible) return;
          visible = dentro;
          decidir(false);
        },
        { rootMargin: '64px' },
      );
      observador.observe(lienzo);
    }

    const alRedimensionar = () => {
      medir();
      if (!soltar) pintar(0, 16);
    };
    window.addEventListener('resize', alRedimensionar);

    return () => {
      parar();
      if (paradaPequeno) clearTimeout(paradaPequeno);
      observador?.disconnect();
      window.removeEventListener('resize', alRedimensionar);
      avisar.current = null;
      cambiarDeEstado.current = null;
    };
    // Se monta una vez por Milo. Todo lo que cambia entra por `vivos`.
  }, []);

  // Un cambio de estado es una noticia: se sale del anterior hacia el nuevo, y
  // el Milo pequeño además despierta para que se vea la reacción.
  useEffect(() => {
    cambiarDeEstado.current?.(anterior.current);
    anterior.current = estado;
    avisar.current?.(true);
  }, [estado]);

  // El tamaño, la ropa y el ajuste de movimiento solo piden volver a decidir.
  useEffect(() => {
    avisar.current?.(false);
  }, [tamano, atuendo, quieto]);

  return (
    <div
      className={cn('relative select-none', className)}
      style={{ width: tamano, height: tamano }}
      role="img"
      aria-label={etiqueta}
    >
      <canvas
        ref={refLienzo}
        aria-hidden="true"
        // No captura nada: el lienzo sobresale de su caja para que quepa el
        // salto, y si recogiera clics se comería los de lo que tenga encima.
        className="pointer-events-none absolute"
      />
    </div>
  );
}
