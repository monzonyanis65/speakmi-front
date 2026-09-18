import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Bienvenida } from './Bienvenida';
import { NIVELES } from '@/data/niveles';

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
