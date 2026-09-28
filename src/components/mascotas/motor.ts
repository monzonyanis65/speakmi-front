/**
 * El motor de Milo: de qué instante estamos a qué postura tiene el cuerpo.
 *
 * Aquí no se dibuja nada y no se toca el DOM. Es aposta: todo lo que decide
 * cómo se mueve la mascota tiene que poder comprobarse sin navegador, y lo
 * anterior no podía. El esqueleto de resortes vivía dentro del componente, así
 * que las pruebas solo podían mirar la partitura (`coreografia.ts`) y confiar
 * en que la ejecución fuera fiel; de hecho no lo era, y abajo está medido.
 *
 *
 * QUÉ CAMBIA RESPECTO AL MOTOR DE MARIONETA
 *
 * El anterior movía las piezas con temporizadores: cada grupo tenía un
 * `setTimeout` que cada cierto rato le decía al resorte «vete a la pose A» o
 * «vete a la B». Funcionaba, pero tenía dos fallos de raíz.
 *
 *   - Las poses eran DESTINOS, no un recorrido. El resorte llegaba y se
 *     quedaba esperando la siguiente orden. De ahí el 66 % de tiempo inmóvil
 *     que está medido en `coreografia.ts`, y de ahí que la única salida fuera
 *     ablandar los resortes hasta que no llegaran nunca. Es un apaño que
 *     funciona, pero lo que se está comprando es que el personaje vaya SIEMPRE
 *     con retraso, y eso es justo lo que se lee como lento.
 *   - El volumen no se conservaba. La partitura escribe `eX` y `eY` a mano, y
 *     medidos sus productos no dan uno: el agachado de celebrar vale
 *     1,08 × 0,90 = 0,972 y el salto 0,965 × 1,05 = 1,013. Es poco, pero es
 *     poco EN EL SITIO EQUIVOCADO: son los dos fotogramas donde más deforma, y
 *     ahí un 3 % de volumen perdido se lee como que el bicho se desinfla.
 *
 * Aquí la postura es una FUNCIÓN DEL TIEMPO. No hay destinos ni temporizadores:
 * se pregunta «qué postura toca en el milisegundo t» y sale un cuerpo entero.
 * Nunca está parado porque no hay ningún instante en que la función sea plana,
 * y el volumen se conserva porque `eX` no se escribe: se deriva de `eY`.
 *
 *
 * QUÉ SE CONSERVA DE LA COREOGRAFÍA
 *
 * Todo. `GESTOS` sigue siendo la partitura y de ahí salen las once posturas,
 * las cejas, las bocas, los ritmos y los compases desfasados. Lo que se
 * sustituye es la orquesta, no la música. Los resortes de `RESORTE` ya no se
 * usan para mover el cuerpo —no hay nada que perseguir— pero se siguen usando
 * para lo que sí persigue un objetivo: la mirada y el parpadeo.
 */

import { COMPAS, GESTOS, TICS, type EstadoMascota, type Pose } from './coreografia';

/**
 * El ciclo entero del salto de alegría.
 *
 * 1180 ms está elegido dentro de la horquilla de 1,15 a 1,25 s y no en el
 * centro: por debajo de 1,15 el aterrizaje no tiene tiempo de rebotar y se lee
 * como un bote de pelota, y por encima de 1,25 la cúspide se alarga tanto que
 * parece que flota, no que salta.
 */
export const CICLO_SALTO = 1180;

/** Cuánto se agacha al cargar: pierde el 30 % de alto. */
export const APLASTAMIENTO = 0.7;

/**
 * Cuánto se estira al despegar.
 *
 * El encargo pedía +35 % y esto es +32 %, y la diferencia tiene motivo. El
 * cuerpo escala pivotando en la línea del suelo (y=108), así que estirarlo
 * levanta la coronilla sola: desde y=16, un 1,35 la sube a 108 − 92·1,35 =
 * −16,2, o sea dieciséis unidades POR ENCIMA del lienzo, antes de sumarle la
 * altura del salto. El lienzo lleva margen de sobra para eso, pero el margen lo
 * paga la pantalla: Milo se pinta a 130 px en la entrada y en el fin de juego
 * con texto justo encima, y a 1,35 lo invadía. A 1,32 con `ALTURA_SALTO` de 12
 * la coronilla llega a −25,4 y cabe en el margen sin pisar nada.
 */
export const ESTIRAMIENTO = 1.32;

/** Cuánto despega del suelo en la cúspide, en unidades del lienzo de 120. */
export const ALTURA_SALTO = 12;

/** Cada cuánto parpadea, con su propio reloj y sin mirar a nada más. */
export const PARPADEO = 2500;

/** Las cinco fases del salto, en el orden en que pasan. */
export type NombreFase = 'anticipacion' | 'impulso' | 'cuspide' | 'caida' | 'aterrizaje';

/**
 * Dónde empieza cada fase dentro del ciclo normalizado.
 *
 * Se exporta para que las pruebas comprueben los tramos sin copiarlos: una
 * constante copiada en la prueba deja de comprobar el código y pasa a
 * comprobarse a sí misma.
 */
export const FASES: Record<NombreFase, number> = {
  anticipacion: 0,
  impulso: 0.16,
  cuspide: 0.38,
  caida: 0.66,
  aterrizaje: 0.82,
};

/** Lo que el salto le impone al cuerpo en un instante dado. */
export interface Salto {
  fase: NombreFase;
  /** Cuánto despega del suelo. Negativo es hacia arriba. */
  altura: number;
  /** El alto del cuerpo. El ancho no se dice aquí: se deriva conservando volumen. */
  escalaY: number;
  /** Multiplicador de la frecuencia del aleteo. En la cúspide es donde más corre. */
  aleteo: number;
  /** Cuánto repliega las patas hacia el cuerpo, de 0 a 1. */
  patas: number;
  /** Cuánto abre los ojos. En la cúspide los entrecierra de felicidad. */
  ojo: number;
}

/**
 * El muelle del aterrizaje, tal cual lo pidió el encargo.
 *
 * `sin(s·π·2,5)·exp(−s·3,2)`: dos rebotes y medio que se apagan. Va con signo
 * negativo al aplicarse porque el primer medio ciclo del seno es positivo y lo
 * que tiene que pasar al tocar el suelo es APLASTARSE, no estirarse.
 */
function muelleDeAterrizaje(s: number): number {
  return Math.sin(s * Math.PI * 2.5) * Math.exp(-s * 3.2);
}

/** Cuánto se estira el cuerpo durante la caída, antes de tocar el suelo. */
const ESTIRADO_AL_CAER = 1.2;

/** Cuánto aplasta el primer rebote del aterrizaje. */
const FUERZA_DEL_MUELLE = 0.34;

/**
 * Dónde deja el alto del cuerpo el final del aterrizaje.
 *
 * No es 1 exacto, y por eso se calcula en vez de darse por supuesto: con el
 * 2,5 del encargo, `sin(2,5π)` vale 1 justo al acabar, así que el muelle
 * todavía está aplastando un 1,4 % cuando el ciclo vuelve a empezar. Metiendo
 * un 1 redondo en la anticipación habría un salto de 1,2 px a 130 px cada
 * 1,18 s, que es exactamente el tipo de costura que se ve como un tirón sin
 * que nadie sepa decir de dónde sale. Arrancando la anticipación de AQUÍ, el
 * ciclo cierra sin costura y la fórmula del encargo se respeta tal cual.
 */
const FIN_DEL_ATERRIZAJE =
  1 + (ESTIRADO_AL_CAER - 1) * Math.exp(-5) - muelleDeAterrizaje(1) * FUERZA_DEL_MUELLE;

/**
 * La máquina de cinco fases del salto de alegría.
 *
 * `p` es el ciclo normalizado: la parte decimal de `t / CICLO_SALTO`. Se pasa
 * ya normalizado y no en milisegundos para que las pruebas puedan recorrer el
 * ciclo entero sin inventarse un reloj.
 *
 * Cada fase entrega la postura ACABADA de ese tramo, no un incremento, y las
 * fronteras están cosidas a mano: el valor con el que acaba una es el valor con
 * el que arranca la siguiente. Escrito como incrementos, cualquier error de
 * redondeo se acumula vuelta tras vuelta y a los dos minutos Milo está medio
 * metro por debajo del suelo.
 */
export function faseDelSalto(p: number): Salto {
  const q = p - Math.floor(p);

  // FASE 1 — anticipación. Se agacha deprisa y aguanta abajo: la energía que
  // el ojo va a ver salir en el impulso hay que verla entrar primero.
  if (q < FASES.impulso) {
    const s = (q - FASES.anticipacion) / (FASES.impulso - FASES.anticipacion);
    // Cúbica invertida: casi todo el agachado ocurre en el primer tercio y el
    // resto es sostenerlo. Un agachado a velocidad constante se lee como que
    // le están empujando la cabeza, no como que está cogiendo impulso.
    const caer = 1 - (1 - s) ** 3;
    return {
      fase: 'anticipacion',
      altura: 0,
      escalaY: FIN_DEL_ATERRIZAJE + (APLASTAMIENTO - FIN_DEL_ATERRIZAJE) * caer,
      aleteo: 0.3,
      patas: 0,
      ojo: 0.92 - 0.2 * caer,
    };
  }

  // FASE 2 — impulso de cohete. Sale disparado y va frenando, que es lo que la
  // gravedad le hace a cualquier cosa lanzada hacia arriba.
  if (q < FASES.cuspide) {
    const s = (q - FASES.impulso) / (FASES.cuspide - FASES.impulso);
    const subir = Math.sin(s * Math.PI * 0.5);
    return {
      fase: 'impulso',
      altura: -ALTURA_SALTO * subir,
      // El estiramiento va MÁS RÁPIDO que la subida y acaba antes: un cuerpo
      // que se estira mientras ya está frenando parece un chicle. Se estira al
      // despegar, no durante todo el viaje.
      escalaY: APLASTAMIENTO + (ESTIRAMIENTO - APLASTAMIENTO) * Math.min(1, s * 1.6),
      aleteo: 1.6,
      patas: subir,
      ojo: 0.75,
    };
  }

  // FASE 3 — cúspide. Flota arriba con el aleteo disparado y los ojos
  // entrecerrados. Lo que vende el hangtime no es estar quieto: es que lo único
  // que corre sean las alas.
  if (q < FASES.caida) {
    const s = (q - FASES.cuspide) / (FASES.caida - FASES.cuspide);
    return {
      fase: 'cuspide',
      // Un respiro de medio punto porcentual: absolutamente plano se lee como
      // un fotograma congelado, que es el error contrario y peor.
      altura: -ALTURA_SALTO * (1 - 0.05 * respiracion(s)),
      escalaY: ESTIRAMIENTO + (1.04 - ESTIRAMIENTO) * s,
      aleteo: 3.2,
      patas: 1 - 0.3 * s,
      ojo: 0.6,
    };
  }

  // FASE 4 — caída libre. Cuadrática porque la gravedad acelera; lineal se lee
  // como un ascensor bajando.
  if (q < FASES.aterrizaje) {
    const s = (q - FASES.caida) / (FASES.aterrizaje - FASES.caida);
    return {
      fase: 'caida',
      altura: -ALTURA_SALTO * (1 - s * s),
      escalaY: 1.04 + (ESTIRADO_AL_CAER - 1.04) * s,
      aleteo: 1.1,
      patas: 0.7 * (1 - s),
      ojo: 0.75 + 0.25 * s,
    };
  }

  // FASE 5 — aterrizaje con resorte amortiguado.
  const s = (q - FASES.aterrizaje) / (1 - FASES.aterrizaje);
  // El estirado de la caída se deshincha aparte del rebote: si el muelle
  // tuviera que deshacerlo él, el primer aplastamiento saldría del doble de
  // hondo y el pájaro se hundiría en el suelo.
  const base = 1 + (ESTIRADO_AL_CAER - 1) * Math.exp(-s * 5);
  return {
    fase: 'aterrizaje',
    altura: 0,
    escalaY: base - muelleDeAterrizaje(s) * FUERZA_DEL_MUELLE,
    aleteo: 0.8,
    patas: 0,
    ojo: 1 - 0.1 * (1 - s),
  };
}

/**
 * El ancho que le toca a un alto para que el volumen no cambie.
 *
 * Es la regla dura de todo el archivo y por eso `eX` no se escribe en ningún
 * sitio: se deriva. Mientras nadie pueda escribir un ancho a mano, no puede
 * haber un fotograma donde Milo se hinche.
 *
 * El tope existe porque la fórmula se dispara cerca de cero y un alto de 0,05
 * daría veinte veces de ancho. No pasa con estos números, pero un valor que
 * viene de fuera y no está acotado es una pantalla en blanco esperando su
 * turno.
 */
export function conservarVolumen(escalaY: number): number {
  return 1 / Math.max(0.25, Math.min(4, escalaY));
}

/**
 * Un ciclo de respirar, de 0 a 1 y vuelta, con la fase normalizada.
 *
 * No es un seno y la diferencia importa: un seno sube y baja en el mismo
 * tiempo, y respirar no. Se coge aire en menos de la mitad de lo que se suelta,
 * y esa asimetría es la que hace que un pecho parezca un pecho y no un pistón.
 * El suavizado de Hermite pone el resto, que es llegar a los extremos sin
 * esquina.
 */
export function respiracion(fase: number): number {
  const p = fase - Math.floor(fase);
  const SUBIDA = 0.4;
  const x = p < SUBIDA ? p / SUBIDA : 1 - (p - SUBIDA) / (1 - SUBIDA);
  return x * x * (3 - 2 * x);
}

/** Interpolación lineal de toda la vida. */
export function entre(desde: number, hasta: number, t: number): number {
  return desde + (hasta - desde) * t;
}

/**
 * La postura completa de Milo en un instante.
 *
 * Es lo mismo que la `Pose` de la partitura más lo que la partitura no sabía
 * decir, que es lo que el salto necesita: qué fase es y cuánto se repliegan las
 * patas.
 */
export interface PoseViva extends Pose {
  /** Siempre el recíproco de `eY`. No se escribe a mano en ninguna parte. */
  eX: number;
  fueraCercana: number;
  fueraLejana: number;
  /** Cuánto se recogen las patas hacia el cuerpo, de 0 a 1. */
  patas: number;
  /** En qué fase del salto va, o `null` si este estado no salta. */
  fase: NombreFase | null;
}

/**
 * Qué estados saltan de verdad.
 *
 * Solo celebrar. El encargo pedía la máquina de cinco fases para el salto de
 * alegría, y meterla en más sitios sería confundir el motor con el personaje:
 * estar contento no es saltar sin parar, y un Milo que bota mientras escucha no
 * está escuchando.
 */
export const ESTADOS_QUE_SALTAN: EstadoMascota[] = ['celebrando'];

/**
 * Un desplazamiento propio para cada Milo.
 *
 * Sin esto, dos Milos en la misma pantalla —pasa en la tienda y en el
 * escaparate— respiran exactamente a la vez, y dos criaturas sincronizadas al
 * milisegundo se leen como dos copias del mismo GIF. Se calcula de un número
 * cualquiera que el componente guarda al montarse.
 */
export function desfaseDe(semilla: number, grupo: number): number {
  return ((semilla * 9301 + grupo * 49297) % 233280) / 233280;
}

/** Los cuatro grupos que llevan reloj propio, en el orden de `COMPAS`. */
const GRUPOS = ['cuerpo', 'alas', 'cola', 'cabeza'] as const;

/**
 * La postura de Milo en el milisegundo `t`.
 *
 * Cada grupo del cuerpo va por su compás, igual que antes, pero recorriendo el
 * camino entero entre las dos poses en vez de saltar de una a otra. Esa es toda
 * la diferencia entre el motor viejo y este: antes las poses eran los dos
 * sitios donde había que estar, ahora son los dos extremos por los que se pasa.
 *
 * `desfase` es el número propio de cada Milo; `tic` es el gesto suelto que esté
 * corriendo, si hay alguno.
 */
export function poseDelMomento(
  estado: EstadoMascota,
  t: number,
  desfase: number,
  tic?: Partial<Pose> | null,
): PoseViva {
  const gesto = GESTOS[estado];

  /** Por dónde va el vaivén de este grupo, de 0 (pose A) a 1 (pose B). */
  const vaiven: Record<(typeof GRUPOS)[number], number> = {
    cuerpo: 0,
    alas: 0,
    cola: 0,
    cabeza: 0,
  };
  for (let i = 0; i < GRUPOS.length; i++) {
    const grupo = GRUPOS[i]!;
    // El ciclo completo son DOS ritmos: ida y vuelta. El compás lo estira o lo
    // encoge, y de ahí sale que las alas vayan al doble que el cuerpo y la cola
    // siempre tarde, que es lo que la partitura pide y razona.
    const ciclo = gesto.ritmo * 2 * COMPAS[grupo];
    vaiven[grupo] = respiracion(t / ciclo + desfaseDe(desfase, i));
  }

  const { a, b } = gesto;
  const m = (campo: keyof Pose, grupo: (typeof GRUPOS)[number]): number =>
    entre(a[campo] ?? 0, b[campo] ?? 0, vaiven[grupo]);

  const pose: PoseViva = {
    y: m('y', 'cuerpo'),
    eX: 1,
    eY: m('eY', 'cuerpo'),
    giro: m('giro', 'cuerpo'),
    alaCercana: m('alaCercana', 'alas'),
    alaLejana: m('alaLejana', 'alas'),
    fueraCercana: m('fueraCercana', 'alas'),
    fueraLejana: m('fueraLejana', 'alas'),
    cabeza: m('cabeza', 'cabeza'),
    ojo: m('ojo', 'cabeza'),
    ceja: m('ceja', 'cabeza'),
    cejaGiro: m('cejaGiro', 'cabeza'),
    cejaSesgo: m('cejaSesgo', 'cabeza'),
    cola: m('cola', 'cola'),
    patas: 0,
    fase: null,
  };

  /*
    El gesto suelto manda sobre el vaivén mientras dura.

    Es la misma regla que tenía el motor viejo y por el mismo motivo: si el
    vaivén siguiera corriendo por debajo, le pisaría las poses a media sacudida
    y el tic se quedaría en un temblor. La diferencia es que aquí se mezcla en
    vez de sustituirse, así que un tic que solo toca las alas deja el resto del
    cuerpo respirando.
  */
  if (tic) {
    for (const clave of Object.keys(tic) as (keyof Pose)[]) {
      const valor = tic[clave];
      if (typeof valor === 'number') pose[clave] = valor;
    }
  }

  // Y encima de todo, el salto, que manda sobre el cuerpo entero.
  if (ESTADOS_QUE_SALTAN.includes(estado)) {
    const salto = faseDelSalto(t / CICLO_SALTO + desfase);
    pose.fase = salto.fase;
    pose.y = salto.altura;
    pose.eY = salto.escalaY;
    pose.patas = salto.patas;
    // Los ojos: manda el más cerrado de los dos. La felicidad de la cúspide no
    // puede ABRIR unos ojos que la partitura tenía entornados.
    pose.ojo = Math.min(pose.ojo, salto.ojo);
    /*
      El aleteo del salto es una frecuencia, no una postura.

      Por eso se recalcula el vaivén de las alas en vez de sobrescribir el
      ángulo: lo que cambia en la cúspide no es hasta dónde llega el ala, es
      cuántas veces por segundo va y viene. Sobrescribiendo el ángulo saldría un
      ala clavada arriba, que es un pájaro en una foto.
    */
    const ciclo = (gesto.ritmo * 2 * COMPAS.alas) / salto.aleteo;
    const bat = respiracion(t / ciclo + desfaseDe(desfase, 1));
    pose.alaCercana = entre(a.alaCercana, b.alaCercana, bat);
    pose.alaLejana = entre(a.alaLejana, b.alaLejana, bat);
  }

  // Lo último, siempre: el ancho sale del alto y de nada más.
  pose.eX = conservarVolumen(pose.eY);
  return pose;
}

/**
 * Cuánto tarda Milo en pasar de un estado a otro.
 *
 * Esto es lo ÚNICO que el motor de resortes hacía y este no hacía, y es una
 * deuda que hay que pagar expresamente. Allí cada parte colgaba de un muelle,
 * así que al cambiar de estado no saltaba a la postura nueva: salía hacia ella,
 * se pasaba un poco y volvía. Aquí la postura es una función del tiempo, y una
 * función del tiempo contesta la postura nueva desde el primer fotograma: sin
 * esto, Milo pasa de estar tranquilo a estar celebrando EN UN FOTOGRAMA, que es
 * un corte, no una reacción.
 *
 * 260 ms está medido contra el gesto más corto que tiene que sobrevivir: el
 * respingo de la sorpresa cambia de pose cada 760 ms, así que una transición
 * más larga se comería el principio del propio gesto y la sorpresa llegaría
 * tarde a su propio susto.
 */
export const TRANSICION = 260;

/**
 * El camino de una postura a otra, con rebote.
 *
 * La curva se pasa de largo a propósito —llega a 1,06 y vuelve— porque eso es
 * lo que hacía el resorte y es lo que se lee como una reacción en vez de como
 * un desplazamiento. Sin el sobreimpulso queda correcto y muerto, que es de lo
 * que veníamos.
 */
export function mezclarPoses(desde: PoseViva, hasta: PoseViva, avance: number): PoseViva {
  const t = Math.max(0, Math.min(1, avance));
  /*
    Un solo rebote que se apaga: la misma forma que daba un muelle poco
    amortiguado, sin tener que integrar nada.

    El `1 - t³` del final no es adorno. Sin él, la exponencial todavía vale
    0,033 al acabar y la curva se queda un 3 % pasada del destino: Milo llegaba
    a la postura nueva y se quedaba a un pelo de ella para siempre, hasta el
    siguiente cambio. Es el mismo fallo que el de la costura del salto y se ve
    igual de poco y de mal. Con la ventana, el rebote sigue en el medio —llega a
    pasarse un 8 %— y el final cae clavado.
  */
  const e = 1 - Math.cos(t * Math.PI * 1.35) * Math.exp(-t * 3.4) * (1 - t ** 3);
  const mezcla: PoseViva = {
    y: entre(desde.y, hasta.y, e),
    eX: 1,
    eY: entre(desde.eY, hasta.eY, e),
    giro: entre(desde.giro, hasta.giro, e),
    alaCercana: entre(desde.alaCercana, hasta.alaCercana, e),
    alaLejana: entre(desde.alaLejana, hasta.alaLejana, e),
    fueraCercana: entre(desde.fueraCercana, hasta.fueraCercana, e),
    fueraLejana: entre(desde.fueraLejana, hasta.fueraLejana, e),
    cabeza: entre(desde.cabeza, hasta.cabeza, e),
    ojo: entre(desde.ojo, hasta.ojo, e),
    ceja: entre(desde.ceja, hasta.ceja, e),
    cejaGiro: entre(desde.cejaGiro, hasta.cejaGiro, e),
    cejaSesgo: entre(desde.cejaSesgo, hasta.cejaSesgo, e),
    cola: entre(desde.cola, hasta.cola, e),
    patas: entre(desde.patas, hasta.patas, e),
    fase: hasta.fase,
  };
  // Y aquí también el ancho se deriva: interpolando los dos anchos, el punto
  // medio de la transición dejaría de conservar volumen.
  mezcla.eX = conservarVolumen(mezcla.eY);
  return mezcla;
}

/**
 * La postura de quien pidió menos movimiento.
 *
 * Es la pose B de la partitura, la «soltada», y no un fotograma cualquiera del
 * ciclo. Esta función existe porque parar el reloj NO basta, y se vio en las
 * capturas: `poseDelMomento(estado, 0, desfase)` sigue leyendo el desfase, que
 * es distinto en cada Milo, así que cada uno se congelaba en un punto distinto
 * de su ciclo. En reposo eso solo daba variedad, pero celebrando dejaba a unos
 * aplastados contra el suelo y a otros clavados en el aire a media altura, que
 * es una postura que no significa nada y que encima no se puede explicar.
 *
 * La B y no la A porque la A es la CARGADA: el agachado de antes de saltar, el
 * respingo antes del susto. Dejarlo ahí es dejar la mitad de un gesto, y media
 * anticipación sin su descarga no se entiende. La B es la que cuenta el estado:
 * el que celebra en el aire y el triste hundido. Es la misma decisión que
 * llevaba el motor anterior, razonada en `Mascota.tsx`, y se conserva tal cual.
 */
export function poseQuieta(estado: EstadoMascota): PoseViva {
  const { b } = GESTOS[estado];
  return {
    y: b.y,
    eX: conservarVolumen(b.eY),
    eY: b.eY,
    giro: b.giro,
    alaCercana: b.alaCercana,
    alaLejana: b.alaLejana,
    fueraCercana: b.fueraCercana ?? 0,
    fueraLejana: b.fueraLejana ?? 0,
    cabeza: b.cabeza,
    ojo: b.ojo,
    ceja: b.ceja,
    cejaGiro: b.cejaGiro,
    cejaSesgo: b.cejaSesgo,
    cola: b.cola,
    patas: 0,
    fase: null,
  };
}

/**
 * El director de gestos sueltos.
 *
 * Es la misma idea de `TICS` en la partitura —estirarse, sacudirse, otear,
 * botar— pero resuelta con el reloj en vez de con una cadena de `setTimeout`.
 * Se le pregunta en cada fotograma «¿hay algo ahora?» y contesta con la pose
 * parcial que toque, o con nada.
 *
 * Que sea una función del tiempo y no una cadena de temporizadores importa por
 * algo concreto: con temporizadores, un Milo que se desmonta a media sacudida
 * deja relojes sueltos que hay que acordarse de limpiar, y eso ya costó un
 * error en el motor anterior. Aquí no hay nada que limpiar.
 */
export class DirectorDeTics {
  private cuando = 0;
  private cual: string | null = null;
  private nombres = Object.keys(TICS);

  constructor(private azar: () => number = Math.random) {
    this.cuando = 5000 + this.azar() * 7000;
  }

  /**
   * Qué pose parcial toca ahora, o `null`.
   *
   * `permitido` lo decide quien llama mirando `ESTADOS_CON_TICS`: celebrando ya
   * tiene bastante y quien duerme no otea.
   */
  paso(t: number, permitido: boolean): Partial<Pose> | null {
    if (!permitido) {
      this.cual = null;
      // Se reprograma para más adelante: si no, al volver a un estado tranquilo
      // dispararía un tic en el mismo fotograma del cambio, y un personaje que
      // se estira justo al terminar de celebrar parece que se ha colgado.
      this.cuando = Math.max(this.cuando, t + 4000);
      return null;
    }

    if (t < this.cuando) return null;

    if (!this.cual) {
      this.cual = this.nombres[Math.floor(this.azar() * this.nombres.length)] ?? null;
    }
    const pasos = this.cual ? TICS[this.cual] : null;
    if (!pasos) return null;

    // Dónde va dentro de la secuencia, sumando lo que aguanta cada paso.
    let transcurrido = t - this.cuando;
    for (const paso of pasos) {
      if (transcurrido < paso.aguanta) return paso.pose;
      transcurrido -= paso.aguanta;
    }

    // Se acabó: a esperar otro rato largo. Entre seis y quince segundos, porque
    // un tic que sale siempre a la misma hora deja de ser un tic.
    this.cual = null;
    this.cuando = t + 6000 + this.azar() * 9000;
    return null;
  }
}

/**
 * El parpadeo, con su temporizador independiente como pedía el encargo.
 *
 * Va aparte del vaivén del cuerpo a propósito, pero «aparte» no basta, y esto
 * lo descubrió la prueba de `motor.test.ts` cuando el parpadeo era un simple
 * `t / 2500`:
 *
 *   Respirar en reposo dura 1000 × 2 = 2000 ms y parpadear 2500. La razón
 *   entre los dos es 1,25 exacta, así que el parpadeo solo podía caer en
 *   CUATRO puntos de la respiración —el 0, el 25, el 50 y el 75 %— y volvía a
 *   empezar cada cuatro. Dos relojes independientes con periodos de razón
 *   racional no son independientes: son el mismo reloj con más pasos, y eso se
 *   nota a la tercera vuelta aunque nadie sepa decir por qué.
 *
 * Se arregla moviendo el arranque de cada parpadeo dentro de su hueco, con un
 * número que depende de qué parpadeo es. Sigue habiendo uno por cada 2,5 s de
 * media, que es lo que pedía el encargo, pero ya no caen a intervalos iguales:
 * entre dos hay de medio segundo a cuatro y medio.
 *
 * Devuelve cuánto están abiertos los ojos, de 0 a 1. Cerrar dura 95 ms y no se
 * interpola con un resorte: un parpadeo que rebota da susto, y eso ya estaba
 * medido y razonado en el motor anterior.
 */
export function parpadeoEn(t: number, desfase: number): number {
  const DURA = 95;
  const corrido = t + desfase * PARPADEO;
  const vuelta = Math.floor(corrido / PARPADEO);
  // El hueco de cada parpadeo mide 2,5 s y el parpadeo cae en algún punto del
  // primer 80 % de él. De ahí sale la irregularidad sin perder la media.
  const arranque = azarDe(vuelta) * PARPADEO * 0.8;
  const dentro = corrido - vuelta * PARPADEO - arranque;

  // Uno de cada cuatro es doble, que es lo que hace la gente de verdad. Se
  // decide con el número de vuelta y no tirando un dado en cada fotograma: un
  // motor que contesta distinto a la misma pregunta no se puede comprobar, y
  // en pantalla sería un párpado que se abre a medio cerrar.
  const doble = azarDe(vuelta * 7 + 3) < 0.25;

  if (dentro >= 0 && dentro < DURA) return cerrado(dentro / DURA);
  if (doble && dentro >= DURA + 110 && dentro < DURA + 110 + DURA) {
    return cerrado((dentro - DURA - 110) / DURA);
  }
  return 1;
}

/**
 * Un número entre 0 y 1, siempre el mismo para el mismo entero.
 *
 * Hace falta azar que no cambie: el motor se pregunta por un instante y tiene
 * que contestar lo mismo siempre, tanto para poder comprobarlo como para que
 * volver a pintar el mismo fotograma —pasa al cambiar de tamaño o al volver a
 * entrar en pantalla— no dé un dibujo distinto.
 */
function azarDe(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** El recorrido de un párpado: baja y sube, sin pasarse al abrir. */
function cerrado(s: number): number {
  return Math.abs(Math.cos(s * Math.PI)) ** 0.6 * 0.94 + 0.06;
}

/**
 * Hacia dónde mira, siguiendo al cursor con interpolación lineal.
 *
 * El encargo pedía lineal expresamente y lineal se ha quedado, aunque un
 * resorte daría más gracia. Tiene su razón: la mirada es lo único que responde
 * a la persona en tiempo real, y un resorte se pasa de largo. Una pupila que se
 * pasa del cursor y vuelve no parece que te esté mirando, parece que busca.
 *
 * El coeficiente se corrige por fotograma para que la velocidad no dependa de
 * los fotogramas por segundo: a 0,18 por fotograma, una pantalla de 120 Hz
 * seguiría el cursor al doble de rápido que una de 60.
 */
export function seguirMirada(actual: number, objetivo: number, dt: number): number {
  const k = 1 - Math.exp(-dt / 90);
  return actual + (objetivo - actual) * k;
}

/** Hasta dónde se desplaza la pupila dentro del ojo, en unidades del lienzo. */
export const ALCANCE_MIRADA = { x: 3.4, y: 2.2 };
