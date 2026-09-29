import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeerEnVozAlta } from './LeerEnVozAlta';
import type { Escuchado } from '@/lib/reconocimiento';

/**
 * Lo que se sustituye es el micrófono y el servidor, que en jsdom no existen. Lo
 * que se comprueba es el salto que justifica todo este trabajo: que la pantalla
 * pase de decir QUÉ PALABRA salió regular a decir QUÉ SONIDO y qué hacer con la
 * lengua. Con el código de antes, «think» se marcaba en ámbar y ahí se acababa
 * la lección.
 */

let avisar: ((oido: Escuchado) => void) | null = null;

vi.mock('@/lib/reconocimiento', () => ({
  estaDisponible: () => true,
  escuchar: (opciones: { onFinal: (oido: Escuchado) => void }) => {
    avisar = opciones.onFinal;
    return {
      detener: () => avisar?.({ texto: 'I sink so', alternativas: [] }),
      cancelar: () => {},
    };
  },
}));

let respuesta: Record<string, unknown> = {};

vi.mock('@/lib/api', () => ({
  api: { post: () => Promise.resolve(respuesta) },
}));

const EJERCICIO = {
  code: 'L6-U2-03-E04',
  prompt: { instruction_es: 'Lee la frase en voz alta.', referenceText: 'I think so' },
};

/** La parte del informe que ya existía antes de todo esto. */
const INFORME_BASE = {
  words: [
    { wordIndex: 0, word: 'I', heard: 'I', score: 0.95, verdict: 'correct' },
    { wordIndex: 1, word: 'think', heard: 'sink', score: 0.4, verdict: 'mispronounced' },
    { wordIndex: 2, word: 'so', heard: 'so', score: 0.9, verdict: 'correct' },
  ],
  accuracy: 0.66,
  completeness: 1,
  transcript: 'I sink so',
  aprobado: false,
  palabrasParaTrabajar: [{ word: 'think' }],
};

beforeEach(() => {
  avisar = null;
  respuesta = { ...INFORME_BASE };
});

/** Lee y espera a la corrección. */
async function leer(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: /empezar a leer/i }));
  await usuario.click(screen.getByRole('button', { name: /terminé de leer/i }));
  await screen.findByText(/bien dichas/i);
}

describe('leer en voz alta, con el desglose por sonidos', () => {
  it('dice qué sonido se falló y qué hacer con la lengua, no solo qué palabra', async () => {
    respuesta = {
      ...INFORME_BASE,
      fonemas: [
        {
          palabra: 'think',
          indicePalabra: 1,
          fonemas: [
            { simbolo: 'θ', puntuacion: 22 },
            { simbolo: 'ɪ', puntuacion: 88 },
            { simbolo: 'ŋ', puntuacion: 85 },
            { simbolo: 'k', puntuacion: 90 },
          ],
        },
      ],
      cortes: [],
      prosodia: 74,
    };

    const usuario = userEvent.setup();
    render(<LeerEnVozAlta ejercicio={EJERCICIO} onTerminado={() => {}} />);
    await leer(usuario);

    // La instrucción para la boca, que es lo único que se puede practicar.
    expect(
      await screen.findByText(/punta de la lengua entre los dientes hasta que se vea/i),
    ).toBeInTheDocument();
    // Y por qué sale una «s»: sin el porqué no se le queda a nadie.
    expect(screen.getByRole('article')).toHaveTextContent(/think.*sink|sink/i);
  });

  it('con la fonética a null lo dice, y no enseña un cero', async () => {
    respuesta = { ...INFORME_BASE, fonemas: null, cortes: null, prosodia: null };

    const usuario = userEvent.setup();
    render(<LeerEnVozAlta ejercicio={EJERCICIO} onTerminado={() => {}} />);
    await leer(usuario);

    const aviso = await screen.findByText(/no pudimos mirar tus sonidos/i);
    expect(aviso.textContent ?? '').not.toMatch(/\d/);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('un servidor que todavía no evalúa fonética no deja ningún hueco', async () => {
    // El informe de siempre, sin los campos nuevos: la pantalla tiene que quedar
    // exactamente como estaba.
    const usuario = userEvent.setup();
    render(<LeerEnVozAlta ejercicio={EJERCICIO} onTerminado={() => {}} />);
    await leer(usuario);

    expect(screen.queryByText(/cómo te salieron los sonidos/i)).not.toBeInTheDocument();
    // Y lo de antes sigue estando.
    expect(screen.getByText(/para la próxima/i)).toBeInTheDocument();
  });

  it('nombra la palabra donde cortaste usando el texto de referencia', async () => {
    respuesta = { ...INFORME_BASE, cortes: [{ indicePalabra: 2, tipo: 'sobra' }] };

    const usuario = userEvent.setup();
    render(<LeerEnVozAlta ejercicio={EJERCICIO} onTerminado={() => {}} />);
    await leer(usuario);

    expect(await screen.findByText(/«so»/)).toBeInTheDocument();
  });
});
