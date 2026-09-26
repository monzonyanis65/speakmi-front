import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Llamada } from './Llamada';

/**
 * La llamada vive de dos cosas que en las pruebas no existen: el sintetizador
 * del navegador y su reconocedor de voz. Se sustituyen los dos por versiones
 * que se pueden conducir a mano, porque lo que hay que comprobar es justo el
 * orden en que se encadenan: hablar, callar, escuchar, responder.
 */

/** Lo que se mandó decir. Igual que en `Dictado.test.tsx`. */
let dichas: string[] = [];

/** Las frases que todavía no han terminado de sonar, para cerrarlas a mano. */
let sonando: Array<{ onend: (() => void) | null }> = [];

/**
 * @param sola si la frase se termina por su cuenta. Con `false` se queda
 * sonando, que es lo que permite ver la pantalla mientras la mascota habla.
 */
function montarVozFalsa({ sola = true, ingles = true }: { sola?: boolean; ingles?: boolean } = {}) {
  dichas = [];
  sonando = [];

  class UtteranceFalsa {
    lang = '';
    rate = 1;
    pitch = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }

  vi.stubGlobal('SpeechSynthesisUtterance', UtteranceFalsa);
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [
      ingles
        ? { lang: 'en-US', name: 'Falsa', voiceURI: 'falsa-en', localService: false }
        : { lang: 'es-ES', name: 'Falsa', voiceURI: 'falsa-es', localService: true },
    ],
    cancel: vi.fn(),
    speak: (frase: UtteranceFalsa) => {
      dichas.push(frase.text);
      sonando.push(frase);
      if (sola) setTimeout(() => frase.onend?.(), 0);
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

/** Termina a mano la frase que está sonando. */
async function terminarDeHablar() {
  const frase = sonando.at(-1);
  await act(async () => {
    frase?.onend?.();
  });
}

/**
 * El mismo reconocedor de mentira de `reconocimiento.test.ts`: entrega trozos
 * cerrados con varias versiones y se para solo cuando le da la gana.
 */
class ReconocedorFalso {
  static ultimo: ReconocedorFalso | null = null;

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  arranques = 0;

  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    ReconocedorFalso.ultimo = this;
  }

  start() {
    this.arranques += 1;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }

  oye(...versiones: string[]) {
    const resultado = Object.assign(
      versiones.map((t) => ({ transcript: t, confidence: 0.9 })),
      { isFinal: true },
    );
    this.onresult?.({ resultIndex: 0, results: Object.assign([resultado], { length: 1 }) });
  }
}

const ESCENARIOS = {
  scenarios: [
    {
      code: 'CAFE',
      titleEs: 'Pedir en una cafetería',
      descripcionEs: 'Pides un café y pagas.',
      primeraFrase: 'Hi! What can I get you?',
    },
    {
      code: 'AEROPUERTO',
      titleEs: 'Facturar en el aeropuerto',
      descripcionEs: 'Entregas la maleta y pides asiento de ventanilla.',
      primeraFrase: 'Good morning, may I see your passport?',
    },
  ],
};

const APERTURA = 'Hi! What can I get you?';
const RESPUESTA = 'One coffee, coming right up.';

const CORRECCION = {
  hasErrors: true,
  corrected: 'I would like a coffee',
  errors: [
    {
      category: 'verb_tense',
      original: 'I wanting a coffee',
      correction: 'I would like a coffee',
      explanation_es: 'Para pedir algo se usa «would like», no el gerundio.',
    },
  ],
};

const RESUMEN = {
  resumen: {
    summary_es: 'Pediste un café sin dudar.',
    wentWell_es: ['Saludaste bien'],
    toImprove_es: ['Repasa «would like»'],
    phrases: [{ en: 'Could I have a coffee, please?', es: '¿Me pones un café, por favor?' }],
  },
  correcciones: [CORRECCION],
};

/** Suelta la respuesta del tutor cuando el servidor se pidió lento. */
let soltarTurno: (() => void) | null = null;

/** Un servidor de mentira con lo justo: escenarios, turnos y cierre. */
function servidor({
  correccion = CORRECCION,
  lento = false,
  oido,
}: { correccion?: unknown | null; lento?: boolean; oido?: string } = {}) {
  soltarTurno = null;

  return vi.fn((url: string) => {
    const responder = (cuerpo: unknown) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) });

    if (url.includes('/tutor/scenarios')) return responder(ESCENARIOS);
    // Sin `oido`, Whisper no está: la ruta no responde y se usa lo del navegador.
    if (url.includes('/speech/transcribe') && oido !== undefined) return responder({ text: oido });
    if (url.includes('/finish')) return responder(RESUMEN);
    if (url.includes('/turn')) {
      const cuerpo = { reply: RESPUESTA, correction: correccion };
      // Lento a propósito: mientras el tutor piensa es cuando se puede mirar
      // el botón, que en un servidor instantáneo pasa por ese estado sin verse.
      if (!lento) return responder(cuerpo);
      return new Promise((listo) => {
        soltarTurno = () => listo({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) });
      });
    }
    if (url.includes('/tutor/conversations')) {
      return responder({ conversationId: 'c1', opening: APERTURA, titleEs: 'Cafetería' });
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({ error: { code: 'SYS-003', message: 'Esa dirección no existe.' } }),
    });
  });
}

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <Llamada />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Entra en la llamada y espera a que la mascota haya soltado la primera frase. */
async function entrar(usuario: ReturnType<typeof userEvent.setup>) {
  renderizar();
  const escenario = await screen.findByRole('button', { name: /Pedir en una cafetería/ });
  await usuario.click(escenario);
  await waitFor(() => expect(dichas).toContain(APERTURA), { timeout: 4000 });
}

/** Si el grabador de mentira llegó a arrancar. */
let grabando = false;

/**
 * Un micrófono que graba de mentira: al parar entrega unos kilobytes de audio
 * falso, que es lo que la llamada manda a transcribir.
 */
function montarMicrofonoFalso() {
  grabando = false;

  class GrabadorFalso {
    static isTypeSupported = () => true;
    state: 'inactive' | 'recording' = 'inactive';
    mimeType = 'audio/webm';
    ondataavailable: ((evento: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;

    start() {
      this.state = 'recording';
      grabando = true;
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob([new Uint8Array(4000)], { type: 'audio/webm' }) });
      this.onstop?.();
    }
  }

  vi.stubGlobal('MediaRecorder', GrabadorFalso);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] }) },
  });
}

/** La petición que llegó a una ruta, con su cuerpo. */
function peticionA(falso: ReturnType<typeof servidor>, ruta: string) {
  const llamada = falso.mock.calls.find(([url]) => String(url).includes(ruta)) as
    [string, RequestInit] | undefined;
  return llamada;
}

beforeEach(() => {
  ReconocedorFalso.ultimo = null;
  vi.stubGlobal('SpeechRecognition', ReconocedorFalso);
  montarVozFalsa();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('llamada con la mascota', () => {
  it('ofrece los escenarios que devuelve el servidor', async () => {
    vi.stubGlobal('fetch', servidor());
    renderizar();

    expect(
      await screen.findByRole('button', { name: /Pedir en una cafetería/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Facturar en el aeropuerto/ })).toBeInTheDocument();
    expect(screen.getByText('Pides un café y pagas.')).toBeInTheDocument();
  });

  it('sin reconocimiento de voz no se entra, y se explica qué hacer', async () => {
    vi.stubGlobal('fetch', servidor());
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', undefined);

    renderizar();

    expect(await screen.findByText(/no puedo escucharte/i)).toBeInTheDocument();
    expect(screen.getByText(/Chrome o en Edge/i)).toBeInTheDocument();
    // Lo que no puede pasar: colarse en una llamada que no oye nada.
    expect(
      screen.queryByRole('button', { name: /Pedir en una cafetería/ }),
    ).not.toBeInTheDocument();
  });

  it('sin voz inglesa tampoco se entra: sería enseñar mal la pronunciación', async () => {
    vi.stubGlobal('fetch', servidor());
    montarVozFalsa({ ingles: false });

    renderizar();

    expect(await screen.findByText(/no tengo voz inglesa/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Pedir en una cafetería/ }),
    ).not.toBeInTheDocument();
  });

  it('al empezar dice la primera frase en voz alta y la subtitula', async () => {
    vi.stubGlobal('fetch', servidor());
    const usuario = userEvent.setup();

    await entrar(usuario);

    expect(dichas).toEqual([APERTURA]);
    expect(await screen.findByText(APERTURA)).toBeInTheDocument();
  });

  it('el subtítulo se puede quitar y volver a poner', async () => {
    vi.stubGlobal('fetch', servidor());
    const usuario = userEvent.setup();

    await entrar(usuario);
    expect(await screen.findByText(APERTURA)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /Ocultar subtítulo/ }));
    expect(screen.queryByText(APERTURA)).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /Mostrar subtítulo/ }));
    expect(screen.getByText(APERTURA)).toBeInTheDocument();
  });

  it('el botón grande pasa por sus tres estados y no deja hablar encima', async () => {
    vi.stubGlobal('fetch', servidor({ lento: true }));
    // La frase se queda sonando: así se ve la pantalla mientras la mascota habla.
    montarVozFalsa({ sola: false });
    const usuario = userEvent.setup();

    await entrar(usuario);

    // Mientras habla, el botón está apagado: si no, el micrófono se oiría a sí mismo.
    const mientrasHabla = await screen.findByRole('button', { name: /Escucha a Milo/ });
    expect(mientrasHabla).toBeDisabled();

    await terminarDeHablar();
    const paraHablar = await screen.findByRole('button', { name: 'Pulsa para hablar' });
    expect(paraHablar).toBeEnabled();

    await usuario.click(paraHablar);
    const paraEnviar = await screen.findByRole('button', { name: 'Pulsa para enviar' });
    expect(paraEnviar).toBeInTheDocument();

    // Lo que se dice se manda al soltar el botón, y mientras se responde se espera.
    act(() => ReconocedorFalso.ultimo!.oye('I wanting a coffee'));
    await usuario.click(paraEnviar);

    expect(await screen.findByRole('button', { name: /está respondiendo/ })).toBeDisabled();

    await act(async () => soltarTurno!());
    await waitFor(() => expect(dichas).toContain(RESPUESTA));
  });

  it('el botón de repetir vuelve a decir la última frase', async () => {
    vi.stubGlobal('fetch', servidor());
    const usuario = userEvent.setup();

    await entrar(usuario);
    await screen.findByRole('button', { name: 'Pulsa para hablar' });

    await usuario.click(screen.getByRole('button', { name: /Repetir la última frase/ }));

    await waitFor(() => expect(dichas).toEqual([APERTURA, APERTURA]));
  });

  it('si el micrófono falla lo dice y se puede reintentar', async () => {
    vi.stubGlobal('fetch', servidor());
    const usuario = userEvent.setup();

    await entrar(usuario);
    await usuario.click(await screen.findByRole('button', { name: 'Pulsa para hablar' }));

    const motor = ReconocedorFalso.ultimo!;
    act(() => {
      motor.onerror!({ error: 'not-allowed' });
      motor.onend!();
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/permiso/i);
    // Nunca un botón muerto: se vuelve a ofrecer el intento.
    expect(screen.getByRole('button', { name: 'Pulsa para hablar' })).toBeEnabled();
  });

  it('al colgar pregunta qué tal fue y después enseña el repaso con las correcciones', async () => {
    vi.stubGlobal('fetch', servidor());
    const usuario = userEvent.setup();

    await entrar(usuario);
    const paraHablar = await screen.findByRole('button', { name: 'Pulsa para hablar' });

    await usuario.click(paraHablar);
    act(() => ReconocedorFalso.ultimo!.oye('I wanting a coffee'));
    await usuario.click(screen.getByRole('button', { name: 'Pulsa para enviar' }));
    await waitFor(() => expect(dichas).toContain(RESPUESTA));

    await usuario.click(screen.getByRole('button', { name: 'Colgar la llamada' }));

    expect(await screen.findByRole('heading', { name: /Qué tal fue/ })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: /Adecuada/ }));

    expect(await screen.findByRole('heading', { name: /Llamada terminada/ })).toBeInTheDocument();
    // Dos veces: lo que dijiste, y otra vez tachado dentro de la corrección.
    const veces = screen.getAllByText('I wanting a coffee');
    expect(veces).toHaveLength(2);
    expect(veces[1]).toHaveClass('line-through');
    expect(screen.getByText('I would like a coffee')).toBeInTheDocument();
    expect(screen.getByText(/gerundio/)).toBeInTheDocument();
  });

  it('lo que estuvo bien se marca como tal en el repaso', async () => {
    vi.stubGlobal('fetch', servidor({ correccion: null }));
    const usuario = userEvent.setup();

    await entrar(usuario);
    await usuario.click(await screen.findByRole('button', { name: 'Pulsa para hablar' }));
    act(() => ReconocedorFalso.ultimo!.oye('I would like a coffee'));
    await usuario.click(screen.getByRole('button', { name: 'Pulsa para enviar' }));
    await waitFor(() => expect(dichas).toContain(RESPUESTA));

    await usuario.click(screen.getByRole('button', { name: 'Colgar la llamada' }));
    await usuario.click(await screen.findByRole('button', { name: /Muy fácil/ }));

    expect(await screen.findByText(/Bien dicho/)).toBeInTheDocument();
  });

  it('manda lo que entendió Whisper, no el «jazz» del navegador', async () => {
    const falso = servidor({ oido: 'Yes.' });
    vi.stubGlobal('fetch', falso);
    montarMicrofonoFalso();
    const usuario = userEvent.setup();

    await entrar(usuario);
    await usuario.click(await screen.findByRole('button', { name: 'Pulsa para hablar' }));
    await waitFor(() => expect(grabando).toBe(true));
    act(() => ReconocedorFalso.ultimo!.oye('jazz'));
    await usuario.click(screen.getByRole('button', { name: 'Pulsa para enviar' }));

    await waitFor(() => expect(peticionA(falso, '/turn')).toBeTruthy());
    expect(JSON.parse(peticionA(falso, '/turn')![1].body as string)).toEqual({ text: 'Yes.' });

    // La pista para Whisper es lo último que dijo la mascota.
    expect(peticionA(falso, '/speech/transcribe')![0]).toContain(encodeURIComponent(APERTURA));
    // Y la conversación se abrió como llamada, para que el tutor lo sepa.
    expect(JSON.parse(peticionA(falso, '/tutor/conversations')![1].body as string)).toMatchObject({
      mode: 'voice',
    });
  });

  it('si Whisper no está, sigue con lo que entendió el navegador', async () => {
    const falso = servidor();
    vi.stubGlobal('fetch', falso);
    montarMicrofonoFalso();
    const usuario = userEvent.setup();

    await entrar(usuario);
    await usuario.click(await screen.findByRole('button', { name: 'Pulsa para hablar' }));
    await waitFor(() => expect(grabando).toBe(true));
    act(() => ReconocedorFalso.ultimo!.oye('I would like a coffee'));
    await usuario.click(screen.getByRole('button', { name: 'Pulsa para enviar' }));

    await waitFor(() => expect(dichas).toContain(RESPUESTA));
    expect(JSON.parse(peticionA(falso, '/turn')![1].body as string)).toEqual({
      text: 'I would like a coffee',
    });
  });

  it('en el repaso se puede practicar la pronunciación de la frase corregida', async () => {
    vi.stubGlobal('fetch', servidor());
    const usuario = userEvent.setup();

    await entrar(usuario);
    await usuario.click(await screen.findByRole('button', { name: 'Pulsa para hablar' }));
    act(() => ReconocedorFalso.ultimo!.oye('I wanting a coffee'));
    await usuario.click(screen.getByRole('button', { name: 'Pulsa para enviar' }));
    await waitFor(() => expect(dichas).toContain(RESPUESTA));

    await usuario.click(screen.getByRole('button', { name: 'Colgar la llamada' }));
    await usuario.click(await screen.findByRole('button', { name: /Muy fácil/ }));
    await usuario.click(await screen.findByRole('button', { name: /Practicar la pronunciación/ }));

    // Lo que se practica es la frase ya corregida, no la que tenía el fallo.
    expect(await screen.findByText(/Escúchala y dila en voz alta/)).toBeInTheDocument();
    expect(screen.getAllByText(/I would like a coffee/).length).toBeGreaterThan(0);
  });
});
