import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CifrasDeHoy } from './PanelInicio';

/**
 * La tira de cifras de la cabecera.
 *
 * Lo que se comprueba aquí es el color, que suena a capricho y no lo es: la
 * llama de la racha se enciende o se apaga según haya racha o no, y eso sí es
 * información. Una llama naranja al lado de un cero se lee como que algo va
 * bien cuando no va bien.
 *
 * Lo otro que se vigila es que el COLOR NO SE EXTIENDA al número. Cuatro cifras
 * de cuatro colores distintos es una fila de confeti donde no se lee ninguna, y
 * es la forma más fácil de que «ponerle colorcito» acabe estropeando la
 * pantalla que venía a mejorar.
 */

let progreso = {
  xpTotal: 716,
  leccionesCompletadas: 34,
  racha: { currentDays: 0, longestDays: 9, freezesAvailable: 0 },
  repasosPendientes: 0,
};

vi.mock('@/lib/api', () => ({
  api: {
    get: (ruta: string) => Promise.resolve(ruta.includes('wallet') ? { coins: 332 } : progreso),
  },
}));

vi.mock('@/lib/mascota-contexto', () => ({ useNombreMascota: () => 'Milo' }));
vi.mock('@/lib/recordatorio', () => ({
  avisarAhora: () => {},
  marcarAvisado: () => {},
  tocaAvisar: () => false,
}));

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <CifrasDeHoy />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** El envoltorio que lleva el color, que es el padre del dibujo. */
function colorDelIconoJuntoA(texto: string): string {
  const numero = screen.getByText(texto);
  const fila = numero.parentElement!;
  return fila.querySelector('span')?.className ?? '';
}

beforeEach(() => {
  progreso = {
    xpTotal: 716,
    leccionesCompletadas: 34,
    racha: { currentDays: 0, longestDays: 9, freezesAvailable: 0 },
    repasosPendientes: 0,
  };
});

describe('la tira de cifras', () => {
  it('sin racha, la llama está apagada', async () => {
    pintar();
    await screen.findByText('716');

    expect(colorDelIconoJuntoA('0')).toContain('texto-suave');
  });

  it('con racha, la llama se enciende', async () => {
    progreso = { ...progreso, racha: { currentDays: 10, longestDays: 10, freezesAvailable: 0 } };
    pintar();
    await screen.findByText('716');

    expect(colorDelIconoJuntoA('10')).toContain('orange');
  });

  it('el color se queda en el icono y no se lo lleva el número', async () => {
    progreso = { ...progreso, racha: { currentDays: 10, longestDays: 10, freezesAvailable: 0 } };
    pintar();

    // Los cuatro números, con cuatro iconos de cuatro colores al lado.
    for (const valor of ['10', '716', '332', '34']) {
      const numero = await screen.findByText(valor);
      const clases = numero.className;
      for (const tono of ['orange', 'amber', 'emerald', 'marca']) {
        expect(clases, `el número ${valor} se pintó de ${tono}`).not.toContain(tono);
      }
    }
  });
});
