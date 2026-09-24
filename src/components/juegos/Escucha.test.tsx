import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Escucha } from './Escucha';

const decir = vi.fn((_texto: string) => Promise.resolve());
const vozInglesaYa = vi.fn<() => 'si' | 'no' | 'todavia-no-se'>(() => 'si');
const hayVozInglesa = vi.fn(() => Promise.resolve(true));

vi.mock('@/lib/voz', () => ({
  decir: (texto: string) => decir(texto),
  // Falso a propósito: solo se usa para callar al sintetizador al salir, y en
  // jsdom no hay ninguno al que callar.
  hayVoz: () => false,
  hayVozInglesa: () => hayVozInglesa(),
  vozInglesaYa: () => vozInglesaYa(),
}));

const RONDA = {
  code: 'ESCUCHA',
  rondas: [
    { id: 'r1', diceEn: 'beach', opciones: ['beach', 'bitch', 'bench'] },
    { id: 'r2', diceEn: 'ship', opciones: ['sheep', 'ship', 'shape'] },
  ],
};

function renderizar() {
  const onFin = vi.fn();
  const onSalir = vi.fn();
  const onAjustes = vi.fn();
  const onResponder = vi.fn((_id: string, _respuesta: string) =>
    Promise.resolve({ isCorrect: true }),
  );

  render(
    <Escucha
      ronda={RONDA}
      onResponder={(id: string, respuesta: string) => onResponder(id, respuesta)}
      onFin={onFin}
      onSalir={onSalir}
      onAjustes={onAjustes}
    />,
  );

  return { onFin, onSalir, onAjustes, onResponder };
}

beforeEach(() => {
  decir.mockClear();
  vozInglesaYa.mockReturnValue('si');
  hayVozInglesa.mockResolvedValue(true);
});

describe('Escucha', () => {
  it('suena la palabra al entrar y se puede repetir', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await waitFor(() => expect(decir).toHaveBeenCalledWith('beach'));

    await usuario.click(screen.getByRole('button', { name: 'Escuchar la palabra otra vez' }));
    expect(decir).toHaveBeenCalledTimes(2);
  });

  it('al acertar enseña los puntos y deja pasar a la siguiente', async () => {
    const usuario = userEvent.setup();
    const { onResponder } = renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'beach' }));

    expect(onResponder).toHaveBeenCalledWith('r1', 'beach');
    expect(await screen.findByText(/¡Esa era!/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SIGUIENTE' })).toBeInTheDocument();
  });

  /*
    Lo que nos mordió en los dictados de la prueba de nivel: sin voz inglesa la
    pantalla se quedaba muda y sin salida. Aquí se comprueba antes de empezar.
  */
  it('sin voz inglesa no se queda encerrado: lo explica y ofrece salir', async () => {
    const usuario = userEvent.setup();
    vozInglesaYa.mockReturnValue('no');
    hayVozInglesa.mockResolvedValue(false);

    const { onSalir, onAjustes } = renderizar();

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/voz inglesa instalada/i);
    expect(decir).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole('button', { name: 'JUGAR A OTRA COSA' }));
    expect(onSalir).toHaveBeenCalled();

    await usuario.click(screen.getByRole('button', { name: 'Ver mis ajustes de voz' }));
    expect(onAjustes).toHaveBeenCalled();
  });

  it('si la voz falla a media partida, se puede saltar la palabra', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'No la oigo, saltar esta' }));

    await waitFor(() => expect(decir).toHaveBeenCalledWith('ship'));
  });

  it('al contestar la última, termina la partida', async () => {
    const usuario = userEvent.setup();
    const { onFin } = renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'beach' }));
    await usuario.click(await screen.findByRole('button', { name: 'SIGUIENTE' }));
    await usuario.click(await screen.findByRole('button', { name: 'ship' }));
    await usuario.click(await screen.findByRole('button', { name: 'VER RESULTADO' }));

    await waitFor(() => expect(onFin).toHaveBeenCalled());
    const marcador = onFin.mock.calls[0]?.[0] as { aciertos: number; puntuacion: number };
    // Diez el primero y veinte el segundo seguido: encadenar vale más.
    expect(marcador.aciertos).toBe(2);
    expect(marcador.puntuacion).toBe(30);
  });
});
