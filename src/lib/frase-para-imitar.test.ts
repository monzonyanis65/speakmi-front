import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frasesDe, leccionesParaImitar } from '@/lib/frase-para-imitar';

/**
 * De dónde sale la frase cuando el shadowing no viene de una lección.
 *
 * Es la única decisión de verdad de haber sacado el shadowing de la lección.
 * Dentro, el código del ejercicio venía dado; fuera hay que elegirlo, y
 * elegirlo mal no da ningún error: da una pantalla perfecta que practica lo que
 * no toca, o que destripa una lección que todavía no has hecho.
 *
 * Lo que se aprieta es el orden, porque el orden ES la decisión: primero lo que
 * ya terminaste —el shadowing mide CÓMO lo dices, no si lo entiendes— y solo
 * después lo que tienes por delante, y eso en el orden del temario, que es lo
 * único que no adelanta contenido.
 */

const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (ruta: string) => get(ruta) } }));

const NIVEL = {
  units: [
    {
      lessons: [
        { code: 'L6-U5-01', titleEs: 'Vocabulario', type: 'vocab', completed: true },
        { code: 'L6-U5-05', titleEs: 'Léelo en voz alta', type: 'speaking', completed: true },
        { code: 'L6-U5-07', titleEs: 'Repaso de unidad', type: 'checkpoint', completed: false },
      ],
    },
    {
      lessons: [
        { code: 'L6-U6-04', titleEs: 'Escucha', type: 'listening', completed: false },
        { code: 'L6-U6-05', titleEs: 'Dilo tú', type: 'speaking', completed: true },
      ],
    },
  ],
};

beforeEach(() => {
  get.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function servidor(nivel: unknown = NIVEL, conNivel = true) {
  get.mockImplementation((ruta: string) => {
    if (ruta === '/me/level')
      return Promise.resolve({ level: conNivel ? { levelCode: 'L6' } : null });
    if (ruta.startsWith('/curriculum/levels/')) return Promise.resolve(nivel);
    return Promise.resolve({ exercises: [] });
  });
}

describe('leccionesParaImitar', () => {
  it('deja fuera las lecciones que no pueden tener una frase hablada', async () => {
    servidor();
    const lecciones = await leccionesParaImitar();

    // «Vocabulario» es de tipo `vocab`: ni lecturas en voz alta ni dictados.
    expect(lecciones.map((l) => l.code)).not.toContain('L6-U5-01');
  });

  it('pone primero lo que ya hiciste, que es donde el ritmo se puede medir', async () => {
    /*
      El orden importa más que la lista. Con una frase que no has visto nunca te
      pasas el rato descifrando vocabulario y el ritmo se te va en eso; sobre
      algo que ya sabes decir, toda la atención va a la forma.
    */
    servidor();
    const lecciones = await leccionesParaImitar();

    /*
      Se comprueban los GRUPOS y no la lista exacta, porque dentro de las hechas
      el orden se baraja a propósito: sin barajar, esta pantalla saldría todos
      los días con la misma frase y se dejaría de abrir a la tercera.
    */
    expect(lecciones.slice(0, 2).every((l) => l.hecha)).toBe(true);
    expect(lecciones.slice(2).every((l) => !l.hecha)).toBe(true);
    expect([...lecciones.slice(0, 2)].map((l) => l.code).sort()).toEqual(['L6-U5-05', 'L6-U6-05']);
  });

  it('las pendientes van en el orden del temario, no barajadas', async () => {
    // Entre lo que no has hecho el orden no da igual: la siguiente del temario
    // es la única que no te adelanta nada.
    servidor();
    const lecciones = await leccionesParaImitar();
    const pendientes = lecciones.filter((l) => !l.hecha).map((l) => l.code);

    expect(pendientes).toEqual(['L6-U5-07', 'L6-U6-04']);
  });

  it('sin nivel elegido no se inventa ninguno', async () => {
    servidor(NIVEL, false);
    expect(await leccionesParaImitar()).toEqual([]);
    // Y no se pide el temario de un nivel que no existe.
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining('/curriculum/levels/'));
  });
});

describe('frasesDe', () => {
  const leccion = { code: 'L6-U5-05', titulo: 'Léelo en voz alta', hecha: true };

  it('saca la frase tanto de una lectura en voz alta como de un dictado', async () => {
    /*
      El motor de shadowing acepta cualquier ejercicio con una frase inglesa
      dicha por un modelo, y el dictado la trae en `speakText`. Mirar solo
      `referenceText` dejaba fuera la mitad del material.
    */
    get.mockResolvedValue({
      exercises: [
        {
          code: 'E01',
          type: 'read_aloud',
          prompt: { referenceText: 'My father studied medicine.' },
        },
        { code: 'E02', type: 'listen_type', prompt: { speakText: 'It is a quiet city.' } },
      ],
    });

    const frases = await frasesDe(leccion);
    expect(frases.map((f) => f.code).sort()).toEqual(['E01', 'E02']);
  });

  it('descarta los ejercicios que no tienen ninguna frase que imitar', async () => {
    // Sin frase no hay audio del modelo que pedir: el servidor respondería un
    // error y la pantalla se quedaría en blanco sin saber por qué.
    get.mockResolvedValue({
      exercises: [
        { code: 'E01', type: 'multiple_choice', prompt: {} },
        { code: 'E02', type: 'read_aloud', prompt: { referenceText: '   ' } },
        { code: 'E03', type: 'read_aloud', prompt: { referenceText: 'Say this.' } },
      ],
    });

    expect((await frasesDe(leccion)).map((f) => f.code)).toEqual(['E03']);
  });

  it('cada frase se lleva de dónde viene, para poder decirlo en pantalla', async () => {
    get.mockResolvedValue({
      exercises: [{ code: 'E01', type: 'read_aloud', prompt: { referenceText: 'Say this.' } }],
    });

    expect(await frasesDe(leccion)).toEqual([
      {
        code: 'E01',
        texto: 'Say this.',
        leccion: 'L6-U5-05',
        tituloLeccion: 'Léelo en voz alta',
        hecha: true,
      },
    ]);
  });
});
