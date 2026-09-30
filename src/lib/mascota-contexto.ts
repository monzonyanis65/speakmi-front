import { createContext, useContext } from 'react';
import type { Atuendo, Especie } from '@/components/mascotas';

/**
 * Cómo se llama cada animal.
 *
 * Separado de su dibujo porque esto lo usan los textos, no el SVG: «Conversar
 * con Nala», no «Conversar con Milo» mientras se mira a una gata. Un nombre
 * fijo en un texto es de las cosas que más cantan cuando la imagen cambió.
 *
 * Son los mismos nombres que el catálogo de la tienda, en `content/tienda.json`
 * del servidor. Al principio no lo eran, y se compraba a «Nala» para que la
 * aplicación la llamara «Kira» en todas partes. Si se cambian allí, hay que
 * cambiarlos aquí: manda el catálogo, porque es el nombre con el que se compró.
 */
export const NOMBRE_ESPECIE: Record<Especie, string> = {
  PET_MILO: 'Milo',
  PET_GATO: 'Nala',
  PET_PERRO: 'Tuco',
  PET_BUHO: 'Ulises',
  PET_ZORRO: 'Rufo',

  /*
    Los cuatro del reparto. Estos NO están en `content/tienda.json`, y no es un
    olvido: no se compran, así que no hay nada que comprar con su nombre. Aquí
    manda este archivo y no el catálogo del servidor, al revés que los cinco de
    arriba. Quien los busque allí no los va a encontrar.
  */
  CHAR_ZOE: 'Zoe',
  CHAR_LIAM: 'Liam',
  CHAR_BARNABY: 'Barnaby',
  CHAR_BEEPER: 'Beeper',
};

export interface MascotaEquipada {
  especie: Especie;
  atuendo: Atuendo | null;
}

export const MASCOTA_POR_DEFECTO: MascotaEquipada = { especie: 'PET_MILO', atuendo: null };

/*
  El contexto vive aquí, separado del proveedor, por una razón de herramienta:
  un archivo que exporta un componente y además otras cosas rompe la recarga en
  caliente de React, y trabajar sin ella se nota en cada guardado.
*/
export const ContextoMascota = createContext<MascotaEquipada>(MASCOTA_POR_DEFECTO);

/** Qué mascota lleva puesta esta persona. Sin proveedor, la de serie. */
export function useMascotaEquipada(): MascotaEquipada {
  return useContext(ContextoMascota);
}

/** Cómo se llama la que lleva puesta, para poder nombrarla en los textos. */
export function useNombreMascota(): string {
  return NOMBRE_ESPECIE[useMascotaEquipada().especie];
}
