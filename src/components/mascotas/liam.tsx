import { type DefinicionEspecie } from './tipos';

/**
 * Liam, el chaval.
 *
 * No es un animal, y eso obliga a contestar dos preguntas que con los animales
 * no se planteaban: qué se pone en la cola y qué se pone en las orejas. El
 * esqueleto tiene esos dos huecos y los pinta SIEMPRE, así que dejarlos vacíos no
 * es «no dibujar nada»: es tirar dos capas de las siete y quedarse con una figura
 * más plana que las demás. La respuesta está en cada campo, pero el resumen es
 * que los dos huecos se llenan con lo que de verdad cuelga de este personaje y
 * con lo que de verdad le asoma por detrás del cráneo.
 *
 * SOBRE EL COLOR. El personaje viene del estudio de bocetos, que iba pintado con
 * la paleta de Duolingo (el verde, los dos rojos y los dos naranjas de su marca).
 * Aquí no queda ni uno, y no solo por no copiarle la marca a nadie: en esta
 * aplicación el verde significa acertar y el rojo fallar, y una mascota entera
 * de uno de esos dos colores, puesta al lado de una corrección, deja de ser una
 * mascota y pasa a ser una señal. Liam va de violeta, que es el único hueco
 * ancho que quedaba libre cuando se dibujó: Milo ocupa el índigo de la marca,
 * el zorro el naranja, el perro el ámbar, el búho el verde azulado y la gata los
 * grises.
 *
 * El violeta además es el color con el que ya estaba pensado (sudadera índigo,
 * pelo violeta oscuro, cascos morados), así que recolorear fue mover la familia
 * entera un paso hacia el morado y no rehacer el personaje.
 */
export const LIAM: DefinicionEspecie = {
  etiqueta: 'Liam, el chaval de Speakmi',

  /*
    Los mismos cuatro de la gata, el perro, el zorro y Milo, y eso es una
    decisión y no una copia.

    El cráneo de Liam NO es el círculo de radio 26 de los demás: es una cápsula
    más alta y algo más estrecha (x de 36 a 84), porque una cara humana no es una
    pelota. Pero lo que mide `anchoCabeza` no es la cara, es LA SILUETA sobre la
    que se apoya el gorro, y la silueta aquí la marca el pelo, que sí llega a los
    26 de medio ancho. Medido sobre el dibujo con `CapaAtuendo`: con 26, el ala
    de la gorra cae justo por fuera del pelo y las patillas asoman por debajo,
    que es como se lleva una gorra de verdad. Con 24 —el ancho de la cara— la
    gorra se metía dentro del pelo y parecía clavada en el cráneo.

    Y `coronilla` sigue en 16 aunque el pelo empieza en 14: la copa de la gorra
    sube hasta y=11 y se lo traga entero. Bajarla para «ajustarla al pelo» habría
    subido también la cinta, que es lo único de la gorra que no puede subir
    porque termina cruzando los ojos.
  */
  anclajes: { coronilla: 16, anchoCabeza: 26, ojos: 40, cuello: 66 },

  /*
    Cejas gruesas, que son la mitad de este personaje.

    Los animales no tienen cejas: las suyas son pelo marcado y por eso van finas.
    Estas sí son cejas, así que pueden pesar lo que pesa una ceja: 3.2 de grosor y
    8 de medio ancho, más anchas que las de cualquier animal. Poco arco a propósito: una ceja
    recta y gruesa es lo que da la cara de «ya, claro» que tiene el personaje, y
    arqueándola se le iba a una expresión de susto permanente.

    La línea está en 28 y ahí hay poco sitio: los ojos los pinta el esqueleto en
    y=40 con radio 9, o sea que la frente empieza en 31, y el flequillo no puede
    bajar de 21 o la ceja se le mete debajo. Ese hueco de siete píxeles es el que
    manda en todo el peinado, no al revés.
  */
  cejas: { y: 28, ancho: 8, arco: 2.8, grosor: 3.2, color: 'stroke-violet-950' },

  /*
    LA COLA, SIENDO HUMANO: la capucha caída sobre la espalda.

    Esta capa se pinta la primera, por detrás de todo, y el esqueleto la balancea
    con el resorte más pesado que hay —llega tarde a cada movimiento, porque una
    cola no se mueve sola, la arrastra el cuerpo—. Una capucha vacía colgando de
    los hombros hace exactamente eso: es tela, pesa, y se queda atrás cuando el
    cuerpo arranca. Es el único sitio del dibujo donde la sudadera puede
    demostrar que es una sudadera y no una camiseta morada.

    Cuelga hacia el lado de acá y no centrada, y no es capricho: el personaje
    está de tres cuartos —por eso el brazo de allá es más pequeño y más oscuro—,
    así que la capucha cae por detrás del hombro de acá. Centrada, el cuerpo
    se la comía entera y no se veía ni un píxel.

    Va en un violeta MÁS CLARO que la sudadera, no más oscuro, y eso costó una
    vuelta. Es lo único del dibujo que sobresale del cuerpo y queda contra el
    fondo, así que lo sufre por los dos lados: con el tono oscuro, en tema oscuro
    se fundía con el azul marino del fondo, y en tema claro se pegaba al brazo de
    acá, que ya es oscuro, en una sola mancha. Clara por fuera y oscura por
    dentro se lee como tela doblada en los dos temas y se separa del brazo.
  */
  cola: (
    <>
      <path
        d="M46 46 C 31 45 15 55 13 69 C 12 80 21 87 31 85 C 23 77 26 60 44 56 Z"
        className="fill-violet-500"
      />
      {/*
        El pliegue. Es una sola línea y hace todo el trabajo: sin él, el trozo de
        capucha que sobresale del cuerpo es un bulto liso y se lee como una
        mochila o como un segundo hombro. Con la arruga se lee como tela.
      */}
      <path
        d="M41 51 C 28 55 21 62 20 71 C 19.5 77 23 82 28 83"
        fill="none"
        className="stroke-violet-800"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  ),
  /*
    Pivota en el hombro, que es de donde cuelga una capucha. Con el origen de los
    demás —abajo, a la altura de la cadera— el mismo balanceo levantaba la
    capucha por encima del hombro en cada ciclo, como si tirara de ella alguien.
  */
  origenCola: '46px 50px',

  /*
    El torso es la misma elipse de 34 por 36 que la de los animales, y eso
    es decisión: es lo que respira, es lo que sujeta los anclajes de la bufanda y
    de la capa, y cambiarla por un torso «de persona» habría significado que las
    prendas de la tienda tuvieran que contar con dos siluetas distintas.

    Encima van los cascos, y van AQUÍ y no en la cabeza por una razón sola: los
    lleva colgados del cuello, no puestos. Puestos habría que dibujarles la
    diadema por encima del cráneo, que es justo por donde entra el gorro de la
    tienda, y las dos prendas se pelearían en cada compra. Colgados del cuello se
    apoyan en el pecho, no tocan ningún anclaje y conviven con las siete prendas.

    Los cordones de la sudadera se quedaron fuera y conviene decirlo: iban en los
    mismos seis píxeles de pecho que la diadema de los cascos, y de los dos
    detalles el que dice quién es este personaje son los cascos.
  */
  cuerpo: (
    <>
      <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-violet-600" />
      {/*
        El delantero de la sudadera. Solo un tono más claro que el resto, no dos:
        con dos se leía como un babero, y con los cascos encima el conjunto pasaba
        a ser un peto de tirantes.
      */}
      <ellipse cx="62" cy="74" rx="22" ry="24" className="fill-violet-500" />
      {/* El bolsillo canguro, que es lo que separa una sudadera de un jersey. */}
      <path d="M46 88 Q61 94 76 88 L77 96 Q61 101 45 96 Z" className="fill-violet-700" />
      {/*
        La diadema cruza el pecho por delante y no por detrás del cuello: por
        detrás es donde va de verdad, pero ahí la tapan la barbilla y el torso y
        los dos auriculares quedaban flotando sueltos, sin nada que los uniera.

        Y los auriculares son REDONDOS, no cápsulas de pie. Con cápsulas, y la
        diadema uniéndolas por abajo, lo que se leía a 112 píxeles eran los dos
        tirantes de un peto; en cuanto son dos círculos con la almohadilla dentro
        se leen como lo que son.
      */}
      <path
        d="M46 79 Q60 87 74 79"
        fill="none"
        className="stroke-violet-950"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="46" cy="78" r="7" className="fill-violet-950" />
      <circle cx="46" cy="78" r="3.6" className="fill-violet-300" />
      <circle cx="74" cy="78" r="7" className="fill-violet-950" />
      <circle cx="74" cy="78" r="3.6" className="fill-violet-300" />
    </>
  ),

  /*
    Los brazos. Manga de sudadera y mano fuera, en vez de un ala de una pieza.

    Las dos manos van un tono más oscuras que la cara, y no es sombreado: la mano
    de acá sobresale del cuerpo y queda contra el fondo, y en tema claro el tono
    de la cara se pierde sobre el fondo casi blanco. Un tono más abajo aguanta los
    dos temas.
  */
  alaLejana: (
    <>
      <ellipse cx="86" cy="70" rx="9" ry="16" className="fill-violet-800" />
      <circle cx="87" cy="87" r="5.5" className="fill-orange-300" />
    </>
  ),
  alaCercana: (
    <>
      <ellipse cx="33" cy="71" rx="10.5" ry="18" className="fill-violet-700" />
      <circle cx="32" cy="89" r="6" className="fill-orange-300" />
    </>
  ),

  /*
    LAS OREJAS, SIENDO HUMANO: las orejas de verdad, y el volumen del pelo.

    Este hueco no se queda vacío porque es literalmente el que le toca: la capa
    se pinta detrás del cráneo para que lo que va ahí ASOME por los lados, y una
    oreja humana es exactamente eso, una cosa pegada al lado de la cabeza de la
    que solo se ve el borde. Con la cápsula de la cara delante, de cada círculo de
    radio 5.5 se ven seis píxeles, que es lo que mide una oreja a esta escala.

    Con ellas va la masa del pelo, que también tiene que ir detrás: el pelo rodea
    el cráneo y el cráneo se pinta encima, así que el pelo se ve como un borde
    alrededor de la cara en vez de como un casco pegado por delante. El flequillo,
    que sí va por delante, se pinta en `cabeza`; los dos son del mismo violeta
    para que la unión no se vea.

    Esa masa termina en y=42 y no más abajo, y ese número sale de una captura y
    no de un cálculo: bajándola hasta la línea de las orejas, el pelo enmarcaba
    la cara por los dos lados y lo que salía era una melenita, no un chaval.
    Cortada justo por encima de las orejas, son las orejas las que tapan el filo
    recto de la masa, y eso es lo que hace que se lea como pelo corto.

    El pendiente es de dorado de acento y no de un color nuevo: es de tres
    píxeles, y a ese tamaño lo único que se percibe es que brilla.
  */
  orejas: (
    <>
      <path d="M33 42 C 30 23 44 15 60 15 C 76 15 90 23 87 42 Z" className="fill-violet-800" />
      <circle cx="35" cy="47" r="5.5" className="fill-orange-200" />
      <circle cx="85" cy="47" r="5.5" className="fill-orange-300" />
      <circle cx="32.5" cy="50.5" r="1.7" className="fill-acento-400" />
    </>
  ),

  /*
    La cara: cápsula, rubor y flequillo, en ese orden.

    La cápsula es más alta que ancha porque una cara humana lo es, pero no puede
    estrecharse más: los ojos los pinta el esqueleto en x=50 y x=70 con radio 9,
    o sea que ocupan de 41 a 79, y con la cara más estrecha se saldrían por los
    lados. Los cuatro píxeles de margen que quedan a cada lado son todo lo que
    hay.

    El flequillo va por delante y tiene el borde de abajo en y=21 en la zona de
    las cejas, ni un píxel más abajo: la ceja en reposo llega a 26.6 y al
    sorprenderse sube cinco, así que a 21 se rozan y por debajo de 21 la ceja
    levantada desaparecería dentro del pelo, justo en el estado en el que la ceja
    ES la expresión. Por el lado de acá sí baja hasta 35, porque ahí no hay ceja
    que tapar: ese mechón caído sobre una sola sien es todo el peinado. Es la
    única pieza asimétrica del dibujo junto con la boca de reposo, y las dos lo
    son por lo mismo: una cara simétrica es una cara de icono.

    El reflejo del pelo no es adorno: en tema oscuro el violeta del pelo y el
    fondo azul marino se parecen demasiado y la coronilla se difuminaba contra el
    fondo. La línea clara vuelve a dibujar el borde de arriba en los dos temas.
  */
  cabeza: (
    <>
      <rect x="36" y="18" width="48" height="51" rx="23" className="fill-orange-200" />
      <ellipse cx="44" cy="53" rx="5" ry="3" className="fill-rose-300" opacity="0.45" />
      <ellipse cx="76" cy="53" rx="5" ry="3" className="fill-rose-300" opacity="0.45" />
      <path
        d="M34 39 C 31 20 44 14 60 14 C 78 14 89 19 87 26 C 82 21 74 19 62 19.5
           C 52 20 43 21.5 39 26 C 37 30 35 34.5 34 39 Z"
        className="fill-violet-800"
      />
      <path
        d="M43 21.5 C 53 16.5 69 17 79 21"
        fill="none"
        className="stroke-violet-500"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </>
  ),

  /*
    La nariz va aquí, en el hueco de lo que NO se mueve al hablar, y en un humano
    eso importa más que en un animal: en un hocico la nariz y la boca son la misma
    pieza, y aquí la nariz está justo encima de la boca sin formar parte de ella. Dibujada dentro de la
    boca, al hablar se encogería con la mandíbula ocho veces por segundo.

    Es solo la CURVA DE ABAJO de la nariz, no la nariz entera. Estuvo dibujada
    con el caballete y el ala, como en el boceto de origen, y a 112 píxeles esas
    tres líneas naranjas en mitad de la cara no se leían como una nariz: se leían
    como un rayo. Una nariz de dos píxeles y medio solo puede ser su sombra.
  */
  hocico: (
    <path
      d="M57.4 50.6 Q60 53.4 62.6 50.6"
      fill="none"
      className="stroke-orange-400"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  ),

  /*
    Las seis bocas de una boca de persona, que es el caso más fácil de dibujar y
    a la vez el que menos perdona: no hay pico ni hocico que
    justifique una forma rara, así que cualquier postura que no exista de verdad
    se ve falsa enseguida.

    Las tres primeras son CARAS y van a trazo, como en la gata y el perro. La
    `cerrada` es asimétrica a propósito, y es lo único de esta cara que lo es: la
    media sonrisa de medio lado es LO que define a este personaje —el sarcástico
    tranquilo— y es además la boca que más tiempo está en pantalla, porque es el
    reposo. Simétrica quedaba un chaval amable cualquiera.

    Las tres últimas son SONIDOS y no caras: /i-e/ ancha y baja, /o-u/ estrecha y
    alta, /a/ abierta. Las dos grandes enseñan dientes y la pequeña no, que es lo
    que pasa de verdad al hablar; y la lengua solo sale en las dos que tienen
    sitio, porque una lengua recortada dentro de una boca de cuatro píxeles es una
    mancha rosa y no una lengua.

    Todas caben entre y=54 y y=62, o sea entre la nariz y la barbilla, que está en
    69. Es un margen justo: la cara humana es alta pero
    los ojos los clava el esqueleto en y=40, así que de la nariz para abajo queda
    menos sitio del que parece.
  */
  bocas: {
    cerrada: (
      <path
        d="M52 58 Q60 60.5 68 56.5"
        fill="none"
        className="stroke-slate-800"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    ),
    sonrisa: (
      <path
        d="M50 56.5 Q60 65.5 70 56.5"
        fill="none"
        className="stroke-slate-800"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    ),
    pena: (
      <path
        d="M51 62 Q60 55.5 69 62"
        fill="none"
        className="stroke-slate-800"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    ),
    ancha: (
      <>
        <path d="M50 56 Q60 65 70 56 Z" className="fill-slate-800" />
        <path
          d="M51.6 57.2 L68.4 57.2"
          fill="none"
          className="stroke-white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </>
    ),
    redonda: (
      <>
        <ellipse cx="60" cy="59.5" rx="4.4" ry="4.8" className="fill-slate-800" />
        <ellipse cx="60" cy="62" rx="2.2" ry="1.8" className="fill-rose-300" />
      </>
    ),
    abierta: (
      <>
        <path d="M49.5 55.5 Q60 68.5 70.5 55.5 Z" className="fill-slate-800" />
        <path
          d="M51.2 56.8 L68.8 56.8"
          fill="none"
          className="stroke-white"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <ellipse cx="60" cy="60" rx="4" ry="1.8" className="fill-rose-300" />
      </>
    ),
  },
  /*
    La bisagra va en el labio de arriba, no en la mandíbula de verdad.

    Una mandíbula humana gira por la oreja, pero encogiendo desde ahí la boca se
    desplazaría por la cara: lo que se ve al hablar es que el labio de arriba se
    queda quieto y lo demás baja. Ese es el punto: el borde superior de las seis.
  */
  origenBoca: '60px 56px',

  /*
    Zapatillas, con la suela clara aparte. La suela no es detalle de más: las
    patas se plantan en la línea del suelo (y=108) y son lo único del dibujo que
    no se mueve al respirar, así que una mancha oscura sola se lee como una
    sombra y no como un pie.

    Y el gris es el medio y no el oscuro por el tema oscuro: en `slate-700`, la
    parte de arriba de la zapatilla se fundía con el fondo azul marino y lo único
    que quedaba a la vista eran dos suelas blancas flotando bajo el personaje. Es
    el mismo gris que las patas de la gata, que lleva desde el principio bien en
    los dos temas.
  */
  patas: (
    <>
      <ellipse cx="52" cy="102" rx="9" ry="5.5" className="fill-slate-500" />
      <ellipse cx="68" cy="102" rx="9" ry="5.5" className="fill-slate-500" />
      <ellipse cx="52" cy="104.5" rx="9" ry="2.6" className="fill-slate-200" />
      <ellipse cx="68" cy="104.5" rx="9" ry="2.6" className="fill-slate-200" />
    </>
  ),
};
