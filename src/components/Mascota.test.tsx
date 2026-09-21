import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Mascota, type Atuendo, type Especie, type EstadoMascota } from './Mascota';

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

  it('las cinco se mueven exactamente igual en los diez estados', () => {
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
