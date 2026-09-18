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
    const estados: EstadoMascota[] = ['neutral', 'feliz', 'celebrando', 'animando', 'escuchando'];
    for (const estado of estados) {
      expect(partesAnimadas(estado).length, `el estado ${estado} no mueve nada`).toBeGreaterThan(0);
    }
  });
});
