import { describe, expect, it } from 'vitest';
import { idiomaDe, idiomaDeCada } from '@/lib/idioma';

/**
 * Distinguir una opción en inglés de una en español.
 *
 * Todo lo que se prueba aquí está copiado del temario de verdad, no inventado:
 * son opciones que existen en `back/content`. Es a propósito. Un detector de
 * idioma probado con ejemplos escritos para que pase es un detector que acierta
 * en su propio archivo de pruebas y falla en la aplicación.
 *
 * Lo que de verdad hay que impedir es UN caso: que una opción española se
 * clasifique como inglesa. Eso es la voz inglesa leyendo «Porque todavía no ha
 * encontrado apartamento», que enseña una pronunciación que no existe. Lo
 * contrario —una opción inglesa que se queda muda— es una pena, no un daño.
 */
describe('idiomaDe', () => {
  it('ve el inglés en las frases largas', () => {
    expect(idiomaDe("He's a tall man with short gray hair.")).toBe('ingles');
    expect(idiomaDe('I always drink some juice with breakfast.')).toBe('ingles');
  });

  it('ve el español en las respuestas de comprensión lectora', () => {
    expect(idiomaDe('Porque todavía no ha encontrado un apartamento fijo')).toBe('espanol');
    expect(idiomaDe('Iremos a la playa aunque llueva')).toBe('espanol');
  });

  it('no se deja engañar por las palabras que existen en los dos idiomas', () => {
    /*
      Cada una de estas costó un fallo medido sobre el temario.

      «a», «me», «he» y «has» son inglesas y también españolas («he visto»,
      «has dicho»), y mientras contaron como marca de inglés estas tres frases
      se iban a leer con voz inglesa.
    */
    expect(idiomaDe('llevar a cabo, realizar')).not.toBe('ingles');
    expect(idiomaDe('me arrepiento')).not.toBe('ingles');
    expect(idiomaDe('acostumbrarse a algo nuevo')).not.toBe('ingles');
  });

  it('tampoco al revés: «no», «son» y «era» son inglesas además de españolas', () => {
    // «no way» es inglés. Con «no» contando como marca de español, esta opción
    // se quedaba muda.
    expect(idiomaDe('no way')).toBe('ingles');
    expect(idiomaDe('my son')).toBe('ingles');
  });

  it('una frase española que cita inglés sigue siendo española', () => {
    // Se lee la frase ENTERA en voz alta, así que lo que manda es el idioma de
    // la frase y no el de las dos palabras citadas.
    expect(idiomaDe('«three words in nine pages», que pide otra coma')).toBe('espanol');
  });

  it('una frase inglesa con un préstamo acentuado sigue siendo inglesa', () => {
    expect(idiomaDe("That's the café where we met.")).toBe('ingles');
  });

  it('se calla cuando no hay ni una marca, en vez de jugársela', () => {
    expect(idiomaDe('box')).toBe('no-se');
    expect(idiomaDe('Nuevos')).toBe('no-se');
  });
});

describe('idiomaDeCada', () => {
  it('el grupo rescata a las opciones que solas no dicen nada', () => {
    // Ninguna de las cuatro tiene marca propia, pero «boxes» y «boxies» llevan
    // «ss»... no: lo que decide es la suma del grupo.
    expect(idiomaDeCada(['aunt', 'niece', 'cousin'])).toEqual(['ingles', 'ingles', 'ingles']);
  });

  it('el grupo no le quita la razón a una opción que sí tiene marcas', () => {
    /*
      Este grupo es mezclado de verdad y está en L2-U1-03-E01. Si el veredicto
      del grupo se impusiera a todas, o se leería «no hace falta nada» con voz
      inglesa o se quedarían mudos «am», «is» y «are».
    */
    expect(idiomaDeCada(['am', 'is', 'are', 'no hace falta nada'])).toEqual([
      'ingles',
      'ingles',
      'ingles',
      'espanol',
    ]);
  });

  it('las dos columnas de emparejar salen cada una en su idioma', () => {
    expect(idiomaDeCada(['deny', 'admit', 'claim', 'point out'])).toEqual([
      'ingles',
      'ingles',
      'ingles',
      'ingles',
    ]);
    expect(
      idiomaDeCada([
        'negar algo que te están atribuyendo',
        'reconocer algo que te deja en mal lugar',
      ]),
    ).toEqual(['espanol', 'espanol']);
  });

  it('una columna derecha en inglés también suena: no se da por hecho el lado', () => {
    // L10-U3-06-E02 empareja peticiones con respuestas, y las dos columnas son
    // inglesas. Fiarse de «la izquierda es el inglés» dejaría esto mudo.
    expect(idiomaDeCada(['Not at all, take your time.', "Here's the file."])).toEqual([
      'ingles',
      'ingles',
    ]);
  });

  it('la frase del hueco decide por unas fichas que no delatan nada', () => {
    // Solas, «in / to / of» son palabras vacías de los dos idiomas. Con la
    // frase que vienen a completar no hay duda.
    expect(idiomaDeCada(['told', 'said', 'spoke to'], 'He ___ me Monday, actually.')).toEqual([
      'ingles',
      'ingles',
      'ingles',
    ]);
  });
});
