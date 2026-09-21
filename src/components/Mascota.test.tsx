import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Mascota, type Atuendo, type Especie, type EstadoMascota } from './Mascota';
import { ESPECIES as CATALOGO } from './mascotas';

/**
 * Milo tiene que moverse siempre, y moverse distinto según lo que hace.
 *
 * Esta prueba existe por un motivo concreto: durante mucho tiempo el ala era
 * una elipse quieta que solo se levantaba al celebrar, y la cola no se movía
 * nunca. Un pájaro con partes congeladas se lee como un icono, no como un
 * personaje, y eso no se nota en ninguna prueba de las normales.
 */

function partesAnimadas(estado: EstadoMascota, especie?: Especie, atuendo?: Atuendo): string[] {
  const { container } = render(<Mascota estado={estado} especie={especie} atuendo={atuendo} />);
  const svg = container.querySelector('svg');
  const clases: string[] = [];

  if (svg?.className.baseVal) clases.push(svg.className.baseVal);
  for (const hijo of svg?.querySelectorAll('g, path, ellipse, circle') ?? []) {
    const clase = hijo.getAttribute('class');
    if (clase) clases.push(clase);
  }

  return clases
    .join(' ')
    .split(/\s+/)
    .filter((c) => c.startsWith('animate-'));
}

/** Todas las clases del dibujo, para lo que no es una animación: poses y opacidad. */
function todasLasClases(estado: EstadoMascota, especie?: Especie, atuendo?: Atuendo): string {
  const { container } = render(<Mascota estado={estado} especie={especie} atuendo={atuendo} />);
  return container.innerHTML;
}

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

describe('Milo se mueve', () => {
  it('quieto respira, parpadea, colea y mueve las alas', () => {
    const animaciones = partesAnimadas('neutral');
    expect(animaciones).toContain('animate-respirar');
    expect(animaciones).toContain('animate-parpadeo');
    expect(animaciones).toContain('animate-colear');
    // Las dos alas, no una.
    expect(animaciones.filter((a) => a === 'animate-ala-calma')).toHaveLength(2);
  });

  it('celebrando aletea, y aletear no es lo mismo que saludar', () => {
    const celebra = partesAnimadas('celebrando');
    expect(celebra).toContain('animate-saltito');
    expect(celebra.filter((a) => a === 'animate-aletear')).toHaveLength(2);
    expect(celebra).not.toContain('animate-saludar');
  });

  it('animando saluda con el ala, más amplio y más lento', () => {
    const anima = partesAnimadas('animando');
    expect(anima.filter((a) => a === 'animate-saludar')).toHaveLength(2);
    expect(anima).not.toContain('animate-aletear');
  });

  it('escuchando se queda quieto de alas: está atento, no de fiesta', () => {
    const escucha = partesAnimadas('escuchando');
    expect(escucha).not.toContain('animate-aletear');
    expect(escucha).not.toContain('animate-saludar');
    expect(escucha).not.toContain('animate-ala-calma');
    // Pero sigue vivo: late y parpadea.
    expect(escucha).toContain('animate-latido');
  });

  it('pensando cierra los ojos y para del todo', () => {
    const piensa = partesAnimadas('pensando');
    expect(piensa).not.toContain('animate-parpadeo');
    expect(piensa).not.toContain('animate-colear');
  });

  it('ningún estado deja a Milo completamente inmóvil salvo pensando', () => {
    for (const estado of TODOS) {
      const animaciones = partesAnimadas(estado);
      if (estado === 'pensando') {
        // El único que puede estar parado, y tiene que estarlo del todo.
        expect(animaciones, 'pensando debería estar quieto').toHaveLength(0);
      } else {
        expect(animaciones.length, `el estado ${estado} no mueve nada`).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * Los estados nuevos son opcionales: nadie los usa todavía. La prueba que
 * importa de verdad no es que cada uno tenga su animación, sino que cada uno
 * tenga la SUYA. Dos estados que se mueven igual son un estado con dos nombres.
 */
describe('Milo reacciona distinto a cada cosa', () => {
  it('triste se hunde y parpadea despacio, pero sigue respirando', () => {
    const triste = partesAnimadas('triste');
    expect(triste).toContain('animate-desanimo');
    expect(triste).toContain('animate-parpadeo-lento');
    expect(triste).not.toContain('animate-parpadeo');
    // Las alas caen, no se quedan en el vaivén de estar tranquilo.
    expect(triste.filter((a) => a === 'animate-ala-baja')).toHaveLength(2);
    expect(triste).not.toContain('animate-ala-calma');
    // Fallar es un «uy», no un castigo: no se derrumba ni deja de respirar.
    expect(triste).toContain('animate-respirar');
  });

  it('sorprendido da un respingo y abre más los ojos', () => {
    const sorprendido = partesAnimadas('sorprendido');
    expect(sorprendido).toContain('animate-respingo');
    // La escala vive en su propia capa, separada del parpadeo: una pose con
    // transición y un ciclo infinito no caben en el mismo elemento.
    expect(todasLasClases('sorprendido')).toContain('scale-[1.14]');
    expect(todasLasClases('neutral')).not.toContain('scale-[1.14]');
    // El respingo es un gesto suelto; el resto de Milo sigue a lo suyo.
    expect(sorprendido).toContain('animate-respirar');
    expect(sorprendido).toContain('animate-parpadeo');
  });

  it('orgulloso presume con un ala en jarras y la otra en su vaivén', () => {
    const orgulloso = partesAnimadas('orgulloso');
    expect(orgulloso).toContain('animate-pavoneo');
    // Solo la de atrás sigue el vaivén: la cercana se queda en la pose.
    expect(orgulloso.filter((a) => a === 'animate-ala-calma')).toHaveLength(1);
    expect(todasLasClases('orgulloso')).toContain('rotate-[32deg]');
  });

  it('durmiendo respira más hondo y más lento, y se queda quieto de lo demás', () => {
    const duerme = partesAnimadas('durmiendo');
    expect(duerme).toContain('animate-dormir');
    // Dormir sustituye al aliento normal, no se suma a él.
    expect(duerme).not.toContain('animate-respirar');
    expect(duerme).not.toContain('animate-parpadeo');
    expect(duerme).not.toContain('animate-parpadeo-lento');
    expect(duerme).not.toContain('animate-colear');
  });

  it('los cuatro estados nuevos se mueven cada uno a su manera', () => {
    const gestos = ['animate-desanimo', 'animate-respingo', 'animate-pavoneo', 'animate-dormir'];
    const nuevos: EstadoMascota[] = ['triste', 'sorprendido', 'orgulloso', 'durmiendo'];

    nuevos.forEach((estado, i) => {
      const animaciones = partesAnimadas(estado);
      for (const gesto of gestos) {
        if (gesto === gestos[i]) {
          expect(animaciones, `${estado} debería tener ${gesto}`).toContain(gesto);
        } else {
          expect(animaciones, `${estado} no debería tener ${gesto}`).not.toContain(gesto);
        }
      }
    });
  });

  it('añadir estados no cambia cómo se ve quieto', () => {
    // Neutral es el que usan todas las pantallas que ya existen: si algún
    // estado nuevo se colara aquí, se notaría en toda la aplicación.
    const neutral = partesAnimadas('neutral');
    for (const gesto of [
      'animate-desanimo',
      'animate-respingo',
      'animate-pavoneo',
      'animate-dormir',
      'animate-ala-baja',
      'animate-parpadeo-lento',
    ]) {
      expect(neutral).not.toContain(gesto);
    }
  });
});

/**
 * La fluidez.
 *
 * Antes, cualquier cambio de estado reiniciaba todo el dibujo y la respiración
 * se cortaba a media inspiración. Ahora el aliento, el ladeo de la cabeza y la
 * mirada viven en capas propias que no cambian de clase al cambiar de estado,
 * así que el navegador no las reinicia. Esto no se ve en una captura, solo al
 * cambiar de estado en vivo, por eso se comprueba aquí.
 */
describe('Milo no se corta al cambiar de estado', () => {
  const despiertos = TODOS.filter((e) => e !== 'pensando' && e !== 'durmiendo');

  it('el aliento es la misma clase en todos los estados despiertos', () => {
    for (const estado of despiertos) {
      expect(partesAnimadas(estado), `${estado} debería respirar igual`).toContain(
        'animate-respirar',
      );
    }
  });

  it('la cabeza se ladea y la mirada se mueve en cualquier estado menos pensando', () => {
    for (const estado of TODOS) {
      const animaciones = partesAnimadas(estado);
      if (estado === 'pensando') {
        expect(animaciones).not.toContain('animate-inclinar-cabeza');
        expect(animaciones).not.toContain('animate-mirada');
        continue;
      }
      expect(animaciones, `${estado} debería ladear la cabeza`).toContain(
        'animate-inclinar-cabeza',
      );
      // Durmiendo tiene los ojos cerrados: ahí no hay mirada que mover.
      if (estado !== 'durmiendo') {
        expect(animaciones, `${estado} debería mover la mirada`).toContain('animate-mirada');
      }
    }
  });

  it('las partes que cambian de pose lo hacen con transición, no de golpe', () => {
    // Las alas pasan de animadas a una pose fija según el estado. Sin la
    // transición ese cambio es un salto, que es justo lo que se quería quitar.
    for (const estado of TODOS) {
      expect(todasLasClases(estado), `${estado} sin transición en las alas`).toContain(
        'transition-transform',
      );
    }
  });

  it('los ojos y el pico se cruzan en opacidad en vez de desmontarse', () => {
    // Si se sustituyera un pico por otro, la mirada y el parpadeo arrancarían
    // de cero cada vez que Milo abre la boca.
    for (const estado of ['neutral', 'celebrando', 'pensando', 'durmiendo'] as EstadoMascota[]) {
      const marcado = todasLasClases(estado);
      expect(marcado, `${estado} sin cruce de opacidad`).toContain('transition-opacity');
      // Las dos versiones del pico están siempre puestas, una de ellas apagada.
      expect(marcado).toContain('M54 50 L66 50 L60 58 Z');
      expect(marcado).toContain('M54 52 L66 52 L60 62 Z');
    }
  });
});

const ESPECIES: Especie[] = ['PET_MILO', 'PET_GATO', 'PET_PERRO', 'PET_BUHO', 'PET_ZORRO'];
const ATUENDOS: Atuendo[] = ['OUTFIT_GORRO', 'OUTFIT_BUFANDA', 'OUTFIT_GAFAS', 'OUTFIT_CORONA'];

/**
 * Cinco animales, un solo esqueleto.
 *
 * El riesgo de tener varias especies no es que una se vea fea: es que una se
 * quede a medio animar. Si las formas y el movimiento no estuvieran separados,
 * bastaría con olvidar una clase en el zorro para que solo el zorro dejara de
 * respirar, y eso no lo detecta ninguna prueba que mire a Milo.
 */
describe('cada especie es otro animal', () => {
  it('sin decir nada sale Milo, exactamente igual que antes', () => {
    for (const estado of TODOS) {
      expect(todasLasClases(estado), `${estado} cambió al no pasar especie`).toBe(
        todasLasClases(estado, 'PET_MILO'),
      );
    }
    // Y sigue siendo el pájaro de siempre: copete, cuerpo índigo y pico.
    const milo = todasLasClases('neutral');
    expect(milo).toContain('M52 32 Q58 18 66 30 Q60 26 52 32 Z');
    expect(milo).toContain('fill-marca-600');
    expect(milo).toContain('M54 50 L66 50 L60 58 Z');
  });

  it('las cinco se pintan distinto, no es la misma silueta repintada', () => {
    const dibujos = ESPECIES.map((especie) => todasLasClases('neutral', especie));
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

  it('las cinco se mueven exactamente igual en los once estados', () => {
    // La comparación es contra Milo a propósito: es el que llevan vigilando
    // todas las pruebas de arriba, así que heredar su movimiento es heredar
    // también todo lo que ya se comprobó de él.
    for (const estado of TODOS) {
      const referencia = partesAnimadas(estado, 'PET_MILO').sort();
      for (const especie of ESPECIES) {
        expect(
          partesAnimadas(estado, especie).sort(),
          `${especie} se mueve distinto a Milo en ${estado}`,
        ).toEqual(referencia);
      }
    }
  });

  it('ninguna especie se queda congelada salvo pensando', () => {
    for (const especie of ESPECIES) {
      for (const estado of TODOS) {
        const animaciones = partesAnimadas(estado, especie);
        if (estado === 'pensando') {
          expect(animaciones, `${especie} debería estar quieto al pensar`).toHaveLength(0);
        } else {
          expect(animaciones.length, `${especie} no mueve nada en ${estado}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('todas cruzan la boca en opacidad en vez de sustituirla', () => {
    // Cada animal tiene su hocico, pero el truco del cruce es del esqueleto:
    // si una especie se saltara la capa apagada, esa boca aparecería de golpe.
    for (const especie of ESPECIES) {
      const cerrada = todasLasClases('neutral', especie);
      const abierta = todasLasClases('animando', especie);
      expect(cerrada, `${especie} sin cruce de opacidad`).toContain('transition-opacity');
      // La boca abierta ya está montada aunque no se vea, y al revés.
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
      const cabeza = container.querySelector('.animate-inclinar-cabeza');
      expect(cabeza?.querySelector('g[aria-hidden="true"]')).toBeNull();
    }
  });

  it('los cuatro atuendos se dibujan sobre las cinco especies', () => {
    for (const especie of ESPECIES) {
      const desnudo = todasLasClases('neutral', especie);
      for (const atuendo of ATUENDOS) {
        const vestido = todasLasClases('neutral', especie, atuendo);
        expect(vestido, `${atuendo} no se dibuja en ${especie}`).not.toBe(desnudo);
        expect(vestido.length).toBeGreaterThan(desnudo.length);
      }
    }
  });

  it('los cuatro atuendos son cuatro prendas distintas', () => {
    const prendas = ATUENDOS.map((atuendo) => todasLasClases('neutral', 'PET_GATO', atuendo));
    expect(new Set(prendas).size).toBe(ATUENDOS.length);
  });

  it('la ropa cuelga de la cabeza, así que se ladea con ella', () => {
    for (const especie of ESPECIES) {
      for (const atuendo of ATUENDOS) {
        const { container } = render(<Mascota especie={especie} atuendo={atuendo} />);
        const cabeza = container.querySelector('.animate-inclinar-cabeza');
        expect(
          cabeza?.querySelector('g[aria-hidden="true"]'),
          `${atuendo} fuera de la capa que se ladea en ${especie}`,
        ).not.toBeNull();
      }
    }
  });

  it('vestirse no le quita ni una animación a ningún estado', () => {
    for (const estado of TODOS) {
      const desnudo = partesAnimadas(estado, 'PET_ZORRO').sort();
      for (const atuendo of ATUENDOS) {
        expect(
          partesAnimadas(estado, 'PET_ZORRO', atuendo).sort(),
          `${atuendo} altera el movimiento en ${estado}`,
        ).toEqual(desnudo);
      }
    }
  });

  it('las gafas caen sobre los ojos en las cinco, que están siempre en el mismo sitio', () => {
    for (const especie of ESPECIES) {
      const marcado = todasLasClases('neutral', especie, 'OUTFIT_GAFAS');
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
      raiz.querySelector('.animate-inclinar-cabeza g[aria-hidden="true"] path')?.getAttribute('d');
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
 * durante minutos, así que es donde cualquier atajo se nota. Dos cosas se
 * vigilan aquí y ninguna se ve en una captura fija:
 *
 * - Que la boca se DEFORME en vez de cambiarse por otra. Cruzar dos bocas fijas
 *   a golpes se lee como un pico que se abre y se cierra, y eso es una
 *   marioneta, no alguien hablando.
 * - Que el alto, el ancho y la cabeza vayan a tres ritmos distintos. Si los tres
 *   cayeran en el mismo ciclo, la cara repetiría la misma forma siete veces por
 *   segundo, que es exactamente el metrónomo que se quiere evitar.
 */
describe('Milo habla', () => {
  const CAPAS_HABLA = ['animate-hablar', 'animate-hablar-ancho', 'animate-hablar-cabeza'];

  it('mueve la boca, y la mueve en dos ejes a la vez', () => {
    const habla = partesAnimadas('hablando');
    expect(habla).toContain('animate-hablar');
    expect(habla).toContain('animate-hablar-ancho');
  });

  it('las tres capas del habla son tres animaciones distintas, no una repetida', () => {
    // Tres clases distintas es lo que garantiza tres duraciones distintas: si
    // alguien las unificara «para simplificar», la cara volvería a repetirse.
    expect(new Set(CAPAS_HABLA).size).toBe(3);
    const habla = partesAnimadas('hablando');
    for (const capa of CAPAS_HABLA) {
      expect(habla, `hablando debería tener ${capa}`).toContain(capa);
    }
  });

  it('la cabeza acompaña, además de seguir ladeándose sola', () => {
    const habla = partesAnimadas('hablando');
    expect(habla).toContain('animate-hablar-cabeza');
    // Las dos a la vez y en capas distintas: el ladeo largo no se pierde por
    // hablar, y el acompañamiento no lo sustituye.
    expect(habla).toContain('animate-inclinar-cabeza');
  });

  it('hablar no congela lo demás: parpadea, mira, respira y colea', () => {
    const habla = partesAnimadas('hablando');
    expect(habla).toContain('animate-parpadeo');
    expect(habla).toContain('animate-mirada');
    expect(habla).toContain('animate-respirar');
    expect(habla).toContain('animate-colear');
    expect(habla.filter((a) => a === 'animate-ala-calma')).toHaveLength(2);
  });

  it('las cinco especies hablan, no solo Milo', () => {
    for (const especie of ESPECIES) {
      const habla = partesAnimadas('hablando', especie);
      for (const capa of CAPAS_HABLA) {
        expect(habla, `${especie} no mueve la boca al hablar (${capa})`).toContain(capa);
      }
    }
  });

  it('la boca se deforma, no se cambia por otra', () => {
    // La boca abierta sigue montada y la cerrada apagada, igual que al celebrar:
    // lo que se anima es la forma de la primera, no el relevo entre las dos.
    for (const especie of ESPECIES) {
      const { container } = render(<Mascota estado="hablando" especie={especie} />);
      const mandibula = container.querySelector('.animate-hablar');
      expect(mandibula, `${especie} sin capa de mandíbula`).not.toBeNull();
      expect(
        mandibula?.querySelector('.animate-hablar-ancho'),
        `${especie} mueve la boca en un solo eje`,
      ).not.toBeNull();
      expect(container.innerHTML).toContain('transition-opacity');
    }
  });

  it('cada especie abre la boca por su propia bisagra', () => {
    // Sin ese punto, la boca no se abre: se desplaza por la cara. Lo declara la
    // especie porque un pico gira donde se juntan sus dos mitades y un hocico
    // donde se junta con el morro.
    for (const especie of ESPECIES) {
      const { container } = render(<Mascota estado="hablando" especie={especie} />);
      const mandibula = container.querySelector<SVGGElement>('.animate-hablar');
      expect(mandibula?.style.transformOrigin, `${especie} abre la boca por donde no es`).toBe(
        CATALOGO[especie].origenBoca,
      );
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
      const mandibula = container.querySelector('.animate-hablar');
      expect(container.innerHTML, `${especie} perdió el morro`).toContain(morro);
      expect(mandibula?.innerHTML ?? '', `${especie} encoge el morro al hablar`).not.toContain(
        morro,
      );
    }
  });

  it('hablando no es celebrando, aunque los dos abran la boca', () => {
    const habla = partesAnimadas('hablando');
    const celebra = partesAnimadas('celebrando');
    // Celebrar abre la boca y la deja abierta; hablar la mueve.
    for (const capa of CAPAS_HABLA) {
      expect(celebra, `celebrando no debería tener ${capa}`).not.toContain(capa);
    }
    // Y hablar no es una fiesta: ni salta, ni aletea, ni suelta estrellitas.
    expect(habla).not.toContain('animate-saltito');
    expect(habla).not.toContain('animate-aletear');
    expect(todasLasClases('hablando')).not.toContain('animate-destello');
  });

  it('ningún estado anterior mueve la boca por accidente', () => {
    for (const estado of TODOS) {
      if (estado === 'hablando') continue;
      const animaciones = partesAnimadas(estado);
      for (const capa of CAPAS_HABLA) {
        expect(animaciones, `${estado} mueve la boca sin hablar (${capa})`).not.toContain(capa);
      }
    }
  });

  it('las cinco hablan igual, y vestirse no les quita el habla', () => {
    const referencia = partesAnimadas('hablando', 'PET_MILO').sort();
    for (const especie of ESPECIES) {
      expect(
        partesAnimadas('hablando', especie).sort(),
        `${especie} habla distinto a Milo`,
      ).toEqual(referencia);
      for (const atuendo of ATUENDOS) {
        expect(
          partesAnimadas('hablando', especie, atuendo).sort(),
          `${atuendo} altera el habla en ${especie}`,
        ).toEqual(referencia);
      }
    }
  });
});

/**
 * La intensidad.
 *
 * Es la puerta por la que entrará el volumen de la voz cuando haya audio. Lo
 * que se comprueba es que siga siendo una puerta: sin valor, la boca hace su
 * ciclo de siempre, porque una boca que espera datos no puede quedarse quieta.
 */
describe('la boca se puede acompasar con la voz', () => {
  function apertura(estado: EstadoMascota, intensidad?: number): string | null {
    const { container } = render(<Mascota estado={estado} intensidad={intensidad} />);
    const mandibula = container.querySelector<SVGGElement>('.animate-hablar');
    const declarada = mandibula?.style.getPropertyValue('--boca-apertura') ?? '';
    return declarada === '' ? null : declarada;
  }

  it('sin intensidad no se declara nada: sale el ciclo normal', () => {
    expect(apertura('hablando')).toBeNull();
    // Y la boca se sigue moviendo, que es lo que importa de ese caso.
    expect(partesAnimadas('hablando')).toContain('animate-hablar');
  });

  it('con intensidad, la boca abre tanto como suene la voz', () => {
    const baja = Number(apertura('hablando', 0.2));
    const alta = Number(apertura('hablando', 0.9));
    expect(alta).toBeGreaterThan(baja);
    expect(alta).toBeLessThanOrEqual(1);
  });

  it('el silencio no deja la mandíbula clavada', () => {
    // Un micrófono no lee cero a media palabra: una boca parada del todo no se
    // lee como silencio, se lee como que la aplicación se ha colgado.
    const callado = Number(apertura('hablando', 0));
    expect(callado).toBeGreaterThan(0);
    expect(callado).toBeLessThan(Number(apertura('hablando', 1)));
  });

  it('los valores imposibles no rompen la cara', () => {
    // Un medidor de volumen mal escalado es cuestión de tiempo.
    expect(apertura('hablando', 5)).toBe(apertura('hablando', 1));
    expect(apertura('hablando', -3)).toBe(apertura('hablando', 0));
  });

  it('fuera de hablando la intensidad no pinta nada', () => {
    for (const estado of TODOS) {
      if (estado === 'hablando') continue;
      expect(apertura(estado, 1), `${estado} hace caso a la intensidad`).toBeNull();
    }
  });

  it('la intensidad no añade poses, solo cuánto abre', () => {
    const { container } = render(<Mascota estado="hablando" intensidad={0.4} />);
    const clases = container.querySelector('.animate-hablar')?.getAttribute('class') ?? '';
    // Ni una escala fija encima: si la hubiera, al cortarse la animación con
    // `prefers-reduced-motion` la boca se quedaría deformada en vez de abierta,
    // que es como se queda al celebrar y es lo que se espera ver.
    expect(clases.trim()).toBe('animate-hablar');
  });
});
