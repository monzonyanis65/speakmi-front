import { describe, expect, it } from 'vitest';
import { bytesWav, construirWav, juntar, leerCabeceraWav, MUESTREO, remuestrear } from './wav';

/**
 * La cabecera del WAV es un contrato con el servidor, no un detalle de formato.
 *
 * El evaluador rechaza lo que no sea PCM mono a 16 kHz, y lo rechaza porque Azure
 * NO lo rechaza: un WAV a 48 kHz lo procesa y devuelve notas bajas. Quien estudia
 * leería que pronuncia fatal cuando lo que estaba mal era el audio. Por eso estos
 * cuatro números se comprueban aquí uno a uno en vez de fiarse de que el servidor
 * ya avisará.
 */

/** Un tono de prueba, que es más honesto que un bloque de ceros. */
function tono(muestras: number, muestreo: number): Float32Array {
  const datos = new Float32Array(muestras);
  for (let i = 0; i < muestras; i += 1) datos[i] = Math.sin((2 * Math.PI * 440 * i) / muestreo);
  return datos;
}

describe('la cabecera que mira el servidor', () => {
  it('sale PCM, mono, 16 kHz y 16 bits', () => {
    const cabecera = leerCabeceraWav(bytesWav(tono(MUESTREO, MUESTREO), MUESTREO));

    expect(cabecera).toEqual({
      formato: 1,
      canales: 1,
      muestreo: 16000,
      bits: 16,
      segundos: 1,
    });
  });

  it('un audio grabado a 48 kHz sale igualmente a 16 kHz, y dura lo mismo', () => {
    /*
      El caso que de verdad pasa: muchos navegadores no dejan fijar la frecuencia
      del contexto y entregan 48 kHz. Si eso se mandara tal cual, Azure lo
      aceptaría y devolvería notas malas de un audio que estaba bien.
    */
    const cabecera = leerCabeceraWav(bytesWav(tono(48000 * 2, 48000), 48000));

    expect(cabecera?.muestreo).toBe(16000);
    expect(cabecera?.segundos).toBeCloseTo(2, 2);
  });

  it('el tamaño del bloque de datos cuadra con lo que dice la cabecera', () => {
    // Una cabecera que miente sobre cuántos bytes hay detrás es peor que ninguna:
    // el lector se pasa de largo y decodifica basura como si fuera voz.
    const bytes = bytesWav(tono(MUESTREO, MUESTREO), MUESTREO);

    expect(bytes.byteLength).toBe(44 + MUESTREO * 2);
    expect(new DataView(bytes).getUint32(4, true)).toBe(bytes.byteLength - 8);
    // Y el tipo, que es lo que el servidor mira primero en el multipart.
    expect(construirWav(tono(10, MUESTREO), MUESTREO).type).toBe('audio/wav');
  });

  it('una muestra saturada se recorta en vez de dar la vuelta', () => {
    // Sin el recorte, un 1,5 se sale del entero de 16 bits y aparece como un
    // valor negativo: un chasquido justo donde el micro saturó, que el evaluador
    // puntúa como si fuera parte de la voz.
    const bytes = bytesWav(new Float32Array([1.5, -1.5]), MUESTREO);
    const vista = new DataView(bytes);

    expect(vista.getInt16(44, true)).toBe(32767);
    expect(vista.getInt16(46, true)).toBe(-32768);
  });
});

describe('remuestreo', () => {
  it('no toca nada cuando ya está a la frecuencia buena', () => {
    const datos = tono(100, MUESTREO);
    expect(remuestrear(datos, MUESTREO, MUESTREO)).toBe(datos);
  });

  it('deja el número de muestras que toca', () => {
    expect(remuestrear(tono(48000, 48000), 48000, 16000)).toHaveLength(16000);
    expect(remuestrear(tono(8000, 8000), 8000, 16000)).toHaveLength(16000);
  });
});

describe('juntar los trozos del worklet', () => {
  it('los pega en orden', () => {
    const juntos = juntar([new Float32Array([1, 2]), new Float32Array([3, 4])], 4);
    expect([...juntos]).toEqual([1, 2, 3, 4]);
  });

  it('recorta al tope sin dejar el final a medias', () => {
    // El tope son los treinta segundos de Azure. Se corta aquí para que el
    // servidor no tenga que rechazar una grabación entera por dos segundos.
    const juntos = juntar([new Float32Array([1, 2]), new Float32Array([3, 4])], 3);
    expect([...juntos]).toEqual([1, 2, 3]);
  });
});
