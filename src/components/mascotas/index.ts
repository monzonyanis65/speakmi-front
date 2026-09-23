import { BUHO } from './buho';
import { GATO } from './gato';
import { MILO } from './milo';
import { PERRO } from './perro';
import { ZORRO } from './zorro';
import { type Atuendo, type DefinicionEspecie, type Especie } from './tipos';

export { CapaAtuendo } from './atuendos';
export type {
  AnclajesEspecie,
  Atuendo,
  BocasEspecie,
  CejasEspecie,
  DefinicionEspecie,
  Especie,
  PiezasEspecie,
  Visema,
} from './tipos';

/**
 * El catálogo. Es lo único que hay que tocar para añadir un animal sexto: el
 * esqueleto no sabe cuántas especies existen ni quiere saberlo.
 */
export const ESPECIES: Record<Especie, DefinicionEspecie> = {
  PET_MILO: MILO,
  PET_GATO: GATO,
  PET_PERRO: PERRO,
  PET_BUHO: BUHO,
  PET_ZORRO: ZORRO,
};

/** Para la etiqueta accesible: quien no ve el dibujo también lleva el gorro. */
export const NOMBRE_ATUENDO: Record<Atuendo, string> = {
  OUTFIT_GORRO: 'gorro',
  OUTFIT_BUFANDA: 'bufanda',
  OUTFIT_GAFAS: 'gafas de sol',
  OUTFIT_CORONA: 'corona',
};
