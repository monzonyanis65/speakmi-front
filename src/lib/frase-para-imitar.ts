import { api } from '@/lib/api';

/**
 * De dónde sale la frase cuando el shadowing no viene de una lección.
 *
 *
 * EL PROBLEMA
 *
 * `Shadowing` recibe un `code` de ejercicio y con él le pide al servidor el
 * audio del modelo. Dentro de una lección eso era gratis: el código era el del
 * ejercicio que tenías delante. Fuera no hay ninguno, y elegirlo mal se nota
 * enseguida —una frase de un nivel que no es el tuyo, o una que destripa una
 * lección que no has hecho— así que esta es la decisión de verdad del cambio.
 *
 *
 * DE DÓNDE SE SACA, Y POR QUÉ DE AHÍ
 *
 * De tu nivel, y dentro de él de las lecciones QUE YA TERMINASTE, las últimas
 * primero. Tres motivos, por orden de peso:
 *
 * 1. El shadowing mide CÓMO lo dices, no si lo entiendes. Con una frase que no
 *    has visto nunca te pasas el rato descifrando vocabulario y el ritmo se te
 *    va en eso. Sobre algo que ya sabes decir, toda la atención va a la forma,
 *    que es lo único que este ejercicio viene a entrenar.
 * 2. No destripa. Una frase de la unidad 4 enseñada a quien va por la 1 le
 *    quita el ejercicio de después.
 * 3. Lo recién terminado es lo que estás aprendiendo ahora mismo, y repetirlo
 *    en voz alta al día siguiente es exactamente lo que hace que se quede.
 *
 * LO QUE NO SE USA, Y POR QUÉ: la cola de repaso (`/review/due`), que sería la
 * respuesta obvia a «de lo que fallaste». Dos razones. La de bulto es que esas
 * tarjetas traen pregunta y respuesta en texto, sin código de ejercicio, y sin
 * código no hay audio del modelo que pedir. La de fondo es que lo que se falla
 * ahí es gramática y vocabulario escritos: haber fallado un hueco no dice
 * absolutamente nada sobre tu ritmo al hablar. Sería elegir el ejercicio de una
 * destreza con la señal de otra.
 *
 * SI NO HAS TERMINADO NADA todavía —primer día en un nivel— se cae a las
 * lecciones sin hacer, en el orden del temario. La primera de hablar de tu
 * nivel es justo la que vas a hacer a continuación, así que tampoco destripa
 * nada que no tengas ya delante.
 *
 *
 * LO QUE CUESTA
 *
 * Dos peticiones para montar la lista y una por lección de la que se sacan
 * frases, y las tres las cachea react-query. No se piden las lecciones todas de
 * golpe a propósito: un nivel tiene cuatro unidades y entre ocho y doce
 * lecciones con frases, y pedirlas todas serían doce viajes para usar uno. Se
 * va de una en una y casi siempre basta con la primera, porque una lección de
 * hablar trae varias frases y de ahí salen varios «otra frase» seguidos sin
 * tocar la red.
 */

/** Los tipos de lección que pueden traer una frase dicha por un modelo. */
const CON_FRASE = new Set(['speaking', 'checkpoint', 'listening']);

export interface LeccionCandidata {
  code: string;
  titulo: string;
  /** Si ya la terminaste. Se enseña: cambia lo que se espera de la frase. */
  hecha: boolean;
}

export interface FraseParaImitar {
  /** El código del EJERCICIO. Es lo que `Shadowing` necesita. */
  code: string;
  /** La frase en sí, para poder presentarla antes de pedir el audio. */
  texto: string;
  leccion: string;
  tituloLeccion: string;
  hecha: boolean;
}

interface RespuestaNivel {
  units: Array<{
    lessons: Array<{ code: string; titleEs: string; type: string; completed?: boolean }>;
  }>;
}

interface RespuestaLeccion {
  exercises: Array<{
    code: string;
    type: string;
    prompt: { referenceText?: string; speakText?: string };
  }>;
}

/**
 * Un orden al azar, con Fisher-Yates.
 *
 * Hace falta porque sin él la pantalla saldría siempre con la misma frase, y
 * un ejercicio que empieza igual todos los días se deja de abrir a la tercera.
 * El azar se echa UNA VEZ, al montar la lista, y no en cada pintado: así «otra
 * frase» recorre un orden fijo en lugar de poder repetir la que acabas de
 * hacer.
 */
function barajar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

/** Las lecciones de tu nivel que pueden dar una frase, en el orden a gastarlas. */
export async function leccionesParaImitar(): Promise<LeccionCandidata[]> {
  const { level } = await api.get<{ level: { levelCode: string } | null }>('/me/level');
  if (!level) return [];

  const nivel = await api.get<RespuestaNivel>(`/curriculum/levels/${level.levelCode}`);

  const candidatas = nivel.units
    .flatMap((unidad) => unidad.lessons)
    .filter((leccion) => CON_FRASE.has(leccion.type))
    .map((leccion) => ({
      code: leccion.code,
      titulo: leccion.titleEs,
      hecha: leccion.completed === true,
    }));

  /*
    Las hechas barajadas, las pendientes en el orden del temario.

    Entre lo que ya sabes decir da igual el orden y conviene que varíe. Entre lo
    que no has hecho no da igual: la siguiente del temario es la única que no
    destripa nada, así que ahí el orden se respeta.
  */
  return [
    ...barajar(candidatas.filter((leccion) => leccion.hecha)),
    ...candidatas.filter((leccion) => !leccion.hecha),
  ];
}

/** Las frases imitables de una lección, barajadas. */
export async function frasesDe(leccion: LeccionCandidata): Promise<FraseParaImitar[]> {
  const datos = await api.get<RespuestaLeccion>(`/curriculum/lessons/${leccion.code}`);

  const frases = datos.exercises
    .map((ejercicio) => ({
      code: ejercicio.code,
      /*
        Las dos claves, no solo `referenceText`.

        El motor de shadowing acepta cualquier ejercicio que tenga una frase
        inglesa dicha por un modelo, y el dictado la tiene en `speakText`. Mirar
        solo las lecturas en voz alta dejaría fuera la mitad del material sin
        ningún motivo.
      */
      texto: (ejercicio.prompt.referenceText ?? ejercicio.prompt.speakText ?? '').trim(),
      leccion: leccion.code,
      tituloLeccion: leccion.titulo,
      hecha: leccion.hecha,
    }))
    .filter((frase) => frase.texto.length > 0);

  return barajar(frases);
}
