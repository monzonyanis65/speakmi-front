import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ejercicio } from './Ejercicio';
import { codigoDeLeccion, repartoDe } from './escena';
import { NOMBRE_ESPECIE } from '@/lib/mascota-contexto';

/**
 * La voz se sustituye entera.
 *
 * No es por comodidad: la mitad de lo que hay que comprobar aquí es lo que pasa
 * cuando NO hay voz, y eso en un jsdom real no se puede provocar porque nunca la
 * hay. Con el módulo falso se pueden probar los dos mundos.
 */
const dichas: string[] = [];
let hayVoz = true;

/** El `<audio>` de mentira que el `decir` falso entrega por el gancho. */
const AUDIO_FALSO = { src: 'blob:escena' } as unknown as HTMLAudioElement;

vi.mock('@/lib/voz', () => ({
  decir: (texto: string, opciones?: { alSonar?: (a: HTMLAudioElement) => void }) => {
    dichas.push(texto);
    // El servidor entrega su elemento antes de arrancarlo; se imita igual.
    opciones?.alSonar?.(AUDIO_FALSO);
    return Promise.resolve();
  },
  callar: () => {},
  hayVozInglesa: () => Promise.resolve(hayVoz),
  vozInglesaYa: () => (hayVoz ? 'si' : 'no'),
}));

/**
 * El analizador también es de mentira: jsdom no tiene Web Audio.
 *
 * Lo que interesa comprobar no es la aritmética —eso está en `amplitud.test.ts`—
 * sino el ciclo de vida: que se engancha al audio que suena y, sobre todo, que
 * se suelta al cambiar de réplica. Un bucle de fotogramas que no se suelta no
 * rompe nada visible, solo se queda corriendo para siempre.
 */
const enganchados: HTMLAudioElement[] = [];
let soltados = 0;

vi.mock('@/lib/amplitud', () => ({
  seguirAmplitud: (audio: HTMLAudioElement) => {
    enganchados.push(audio);
    return () => {
      soltados += 1;
    };
  },
}));

const ESCENA = {
  code: 'L5-U3-03-E04',
  type: 'dialogue_scene',
  difficulty: 3,
  prompt: {
    instruction_es: 'Mira la escena y responde.',
    escena: 'en un puesto del mercado',
    turnos: [
      { quien: 'A', en: 'These boots are nice.', es: 'Estas botas están bien.', animo: 'feliz' },
      { quien: 'B', en: 'Sixty. Those are forty.', es: 'Sesenta. Aquellas cuarenta.' },
      { quien: 'A', en: 'Let me see those.', es: 'Déjame ver aquellas.' },
      { quien: 'B', en: 'They only come in small sizes.', es: 'Solo vienen en tallas pequeñas.' },
    ],
    question_es: '¿Por qué se lleva las de sesenta?',
    options: [
      { text: 'Porque las de cuarenta no vienen en su talla' },
      { text: 'Porque las botas de cuarenta ya están vendidas' },
      { text: 'Porque las de sesenta vienen en más tallas' },
    ],
  },
};

/** La misma escena, otro ejercicio de LA MISMA lección. */
const OTRA_DE_LA_MISMA_LECCION = { ...ESCENA, code: 'L5-U3-03-E05' };

function montar(ejercicio = ESCENA, extra: Record<string, unknown> = {}) {
  return render(
    <Ejercicio
      ejercicio={ejercicio}
      bloqueado={false}
      onCambio={() => {}}
      {...(extra as { bloqueado?: boolean })}
    />,
  );
}

/** La réplica que está sonando ahora, que es la única con `aria-current`. */
function replicaActual(): string {
  const actual = document.querySelector('[aria-current="true"]');
  return actual?.textContent ?? '';
}

beforeEach(() => {
  dichas.length = 0;
  enganchados.length = 0;
  soltados = 0;
  hayVoz = true;
});

afterEach(() => cleanup());

describe('la escena se puede seguir', () => {
  it('empieza por la primera réplica y solo enseña lo que ya se ha dicho', () => {
    montar();

    expect(screen.getByText('These boots are nice.')).toBeInTheDocument();
    // Lo que todavía no se ha dicho no está en pantalla: si estuviera, la escena
    // sería un texto y no una conversación que pasa.
    expect(screen.queryByText('They only come in small sizes.')).not.toBeInTheDocument();
  });

  it('siempre se puede volver atrás y repetir una réplica', async () => {
    const persona = userEvent.setup();
    montar();

    await persona.click(screen.getByRole('button', { name: 'Réplica siguiente' }));
    expect(replicaActual()).toContain('Sixty. Those are forty.');

    await persona.click(screen.getByRole('button', { name: 'Réplica anterior' }));
    expect(replicaActual()).toContain('These boots are nice.');

    // Y repetir nunca está apagado: es el botón del que se despistó un segundo.
    expect(screen.getByRole('button', { name: 'Repetir esta réplica' })).toBeEnabled();

    dichas.length = 0;
    await persona.click(screen.getByRole('button', { name: 'Repetir esta réplica' }));
    expect(dichas).toContain('These boots are nice.');
  });

  it('se puede saltar directamente a una réplica ya vista', async () => {
    const persona = userEvent.setup();
    montar();

    const siguiente = screen.getByRole('button', { name: 'Réplica siguiente' });
    await persona.click(siguiente);
    await persona.click(siguiente);

    await persona.click(screen.getByText('These boots are nice.'));
    expect(replicaActual()).toContain('These boots are nice.');
  });
});

describe('la pregunta no se puede contestar sin ver la escena', () => {
  /*
    Es la regla de la que cuelga todo lo demás.

    Una pregunta visible desde el primer segundo cambia lo que se mira: quien la
    ve deja de ver la escena y se pone a buscar dentro de ella la palabra que
    aparece en una de las opciones. Comprobada al revés: quitando la condición
    del `escenaVista` y enseñando la pregunta siempre, esta prueba se pone roja.
  */
  it('no está mientras queden réplicas por ver', () => {
    montar();
    expect(screen.queryByText('¿Por qué se lleva las de sesenta?')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /no vienen en su talla/ })).not.toBeInTheDocument();
  });

  it('aparece al llegar al final, y ya no se va si se rebobina', async () => {
    const persona = userEvent.setup();
    montar();

    const siguiente = screen.getByRole('button', { name: 'Réplica siguiente' });
    for (let n = 0; n < 3; n += 1) await persona.click(siguiente);

    expect(screen.getByText('¿Por qué se lleva las de sesenta?')).toBeInTheDocument();

    // Volver atrás a repasar no puede esconder la pregunta: se repasa JUSTO para
    // poder contestarla.
    await persona.click(screen.getByRole('button', { name: 'Réplica anterior' }));
    expect(screen.getByText('¿Por qué se lleva las de sesenta?')).toBeInTheDocument();
  });
});

describe('sin voz la escena sigue siendo una escena', () => {
  it('no se promete ningún audio ni se intenta decir nada', async () => {
    hayVoz = false;
    const persona = userEvent.setup();
    montar();

    expect(await screen.findByText(/Aquí no hay voz inglesa/)).toBeInTheDocument();
    // Ni un altavoz que no suene: se pulsaría, no pasaría nada, y quien lo
    // pulsara creería que se le ha roto la aplicación.
    expect(screen.queryByRole('button', { name: /escuchar|altavoz|sonido/i })).toBeNull();

    // Y lo que importa: la escena se sigue pudiendo ver entera.
    const siguiente = screen.getByRole('button', { name: 'Réplica siguiente' });
    for (let n = 0; n < 3; n += 1) await persona.click(siguiente);
    expect(screen.getByText('They only come in small sizes.')).toBeInTheDocument();
    expect(dichas).toEqual([]);
  });

  it('con voz se dice el inglés y nunca la traducción', async () => {
    const persona = userEvent.setup();
    montar();

    await persona.click(screen.getByRole('button', { name: 'Réplica siguiente' }));
    expect(dichas).toContain('Sixty. Those are forty.');
    expect(dichas).not.toContain('Sesenta. Aquellas cuarenta.');
  });
});

describe('el reparto', () => {
  it('el mismo papel lo hace el mismo personaje en toda la lección', () => {
    const reparto = repartoDe(codigoDeLeccion(ESCENA.code));

    const primera = montar();
    const nombreEnLaPrimera = within(primera.container).getAllByRole('listitem')[0]!.textContent;
    cleanup();

    const segunda = montar(OTRA_DE_LA_MISMA_LECCION);
    const nombreEnLaSegunda = within(segunda.container).getAllByRole('listitem')[0]!.textContent;

    expect(nombreEnLaPrimera).toContain(NOMBRE_ESPECIE[reparto.A]);
    expect(nombreEnLaSegunda).toContain(NOMBRE_ESPECIE[reparto.A]);
  });

  it('se ve de quién es cada réplica sin tener que oírla', async () => {
    const persona = userEvent.setup();
    const reparto = repartoDe(codigoDeLeccion(ESCENA.code));
    montar();

    expect(replicaActual()).toContain(NOMBRE_ESPECIE[reparto.A]);
    await persona.click(screen.getByRole('button', { name: 'Réplica siguiente' }));
    expect(replicaActual()).toContain(NOMBRE_ESPECIE[reparto.B]);
  });
});

describe('corregida', () => {
  it('se puede seguir repasando la escena después de contestar', async () => {
    const persona = userEvent.setup();
    montar(ESCENA, { bloqueado: true });

    const siguiente = screen.getByRole('button', { name: 'Réplica siguiente' });
    // Bloqueado es no poder RESPONDER otra vez, no no poder mirar. Quien acaba
    // de fallar es exactamente quien más necesita volver a ver la escena.
    expect(siguiente).toBeEnabled();
    await persona.click(siguiente);
    expect(replicaActual()).toContain('Sixty. Those are forty.');
  });
});

describe('la boca va con lo que suena', () => {
  it('se engancha al audio que entrega la voz, no a otra cosa', () => {
    montar();
    // Sin esto la boca haría su ciclo propio: se movería igual, pero no diría
    // nada de lo que se está oyendo.
    expect(enganchados).toEqual([AUDIO_FALSO]);
  });

  it('se suelta al cambiar de réplica', async () => {
    const persona = userEvent.setup();
    montar();

    await persona.click(screen.getByRole('button', { name: 'Réplica siguiente' }));

    expect(soltados).toBeGreaterThanOrEqual(1);
    // Y se vuelve a enganchar al de la réplica nueva: si no, la segunda frase
    // sonaría con la boca parada.
    expect(enganchados.length).toBeGreaterThanOrEqual(2);
  });

  it('sin voz no se engancha nada, porque no hay nada que medir', async () => {
    hayVoz = false;
    montar();

    await screen.findByText(/Aquí no hay voz inglesa/);
    expect(enganchados).toEqual([]);
  });
});
