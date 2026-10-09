"""
Tercera tanda: Milo dibujado con línea, al estilo de los iconos de App Store.

Las dos tandas anteriores eran silueta plana y color saturado. Esto es otra
cosa, y el cambio no es de color sino de construcción:

  · TODO LLEVA CONTORNO. Una línea oscura alrededor de cada pieza. Es lo que
    hace que el dibujo aguante encima de cualquier fondo y lo que da ese aire de
    ilustración en vez de logotipo.
  · EL COLOR VA APAGADO. En este estilo nada va a tope de saturación: el índigo
    de la marca se sube dos pasos hacia el lavanda y el ámbar se ablanda. A tope
    pelea con la línea y el conjunto se ve chillón.
  · EL PERSONAJE HACE ALGO. Un bicho de frente es un retrato; un bicho con un
    libro, con un micrófono o hablando es una aplicación. Esa es la diferencia
    entre los iconos que se miran y los que se entienden.
  · PROPORCIÓN DE MUÑECO. Cabeza grande, cuerpo pequeño. Es lo que lo hace
    simpático, y además es lo que deja que la cara se lea a 44 px.

    python scripts/propuestas-icono-3.py
"""

import io
import os

import pymupdf
from PIL import Image, ImageDraw, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(os.path.dirname(AQUI), 'disenos-icono-3')
LADO = 512

# La paleta de este estilo. Sale de la marca, pero suavizada: ver arriba.
LINEA = '#3f3a7a'
CUERPO = '#8b93f8'
CUERPO_OSCURO = '#6f78ee'
PANZA = '#eef0ff'
COPETE = '#5c64d8'
PICO = '#f8b33c'
PICO_OSCURO = '#e09a28'
RUBOR = '#f6a8b8'
PAGINA = '#fffdf6'
PAGINA_SOMBRA = '#f0ebdc'


def rgb(valor: str):
    return tuple(int(valor[i : i + 2], 16) for i in (1, 3, 5))


def ojos(tipo: str) -> str:
    """
    Tres caras. La de los ojos cerrados es la que mejor funciona de lejos: dos
    arcos se leen a cualquier tamaño, y dos pupilas con brillo no.
    """
    if tipo == 'feliz':
        return (
            f'<g stroke="{LINEA}" stroke-width="3.4" fill="none" stroke-linecap="round">'
            f'<path d="M44 45 Q49.5 38.5 55 45"/><path d="M65 45 Q70.5 38.5 76 45"/></g>'
        )
    if tipo == 'guino':
        return (
            f'<g stroke="{LINEA}" stroke-width="3.4" fill="none" stroke-linecap="round">'
            f'<path d="M44 45 Q49.5 38.5 55 45"/></g>'
            f'<circle cx="70" cy="43" r="8.5" fill="#fff" stroke="{LINEA}" stroke-width="2.4"/>'
            f'<circle cx="71" cy="44" r="4.2" fill="{LINEA}"/>'
            f'<circle cx="72.6" cy="42" r="1.7" fill="#fff"/>'
        )
    return (
        f'<circle cx="50" cy="43" r="8.5" fill="#fff" stroke="{LINEA}" stroke-width="2.4"/>'
        f'<circle cx="70" cy="43" r="8.5" fill="#fff" stroke="{LINEA}" stroke-width="2.4"/>'
        f'<circle cx="51" cy="44" r="4.2" fill="{LINEA}"/>'
        f'<circle cx="71" cy="44" r="4.2" fill="{LINEA}"/>'
        f'<circle cx="52.6" cy="42" r="1.7" fill="#fff"/>'
        f'<circle cx="72.6" cy="42" r="1.7" fill="#fff"/>'
    )


def cara(tipo='feliz', boca='pico') -> str:
    """El copete va DESPUÉS del cráneo, que si no se lo come."""
    pico = (
        f'<path d="M53.5 50 Q60 45 66.5 50 L60 59 Z" fill="{PICO}" stroke="{LINEA}" '
        f'stroke-width="2.4" stroke-linejoin="round"/>'
        if boca == 'pico'
        else
        # Pico abierto: la mitad de arriba un tono más clara, como en la app, que
        # es lo que hace que se entienda cuál es el techo de la boca.
        f'<path d="M52 50 L68 50 L60 61 Z" fill="{PICO}" stroke="{LINEA}" stroke-width="2.4" '
        f'stroke-linejoin="round"/>'
        f'<path d="M52 50 L68 50 L60 44 Z" fill="{PICO_OSCURO}" stroke="{LINEA}" '
        f'stroke-width="2.4" stroke-linejoin="round"/>'
    )
    return f"""
      <circle cx="60" cy="43" r="28" fill="{CUERPO}" stroke="{LINEA}" stroke-width="2.8"/>
      <path d="M48 22 Q54 2 68 13 Q74 16 76 22 Q62 14 48 22 Z" fill="{COPETE}" stroke="{LINEA}"
            stroke-width="2.6" stroke-linejoin="round"/>
      <ellipse cx="36" cy="52" rx="6" ry="3.6" fill="{RUBOR}"/>
      <ellipse cx="84" cy="52" rx="6" ry="3.6" fill="{RUBOR}"/>
      {ojos(tipo)}
      {pico}
    """


def cuerpo_con(objeto: str) -> str:
    """Cuerpo, alas y lo que sostenga. Las alas van encima de lo sostenido."""
    return f"""
      <ellipse cx="60" cy="90" rx="29" ry="25" fill="{CUERPO}" stroke="{LINEA}"
               stroke-width="2.8"/>
      <ellipse cx="60" cy="96" rx="19" ry="18" fill="{PANZA}" stroke="{LINEA}"
               stroke-width="2.2"/>
      {objeto}
      <ellipse cx="37" cy="95" rx="8" ry="11.5" fill="{CUERPO_OSCURO}" stroke="{LINEA}"
               stroke-width="2.6" transform="rotate(-28 37 95)"/>
      <ellipse cx="83" cy="95" rx="8" ry="11.5" fill="{CUERPO_OSCURO}" stroke="{LINEA}"
               stroke-width="2.6" transform="rotate(28 83 95)"/>
    """


LIBRO = f"""
  <path d="M60 83 L34 88 L34 106 L60 100 Z" fill="{PAGINA}" stroke="{LINEA}"
        stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M60 83 L86 88 L86 106 L60 100 Z" fill="{PAGINA_SOMBRA}" stroke="{LINEA}"
        stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M60 83 L60 100" stroke="{LINEA}" stroke-width="2.4" stroke-linecap="round"/>
  <g stroke="{LINEA}" stroke-width="1.5" stroke-linecap="round" opacity="0.55">
    <path d="M40 92 L54 89"/><path d="M40 97 L54 94"/>
    <path d="M66 89 L80 92"/><path d="M66 94 L80 97"/>
  </g>
"""

MICROFONO = f"""
  <path d="M60 103 L60 112 M51 112 L69 112" stroke="{LINEA}" stroke-width="2.6"
        stroke-linecap="round" fill="none"/>
  <path d="M44 88 A16 16 0 0 0 76 88" fill="none" stroke="{LINEA}" stroke-width="2.8"
        stroke-linecap="round"/>
  <rect x="51" y="66" width="18" height="32" rx="9" fill="#fef3c7" stroke="{LINEA}"
        stroke-width="2.6"/>
  <g stroke="{LINEA}" stroke-width="1.5" stroke-linecap="round" opacity="0.45">
    <path d="M55 73 L65 73"/><path d="M55 79 L65 79"/><path d="M55 85 L65 85"/>
  </g>
""" 

BOCADILLO = f"""
  <path d="M74 66 h26 a7 7 0 0 1 7 7 v14 a7 7 0 0 1-7 7 h-16 l-9 7 1.5-7 A7 7 0 0 1 74 87 V73
           a7 7 0 0 1 7-7 z" fill="{PAGINA}" stroke="{LINEA}" stroke-width="2.4"
        stroke-linejoin="round"/>
  <g fill="{LINEA}"><circle cx="83" cy="80" r="2.2"/><circle cx="90" cy="80" r="2.2"/>
     <circle cx="97" cy="80" r="2.2"/></g>
"""


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
    dibujante = ImageDraw.Draw(base)
    a, b = rgb(arriba), rgb(abajo)
    for y in range(LADO):
        t = y / (LADO - 1)
        dibujante.line(
            [(0, y), (LADO, y)], fill=tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
        )
    return base


def halo(color: str, radio: float, centro=(LADO / 2, LADO * 0.56)) -> Image.Image:
    """
    Un disco muy difuminado detrás del personaje.

    Es lo que separa el dibujo del fondo sin dibujar una sombra: en estos iconos
    el bicho casi siempre está sentado en una mancha de luz.
    """
    capa = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    ImageDraw.Draw(capa).ellipse(
        [centro[0] - radio, centro[1] - radio, centro[0] + radio, centro[1] + radio],
        fill=rgb(color) + (255,),
    )
    return capa.filter(ImageFilter.GaussianBlur(radio * 0.45))


def encajar(arte: Image.Image, parte: float, dy=0.0) -> Image.Image:
    dentro = round(LADO * parte)
    pequeno = arte.resize((dentro, dentro), Image.LANCZOS)
    capa = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    hueco = (LADO - dentro) // 2
    capa.paste(pequeno, (hueco, hueco + round(dy)), pequeno)
    return capa


def montar(*capas) -> Image.Image:
    salida = capas[0]
    for siguiente in capas[1:]:
        salida = Image.alpha_composite(salida, siguiente)
    return salida


def main() -> None:
    os.makedirs(SALIDA, exist_ok=True)

    # El recorte: de la coronilla del copete a la base del cuerpo, con un pelo de
    # aire. Un personaje pegado al borde se ve apretado.
    CAJA = '14 -6 92 132'

    leyendo = dibujar(cuerpo_con(LIBRO) + cara('feliz'), CAJA)
    cantando = dibujar(cuerpo_con(MICROFONO) + cara('feliz', boca='abierto'), CAJA)
    hablando = dibujar(cuerpo_con('') + cara('guino') + BOCADILLO, '14 -6 104 132')
    saludando = dibujar(cuerpo_con('') + cara('redondos'), CAJA)

    propuestas = {
        # Q. El más parecido a lo que pediste: leyendo, sobre crema cálida.
        'Q-leyendo-crema': montar(
            fondo('#fff6df', '#ffe7b8'), halo('#fffdf3', 150), encajar(leyendo, 0.92, dy=8)
        ),
        # R. El mismo, en lavanda: el color de la marca llevado a pastel.
        'R-leyendo-lavanda': montar(
            fondo('#eceaff', '#cfccff'), halo('#ffffff', 150), encajar(leyendo, 0.92, dy=8)
        ),
        # S. Con micrófono y el pico abierto. Es la que dice que esto se estudia
        #    hablando y no leyendo, que es la diferencia con las demás apps.
        'S-cantando-menta': montar(
            fondo('#e2f7ee', '#bfe9d8'), halo('#ffffff', 150), encajar(cantando, 0.92, dy=8)
        ),
        # T. El micrófono sobre crema, por si el verde se va de la marca.
        'T-cantando-crema': montar(
            fondo('#fff6df', '#ffdfa6'), halo('#fffdf3', 150), encajar(cantando, 0.92, dy=8)
        ),
        # U. Guiñando con un bocadillo al lado: hablar contigo, no estudiar solo.
        'U-hablando-cielo': montar(
            fondo('#e6f1ff', '#c3dcff'), halo('#ffffff', 152), encajar(hablando, 0.94, dy=4)
        ),
        # V. Sin objeto, solo el bicho. El más limpio y el que mejor envejece.
        'V-sentado-crema': montar(
            fondo('#fff4e8', '#ffd9b0'), halo('#fffdf3', 148), encajar(saludando, 0.88, dy=10)
        ),
        # W. El de leer en rosa pálido, que es el que más se aleja del azul de
        #    todas las aplicaciones.
        'W-leyendo-rosa': montar(
            fondo('#ffeef2', '#ffd3de'), halo('#ffffff', 150), encajar(leyendo, 0.92, dy=8)
        ),
        # X. Fondo oscuro suave con el bicho claro: el mismo estilo, de noche.
        'X-leyendo-noche': montar(
            fondo('#3b3869', '#272450'), halo('#4b4785', 158), encajar(leyendo, 0.92, dy=8)
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
