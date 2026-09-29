/**
 * El reparto: quién es cada uno de los cinco y cómo se lo toma.
 *
 * Esto es el guion, no la escena. Se lee entero, se discute y se comprueba sin
 * montar nada ni mirar ninguna pantalla, igual que `mascotas/coreografia.ts` es
 * la partitura y `Mascota.tsx` el instrumento. Si alguien quiere cambiar cómo
 * es Nala, tiene que poder hacerlo aquí sin abrir la aplicación.
 *
 *
 * POR QUÉ LOS NOMBRES NO SE ELIGEN AQUÍ
 *
 * Los cinco ya se llamaban así antes de tener carácter: los nombres viven en
 * `content/tienda.json` del servidor, porque son el nombre con el que se compra
 * la mascota, y de ahí los copia `NOMBRE_ESPECIE`. Rebautizarlos habría dejado
 * a alguien que pagó por «Nala» con una gata llamada otra cosa.
 *
 * Aquí se escriben otra vez a mano, en vez de importarlos, para que este archivo
 * se pueda leer de arriba abajo y se entienda de quién se habla. Que no se
 * separen de los de la tienda lo vigila una prueba, que es donde tiene que
 * vigilarse: un comentario que diga «acuérdate de cambiar los dos» no se lee el
 * día que hace falta.
 *
 *
 * QUÉ ES UN CARÁCTER Y QUÉ NO
 *
 * Cinco personajes simpáticos no son un reparto, son el mismo personaje cinco
 * veces con distinto pelo. Lo que los separa no son los adjetivos del comentario
 * sino la TABLA de abajo: qué cara pone cada uno cuando aciertas, y sobre todo
 * cuando fallas. Si dos filas de `animo` son iguales, esos dos personajes son
 * el mismo aunque el comentario diga cosas distintas.
 *
 * De ahí sale la regla que más se nota: NINGUNO se pone `triste` cuando fallas.
 * Compadecerse es una forma de decir «pobre», y eso convierte un ejercicio
 * fallado en un suspenso. Milo se pica, Nala ni se inmuta, Tuco se acerca a
 * mirar porque él tampoco lo sabía. Ninguno te consuela y ninguno te riñe.
 *
 * Por lo mismo no hay frases de acierto. La corrección del servidor ya escribe
 * ahí al lado lo que hay que leer; un personaje añadiendo «¡muy bien!» encima
 * es ruido y además es justo lo que el tutor tiene prohibido hacer.
 */

import { type EstadoMascota } from '@/components/mascotas/coreografia';
import { type Especie } from '@/components/mascotas';

/**
 * Los momentos en los que un personaje tiene algo que expresar.
 *
 * Los cuatro primeros son FORMAS DE ESTAR y dependen del reloj, no de lo que
 * pase: es la diferencia entre un dibujo pegado en una esquina y alguien que
 * está ahí. Los cinco siguientes son COSAS QUE PASAN.
 */
export type Momento =
  /** Ahí, sin nada que hacer. Es en el que más tiempo se le ve. */
  | 'reposo'
  /** Estás tocando o escribiendo. Se entera. */
  | 'atento'
  /** Llevas un rato sin hacer nada. */
  | 'espera'
  /** Llevas mucho rato. */
  | 'sopor'
  | 'acierto'
  /** Acertaste a medias: la idea estaba, la forma no del todo. */
  | 'casi'
  | 'fallo'
  /**
   * El acierto que COSTABA: varios seguidos, o uno de los difíciles.
   *
   * Son el mismo momento a propósito. Reaccionar igual a lo fácil y a lo difícil
   * hace que la reacción no signifique nada, así que hay dos niveles; pero
   * separar «racha» de «difícil» en dos filas distintas sería fingir un matiz
   * que nadie sabría escribir sin repetirse.
   */
  | 'racha'
  | 'final';

/** Los momentos en los que además dice algo. Tres, y son pocos a propósito. */
export type MomentoConVoz = 'entra' | 'racha' | 'final';

export interface Personaje {
  especie: Especie;
  /** El de la tienda. No se inventa aquí; ver la cabecera. */
  nombre: string;
  /** Quién es, en una línea. Para quien lee el archivo, no para la pantalla. */
  caracter: string;
  /**
   * Cuántos segundos aguanta sin que toques nada antes de aburrirse. El triple,
   * antes de dormirse.
   *
   * Es un número por personaje y no una constante global porque la impaciencia
   * es carácter: Rufo se duerme mientras los demás todavía esperan, y eso dice
   * más de él que cualquier frase que se le pudiera poner.
   */
  paciencia: number;
  /** Qué cara pone en cada momento. Aquí está el personaje de verdad. */
  animo: Record<Momento, EstadoMascota>;
  /** Lo que dice, cuando dice algo. Varias por momento, para que no cante. */
  dice: Record<MomentoConVoz, string[]>;
}

export const REPARTO: Record<Especie, Personaje> = {
  /*
    Milo compite contigo. Es el de serie, el que ya salía en todas las
    pantallas, así que es el que más sitio tiene para tener carácter sin que
    chirríe: lleva la cuenta, se pica cuando te sale bien y quiere la revancha.

    Cuando aciertas se SORPRENDE en vez de celebrar, que es lo que separa a un
    rival de un animador. Y cuando fallas saca pecho, porque esa se la sabía.
  */
  PET_MILO: {
    especie: 'PET_MILO',
    nombre: 'Milo',
    caracter: 'El que se pica. Va contando y quiere la revancha.',
    paciencia: 12,
    animo: {
      reposo: 'neutral',
      atento: 'escuchando',
      espera: 'pensando',
      sopor: 'durmiendo',
      acierto: 'sorprendido',
      casi: 'pensando',
      fallo: 'orgulloso',
      racha: 'animando',
      final: 'animando',
    },
    dice: {
      entra: ['Va, a ver quién falla primero.', 'Esta ya la hice yo. Antes que tú.'],
      racha: ['Vale, ya te vale.', 'Estoy contando, ¿eh?', 'Deja algo para los demás.'],
      final: ['Otra y te alcanzo.', 'Queda apuntado.'],
    },
  },

  /*
    Nala es la Lily del reparto: la que no se impresiona. Su gracia está en lo
    que NO hace, así que su columna es la más sosa de la tabla a propósito.

    En reposo va `orgulloso` —de pie, con el pecho fuera, mirándote—, y esa es
    toda la broma: no hace nada y aun así se le nota que va sobrada. Cuando
    aciertas pasa a `neutral`, o sea que se relaja: claro que has acertado.
    Cuando fallas, tampoco se inmuta. Es el único personaje que reacciona
    IGUAL a las dos cosas, y es lo que la hace ella.
  */
  PET_GATO: {
    especie: 'PET_GATO',
    nombre: 'Nala',
    caracter: 'La que va sobrada. No se impresiona por nada y habla poco.',
    paciencia: 18,
    animo: {
      reposo: 'orgulloso',
      /** No se inclina hacia ti como los otros: se queda donde está. */
      atento: 'neutral',
      espera: 'neutral',
      sopor: 'durmiendo',
      acierto: 'neutral',
      casi: 'pensando',
      fallo: 'neutral',
      racha: 'orgulloso',
      final: 'orgulloso',
    },
    dice: {
      entra: ['Empieza cuando quieras.', 'Yo te miro.'],
      racha: ['Ajá.', 'Esto ya lo sabías.'],
      final: ['Ya está.', 'Pues eso.'],
    },
  },

  /*
    Tuco es el que se equivoca más que tú, y es el que más falta hacía.

    Un reparto entero de gente que sabe inglés convierte cada ejercicio en un
    examen con público. Tuco lo deshace: él tampoco la tenía, así que cuando
    aciertas CELEBRA de verdad —es el único que celebra— y cuando fallas se
    acerca a leer la corrección contigo en vez de mirarte a ti.
  */
  PET_PERRO: {
    especie: 'PET_PERRO',
    nombre: 'Tuco',
    caracter: 'El que se equivoca más que tú. Va contigo, no por delante.',
    paciencia: 14,
    animo: {
      reposo: 'feliz',
      atento: 'escuchando',
      espera: 'pensando',
      sopor: 'durmiendo',
      acierto: 'celebrando',
      casi: 'sorprendido',
      /** Se acerca a mirar qué era. No te mira a ti. */
      fallo: 'escuchando',
      racha: 'celebrando',
      final: 'celebrando',
    },
    dice: {
      entra: ['Yo esta no me la sé, aviso.', 'Menos mal que contestas tú.'],
      racha: ['¿Cómo lo haces?', 'Yo llevo tres mal seguidas.'],
      final: ['Yo he aprendido más que tú, seguro.', 'Repetimos y me fijo mejor.'],
    },
  },

  /*
    Ulises sabe demasiado y no se lo calla. Su chiste es el matiz que nadie
    pidió, y por eso es el único que no se duerme: cuando los demás roncan, él
    sigue dándole vueltas a algo.

    Cuando aciertas se pone `orgulloso`, pero de la lengua, no de ti; y cuando
    fallas se queda `pensando`, que es él preparando la nota al pie.
  */
  PET_BUHO: {
    especie: 'PET_BUHO',
    nombre: 'Ulises',
    caracter: 'El que sabe de más. Añade el matiz que nadie pidió.',
    paciencia: 25,
    animo: {
      reposo: 'neutral',
      atento: 'escuchando',
      espera: 'pensando',
      /** El único que no se duerme. Sigue ahí, dándole vueltas. */
      sopor: 'pensando',
      acierto: 'orgulloso',
      casi: 'pensando',
      fallo: 'pensando',
      racha: 'feliz',
      final: 'feliz',
    },
    dice: {
      entra: [
        'Esto viene del latín, pero da igual.',
        'Hay un detalle al final que te va a gustar.',
      ],
      racha: ['Justo esa la falla todo el mundo.', 'Esa forma es más rara de lo que parece.'],
      final: ['Quedan matices. Siempre quedan.', 'Otro día te cuento lo de los irregulares.'],
    },
  },

  /*
    Rufo tiene prisa. Es el contrapeso del búho: a él la gramática le da igual,
    quiere acabar.

    Su carácter está casi entero en la `paciencia`: seis segundos. Se aburre
    mientras los demás siguen esperando y se duerme antes de que a Ulises se le
    ocurra bostezar, y eso se ve sin que diga nada. Cuando fallas se ESPABILA
    —por fin pasa algo—, que es lo contrario de compadecerse.
  */
  PET_ZORRO: {
    especie: 'PET_ZORRO',
    nombre: 'Rufo',
    caracter: 'El que tiene prisa. Se aburre el primero y se duerme el primero.',
    paciencia: 6,
    animo: {
      reposo: 'neutral',
      atento: 'escuchando',
      espera: 'durmiendo',
      sopor: 'durmiendo',
      acierto: 'feliz',
      casi: 'pensando',
      /** Se despierta: por fin pasa algo. */
      fallo: 'sorprendido',
      racha: 'animando',
      final: 'celebrando',
    },
    dice: {
      entra: ['Rápido, que tengo cosas.', 'Venga, esta es corta.'],
      racha: ['Así sí, sin pararte.', 'A este ritmo salimos pronto.'],
      final: ['Listo. ¿La siguiente?', 'Eso ha sido rápido.'],
    },
  },
};

/**
 * El orden del reparto, que es el orden de la tienda.
 *
 * Existe porque `Object.keys` de un `Record` no promete orden en el papel
 * —aunque en la práctica lo respete—, y aquí el orden decide QUIÉN sale en cada
 * lección. Una lista escrita a mano es la única forma de que el reparto de la
 * lección L5-U1-03 siga siendo el mismo dentro de un año.
 */
export const ORDEN: Especie[] = ['PET_MILO', 'PET_GATO', 'PET_PERRO', 'PET_BUHO', 'PET_ZORRO'];

/**
 * FNV-1a: el mismo revoltijo que usa `barajar.ts` del servidor y la horda.
 *
 * Hace falta que sea determinista y que reparta bien códigos que se parecen
 * mucho entre sí: `L5-U1-01`, `L5-U1-02`, `L5-U1-03` se diferencian en un
 * carácter y tienen que caer en personajes distintos, o una unidad entera
 * saldría con el mismo. Sumar los códigos de los caracteres, que es lo primero
 * que se intenta, hace justo lo contrario: da números consecutivos.
 */
function huella(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Quién da esta lección.
 *
 * Sale del código de la lección y de nada más: ni del reloj, ni de quién eres,
 * ni de un sorteo. Esa es toda la gracia. Un personaje que cambia cada vez que
 * entras no es un personaje, es un adorno que rota; y volver a una lección y
 * encontrarte al mismo es lo que hace que empiece a significar algo que sea él.
 *
 * El secundario nunca es el protagonista. Se calcula con un salto de 1 a 4
 * sobre el círculo de cinco en vez de sorteando otra vez y repitiendo hasta que
 * salga distinto: así no hay bucle que pueda no terminar y el resultado se
 * puede comprobar a mano.
 */
export function repartoDeLeccion(codigo: string): {
  protagonista: Personaje;
  secundario: Personaje;
} {
  const primero = huella(codigo) % ORDEN.length;
  const salto = 1 + (huella(`${codigo}/2`) % (ORDEN.length - 1));
  return {
    protagonista: REPARTO[ORDEN[primero]!],
    secundario: REPARTO[ORDEN[(primero + salto) % ORDEN.length]!],
  };
}

/**
 * Qué dice, de las que tiene guardadas para ese momento.
 *
 * La `semilla` es lo que hace que no cante. Con el código de la lección a
 * secas, la misma lección abre siempre con la misma frase, que es lo que se
 * quiere en la entrada; pasándole además el número de racha, dos rachas
 * seguidas dicen cosas distintas sin dejar de ser siempre las mismas dos.
 */
export function fraseDe(personaje: Personaje, momento: MomentoConVoz, semilla: string): string {
  const frases = personaje.dice[momento];
  return frases[huella(`${semilla}#${momento}`) % frases.length]!;
}
