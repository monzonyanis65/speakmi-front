import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComoSonaste } from './ComoSonaste';
import type { PalabraConFonemas } from '@/lib/fonetica';

/**
 * Lo que se comprueba aquí no es que la pantalla pinte: es que no miente y que no
 * regaña. Son las dos cosas que se rompen solas en cuanto alguien toca esto con
 * prisa, porque las dos se rompen hacia el lado cómodo —enseñar un cero cuando no
 * hay dato, enseñar la lista entera porque «es información»— y ninguna de las dos
 * roturas da un error en consola.
 */

function palabra(texto: string, ...sonidos: Array<[string, number]>): PalabraConFonemas {
  return {
    palabra: texto,
    indicePalabra: 0,
    fonemas: sonidos.map(([simbolo, puntuacion]) => ({ simbolo, puntuacion })),
  };
}

/** Nueve sonidos a medias: el intento que más fácil se lee como una bronca. */
const UN_DESASTRE: PalabraConFonemas[] = [
  { palabra: 'very', indicePalabra: 0, fonemas: [{ simbolo: 'v', puntuacion: 20 }] },
  { palabra: 'sheep', indicePalabra: 1, fonemas: [{ simbolo: 'iː', puntuacion: 30 }] },
  { palabra: 'think', indicePalabra: 2, fonemas: [{ simbolo: 'θ', puntuacion: 35 }] },
  { palabra: 'zoo', indicePalabra: 3, fonemas: [{ simbolo: 'z', puntuacion: 40 }] },
  { palabra: 'hat', indicePalabra: 4, fonemas: [{ simbolo: 'h', puntuacion: 45 }] },
  { palabra: 'cat', indicePalabra: 5, fonemas: [{ simbolo: 'æ', puntuacion: 50 }] },
  { palabra: 'red', indicePalabra: 6, fonemas: [{ simbolo: 'ɹ', puntuacion: 55 }] },
];

describe('no se inventa números', () => {
  it('con fonemas a null dice que no se pudo medir y no enseña ni una cifra', () => {
    /*
      ESTA ES LA PRUEBA QUE MÁS IMPORTA DE TODO EL ARCHIVO.

      `null` quiere decir «no se pudo medir», y la salida cómoda es pintar un 0 %
      o un «0 de 0 sonidos». Quien lo lea se creerá que lo hizo fatal y se pondrá
      a arreglar algo que a lo mejor ya hacía bien. Se comprueba que en ese aviso
      no hay NINGÚN dígito, que es más estricto que buscar un «0 %» concreto y no
      se puede esquivar cambiando el formato.
    */
    render(<ComoSonaste fonemas={null} />);

    const aviso = screen.getByText(/no pudimos mirar tus sonidos/i);
    expect(aviso).toBeInTheDocument();
    expect(aviso.textContent ?? '').not.toMatch(/\d/);
  });

  it('con cortes a null no cuenta ningún corte', () => {
    render(<ComoSonaste cortes={null} />);

    const aviso = screen.getByText(/no se pudieron medir/i);
    expect(aviso.textContent ?? '').not.toMatch(/\d/);
  });

  it('con prosodia a null no enseña una nota', () => {
    render(<ComoSonaste prosodia={null} />);

    const aviso = screen.getByText(/no se pudo medir esta vez/i);
    expect(aviso.textContent ?? '').not.toMatch(/\d/);
  });

  it('sin los campos no enseña el bloque siquiera', () => {
    // Un servidor que todavía no evalúa fonética no tiene por qué dejar un hueco
    // gris: parecería que algo se ha roto.
    const { container } = render(<ComoSonaste />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('vacío y null no son lo mismo', () => {
  it('la lista vacía de cortes es una buena noticia, no una falta de medida', () => {
    render(<ComoSonaste cortes={[]} />);

    expect(screen.getByText(/enlazaste las palabras/i)).toBeInTheDocument();
    expect(screen.queryByText(/no se pudieron medir/i)).not.toBeInTheDocument();
  });

  it('con todos los sonidos por encima del umbral felicita', () => {
    render(<ComoSonaste fonemas={[palabra('cat', ['k', 95], ['æ', 90], ['t', 88])]} />);

    expect(screen.getByText(/no hay nada que corregirte/i)).toBeInTheDocument();
    expect(screen.queryByText(/no pudimos mirar/i)).not.toBeInTheDocument();
  });
});

describe('enseña, no regaña', () => {
  it('con siete sonidos a medias enseña dos y esconde el resto', () => {
    render(<ComoSonaste fonemas={UN_DESASTRE} />);

    // Dos tarjetas, ni una más, aunque haya siete sonidos flojos.
    expect(screen.getAllByRole('article')).toHaveLength(2);
    // Y lo primero que se lee es cuántos salieron bien, no cuántos fallaron.
    expect(screen.getByText(/sonidos te salieron/i)).toBeInTheDocument();
  });

  it('el resto está guardado pero no escondido', async () => {
    const usuario = userEvent.setup();
    render(<ComoSonaste fonemas={UN_DESASTRE} />);

    /*
      La /h/ es la quinta en deuda. Está en el árbol, dentro de un `details`
      cerrado, y por eso se comprueba que no SE VE en vez de que no esté: quien
      usa lector de pantalla tiene que poder llegar a ella, y quien acaba de leer
      una frase en alto no tiene por qué encontrársela delante.
    */
    expect(screen.getByText(/el soplo/i)).not.toBeVisible();

    await usuario.click(screen.getByText(/sonidos más a medias/i));
    expect(screen.getByText(/el soplo/i)).toBeVisible();
  });

  it('cada tarjeta dice qué hacer con la boca, no qué nota sacó', () => {
    render(<ComoSonaste fonemas={[palabra('very', ['v', 25])]} />);

    const tarjeta = screen.getByRole('article');
    expect(tarjeta).toHaveTextContent(/labio de abajo toca los dientes de arriba/i);
    // La puntuación del fonema no se enseña nunca: no le dice nada a nadie y
    // solo da algo que comparar.
    expect(tarjeta.textContent ?? '').not.toContain('25');
  });

  it('con la s de school explica la e que se cuela, no cómo se hace una s', () => {
    render(
      <ComoSonaste fonemas={[palabra('school', ['s', 40], ['k', 90], ['uː', 90], ['l', 90])]} />,
    );

    expect(screen.getByRole('article')).toHaveTextContent(/una «e» delante de la s/i);
  });
});

describe('los enlaces', () => {
  it('cuenta qué es un enlace y por qué importa para ENTENDER, no solo para sonar bien', () => {
    render(
      <ComoSonaste
        cortes={[{ indicePalabra: 2, tipo: 'sobra' }]}
        palabras={['I', 'get', 'up', 'early']}
      />,
    );

    expect(screen.getByText(/whaddaya doing/i)).toBeInTheDocument();
    expect(screen.getByText(/no entiendas a un nativo hablando rápido/i)).toBeInTheDocument();
  });

  it('nombra la palabra donde cortaste cuando se le da el texto', () => {
    render(
      <ComoSonaste
        cortes={[{ indicePalabra: 2, tipo: 'sobra' }]}
        palabras={['I', 'get', 'up', 'early']}
      />,
    );

    expect(screen.getByText(/«up»/)).toBeInTheDocument();
  });

  it('sin el texto numera desde uno, no desde cero', () => {
    // «La palabra 0» no se lo dice a nadie que no sea programador.
    render(<ComoSonaste cortes={[{ indicePalabra: 0, tipo: 'falta' }]} />);
    expect(screen.getByText(/la palabra 1/i)).toBeInTheDocument();
  });
});
