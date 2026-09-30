import { type DefinicionEspecie } from './tipos';

/**
 * Zoe, la exploradora.
 *
 * Es la primera PERSONA del corral, y eso obliga a contestar tres preguntas que
 * los cinco animales no se hacían.
 *
 * EL COLOR. Venía de un estudio con la paleta de Duolingo y su acento era el
 * #FF4B4B, que aquí no es un color: es el color de haber fallado. Un personaje
 * coral puesto al lado de una corrección en rojo se lee como parte de la
 * corrección. Lo mismo descarta el verde, que es el de acertar. Así que Zoe va
 * de AZUL CIELO —`sky`— con el pelo castaño y la piel cálida: es el único hueco
 * que quedaba libre entre el índigo de Milo, el gris de Nala, el ámbar de Tuco,
 * el verdeazul de Ulises y el naranja de Rufo, y ninguno de sus tonos se
 * confunde con el «bien» ni con el «mal» de una pantalla de ejercicio.
 *
 * EL CRÁNEO. Es el mismo círculo de 26 que el gato y el zorro, y no por pereza:
 * los cuatro anclajes son lo que hace que un gorro dibujado una sola vez siente
 * bien en todos. Cambiar el cráneo por una cabeza humana más ovalada habría
 * salido gratis aquí y caro en `atuendos.tsx`.
 *
 * LA BOINA QUE NO ESTÁ. El estudio le daba una boina coral como seña de
 * identidad. No está, y el motivo no es el color: es que cuatro de los siete
 * atuendos —gorro, corona, hojas y la pluma del antifaz— se cuelgan de la
 * coronilla. Una mascota que ya lleva algo puesto en la cabeza aparecería con
 * dos sombreros en cuanto alguien le comprase el primero. Lo de la cabeza es
 * del sistema de vestir; lo de Zoe es el pelo recogido, las pecas y el zurrón.
 */
export const ZOE: DefinicionEspecie = {
  etiqueta: 'Zoe, la exploradora de Speakmi',

  /*
    Medidos sobre el dibujo de abajo, no estimados: el cráneo es
    `circle(60, 42, 26)`, así que la coronilla cae en 42-26=16 y el medio ancho
    es el radio, 26. Los ojos van en 40 porque los pinta el esqueleto ahí en
    todas las especies, y el cuello en 66 porque es el centro del torso, que es
    el punto por el que la cabeza tiene que girar para no parecer una pegatina.

    El pelo es MÁS ANCHO que esto (llega a 32) y más alto (hasta y=12), y está
    bien que lo sea: el contrato dice que la coronilla se mide «sin contar
    orejas ni copete». Gracias a eso la gorra, que baja hasta 30 y cubre de 34 a
    86, se apoya sobre el cráneo y deja seis píxeles de pelo asomando por cada
    lado, que es como se lleva una gorra de verdad.
  */
  anclajes: { coronilla: 16, anchoCabeza: 26, ojos: 40, cuello: 66 },

  /*
    Las cejas van una unidad más abajo que en los animales (28 en vez de 27) y
    algo más planas. Dos motivos, los dos medidos:

    - En una cara humana la ceja está pegada al ojo; a 27 y con el arco de Milo
      se le quedaba cara de susto permanente.
    - El esqueleto las sube hasta cinco píxeles al sorprenderse. Saliendo de 28,
      en lo más alto quedan en 23, y a esa altura el cráneo todavía va de 42.3 a
      77.7: la punta de fuera, en 43.2, cae sobre piel. Saliendo de 27 se salía
      —la punta quedaba a 26.4 del centro de una cabeza de 26— y se perdía
      contra el castaño del pelo justo en el gesto en el que más se mira una
      ceja. Está medido en la prueba, que saca la subida de las poses de verdad.
  */
  cejas: { y: 28, ancho: 6.8, arco: 2.6, grosor: 2.4, color: 'stroke-amber-950' },

  /*
    LA COLA DE UNA PERSONA ES SU COLETA.

    Este hueco no se puede dejar vacío y tampoco se puede rellenar con
    cualquier cosa: es la única capa con su propio resorte, el más pesado de
    todos, hecha para algo que cuelga y llega tarde al movimiento del cuerpo.
    Una coleta es exactamente eso. Y encaja también en el orden de pintado: la
    capa de la cola va ANTES que el cuerpo, o sea por detrás, que es justo donde
    cae el pelo largo de alguien que se lo ha recogido.

    El arranque, en (42,46), queda dentro del cuerpo Y dentro de la melena, así
    que la unión no se ve nunca; lo que asoma es el tramo que sale por la
    izquierda, por fuera del brazo de acá. El pivote está cerca de la nuca para
    que el ladeo de la cabeza —que va en OTRA capa— no despegue la coleta de la
    cabeza: a 22 píxeles del giro del cuello, seis grados son dos de desvío, y
    el pelo se los come.

    Es una forma RELLENA y no un trazo, aunque el trazo era media línea menos.
    Un trazo tiene el mismo grosor de punta a punta, y eso se ve enseguida: la
    primera versión era un tubo marrón con las dos puntas redondas, más parecido
    a un asa que a una mata de pelo. Rellena se puede afilar, y una coleta se
    afila.

    Va en `amber-800` y no en el `amber-900` de la melena a propósito. La coleta
    es lo único del dibujo que queda suelto contra el fondo de la pantalla, y en
    tema oscuro un castaño más oscuro se hundía en el azul de la noche.
  */
  cola: (
    <>
      <path
        d="M42 46 C 26 50 14 64 14 80 C 14 90 18 96 23 99
           C 16 88 17 74 24 64 C 30 55 38 51 46 52 Z"
        className="fill-amber-800"
      />
      {/* El brillo va por dentro de la mata: si se sale, parece un pelo suelto. */}
      <path
        d="M30 57 C 22 64 18 74 19 84"
        fill="none"
        className="stroke-amber-700"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/*
        El coletero, en el tramo que sí queda a la vista por fuera del brazo.
        Va MEDIDO contra el ancho de la mata ahí (seis píxeles) y girado con
        ella: más grande o sin girar no se lee como una goma que la aprieta, se
        lee como una pegatina turquesa pegada al pelo, que es lo que pasaba.
      */}
      <ellipse
        cx="22"
        cy="66"
        rx="3.6"
        ry="1.7"
        transform="rotate(16 22 66)"
        className="fill-cyan-400"
      />
    </>
  ),
  origenCola: '40px 50px',

  cuerpo: (
    <>
      <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-sky-600" />
      {/*
        La camisa asoma por el escote y poco más. Empezó del tamaño de la
        barriga del gato —rx 22— y sobre una persona eso no es una barriga, es
        un babero: se comía la chaqueta entera y solo quedaba un filo azul.
      */}
      <ellipse cx="61" cy="76" rx="18" ry="20" className="fill-sky-100" />
      {/*
        La bandolera y el zurrón. Son lo que la hace exploradora ahora que no
        lleva boina, y van en el cuerpo y no en la cabeza justamente para no
        pelearse con ningún atuendo: la bufanda se ata en el cuello y la capa
        cuelga por fuera del cuerpo, así que el pecho está libre.
      */}
      <path
        d="M44 62 L71 87"
        fill="none"
        className="stroke-amber-800"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
      <rect x="65" y="86" width="12" height="9" rx="2.5" className="fill-amber-800" />
      <rect x="65" y="86" width="12" height="4" rx="2" className="fill-amber-700" />
    </>
  ),

  /*
    Los brazos. Manga y mano en la misma capa: si la mano se quedara fuera, el
    brazo saludaría y la mano se quedaría clavada en el aire.

    El de allá va un tono más oscuro en los dos, manga y piel, y no solo en la
    manga: una mano del mismo color en los dos lados deshace de golpe la
    profundidad que da el resto.
  */
  alaLejana: (
    <>
      <ellipse cx="86" cy="70" rx="9" ry="16" className="fill-sky-800" />
      <circle cx="87" cy="84" r="5" className="fill-orange-300" />
    </>
  ),
  alaCercana: (
    <>
      <ellipse cx="34" cy="70" rx="10" ry="17" className="fill-sky-700" />
      <circle cx="33" cy="86" r="5.6" className="fill-orange-200" />
    </>
  ),

  /*
    EN EL HUECO DE LAS OREJAS VA EL PELO.

    Una persona tiene orejas, pero no le sirven para lo que sirve esta capa. Se
    pinta detrás del cráneo para que asome por los bordes, y una oreja humana
    está pegada a la cabeza: puesta aquí desaparecería entera debajo del
    círculo de la cara. Lo que sí hace ese papel en una persona es el pelo, que
    es lo que rodea la cara y le da silueta desde detrás.

    De hecho Zoe no tiene orejas dibujadas en ninguna capa, y es lo correcto:
    con el pelo cayendo por delante de las sienes, una oreja de verdad quedaría
    debajo. Dibujarla encima, por verse, la convertía en un bulto de piel sobre
    una mata de pelo.

    Así que aquí va la melena —seis píxeles más ancha que el cráneo y cuatro más
    alta, de la que solo se ve el marco— y los dos mechones que caen por delante
    de los hombros.

    ANCHA, y eso es una corrección. La primera versión la dejaba en tres píxeles
    por todos lados, y el resultado en pantalla era una cara enorme con un aro
    marrón alrededor: parecía calva, no peinada. El pelo de una persona tiene que
    COMERSE parte de la cara, y como por arriba no puede (ver abajo), se la come
    por los lados, aquí y con los dos mechones de `cabeza`.

    ARRIBA NO PUEDE CRECER, y no por gusto: la cúpula del gorro llega a y=11.3 y
    el pelo tiene que quedar por debajo o el gorro aparece medio enterrado en la
    cabeza. Doce es el techo, y de ahí sale el ry de 30.

    Y no hay flequillo, que es lo que pedía el estudio de origen. Las cejas
    arrancan en 28 y el esqueleto las sube cinco: en lo alto rozan y=23, que es
    la mitad de la frente. Un flequillo que baje hasta ahí no tapa pelo, tapa la
    mitad de la cara —las cejas son media expresión— y encima solo al
    sorprenderse, que es cuando más se miran. Pelo recogido y frente despejada;
    además es lo que haría alguien que viaja.
  */
  orejas: (
    <>
      <ellipse cx="60" cy="42" rx="32" ry="30" className="fill-amber-900" />
      {/* El brillo del pelo, sobre el marco: dibujado más adentro no se vería. */}
      <path
        d="M39.5 25.5 A 29 29 0 0 1 60 13"
        fill="none"
        className="stroke-amber-800"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M31 50 Q26 66 31 80 L42 76 Q36 63 38 52 Z" className="fill-amber-900" />
      <path d="M89 50 Q94 66 89 80 L78 76 Q84 63 82 52 Z" className="fill-amber-900" />
    </>
  ),

  cabeza: (
    <>
      <circle cx="60" cy="42" r="26" className="fill-orange-200" />

      {/*
        Los dos mechones de delante, que son lo que estrecha la cara.

        Van aquí y no con la melena porque tienen que pintarse ENCIMA del
        cráneo: puestos detrás, quedarían debajo de la cara y no se verían.

        Sus dos bordes están medidos contra lo que no pueden tocar. Por arriba
        acaban en y=26 y a x=42, que es un pelo por fuera de la punta de la ceja
        (42.8) y por debajo de donde la ceja llega al subir (23). Por dentro se
        quedan en x=40.5, que es un pelo por fuera del blanco del ojo, que
        empieza en 41.4 a esa altura: un mechón que entre ahí no tapa el ojo
        —el ojo se pinta después— sino que aparece cortado por detrás de él, que
        es peor.
      */}
      <path d="M37 26 C 31 38 32 52 40 64 C 43 54 38 42 42 28 Z" className="fill-amber-900" />
      <path d="M83 26 C 89 38 88 52 80 64 C 77 54 82 42 78 28 Z" className="fill-amber-900" />

      {/* Los colores, las pecas y el rubor: es toda la calidez que tiene la cara. */}
      <ellipse cx="46" cy="53" rx="5.6" ry="3.9" className="fill-rose-300" opacity="0.6" />
      <ellipse cx="74" cy="53" rx="5.6" ry="3.9" className="fill-rose-300" opacity="0.6" />
      <g className="fill-orange-400">
        <circle cx="44" cy="51" r="1.3" />
        <circle cx="49" cy="50" r="1.3" />
        <circle cx="46" cy="56" r="1.3" />
        <circle cx="76" cy="51" r="1.3" />
        <circle cx="71" cy="50" r="1.3" />
        <circle cx="74" cy="56" r="1.3" />
      </g>
    </>
  ),

  /*
    La nariz. Va en el hueco del hocico porque es exactamente lo que ese hueco
    describe: lo de la cara que NO se mueve al abrir la boca. Dibujada dentro de
    las bocas, se encogería con la mandíbula en cada sílaba.

    Es media nariz —el ala y la punta— y no un triángulo entero: de frente y a
    este tamaño, una nariz completa se lee como un morro.
  */
  hocico: (
    <path
      d="M59 46.5 Q63.5 51.5 57.5 53"
      fill="none"
      className="stroke-orange-400"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  ),

  /*
    Las seis bocas de una cara humana.

    Las tres primeras son labios: un trazo granate, que es el único color que
    se lee como boca cerrada sobre piel clara sin parecer una herida. La pena no
    es la sonrisa girada: es un arco que cruza POR DEBAJO de las comisuras, que
    es lo único que hace que se lea como tristeza y no como una sonrisa del
    revés.

    Las tres últimas no son caras, son sonidos, y por eso la forma no la decide
    el ánimo sino la fonética: la /i-e/ es ancha y baja, la /o-u/ estrecha y
    alta, y la /a/ la más abierta de las tres. Todas caben entre la nariz (53) y
    el filo de la barbilla (68), que es el sitio que hay.
  */
  bocas: {
    cerrada: (
      <path
        d="M53 58 Q60 61.5 67 58"
        fill="none"
        className="stroke-rose-900"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    ),
    sonrisa: (
      <path
        d="M50.5 57 Q60 65.5 69.5 57"
        fill="none"
        className="stroke-rose-900"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    ),
    pena: (
      <path
        d="M52.5 61.5 Q60 55.5 67.5 61.5"
        fill="none"
        className="stroke-rose-900"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    ),
    ancha: (
      <>
        <ellipse cx="60" cy="59" rx="9.5" ry="3.6" className="fill-rose-900" />
        <ellipse cx="60" cy="60.2" rx="4.6" ry="1.6" className="fill-rose-400" />
      </>
    ),
    redonda: (
      <>
        <ellipse cx="60" cy="60" rx="4.2" ry="4.8" className="fill-rose-900" />
        <ellipse cx="60" cy="61.8" rx="1.9" ry="1.8" className="fill-rose-400" />
      </>
    ),
    abierta: (
      <>
        <ellipse cx="60" cy="60" rx="7" ry="5.4" className="fill-rose-900" />
        <ellipse cx="60" cy="62.4" rx="3.4" ry="2.4" className="fill-rose-400" />
      </>
    ),
  },
  /*
    La bisagra, justo bajo la nariz. Una mandíbula humana gira por la oreja, y
    con el pivote ahí la boca se desplazaba media cara al hablar: el punto que
    importa no es dónde está el hueso, es el punto desde el que la boca abierta
    se encoge hasta parecer cerrada sin moverse de sitio.
  */
  origenBoca: '60px 55px',

  /*
    Las botas. Son lo mismo que las patas de los animales —dos elipses en la
    línea del suelo— con la suela marcada, que es lo que distingue una bota de
    viaje de una zapatilla a este tamaño.
  */
  patas: (
    <>
      <ellipse cx="52" cy="104" rx="8.5" ry="5" className="fill-amber-800" />
      <ellipse cx="68" cy="104" rx="8.5" ry="5" className="fill-amber-800" />
      <path
        d="M44.5 106 H59.5 M60.5 106 H75.5"
        fill="none"
        className="stroke-amber-950"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
};
