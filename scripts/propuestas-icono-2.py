"""
Segunda tanda de propuestas de icono. Las de la primera no se tocan.

La diferencia con `propuestas-icono.py` no es el pájaro —es el mismo Milo, con
las mismas coordenadas de `milo.tsx`— sino cómo está pintado. Aquella tanda era
toda de colores planos porque el rasterizador de SVG que hay aquí no dibuja
degradados; esta los pinta aparte y los mete por una máscara, que es lo que
permite que la cabeza tenga volumen de verdad en vez de ser un círculo de un
solo tono.

    python scripts/propuestas-icono-2.py


CÓMO SE CONSIGUE EL VOLUMEN SIN DIBUJAR UNA SOMBRA

Dibujando cada pieza por separado y rellenándola con un degradado propio. La
cabeza va de un índigo claro arriba a uno oscuro abajo, que es como le daría la
luz, y el ojo y el pico se pegan encima planos. No es una sombra encima del
dibujo —que a 44 px ensucia— es el propio color de la pieza, que es lo que hacen
los iconos que se ven caros.
"""

import io
import math
import os

import pymupdf
from PIL import Image, ImageDraw, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(os.path.dirname(AQUI), 'disenos-icono-2')
LADO = 512

MARCA = {
    50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
    500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81',
}
ACENTO = {300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706'}
TINTA = '#0f172a'
CEJA = '#1e1b4b'

# El recorte del lienzo de 120 que se usa en toda esta tanda. Incluye el copete,
# que ahora asoma por encima del cráneo.
CAJA_RETRATO = '30 5 60 64'
CAJA_BUSTO = '24 5 72 80'
# Más ancha, para que quepan las ondas de sonido a la derecha del pico.
CAJA_CANTANDO = '28 5 86 86'


def rgb(valor: str):
    return tuple(int(valor[i : i + 2], 16) for i in (1, 3, 5))


# ---------------------------------------------------------------- las piezas


def pieza_craneo() -> str:
    return '<circle cx="60" cy="42" r="26" fill="#000"/>'


def pieza_copete() -> str:
    """
    El copete, en una capa propia.

    Tiene que rellenarse con un tono DISTINTO del cráneo. Metido en la misma
    máscara se rellena con el mismo degradado y desaparece, que es exactamente lo
    que pasaba: el pájaro volvía a ser un círculo con ojos.
    """
    return '<path d="M51 29 Q57 8 69 26 Q60 20 51 29 Z" fill="#000"/>'


def pieza_cuerpo() -> str:
    return '<ellipse cx="60" cy="86" rx="32" ry="30" fill="#000"/>'


def pieza_cara(boca='sonrisa', mejillas=False, guino=False) -> str:
    """Ojos, cejas y pico. Va plano encima de lo que esté relleno debajo."""
    bocas = {
        'sonrisa': f'<path d="M53 50 Q60 45.5 67 50 L60 58 Z" fill="{ACENTO[500]}"/>',
        'cantando': (
            f'<path d="M54 52 L66 52 L60 62 Z" fill="{ACENTO[500]}"/>'
            f'<path d="M54 52 L66 52 L60 47 Z" fill="{ACENTO[400]}"/>'
        ),
    }
    izquierdo = (
        f'<path d="M44 40 Q50 45 56 40" stroke="{TINTA}" stroke-width="3" fill="none" '
        f'stroke-linecap="round"/>'
        if guino
        else (
            f'<circle cx="50" cy="40" r="9" fill="#fff"/>'
            f'<circle cx="51" cy="41" r="4.5" fill="{TINTA}"/>'
            f'<circle cx="52.6" cy="39" r="1.9" fill="#fff"/>'
        )
    )
    rubor = (
        f'<ellipse cx="40.5" cy="51" rx="6" ry="3.8" fill="#fb7185" opacity="0.7"/>'
        f'<ellipse cx="79.5" cy="51" rx="6" ry="3.8" fill="#fb7185" opacity="0.7"/>'
        if mejillas
        else ''
    )
    return f"""
      {rubor}
      <path d="M46.5 27.5 Q50 23.7 53.5 27.5" stroke="{CEJA}" stroke-width="2.7" fill="none"
            stroke-linecap="round"/>
      <path d="M66.5 27.5 Q70 23.7 73.5 27.5" stroke="{CEJA}" stroke-width="2.7" fill="none"
            stroke-linecap="round"/>
      {izquierdo}
      <circle cx="70" cy="40" r="9" fill="#fff"/>
      <circle cx="71" cy="41" r="4.5" fill="{TINTA}"/>
      <circle cx="72.6" cy="39" r="1.9" fill="#fff"/>
      {bocas[boca]}
    """


def pieza_panza() -> str:
    return f'<ellipse cx="61" cy="92" rx="21" ry="22" fill="#000"/>'


def pieza_notas() -> str:
    """Dos arcos de sonido saliendo del pico. La app es hablar; que se vea."""
    return (
        f'<path d="M92 34 Q102 42 92 50" stroke="{ACENTO[400]}" stroke-width="3.4" fill="none" '
        f'stroke-linecap="round"/>'
        f'<path d="M99 27 Q114 42 99 57" stroke="{ACENTO[400]}" stroke-width="3.4" fill="none" '
        f'stroke-linecap="round" opacity="0.6"/>'
    )


# ------------------------------------------------------------- herramientas


def capa(dibujo: str, caja: str) -> Image.Image:
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{caja}" '
        f'width="{LADO}" height="{LADO}">{dibujo}</svg>'
    )
    documento = pymupdf.open(stream=svg.encode(), filetype='svg')
    pagina = documento[0].get_pixmap(matrix=pymupdf.Matrix(1, 1), alpha=True)
    return Image.open(io.BytesIO(pagina.tobytes('png'))).convert('RGBA')


def degradado(arriba: str, abajo: str, lado=LADO, diagonal=False) -> Image.Image:
    base = Image.new('RGBA', (lado, lado))
    dibujante = ImageDraw.Draw(base)
    a, b = rgb(arriba), rgb(abajo)
    for y in range(lado):
        t = y / (lado - 1)
        dibujante.line([(0, y), (lado, y)], fill=tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,))
    if diagonal:
        base = base.rotate(-20, resample=Image.BICUBIC, expand=False).filter(ImageFilter.GaussianBlur(1))
    return base


def rellenar(forma: Image.Image, relleno: Image.Image) -> Image.Image:
    """Mete `relleno` dentro de la silueta de `forma`."""
    salida = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    salida.paste(relleno, (0, 0), forma.split()[3])
    return salida


def vineta(fuerza=0.35) -> Image.Image:
    """Oscurece las esquinas un poco. Da hondura sin que se note de dónde sale."""
    mascara = Image.new('L', (LADO, LADO), 0)
    dibujante = ImageDraw.Draw(mascara)
    centro, radio = LADO / 2, LADO * 0.72
    for i in range(60):
        t = i / 59
        r = radio * (1 - t * 0.55)
        dibujante.ellipse([centro - r, centro - r, centro + r, centro + r], fill=round(255 * (1 - t)))
    mascara = mascara.filter(ImageFilter.GaussianBlur(40)).point(lambda v: 255 - v)
    capa_oscura = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    capa_oscura.putalpha(mascara.point(lambda v: round(v * fuerza)))
    return capa_oscura


def chispas(color: str, puntos) -> Image.Image:
    """Destellos de cuatro puntas. Dos o tres bastan; más es purpurina."""
    capa_chispas = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    dibujante = ImageDraw.Draw(capa_chispas)
    for x, y, r in puntos:
        for ang in (0, 90):
            dx, dy = math.cos(math.radians(ang)) * r, math.sin(math.radians(ang)) * r
            dibujante.polygon(
                [(x + dx, y + dy), (x + r * 0.17, y - r * 0.17), (x - dx, y - dy), (x - r * 0.17, y + r * 0.17)],
                fill=rgb(color) + (235,),
            )
    return capa_chispas


def disco(color: str, radio: float, centro=(LADO / 2, LADO / 2)) -> Image.Image:
    capa_disco = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    ImageDraw.Draw(capa_disco).ellipse(
        [centro[0] - radio, centro[1] - radio, centro[0] + radio, centro[1] + radio],
        fill=rgb(color) + (255,),
    )
    return capa_disco


def anillo(color: str, radio: float, grosor: float) -> Image.Image:
    capa_anillo = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    ImageDraw.Draw(capa_anillo).ellipse(
        [LADO / 2 - radio, LADO / 2 - radio, LADO / 2 + radio, LADO / 2 + radio],
        outline=rgb(color) + (255,),
        width=round(grosor),
    )
    return capa_anillo


def montar(*capas) -> Image.Image:
    salida = capas[0]
    for siguiente in capas[1:]:
        if siguiente is not None:
            salida = Image.alpha_composite(salida, siguiente)
    return salida


def encajar(arte: Image.Image, parte: float, dy=0) -> Image.Image:
    dentro = round(LADO * parte)
    pequeno = arte.resize((dentro, dentro), Image.LANCZOS)
    hueco = (LADO - dentro) // 2
    capa_encajada = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    capa_encajada.paste(pequeno, (hueco, hueco + round(dy)), pequeno)
    return capa_encajada


# ------------------------------------------------------------- los retratos


def retrato(claro: str, oscuro: str, caja=CAJA_RETRATO, copete=MARCA[900], **cara) -> Image.Image:
    """Milo de cabeza, con el cráneo relleno de un degradado propio."""
    craneo = rellenar(capa(pieza_craneo(), caja), degradado(claro, oscuro))
    plumas = rellenar(capa(pieza_copete(), caja), degradado(copete or oscuro, copete or oscuro))
    return montar(plumas, craneo, plumas, capa(pieza_cara(**cara), caja))


def busto(claro: str, oscuro: str, panza: str, **cara) -> Image.Image:
    cuerpo = rellenar(capa(pieza_cuerpo(), CAJA_BUSTO), degradado(claro, oscuro))
    vientre = rellenar(capa(pieza_panza(), CAJA_BUSTO), degradado('#ffffff', panza))
    craneo = rellenar(capa(pieza_craneo(), CAJA_BUSTO), degradado(claro, oscuro))
    plumas = rellenar(capa(pieza_copete(), CAJA_BUSTO), degradado(oscuro, oscuro))
    return montar(cuerpo, vientre, plumas, craneo, plumas, capa(pieza_cara(**cara), CAJA_BUSTO))


def main() -> None:
    os.makedirs(SALIDA, exist_ok=True)

    propuestas = {
        # I. El pájaro que habla, que es de lo que va la aplicación: pico abierto
        #    y dos ondas saliendo. Es la única que cuenta qué hace la app.
        'I-cantando': montar(
            degradado(MARCA[500], MARCA[900]),
            vineta(0.3),
            # El recorte es más ancho que el de los demás: las ondas salen por
            # la derecha y con la caja del retrato se quedaban fuera.
            encajar(
                montar(
                    retrato(MARCA[400], MARCA[700], caja=CAJA_CANTANDO, boca='cantando'),
                    capa(pieza_notas(), CAJA_CANTANDO),
                ),
                0.84,
            ),
        ),
        # J. Mejillas. Es el truco más viejo que hay para que algo caiga bien, y
        #    funciona: dos manchas rosas y la cara deja de ser un icono.
        'J-mejillas': montar(
            degradado('#fff7ed', '#fde9cf'),
            encajar(retrato(MARCA[500], MARCA[800], mejillas=True), 0.78),
            vineta(0.18),
        ),
        # K. Atardecer. La paleta se sale de la marca a propósito: en una
        #    pantalla de inicio llena de azules, el cálido es el que se ve.
        'K-atardecer': montar(
            degradado('#fbbf24', '#f43f5e'),
            vineta(0.28),
            # Sin el disco, el índigo sobre el naranja se apaga: son dos colores
            # oscuros peleándose. El disco claro es lo que devuelve el contraste.
            disco('#fff7ed', 180),
            encajar(retrato(MARCA[500], MARCA[800]), 0.62),
        ),
        # L. Noche. Marino casi negro con el pájaro claro y tres destellos. Es la
        #    más seria de las ocho y la que mejor queda en modo oscuro.
        'L-noche': montar(
            degradado('#1e1b4b', '#0b1026'),
            chispas(ACENTO[300], [(96, 110, 17), (424, 150, 12), (400, 400, 9)]),
            encajar(retrato(MARCA[300], MARCA[600]), 0.74),
        ),
        # M. Joya: disco claro, anillo ámbar fino y el pájaro dentro. El anillo
        #    es lo que lo separa del fondo de pantalla, sea el que sea.
        'M-anillo': montar(
            degradado(MARCA[700], MARCA[900]),
            disco(MARCA[50], 184),
            anillo(ACENTO[400], 196, 11),
            encajar(retrato(MARCA[500], MARCA[800]), 0.62),
        ),
        # N. Guiño. Un ojo cerrado cambia una cara quieta por una cara que te
        #    está mirando a ti.
        'N-guino': montar(
            degradado('#f8fafc', '#dbeafe'),
            encajar(retrato(MARCA[500], MARCA[800], guino=True, mejillas=True), 0.78),
            vineta(0.16),
        ),
        # O. Busto entero con panza, sobre crema y con vineta: el más «muñeco».
        'O-busto-calido': montar(
            degradado('#fffbeb', '#fde9cf'),
            encajar(busto(MARCA[500], MARCA[800], MARCA[200], mejillas=True), 0.76, dy=22),
            vineta(0.2),
        ),
        # P. Menta. El mismo pájaro en una paleta que no es la suya, para ver si
        #    la marca aguanta fuera del índigo.
        'P-menta': montar(
            degradado('#5eead4', '#0f766e'),
            vineta(0.26),
            encajar(retrato(MARCA[600], MARCA[900]), 0.76),
        ),
    }

    for nombre, imagen in propuestas.items():
        imagen.convert('RGB').save(os.path.join(SALIDA, f'{nombre}.png'))
        print(f'  {nombre}.png')

    columnas, celda, hueco = 4, 190, 18
    filas = (len(propuestas) + columnas - 1) // columnas
    hoja = Image.new(
        'RGB', (columnas * celda + (columnas + 1) * hueco, filas * (celda + 54) + hueco), '#111827'
    )
    for i, (nombre, imagen) in enumerate(propuestas.items()):
        x = hueco + (i % columnas) * (celda + hueco)
        y = hueco + (i // columnas) * (celda + 54)
        hoja.paste(imagen.convert('RGB').resize((celda, celda), Image.LANCZOS), (x, y))
        hoja.paste(imagen.convert('RGB').resize((44, 44), Image.LANCZOS), (x + celda // 2 - 22, y + celda + 6))
        ImageDraw.Draw(hoja).text((x, y + celda + 40), nombre, fill='#cbd5e1')
    hoja.save(os.path.join(SALIDA, '0-todas.png'))
    print('  0-todas.png  (la hoja para comparar)')


main()
