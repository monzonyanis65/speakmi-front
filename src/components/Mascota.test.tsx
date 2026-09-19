import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Mascota, type EstadoMascota } from './Mascota';

/**
 * Milo tiene que moverse siempre, y moverse distinto según lo que hace.
 *
 * Esta prueba existe por un motivo concreto: durante mucho tiempo el ala era
 * una elipse quieta que solo se levantaba al celebrar, y la cola no se movía
 * nunca. Un pájaro con partes congeladas se lee como un icono, no como un
 * personaje, y eso no se nota en ninguna prueba de las normales.
 */

function partesAnimadas(estado: EstadoMascota): string[] {
  const { container } = render(<Mascota estado={estado} />);
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
function todasLasClases(estado: EstadoMascota): string {
  const { container } = render(<Mascota estado={estado} />);
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
