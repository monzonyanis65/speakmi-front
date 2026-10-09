"""
Saca los PNG del icono a partir de `public/favicon.svg`.

El original es el SVG y solo el SVG. Estos PNG existen porque ni iOS ni el
manifest de Android aceptan vectorial para el icono de la pantalla de inicio,
pero son una copia: si alguien retoca un ojo aquí y no allí, el icono de la
pestaña y el del teléfono dejan de ser el mismo dibujo, y eso no se nota hasta
que ya está publicado.

    python scripts/generar-iconos.py


EL MASKABLE, QUE ES EL QUE TIENE TRAMPA

Android no respeta la forma del icono: lo recorta con la que quiera el
fabricante —círculo, cuadrado blando, gota— y cada capa lo hace distinto. Por
eso el manifest declara una versión aparte con el dibujo más pequeño: todo lo
que importa tiene que caber en el círculo central, que es el 80 % del lado.

Aquí se consigue encogiendo la imagen ya montada en vez de volver a dibujarla
más pequeña. Vale porque el fondo es de un color liso: pegar la versión
reducida sobre ese mismo color no deja ninguna costura, y así no hay un segundo
trazado del bocadillo que mantener al día.
"""

import io
import os
import re
import sys

import pymupdf
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PUBLICO = os.path.join(os.path.dirname(AQUI), 'public')
ORIGEN = os.path.join(PUBLICO, 'favicon.svg')

# Lo que ocupa el dibujo dentro del maskable. Android garantiza el círculo
# central del 80 %; 78 deja un pelo de aire para que el borde no bese el corte.
PARTE_SEGURA = 0.78


def dibujo(lado: int) -> Image.Image:
    """El SVG rasterizado a `lado` píxeles."""
    svg = open(ORIGEN, encoding='utf8').read()
    documento = pymupdf.open(stream=svg.encode(), filetype='svg')
    escala = lado / 512
    pagina = documento[0].get_pixmap(matrix=pymupdf.Matrix(escala, escala), alpha=False)
    return Image.open(io.BytesIO(pagina.tobytes('png'))).convert('RGB')


def color_de_fondo() -> str:
    """El fondo que declara el propio SVG, para no escribirlo dos veces."""
    encontrado = re.search(r'<rect[^>]*fill="(#[0-9a-fA-F]{6})"', open(ORIGEN, encoding='utf8').read())
    if not encontrado:
        print('no se encontró el color de fondo en el SVG', file=sys.stderr)
        raise SystemExit(1)
    return encontrado.group(1)


def main() -> None:
    for nombre, lado in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
        dibujo(lado).save(os.path.join(PUBLICO, nombre))
        print(f'  {nombre:<24} {lado}x{lado}')

    grande = dibujo(512)
    dentro = round(512 * PARTE_SEGURA)
    lienzo = Image.new('RGB', (512, 512), color_de_fondo())
    hueco = (512 - dentro) // 2
    lienzo.paste(grande.resize((dentro, dentro), Image.LANCZOS), (hueco, hueco))
    lienzo.save(os.path.join(PUBLICO, 'icon-maskable-512.png'))
    print(f'  icon-maskable-512.png    512x512 (dibujo al {round(PARTE_SEGURA * 100)} %)')


main()
