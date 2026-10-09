"""
Saca los PNG del icono a partir de `public/favicon.svg`.

El original es el SVG y solo el SVG. Estos PNG existen porque ni iOS ni el
manifest de Android aceptan vectorial para el icono de la pantalla de inicio,
pero son una copia: si alguien retoca un ojo aquí y no allí, el icono de la
pestaña y el del teléfono dejan de ser el mismo dibujo, y eso no se nota hasta
que ya está publicado.

    python scripts/generar-iconos.py


EL DEGRADADO DEL FONDO SE PINTA AQUÍ, Y NO ES UN CAPRICHO

El rasterizador que hay disponible (PyMuPDF) dibuja bien trazados, rellenos y
desenfoques, pero NO pinta degradados: deja el fondo en negro. Como el fondo del
icono es un degradado, se pinta en esta parte.

Lo que no se hace es escribir aquí los colores: se LEEN del propio SVG, de las
paradas de su `linearGradient`. Teclearlos otra vez sería dejar dos verdades
sobre el mismo color, y la segunda siempre se queda vieja. Por eso el `<rect>`
del fondo lleva `id="fondo"`: se quita antes de rasterizar y se sustituye por el
degradado pintado con esos mismos colores.


EL MASKABLE, QUE ES EL QUE TIENE TRAMPA

Android no respeta la forma del icono: lo recorta con la que quiera el
fabricante —círculo, cuadrado blando, gota— y cada capa lo hace distinto. Por
eso el manifest declara una versión aparte con el dibujo más pequeño: todo lo
que importa tiene que caber en el círculo central, que es el 80 % del lado.
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


def fuente() -> str:
    return open(ORIGEN, encoding='utf8').read()


def colores_del_fondo() -> tuple[str, str]:
    """Las dos paradas del degradado, leídas del SVG para no escribirlas dos veces."""
    paradas = re.findall(r'<stop[^>]*stop-color="(#[0-9a-fA-F]{6})"', fuente())
    if len(paradas) < 2:
        print('el SVG no declara un degradado de dos paradas', file=sys.stderr)
        raise SystemExit(1)
    return paradas[0], paradas[-1]


def degradado(lado: int) -> Image.Image:
    arriba, abajo = (tuple(int(c[i : i + 2], 16) for i in (1, 3, 5)) for c in colores_del_fondo())
    base = Image.new('RGB', (lado, lado))
    pixeles = base.load()
    for y in range(lado):
        t = y / (lado - 1)
        color = tuple(round(arriba[i] + (abajo[i] - arriba[i]) * t) for i in range(3))
        for x in range(lado):
            pixeles[x, y] = color
    return base


def dibujo(lado: int) -> Image.Image:
    """El SVG rasterizado a `lado` píxeles, ya sobre su degradado."""
    sin_fondo = re.sub(r'<rect id="fondo"[^>]*/>', '', fuente())
    documento = pymupdf.open(stream=sin_fondo.encode(), filetype='svg')
    escala = lado / 512
    pagina = documento[0].get_pixmap(matrix=pymupdf.Matrix(escala, escala), alpha=True)
    arte = Image.open(io.BytesIO(pagina.tobytes('png'))).convert('RGBA')

    fondo = degradado(lado).convert('RGBA')
    return Image.alpha_composite(fondo, arte).convert('RGB')


def main() -> None:
    for nombre, lado in [
        ('icon-192.png', 192),
        ('icon-512.png', 512),
        ('apple-touch-icon.png', 180),
    ]:
        dibujo(lado).save(os.path.join(PUBLICO, nombre))
        print(f'  {nombre:<24} {lado}x{lado}')

    # El maskable se encoge sobre el mismo degradado, no sobre un color liso:
    # pegarlo encima de un relleno plano dejaría una costura a media altura.
    grande = dibujo(512)
    dentro = round(512 * PARTE_SEGURA)
    lienzo = degradado(512)
    hueco = (512 - dentro) // 2
    lienzo.paste(grande.resize((dentro, dentro), Image.LANCZOS), (hueco, hueco))
    lienzo.save(os.path.join(PUBLICO, 'icon-maskable-512.png'))
    print(f'  icon-maskable-512.png    512x512 (dibujo al {round(PARTE_SEGURA * 100)} %)')


main()
