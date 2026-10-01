import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarcoConBarra } from '@/components/BarraInferior';
import { ALTO_BARRA, BORDE_BARRA, DESTINOS, HUECO_BARRA, hayBarraEn } from '@/lib/barra-inferior';

function pintar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <MarcoConBarra>
        <p>el contenido</p>
      </MarcoConBarra>
    </MemoryRouter>,
  );
}

/** El `div` que envuelve al contenido, que es quien tiene que reservar el hueco. */
function envoltorioDelContenido(): HTMLElement {
  const contenido = screen.getByText('el contenido');
  const envoltorio = contenido.parentElement;
  if (!envoltorio) throw new Error('El contenido tiene que ir dentro de un envoltorio');
  return envoltorio;
}

describe('la barra de abajo', () => {
  it('lleva a los cinco destinos y los nombra con palabras', () => {
    pintar('/ruta');

    const barra = screen.getByRole('navigation', { name: /secciones/i });
    const enlaces = screen.getAllByRole('link');

    expect(enlaces).toHaveLength(5);
    for (const destino of DESTINOS) {
      const enlace = screen.getByRole('link', { name: destino.etiqueta });
      expect(enlace).toHaveAttribute('href', destino.a);
      expect(barra).toContainElement(enlace);
    }
  });

  /*
    LOS CINCO SON DIBUJO PROPIO, NO EMOJIS.

    Un emoji no lo pinta la aplicación: lo pinta el sistema operativo, así que
    la misma barra sale plana en Android, brillante en iPhone y de otra manera
    en Windows, y al lado de nueve personajes dibujados a mano se lee como
    pegado de otro sitio. Esto se mira aquí porque la barra es lo único que se
    ve en TODAS las pantallas: si se cuela un emoji, se cuela en todas.

    El rango que se busca es el de los pictogramas y emoticonos. No incluye el
    «›» ni la «·», que son tipografía y los pinta la misma fuente que el texto.
  */
  it('los cinco llevan dibujo propio y ni un solo emoji', () => {
    const { container } = pintar('/ruta');

    const barra = screen.getByRole('navigation', { name: /secciones/i });
    expect(container.querySelectorAll('nav svg')).toHaveLength(5);
    expect(barra.textContent, 'se coló un emoji en la barra').not.toMatch(
      // El selector de variación va aparte y no dentro de la clase: ahí dentro
      // se combina con el carácter anterior y eslint lo rechaza con razón.
      /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{2600}-\u{27BF}]|\u{FE0F}/u,
    );
  });

  /*
    LA SEGUNDA SEÑAL DE «ESTÁS AQUÍ», LA QUE NO DEPENDE DEL COLOR.

    La pestaña de arriba y el morado se pierden para quien no distingue bien los
    tonos. Un icono macizo al lado de cuatro huecos se ve siempre, y es
    exactamente la misma información.

    Esta prueba se rompió a propósito antes de darla por buena: con el relleno
    desconectado —`relleno={false}` fijo en la barra— se pone roja en la primera
    expectativa, y con los emojis de antes se pone roja en las tres.
  */
  it('el destino en el que estás se pinta relleno, y los otros cuatro en línea', () => {
    const { container } = pintar('/tienda');

    const rellenos = [...container.querySelectorAll('nav svg')].filter((svg) =>
      svg.querySelector('[fill="currentColor"]'),
    );

    expect(rellenos, 'ninguno o más de uno se pinta relleno').toHaveLength(1);
    const enlace = rellenos[0]!.closest('a');
    expect(enlace).toHaveAccessibleName('Tienda');
    expect(enlace).toHaveAttribute('aria-current', 'page');
  });

  /*
    Se recorre tabulando y en el orden en que se ve. Son enlaces de verdad y no
    divs con un `onClick`, que es lo que lo hace funcionar sin tocar nada.
  */
  it('se recorre entera con el tabulador, de izquierda a derecha', async () => {
    const usuario = userEvent.setup();
    pintar('/ruta');

    for (const destino of DESTINOS) {
      await usuario.tab();
      expect(document.activeElement).toHaveAccessibleName(destino.etiqueta);
    }
  });

  it('anuncia en cuál de los cinco estás, y solo en uno', () => {
    pintar('/juegos');

    const marcados = screen.getAllByRole('link').filter((e) => e.getAttribute('aria-current'));

    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toHaveAccessibleName('Juegos');
    expect(marcados[0]).toHaveAttribute('aria-current', 'page');
  });

  /*
    Una pantalla de dentro tiene que iluminar la sección de la que cuelga. Sin
    esto, en los ajustes no habría ningún botón marcado y quien navega con
    lector de pantalla se quedaría sin saber dónde está.
  */
  it.each([
    ['/guia/U1', 'Aprender'],
    ['/misiones', 'Aprender'],
    ['/lecturas', 'Aprender'],
    ['/novedades', 'Liga'],
    ['/ajustes', 'Perfil'],
    ['/menu', 'Perfil'],
  ])('en %s se marca %s', (ruta, etiqueta) => {
    pintar(ruta);

    const marcados = screen.getAllByRole('link').filter((e) => e.getAttribute('aria-current'));

    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toHaveAccessibleName(etiqueta);
  });

  /*
    Donde hay algo empezado, la barra es un botón de abandonar pegado al de
    responder. Y antes de entrar no hay ni perfil ni liga que enseñar.
  */
  it.each([
    '/',
    '/recuperar',
    '/empezar',
    '/nivel',
    '/prueba',
    '/leccion/U1-L1',
    '/examen',
    '/repaso',
    '/llamada',
    '/conversar',
    '/juegos/CARRERA',
    '/lecturas/42',
    '/vivo',
    '/shadowing',
    '/escritura',
  ])('no sale en %s', (ruta) => {
    pintar(ruta);

    expect(screen.queryByRole('navigation', { name: /secciones/i })).not.toBeInTheDocument();
    expect(hayBarraEn(ruta)).toBe(false);
  });

  it('sale en el catálogo de juegos aunque no salga dentro de una partida', () => {
    expect(hayBarraEn('/juegos')).toBe(true);
    expect(hayBarraEn('/juegos/CAEN')).toBe(false);
  });

  it('sale en la lista de textos aunque no salga leyendo uno', () => {
    expect(hayBarraEn('/lecturas')).toBe(true);
    expect(hayBarraEn('/lecturas/7')).toBe(false);
  });

  /*
    LA PRUEBA QUE IMPORTA.

    La barra es fija, así que flota por encima del final de cada pantalla. El
    hueco lo reserva el marco, una sola vez, para las veintitantas pantallas a
    la vez; si se dejara a cada una, la mitad se olvidaría y su último botón
    quedaría debajo de la barra.

    Quitar el `paddingBottom` del marco pone esta prueba en rojo, que es justo
    lo que tiene que pasar: es el único sitio donde se reserva.
  */
  it('reserva por debajo del contenido el alto exacto de la barra', () => {
    pintar('/tienda');

    expect(envoltorioDelContenido()).toHaveStyle({ paddingBottom: HUECO_BARRA });
  });

  it('y ese hueco cuenta el borde de la barra, no solo su alto', () => {
    /*
      La de arriba compara el relleno contra HUECO_BARRA, que es la misma
      constante que está probando: si alguien se equivoca al calcularla, las dos
      mitades cambian a la vez y la prueba sigue verde. Lo comprobé poniendo
      HUECO_BARRA = ALTO_BARRA y no protestó nadie.

      Y ese error concreto ya ocurrió una vez: la barra mide 58 px, no 56,
      porque el borde de arriba también pinta. Con dos píxeles de menos el último
      botón de cada pantalla se queda justo por debajo de la línea, que es de
      los fallos que nadie denuncia porque parece un detalle del dibujo.

      En jsdom no hay layout, así que no se puede medir de verdad: lo que se
      puede exigir es que el cálculo siga teniendo las dos partes dentro.
    */
    expect(HUECO_BARRA, 'el hueco ya no cuenta el alto').toContain(ALTO_BARRA);
    expect(HUECO_BARRA, 'el hueco ya no cuenta el borde').toContain(BORDE_BARRA);
    expect(HUECO_BARRA, 'el hueco volvió a ser solo el alto').not.toBe(ALTO_BARRA);
  });

  /*
    Y lo contrario, que es la otra mitad del acuerdo: donde no hay barra no
    puede sobrar una franja vacía al final de la lección.
  */
  it('no reserva nada donde no hay barra', () => {
    pintar('/leccion/U1-L1');

    expect(envoltorioDelContenido().style.paddingBottom).toBe('');
  });
});
