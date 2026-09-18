/** Lo que el servidor manda de cada ejercicio: enunciado sin solución. */
export interface EjercicioPublico {
  code: string;
  type: string;
  difficulty: number;
  prompt: Record<string, unknown>;
}

export interface Diferencia {
  posicion: number;
  esperado: string | null;
  escrito: string | null;
  tipo: 'igual' | 'cambiada' | 'falta' | 'sobra';
}

export interface ErrorDetectado {
  category: string;
  expected: string | null;
  actual: string | null;
  severity: number;
  explicacion_es?: string;
}

export interface Correccion {
  isCorrect: boolean;
  score: number;
  feedback: {
    message_es: string;
    correcta?: string;
    diff?: Diferencia[];
    errores: ErrorDetectado[];
    explicacion_es?: string;
  };
}

/** Toda respuesta que un ejercicio puede producir. */
export type Respuesta = string | number | string[] | number[];

export interface PropsEjercicio {
  ejercicio: EjercicioPublico;
  /** Se bloquea la interacción mientras se muestra la corrección. */
  bloqueado: boolean;
  onCambio: (respuesta: Respuesta | null) => void;
  /**
   * La corrección, cuando ya llegó.
   *
   * Sirve para que el propio ejercicio pueda pintarse: marcar en verde la
   * respuesta buena y en rojo la que se eligió. Ver la tuya al lado de la
   * correcta es lo que enseña; una hoja aparte debajo obliga a mirar dos
   * sitios y a acordarse de cuál habías tocado.
   */
  resultado?: Correccion | null;
}

export const NOMBRE_CATEGORIA: Record<string, string> = {
  auxiliary: 'verbo to be',
  article: 'artículos',
  spelling: 'ortografía',
  verb_tense: 'tiempo verbal',
  preposition: 'preposiciones',
  word_order: 'orden de las palabras',
  vocabulary: 'vocabulario',
  grammar: 'gramática',
  punctuation: 'puntuación',
  pronunciation: 'pronunciación',
};
