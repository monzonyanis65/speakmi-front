import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Bienvenida } from './Bienvenida';
import { NIVELES, TRAMOS, tramoDe } from '@/data/niveles';

function renderizar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Bienvenida />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('sin servidor en las pruebas'))),
  );
});

describe('elección de nivel', () => {
  it('muestra los ocho niveles del curso', () => {
    renderizar();

    // Sin sesión en la prueba, el encabezado es el genérico.
    expect(screen.getByRole('heading', { name: 'Elige tu nivel' })).toBeInTheDocument();
    for (const nivel of NIVELES) {
      expect(screen.getByText(nivel.titulo)).toBeInTheDocument();
    }
  });

  it('los agrupa por tramo del Marco Común Europeo', () => {
    /*
      Ocho niveles en fila no dicen dónde acaba uno y empieza otro, y sobre todo
      no significan nada fuera de esta aplicación: nadie pone «nivel 5» en un
      currículum. Agrupados, elegir deja de ser «¿voy por el 4 o por el 5?»
      —que casi nadie sabe— y pasa a ser «¿soy A2?».
    */
    renderizar();

    for (const tramo of TRAMOS) {
      expect(
        screen.getByRole('heading', { name: tramo.nombre }),
        `falta el tramo ${tramo.letra}`,
      ).toBeInTheDocument();
    }
  });

  it('cada nivel del curso cae en un tramo, y ninguno se queda fuera', () => {
    const dentro = TRAMOS.flatMap((t) => t.niveles);
    for (const nivel of NIVELES) {
      expect(tramoDe(nivel.codigo), `${nivel.codigo} no está en ningún tramo`).toBeDefined();
    }
    // Y al revés: un tramo no puede prometer un nivel que no existe.
    for (const codigo of dentro) {
      expect(
        NIVELES.some((n) => n.codigo === codigo),
        `el tramo promete ${codigo}, que no existe`,
      ).toBe(true);
    }
    // Ni repetirse en dos tramos.
    expect(new Set(dentro).size).toBe(dentro.length);
  });

  it('dice claramente que B2, C1 y C2 todavía no tienen curso', () => {
    // Cortar la lista en B1 daría a entender que ahí se acaba el inglés.
    renderizar();

    const vacios = TRAMOS.filter((t) => t.niveles.length === 0);
    expect(vacios.map((t) => t.letra)).toEqual(['B2', 'C1', 'C2']);
    expect(screen.getAllByText(/Todavía no hay curso/)).toHaveLength(vacios.length);
  });

  it('la etiqueta de cada nivel empieza por la letra de su tramo', () => {
    // «A1+» es un escalón dentro de A1, no otro tramo. Si una etiqueta no
    // empezara por la letra de su grupo, la agrupación estaría mintiendo.
    for (const nivel of NIVELES) {
      const tramo = tramoDe(nivel.codigo)!;
      expect(nivel.cefr.startsWith(tramo.letra), `${nivel.codigo} dice ${nivel.cefr}`).toBe(true);
    }
  });

  it('no deja continuar hasta elegir un nivel', () => {
    renderizar();

    expect(screen.getByRole('button', { name: /elige un nivel/i })).toBeDisabled();
  });

  it('habilita el botón al elegir un nivel', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByText('Mi gente y mi barrio'));

    expect(screen.getByRole('button', { name: 'EMPEZAR' })).toBeEnabled();
  });

  it('marca como seleccionado solo el nivel elegido', async () => {
    const usuario = userEvent.setup();
    renderizar();

    const tarjeta = screen.getByText('Mi gente y mi barrio').closest('button');
    await usuario.click(tarjeta!);

    expect(tarjeta).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Empiezo de cero').closest('button')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('ofrece la prueba de nivel a quien no sabe cuál es el suyo', () => {
    renderizar();

    expect(screen.getByRole('button', { name: /haz la prueba de nivel/i })).toBeInTheDocument();
  });
});
