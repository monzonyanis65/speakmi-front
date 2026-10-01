import { describe, expect, it } from 'vitest';
import { mascotaDe } from './mascota-cartera';
import { MASCOTA_POR_DEFECTO } from './mascota-contexto';

/**
 * Que una respuesta rara de la cartera no deje la aplicación en blanco.
 *
 *
 * POR QUÉ EXISTE
 *
 * El proveedor de la mascota envuelve TODA la app: lo que falle ahí no rompe el
 * dibujo del bicho, rompe la pantalla entera. Y leía el campo de la mascota
 * colgando de «equipped» sin comprobar antes que «equipped» viniera, con un
 * valor por defecto detrás que no sirve para eso: protege de que falte la
 * mascota, no de que falte el objeto que la contiene.
 *
 * O sea que una respuesta sin ese campo no dejaba a alguien sin mascota: dejaba
 * la app en blanco con un «Cannot read properties of undefined» que no dice de
 * dónde sale. Basta un servidor sin desplegar, una respuesta a medias, o un
 * error devuelto con forma de éxito. Las tres pasan en producción un martes.
 *
 *
 * POR QUÉ SE PRUEBA LA FUNCIÓN Y NO EL COMPONENTE
 *
 * Lo intenté primero montando el proveedor, y la prueba pasaba en verde con el
 * fallo delante: cuando un render revienta, React descarta ese intento y deja
 * pintado el árbol anterior, así que las aserciones miraban el estado bueno de
 * ANTES de que llegara la respuesta. El TypeError salía por consola y las
 * cuatro pruebas seguían verdes.
 *
 * Sacar la decisión a una función es lo que la hace comprobable. Si vuelve a
 * meterse dentro del componente, esto deja de valer.
 */

describe('qué mascota se lleva puesta', () => {
  it('con una respuesta normal, la suya', () => {
    expect(mascotaDe({ equipped: { mascota: 'PET_GATO', atuendo: 'OUTFIT_GORRO' } })).toEqual({
      especie: 'PET_GATO',
      atuendo: 'OUTFIT_GORRO',
    });
  });

  it('sin «equipped», la de siempre y sin reventar', () => {
    // El caso que tiraba la app entera.
    expect(mascotaDe({} as Parameters<typeof mascotaDe>[0])).toEqual(MASCOTA_POR_DEFECTO);
  });

  it('con «equipped» a null tampoco revienta', () => {
    expect(mascotaDe({ equipped: null })).toEqual(MASCOTA_POR_DEFECTO);
  });

  it('con «equipped» a medias, rellena lo que falte', () => {
    expect(mascotaDe({ equipped: {} })).toEqual(MASCOTA_POR_DEFECTO);
    expect(mascotaDe({ equipped: { mascota: 'PET_ZORRO' } })).toEqual({
      especie: 'PET_ZORRO',
      atuendo: null,
    });
  });

  it('sin respuesta todavía, la de siempre', () => {
    // Mientras la petición va de camino hay que pintar algo.
    expect(mascotaDe(undefined)).toEqual(MASCOTA_POR_DEFECTO);
  });
});
