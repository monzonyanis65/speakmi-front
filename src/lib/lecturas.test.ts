import { describe, expect, it } from 'vitest';
import {
  contar,
  desplazamientoParaVer,
  enParrafos,
  espacioAntes,
  frasesCon,
  lemaDe,
  marcarLema,
  trocear,
  trozosParaPintar,
  unirTrozos,
  vecesQueSale,
  type Parrafo,
} from '@/lib/lecturas';

/**
 * Lo que esta pantalla promete, probado sin pintar nada.
 *
 * Las dos cosas que de verdad se aprietan aquí son las dos que se rompen solas
 * al escribirlas de la manera que sale natural:
 *
 *   - marcar una palabra la marca EN TODAS SUS APARICIONES, porque el servidor
 *     guarda por lema y no por posición;
 *   - tocar una palabra que YA SE VE no mueve la pantalla ni un píxel.
 *
 * Las dos se comprobaron rompiéndolas primero: con la versión ingenua de cada
 * una, la prueba correspondiente se pone roja.
 */

const TEXTO = 'Code is read more often than code is written. Good code explains itself.';

function unParrafo(texto: string): Parrafo[] {
  return enParrafos(texto);
}

describe('trocear el texto', () => {
  it('deja la puntuación sin lema, para que no se pueda tocar', () => {
    const trozos = trocear('Hello, world.');
    expect(trozos.map((t) => t.texto)).toEqual(['Hello', ',', 'world', '.']);
    expect(trozos.filter((t) => t.lema).map((t) => t.lema)).toEqual(['hello', 'world']);
  });

  it('una coma no se pinta como palabra por descubrir', () => {
    // Si la puntuación entrara como «nueva», un texto recién pegado saldría con
    // los puntos y las comas resaltados en ámbar, que es puro ruido.
    const coma = trocear('Hello, world.').find((t) => t.texto === ',');
    expect(coma?.estado).toBe('ignorada');
  });

  it('no parte las contracciones ni las palabras con guion', () => {
    expect(trocear("don't ship well-known bugs").map((t) => t.texto)).toEqual([
      "don't",
      'ship',
      'well-known',
      'bugs',
    ]);
  });

  it('el lema quita mayúsculas, signos pegados y el posesivo', () => {
    expect(lemaDe('“Review”')).toBe('review');
    expect(lemaDe("reviewer's")).toBe('reviewer');
    expect(lemaDe('42')).toBe('');
  });

  it('separa por líneas en blanco y no por saltos sueltos', () => {
    const parrafos = enParrafos('Uno\ncon salto.\n\nDos aparte.');
    expect(parrafos).toHaveLength(2);
    expect(parrafos[0]?.texto).toBe('Uno con salto.');
  });
});

describe('volver a montar el texto', () => {
  it('no pone espacio delante de la puntuación', () => {
    expect(espacioAntes(',', 'Hello')).toBe(false);
    expect(espacioAntes('world', ',')).toBe(true);
    expect(espacioAntes('Hello', undefined)).toBe(false);
  });

  it('no pone espacio detrás de un signo de apertura', () => {
    expect(espacioAntes('yes', '(')).toBe(false);
  });

  it('devuelve el texto tal y como se pegó', () => {
    const original = 'He said (quietly), “it works.”';
    expect(unirTrozos(trocear(original))).toBe(original);
  });
});

describe('contar el progreso', () => {
  it('la puntuación no cuenta como palabra', () => {
    const cuenta = contar(unParrafo('Hello, world.'));
    expect(cuenta.total).toBe(2);
  });

  it('un texto recién traído está todo por descubrir y al cero por ciento', () => {
    const cuenta = contar(unParrafo(TEXTO));
    expect(cuenta.nueva).toBe(cuenta.total);
    expect(cuenta.porDescubrir).toBe(cuenta.total);
    expect(cuenta.porcentaje).toBe(0);
  });

  it('lo ignorado cuenta como decidido, no como pendiente', () => {
    // Un nombre propio que descartas no puede quedarse contando en «te faltan»:
    // el número no bajaría nunca y la barra no llegaría al final jamás.
    const parrafos = marcarLema(unParrafo('Hello, world.'), 'hello', 'ignorada');
    const cuenta = contar(parrafos);
    expect(cuenta.porDescubrir).toBe(1);
    expect(cuenta.porcentaje).toBe(50);
  });
});

describe('marcar una palabra', () => {
  it('la marca en TODAS sus apariciones, no solo en la que se tocó', () => {
    /*
      ESTA ES LA PRUEBA QUE SE ROMPIÓ A PROPÓSITO.

      La versión ingenua —la que sale sola porque al tocar la palabra tienes su
      índice delante— cambia únicamente ese trozo. Con ella, esto da 1 en vez de
      3 y la prueba se pone roja.

      Y no es un capricho de diseño: el servidor guarda por lema
      (`PUT /api/lecturas/:id/palabra { lema, estado }`), así que con la versión
      ingenua la pantalla enseñaría una cosa y lo guardado sería otra. Al
      recargar aparecerían marcadas las tres «code» que antes se veían como una.
    */
    const parrafos = unParrafo(TEXTO);
    expect(vecesQueSale(parrafos, 'code')).toBe(3);

    const despues = marcarLema(parrafos, 'code', 'sabida');
    const marcadas = despues
      .flatMap((p) => p.palabras)
      .filter((p) => p.lema === 'code' && p.estado === 'sabida');

    expect(marcadas).toHaveLength(3);
  });

  it('no toca las demás palabras', () => {
    const despues = marcarLema(unParrafo(TEXTO), 'code', 'sabida');
    const otras = despues.flatMap((p) => p.palabras).filter((p) => p.lema && p.lema !== 'code');
    expect(otras.every((p) => p.estado === 'nueva')).toBe(true);
  });

  it('con lema vacío no cambia nada, para que la puntuación no arrastre', () => {
    const antes = unParrafo(TEXTO);
    const despues = marcarLema(antes, '', 'sabida');
    expect(despues.flatMap((p) => p.palabras).every((p) => p.estado !== 'sabida')).toBe(true);
  });
});

describe('las frases donde sale', () => {
  it('saca la frase entera con su punto, no el párrafo completo', () => {
    expect(frasesCon(unParrafo(TEXTO), 'good')).toEqual(['Good code explains itself.']);
  });

  it('devuelve varias cuando la palabra se repite, hasta el máximo', () => {
    expect(frasesCon(unParrafo(TEXTO), 'code')).toHaveLength(2);
    expect(frasesCon(unParrafo(TEXTO), 'code', 1)).toHaveLength(1);
  });
});

describe('pintar el párrafo con los cortes del servidor', () => {
  /*
    LA TERCERA PRUEBA QUE SE ROMPIÓ A PROPÓSITO.

    Antes de que el servidor mandara `desde`/`hasta`, esta pantalla reconstruía
    el párrafo uniendo los trozos con `espacioAntes`. Funciona con texto de
    manual y falla con texto de verdad: dos espacios seguidos después de un
    punto, una raya sin espacios, unas comillas tipográficas. Con aquella
    versión, esta prueba se pone roja porque el párrafo pintado no es el que se
    pegó —pierde el segundo espacio y se come la raya—, y lo grave no es que
    quede feo: son DOS criterios distintos partiendo el mismo texto, y en cuanto
    discrepan en un carácter las marcas de color se corren una palabra y dejan de
    corresponder con lo que hay guardado.
  */
  const TEXTO_RARO = 'He said—quietly—that it works.  Twice, “really”.';

  /** Un párrafo como lo manda el servidor: con posiciones. */
  function comoDelServidor(texto: string): Parrafo {
    return { indice: 0, texto, palabras: trocear(texto) };
  }

  it('devuelve el párrafo carácter por carácter, tal y como se pegó', () => {
    const trozos = trozosParaPintar(comoDelServidor(TEXTO_RARO));
    const pintado = trozos
      .map((trozo) => (trozo.tipo === 'palabra' ? trozo.palabra.texto : trozo.texto))
      .join('');
    expect(pintado).toBe(TEXTO_RARO);
  });

  it('solo son tocables las palabras, no lo que va entre ellas', () => {
    const trozos = trozosParaPintar(comoDelServidor('Hello, world.'));
    const tocables = trozos.filter((trozo) => trozo.tipo === 'palabra' && trozo.palabra.lema);
    expect(tocables).toHaveLength(2);
  });

  it('sin posiciones se sigue leyendo, reconstruyendo como se pueda', () => {
    // El servidor podría mandar un párrafo viejo o a medias: que no se quede en
    // blanco la pantalla de leer por eso.
    const palabras = trocear('Hello, world.').map((palabra) => ({
      ...palabra,
      desde: Number.NaN,
      hasta: Number.NaN,
    }));
    const trozos = trozosParaPintar({ indice: 0, texto: '', palabras });
    const pintado = trozos
      .map((trozo) => (trozo.tipo === 'palabra' ? trozo.palabra.texto : trozo.texto))
      .join('');
    expect(pintado).toBe('Hello, world.');
  });
});

describe('no perder el sitio al abrir el panel', () => {
  /*
    LA OTRA PRUEBA QUE SE ROMPIÓ A PROPÓSITO.

    Lo que sale natural al abrir un panel abajo es llamar a
    `scrollIntoView({ block: 'center' })` sobre la palabra tocada. Eso equivale a
    devolver SIEMPRE un desplazamiento —el que centra la palabra—, también
    cuando la palabra estaba a la vista. Con esa versión, el primer caso de aquí
    abajo devuelve -178 en vez de 0 y la prueba se pone roja.

    Y es exactamente el fallo que hace que leer sea imposible: tocas una palabra
    del principio del párrafo, el texto pega un salto y tienes que buscar el
    renglón por el que ibas. Doscientas veces por artículo.
  */
  const ventana = { altoVentana: 800, altoPanel: 300, altoCabecera: 80 };

  it('no mueve nada si la palabra ya se veía', () => {
    expect(desplazamientoParaVer({ arriba: 200, abajo: 244, ...ventana })).toBe(0);
  });

  it('tampoco si está justo en el borde de lo que tapa el panel', () => {
    // Abajo del todo de la banda libre: 800 - 300 = 500.
    expect(desplazamientoParaVer({ arriba: 456, abajo: 500, ...ventana })).toBe(0);
  });

  it('baja lo justo cuando el panel la tapa', () => {
    // Le sobran 20 px por debajo de 500, más los 12 de margen.
    expect(desplazamientoParaVer({ arriba: 476, abajo: 520, ...ventana })).toBe(32);
  });

  it('sube cuando la cabecera la tapa', () => {
    expect(desplazamientoParaVer({ arriba: 50, abajo: 94, ...ventana })).toBe(-42);
  });

  it('con el panel cerrado la banda libre llega hasta abajo', () => {
    expect(desplazamientoParaVer({ arriba: 700, abajo: 744, altoVentana: 800, altoPanel: 0 })).toBe(
      0,
    );
  });

  it('en una pantalla diminuta alinea por arriba en vez de rendirse', () => {
    // Banda libre de 30 px para una palabra de 44: no cabe. Se enseña el
    // principio, que es por donde se empieza a leer.
    const salto = desplazamientoParaVer({
      arriba: 300,
      abajo: 344,
      altoVentana: 400,
      altoPanel: 350,
      altoCabecera: 20,
    });
    expect(salto).toBe(268);
  });
});
