import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shadowing } from './Shadowing';
import type { Sonda } from '@/lib/auriculares';

/**
 * Lo que se sustituye aquí es solo el hardware: el pitido que mide la fuga y el
 * micrófono. Los datos del ejercicio no se tocan, se usa el doble que ya trae
 * `lib/shadowing`, que es el mismo que ve quien abre /shadowing.
 */
let sonda: Sonda = { fuga: 'sin-fuga', subidaDb: 2, motivo: 'El micrófono casi no oyó el pitido.' };

vi.mock('@/lib/auriculares', () => ({
  sePuedeSondar: () => true,
  sondarFugaDeAltavoz: () => Promise.resolve(sonda),
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
// jsdom tampoco implementa `pause`, y la pantalla la llama al desmontarse.
vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

beforeEach(() => {
  sonda = { fuga: 'sin-fuga', subidaDb: 2, motivo: 'El micrófono casi no oyó el pitido.' };
  reproducir.mockClear();
  // jsdom no trae ninguna de las dos y la pantalla libera el blob al desmontarse.
  URL.createObjectURL = () => 'blob:mentira';
  URL.revokeObjectURL = () => {};
});

afterAll(() => reproducir.mockRestore());

const EJERCICIO = { code: 'L6-U1-01-E07' };

/** Graba y para: con el doble puesto, eso devuelve una corrección entera. */
async function unIntento(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(await screen.findByRole('button', { name: /repetir encima/i }));
  await usuario.click(await screen.findByRole('button', { name: /ya está, para/i }));
  await screen.findByRole('heading', { name: /qué tal ha ido/i });
}

describe('shadowing', () => {
  it('parte el texto en palabras cuando hay tiempos', async () => {
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);

    // Cada palabra va en su propio hueco porque hay que poder encender una sola.
    await waitFor(() => expect(screen.getAllByText('usually').length).toBeGreaterThan(0));
    expect(screen.getAllByText('seven').length).toBeGreaterThan(0);
  });

  /*
    El camino honesto: sin tiempos no se inventa un resaltado.

    Un resaltado calculado a ojo (repartir la frase entre la duración) va a
    destiempo casi siempre, y quien intenta seguirlo aprende a hablar mal con
    total confianza. Mejor la frase entera y decir por qué.
  */
  it('sin tiempos por palabra enseña la frase entera y lo dice', async () => {
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true, sinTiempos: true }} />);

    expect(await screen.findByText(/I usually get up at seven,/)).toBeInTheDocument();
    expect(screen.getByText(/no trae los tiempos de cada palabra/i)).toBeInTheDocument();
    expect(document.querySelector('[aria-current="true"]')).not.toHaveTextContent('usually');
  });

  it('el modo a la vez está desactivado mientras no se compruebe el micrófono', async () => {
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);

    const aLaVez = await screen.findByRole('radio', { name: /a la vez/i });
    expect(aLaVez).toBeDisabled();
    expect(screen.getByText(/Comprueba antes los auriculares/i)).toBeInTheDocument();
  });

  it('con el altavoz sonando, el modo a la vez sigue desactivado y explica por qué', async () => {
    sonda = {
      fuga: 'con-fuga',
      subidaDb: 27,
      motivo: 'El micrófono oyó el pitido: el sonido está saliendo por el altavoz.',
    };
    const usuario = userEvent.setup();
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);

    await usuario.click(await screen.findByRole('button', { name: /comprobar/i }));

    await waitFor(() => expect(screen.getByText(/\+27 dB/)).toBeInTheDocument());
    expect(screen.getByRole('radio', { name: /a la vez/i })).toBeDisabled();
    expect(screen.getByText(/puntuaría la voz del modelo/i)).toBeInTheDocument();
  });

  it('sin fuga, el modo a la vez se abre', async () => {
    const usuario = userEvent.setup();
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);

    await usuario.click(await screen.findByRole('button', { name: /comprobar/i }));

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /a la vez/i })).not.toBeDisabled(),
    );
  });

  it('cuando no se puede medir, tampoco se abre: no medir no es aprobar', async () => {
    sonda = {
      fuga: 'no-se-puede-saber',
      subidaDb: null,
      motivo: 'Tu navegador no deja apagar la cancelación de eco.',
    };
    const usuario = userEvent.setup();
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);

    await usuario.click(await screen.findByRole('button', { name: /comprobar/i }));

    // Sale dos veces a propósito: en el aviso de arriba y en el porqué del modo.
    await waitFor(() =>
      expect(screen.getAllByText(/no deja apagar la cancelación de eco/i).length).toBe(2),
    );
    expect(screen.getByRole('radio', { name: /a la vez/i })).toBeDisabled();
  });

  it('nunca ofrece nada por debajo de 0,75', async () => {
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);

    await screen.findByRole('button', { name: /escuchar 0,75/i });
    expect(screen.queryByRole('button', { name: /0,5/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /despacio/i })).toBeNull();
  });

  it('tras un intento enseña dónde se descuadró, no solo el porcentaje', async () => {
    const usuario = userEvent.setup();
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);

    await unIntento(usuario);

    expect(screen.getByText(/Dónde se descuadró/i)).toBeInTheDocument();
    // El doble mete 280 ms de silencio antes de «seven», donde el modelo
    // encadena: eso tiene que salir con nombre y con milisegundos, no como un %.
    expect(screen.getByText(/antes de «seven»: 280 ms/)).toBeInTheDocument();
  });

  /*
    El otro camino honesto: sin medida de ritmo no se enseña un número de ritmo.
    Los campos vienen igualmente en la respuesta, a cero, y pintarlos sería
    decirle a alguien que su desfase medio es de 0 ms cuando nadie lo ha medido.
  */
  it('sin medida de ritmo lo dice, en vez de enseñar ceros', async () => {
    const usuario = userEvent.setup();
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true, sinRitmo: true }} />);

    await unIntento(usuario);

    expect(screen.getByText(/todavía no se puede medir/i)).toBeInTheDocument();
    expect(screen.queryByText(/de desfase medio/i)).toBeNull();
    expect(screen.queryByText(/acentos/i)).toBeNull();
  });

  /*
    El marcador principal tiene que ser el de los acentos.

    El doble devuelve el caso trampa: correlación 0,84 y 1 de 5 acentos, que es
    lo que saca un lector silábico. Si la pantalla enseñara la correlación en
    grande, le daría la enhorabuena justo a quien peor lo está haciendo, que es
    el fallo que esta prueba existe para que no vuelva.
  */
  it('el marcador grande es el de los acentos, no la correlación', async () => {
    const usuario = userEvent.setup();
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);

    await unIntento(usuario);

    const acentos = screen.getByText('1/5');
    expect(acentos.className).toContain('text-3xl');
    expect(screen.getByText(/sílabas fuertes pisadas/i)).toBeInTheDocument();
    expect(screen.getByText(/aplasta las sílabas débiles/i)).toBeInTheDocument();

    // La correlación se enseña, pero en letra pequeña y avisando de que engaña.
    const correlacion = screen.getByText(/se parece un 84 % a la suya/i);
    expect(correlacion.className).toContain('text-xs');
    expect(correlacion).toHaveTextContent(/aunque el ritmo siga siendo español/i);
  });

  it('avisa de que lo que se ve son datos de mentira', async () => {
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);

    expect(await screen.findByText(/Datos de mentira/i)).toBeInTheDocument();
  });

  it('los botones que se tocan llegan a los 44 px', async () => {
    render(<Shadowing ejercicio={EJERCICIO} opciones={{ simular: true }} />);

    const trozos = await screen.findByRole('navigation', { name: /trozos/i });
    for (const boton of within(trozos).getAllByRole('button')) {
      expect(boton.className).toMatch(/min-h-11/);
      expect(boton.className).toMatch(/min-w-11/);
    }
  });
});
