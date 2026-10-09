"""
Propuestas de icono para la pantalla de inicio.

Dibuja a Milo con las MISMAS coordenadas que usa la aplicación —el lienzo de
120x120 de `components/mascotas/milo.tsx` y `dibujo.ts`— en vez de volver a
dibujarlo de memoria. Si el icono no es exactamente el pájaro que sale dentro,
la pantalla de inicio promete una aplicación y abre otra.

    python scripts/propuestas-icono.py

Deja los PNG en `disenos-icono/`, que no entra en el build: son para mirar y
elegir. La elegida se copia a `public/` con `generar-iconos.py`.
"""

import io
import os

import pymupdf
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(os.path.dirname(AQUI), 'disenos-icono')

# La paleta de la casa, tal cual está en `index.css`.
MARCA = {
    50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
    500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81',
}
ACENTO = {300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706'}
TINTA = '#0f172a'
CEJA = '#1e1b4b'


def cabeza(cuerpo=MARCA[600], copete=None, con_cejas=True) -> str:
    """
    La cabeza de Milo: cráneo, copete, cejas, ojos y pico sonriendo.

    Dos cosas se cambian respecto a como se dibuja dentro de la aplicación, y
    las dos por el tamaño:

    · EL COPETE ASOMA Y VA ENCIMA. En la app es un rizo discreto metido dentro
      del contorno del cráneo; ahí está bien, porque el pájaro se mueve y la
      silueta se entiende sola. Parado y a 44 px, metido dentro, no existe: Milo
      se queda siendo un círculo con ojos. Un icono exagera el rasgo que
      distingue, y el suyo es ese.

    · NO LLEVA SOMBRA. Se probó una media luna más oscura para dar volumen y se
      quitó: a este tamaño una sombra es suciedad, y además es la regla que ya
      siguen los iconos de la aplicación.
    """
    copete = copete or MARCA[800]
    cejas = (
        f'<path d="M46.5 27.5 Q50 23.7 53.5 27.5" stroke="{CEJA}" stroke-width="2.7" '
        f'fill="none" stroke-linecap="round"/>'
        f'<path d="M66.5 27.5 Q70 23.7 73.5 27.5" stroke="{CEJA}" stroke-width="2.7" '
        f'fill="none" stroke-linecap="round"/>'
        if con_cejas
        else ''
    )
    return f"""
      <circle cx="60" cy="42" r="26" fill="{cuerpo}"/>
      <path d="M51 29 Q57 8 69 26 Q60 20 51 29 Z" fill="{copete}"/>
      {cejas}
      <circle cx="50" cy="40" r="9" fill="#fff"/><circle cx="70" cy="40" r="9" fill="#fff"/>
      <circle cx="51" cy="41" r="4.5" fill="{TINTA}"/><circle cx="71" cy="41" r="4.5" fill="{TINTA}"/>
      <circle cx="52.6" cy="39" r="1.9" fill="#fff"/><circle cx="72.6" cy="39" r="1.9" fill="#fff"/>
      <path d="M53 50 Q60 45.5 67 50 L60 58 Z" fill="{ACENTO[500]}"/>
    """


def entero(cuerpo=MARCA[600], panza=MARCA[100], alas=(MARCA[800], MARCA[700])) -> str:
    """Milo de cuerpo entero, posado."""
    lejana, cercana = alas
    return f"""
      <path d="M22 78 L4 92 L26 88 Z" fill="{MARCA[700]}"/>
      <ellipse cx="86" cy="68" rx="10" ry="16" fill="{lejana}"/>
      <ellipse cx="60" cy="66" rx="34" ry="36" fill="{cuerpo}"/>
      <ellipse cx="62" cy="74" rx="22" ry="24" fill="{panza}"/>
      <ellipse cx="32" cy="72" rx="11" ry="20" fill="{cercana}"/>
      <path d="M52 100 L52 108 M46 108 L58 108" stroke="{ACENTO[500]}" stroke-width="3"
            stroke-linecap="round"/>
      <path d="M68 100 L68 108 M62 108 L74 108" stroke="{ACENTO[500]}" stroke-width="3"
            stroke-linecap="round"/>
      {cabeza(cuerpo)}
    """


def busto(cuerpo=MARCA[600], panza=MARCA[100], copete=None) -> str:
    """
    Cabeza y hombros.

    Una cabeza suelta flota; con el arranque del cuerpo debajo se lee como un
    pájaro mirándote, y además entra la panza clara, que es lo que parte el
    bloque de color y evita que a 44 px todo sea una sola mancha índigo.
    """
    return f"""
      <ellipse cx="60" cy="86" rx="32" ry="30" fill="{cuerpo}"/>
      <ellipse cx="61" cy="92" rx="21" ry="22" fill="{panza}"/>
      {cabeza(cuerpo, copete)}
    """


def pintar(dibujo: str, caja: str, lado=512) -> Image.Image:
    """Rasteriza un trozo del lienzo de 120 a un cuadrado, con fondo transparente."""
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{caja}" '
        f'width="{lado}" height="{lado}">{dibujo}</svg>'
    )
    documento = pymupdf.open(stream=svg.encode(), filetype='svg')
    pagina = documento[0].get_pixmap(matrix=pymupdf.Matrix(1, 1), alpha=True)
    return Image.open(io.BytesIO(pagina.tobytes('png'))).convert('RGBA')


def fondo_liso(color: str, lado=512) -> Image.Image:
    return Image.new('RGBA', (lado, lado), color)


def fondo_degradado(arriba: str, abajo: str, lado=512) -> Image.Image:
    """El degradado se hace aquí porque el rasterizador de SVG no los pinta."""
    base = Image.new('RGBA', (lado, lado))
    dibujante = ImageDraw.Draw(base)
    a = tuple(int(arriba[i : i + 2], 16) for i in (1, 3, 5))
    b = tuple(int(abajo[i : i + 2], 16) for i in (1, 3, 5))
    for y in range(lado):
        t = y / (lado - 1)
        dibujante.line(
            [(0, y), (lado, y)],
            fill=tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,),
        )
    return base


def disco(color: str, radio: float, centro=(256, 256), lado=512) -> Image.Image:
    """Un círculo plano, para sentar al pájaro encima de algo."""
    capa = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    ImageDraw.Draw(capa).ellipse(
        [centro[0] - radio, centro[1] - radio, centro[0] + radio, centro[1] + radio], fill=color
    )
    return capa


def montar(*capas: Image.Image) -> Image.Image:
    salida = capas[0]
    for capa in capas[1:]:
        salida = Image.alpha_composite(salida, capa)
    return salida


def encajar(arte: Image.Image, parte: float, lado=512) -> Image.Image:
    """Mete el dibujo en el cuadrado ocupando `parte` del lado, centrado."""
    dentro = round(lado * parte)
    capa = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    capa.paste(arte.resize((dentro, dentro), Image.LANCZOS), ((lado - dentro) // 2,) * 2, arte.resize((dentro, dentro), Image.LANCZOS))
    return capa


def main() -> None:
    os.makedirs(SALIDA, exist_ok=True)

    # El retrato: la cabeza recortada justo por donde cabe, sin aire muerto.
    retrato = pintar(cabeza(), '31 6 58 62')
    retrato_claro = pintar(cabeza(cuerpo=MARCA[600], copete=MARCA[700]), '31 6 58 62')
    cuerpo_entero = pintar(entero(), '0 10 120 110')

    busto_claro = pintar(busto(), '26 6 68 76')
    cabeza_clara = pintar(cabeza(cuerpo=MARCA[500], copete=MARCA[800]), '31 6 58 62')
    cabeza_oscura = pintar(cabeza(cuerpo=MARCA[700], copete=MARCA[900]), '31 6 58 62')

    propuestas = {
        # A. Busto sobre crema. La panza clara y el fondo claro se dan la mano, y
        #    el índigo queda encerrado en el medio: es el que más se parece a un
        #    personaje y no a un logotipo.
        'A-busto-crema': montar(fondo_liso('#fdf6e3'), encajar(busto_claro, 0.80)),
        # B. El mismo busto sobre índigo oscuro, con el pájaro un tono más claro
        #    para que la silueta exista.
        'B-busto-indigo': montar(fondo_liso(MARCA[800]), encajar(pintar(busto(cuerpo=MARCA[500]), '26 6 68 76'), 0.80)),
        # C. Retrato sobre disco blanco. El disco es lo que hace que funcione
        #    encima de cualquier fondo de pantalla.
        'C-retrato-disco': montar(fondo_liso(MARCA[700]), disco('#ffffff', 182), encajar(retrato, 0.64)),
        # D. Ámbar: el color del pico. Es el que se encuentra primero en una
        #    pantalla donde casi todo tira a azul.
        'D-retrato-ambar': montar(fondo_liso(ACENTO[400]), encajar(cabeza_oscura, 0.76)),
        # E. Degradado índigo con la cabeza más clara encima.
        'E-retrato-degradado': montar(fondo_degradado(MARCA[600], MARCA[900]), encajar(cabeza_clara, 0.76)),
        # F. Blanco entero. El más limpio y el que mejor envejece.
        'F-retrato-blanco': montar(fondo_liso('#ffffff'), encajar(retrato, 0.78)),
        # G. Entero sobre disco claro, bien centrado esta vez.
        'G-entero-disco': montar(fondo_degradado(MARCA[500], MARCA[700]), disco('#ffffff', 190), encajar(cuerpo_entero, 0.72)),
        # H. Busto sobre ámbar: el contraste más alto de los ocho.
        'H-busto-ambar': montar(fondo_liso(ACENTO[400]), encajar(pintar(busto(cuerpo=MARCA[700], copete=MARCA[900]), '26 6 68 76'), 0.80)),
    }

    for nombre, imagen in propuestas.items():
        imagen.convert('RGB').save(os.path.join(SALIDA, f'{nombre}.png'))
        print(f'  {nombre}.png')

    # Y la hoja de contactos, que es como se eligen de verdad: todas juntas y al
    # tamaño al que se van a ver.
    columnas, celda, hueco = 4, 190, 18
    filas = (len(propuestas) + columnas - 1) // columnas
    hoja = Image.new(
        'RGB',
        (columnas * celda + (columnas + 1) * hueco, filas * (celda + 54) + hueco),
        '#111827',
    )
    for i, (nombre, imagen) in enumerate(propuestas.items()):
        x = hueco + (i % columnas) * (celda + hueco)
        y = hueco + (i // columnas) * (celda + 54)
        hoja.paste(imagen.convert('RGB').resize((celda, celda), Image.LANCZOS), (x, y))
        # Debajo, el mismo icono al tamaño real de una pantalla de inicio.
        hoja.paste(imagen.convert('RGB').resize((44, 44), Image.LANCZOS), (x + celda // 2 - 22, y + celda + 6))
        ImageDraw.Draw(hoja).text((x, y + celda + 40), nombre, fill='#cbd5e1')
    hoja.save(os.path.join(SALIDA, '0-todas.png'))
    print('  0-todas.png  (la hoja para comparar)')


main()
