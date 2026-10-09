import { describe, expect, it } from 'vitest';
import { FICHAS } from './tipos';
import { ICONOS } from '@/components/iconos';

/**
 * Los iconos los dibuja la aplicación, no el sistema operativo.
 *
 * Es la regla que está escrita en `components/iconos/index.tsx` y que sigue
 * todo lo demás: un emoji es plano en Android, brillante y con perspectiva en
 * iPhone, y cambia de tamaño y de peso sin que aquí se pueda hacer nada. Al
 * lado de nueve personajes dibujados a mano se lee como pegado de otro sitio.
 *
 * La lista de juegos era el único rincón donde no se había aplicado: sus quince
 * fichas llevaban un emoji cada una. No se ve mirando el código —es un carácter
 * más dentro de una cadena— y por eso sobrevivió a que el resto de la
 * aplicación se pasara a iconos propios.
 *
 * Esto no comprueba que el dibujo sea bonito, que no se puede medir. Comprueba
 * las dos cosas que sí: que el icono exista de verdad en el catálogo, y que
 * nadie vuelva a poner un emoji ahí.
 */

/** Cualquier cosa fuera del alfabeto latino básico: emojis, símbolos, banderas. */
const NO_ES_UNA_LETRA = /[^ -~]/u;

describe('los iconos de los juegos', () => {
  it('ninguno es un emoji', () => {
    const conEmoji = Object.entries(FICHAS)
      .filter(([, ficha]) => NO_ES_UNA_LETRA.test(ficha.icono))
      .map(([codigo, ficha]) => `${codigo}: ${ficha.icono}`);

    expect(conEmoji, 'hay fichas con emoji en vez de icono dibujado').toEqual([]);
  });

  it('todos apuntan a un icono que existe', () => {
    const rotos = Object.entries(FICHAS)
      .filter(([, ficha]) => !(ficha.icono in ICONOS))
      .map(([codigo, ficha]) => `${codigo} → «${ficha.icono}»`);

    // Un nombre que no está en el catálogo no da error de compilación si algún
    // día se afloja el tipo, pero en pantalla deja un hueco donde iba el icono.
    expect(rotos, 'hay fichas apuntando a un icono que no existe').toEqual([]);
  });

  it('hay quince juegos, que es lo que hay', () => {
    // Si este número cambia, alguien añadió o quitó un juego y conviene que la
    // prueba de arriba se vuelva a mirar con el nuevo.
    expect(Object.keys(FICHAS)).toHaveLength(15);
  });
});
