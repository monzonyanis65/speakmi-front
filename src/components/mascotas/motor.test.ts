import { describe, expect, it } from 'vitest';
import {
  ALTURA_SALTO,
  mezclarPoses,
  poseQuieta,
  TRANSICION,
  APLASTAMIENTO,
  CICLO_SALTO,
  conservarVolumen,
  ESTIRAMIENTO,
  FASES,
  faseDelSalto,
  parpadeoEn,
  PARPADEO,
  poseDelMomento,
  respiracion,
  seguirMirada,
  type NombreFase,
} from './motor';
import { GESTOS, type EstadoMascota } from './coreografia';

/**
 * Las pruebas del motor nuevo.
 *
 * Existen porque el motor anterior NO SE PODÍA PROBAR. Movía las piezas con
 * resortes de la librería de animación, y un resorte solo avanza cuando el
 * navegador entrega fotogramas: en jsdom no hay fotogramas, así que lo único
 * que se podía leer era el primer instante, idéntico en los once estados. De
 * ahí que las pruebas de `Mascota.test.tsx` miren la partitura y no la
 * ejecución, y lo dicen ellas mismas en su cabecera.
 *
 * Este motor es una función del tiempo: se le pregunta por el milisegundo t y
 * contesta con un cuerpo entero, sin navegador y sin relojes. Así que aquí sí
 * se puede comprobar lo que antes había que ir a mirar a una pantalla.
 *
 * Y comprueban cosas que el motor viejo SUSPENDE. La primera de todas, la del
 * volumen: la partitura escribe `eX` y `eY` a mano y sus productos no dan uno
 * —el agachado de celebrar vale 0,972 y el salto 1,013—, así que ejecutada tal
 * cual, la prueba de abajo falla. Está comprobado poniéndole los valores en
 * crudo de `GESTOS`, y ese caso se deja escrito al final para que no haya que
 * fiarse de esta frase.
 */

const TODOS: EstadoMascota[] = [
  'neutral',
  'feliz',
  'celebrando',
  'pensando',
  'animando',
  'escuchando',
  'triste',
  'sorprendido',
  'orgulloso',
  'durmiendo',
  'hablando',
];

/** Un recorrido fino del ciclo del salto, para mirarlo entero. */
function ciclo(pasos = 2000): number[] {
  return Array.from({ length: pasos }, (_, i) => i / pasos);
}

describe('conservación de volumen: nunca un eje sin el otro', () => {
  it('el ancho es siempre el recíproco exacto del alto', () => {
    for (const alto of [0.7, 0.85, 1, 1.15, 1.32, 1.5]) {
      expect(conservarVolumen(alto) * alto).toBeCloseTo(1, 10);
    }
  });

  it('está acotado: un alto absurdo no dispara el ancho al infinito', () => {
    // La fórmula se va a las nubes cerca de cero, y un valor sin acotar que
    // viene de fuera es una pantalla en blanco esperando su turno.
    expect(conservarVolumen(0)).toBeLessThanOrEqual(4);
    expect(conservarVolumen(-3)).toBeLessThanOrEqual(4);
    expect(Number.isFinite(conservarVolumen(0))).toBe(true);
  });

  it('LOS ONCE ESTADOS conservan volumen en TODO el ciclo, no solo en las poses', () => {
    /*
      Esta es la prueba que el motor viejo no pasa, y es el motivo de que el
      ancho no se escriba en ninguna parte del motor nuevo: se deriva.

      Se recorren ocho segundos de cada estado a 60 fotogramas. Ocho segundos
      cubren de sobra el compás más lento (la cabeza de dormir, 1600 × 2 × 1,73
      = 5,5 s) y el ciclo del salto entero siete veces.
    */
    for (const estado of TODOS) {
      let peor = 0;
      for (let t = 0; t < 8000; t += 16) {
        const pose = poseDelMomento(estado, t, 0.37);
        peor = Math.max(peor, Math.abs(pose.eX * pose.eY - 1));
      }
      expect(peor, `${estado} cambia de volumen (error ${peor})`).toBeLessThan(0.001);
    }
  });

  it('y la partitura en crudo NO lo conserva: por eso hace falta derivarlo', () => {
    /*
      El contraejemplo, escrito para que la prueba de arriba signifique algo.

      Estos son los números tal cual los ejecutaba el motor de marioneta: se
      mandaba `eX` y `eY` a resortes independientes y lo que salía en pantalla
      era el producto de los dos. Aquí se ve que no da uno, y en los dos
      fotogramas donde más deforma, que es donde peor se lleva.
    */
    const agachado = GESTOS.celebrando.a;
    const saltando = GESTOS.celebrando.b;
    expect(agachado.eX * agachado.eY).toBeCloseTo(0.972, 3);
    expect(saltando.eX * saltando.eY).toBeCloseTo(1.013, 3);
    // O sea: un 2,8 % de volumen perdido al agacharse. El motor nuevo lo corrige
    // quedándose con el alto y recalculando el ancho.
    expect(conservarVolumen(agachado.eY) * agachado.eY).toBeCloseTo(1, 10);
  });
});

describe('el salto de alegría: cinco fases en un ciclo de 1,15 a 1,25 s', () => {
  it('el ciclo dura lo que tiene que durar', () => {
    expect(CICLO_SALTO).toBeGreaterThanOrEqual(1150);
    expect(CICLO_SALTO).toBeLessThanOrEqual(1250);
  });

  it('las cinco fases salen, cada una en su tramo y en su orden', () => {
    const esperado: [NombreFase, number, number][] = [
      ['anticipacion', 0.0, 0.16],
      ['impulso', 0.16, 0.38],
      ['cuspide', 0.38, 0.66],
      ['caida', 0.66, 0.82],
      ['aterrizaje', 0.82, 1.0],
    ];
    for (const [nombre, desde, hasta] of esperado) {
      expect(FASES[nombre]).toBeCloseTo(desde, 6);
      // A la mitad del tramo tiene que estar esa fase y no la vecina.
      expect(faseDelSalto((desde + hasta) / 2).fase).toBe(nombre);
      // Y justo al empezar también, que es donde se cuelan los errores de borde.
      expect(faseDelSalto(desde + 1e-6).fase).toBe(nombre);
    }
  });

  it('se agacha antes de saltar, y ahí está la anticipación entera', () => {
    // Sin agachado previo un salto se lee como un objeto empujado, no como
    // alguien que salta. Es el principio que más se nota de la animación
    // clásica y aquí es la fase 1.
    const cargado = faseDelSalto(0.15);
    expect(cargado.fase).toBe('anticipacion');
    expect(cargado.escalaY).toBeCloseTo(APLASTAMIENTO, 2);
    expect(cargado.escalaY).toBeLessThan(0.75);
    expect(cargado.altura, 'la anticipación ocurre EN EL SUELO').toBe(0);
    // Y al agacharse se ensancha, no se estrecha.
    expect(conservarVolumen(cargado.escalaY)).toBeGreaterThan(1.3);
  });

  it('el impulso estira y despega; la cúspide es el punto más alto', () => {
    const disparado = faseDelSalto(0.3);
    expect(disparado.fase).toBe('impulso');
    expect(disparado.escalaY).toBeGreaterThan(1.2);
    expect(disparado.altura).toBeLessThan(0);
    // Las patas se repliegan hacia el cuerpo, que es lo que lo separa de un
    // muñeco levantado con un hilo.
    expect(disparado.patas).toBeGreaterThan(0.5);

    // El punto más alto de todo el ciclo cae dentro de la cúspide.
    let masAlto = { p: 0, y: 0 };
    for (const p of ciclo()) {
      const s = faseDelSalto(p);
      if (s.altura < masAlto.y) masAlto = { p, y: s.altura };
    }
    expect(masAlto.y).toBeCloseTo(-ALTURA_SALTO, 1);
    expect(masAlto.p).toBeGreaterThanOrEqual(FASES.cuspide - 0.01);
    expect(masAlto.p).toBeLessThan(FASES.caida);
  });

  it('en la cúspide las alas se disparan y los ojos se entrecierran', () => {
    const arriba = faseDelSalto(0.5);
    expect(arriba.fase).toBe('cuspide');
    // El aleteo de la cúspide tiene que ser el más rápido de las cinco fases:
    // lo que vende el flote no es estar quieto, es que lo único que corra sean
    // las alas.
    for (const p of [0.08, 0.25, 0.74, 0.9]) {
      expect(arriba.aleteo, `la fase de ${p} aletea más que la cúspide`).toBeGreaterThan(
        faseDelSalto(p).aleteo,
      );
    }
    // Y es donde menos abre los ojos: es felicidad, no esfuerzo.
    const aperturas = ciclo(400).map((p) => faseDelSalto(p).ojo);
    expect(arriba.ojo).toBeCloseTo(Math.min(...aperturas), 5);
  });

  it('la caída acelera: es cuadrática, no un ascensor', () => {
    /*
      Con una caída lineal, la mitad del recorrido se hace en la mitad del
      tiempo. La gravedad no hace eso: al principio baja poco y al final mucho.
      Se comprueba mirando dónde está a mitad de fase.
    */
    const inicio = faseDelSalto(FASES.caida + 1e-6).altura;
    const medio = faseDelSalto((FASES.caida + FASES.aterrizaje) / 2).altura;
    const recorrido = 0 - inicio;
    const hechoALaMitad = (medio - inicio) / recorrido;
    // Lineal daría 0,5. Cuadrática da 0,25.
    expect(hechoALaMitad).toBeLessThan(0.35);
    expect(hechoALaMitad).toBeCloseTo(0.25, 1);
  });

  it('el aterrizaje APLASTA primero y luego rebota, cada vez menos', () => {
    const tramo = [];
    for (let i = 0; i <= 60; i++) {
      const s = FASES.aterrizaje + (i / 60) * (1 - FASES.aterrizaje);
      tramo.push(faseDelSalto(s).escalaY);
    }
    const minimo = Math.min(...tramo);
    const dondeMinimo = tramo.indexOf(minimo);
    // Aplasta de verdad, no un pellizco.
    expect(minimo).toBeLessThan(0.93);
    // Y lo hace PRONTO: el golpe es lo primero que pasa al tocar el suelo. Si
    // el mínimo cayera al final, el muelle estaría estirando antes de aplastar,
    // que es un rebote al revés.
    expect(dondeMinimo).toBeLessThan(20);

    // Los rebotes se apagan: el segundo pico es más pequeño que el primero.
    const picos = [];
    for (let i = 1; i < tramo.length - 1; i++) {
      if (tramo[i]! > tramo[i - 1]! && tramo[i]! > tramo[i + 1]!) picos.push(tramo[i]!);
    }
    for (let i = 1; i < picos.length; i++) {
      expect(picos[i]! - 1).toBeLessThan(Math.abs(picos[i - 1]! - 1));
    }
  });

  it('el ciclo cierra sin costura: no hay tirón al volver a empezar', () => {
    /*
      La costura de un bucle es el fallo que nadie sabe describir: se ve un
      tirón cada vez y punto. Con el 2,5 del encargo, `sin(2,5π)` vale 1 justo
      al acabar el aterrizaje, así que el muelle todavía está aplastando cuando
      el ciclo vuelve a cero. Por eso la anticipación arranca del valor con el
      que acaba el aterrizaje y no de un 1 redondo.
    */
    const fin = faseDelSalto(0.999999);
    const principio = faseDelSalto(0);
    expect(principio.escalaY).toBeCloseTo(fin.escalaY, 4);
    expect(principio.altura).toBeCloseTo(fin.altura, 6);
  });

  it('ninguna frontera entre fases da un salto brusco', () => {
    // Recorrido fino de todo el ciclo: entre dos instantes seguidos, ni el alto
    // ni la altura pueden pegar un brinco. Un salto aquí se ve como un
    // fotograma perdido.
    let peorEscala = 0;
    let peorAltura = 0;
    const paso = 1 / 4000;
    for (let p = 0; p < 1; p += paso) {
      const a = faseDelSalto(p);
      const b = faseDelSalto(p + paso);
      peorEscala = Math.max(peorEscala, Math.abs(b.escalaY - a.escalaY));
      peorAltura = Math.max(peorAltura, Math.abs(b.altura - a.altura));
    }
    expect(peorEscala, 'un escalón en el alto del cuerpo').toBeLessThan(0.01);
    expect(peorAltura, 'un escalón en la altura').toBeLessThan(0.1);
  });

  it('el estiramiento no se sale del lienzo', () => {
    /*
      El lienzo de mapa de bits NO tiene `overflow-visible`: lo que se pinte
      fuera se pierde sin avisar. El cuerpo escala pivotando en el suelo
      (y=108), así que la coronilla, que en reposo está en y=16, sube sola al
      estirarse. Sumado a la altura del salto tiene que caber en el margen que
      `MiloLienzo` reserva arriba, que es el 22 % de 120 = 26,4 unidades.
    */
    let masArriba = 120;
    for (const p of ciclo()) {
      const s = faseDelSalto(p);
      masArriba = Math.min(masArriba, 108 - (108 - 16) * s.escalaY + s.altura);
    }
    expect(masArriba, 'la coronilla se sale por arriba').toBeGreaterThan(-26.4);
    // Y tampoco tan poco como para que el salto no se note.
    expect(masArriba).toBeLessThan(-15);
  });

  it('estirarse y aplastarse son de verdad, no un adorno', () => {
    const altos = ciclo().map((p) => faseDelSalto(p).escalaY);
    expect(Math.min(...altos)).toBeLessThanOrEqual(APLASTAMIENTO + 0.001);
    expect(Math.max(...altos)).toBeCloseTo(ESTIRAMIENTO, 2);
  });
});

describe('el cuerpo no se para nunca', () => {
  it('en reposo, Milo está quieto menos del 1 % del tiempo', () => {
    /*
      Esta es la medición que la partitura dejó escrita del motor viejo: «en
      reposo estaba quieto el 66 % del tiempo y la cabeza el 91 %». Pasaba
      porque las poses eran DESTINOS: el resorte llegaba y se quedaba esperando
      la siguiente orden de un temporizador.

      Aquí la postura es una función del tiempo y no hay destinos, así que no
      puede haber un tramo plano. Se mide igual: cuántos fotogramas de treinta
      segundos no cambian nada respecto al anterior.
    */
    let parados = 0;
    let total = 0;
    let anterior = poseDelMomento('neutral', 0, 0.42);
    for (let t = 16; t < 30000; t += 16) {
      const ahora = poseDelMomento('neutral', t, 0.42);
      const cambio =
        Math.abs(ahora.eY - anterior.eY) * 100 +
        Math.abs(ahora.alaCercana - anterior.alaCercana) +
        Math.abs(ahora.cabeza - anterior.cabeza) +
        Math.abs(ahora.cola - anterior.cola);
      if (cambio < 0.01) parados++;
      total++;
      anterior = ahora;
    }
    expect(parados / total).toBeLessThan(0.01);
  });

  it('la cabeza tampoco: era la peor parada de todas', () => {
    let parados = 0;
    let total = 0;
    let anterior = poseDelMomento('neutral', 0, 0.42).cabeza;
    for (let t = 16; t < 30000; t += 16) {
      const ahora = poseDelMomento('neutral', t, 0.42).cabeza;
      if (Math.abs(ahora - anterior) < 0.001) parados++;
      total++;
      anterior = ahora;
    }
    expect(parados / total, 'la cabeza se vuelve a quedar clavada').toBeLessThan(0.01);
  });

  it('cada parte va por su compás: no llegan todas a la vez', () => {
    /*
      Si todo llegara a la vez se leería un recorte articulado en vez de un
      cuerpo. Se comprueba mirando CUÁNDO da la vuelta cada grupo: los instantes
      en que el cuerpo está en su extremo no pueden ser los mismos en que lo
      está la cola.
      */
    const extremos = (leer: (t: number) => number) => {
      const donde: number[] = [];
      for (let t = 32; t < 12000; t += 16) {
        const a = leer(t - 32);
        const b = leer(t - 16);
        const c = leer(t);
        if ((b > a && b >= c) || (b < a && b <= c)) donde.push(t - 16);
      }
      return donde;
    };
    const cuerpo = extremos((t) => poseDelMomento('neutral', t, 0).eY);
    const cola = extremos((t) => poseDelMomento('neutral', t, 0).cola);
    const cabeza = extremos((t) => poseDelMomento('neutral', t, 0).cabeza);

    expect(cuerpo.length).toBeGreaterThan(4);
    // Ninguna coincidencia: si dos grupos dieran la vuelta en el mismo
    // fotograma repetidamente es que comparten reloj.
    const juntos = cola.filter((t) => cuerpo.includes(t)).length;
    expect(juntos / cola.length, 'la cola va al compás del cuerpo').toBeLessThan(0.34);
    expect(cabeza.length, 'la cabeza va más pausada que el cuerpo').toBeLessThan(cuerpo.length);
  });

  it('dos Milos de la misma pantalla no respiran sincronizados', () => {
    // Dos criaturas idénticas al milisegundo se leen como dos copias del mismo
    // GIF. Pasa de verdad: la tienda pinta un Milo por atuendo.
    let iguales = 0;
    for (let t = 0; t < 4000; t += 16) {
      const uno = poseDelMomento('neutral', t, 0.11).eY;
      const otro = poseDelMomento('neutral', t, 0.73).eY;
      if (Math.abs(uno - otro) < 0.0005) iguales++;
    }
    expect(iguales / 250).toBeLessThan(0.1);
  });
});

describe('cambiar de estado se sale de uno hacia el otro, no salta', () => {
  /*
    Lo único que el motor de resortes hacía y este no hacía de serie. Allí cada
    parte colgaba de un muelle, así que al cambiar de estado salía hacia la
    postura nueva y se pasaba un poco antes de asentarse. Una función del tiempo
    contesta la postura nueva desde el primer fotograma, o sea que sin esto Milo
    pasa de tranquilo a celebrando EN UN FOTOGRAMA: un corte, no una reacción.
  */
  const tranquilo = () => poseDelMomento('neutral', 1000, 0.2);
  const fiesta = () => poseDelMomento('celebrando', 1000, 0.2);

  it('empieza donde estaba y acaba donde va', () => {
    expect(mezclarPoses(tranquilo(), fiesta(), 0).cabeza).toBeCloseTo(tranquilo().cabeza, 6);
    expect(mezclarPoses(tranquilo(), fiesta(), 1).cabeza).toBeCloseTo(fiesta().cabeza, 6);
    // Y fuera del tramo no se dispara: el avance se recorta.
    expect(mezclarPoses(tranquilo(), fiesta(), 3).cola).toBeCloseTo(fiesta().cola, 6);
  });

  it('se pasa de largo y vuelve, que es lo que hacía el muelle', () => {
    // Sin sobreimpulso la transición queda correcta y muerta. El rebote es lo
    // que se lee como una reacción en vez de como un desplazamiento.
    const a = { ...tranquilo(), cabeza: 0 };
    const b = { ...fiesta(), cabeza: 10 };
    let masLejos = 0;
    for (let i = 0; i <= 100; i++)
      masLejos = Math.max(masLejos, mezclarPoses(a, b, i / 100).cabeza);
    expect(masLejos, 'llega y se para en seco').toBeGreaterThan(10);
    expect(masLejos, 'rebota como un resorte suelto').toBeLessThan(11.5);
  });

  it('conserva el volumen también a media transición', () => {
    // Interpolando los dos anchos, el punto medio dejaría de conservarlo: el
    // ancho se deriva del alto también aquí.
    for (let i = 0; i <= 40; i++) {
      const p = mezclarPoses(tranquilo(), fiesta(), i / 40);
      expect(p.eX * p.eY).toBeCloseTo(1, 10);
    }
  });

  it('dura menos que el gesto más corto que tiene que dejar ver', () => {
    // El respingo de la sorpresa cambia de pose cada 760 ms: una transición más
    // larga se comería el principio del propio gesto.
    expect(TRANSICION).toBeLessThan(GESTOS.sorprendido.ritmo / 2);
    expect(TRANSICION).toBeGreaterThan(150);
  });
});

describe('con movimiento reducido, Milo se queda de pie y con cara', () => {
  it('es siempre la MISMA postura, no dependa de qué Milo sea', () => {
    /*
      El fallo que esta prueba impide: con el reloj parado en cero,
      `poseDelMomento` seguía leyendo el desfase propio de cada Milo, así que
      cada uno se congelaba en un punto distinto de su ciclo. Celebrando, unos
      quedaban aplastados contra el suelo y otros colgados del aire a media
      altura. Se vio en las capturas, no en ninguna prueba.
    */
    for (const estado of TODOS) {
      const uno = poseQuieta(estado);
      const otro = poseQuieta(estado);
      expect(uno).toEqual(otro);
      // Y distinta de lo que salía antes con el reloj a cero y un desfase.
      expect(poseDelMomento(estado, 0, 0.6).eY).not.toBe(uno.eY);
    }
  });

  it('nadie se queda en el aire ni a medio saltar', () => {
    for (const estado of TODOS) {
      const p = poseQuieta(estado);
      // Un personaje quieto a media altura no dice nada y encima no se explica.
      // El único despegue que queda es el que la partitura declara.
      expect(Math.abs(p.y), `${estado} se queda flotando`).toBeLessThanOrEqual(8);
      expect(p.patas, 'con las patas recogidas y sin saltar').toBe(0);
      expect(p.fase).toBeNull();
    }
  });

  it('es la pose B, la soltada, y no la cargada', () => {
    // La A es el agachado de antes de saltar: dejarlo ahí es dejar media
    // anticipación sin su descarga, que no se entiende. La B es la que cuenta
    // el estado: el que celebra en el aire y el triste hundido.
    for (const estado of TODOS) {
      expect(poseQuieta(estado).cabeza).toBe(GESTOS[estado].b.cabeza);
      expect(poseQuieta(estado).ojo).toBe(GESTOS[estado].b.ojo);
    }
    expect(poseQuieta('celebrando').y).toBeLessThan(0);
    expect(poseQuieta('triste').eY).toBeLessThan(1);
  });

  it('y aun quieto conserva el volumen', () => {
    for (const estado of TODOS) {
      const p = poseQuieta(estado);
      expect(p.eX * p.eY, `${estado} se hincha al pararse`).toBeCloseTo(1, 10);
    }
  });

  it('las once posturas quietas se distinguen entre sí', () => {
    // Si dos estados dieran la misma postura parada, con movimiento reducido la
    // mascota dejaría de decir qué está pasando, que es para lo que está.
    const vistas = TODOS.map((e) => JSON.stringify(poseQuieta(e)));
    expect(new Set(vistas).size).toBe(TODOS.length);
  });
});

describe('la respiración no es un seno plano', () => {
  it('va de 0 a 1 y vuelve, sin salirse', () => {
    for (let i = 0; i <= 200; i++) {
      const v = respiracion(i / 100);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(respiracion(0)).toBeCloseTo(0, 6);
    expect(respiracion(1)).toBeCloseTo(0, 6);
  });

  it('coge aire más rápido de lo que lo suelta', () => {
    // Un seno sube y baja en el mismo tiempo; un pecho no. La asimetría es lo
    // que separa un pecho de un pistón.
    let cima = 0;
    let mayor = -1;
    for (let i = 0; i <= 1000; i++) {
      const v = respiracion(i / 1000);
      if (v > mayor) {
        mayor = v;
        cima = i / 1000;
      }
    }
    expect(mayor).toBeCloseTo(1, 3);
    expect(cima, 'sube y baja en el mismo tiempo: es un seno').toBeLessThan(0.45);
  });
});

describe('el parpadeo lleva su propio reloj', () => {
  it('parpadea cerca de una vez cada 2,5 s', () => {
    let cierres = 0;
    let cerrado = false;
    const SEGUNDOS = 60;
    for (let t = 0; t < SEGUNDOS * 1000; t += 8) {
      const abierto = parpadeoEn(t, 0.2);
      if (abierto < 0.4 && !cerrado) {
        cierres++;
        cerrado = true;
      }
      if (abierto > 0.9) cerrado = false;
    }
    const cada = (SEGUNDOS * 1000) / cierres;
    // Con uno de cada cuatro doble, la media baja algo de los 2500 declarados.
    expect(cada).toBeGreaterThan(1600);
    expect(cada).toBeLessThan(PARPADEO + 300);
  });

  it('cierra del todo y vuelve a abrir del todo', () => {
    const valores = [];
    for (let t = 0; t < 12000; t += 4) valores.push(parpadeoEn(t, 0));
    expect(Math.min(...valores)).toBeLessThan(0.15);
    expect(Math.max(...valores)).toBeCloseTo(1, 5);
  });

  it('a veces son dos seguidos, que es lo que hace la gente', () => {
    // Un parpadeo perfectamente regular delata que hay un temporizador detrás.
    const huecos: number[] = [];
    let ultimo = -1;
    for (let t = 0; t < 120000; t += 4) {
      if (parpadeoEn(t, 0) < 0.4) {
        if (ultimo >= 0 && t - ultimo > 20) huecos.push(t - ultimo);
        ultimo = t;
      }
    }
    // Tiene que haber huecos cortos (el segundo de un doble) y largos.
    expect(
      huecos.some((h) => h < 400),
      'nunca parpadea dos veces seguidas',
    ).toBe(true);
    expect(huecos.some((h) => h > 1500)).toBe(true);
  });

  it('contesta lo mismo si se le pregunta lo mismo', () => {
    // Un motor que depende del azar en el momento de dibujar no se puede
    // comprobar y, peor, salta si se le pide el mismo instante dos veces.
    for (const t of [0, 137, 2499, 7300, 61234]) {
      expect(parpadeoEn(t, 0.3)).toBe(parpadeoEn(t, 0.3));
    }
  });

  it('no va al compás de la respiración', () => {
    // Enganchado al ciclo del cuerpo, el parpadeo caería siempre en el mismo
    // punto de la respiración, y eso se detecta a la tercera vuelta.
    const ritmo = GESTOS.neutral.ritmo * 2;
    const fases: number[] = [];
    for (let t = 0; t < 120000; t += 8) {
      if (parpadeoEn(t, 0) < 0.3) fases.push((t % ritmo) / ritmo);
    }
    expect(fases.length).toBeGreaterThan(20);
    // Si estuviera enganchado, todas las fases caerían en la misma zona.
    expect(Math.max(...fases) - Math.min(...fases)).toBeGreaterThan(0.6);
  });
});

describe('la mirada sigue al cursor sin pasarse', () => {
  it('llega al objetivo y se queda, sin rebotar', () => {
    let v = 0;
    const historia: number[] = [];
    for (let i = 0; i < 200; i++) {
      v = seguirMirada(v, 3.4, 16);
      historia.push(v);
    }
    expect(v).toBeCloseTo(3.4, 2);
    // Ni un solo fotograma por encima del objetivo: una pupila que se pasa del
    // cursor y vuelve no parece que te mire, parece que busca.
    expect(Math.max(...historia)).toBeLessThanOrEqual(3.4 + 1e-9);
  });

  it('tarda lo mismo a 60 que a 120 fotogramas por segundo', () => {
    /*
      Con un coeficiente fijo por fotograma, una pantalla de 120 Hz seguiría el
      cursor al doble de rápido que una de 60, y la mascota se movería distinto
      según el monitor. Se corrige por el tiempo transcurrido, no por fotograma.
    */
    let a = 0;
    for (let i = 0; i < 30; i++) a = seguirMirada(a, 1, 16.67);
    let b = 0;
    for (let i = 0; i < 60; i++) b = seguirMirada(b, 1, 8.33);
    expect(a).toBeCloseTo(b, 3);
  });
});

describe('la postura completa sigue respetando la partitura', () => {
  it('cada estado se queda dentro de lo que dicen sus dos poses', () => {
    // El motor nuevo INTERPOLA entre las poses de `GESTOS`; no se inventa
    // posturas. Lo único que puede salirse es el cuerpo de celebrar, que lo
    // manda el salto.
    for (const estado of TODOS) {
      if (estado === 'celebrando') continue;
      const { a, b } = GESTOS[estado];
      for (let t = 0; t < 6000; t += 37) {
        const pose = poseDelMomento(estado, t, 0.2);
        const min = Math.min(a.cabeza, b.cabeza) - 1e-6;
        const max = Math.max(a.cabeza, b.cabeza) + 1e-6;
        expect(pose.cabeza, `${estado} se sale de su pose`).toBeGreaterThanOrEqual(min);
        expect(pose.cabeza).toBeLessThanOrEqual(max);
      }
    }
  });

  it('solo celebrando salta: estar contento no es botar sin parar', () => {
    for (const estado of TODOS) {
      let despega = false;
      for (let t = 0; t < 4000; t += 23) {
        if (poseDelMomento(estado, t, 0).y < -6) despega = true;
      }
      expect(despega, `${estado} ${despega ? 'salta y no debería' : 'no salta'}`).toBe(
        estado === 'celebrando',
      );
    }
  });

  it('un gesto suelto manda sobre el vaivén mientras dura', () => {
    // Si el vaivén siguiera corriendo por debajo, le pisaría las poses a media
    // sacudida y el tic se quedaría en un temblor.
    const con = poseDelMomento('neutral', 1234, 0.5, { alaCercana: 88, ojo: 0.45 });
    expect(con.alaCercana).toBe(88);
    expect(con.ojo).toBe(0.45);
    // Y lo que el tic no toca sigue respirando.
    const sin = poseDelMomento('neutral', 1234, 0.5);
    expect(con.cola).toBe(sin.cola);
  });
});
