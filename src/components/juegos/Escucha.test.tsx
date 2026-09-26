import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Escucha } from './Escucha';

const decir = vi.fn((_texto: string) => Promise.resolve());
const vozInglesaYa = vi.fn<() => 'si' | 'no' | 'todavia-no-se'>(() => 'si');
const hayVozInglesa = vi.fn(() => Promise.resolve(true));

vi.mock('@/lib/voz', () => ({
  decir: (texto: string) => decir(texto),
  // Solo se usa para callar al salir, y en jsdom no hay nada a lo que callar.
  callar: () => {},
  hayVozInglesa: () => hayVozInglesa(),
  vozInglesaYa: () => vozInglesaYa(),
}));

/*
  Suena una palabra en INGLÉS y las opciones son sus significados en ESPAÑOL.

  Esto importa y aquí estuvo mal: la ronda de ejemplo traía opciones en inglés
  («beach» sonando y «beach / bitch / bench» para elegir), y con eso encima
  pasaba una comparación que en la aplicación de verdad no podía funcionar
  nunca. El juego marcaba en rojo la respuesta elegida aunque fuera la buena,
  mientras el servidor decía «¡Esa era!» y sumaba los puntos.

  Una ronda de mentira que no se parece a la de verdad no prueba nada.
*/
const RONDA = {
  code: 'ESCUCHA',
  rondas: [
    { id: 'r1', diceEn: 'beach', opciones: ['playa', 'banco', 'puente'] },
    { id: 'r2', diceEn: 'ship', opciones: ['oveja', 'barco', 'forma'] },
  ],
};

function renderizar(corrige?: (id: string, respuesta: string) => Promise<unknown>) {
  const onFin = vi.fn();
  const onSalir = vi.fn();
  const onAjustes = vi.fn();
  const onResponder = vi.fn(
    corrige ?? ((_id: string, _respuesta: string) => Promise.resolve({ isCorrect: true })),
  );

  render(
    <Escucha
      ronda={RONDA}
      onResponder={(id: string, respuesta: string) =>
        onResponder(id, respuesta) as Promise<{ isCorrect: boolean }>
      }
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

    await usuario.click(await screen.findByRole('button', { name: 'playa' }));

    expect(onResponder).toHaveBeenCalledWith('r1', 'playa');
    expect(await screen.findByText(/¡Esa era!/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SIGUIENTE' })).toBeInTheDocument();
  });

  it('al acertar, la opción buena sale en verde y NINGUNA en rojo', async () => {
    const usuario = userEvent.setup();
    renderizar();

    const buena = await screen.findByRole('button', { name: 'playa' });
    await usuario.click(buena);

    /*
      La regresión que encontró quien jugaba: acertabas, te sumaba los puntos y
      te decía «¡Esa era!», y al mismo tiempo te pintaba tu respuesta de rojo
      con una equis. Pasaba porque la pantalla buscaba la buena comparando la
      opción con la palabra inglesa que había sonado, y una traducción al
      español nunca coincide con ella. Quién es la buena solo lo sabe el
      servidor, y ahora se le pregunta.
    */
    expect(await screen.findByText(/¡Esa era!/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Correcta playa' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tu respuesta/ })).not.toBeInTheDocument();
  });

  it('al fallar marca la tuya en rojo, la buena en verde, y dice qué significaba', async () => {
    const usuario = userEvent.setup();
    renderizar(() =>
      Promise.resolve({
        isCorrect: false,
        feedback: { message_es: 'No era esa.', correcta: 'playa' },
      }),
    );

    await usuario.click(await screen.findByRole('button', { name: 'banco' }));

    expect(await screen.findByRole('button', { name: 'Tu respuesta banco' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Correcta playa' })).toBeInTheDocument();
    // Y se dice qué era: «sonaba beach» a secas no le enseña nada a quien
    // acaba de fallar precisamente por no saber qué es «beach».
    expect(screen.getByText('Sonaba «beach»: playa')).toBeInTheDocument();
  });

  it('si el servidor no contesta no se inventa el veredicto', async () => {
    const usuario = userEvent.setup();
    renderizar(() => Promise.reject(new Error('sin red')));

    await usuario.click(await screen.findByRole('button', { name: 'playa' }));

    // Ni acierto ni fallo: se devuelve la ronda para volver a intentarlo.
    expect(await screen.findByText(/No pudimos comprobarlo/)).toBeInTheDocument();
    expect(screen.queryByText(/¡Esa era!/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'playa' })).toBeEnabled();
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

    await usuario.click(await screen.findByRole('button', { name: 'playa' }));
    await usuario.click(await screen.findByRole('button', { name: 'SIGUIENTE' }));
    await usuario.click(await screen.findByRole('button', { name: 'barco' }));
    await usuario.click(await screen.findByRole('button', { name: 'VER RESULTADO' }));

    await waitFor(() => expect(onFin).toHaveBeenCalled());
    const marcador = onFin.mock.calls[0]?.[0] as { aciertos: number; puntuacion: number };
    /*
      Diez por acierto, que es exactamente lo que calculará el servidor en
      `/fin`. Antes aquí se esperaban treinta, con un bonus de racha que el
      servidor no aplica: era la cifra de la partida yéndose de la del final.
    */
    expect(marcador.aciertos).toBe(2);
    expect(marcador.puntuacion).toBe(28);
  });
});
