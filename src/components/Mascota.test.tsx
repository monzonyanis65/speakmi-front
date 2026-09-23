import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Mascota, type Atuendo, type Especie, type EstadoMascota } from './Mascota';
import { aperturaDeVoz, ESTADOS_CON_TICS, GESTOS, RESORTE, TICS } from './mascotas/coreografia';
import { ESPECIES as CATALOGO } from './mascotas';

/**
 * El pivote de una capa, sin la tercera componente.
 *
 * El navegador escribe siempre una z que aquí no dice nada: `60px 66px` sale
 * como `60px 66px 0`. Lo que importa son las dos primeras.
 */
function pivoteDe(capa: SVGGElement | null): string {
  return (capa?.style.transformOrigin ?? '').split(/\s+/).slice(0, 2).join(' ');
}

/**
 * Milo tiene que moverse siempre, y moverse distinto según lo que hace.
 *
 * Esta prueba existe por un motivo concreto: durante mucho tiempo el ala era
 * una elipse quieta que solo se levantaba al celebrar, y la cola no se movía
 * nunca. Un pájaro con partes congeladas se lee como un icono, no como un
 * personaje, y eso no se nota en ninguna prueba de las normales.
 *
 *
 * POR QUÉ ESTAS PRUEBAS MIRAN LA PARTITURA Y NO EL DIBUJO
 *
 * Antes el movimiento eran clases de CSS, y se podía comprobar leyendo el
 * marcado: si en el estado «celebrando» aparecía `animate-aletear`, aleteaba.
 * Ahora son resortes, y un resorte solo avanza cuando el navegador entrega
 * fotogramas. Aquí no hay navegador ni fotogramas, así que si se intentara leer
 * lo mismo se vería siempre el primer instante de todo, que es idéntico en los
 * once estados. Una prueba así pasaría siempre y no comprobaría nada.
 *
 * Por eso se comprueba `GESTOS`, que es la coreografía: qué pose tiene cada
 * estado y a qué ritmo. Es mejor sitio, además, porque es donde de verdad se
 * decide cómo se mueve el personaje. Que los resortes luego lo ejecuten bien se
 * mira en el navegador, que es donde se ve.
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

/** Cuánto se mueve un estado: la mayor diferencia entre sus dos poses. */
function recorrido(estado: EstadoMascota): number {
  const { a, b } = GESTOS[estado];
  return Math.max(
    Math.abs(a.y - b.y),
    Math.abs(a.eX - b.eX) * 100,
    Math.abs(a.eY - b.eY) * 100,
    Math.abs(a.giro - b.giro),
    Math.abs(a.alaCercana - b.alaCercana),
    Math.abs(a.alaLejana - b.alaLejana),
    Math.abs(a.cabeza - b.cabeza),
    Math.abs(a.ojo - b.ojo) * 100,
    Math.abs(a.cola - b.cola),
  );
}

describe('la coreografía: cada estado se mueve a su manera', () => {
  it('los once estados tienen su gesto, sin olvidar ninguno', () => {
    for (const estado of TODOS) {
      expect(GESTOS[estado], `falta el gesto de ${estado}`).toBeDefined();
    }
    expect(Object.keys(GESTOS).sort()).toEqual([...TODOS].sort());
  });

  it('ningún estado deja a la mascota completamente inmóvil', () => {
    // Ni siquiera pensando, que es el más quieto de todos: un personaje
    // absolutamente clavado no se lee como concentrado, se lee como una imagen
    // que no ha terminado de cargar.
    for (const estado of TODOS) {
      expect(recorrido(estado), `${estado} está congelado`).toBeGreaterThan(0);
    }
  });

  it('pensando es el más quieto, y celebrando el que más se mueve', () => {
    const porRecorrido = [...TODOS].sort((x, z) => recorrido(x) - recorrido(z));
    expect(porRecorrido[0]).toBe('pensando');
    expect(porRecorrido[porRecorrido.length - 1]).toBe('celebrando');
  });

  it('celebrar se agacha antes de saltar: ahí está la anticipación', () => {
    // Es el principio que más se nota de la animación clásica. Un salto sin
    // agachado previo se lee como un objeto empujado, no como alguien que
    // salta. La pose A es el agachado y por eso existe.
    const { a, b } = GESTOS.celebrando;
    expect(a.y, 'la pose de carga debería agacharse').toBeGreaterThan(0);
    expect(b.y, 'la pose de suelta debería despegar').toBeLessThanOrEqual(-6);
    /*
      Y no mucho más. El dibujo ocupa el lienzo entero, y la subida no la hace
      solo esto: como la capa pivota en las patas, el estiramiento sube la
      coronilla por su cuenta. Sumado, al búho se le salían 23 unidades de
      cabeza de las 120 del lienzo, penachos fuera.
    */
    expect(b.y, 'un salto así se sale de la pantalla').toBeGreaterThanOrEqual(-10);
    expect(b.eY, 'y el estiramiento del salto también sube la coronilla').toBeLessThan(1.07);
    // Y agacharse es aplastarse: ancho y bajo al cargar, estrecho y alto al
    // saltar. Sin eso el salto parece un ascensor.
    expect(a.eX).toBeGreaterThan(1);
    expect(a.eY).toBeLessThan(1);
    expect(b.eX).toBeLessThan(1);
    expect(b.eY).toBeGreaterThan(1);
  });

  it('el estiramiento es asimétrico en los once', () => {
    // Un ser vivo que coge aire se alarga y se estrecha a la vez, conservando
    // el volumen. Escalar los dos ejes en el mismo sentido lo hincha como un
    // globo, que es justo lo que delata a un dibujo.
    for (const estado of TODOS) {
      const { a, b } = GESTOS[estado];
      const enAlto = b.eY - a.eY;
      const enAncho = b.eX - a.eX;
      expect(
        enAlto * enAncho,
        `${estado} se hincha en vez de estirarse (eX ${a.eX}->${b.eX}, eY ${a.eY}->${b.eY})`,
      ).toBeLessThan(0);
    }
  });

  it('triste se hunde y va despacio; sorprendido salta y va deprisa', () => {
    // Se hunde encogiéndose, no metiéndose en el suelo: la capa pivota en las
    // patas, así que encoger ya es hundir el cuerpo dejando los pies donde están.
    expect(GESTOS.triste.a.eY).toBeLessThan(1);
    expect(GESTOS.triste.b.eY).toBeLessThan(1);
    expect(GESTOS.triste.b.eY).toBeLessThan(GESTOS.triste.a.eY);
    // Las alas caídas, las dos: si solo cayera una, parecería que le pasa algo
    // en el hombro. Los grados son «hacia arriba», así que caer es negativo.
    expect(GESTOS.triste.a.alaCercana).toBeLessThan(-15);
    expect(GESTOS.triste.a.alaLejana).toBeLessThan(-15);
    // Y lo que más vende la tristeza no es la postura, es la lentitud.
    expect(GESTOS.triste.ritmo).toBeGreaterThan(GESTOS.celebrando.ritmo * 2);

    // La sorpresa sí despega: un respingo que no se va del suelo no es respingo.
    expect(GESTOS.sorprendido.a.y).toBeLessThanOrEqual(-5);
    expect(GESTOS.sorprendido.a.ojo, 'la sorpresa abre los ojos').toBeGreaterThan(1.2);
  });

  it('orgulloso deja un ala en jarras y la otra en su vaivén', () => {
    // El ala quieta es la pose; la que sigue moviéndose es lo que impide que
    // parezca un maniquí.
    const { a, b } = GESTOS.orgulloso;
    expect(a.alaCercana).toBe(b.alaCercana);
    expect(a.alaLejana).not.toBe(b.alaLejana);
    expect(a.alaCercana, 'en jarras es el ala pegada abajo').toBeLessThan(-25);
  });

  it('animar saluda: el ala de acá sube mucho más que la de allá', () => {
    const { b } = GESTOS.animando;
    expect(b.alaCercana, 'saludar es levantar el ala por encima del hombro').toBeGreaterThan(60);
    expect(Math.abs(b.alaCercana)).toBeGreaterThan(Math.abs(b.alaLejana) * 3);
    /*
      Y sobre todo: el ala tiene que SEPARARSE del cuerpo, o no se ve.

      Mide 24 unidades de ancho y el cuerpo la tapa entera menos cuatro. El
      saludo estuvo girándola 58 grados sin apartarla, y desde fuera no se movía
      nada: lo único visible era una astilla pegada al costado.
    */
    expect(b.fueraCercana ?? 0, 'un ala pegada al cuerpo no puede saludar').toBeGreaterThan(5);
    // Pero tampoco tanto como para despegarse: a 13 unidades el ala dejaba de
    // tocar el cuerpo y se leía como un bulto suelto flotando al lado.
    expect(b.fueraCercana ?? 0, 'un ala despegada tampoco saluda').toBeLessThan(11);
  });

  it('dormir es la respiración más honda de todas', () => {
    const hondura = (e: EstadoMascota) => Math.abs(GESTOS[e].a.eY - GESTOS[e].b.eY);
    for (const estado of TODOS) {
      if (estado === 'durmiendo' || estado === 'celebrando') continue;
      expect(hondura('durmiendo'), `${estado} respira más hondo que dormido`).toBeGreaterThan(
        hondura(estado),
      );
    }
    // Y más lenta que la de estar despierto.
    expect(GESTOS.durmiendo.ritmo).toBeGreaterThan(GESTOS.neutral.ritmo);
  });

  it('escuchar se inclina hacia quien habla y abre un poco los ojos', () => {
    expect(GESTOS.escuchando.a.cabeza).toBeGreaterThan(0);
    expect(GESTOS.escuchando.a.ojo).toBeGreaterThan(1);
    // Pero no es una fiesta: las alas casi no se mueven.
    expect(Math.abs(GESTOS.escuchando.b.alaCercana)).toBeLessThan(5);
  });

  it('solo despega del suelo quien de verdad salta', () => {
    /*
      El cuerpo pivota en la línea de las patas, así que la subida del pecho al
      respirar ya la produce la escala. Un desplazamiento vertical encima levanta
      también las patas, y entonces el animal levita y se despega de su propia
      sombra, que en el escaparate de la tienda está dibujada fija debajo.

      Medido en el navegador antes de esto: las patas recorrían 2,11 px en la
      pantalla de entrada, estando la mascota simplemente quieta.
    */
    const VUELAN: EstadoMascota[] = ['celebrando', 'sorprendido', 'feliz'];
    for (const estado of TODOS) {
      const { a, b } = GESTOS[estado];
      const despega = a.y !== 0 || b.y !== 0;
      expect(despega, `${estado} ${despega ? 'levita sin saltar' : 'debería despegar'}`).toBe(
        VUELAN.includes(estado),
      );
    }
  });

  it('los gestos sueltos existen y solo salen en los estados tranquilos', () => {
    // Un personaje que solo respira acaba leyéndose como una imagen con un
    // efecto encima. Lo que lo convierte en alguien que está ahí es que de vez
    // en cuando haga algo que no venía a cuento.
    expect(Object.keys(TICS).length).toBeGreaterThanOrEqual(3);
    for (const pasos of Object.values(TICS)) {
      expect(pasos.length).toBeGreaterThan(1);
      for (const paso of pasos) {
        expect(paso.aguanta).toBeGreaterThan(50);
        expect(Object.keys(paso.pose).length, 'un paso que no cambia nada').toBeGreaterThan(0);
      }
    }
    // Ni celebrando ni durmiendo: uno ya tiene bastante y el otro no otea.
    expect(ESTADOS_CON_TICS).not.toContain('celebrando');
    expect(ESTADOS_CON_TICS).not.toContain('durmiendo');
    expect(ESTADOS_CON_TICS).toContain('neutral');
  });

  it('la cabeza nunca tiene la misma pose en A y en B', () => {
    /*
      Cada parte lleva su propio reloj. Si las dos poses coinciden en un campo,
      ese reloj manda la parte siempre al mismo sitio y se queda clavada.
      Medido con la cabeza a 0 en las dos: en reposo pasaba quieta el 91 % del
      tiempo, y eso es justo lo que se lee como una animación lenta.
    */
    for (const estado of TODOS) {
      const { a, b } = GESTOS[estado];
      expect(a.cabeza, `la cabeza no se mueve en ${estado}`).not.toBe(b.cabeza);
      expect(a.cola, `la cola no se mueve en ${estado}`).not.toBe(b.cola);
    }
  });

  it('no hay dos estados que se muevan igual', () => {
    const vistos = TODOS.map((estado) => JSON.stringify(GESTOS[estado]));
    expect(new Set(vistos).size, 'hay estados con la coreografía repetida').toBe(TODOS.length);
  });

  it('los ritmos son de un ser vivo, no de un motor', () => {
    for (const estado of TODOS) {
      const { ritmo } = GESTOS[estado];
      // Por debajo de medio segundo vibra; por encima de tres, parece parado.
      expect(ritmo, `${estado} va a un ritmo raro`).toBeGreaterThanOrEqual(500);
      expect(ritmo).toBeLessThanOrEqual(3000);
    }
  });

  it('las partes pesan distinto, que es lo que las hace llegar desfasadas', () => {
    // Si todo pesara lo mismo, todo llegaría a la vez y se leería un recorte
    // articulado en vez de un cuerpo. La cola pesa más que el cuerpo a
    // propósito: no se mueve sola, la arrastra el cuerpo y llega tarde.
    expect(RESORTE.cola.mass).toBeGreaterThan(RESORTE.cuerpo.mass);
    expect(RESORTE.alaCercana.mass).toBeLessThan(RESORTE.cuerpo.mass);
    expect(RESORTE.alaCercana.mass).not.toBe(RESORTE.alaLejana.mass);
    expect(RESORTE.parpado.mass).toBeLessThan(RESORTE.ojo.mass);

    // Y ninguno rebota tanto como para oscilar sin parar.
    for (const [nombre, r] of Object.entries(RESORTE)) {
      expect(r.damping, `${nombre} rebota sin fin`).toBeGreaterThan(0);
      expect(r.stiffness, `${nombre} no llega nunca`).toBeGreaterThan(0);
    }
  });

  it('el párpado no rebota: un parpadeo con rebote da susto', () => {
    // Amortiguación crítica o por encima. Por debajo, el ojo se abriría de más
    // al terminar de abrirse, que es un tic, no un parpadeo.
    const critico = 2 * Math.sqrt(RESORTE.parpado.stiffness * RESORTE.parpado.mass);
    expect(RESORTE.parpado.damping).toBeGreaterThanOrEqual(critico);
  });
});

/**
 * Las capas del dibujo.
 *
 * Están marcadas con `data-capa` a propósito y no se identifican por su clase:
 * una clase es un efecto lateral de cómo esté hecho el movimiento hoy, y ya
 * cambió una vez. Un nombre puesto aposta es un contrato.
 */
describe('el dibujo tiene sus capas', () => {
  const CAPAS = [
    'cuerpo',
    'cola',
    'ala-lejana',
    'ala-cercana',
    'cabeza',
    'ojos',
    'mirada',
    'mandibula',
    'mandibula-ancho',
  ];

  it('las capas están todas, en todos los estados', () => {
    for (const estado of TODOS) {
      const { container } = render(<Mascota estado={estado} />);
      for (const capa of CAPAS) {
        expect(
          container.querySelector(`[data-capa="${capa}"]`),
          `falta la capa ${capa} en ${estado}`,
        ).not.toBeNull();
      }
    }
  });

  it('la cabeza gira por el cuello de cada especie, no por el centro del cráneo', () => {
    // Girando por el centro de la cabeza, la mascota no ladea: rota como una
    // pegatina sobre sí misma.
    for (const especie of ESPECIES) {
      const { container } = render(<Mascota especie={especie} />);
      const cabeza = container.querySelector<SVGGElement>('[data-capa="cabeza"]');
      expect(pivoteDe(cabeza), `${especie} ladea por donde no es`).toBe(
        `60px ${CATALOGO[especie].anclajes.cuello}px`,
      );
    }
  });

  it('el cuerpo pivota en el suelo, para que las patas no se despeguen', () => {
    const { container } = render(<Mascota />);
    const cuerpo = container.querySelector<SVGGElement>('[data-capa="cuerpo"]');
    // y=108 en un lienzo de 120 es la línea donde apoyan las cinco especies.
    expect(cuerpo?.style.transformOrigin).toContain('108px');
  });

  it('los pivotes se leen en coordenadas del lienzo, no de cada pieza', () => {
    // La librería marca lo que anima con `transform-box: fill-box`, y con eso un
    // pivote en píxeles deja de contarse desde el lienzo y pasa a contarse desde
    // el borde de cada figura. Los de aquí son del lienzo —el cuello, la bisagra
    // de la boca, la línea del suelo—, así que hay que decirlo expresamente.
    // Sin esto la cabeza gira alrededor de un punto que cae fuera del cráneo.
    const { container } = render(<Mascota estado="hablando" />);
    const conPivote = [...container.querySelectorAll<SVGGElement>('[data-capa]')].filter((c) =>
      c.style.transformOrigin.includes('px'),
    );
    // La capa de la mirada solo desplaza las pupilas y no declara pivote: para
    // un desplazamiento da igual dónde esté. La regla es para las que sí giran
    // o escalan, que son las que se rompen en silencio.
    expect(conPivote.length).toBeGreaterThan(4);
    for (const capa of conPivote) {
      expect(capa.style.transformBox, `${capa.dataset.capa} mide el pivote desde su borde`).toBe(
        'view-box',
      );
    }
  });

  it('las patas van dentro del cuerpo, no sueltas', () => {
    // Fuera, quedarían quietas mientras el tronco sube y las piernas de Milo y
    // del búho, que son líneas de y=100 a y=108, se estirarían como un chicle.
    const { container } = render(<Mascota especie="PET_MILO" />);
    const cuerpo = container.querySelector('[data-capa="cuerpo"]');
    expect(cuerpo?.innerHTML).toContain('M52 100 L52 108');
  });

  it('los ojos y el pico se cruzan en opacidad en vez de desmontarse', () => {
    for (const estado of TODOS) {
      const { container } = render(<Mascota estado={estado} />);
      const marcado = container.innerHTML;
      expect(marcado, `${estado} sin cruce de opacidad`).toContain('transition-opacity');
      // Las dos bocas están siempre puestas, se vea la que se vea.
      expect(marcado).toContain('M54 50 L66 50 L60 58 Z');
      expect(marcado).toContain('M54 52 L66 52 L60 62 Z');
    }
  });

  it('pensando y durmiendo cierran los ojos, y no de la misma forma', () => {
    // Dormido los párpados caen relajados; pensando se arquean hacia arriba, que
    // es lo que distingue a alguien con los ojos cerrados de alguien dormido.
    const { container: piensa } = render(<Mascota estado="pensando" />);
    const { container: duerme } = render(<Mascota estado="durmiendo" />);
    expect(piensa.innerHTML).toContain('M44 40 Q50 35 56 40');
    expect(duerme.innerHTML).toContain('M44 40 Q50 45 56 40');
    // Y despierto no se dibujan cerrados.
    const { container: despierto } = render(<Mascota estado="neutral" />);
    expect(despierto.querySelector('[data-capa="mirada"]')?.getAttribute('class')).toContain(
      'opacity-100',
    );
  });

  it('solo escuchando saca ondas y solo celebrando saca estrellas', () => {
    for (const estado of TODOS) {
      const { container } = render(<Mascota estado={estado} />);
      const marcado = container.innerHTML;
      expect(marcado.includes('animate-onda'), `ondas en ${estado}`).toBe(estado === 'escuchando');
      expect(marcado.includes('animate-destello'), `estrellas en ${estado}`).toBe(
        estado === 'celebrando',
      );
    }
  });
});

const ESPECIES: Especie[] = ['PET_MILO', 'PET_GATO', 'PET_PERRO', 'PET_BUHO', 'PET_ZORRO'];
const ATUENDOS: Atuendo[] = ['OUTFIT_GORRO', 'OUTFIT_BUFANDA', 'OUTFIT_GAFAS', 'OUTFIT_CORONA'];

/** Todo el marcado del dibujo, para comparar dibujos enteros. */
function dibujo(estado: EstadoMascota, especie?: Especie, atuendo?: Atuendo): string {
  const { container } = render(<Mascota estado={estado} especie={especie} atuendo={atuendo} />);
  return container.innerHTML;
}

/**
 * Cinco animales, un solo esqueleto.
 *
 * El riesgo de tener varias especies no es que una se vea fea: es que una se
 * quede a medio animar. Como las formas y el movimiento están separados, ninguna
 * especie puede moverse distinta de las demás ni aunque quiera: el movimiento no
 * está en sus archivos. Eso es lo que se comprueba aquí.
 */
describe('cada especie es otro animal', () => {
  it('sin decir nada sale Milo, exactamente igual que antes', () => {
    for (const estado of TODOS) {
      expect(dibujo(estado), `${estado} cambió al no pasar especie`).toBe(
        dibujo(estado, 'PET_MILO'),
      );
    }
    // Y sigue siendo el pájaro de siempre: copete, cuerpo índigo y pico.
    const milo = dibujo('neutral');
    expect(milo).toContain('M52 32 Q58 18 66 30 Q60 26 52 32 Z');
    expect(milo).toContain('fill-marca-600');
    expect(milo).toContain('M54 50 L66 50 L60 58 Z');
  });

  it('las cinco se pintan distinto, no es la misma silueta repintada', () => {
    const dibujos = ESPECIES.map((especie) => dibujo('neutral', especie));
    for (let i = 0; i < dibujos.length; i++) {
      for (let j = i + 1; j < dibujos.length; j++) {
        expect(dibujos[i], `${ESPECIES[i]} y ${ESPECIES[j]} se dibujan igual`).not.toBe(dibujos[j]);
      }
    }
    // Y cada una lleva su color, que es lo primero que se ve de lejos.
    expect(dibujos[1]).toContain('fill-slate-400');
    expect(dibujos[2]).toContain('fill-amber-500');
    expect(dibujos[3]).toContain('fill-teal-600');
    expect(dibujos[4]).toContain('fill-orange-500');
  });

  it('el lector de pantalla dice qué animal es, no siempre «Milo»', () => {
    const etiquetas = ESPECIES.map((especie) => {
      const { container } = render(<Mascota especie={especie} />);
      return container.querySelector('svg')?.getAttribute('aria-label') ?? '';
    });
    expect(new Set(etiquetas).size).toBe(ESPECIES.length);
    expect(etiquetas[0]).toContain('pájaro');
    expect(etiquetas[1]).toContain('gata');
    expect(etiquetas[2]).toContain('perro');
    expect(etiquetas[3]).toContain('búho');
    expect(etiquetas[4]).toContain('zorro');
  });

  it('ninguna especie puede moverse distinta: el movimiento no es suyo', () => {
    // Las cinco montan las mismas capas en los once estados. Si una especie
    // pudiera animar algo por su cuenta, añadir un animal sexto podría romper el
    // movimiento de los cinco anteriores.
    for (const estado of TODOS) {
      const capas = (especie: Especie) => {
        const { container } = render(<Mascota estado={estado} especie={especie} />);
        return [...container.querySelectorAll('[data-capa]')].map((e) =>
          e.getAttribute('data-capa'),
        );
      };
      const referencia = capas('PET_MILO');
      for (const especie of ESPECIES) {
        expect(capas(especie), `${especie} se mueve distinto a Milo en ${estado}`).toEqual(
          referencia,
        );
      }
    }
  });

  it('todas cruzan la boca en opacidad en vez de sustituirla', () => {
    // Cada animal tiene su hocico, pero el truco del cruce es del esqueleto:
    // si una especie se saltara la capa apagada, esa boca aparecería de golpe.
    for (const especie of ESPECIES) {
      const cerrada = dibujo('neutral', especie);
      const abierta = dibujo('animando', especie);
      expect(cerrada, `${especie} sin cruce de opacidad`).toContain('transition-opacity');
      expect(cerrada).toContain('opacity-0');
      expect(abierta).toContain('opacity-0');
    }
  });
});

/**
 * La ropa.
 *
 * Dos cosas pueden salir mal y ninguna se ve en una captura fija: que un gorro
 * pensado para el pájaro quede torcido en el búho, y que la cabeza se ladee
 * dejando el gorro clavado en el aire. Lo segundo solo se evita colgando la
 * ropa de la capa que se ladea, y eso es lo que se comprueba aquí.
 */
describe('la mascota lleva atuendos', () => {
  it('sin atuendo no se dibuja ropa de ninguna clase', () => {
    for (const especie of ESPECIES) {
      const { container } = render(<Mascota especie={especie} />);
      const cabeza = container.querySelector('[data-capa="cabeza"]');
      expect(cabeza?.querySelector('g[aria-hidden="true"]')).toBeNull();
    }
  });

  it('los cuatro atuendos se dibujan sobre las cinco especies', () => {
    for (const especie of ESPECIES) {
      const desnudo = dibujo('neutral', especie);
      for (const atuendo of ATUENDOS) {
        const vestido = dibujo('neutral', especie, atuendo);
        expect(vestido, `${atuendo} no se dibuja en ${especie}`).not.toBe(desnudo);
        expect(vestido.length).toBeGreaterThan(desnudo.length);
      }
    }
  });

  it('los cuatro atuendos son cuatro prendas distintas', () => {
    const prendas = ATUENDOS.map((atuendo) => dibujo('neutral', 'PET_GATO', atuendo));
    expect(new Set(prendas).size).toBe(ATUENDOS.length);
  });

  it('la ropa cuelga de la cabeza, así que se ladea con ella', () => {
    for (const especie of ESPECIES) {
      for (const atuendo of ATUENDOS) {
        const { container } = render(<Mascota especie={especie} atuendo={atuendo} />);
        const cabeza = container.querySelector('[data-capa="cabeza"]');
        expect(
          cabeza?.querySelector('g[aria-hidden="true"]'),
          `${atuendo} fuera de la capa que se ladea en ${especie}`,
        ).not.toBeNull();
      }
    }
  });

  it('vestirse no le quita ni una capa a ningún estado', () => {
    for (const estado of TODOS) {
      const capas = (atuendo?: Atuendo) => {
        const { container } = render(
          <Mascota estado={estado} especie="PET_ZORRO" atuendo={atuendo} />,
        );
        return [...container.querySelectorAll('[data-capa]')].map((e) =>
          e.getAttribute('data-capa'),
        );
      };
      const desnudo = capas();
      for (const atuendo of ATUENDOS) {
        expect(capas(atuendo), `${atuendo} altera el movimiento en ${estado}`).toEqual(desnudo);
      }
    }
  });

  it('las gafas caen sobre los ojos en las cinco, que están siempre en el mismo sitio', () => {
    for (const especie of ESPECIES) {
      const marcado = dibujo('neutral', especie, 'OUTFIT_GAFAS');
      // Las dos lentes, ancladas a los ojos y no al ancho de la cabeza.
      expect(marcado, `gafas descolocadas en ${especie}`).toContain('x="38.5"');
      expect(marcado).toContain('x="60.5"');
    }
  });

  it('el gorro se ensancha en el búho, que es el que tiene la cabeza más ancha', () => {
    // Si la prenda no midiera la cabeza, estos dos dibujos serían idénticos y
    // al búho le quedaría pequeño el gorro.
    const { container: conGato } = render(<Mascota especie="PET_GATO" atuendo="OUTFIT_GORRO" />);
    const { container: conBuho } = render(<Mascota especie="PET_BUHO" atuendo="OUTFIT_GORRO" />);
    const ala = (raiz: HTMLElement) =>
      raiz.querySelector('[data-capa="cabeza"] g[aria-hidden="true"] path')?.getAttribute('d');
    expect(ala(conGato)).not.toBe(ala(conBuho));
  });

  it('la etiqueta accesible dice también lo que lleva puesto', () => {
    const { container } = render(<Mascota especie="PET_PERRO" atuendo="OUTFIT_CORONA" />);
    const etiqueta = container.querySelector('svg')?.getAttribute('aria-label') ?? '';
    expect(etiqueta).toContain('perro');
    expect(etiqueta).toContain('corona');
  });
});

/**
 * Hablar.
 *
 * La pantalla de llamada es la única en la que se mira a la mascota fijamente y
 * durante minutos, así que es donde cualquier atajo se nota. Lo que se vigila
 * aquí es que la boca se DEFORME en vez de cambiarse por otra: cruzar dos bocas
 * fijas a golpes se lee como un pico que se abre y se cierra, y eso es una
 * marioneta, no alguien hablando.
 */
describe('la mascota habla', () => {
  it('la boca se mueve en dos ejes, en capas distintas', () => {
    // En un mismo elemento la segunda transformación anula a la primera, así que
    // la boca se movería en un solo eje y repetiría siempre la misma forma.
    const { container } = render(<Mascota estado="hablando" />);
    const alto = container.querySelector('[data-capa="mandibula"]');
    expect(alto).not.toBeNull();
    expect(alto?.querySelector('[data-capa="mandibula-ancho"]')).not.toBeNull();
  });

  it('cada especie abre la boca por su propia bisagra', () => {
    // Sin ese punto, la boca no se abre: se desplaza por la cara. Lo declara la
    // especie porque un pico gira donde se juntan sus dos mitades y un hocico
    // donde se junta con el morro.
    for (const especie of ESPECIES) {
      const { container } = render(<Mascota estado="hablando" especie={especie} />);
      const mandibula = container.querySelector<SVGGElement>('[data-capa="mandibula"]');
      expect(pivoteDe(mandibula), `${especie} abre la boca por donde no es`).toBe(
        CATALOGO[especie].origenBoca,
      );
    }
  });

  it('la boca se deforma, no se cambia por otra', () => {
    for (const especie of ESPECIES) {
      const { container } = render(<Mascota estado="hablando" especie={especie} />);
      // La boca abierta sigue montada y la cerrada apagada, igual que al
      // celebrar: lo que se anima es la forma de la primera.
      expect(container.innerHTML).toContain('transition-opacity');
      expect(container.querySelector('[data-capa="mandibula"]')).not.toBeNull();
    }
  });

  it('el morro no se encoge con la mandíbula', () => {
    // La nariz de la gata, la del perro y la del zorro se pintan fuera de la
    // boca justo por esto: dentro, encogerían con ella y la cara se hundiría en
    // cada sílaba. Sacarlas de la boca no es quitarlas: siguen dibujadas.
    const morros: Array<[Especie, string]> = [
      ['PET_GATO', 'M56 49 L64 49 L60 54 Z'],
      ['PET_PERRO', 'cy="48"'],
      ['PET_ZORRO', 'M56 52 Q60 48 64 52 Q60 58 56 52 Z'],
    ];
    for (const [especie, morro] of morros) {
      const { container } = render(<Mascota estado="hablando" especie={especie} />);
      const mandibula = container.querySelector('[data-capa="mandibula"]');
      expect(container.innerHTML, `${especie} perdió el morro`).toContain(morro);
      expect(mandibula?.innerHTML ?? '', `${especie} encoge el morro al hablar`).not.toContain(
        morro,
      );
    }
  });

  it('hablar no es celebrar, aunque los dos abran la boca', () => {
    // Celebrar abre la boca y la deja abierta; hablar la mueve. Y hablar no es
    // una fiesta: ni salta, ni suelta estrellitas.
    expect(dibujo('hablando')).not.toContain('animate-destello');
    expect(GESTOS.hablando.b.y).toBeGreaterThan(GESTOS.celebrando.b.y);
    expect(recorrido('hablando')).toBeLessThan(recorrido('celebrando'));
  });
});

/**
 * La intensidad.
 *
 * Es la puerta por la que entrará el volumen de la voz cuando haya audio. Se
 * comprueba la regla sola, sin dibujar nada: cuánto abre la boca es una cuenta,
 * y las cuentas se comprueban mejor aparte que a través de un SVG.
 */
describe('la boca se puede acompasar con la voz', () => {
  it('sin intensidad abre del todo: sale el ciclo normal', () => {
    // Una boca que espera datos no puede quedarse quieta.
    expect(aperturaDeVoz(undefined)).toBe(1);
  });

  it('con intensidad, la boca abre tanto como suene la voz', () => {
    expect(aperturaDeVoz(0.9)).toBeGreaterThan(aperturaDeVoz(0.2));
    expect(aperturaDeVoz(1)).toBeLessThanOrEqual(1);
  });

  it('el silencio no deja la mandíbula clavada', () => {
    // Un micrófono no lee cero a media palabra: una boca parada del todo no se
    // lee como silencio, se lee como que la aplicación se ha colgado.
    expect(aperturaDeVoz(0)).toBeGreaterThan(0);
    expect(aperturaDeVoz(0)).toBeLessThan(aperturaDeVoz(1));
  });

  it('los valores imposibles no rompen la cara', () => {
    // Un medidor de volumen mal escalado es cuestión de tiempo.
    expect(aperturaDeVoz(5)).toBe(aperturaDeVoz(1));
    expect(aperturaDeVoz(-3)).toBe(aperturaDeVoz(0));
  });

  it('la intensidad no cambia el dibujo, solo cuánto se mueve', () => {
    // Si añadiera una pose fija, al cortarse el movimiento con
    // `prefers-reduced-motion` la boca se quedaría deformada en vez de abierta.
    const { container: flojo } = render(<Mascota estado="hablando" intensidad={0.1} />);
    const { container: fuerte } = render(<Mascota estado="hablando" intensidad={0.9} />);
    expect(flojo.innerHTML).toBe(fuerte.innerHTML);
  });
});
