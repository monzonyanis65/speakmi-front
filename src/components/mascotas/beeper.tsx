import { type DefinicionEspecie } from './tipos';

/**
 * Beeper, el robot de Speakmi.
 *
 * Es el raro de la colección y conviene decirlo por delante, porque casi todas
 * las decisiones de este archivo salen de ahí. El esqueleto está escrito para
 * bichos de carne: el cuerpo respira, la cabeza se ladea con un resorte, la
 * cola llega tarde arrastrada por el tronco y la boca se estira para hablar. Un
 * robot no hace nada de eso. Así que no se trata de que el chasis disimule el
 * movimiento, sino de darle a cada capa del esqueleto una pieza de máquina a la
 * que ese movimiento le venga de verdad:
 *
 *   respirar    -> el núcleo del pecho late, como el ralentí de un motor
 *   la cola     -> un cable de corriente, que es lo único de un robot que
 *                  cuelga y llega tarde cuando el cuerpo se mueve
 *   las orejas  -> dos altavoces y una antena, que es lo que oye una máquina
 *   la boca     -> un display de nivel, que es lo que hace un robot en lugar
 *                  de abrir los labios
 *   las cejas   -> dos segmentos LED encendidos sobre el visor
 *
 * LA PALETA NO ES LA DEL BOCETO, y por partida doble.
 *
 * El boceto venía en cian y cobalto, con los LED en verde menta y el bulbo en
 * amarillo. El verde y el rojo no se pueden copiar porque en esta aplicación
 * SIGNIFICAN algo: verde es acertar y rojo es fallar. Un robot con la cara
 * llena de luces verdes estaría dando un «correcto» permanente, y con una roja
 * parecería averiado. Y el cian tampoco, aunque no signifique nada: el búho ya
 * es `teal` y Zoe se quedó el `sky`, así que un robot azul habría sido el
 * tercero de la misma familia en una colección que se elige en una cuadrícula.
 *
 * Así que Beeper es de GRIS FRÍO (`zinc`) y todo lo que se le enciende va en
 * ÁMBAR: el acento de la casa, el mismo del pico del búho y de las patas de
 * Milo. No es un apaño por descarte. Un chasis metálico con luces ámbar es
 * exactamente lo que parece una máquina, y de paso Beeper queda como la única
 * silueta de la colección sin color propio, que es lo que lo hace reconocible
 * al lado de los demás. El riesgo que queda es la gata, que también es gris, y
 * se separa por dos cosas: ella es un gris claro y él uno oscuro, y ninguna de
 * sus siluetas se parece.
 */
export const BEEPER: DefinicionEspecie = {
  etiqueta: 'Beeper, el robot de Speakmi',

  /*
    Medidos sobre el dibujo, no estimados, y la prueba de al lado los ata al
    cráneo para que no se separen nunca:

      coronilla 16 -> el borde de arriba del chasis de la cabeza
      ancho     26 -> medio ancho del mismo chasis: (86 - 34) / 2

    Una cabeza CUADRADA es el caso que peor lleva un gorro redondo, porque sus
    esquinas de arriba están mucho más altas que las de un cráneo redondo del
    mismo ancho. Por eso el radio de las esquinas es 17 y no 8: con esquinas más
    vivas, el casquete del gorro —que es media elipse de 26 x 18,7— dejaba las
    dos puntas del chasis asomando por encima, y un gorro con dos orejas
    cuadradas saliendo no se lee como un gorro puesto, se lee como un gorro mal
    dibujado. Con radio 17 el contorno del chasis queda por debajo del casquete
    en todo su recorrido, con dos o tres píxeles de margen.
  */
  anclajes: { coronilla: 16, anchoCabeza: 26, ojos: 40, cuello: 66 },

  /*
    Las cejas de Beeper son dos segmentos de LED, no dos pelos.

    Un robot sin cejas pierde media expresión igual que cualquiera, así que lo
    que cambia no es si las tiene, es de qué están hechas: `arco` casi a cero
    —una ceja recta es una barra encendida, una ceja curva vuelve a ser pelo— y
    `grosor` 3, un punto por encima del resto, porque un segmento de display es
    grueso y parejo.

    Van en ámbar sobre el visor oscuro, que es el sitio de la cara con más
    contraste que hay, y caen en la franja que queda entre el borde de arriba
    del visor y la banda de los ojos. Es un hueco estrecho por los cuatro lados
    y la prueba de al lado lo vigila entero, porque de los cuatro solo uno es
    evidente:

      abajo  -> un píxel más y se apoyan en la banda ámbar de los ojos, o sea
                ámbar sobre ámbar, que es lo mismo que no tener cejas
      arriba -> el esqueleto las sube hasta cinco píxeles en los estados de
                sorpresa, y ahí se salen del visor por el borde de arriba
      A LOS LADOS -> este es el que no se ve venir. Levantadas, la ceja no solo
                sube: sube hacia la ESQUINA REDONDEADA del visor, donde el
                borde se mete hacia dentro. Con `ancho` 8 la punta de fuera se
                salía justo en el gesto de sorpresa —que es cuando más se mira
                la cara— y se quedaba flotando sobre el chasis. Por eso son de
                7,2 y no de 8, y por eso el visor tiene las esquinas de radio
                10 y no de 12.
  */
  cejas: { y: 27.5, ancho: 7.2, arco: 1.2, grosor: 3, color: 'stroke-acento-400' },

  /*
    LA COLA ES EL CABLE DE CORRIENTE, y es la pieza que más me costó decidir.

    Esta capa lleva el resorte más pesado del esqueleto a propósito: una cola no
    se mueve sola, la arrastra el cuerpo y llega tarde. Un robot no tiene cola,
    pero sí tiene exactamente una cosa que se comporta así: el cable que le
    cuelga por detrás. Cualquier otra idea que se me ocurrió —un propulsor, una
    aleta, un panel— es RÍGIDA, y una pieza rígida con este resorte encima se
    ve rota, no viva. El cable es la única que gana con el retraso.

    Sale por abajo a la izquierda, hace un lazo en el suelo y sube con el
    enchufe en alto: un robot que anda por ahí buscando dónde recargarse. El
    trazo arranca en (46,92), bien dentro del chasis, para que nazca de la
    silueta en vez de quedar pegado por fuera.
  */
  cola: (
    <>
      <path
        d="M46 92 C 38 100 27 102 19 96 C 14 92 12 86 13 81"
        fill="none"
        className="stroke-zinc-600"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* El enchufe, al final del cable y ladeado: en vertical exacto parecía
          un poste clavado, y el cable entero perdía la sensación de peso. */}
      <g transform="rotate(-14 13 80)">
        <rect x="8.5" y="73.5" width="9" height="7.5" rx="2.5" className="fill-zinc-700" />
        <rect x="10" y="69.8" width="2.2" height="4" rx="1.1" className="fill-zinc-300" />
        <rect x="13.8" y="69.8" width="2.2" height="4" rx="1.1" className="fill-zinc-300" />
      </g>
    </>
  ),
  /*
    El pivote va en el punto más bajo del lazo y no en el arranque del cable.
    Girando desde donde entra en el chasis, el enchufe barría media pantalla en
    cada ciclo; desde aquí el mismo balanceo mueve la punta lo justo y la parte
    que toca el cuerpo se queda quieta debajo del chasis, que la tapa.
  */
  origenCola: '30px 98px',

  /*
    El chasis: rectángulo redondeado en vez de la elipse de los cinco animales.

    Esta capa es la que RESPIRA, y ahí estaba el problema entero del personaje:
    una caja de metal que se hincha y se deshincha se lee como un fallo de
    dibujo. La solución no es quitarle el aliento —no se puede, el movimiento es
    del esqueleto— sino darle algo que justifique el pulso: el núcleo ámbar del
    pecho. Con él, el ciclo se lee como el ralentí de una máquina encendida, que
    es lo mismo que respirar pero para algo que no tiene pulmones. Las esquinas
    van muy redondeadas por lo mismo: una cápsula aguanta el estiramiento, una
    caja de esquinas vivas no.
  */
  cuerpo: (
    <>
      <rect x="27" y="33" width="66" height="69" rx="22" className="fill-zinc-700" />
      <rect x="29.5" y="34.5" width="62" height="65" rx="20" className="fill-zinc-500" />
      {/* El panel claro del pecho hace de barriga: es la superficie sobre la
          que se leen el núcleo y las rejillas. */}
      <rect x="41" y="60" width="39" height="36" rx="13" className="fill-zinc-100" />
      {/* El núcleo. Tres círculos: la carcasa oscura, la luz y el brillo
          descentrado, que es lo que separa una lámpara de un botón pintado. */}
      <circle cx="61" cy="78" r="9.5" className="fill-zinc-900" />
      <circle cx="61" cy="78" r="6" className="fill-acento-500" />
      <circle cx="59" cy="76" r="2.4" className="fill-acento-300" />
      {/* Dos rejillas de ventilación: sin ellas el panel del pecho es una
          mancha clara y el chasis deja de parecer una carcasa atornillada. */}
      <rect x="51" y="90" width="20" height="2.2" rx="1.1" className="fill-zinc-400" />
      <rect x="54" y="93.5" width="14" height="2.2" rx="1.1" className="fill-zinc-400" />
    </>
  ),

  /*
    Los brazos: un tramo articulado y una mano suelta, que no toca el brazo.

    La mano separada es el truco más barato que hay para decir «esto es una
    máquina» sin dibujar ni un engranaje, y además le viene bien al esqueleto:
    la capa gira el brazo entero como un bloque, así que una mano pegada se
    vería como un remo. Suelta, el giro se lee como un brazo que se articula.
    El de allá es más pequeño y más oscuro, igual que en las cinco especies: sin
    esa diferencia el personaje se ve recortado en papel.

    Y los dos van SEPARADOS del chasis, no pegados a su borde. La primera
    versión los dejaba metidos casi dentro de la silueta y en las capturas se
    veía lo que eso significa: el esqueleto levanta un brazo para saludar y para
    ponerse en jarras, y un brazo que no asoma no saluda a nadie. Sobresalen
    cinco píxeles a la izquierda y tres a la derecha, que es lo mismo que sacan
    las patas delanteras de los cinco animales.
  */
  alaLejana: (
    <>
      <rect x="85.5" y="60" width="10.5" height="21" rx="5.25" className="fill-zinc-800" />
      <circle cx="93.5" cy="88" r="5" className="fill-zinc-800" />
    </>
  ),
  alaCercana: (
    <>
      <rect x="22.5" y="60" width="12" height="24" rx="6" className="fill-zinc-700" />
      <circle cx="25.5" cy="91.5" r="6" className="fill-zinc-700" />
      <circle cx="23.5" cy="89.5" r="2" className="fill-zinc-400" />
    </>
  ),

  /*
    En el hueco de las orejas van DOS ALTAVOCES Y UNA ANTENA, y las dos cosas
    juntas porque este hueco se pinta detrás del cráneo y es el único sitio del
    que puede asomar algo por encima de la cabeza.

    Los altavoces están donde estarían las orejas y hacen lo que hacen las
    orejas: son por donde oye. Asoman ocho píxeles por cada lado, que es lo que
    hace falta para que se vean con la rejilla y no como dos bultos.

    La antena NO va en el centro, y esa es la decisión menos obvia del archivo.
    Centrada quedaba mejor a pelo, pero atravesaba la copa del gorro justo por
    su punto más alto, y una antena saliendo de la coronilla de una gorra se ve
    como un fallo de capas. Echada a la izquierda sale por el lado del casquete
    —igual que las orejas de punta del gato y del zorro— y con la corona puesta
    pasa por fuera del contorno entera. De paso rompe la simetría de la cara,
    que en un personaje de cabeza cuadrada es lo que evita que parezca un icono.
  */
  orejas: (
    <>
      <path
        d="M45 24 L36 9"
        fill="none"
        className="stroke-zinc-500"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="35" cy="7.5" r="4.2" className="fill-acento-400" />
      <circle cx="33.8" cy="6.2" r="1.5" className="fill-acento-300" />

      <rect x="26" y="36" width="12" height="19" rx="6" className="fill-zinc-700" />
      <rect x="82" y="37" width="11" height="17" rx="5.5" className="fill-zinc-700" />
      <path
        d="M28 42 H32.5 M28 45.5 H32.5 M28 49 H32.5"
        fill="none"
        className="stroke-zinc-900"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M87.5 42.5 H91.5 M87.5 45.5 H91.5 M87.5 48.5 H91.5"
        fill="none"
        className="stroke-zinc-950"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),

  /*
    La cabeza: carcasa, frontal y visor.

    LA BANDA ÁMBAR DE LOS OJOS NO ES ADORNO, y es lo único de este archivo que
    existe por culpa del esqueleto. Los ojos son blancos y los pinta el
    esqueleto, igual en las seis especies; pero cuando se cierran, lo que dibuja
    son dos arcos en `#0f172a`, y sobre un visor oscuro eso no es un ojo
    cerrado: no es nada. Beeper se quedaría sin poder dormir y sin poder pensar,
    que son dos de los once estados. La banda es el zócalo claro sobre el que
    esos dos arcos SÍ se ven, y de paso convierte los dos ojos en una sola
    ranura de LED, que es lo que quería la cara de todas formas. El tono es el
    ámbar 500 y no uno más claro por la razón contraria: con la banda muy clara
    el blanco del ojo desaparecía en ella y solo quedaba la pupila.
  */
  cabeza: (
    <>
      <rect
        data-pieza="craneo"
        x="34"
        y="16"
        width="52"
        height="52"
        rx="17"
        className="fill-zinc-700"
      />
      <rect x="35.5" y="17" width="49" height="48" rx="16" className="fill-zinc-500" />
      <rect
        data-pieza="visor"
        x="38"
        y="19"
        width="44"
        height="43"
        rx="10"
        className="fill-zinc-950"
      />
      <rect
        data-pieza="banda-ojos"
        x="40"
        y="30"
        width="40"
        height="20"
        rx="10"
        className="fill-acento-500"
      />
      {/* Los píxeles de rubor, a los lados del display y no en los pómulos:
          dentro del visor no queda más sitio libre, y fuera de él el chasis
          solo deja dos píxeles a cada lado. */}
      <rect x="41" y="52" width="4" height="2" rx="1" className="fill-acento-600" />
      <rect x="42" y="55" width="2.8" height="2" rx="1" className="fill-acento-600" />
      <rect x="75" y="52" width="4" height="2" rx="1" className="fill-acento-600" />
      <rect x="75.2" y="55" width="2.8" height="2" rx="1" className="fill-acento-600" />
    </>
  ),

  /*
    El «hocico» de Beeper es EL MARCO DEL DISPLAY, y encaja en este hueco mejor
    que cualquier nariz.

    Este campo existe para lo de la cara que NO se mueve al hablar, porque el
    esqueleto encoge y estira la boca sílaba a sílaba y una nariz metida dentro
    se estiraría con ella. Un display es justo eso partido en dos de forma
    natural: la carcasa y el cristal están quietos, y lo que se mueve es lo que
    se pinta dentro. Dicho de otra manera, este marco es lo que hace que las
    seis bocas de abajo se lean como una pantalla y no como seis dibujos
    sueltos flotando en la barbilla.
  */
  hocico: (
    <>
      <rect
        data-pieza="marco-display"
        x="46"
        y="50"
        width="28"
        height="10"
        rx="3.5"
        className="fill-zinc-700"
      />
      <rect
        data-pieza="cristal-display"
        x="47.5"
        y="51.3"
        width="25"
        height="7.7"
        rx="2.4"
        className="fill-zinc-950"
      />
      {/*
        La línea de cero del medidor, y es la pieza que salvó las bocas de
        sonido. Sin ella, cuatro barras apoyadas en el mismo suelo no se leían
        como un nivel: se leían como dientes. Un carril debajo de las barras es
        lo que convierte cinco bloques en una gráfica, y va en el marco y no en
        la boca porque la escala de una gráfica no sube con la señal.
      */}
      <rect x="48.4" y="58.2" width="23.2" height="0.8" rx="0.4" className="fill-acento-600" />
    </>
  ),

  /*
    LAS SEIS BOCAS DE UN ROBOT QUE NO TIENE LABIOS.

    Un robot no abre la boca: enciende un display. Así que las seis viven en la
    misma pantallita y lo que cambia es lo que se pinta en ella. La pantalla se
    reparte en dos idiomas, que es lo que hace que las seis sigan
    distinguiéndose entre sí:

      LAS TRES CARAS son UNA LÍNEA. Recta en reposo (señal plana), curvada
      hacia abajo por el centro en la sonrisa y hacia arriba en la pena. Una
      línea es lo que dibuja una máquina cuando no está midiendo nada, y el
      arco es lo mismo que hace un emoticono: con eso solo, contento y triste
      se distinguen a 112 píxeles.

      LOS TRES SONIDOS son BARRAS DE NIVEL, porque eso es literalmente lo que
      enseña un aparato mientras suena. Y la escalera del vocalizador cae
      redonda:

        ancha   (/i/, /e/) -> cinco barras, todo el ancho, todas BAJAS
        redonda (/o/, /u/) -> tres barras, juntas en el centro, ALTAS
        abierta (/a/)      -> cinco barras, todo el ancho, todas ALTAS

      LAS BARRAS SON FINAS Y VAN MUY SEPARADAS, y eso costó dos vueltas de
      capturas. La primera versión las tenía anchas y casi pegadas, con las
      alturas parejas, y no se leían como un nivel: se leían como DIENTES.
      Cuatro bloques anchos dentro de un recuadro oscuro son una dentadura, y
      la boca de celebrar acababa pareciendo una mueca apretada. Lo que separa
      un ecualizador de una boca con dientes es la proporción —barra estrecha,
      hueco ancho— más un perfil de alturas desparejo y el carril de cero que
      dibuja el marco. Con las tres cosas vuelve a ser una gráfica.

      Es la misma oposición que en un animal —ancha y baja contra estrecha y
      alta— solo que dicha con el ancho del espectro en vez de con los labios.
      Y no hace falta inventar nada para la cerrada, que el esqueleto también
      usa al hablar: la línea plana es el escalón de silencio de la escalera.

    NINGUNA SE APAGA DEL TODO, y por eso hay una línea en la cerrada en vez de
    nada. Las seis se cruzan en opacidad ocho veces por segundo, y una que sea
    un rectángulo vacío no se ve como una boca cerrada: se ve como la pantalla
    apagándose a media palabra.

    Las alturas están topadas en 5,3. No es un número redondo: al hablar el
    esqueleto estira la boca hasta un 25 % más alta, y con barras más largas la
    punta se salía por encima del cristal y pintaba sobre el marco.
  */
  bocas: {
    cerrada: (
      <path
        d="M49.5 55 H70.5"
        fill="none"
        className="stroke-acento-400"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    ),
    sonrisa: (
      <path
        d="M50.5 53.2 Q60 60.4 69.5 53.2"
        fill="none"
        className="stroke-acento-400"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    ),
    /* La pena es la única que baja de brillo. Un display que se atenúa dice
       «sin ganas» sin tocar la forma, y es un recurso que solo tiene una
       máquina: a un animal no se le puede apagar la boca. */
    pena: (
      <path
        d="M50.5 57.6 Q60 51.4 69.5 57.6"
        fill="none"
        className="stroke-acento-600"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    ),
    ancha: (
      <g className="fill-acento-400">
        <rect x="48.5" y="56.4" width="2.2" height="1.6" rx="1.1" />
        <rect x="53.7" y="55.4" width="2.2" height="2.6" rx="1.1" />
        <rect x="58.9" y="56.1" width="2.2" height="1.9" rx="1.1" />
        <rect x="64.1" y="55.2" width="2.2" height="2.8" rx="1.1" />
        <rect x="69.3" y="56.3" width="2.2" height="1.7" rx="1.1" />
      </g>
    ),
    redonda: (
      <g className="fill-acento-400">
        <rect x="56.3" y="54.2" width="2.2" height="3.8" rx="1.1" />
        <rect x="58.9" y="52.7" width="2.2" height="5.3" rx="1.1" />
        <rect x="61.5" y="54.4" width="2.2" height="3.6" rx="1.1" />
      </g>
    ),
    abierta: (
      <g className="fill-acento-400">
        <rect x="48.5" y="54.6" width="2.2" height="3.4" rx="1.1" />
        <rect x="53.7" y="52.7" width="2.2" height="5.3" rx="1.1" />
        <rect x="58.9" y="53.9" width="2.2" height="4.1" rx="1.1" />
        <rect x="64.1" y="53.1" width="2.2" height="4.9" rx="1.1" />
        <rect x="69.3" y="55" width="2.2" height="3" rx="1.1" />
      </g>
    ),
  },

  /*
    La bisagra no es una bisagra: es LA LÍNEA BASE DEL DISPLAY, y=58.

    En un animal este punto está donde se junta la mandíbula, porque es por
    donde se cierra la boca. Aquí no hay mandíbula que cerrar, pero hay algo
    que hace lo mismo y mejor: las barras de un medidor crecen desde abajo. Con
    el origen en la base, lo que el esqueleto llama «abrir la boca» sale como
    el nivel subiendo, que es exactamente lo que tiene que hacer una pantalla
    mientras alguien habla. Puesto en el centro del display, las barras crecían
    hacia los dos lados a la vez y se despegaban del suelo del medidor.
  */
  origenBoca: '60px 58px',

  /*
    Los pies son dos botas magnéticas con la suela metálica a la vista. Van
    dentro de la capa que respira, igual que en las cinco especies, y el pivote
    del aliento está en el suelo: así se quedan plantadas y lo que sube es el
    chasis.
  */
  patas: (
    <>
      <rect x="42.5" y="97.5" width="17" height="10.5" rx="4" className="fill-zinc-700" />
      <rect x="60.5" y="97.5" width="17" height="10.5" rx="4" className="fill-zinc-700" />
      <rect x="44.5" y="103.5" width="13" height="3.5" rx="1.75" className="fill-zinc-900" />
      <rect x="62.5" y="103.5" width="13" height="3.5" rx="1.75" className="fill-zinc-900" />
    </>
  ),
};
