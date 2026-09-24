import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Destello, PuntosGanados } from './efectos';
import { Racha, Reloj } from './Tablero';

const sonar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/sonido', () => ({ sonar, useDespertarSonido: () => undefined }));

function ponerMenosMovimiento(activo: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (consulta: string) => ({
      matches: consulta.includes('prefers-reduced-motion') ? activo : false,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

beforeEach(() => {
  sonar.mockClear();
  ponerMenosMovimiento(false);
});

describe('Reloj', () => {
  it('no tictaquea mientras sobra tiempo', () => {
    const { rerender } = render(<Reloj restantes={45} total={60} />);
    rerender(<Reloj restantes={30} total={60} />);
    rerender(<Reloj restantes={11} total={60} />);

    expect(sonar).not.toHaveBeenCalled();
  });

  /*
    El reloj se refresca cuatro veces por segundo para que la barra no vaya a
    saltos. Sin acordarse del último segundo sonado, eso serían cuatro tics por
    segundo: una alarma, no un reloj.
  */
  it('tictaquea una vez por segundo en los últimos diez, y solo una', () => {
    const { rerender } = render(<Reloj restantes={10} total={60} />);
    rerender(<Reloj restantes={10} total={60} />);
    rerender(<Reloj restantes={10} total={60} />);

    expect(sonar).toHaveBeenCalledTimes(1);
    expect(sonar).toHaveBeenCalledWith('tic', { urgente: false });

    rerender(<Reloj restantes={9} total={60} />);
    expect(sonar).toHaveBeenCalledTimes(2);
  });

  it('los últimos tres segundos suenan más arriba', () => {
    const { rerender } = render(<Reloj restantes={4} total={60} />);
    rerender(<Reloj restantes={3} total={60} />);

    expect(sonar).toHaveBeenLastCalledWith('tic', { urgente: true });
  });

  it('a cero no suena: la partida ya se acabó', () => {
    render(<Reloj restantes={0} total={60} />);
    expect(sonar).not.toHaveBeenCalled();
  });

  it('con «menos movimiento» tampoco tictaquea', () => {
    ponerMenosMovimiento(true);
    render(<Reloj restantes={5} total={60} />);

    /*
      El tic se manda igual y es `sonar` quien se calla, porque la preferencia
      puede cambiar entre el render y el pitido. Lo que aquí se comprueba es lo
      otro: que nada se mueva.
    */
    expect(document.querySelector('.animate-latido')).toBeNull();
  });
});

describe('Racha', () => {
  it('no aparece hasta la segunda seguida', () => {
    const { rerender } = render(<Racha racha={1} />);
    expect(screen.queryByText(/seguidas/)).not.toBeInTheDocument();

    rerender(<Racha racha={2} />);
    expect(screen.getByText('2 seguidas')).toBeInTheDocument();
  });

  it('cambia de color y de tamaño según lo larga que sea', () => {
    const { container, rerender } = render(<Racha racha={2} />);
    const tibia = container.querySelector('span')?.className ?? '';

    rerender(<Racha racha={8} />);
    const ardiendo = container.querySelector('span')?.className ?? '';

    expect(tibia).not.toBe(ardiendo);
    expect(ardiendo).toContain('to-red-600');
  });
});

describe('efectos', () => {
  it('con «menos movimiento» no se pinta ni un destello ni los puntos volando', () => {
    ponerMenosMovimiento(true);
    const { container } = render(
      <>
        <Destello senal="acierto" />
        <PuntosGanados puntos={40} />
      </>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('sin esa preferencia, el destello y los puntos sí se pintan', () => {
    const { container } = render(
      <>
        <Destello senal="acierto" />
        <PuntosGanados puntos={40} />
      </>,
    );

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByText('+40')).toBeInTheDocument();
  });
});
