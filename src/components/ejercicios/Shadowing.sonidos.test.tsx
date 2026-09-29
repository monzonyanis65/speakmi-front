import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shadowing } from './Shadowing';

/**
 * El desglose por sonidos dentro del shadowing.
 *
 * Va en su propio archivo y no dentro de `Shadowing.test.tsx` porque lo que se
 * comprueba aquí es otra cosa: aquel prueba el ritmo y los auriculares, este
 * prueba que el resultado además enseña qué sonido se falló. Mezclarlos haría
 * que tocar una cosa pusiera roja la otra sin motivo.
 *
 * Igual que en el archivo de al lado, solo se sustituye el hardware: el pitido
 * que mide la fuga del altavoz y el micrófono. Los datos son el mismo doble que
 * ve quien abre /shadowing.
 */
vi.mock('@/lib/auriculares', () => ({
  sePuedeSondar: () => true,
  sondarFugaDeAltavoz: () =>
    Promise.resolve({ fuga: 'sin-fuga', subidaDb: 2, motivo: 'Casi no se oyó.' }),
  veredictoDeFuga: () => 'sin-fuga',
  SUBIDA_SOSPECHOSA_DB: 10,
}));

vi.mock('@/lib/grabacion', () => ({
  puedeGrabar: () => true,
  grabar: () =>
    Promise.resolve({
      terminar: () => Promise.resolve(new Blob(['audio'], { type: 'audio/webm' })),
      cancelar: () => {},
    }),
}));

const reproducir = vi
  .spyOn(HTMLMediaElement.prototype, 'play')
  .mockImplementation(() => Promise.resolve());
vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

beforeEach(() => {
  reproducir.mockClear();
  URL.createObjectURL = () => 'blob:mentira';
  URL.revokeObjectURL = () => {};
});

afterAll(() => reproducir.mockRestore());

const EJERCICIO = { code: 'L6-U1-01-E07' };

async function unIntento(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(await screen.findByRole('button', { name: /repetir encima/i }));
  await usuario.click(await screen.findByRole('button', { name: /ya está, para/i }));
  await screen.findByRole('heading', { name: /qué tal ha ido/i });
}

describe('shadowing: qué sonido se falló', () => {
  it('enseña dos sonidos como mucho, con la instrucción para la boca', async () => {
    const usuario = userEvent.setup();
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);
    await unIntento(usuario);

    const tarjetas = await screen.findAllByRole('article');
    expect(tarjetas.length).toBeLessThanOrEqual(2);

    // La /v/ de «seven» es el fallo más caro del doble: b y v son la misma letra
    // en español, así que es el primero que se explica.
    expect(screen.getByText(/labio de abajo toca los dientes de arriba/i)).toBeInTheDocument();
  });

  it('explica qué es un enlace, que es lo que nadie sabe que existe', async () => {
    const usuario = userEvent.setup();
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);
    await unIntento(usuario);

    expect(screen.getByText(/whaddaya doing/i)).toBeInTheDocument();
    expect(screen.getByText(/«up»/)).toBeInTheDocument();
  });

  it('avisa de que los sonidos también son de mentira mientras no haya servidor', async () => {
    // La fonética inventada viaja pegada al intento inventado, y ese ya lleva su
    // aviso arriba. Un dato falso que no se distingue de uno real es peor que no
    // tener dato.
    const usuario = userEvent.setup();
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);
    await unIntento(usuario);

    expect(screen.getByText(/datos de mentira/i)).toBeInTheDocument();
  });
});
