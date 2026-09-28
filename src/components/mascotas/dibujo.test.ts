import { describe, expect, it } from 'vitest';
import { dibujarMilo, olvidarPaleta, SUELO, type Cuadro } from './dibujo';
import { conservarVolumen, poseDelMomento, type PoseViva } from './motor';
import { type EstadoMascota } from './coreografia';

/**
 * Lo que de verdad se pinta, comprobado sin pintar nada.
 *
 * jsdom no trae lienzo de dos dimensiones, así que `getContext('2d')` devuelve
 * nada y aquí no se puede mirar ni un píxel. Pero un lienzo es una SECUENCIA DE
 * ÓRDENES —mueve, curva, traza— y esa sí se puede recoger: se le pasa a
 * `dibujarMilo` un contexto de mentira que en vez de dibujar apunta lo que le
 * piden, y después se lee.
 *
 * Es mejor sitio de lo que parece, porque lo que hay que comprobar de este
 * encargo no es el color de un píxel: es que el ala se trace con una CURVA y no
 * con una elipse, que las puntas sean redondas, que la sombra sea un degradado
 * y que la cabeza gire por el cuello. Todo eso son órdenes, y todo eso lo
 * suspende el motor de marioneta anterior: allí el ala era
 * `<ellipse rx=11 ry=20>` y no había ni una curva ni una sombra.
 */

interface Llamada {
  op: string;
  args: number[];
  lineCap: string;
  lineJoin: string;
  lineWidth: number;
  strokeStyle: string;
  fillStyle: unknown;
  globalAlpha: number;
}

interface LienzoFalso {
  ctx: CanvasRenderingContext2D;
  llamadas: Llamada[];
  ops(nombre: string): Llamada[];
}

const METODOS = [
  'save',
  'restore',
  'translate',
  'rotate',
  'scale',
  'setTransform',
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'arc',
  'arcTo',
  'ellipse',
  'quadraticCurveTo',
  'bezierCurveTo',
  'fill',
  'stroke',
  'clearRect',
  'fillText',
];

function lienzoFalso(): LienzoFalso {
  const llamadas: Llamada[] = [];
  const ctx = {
    lineCap: 'butt',
    lineJoin: 'miter',
    lineWidth: 1,
    strokeStyle: '#000',
    fillStyle: '#000',
    globalAlpha: 1,
    font: '',
    textAlign: 'start',
    createRadialGradient(...args: number[]) {
      anotar('createRadialGradient', args);
      return { addColorStop: () => {} };
    },
  } as unknown as Record<string, unknown>;

  function anotar(op: string, args: number[]) {
    llamadas.push({
      op,
      args,
      lineCap: ctx.lineCap as string,
      lineJoin: ctx.lineJoin as string,
      lineWidth: ctx.lineWidth as number,
      strokeStyle: ctx.strokeStyle as string,
      fillStyle: ctx.fillStyle,
      globalAlpha: ctx.globalAlpha as number,
    });
  }

  for (const m of METODOS) {
    ctx[m] = (...args: unknown[]) =>
      anotar(
        m,
        args.filter((a) => typeof a === 'number'),
      );
  }

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    llamadas,
    ops: (nombre) => llamadas.filter((l) => l.op === nombre),
  };
}

/** Un fotograma cualquiera, con los valores que no se están comprobando a 1. */
function cuadro(extra: Partial<Cuadro> = {}): Cuadro {
  const estado: EstadoMascota = extra.estado ?? 'neutral';
  return {
    pose: poseDelMomento(estado, 800, 0.3),
    estado,
    parpado: 1,
    miraX: 0,
    miraY: 0,
    inercia: 0,
    boca: 'cerrada',
    bocaPrevia: 'cerrada',
    cruce: 1,
    bocaAlto: 1,
    bocaAncho: 1,
    atuendo: null,
    t: 800,
    simple: false,
    ...extra,
  };
}

function pintar(extra: Partial<Cuadro> = {}): LienzoFalso {
  olvidarPaleta();
  const falso = lienzoFalso();
  dibujarMilo(falso.ctx, cuadro(extra));
  return falso;
}

/**
 * Dónde se va el dibujo al pivote del cuerpo.
 *
 * Hace falta buscarlo y no dar por hecho que es el primero: la sombra se pinta
 * ANTES que el pájaro, para quedar debajo, y también se desplaza y se escala.
 */
function pivoteDelCuerpo(llamadas: Llamada[]): number {
  return llamadas.findIndex((l) => l.op === 'translate' && l.args[0] === 60 && l.args[1] === SUELO);
}

/** El escalado del cuerpo entero: el que va detrás de ese pivote. */
function escalaDelCuerpo(llamadas: Llamada[]): [number, number] {
  const i = pivoteDelCuerpo(llamadas);
  const escala = llamadas.slice(i).find((l) => l.op === 'scale')!;
  return escala.args as [number, number];
}

describe('las extremidades son de goma, no piezas rígidas', () => {
  it('las alas se trazan con una CURVA, no con una elipse', () => {
    /*
      Esta es la prueba del primer requisito y la que el dibujo anterior
      suspende de plano: allí el ala era `<ellipse cx=32 cy=72 rx=11 ry=20>`,
      una cápsula que gira y punto. Una elipse no se dobla, y eso es todo el
      aspecto de marioneta del que venimos.
    */
    const { llamadas } = pintar();
    const curvas = llamadas.filter((l) => l.op === 'quadraticCurveTo');
    expect(curvas.length, 'no hay ni una curva en el dibujo').toBeGreaterThan(0);

    // Las dos alas son trazos gruesos, y los trazos gruesos del dibujo son
    // exactamente esas dos: 20 la de acá y 19 la de allá.
    const alas = llamadas.filter((l) => l.op === 'stroke' && l.lineWidth >= 15);
    expect(alas.length, 'faltan alas o sobran trazos gruesos').toBe(2);

    // Y ninguna se pinta ya con una elipse rellena del tamaño del ala vieja.
    const elipses = llamadas.filter((l) => l.op === 'ellipse');
    for (const e of elipses) {
      const [, , rx, ry] = e.args;
      const eraUnAla = Math.abs(rx! - 11) < 2 && Math.abs(ry! - 20) < 2;
      expect(eraUnAla, 'sigue habiendo un ala dibujada como elipse rígida').toBe(false);
    }
  });

  it('las puntas y las uniones son redondas: ni una arista en el ala', () => {
    const { llamadas } = pintar();
    for (const trazo of llamadas.filter((l) => l.op === 'stroke' && l.lineWidth >= 15)) {
      expect(trazo.lineCap, 'un ala con la punta cuadrada').toBe('round');
      expect(trazo.lineJoin).toBe('round');
    }
  });

  it('el codo se aparta de la recta entre hombro y punta', () => {
    /*
      Una `quadraticCurveTo` cuyo punto de control cayera en la recta entre los
      dos extremos dibujaría un palo, no una curva. Aquí se comprueba que el
      control está de verdad fuera de esa recta.
    */
    const { llamadas } = pintar();
    let curvasDeAla = 0;
    for (let i = 0; i < llamadas.length; i++) {
      // Un ala es la terna moveTo -> quadraticCurveTo -> stroke grueso. Se
      // busca por el trazo y no por la curva a secas porque el copete también
      // lleva curvas y hereda el grosor del ala que se pintó antes.
      if (llamadas[i]!.op !== 'stroke' || llamadas[i]!.lineWidth < 15) continue;
      const c = llamadas[i - 1]!;
      const desde = llamadas[i - 2]!;
      expect(c.op).toBe('quadraticCurveTo');
      expect(desde.op, 'la curva del ala no arranca de un moveTo').toBe('moveTo');
      const [hx, hy] = desde.args as [number, number];
      const [cx, cy, px, py] = c.args as [number, number, number, number];
      // Distancia del punto de control a la recta hombro-punta.
      const area = Math.abs((px - hx) * (cy - hy) - (cx - hx) * (py - hy));
      const largo = Math.hypot(px - hx, py - hy);
      expect(area / largo, 'el codo está en la recta: eso es un palo').toBeGreaterThan(0.5);
      curvasDeAla++;
    }
    expect(curvasDeAla).toBe(2);
  });

  it('el codo cambia de sitio con la inercia del cuerpo', () => {
    // Al arrancar el cuerpo, el ala se queda atrás; al frenar, la sigue. Eso es
    // el arrastre, y es lo que hace que el ala parezca tener peso.
    const control = (inercia: number) => {
      const { llamadas } = pintar({ inercia });
      const i = llamadas.findIndex((l) => l.op === 'stroke' && l.lineWidth >= 15);
      const c = llamadas[i - 1]!;
      return { x: c.args[0]!, y: c.args[1]! };
    };
    const subiendo = control(1);
    const bajando = control(-1);
    const separacion = Math.hypot(subiendo.x - bajando.x, subiendo.y - bajando.y);
    expect(separacion, 'la inercia no dobla nada').toBeGreaterThan(1);
  });

  it('las patas también se doblan, y se recogen al saltar', () => {
    const suelto = pintar({ pose: { ...poseDelMomento('neutral', 0, 0), patas: 0 } as PoseViva });
    const recogido = pintar({ pose: { ...poseDelMomento('neutral', 0, 0), patas: 1 } as PoseViva });
    const pieDe = (l: LienzoFalso) => {
      // La pata es la curva fina; el pie es el moveTo del dedo que va detrás.
      const c = l.llamadas.find((x) => x.op === 'quadraticCurveTo' && x.lineWidth < 5)!;
      return c.args[3]!;
    };
    // Recogida, el pie sube hacia el cuerpo.
    expect(pieDe(recogido)).toBeLessThan(pieDe(suelto));
    // Pero no tanto como para colarse dentro de la barriga, que acaba en y=102.
    expect(pieDe(recogido), 'el pie se mete en la barriga').toBeGreaterThan(102);
  });
});

describe('el volumen se conserva también en lo que se pinta', () => {
  it('el cuerpo se escala con los dos ejes compensados', () => {
    for (const estado of ['neutral', 'celebrando', 'triste'] as EstadoMascota[]) {
      for (const t of [0, 190, 420, 700, 980]) {
        const { llamadas } = pintar({ estado, pose: poseDelMomento(estado, t, 0) });
        // La escala del cuerpo es la que va detrás del pivote del suelo. No es
        // la primera del dibujo: antes está la de la sombra, que se pinta antes
        // que el pájaro para quedar debajo.
        const [ex, ey] = escalaDelCuerpo(llamadas);
        expect(ex * ey, `${estado} cambia de volumen al pintarse`).toBeCloseTo(1, 6);
      }
    }
  });

  it('y pivota en el suelo, para que las patas no se despeguen', () => {
    // Escalando desde el centro, el pájaro levita en bloque y se separa de su
    // propia sombra; pivotando en la línea de las patas se queda plantado.
    const { llamadas } = pintar();
    const i = pivoteDelCuerpo(llamadas);
    expect(llamadas[i]!.args).toEqual([60, SUELO]);
    // Y lo que va justo detrás es el salto, el giro y la escala, en ese orden:
    // escalar antes de desplazar multiplicaría la altura del salto por el
    // estiramiento y el salto mediría distinto según lo estirado que fuera.
    expect(llamadas.slice(i + 1, i + 5).map((l) => l.op)).toEqual([
      'translate',
      'rotate',
      'scale',
      'translate',
    ]);
  });
});

describe('la cabeza gira por el cuello, no por el centro del cráneo', () => {
  it('el pivote está en y=66, que es donde Milo tiene el cuello', () => {
    /*
      El aviso que traía el encargo. En SVG el problema era `transform-box`; en
      lienzo no existe ese concepto, pero el error es igual de fácil de cometer:
      el cráneo está centrado en (60,42) y girar ahí hace que la cabeza rote
      sobre sí misma como una pegatina. El cuello está en y=66.

      Se comprueba que hay un giro envuelto entre ir al cuello y volver, y que
      NO hay ninguno envuelto en el centro del cráneo.
    */
    const { llamadas } = pintar({ estado: 'pensando' });

    const giroSobre = (x: number, y: number) =>
      llamadas.some(
        (l, i) =>
          l.op === 'translate' &&
          l.args[0] === x &&
          l.args[1] === y &&
          llamadas[i + 1]?.op === 'rotate' &&
          llamadas[i + 2]?.op === 'translate' &&
          llamadas[i + 2]?.args[0] === -x &&
          llamadas[i + 2]?.args[1] === -y,
      );

    expect(giroSobre(60, 66), 'la cabeza no gira por el cuello').toBe(true);
    expect(giroSobre(60, 42), 'la cabeza gira por el centro del cráneo').toBe(false);
  });

  it('la mandíbula se encoge por la bisagra del pico, y=52', () => {
    // Errar ese punto hace que al hablar la boca se desplace por la cara en vez
    // de abrirse. Se ve casi bien, que es lo peor que le puede pasar a un fallo.
    const { llamadas } = pintar({ bocaAlto: 1.3, bocaAncho: 0.9 });
    const enBisagra = llamadas.some(
      (l, i) =>
        l.op === 'translate' &&
        l.args[0] === 60 &&
        l.args[1] === 52 &&
        llamadas[i + 1]?.op === 'scale' &&
        llamadas[i + 1]?.args[0] === 0.9 &&
        llamadas[i + 1]?.args[1] === 1.3,
    );
    expect(enBisagra).toBe(true);
  });

  it('las cejas giran cada una sobre sí misma, no sobre la nariz', () => {
    const { llamadas } = pintar({ pose: { ...poseDelMomento('triste', 0, 0) } });
    for (const cx of [50, 70]) {
      const propio = llamadas.some(
        (l, i) =>
          l.op === 'translate' &&
          l.args[0] === cx &&
          l.args[1] === 27.5 &&
          llamadas[i + 1]?.op === 'rotate',
      );
      expect(propio, `la ceja de ${cx} gira por donde no es`).toBe(true);
    }
  });
});

describe('la sombra de contacto', () => {
  it('es un degradado y no una mancha plana', () => {
    const { ops } = pintar();
    expect(ops('createRadialGradient').length).toBe(1);
  });

  it('se ensancha al aplastarse y se encoge y atenúa al subir', () => {
    const conSombra = (y: number, eY: number) => {
      const base = poseDelMomento('neutral', 0, 0);
      const { llamadas } = pintar({ pose: { ...base, y, eY, eX: conservarVolumen(eY) } });
      // La sombra es lo primero que se pinta: su escala y su opacidad son las
      // primeras de la lista.
      const escala = llamadas.find((l) => l.op === 'scale')!;
      return { ancho: escala.args[0]!, alfa: escala.globalAlpha };
    };

    const enElSuelo = conSombra(0, 0.7);
    const arriba = conSombra(-12, 1.32);

    expect(enElSuelo.ancho, 'la sombra no se ensancha al agacharse').toBeGreaterThan(arriba.ancho);
    expect(arriba.alfa, 'la sombra no se aclara al despegar').toBeLessThan(enElSuelo.alfa);
    expect(arriba.alfa).toBeGreaterThan(0);
  });

  it('el degradado se construye una sola vez por lienzo', () => {
    // Crearlo en cada fotograma es la orden más cara del dibujo: medido, el
    // Milo de 260 px bajaba de 45 a 29 fotogramas por segundo con el procesador
    // frenado seis veces.
    olvidarPaleta();
    const falso = lienzoFalso();
    for (let i = 0; i < 30; i++) dibujarMilo(falso.ctx, cuadro({ t: i * 16 }));
    expect(falso.ops('createRadialGradient').length).toBe(1);
  });
});

describe('el dibujo de andar por casa de los Milos pequeños', () => {
  it('a menos de 64 px se quita lo que mide menos de un píxel', () => {
    const grande = pintar({ simple: false });
    const pequeno = pintar({ simple: true });

    // Sin degradado: a 44 px ocupa cuatro píxeles y solo los vuelve grises.
    expect(grande.ops('createRadialGradient').length).toBe(1);
    expect(pequeno.ops('createRadialGradient').length).toBe(0);

    // Y sin el brillo del ojo, que es un círculo de radio 1,6: a 44 px mide
    // medio píxel.
    const brillos = (l: LienzoFalso) =>
      l.ops('arc').filter((a) => Math.abs(a.args[2]! - 1.6) < 0.01).length;
    expect(brillos(grande)).toBe(2);
    expect(brillos(pequeno)).toBe(0);

    // Pero la silueta sigue entera: las mismas alas y el mismo cuerpo.
    const alas = (l: LienzoFalso) => l.ops('stroke').filter((s) => s.lineWidth >= 15).length;
    expect(alas(pequeno)).toBe(alas(grande));
  });

  it('y aun así cuesta menos: menos órdenes de dibujo', () => {
    expect(pintar({ simple: true }).llamadas.length).toBeLessThan(
      pintar({ simple: false }).llamadas.length,
    );
  });
});

describe('la cara sigue siendo la de Milo', () => {
  it('pensando y durmiendo cierran los ojos, y no de la misma forma', () => {
    // Dormido los párpados caen relajados; pensando se arquean hacia arriba, y
    // ese detalle de dos píxeles es lo único que distingue los dos estados.
    const arco = (estado: EstadoMascota) => {
      const { llamadas } = pintar({ estado });
      return llamadas.find((l) => l.op === 'quadraticCurveTo' && l.lineWidth === 2.5)!.args[1]!;
    };
    expect(arco('pensando')).toBe(35);
    expect(arco('durmiendo')).toBe(45);
    // Y despierto no se dibujan párpados cerrados.
    const despierto = pintar({ estado: 'neutral' });
    expect(despierto.llamadas.some((l) => l.op === 'quadraticCurveTo' && l.lineWidth === 2.5)).toBe(
      false,
    );
  });

  it('los ojos se cierran al parpadear sin tocar el resto de la cara', () => {
    const abierto = pintar({ parpado: 1 });
    const cerrado = pintar({ parpado: 0.06 });
    const altoDelOjo = (l: LienzoFalso) => {
      const i = l.llamadas.findIndex(
        (x) => x.op === 'translate' && x.args[0] === 60 && x.args[1] === 40,
      );
      return l.llamadas[i + 1]!.args[1]!;
    };
    expect(altoDelOjo(abierto)).toBeGreaterThan(0.9);
    expect(altoDelOjo(cerrado)).toBeLessThan(0.1);
    // Las cejas van fuera de esa capa: una ceja dentro se aplastaría con el
    // párpado, y entonces parpadear cambiaría la expresión de la cara.
    const cejas = (l: LienzoFalso) => l.ops('quadraticCurveTo').filter((c) => c.lineWidth === 2.7);
    expect(cejas(abierto).map((c) => c.args)).toEqual(cejas(cerrado).map((c) => c.args));
  });

  it('las seis bocas se cruzan en opacidad en vez de sustituirse', () => {
    // Al hablar esto cambia ocho veces por segundo: un corte seco ahí se ve
    // como un parpadeo en mitad de la cara.
    const { llamadas } = pintar({ boca: 'abierta', bocaPrevia: 'cerrada', cruce: 0.4 });
    const alfas = new Set(
      llamadas.filter((l) => l.op === 'fill' && l.globalAlpha < 1).map((l) => l.globalAlpha),
    );
    expect(alfas.has(0.4), 'la boca nueva no entra atenuada').toBe(true);
    expect(
      [...alfas].some((a) => Math.abs(a - 0.6) < 1e-9),
      'la vieja no se apaga',
    ).toBe(true);
  });

  it('solo escuchando saca ondas y solo celebrando saca estrellas', () => {
    const anillos = (estado: EstadoMascota) =>
      pintar({ estado })
        .ops('arc')
        .filter((a) => a.args[2]! > 40).length;
    expect(anillos('escuchando')).toBe(2);
    expect(anillos('neutral')).toBe(0);

    const zetas = (estado: EstadoMascota) => pintar({ estado }).ops('fillText').length;
    expect(zetas('durmiendo')).toBe(2);
    expect(zetas('neutral')).toBe(0);
  });

  it('la ropa se pinta dentro de la capa de la cabeza, para que se ladee', () => {
    /*
      Colgada más arriba se quedaría clavada mientras la cabeza gira debajo, que
      es el efecto de pegatina de siempre. Se comprueba que la orden de la
      prenda cae entre el giro del cuello y el `restore` que lo deshace.
    */
    const { llamadas } = pintar({ atuendo: 'OUTFIT_GORRO' });
    const cuello = llamadas.findIndex(
      (l, i) =>
        l.op === 'translate' &&
        l.args[0] === 60 &&
        l.args[1] === 66 &&
        llamadas[i + 1]?.op === 'rotate',
    );
    expect(cuello).toBeGreaterThan(-1);
    // La visera del gorro es la única curva con el trazo por defecto tras el
    // cuello; basta con que haya más órdenes después del cuello con gorro.
    const conGorro = llamadas.length;
    const sinGorro = pintar().llamadas.length;
    expect(conGorro).toBeGreaterThan(sinGorro);

    /*
      Dónde acaba la capa de la cabeza. No vale el primer `restore` que
      aparezca: las cejas, los ojos y el pico abren y cierran los suyos dentro.
      Hay que contar la profundidad y quedarse con el que devuelve al nivel del
      cuello.
    */
    let hondo = 0;
    let cierre = -1;
    for (let i = cuello + 1; i < llamadas.length; i++) {
      if (llamadas[i]!.op === 'save') hondo++;
      else if (llamadas[i]!.op === 'restore') {
        if (hondo === 0) {
          cierre = i;
          break;
        }
        hondo--;
      }
    }
    expect(cierre, 'la capa de la cabeza no se cierra').toBeGreaterThan(cuello);
    const prenda = llamadas.findIndex((l, i) => i > cuello && l.op === 'arcTo');
    expect(prenda, 'el gorro no se dibuja').toBeGreaterThan(cuello);
    expect(prenda, 'el gorro se dibuja fuera de la cabeza').toBeLessThan(cierre);
  });
});
