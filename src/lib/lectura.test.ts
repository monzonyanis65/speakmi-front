import { describe, expect, it, vi, beforeEach } from 'vitest';
import { enviarLectura } from './lectura';

/**
 * Las dos formas de mandar una lectura tienen que seguir valiendo las dos.
 *
 * La de siempre, en JSON, es la que usa cualquier navegador que no pueda grabar
 * PCM, y no es un modo degradado: es la app que ya existía. La nueva lleva
 * además el audio, y lo lleva en multipart porque el JSON no sabe transportar un
 * WAV sin inflarlo un tercio en base64.
 */

const enviado: Array<Record<string, unknown>> = [];

vi.mock('@/lib/api', () => ({
  URL_API: 'https://servidor',
  api: {
    post: (ruta: string, datos: Record<string, unknown>) => {
      enviado.push({ ruta, datos });
      return Promise.resolve({ porJson: true });
    },
  },
}));

vi.mock('@/lib/auth', () => ({ getToken: () => 'un-token' }));

let peticion: { url: string; init: RequestInit } | null = null;
let respondeBien = true;

beforeEach(() => {
  enviado.length = 0;
  peticion = null;
  respondeBien = true;
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    peticion = { url, init };
    return Promise.resolve({
      ok: respondeBien,
      json: () => Promise.resolve({ porMultipart: true }),
    } as Response);
  });
});

const DATOS = { referenceText: 'I think so', transcript: 'I sink so' };

describe('mandar una lectura', () => {
  it('sin audio va en JSON por el cliente de siempre', async () => {
    const respuesta = await enviarLectura(DATOS, null);

    expect(respuesta).toEqual({ porJson: true });
    expect(enviado).toHaveLength(1);
    expect(peticion).toBeNull();
  });

  it('con audio va en multipart, con los datos como cadena y el WAV al lado', async () => {
    const audio = new Blob([new ArrayBuffer(44)], { type: 'audio/wav' });
    const respuesta = await enviarLectura(DATOS, audio);

    expect(respuesta).toEqual({ porMultipart: true });
    expect(peticion?.url).toBe('https://servidor/api/speech/read-aloud');

    const cuerpo = peticion?.init.body as FormData;
    expect(cuerpo.get('datos')).toBe(JSON.stringify(DATOS));
    expect(cuerpo.get('audio')).toBeInstanceOf(Blob);

    // El `Content-Type` lo tiene que poner el navegador: lleva el `boundary`, que
    // desde aquí no se puede saber. Ponerlo a mano rompe el multipart entero.
    const cabeceras = peticion?.init.headers as Record<string, string>;
    expect(cabeceras['Content-Type']).toBeUndefined();
  });

  it('si el servidor no acepta el audio, reintenta sin él en vez de fallar', async () => {
    /*
      Pasa de dos maneras: el servidor todavía no entiende multipart, o mira la
      cabecera del WAV y la rechaza. En los dos casos lo correcto es entregar la
      corrección por palabras SIN fonemas —que en pantalla significa «no se
      intentó»— y no dejar a alguien sin corrección, ni enseñarle notas de
      fonemas sacadas de un audio que el servidor considera malo.
    */
    respondeBien = false;
    const respuesta = await enviarLectura(DATOS, new Blob([new ArrayBuffer(44)]));

    expect(respuesta).toEqual({ porJson: true });
    expect(enviado).toHaveLength(1);
  });
});
