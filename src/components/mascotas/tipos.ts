import { type ReactNode } from 'react';

/**
 * El contrato entre «qué animal es» y «cómo se mueve».
 *
 * `Mascota.tsx` es el esqueleto: las capas, los estados y las animaciones viven
 * ahí y solo ahí. Cada especie es una bolsa de formas quietas que se enchufan en
 * los huecos de ese esqueleto. Por eso aquí no hay ni una clase `animate-`: si
 * una especie pudiera animar algo, añadir un animal sexto podría romper el
 * movimiento de los cinco anteriores, que es justo lo que se quiere evitar.
 */

/** Las cinco mascotas. El identificador viaja tal cual al servidor. */
export type Especie = 'PET_MILO' | 'PET_GATO' | 'PET_PERRO' | 'PET_BUHO' | 'PET_ZORRO';

/** Lo que se puede llevar puesto. Ninguno es válido: la mayoría va sin nada. */
export type Atuendo = 'OUTFIT_GORRO' | 'OUTFIT_BUFANDA' | 'OUTFIT_GAFAS' | 'OUTFIT_CORONA';

/**
 * Los cuatro puntos del lienzo de 120x120 donde se cuelga la ropa.
 *
 * Existen porque un gorro dibujado a medida para el pájaro se ve torcido en el
 * búho, que tiene la cabeza más ancha. En vez de dibujar veinte atuendos (cuatro
 * por cinco animales), cada atuendo se dibuja una vez en función de estas cuatro
 * medidas y cada especie declara las suyas.
 */
export interface AnclajesEspecie {
  /** Y del punto más alto del cráneo, sin contar orejas ni copete. */
  coronilla: number;
  /** Medio ancho del cráneo: de cuánto tiene que ser el ala del gorro. */
  anchoCabeza: number;
  /** Y de la línea de los ojos, que es donde se apoyan las gafas. */
  ojos: number;
  /** Y del cuello, donde se ata la bufanda y donde gira la cabeza al ladearse. */
  cuello: number;
}

/**
 * Las formas de un animal, cada una en el hueco que le toca del esqueleto.
 *
 * El orden de los campos es el orden de pintado, y no es casual: las orejas van
 * antes que la cabeza para que asomen por detrás, y la boca después de los ojos
 * porque en los hocicos largos se solapan.
 */
export interface PiezasEspecie {
  /** La cola. Se dibuja suelta: el esqueleto la envuelve para balancearla. */
  cola: ReactNode;
  /** Dónde pivota la cola, en `transform-origin`. Una cola larga gira más lejos. */
  origenCola: string;
  /** Tronco y barriga, lo que respira. */
  cuerpo: ReactNode;
  /** El miembro del lado de allá: ala, pata o brazo, más pequeño y más oscuro. */
  alaLejana: ReactNode;
  /** El del lado de acá, el que saluda y el que se pone en jarras. */
  alaCercana: ReactNode;
  /** Orejas, copete o penachos. Van detrás del cráneo. */
  orejas: ReactNode;
  /** Cráneo y lo que se pinta debajo de los ojos: mejillas, discos, antifaz. */
  cabeza: ReactNode;
  /**
   * La nariz o el morro: lo de la cara que NO se mueve al abrir la boca.
   *
   * Va aparte porque al hablar el esqueleto encoge la boca abierta, y una nariz
   * dibujada dentro de ella se encogería con la mandíbula. El pico de Milo y el
   * del búho no tienen nada quieto, así que no lo declaran.
   */
  hocico?: ReactNode;
  /** La boca en reposo y la boca hablando: el esqueleto las cruza en opacidad. */
  bocaCerrada: ReactNode;
  bocaAbierta: ReactNode;
  /**
   * Dónde tiene la bisagra la mandíbula, en `transform-origin`.
   *
   * Es el punto por el que la boca abierta se encoge hasta parecer cerrada. Lo
   * declara cada especie porque un pico gira donde se juntan sus dos mitades y
   * un hocico donde se junta con el morro, y errar ese punto hace que al hablar
   * la boca se desplace por la cara en vez de abrirse.
   */
  origenBoca: string;
  /** Patas. Fuera de la cabeza, no se ladean. */
  patas: ReactNode;
}

/** Un animal completo: cómo se llama, dónde lleva la ropa y de qué está hecho. */
export interface DefinicionEspecie extends PiezasEspecie {
  /** Lo que lee un lector de pantalla. Cada animal el suyo, nunca «Milo». */
  etiqueta: string;
  anclajes: AnclajesEspecie;
}
