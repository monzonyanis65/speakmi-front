import { type DefinicionEspecie } from './tipos';

/**
 * Barnaby, el oso profesor.
 *
 * Es el único de la casa que va VESTIDO, y esa es toda su gracia: los demás son
 * animales y él es alguien que da clase. El cárdigan y la pajarita
 * van dibujados dentro del cuerpo y no como atuendo porque no se los quita
 * nunca; lo que se compra en la tienda se pone ENCIMA de ellos, igual que
 * encima de los demás.
 *
 * Viene de un dibujo hecho con la paleta de Duolingo —verde #58CC02, rojo
 * #FF4B4B, ámbar #FFC800 y naranja #FF9600— y aquí no queda ni uno. El recoloreo
 * no fue solo cambiar códigos: en esta aplicación el ROJO significa haber
 * fallado y el VERDE haber acertado, así que un personaje de cualquiera de los
 * dos se leería como una corrección cada vez que sale al lado de una. La
 * pajarita era carmesí en el original y aquí es índigo de marca por eso mismo.
 *
 * LO QUE SE QUEDÓ FUERA: LAS GAFAS DE LECTURA.
 *
 * El original lleva unas gafas doradas y son media personalidad del personaje,
 * pero no caben con las GAFAS DE SOL de la tienda y no es cuestión de ajustar
 * dos píxeles. Las de la tienda son dos cristales OPACOS de 21x17 colgados del
 * anclaje `ojos`; un aro de profesor tiene que rodear un ojo de radio 9, o sea
 * medir más que ese cristal, así que por definición asoma por arriba y por
 * abajo del cristal negro. Dibujarlo por debajo del ojo tampoco vale: el ojo se
 * pinta después y se lo come.
 *
 * O sea que no hay un tamaño que funcione con y sin gafas de sol: hay que
 * elegir cuál manda. Manda la de la tienda, porque es la que se puede quitar y
 * porque es la misma prenda para todas las especies. Lo que queda del profesor
 * son las cejas gruesas, la pajarita y el cárdigan con botones, que es bastante:
 * es el único que va vestido.
 */
export const BARNABY: DefinicionEspecie = {
  etiqueta: 'Barnaby, el oso profesor de Speakmi',

  /*
    Medidos sobre el dibujo de abajo, no estimados.

    El cráneo es el `rect` de x=33 a x=87 y de y=16 para abajo: 54 de ancho, o
    sea 27 de medio ancho, y la coronilla en 16. Un píxel de más aquí no se ve
    en el oso, se ve en el GORRO, que calcula su ala a partir de estos números y
    queda colgando en el aire por un lado.

    El medio ancho es 27 y no 26 como el gato o el perro porque un oso tiene la
    cabeza cuadrada: si el cráneo se estrechara a 26 para reaprovechar sus
    anclajes, dejaría de parecer un oso y pasaría a ser otro perro redondo.
  */
  anclajes: { coronilla: 16, anchoCabeza: 27, ojos: 40, cuello: 66 },

  /*
    Cejas gruesas y oscuras: son la mitad de lo que le hace profesor.

    En y=28 y no más arriba porque las orejas son CÍRCULOS grandes que bajan por
    los lados hasta y=27.5, y una ceja que empieza dentro de la oreja se lee como
    un pelo suelto. Con ancho 6.5 la de acá arranca en x=43.5, y a la altura a la
    que llegaría a rozarla —y=27— la oreja izquierda no pasa de x=39.4. Cuatro
    píxeles de aire, y la ceja aún sube al sorprenderse.

    El color es el más oscuro del pelaje. Con un `stone-700` estaban dibujadas y
    eran correctas, pero sobre el `stone-500` del cráneo son dos tonos vecinos y
    a 112 píxeles —que es como se ve en la aplicación— se fundían en una mancha.
  */
  cejas: { y: 28, ancho: 6.5, arco: 3.2, grosor: 3, color: 'stroke-stone-900' },

  /*
    LA COLA CORTA, QUE ES EL PROBLEMA PROPIO DE ESTE ANIMAL.

    Un oso tiene un muñón, no una cola, y eso obliga a poner el pivote justo al
    revés que el zorro. El zorro lleva el suyo A MITAD de cola —en (28,86), con
    la cola naciendo en (46,88)— porque con una cola de ese tamaño pivotada en la
    raíz, los 14 grados que llega a girar el esqueleto barrerían medio lienzo.

    Aquí sobra todo lo contrario. Con el pivote a mitad de este muñón, los mismos
    14 grados mueven la punta menos de dos píxeles: la cola se queda clavada y el
    oso parece de cartón justo cuando todo lo demás se mueve. Así que el pivote
    va en la RAÍZ, en (45,83), que es el punto más lejano de la punta que hay
    dentro de esta pieza. Desde ahí los 14 grados pasean la punta diez píxeles
    arriba y abajo: no barre como un abanico, se menea en la grupa.

    Y el muñón sale casi de lado, no hacia abajo. Colgando hacia abajo era más
    largo y el balanceo se veía mejor, pero a la altura de las patas y del mismo
    gris pasaba a leerse como una tercera pierna. Saliendo por detrás se queda en
    lo que es: un bulto de pelo que asoma seis píxeles por la cadera.

    Y la raíz va ENTERRADA en el cuerpo, que se pinta encima: así la cola nace de
    la silueta en vez de quedar pegada por fuera. Es la misma idea que en el
    zorro, y además es lo que hace que pivotar en la raíz sea gratis: el punto
    que no se mueve es justo el que no se ve.

    El tono es el del brazo de ALLÁ y no el del de acá, aunque sea el de acá el
    que tiene al lado. Con el mismo gris que el brazo cercano —que es lo que
    parece correcto, porque los dos son el mismo pelaje— el muñón y el codo se
    fundían en un solo bulto y lo que se veía era un oso con un brazo deforme.
  */
  cola: (
    <path
      d="M45 83 C 37 84 30 86 25 90"
      fill="none"
      className="stroke-stone-700"
      strokeWidth="9.5"
      strokeLinecap="round"
    />
  ),
  origenCola: '45px 83px',

  cuerpo: (
    <>
      {/* El oso. La misma elipse que los demás: la silueta es de la casa. */}
      <ellipse cx="60" cy="66" rx="34" ry="36" className="fill-stone-500" />

      {/*
        El cárdigan. Va un poco más estrecho que el cuerpo por los dos lados a
        propósito: esos ocho píxeles de pelaje que quedan alrededor son lo que
        hace que se lea como una prenda puesta encima y no como la barriga clara
        que llevan los demás.
      */}
      <ellipse cx="60" cy="74" rx="26" ry="26" className="fill-acento-600" />

      {/*
        La camisa, en pico. Empieza en y=65, o sea DEBAJO de la barbilla (el
        cráneo acaba en 67), porque lo que quedara por encima no se vería nunca:
        la cabeza se pinta después y lo taparía.
      */}
      <path d="M49 65 L71 65 L60 85 Z" className="fill-amber-100" />

      {/* La botonadura del cárdigan, que es lo que lo separa de un jersey. */}
      <path
        d="M60 85 L60 98"
        fill="none"
        className="stroke-amber-900"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="60" cy="89" r="2.2" className="fill-amber-900" />
      <circle cx="60" cy="95" r="2.2" className="fill-amber-900" />

      {/*
        La pajarita. Era carmesí en el original y aquí es índigo de marca: el
        rojo en esta aplicación es el color de haber fallado, y una mascota con
        una mancha roja en el cuello dice «error» cada vez que sale al lado de
        una corrección.

        Queda a la altura del cuello, que es donde se cuelgan la BUFANDA y la
        CAPA, y eso está comprobado prenda a prenda: la bufanda la tapa entera
        —quien se pone una bufanda se tapa la pajarita, así que es lo correcto— y
        la capa le cruza el cuello por detrás y le deja el broche encima sin
        borrarla. Ninguna de las dos la parte por la mitad, que es lo que habría
        pasado dibujándola un par de píxeles más abajo.
      */}
      <path d="M49 65 L60 70 L49 75 Z" className="fill-marca-600" />
      <path d="M71 65 L60 70 L71 75 Z" className="fill-marca-600" />
      <circle cx="60" cy="70" r="3.4" className="fill-marca-800" />
    </>
  ),

  /*
    Los brazos, con la almohadilla de la zarpa marcada. Un oso es sobre todo
    zarpas, y sin ellas estos dos óvalos son las alas de cualquiera.

    El de acá es más corto que el del zorro (ry 16 en vez de 18) y no por gusto:
    con 18 acaba en y=88, que es por donde sale la cola, y la zarpa y el muñón se
    tocaban. Del mismo gris y pegados se leían como un solo bulto deforme; con
    tres píxeles de aire en medio se leen como dos cosas.
  */
  alaLejana: (
    <>
      <ellipse cx="86" cy="68" rx="9.5" ry="14" className="fill-stone-700" />
      <ellipse cx="86" cy="77" rx="6" ry="4.5" className="fill-stone-800" />
    </>
  ),
  alaCercana: (
    <>
      <ellipse cx="32" cy="69" rx="11" ry="16" className="fill-stone-600" />
      <ellipse cx="32" cy="78" rx="7" ry="5" className="fill-stone-800" />
    </>
  ),

  /*
    Las orejas redondas, que son LA seña del oso: de todos los animales de la
    casa es el único que no las tiene ni en punta ni caídas.

    Nacen en y=16, o sea a la altura misma de la coronilla, y por eso el GORRO
    de la tienda las deja asomar: el ala de la gorra pasa por y≈21 a esa altura
    y por fuera solo llega a x=33, así que de cada oreja se sigue viendo la mitad
    de arriba y todo el lado de afuera.

    Distintas de tamaño y de altura a propósito: con las dos iguales la cara se
    lee como un icono simétrico, y un par de píxeles de diferencia basta para que
    parezca dibujada a mano.
  */
  orejas: (
    <>
      <circle cx="36" cy="16" r="11.5" className="fill-stone-600" />
      <circle cx="36" cy="16" r="5.5" className="fill-amber-200" />
      <circle cx="84" cy="17" r="11" className="fill-stone-600" />
      <circle cx="84" cy="17" r="5.2" className="fill-amber-200" />
    </>
  ),

  cabeza: (
    <>
      {/*
        El cráneo es un rectángulo redondeado y no un círculo, y es lo que hace
        que un oso no sea un perro: la mandíbula de un oso es ancha y cuadrada
        abajo. De x=33 a x=87 y de y=16 a y=67, que es de donde salen los
        anclajes de arriba.
      */}
      <rect x="33" y="16" width="54" height="51" rx="22" className="fill-stone-500" />

      {/* Los mofletes, debajo del morro para que este les tape el borde. */}
      <ellipse cx="40" cy="51" rx="5" ry="3.2" className="fill-rose-300" opacity="0.55" />
      <ellipse cx="80" cy="51" rx="5" ry="3.2" className="fill-rose-300" opacity="0.55" />

      {/*
        El morro crema, que es el sitio donde vive toda la boca. Va aquí y no en
        `hocico` porque no se mueve con nada: lo que se mueve es la nariz de
        encima y las seis bocas de dentro.

        Ocupa de y=41.5 a y=66.5 sobre un cráneo que acaba en 67. Es el hocico
        más grande de los seis, y eso es lo que da sitio a que las bocas
        abiertas se lean de verdad y no como un punto.
      */}
      <ellipse cx="60" cy="54" rx="17" ry="12.5" className="fill-amber-100" />
    </>
  ),

  /*
    La nariz. Es ancha como la de un oso pero no más de rx=6, y ese tope no es
    estético: la nariz se pinta DESPUÉS de los ojos, y con rx=7 el borde de
    arriba se le subía encima del párpado de abajo de los dos ojos y parecía que
    el oso miraba desde detrás de una mancha.
  */
  hocico: (
    <>
      <ellipse cx="60" cy="50.5" rx="6" ry="4.5" className="fill-stone-900" />
      <ellipse cx="57.6" cy="48.8" rx="1.9" ry="1.1" className="fill-stone-600" />
    </>
  ),

  /*
    Las seis bocas, todas dentro del morro crema, que va de y=41.5 a y=66.5 y a
    la altura de la boca mide unos 32 píxeles de ancho. Fuera de él el trazo
    oscuro cae sobre el pelaje y se pierde, así que ese óvalo es el marco de
    todas: ninguna baja de y=65.5 ni se abre más allá de x=46.

    Las tres primeras son CARAS y salen del mismo sitio —el surco bajo la
    nariz—, que es lo que las hace parecer la misma boca en tres humores. Las
    tres últimas son SONIDOS y por eso no son versiones más abiertas de la
    sonrisa: la /i-e/ es ancha y baja, la /o-u/ estrecha y alta, y la /a/ la que
    de verdad abre. Una lengua pequeña asoma solo en las tres abiertas, porque
    en un trazo no cabe.
  */
  bocas: {
    cerrada: (
      <path
        d="M60 55.5 L60 58 M60 58 Q54 63.5 49 58 M60 58 Q66 63.5 71 58"
        fill="none"
        className="stroke-stone-900"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    ),
    sonrisa: (
      <path
        d="M60 55.5 L60 58 M60 58 Q53 66 46.5 58 M60 58 Q67 66 73.5 58"
        fill="none"
        className="stroke-stone-900"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    ),
    /*
      La pena no es la sonrisa del revés: es un arco que pasa POR DEBAJO de las
      comisuras y ya no cuelga del surco. Girar una sonrisa 180 grados sigue
      pareciendo una sonrisa hasta que la línea cruza por abajo.
    */
    pena: (
      <path
        d="M60 55.5 L60 58 M51 63.5 Q60 56.5 69 63.5"
        fill="none"
        className="stroke-stone-900"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    ),
    ancha: (
      <>
        <ellipse cx="60" cy="59" rx="9.5" ry="3.4" className="fill-stone-900" />
        <ellipse cx="60" cy="60" rx="4.5" ry="1.6" className="fill-rose-400" />
      </>
    ),
    redonda: (
      <>
        <ellipse cx="60" cy="60" rx="4.4" ry="4.6" className="fill-stone-900" />
        <ellipse cx="60" cy="62" rx="2" ry="1.6" className="fill-rose-400" />
      </>
    ),
    abierta: (
      <>
        <ellipse cx="60" cy="60" rx="7" ry="5.2" className="fill-stone-900" />
        <ellipse cx="60" cy="62.5" rx="3.4" ry="2.4" className="fill-rose-400" />
      </>
    ),
  },
  /*
    La bisagra, justo bajo la nariz. Es el punto al que se encoge la boca
    abierta hasta parecer cerrada, y aquí no puede bajar más: con la bisagra en
    la mitad del morro, al hablar la boca se despegaba del surco y subía y
    bajaba por el crema como si fuera pegada con imán.
  */
  origenBoca: '60px 55.5px',

  /*
    Las plantas, con los dedos marcados en crema. Es el detalle que remata al
    oso —un oso se reconoce por la planta del pie— y cabe porque las patas son
    lo único del dibujo que no se ladea.
  */
  patas: (
    <>
      <ellipse cx="51" cy="104" rx="9" ry="5.5" className="fill-stone-700" />
      <circle cx="47.6" cy="102.6" r="1.3" className="fill-amber-100" />
      <circle cx="51" cy="102" r="1.3" className="fill-amber-100" />
      <circle cx="54.4" cy="102.6" r="1.3" className="fill-amber-100" />
      <ellipse cx="69" cy="104" rx="9" ry="5.5" className="fill-stone-700" />
      <circle cx="65.6" cy="102.6" r="1.3" className="fill-amber-100" />
      <circle cx="69" cy="102" r="1.3" className="fill-amber-100" />
      <circle cx="72.4" cy="102.6" r="1.3" className="fill-amber-100" />
    </>
  ),
};
