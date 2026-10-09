"""
Cuarta tanda: el Milo DE VERDAD, presentado bonito.

Las tres anteriores las dibujé leyendo `milo.tsx` en vez de mirar la pantalla, y
se notaba: le puse un copete que no tiene, un contorno que no lleva y unos
mofletes que no son suyos. Para esta se arrancó la aplicación, se abrió `/vivo`
—el banco de pruebas de la mascota— y se copió lo que sale.

Lo que Milo ES, y que no estaba en ninguna de las anteriores:

  · NO TIENE COPETE. La coronilla es una cúpula lisa. El rizo que define
    `milo.tsx` queda por dentro del cráneo y no asoma nunca.
  · SUS CEJAS SON EL PERSONAJE. Dos arcos gruesos y oscuros, inclinados, por
    encima de los ojos. Es lo único que le distingue de cualquier pájaro
    redondo, y es lo que hay que exagerar si hay que exagerar algo.
  · CABEZA Y CUERPO SON UNA SOLA SILUETA. No hay cuello ni corte: la cúpula se
    funde con el cuerpo y el conjunto se lee como una pera.
  · COLOR PLANO Y SIN CONTORNO. Ni líneas, ni sombras, ni degradados dentro del
    bicho. La profundidad sale de los dos tonos del ala, no de un borde.

Lo que cambia respecto a la aplicación es el ENVOLTORIO, no él: fondo pastel,
una sombra blanda debajo y el encuadre pensado para 44 px.

    python scripts/propuestas-icono-4.py
"""

import io
import os

import pymupdf
from PIL import Image, ImageDraw, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(os.path.dirname(AQUI), 'disenos-icono-4')
LADO = 512

# Exactamente los de la aplicación. No se retocan: el icono tiene que ser el
# mismo pájaro que se abre al tocarlo.
CUERPO = '#4f46e5'
PANZA = '#e0e7ff'
ALA_CERCA = '#4338ca'
ALA_LEJOS = '#3730a3'
CEJA = '#1e1b4b'
TINTA = '#0f172a'
PICO = '#f59e0b'


def rgb(valor: str):
    return tuple(int(valor[i : i + 2], 16) for i in (1, 3, 5))


def cejas(grosor=2.9, alto=4.2) -> str:
    """
    Las cejas, un pelo más gruesas y más arqueadas que en la aplicación.

    Dentro de la app miden 2,7 de grosor y se ven bien a 112 px. A 44 adelgazan
    hasta desaparecer, y sin cejas Milo deja de ser Milo. Subirlas a 2,9 es la
    única licencia que se toma este dibujo, y es por legibilidad.
    """
    return (
        f'<g stroke="{CEJA}" stroke-width="{grosor}" fill="none" stroke-linecap="round">'
        f'<path d="M43.5 28.5 Q50 {28.5 - alto} 56.5 27"/>'
        f'<path d="M63.5 27 Q70 {28.5 - alto} 76.5 28.5"/>'
        f'</g>'
    )


def ojos(mirada=(0, 0)) -> str:
    dx, dy = mirada
    return (
        f'<ellipse cx="50" cy="40" rx="9" ry="9.8" fill="#fff"/>'
        f'<ellipse cx="70" cy="40" rx="9" ry="9.8" fill="#fff"/>'
        f'<circle cx="{50.8 + dx}" cy="{41 + dy}" r="4.6" fill="{TINTA}"/>'
        f'<circle cx="{70.8 + dx}" cy="{41 + dy}" r="4.6" fill="{TINTA}"/>'
        f'<circle cx="{52.6 + dx}" cy="{39 + dy}" r="1.7" fill="#fff"/>'
        f'<circle cx="{72.6 + dx}" cy="{39 + dy}" r="1.7" fill="#fff"/>'
    )


def pico(abierto=False) -> str:
    if abierto:
        return (
            f'<path d="M54 52 L66 52 L60 62 Z" fill="{PICO}"/>'
            f'<path d="M54 52 L66 52 L60 47 Z" fill="#fbbf24"/>'
        )
    return f'<path d="M54 50 L66 50 L60 58 Z" fill="{PICO}"/>'


def milo(cuerpo=True, patas=True, mirada=(0, 0), boca_abierta=False) -> str:
    """
    Milo, en el orden en que lo pinta la aplicación.

    El orden importa: el ala cercana va DESPUÉS de la panza y ANTES de la
    cabeza, que es lo que hace que se vea metida bajo la barbilla en vez de
    pegada por fuera.
    """
    if not cuerpo:
        return f'<circle cx="60" cy="42" r="26" fill="{CUERPO}"/>{cejas()}{ojos(mirada)}{pico(boca_abierta)}'

    piernas = (
        f'<g stroke="{PICO}" stroke-width="3" stroke-linecap="round" fill="none">'
        f'<path d="M52 100 L52 108 M46 108 L58 108"/>'
        f'<path d="M68 100 L68 108 M62 108 L74 108"/></g>'
        if patas
        else ''
    )
    return f"""
      <path d="M22 78 L4 92 L26 88 Z" fill="{ALA_CERCA}"/>
      <ellipse cx="86" cy="68" rx="10" ry="16" fill="{ALA_LEJOS}"/>
      <ellipse cx="60" cy="66" rx="34" ry="36" fill="{CUERPO}"/>
      <ellipse cx="62" cy="74" rx="22" ry="24" fill="{PANZA}"/>
      <ellipse cx="32" cy="72" rx="11" ry="20" fill="{ALA_CERCA}"/>
      <circle cx="60" cy="42" r="26" fill="{CUERPO}"/>
      {cejas()}
      {ojos(mirada)}
      {pico(boca_abierta)}
      {piernas}
    """


def bocadillo() -> str:
    """Plano y sin contorno, como todo lo suyo."""
    return (
        f'<path d="M92 24 h22 a6 6 0 0 1 6 6 v13 a6 6 0 0 1-6 6 h-12 l-8 6 1.4-6 '
        f'A6 6 0 0 1 92 43 V30 a6 6 0 0 1 6-6 z" fill="#ffffff"/>'
        f'<g fill="{CUERPO}"><circle cx="99" cy="36" r="2"/><circle cx="106" cy="36" r="2"/>'
        f'<circle cx="113" cy="36" r="2"/></g>'
    )


def notas() -> str:
    """Dos ondas saliendo del pico. Lo que hace la app, dicho sin palabras."""
    return (
        f'<g stroke="{PICO}" stroke-width="4" fill="none" stroke-linecap="round">'
        f'<path d="M92 44 Q102 52 92 60"/>'
        f'<path d="M101 36 Q116 52 101 68" opacity="0.6"/></g>'
    )


def dibujar(contenido: str, caja: str) -> Image.Image:
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{caja}" width="{LADO}" '
        f'height="{LADO}">{contenido}</svg>'
    )
    documento = pymupdf.open(stream=svg.encode(), filetype='svg')
    pagina = documento[0].get_pixmap(matrix=pymupdf.Matrix(1, 1), alpha=True)
    return Image.open(io.BytesIO(pagina.tobytes('png'))).convert('RGBA')


def fondo(arriba: str, abajo: str) -> Image.Image:
    base = Image.new('RGBA', (LADO, LADO))
    pincel = ImageDraw.Draw(base)
    a, b = rgb(arriba), rgb(abajo)
    for y in range(LADO):
        t = y / (LADO - 1)
        pincel.line([(0, y), (LADO, y)], fill=tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,))
    return base


def suelo(color: str, ancho=150, alto=26, y=0.80) -> Image.Image:
    """
    La sombra del suelo.

    Es la única sombra de todo el dibujo y no está por adorno: sin ella el
    pájaro flota, y un bicho flotando en un cuadrado se ve recortado y pegado.
    La aplicación le pone una igual debajo.
    """
    capa = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    cy = LADO * y
    ImageDraw.Draw(capa).ellipse(
        [LADO / 2 - ancho, cy - alto, LADO / 2 + ancho, cy + alto], fill=rgb(color) + (120,)
    )
    return capa.filter(ImageFilter.GaussianBlur(14))


def disco(color: str, radio: float, centro=None, alpha=255) -> Image.Image:
    centro = centro or (LADO / 2, LADO / 2)
    capa = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    ImageDraw.Draw(capa).ellipse(
        [centro[0] - radio, centro[1] - radio, centro[0] + radio, centro[1] + radio],
        fill=rgb(color) + (alpha,),
    )
    return capa


def encajar(arte: Image.Image, parte: float, dy=0.0, dx=0.0) -> Image.Image:
    dentro = round(LADO * parte)
    pequeno = arte.resize((dentro, dentro), Image.LANCZOS)
    capa = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    hueco = (LADO - dentro) // 2
    capa.paste(pequeno, (hueco + round(dx), hueco + round(dy)), pequeno)
    return capa


def montar(*capas) -> Image.Image:
    salida = capas[0]
    for siguiente in capas[1:]:
        salida = Image.alpha_composite(salida, siguiente)
    return salida


def main() -> None:
    os.makedirs(SALIDA, exist_ok=True)

    entero = dibujar(milo(), '0 4 120 112')
    entero_hablando = dibujar(milo(boca_abierta=True) + notas(), '0 4 124 116')
    con_globo = dibujar(milo(mirada=(1.2, -0.6)) + bocadillo(), '0 16 124 116')
    retrato = dibujar(milo(cuerpo=False), '31 12 58 58')

    propuestas = {
        # Y1. Él, tal cual, sobre crema. Lo más parecido a abrir la app.
        'Y1-crema': montar(
            fondo('#fff6e3', '#ffe4b8'), suelo('#c9a86a'), encajar(entero, 0.92, dy=-4)
        ),
        # Y2. Lavanda: su propio color llevado a pastel, que es lo que hace que
        #     el índigo del bicho resalte en vez de confundirse.
        'Y2-lavanda': montar(
            fondo('#f0eeff', '#d6d2ff'), suelo('#8b85d8'), encajar(entero, 0.92, dy=-4)
        ),
        # Y3. Sobre un disco blanco. El disco es lo que le separa de cualquier
        #     fondo de pantalla, por cargado que esté.
        'Y3-disco': montar(
            fondo('#ded9ff', '#b9b2ff'),
            disco('#ffffff', 186),
            suelo('#9b94e8', ancho=120, y=0.76),
            encajar(entero, 0.76, dy=-8),
        ),
        # Y4. Hablando: pico abierto y dos ondas. La única que cuenta que esto
        #     se aprende hablando y no leyendo.
        'Y4-hablando': montar(
            fondo('#e8f6ef', '#c2e7d6'), suelo('#7fae99'), encajar(entero_hablando, 0.94, dy=-2)
        ),
        # Y5. Con bocadillo, mirando hacia él. La mirada es lo que hace que los
        #     dos elementos sean una escena y no dos cosas puestas al lado.
        'Y5-bocadillo': montar(
            fondo('#eaf2ff', '#c6dcff'), suelo('#7d9ad0'), encajar(con_globo, 0.94, dy=2)
        ),
        # Y6. Retrato: solo la cabeza. Es donde más mandan las cejas, que son lo
        #     suyo, y lo que mejor se lee a 44 px.
        'Y6-retrato': montar(
            fondo('#fff1f3', '#ffd6de'), disco('#ffffff', 172), encajar(retrato, 0.64)
        ),
        # Y7. El mismo retrato sobre su índigo, para quien lo quiera oscuro.
        'Y7-retrato-indigo': montar(
            fondo('#5b55ea', '#3a32b0'), disco('#eef2ff', 180), encajar(retrato, 0.66)
        ),
        # Y8. Melocotón cálido. En una pantalla llena de apps azules, el cálido
        #     es el que se encuentra primero.
        'Y8-melocoton': montar(
            fondo('#ffefe0', '#ffc9a0'), suelo('#d09460'), encajar(entero, 0.92, dy=-4)
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
        hoja.paste(
            imagen.convert('RGB').resize((44, 44), Image.LANCZOS), (x + celda // 2 - 22, y + celda + 6)
        )
        ImageDraw.Draw(hoja).text((x, y + celda + 40), nombre, fill='#cbd5e1')
    hoja.save(os.path.join(SALIDA, '0-todas.png'))
    print('  0-todas.png  (la hoja para comparar)')


main()
