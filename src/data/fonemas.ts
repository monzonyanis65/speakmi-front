/**
 * Los sonidos del inglés que le arruinan la pronunciación a un hispanohablante,
 * y qué hacer con la lengua en cada uno.
 *
 * Esto no es la tabla de los 44 fonemas del inglés. La mitad de esa tabla ya la
 * sabe hacer cualquiera que hable español —/m/, /n/, /f/, /tʃ/, /aɪ/ y compañía
 * salen solas— y meterlas aquí solo serviría para que la lista pareciese seria.
 * Lo que hay abajo es la parte corta: los sonidos que o no existen en español, o
 * existen pero se confunden con otro, o existen pero no en ese sitio de la
 * palabra. Son los que hacen que no te entiendan, no los que hacen que suenes
 * raro; la diferencia importa, y al final del archivo está escrito qué se quedó
 * fuera por cada lado.
 *
 * Vive en `data/` y no dentro de un componente porque es contenido, no interfaz:
 * se tiene que poder leer entero, discutir con alguien que enseñe inglés y
 * corregir sin abrir la app ni montar nada. Igual que `mascotas/coreografia.ts`
 * es la partitura y no el instrumento, esto es el temario y no la pantalla.
 *
 * Cómo está escrito, que es la parte que más cuesta y la que más importa:
 *
 *   1. Instrucciones que se puedan seguir mirando un móvil, de pie, con el
 *      micrófono abierto. «La punta de la lengua entre los dientes» vale. «Fricativa
 *      dental sorda» no vale para nada: quien lo lee está intentando hablar.
 *   2. Siempre CON QUÉ lo confundes y POR QUÉ. Saber que el fallo viene de que en
 *      español la b y la v son la misma letra es lo que hace que se te quede;
 *      «pronuncia bien la v» no se le queda a nadie.
 *   3. Un par mínimo: dos palabras inglesas que solo se diferencian en ese
 *      sonido. Es la prueba de que el sonido existe y de que no distinguirlo
 *      cuesta dinero. Donde no hay par mínimo de verdad —la vocal débil, la ese
 *      inicial— va el contraste más cercano y se dice que no es un par mínimo,
 *      en vez de inventarse uno.
 */

export type Familia = 'vocal' | 'consonante';

/** Dos palabras que solo cambian en el sonido del que habla la ficha. */
export interface Contraste {
  uno: string;
  otro: string;
  /** Qué pasa si las dices igual. En español, y concreto. */
  loQueCambia: string;
}

export interface Sonido {
  /** El IPA que se enseña en pantalla. */
  simbolo: string;
  /**
   * Las otras formas de escribir el mismo sonido que puede mandar el servidor.
   *
   * Cada proveedor de fonética transcribe a su manera: unos ponen la marca de
   * largo (`iː`) y otros no, unos usan `ɹ` y otros `r`, la vocal de `bird` viaja
   * como `ɜː`, `ɝ` o `ɚ` según quién la mire. Sin esta lista, el servidor diría
   * «falló la ɝ» y la pantalla no tendría nada que contar.
   */
  alias?: readonly string[];
  familia: Familia;
  /** Cómo llamarlo en voz alta sin decir «fonema». */
  nombre: string;
  /** Una palabra inglesa corriente donde se oye, para anclar el símbolo. */
  ancla: string;
  /** Qué hacer con la lengua, los labios y la mandíbula. En imperativo. */
  comoSeHace: string;
  /** El sonido español con el que se sustituye sin querer. */
  seConfundeCon: string;
  /** Por qué se sustituye con ese y no con otro. Casi siempre es culpa del español. */
  porQue: string;
  parMinimo: Contraste;
  /**
   * El consejo solo vale si el sonido abre la palabra.
   *
   * De momento solo lo lleva la aspiración de /p/ /t/ /k/: el soplo va al empezar
   * palabra y en «cat» o «stop» no hay nada que soplar. Sin esta marca, una /t/
   * final flojita mandaría a soplar justo donde no se sopla.
   */
  soloAlPrincipio?: true;
}

/**
 * Las vocales.
 *
 * Van primero porque son el problema gordo y el que menos se trabaja. El español
 * tiene cinco vocales y las cinco son claras, fuertes y siempre iguales; el
 * inglés tiene el doble, la mitad son flojas y cambian según si la sílaba lleva
 * acento o no. Quien traduce las vocales inglesas a las cinco españolas no
 * comete un error de acento: fabrica palabras distintas de las que quería decir.
 */
const VOCALES: readonly Sonido[] = [
  {
    simbolo: 'iː',
    alias: ['i', 'i:'],
    familia: 'vocal',
    nombre: 'la i larga y tensa',
    ancla: 'sheep',
    comoSeHace:
      'Estira los labios como en una sonrisa forzada, sube la lengua todo lo que puedas hacia el paladar y hacia delante, y AGUANTA: dura casi el doble que una i española. Si no notas tensión en las comisuras, no es esta.',
    seConfundeCon: 'la i española de «mi», que sirve para esta y para la otra',
    porQue:
      'El español tiene una sola i, así que el oído no separa estas dos y la boca hace la de siempre. El resultado no es un acento: es que la mitad de las veces dices la otra palabra.',
    parMinimo: {
      uno: 'sheep (oveja)',
      otro: 'ship (barco)',
      loQueCambia:
        'Solo cambia la vocal. Con la i española dices las dos igual, y quien te escucha tiene que adivinar.',
    },
  },
  {
    simbolo: 'ɪ',
    familia: 'vocal',
    nombre: 'la i floja',
    ancla: 'ship',
    comoSeHace:
      'Empieza a decir «i» y quédate a medio camino hacia la «e»: baja un poco la lengua, suelta los labios (no sonrías) y que salga corta y seca. Si te sale parecida a una e relajada, vas bien; si te suena a i limpia, todavía no.',
    seConfundeCon: 'otra vez la i española',
    porQue:
      'Es la misma raíz que la de arriba, pero el arreglo va en dirección contraria: aquí no hay que estirar, hay que aflojar. Cuesta más porque relajar una vocal se siente como decirla mal.',
    parMinimo: {
      uno: 'live (vivir)',
      otro: 'leave (irse)',
      loQueCambia: 'Vivir e irse. Es el par que más veces al día se dice mal.',
    },
  },
  {
    simbolo: 'æ',
    familia: 'vocal',
    nombre: 'la a de «cat»',
    ancla: 'cat',
    comoSeHace:
      'Abre la boca como para una «a» bien abierta, baja la mandíbula más de lo que te parece razonable, pero pon la lengua donde la tienes para la «e» y estira un poco las comisuras. Sale algo entre a y e que en español no existe.',
    seConfundeCon: 'la «e» o la «a», según la palabra y según el día',
    porQue:
      'Como no existe en español, cada uno la redondea hacia la vocal española que le pilla más cerca, y no siempre la misma. Por eso «bad» sale «bed» un día y «bad» a la española otro.',
    parMinimo: {
      uno: 'bad (malo)',
      otro: 'bed (cama)',
      loQueCambia: 'Con la e española, «a bad day» se convierte en «a bed day».',
    },
  },
  {
    simbolo: 'ʌ',
    familia: 'vocal',
    nombre: 'la a corta y apagada',
    ancla: 'cup',
    comoSeHace:
      'Boca medio abierta y del todo relajada, lengua en el centro sin tocar nada, y muy corta. Es casi la «a» española, pero más cerrada y con la mitad de duración. No pongas los labios redondos.',
    seConfundeCon: 'la «u» española, arrastrado por cómo se escribe',
    porQue:
      'Se escribe con u —cup, bus, but, much— y en español la letra manda sobre el oído. Así que «cup» sale «cup» tal cual, cuando suena mucho más cerca de «cap».',
    parMinimo: {
      uno: 'luck (suerte)',
      otro: 'lock (cerradura)',
      loQueCambia:
        'Si además redondeas los labios te vas a «lock». Esta vocal se estropea por leerla, no por oírla.',
    },
  },
  {
    simbolo: 'ə',
    familia: 'vocal',
    nombre: 'la vocal débil, donde el inglés aplasta todo lo átono',
    ancla: 'about',
    comoSeHace:
      'No hagas nada. Literalmente: deja la boca entreabierta donde esté, no muevas la lengua, no redondees los labios, y suelta un soplo con voz. Cuanto menos la trabajes, mejor sale.',
    seConfundeCon: 'la vocal que está escrita, dicha entera',
    porQue:
      'En español todas las vocales se pronuncian enteras lleven acento o no, así que la boca las dice todas fuertes. En inglés, la sílaba sin acento se aplasta hasta esto: la a de «about», la o de «today», la e de «problem» y la u de «support» son todas el mismo sonido. Y aquí no se pierde solo el acento: se pierde el RITMO, que es lo que hace que no sigas a un nativo hablando rápido. Tú esperas sílabas enteras y él solo te da dos o tres por frase.',
    parMinimo: {
      uno: 'today, dicho «t’DÉI»',
      otro: 'today, dicho «tu-DÉI»',
      loQueCambia:
        'No es un par mínimo: es la misma palabra de las dos maneras, porque es donde mejor se oye. La segunda tiene dos sílabas completas y por eso suena a español aunque los sonidos sean correctos.',
    },
  },
  {
    simbolo: 'ɜː',
    alias: ['ɜ', 'ɝ', 'ɚ', 'ər', '3:'],
    familia: 'vocal',
    nombre: 'la vocal larga de «bird»',
    ancla: 'bird',
    comoSeHace:
      'Boca poco abierta, lengua plana en el centro sin tocar nada, labios sin redondear, y aguanta el sonido. En inglés americano, a la vez que suena curva la punta de la lengua hacia atrás. Lo importante: la lengua NO vibra ni golpea.',
    seConfundeCon: 'una «e» seguida de la «r» española de «caro»',
    porQue:
      'Está escrita con r —bird, work, her, first— y en español una r se pronuncia siempre. Aquí la r no es una consonante aparte: es la forma de la propia vocal, y meter el golpecito español la parte en dos.',
    parMinimo: {
      uno: 'bird (pájaro)',
      otro: 'bed (cama)',
      loQueCambia:
        'Sin la vocal larga, «bird» se queda a un paso de «bed». Y con la r española encima, suena a una palabra de dos sílabas que no existe.',
    },
  },
  {
    simbolo: 'ʊ',
    familia: 'vocal',
    nombre: 'la u floja',
    ancla: 'book',
    comoSeHace:
      'Como la u española pero con los labios sueltos, sin apretar ni adelantar, la lengua un poco más baja y todo muy corto. Piensa en una u desganada.',
    seConfundeCon: 'la u española de «tú», que otra vez vale para las dos',
    porQue: 'Mismo cuento que con la i: el español tiene una u y el inglés dos.',
    parMinimo: {
      uno: 'full (lleno)',
      otro: 'fool (tonto)',
      loQueCambia: 'Llamarle tonto a alguien cuando querías decir que estaba lleno.',
    },
  },
  {
    simbolo: 'uː',
    alias: ['u', 'u:'],
    familia: 'vocal',
    nombre: 'la u larga',
    ancla: 'food',
    comoSeHace:
      'Labios muy redondeados y adelantados, como para silbar o para dar un beso, lengua atrás y arriba, y mantenla. Es la pareja tensa de la de arriba: aquí sí hay que apretar.',
    seConfundeCon: 'la u española, que se queda a medias entre las dos',
    porQue:
      'La u española no llega ni a la tensión de esta ni a la relajación de la otra, así que las dos salen igual de tibias.',
    parMinimo: {
      uno: 'pool (piscina)',
      otro: 'pull (tirar)',
      loQueCambia: 'Una piscina y un tirón.',
    },
  },
  {
    simbolo: 'eɪ',
    alias: ['ei'],
    familia: 'vocal',
    nombre: 'la e que se desliza hacia la i',
    ancla: 'day',
    comoSeHace:
      'Empieza en «e» y sin cortar ni volver a empujar, cierra la boca hacia la «i». Es un movimiento, no dos vocales: e→i en una sola sílaba. La segunda mitad es floja y corta.',
    seConfundeCon: 'la «e» española, que es plana y no se mueve',
    porQue:
      'El español tiene «ei» en «peine», pero como dos vocales bien marcadas, y donde va sola —«cake», «name», «late»— la boca se queda en la e. Así que «cake» sale «quec».',
    parMinimo: {
      uno: 'late (tarde)',
      otro: 'let (dejar)',
      loQueCambia: 'Si no deslizas, «I was late» se convierte en «I was let».',
    },
  },
  {
    simbolo: 'oʊ',
    alias: ['əʊ', 'ou', 'o'],
    familia: 'vocal',
    nombre: 'la o que se desliza hacia la u',
    ancla: 'go',
    comoSeHace:
      'Empieza con los labios poco redondeados y ciérralos hacia la «u» mientras el sonido está sonando: o→u, en una sola sílaba. Los labios se mueven; si están quietos, es la o española.',
    seConfundeCon: 'la «o» española, que es corta, plana y siempre igual',
    porQue:
      'Es el delator más fácil de oír: «no», «go», «know», «home» dichos con la o española suenan a español aunque el resto esté bien. Y cuando la o se queda plana y además se alarga, se cruza con la vocal de «caught».',
    parMinimo: {
      uno: 'coat (abrigo)',
      otro: 'caught (pillado)',
      loQueCambia: 'Sin el deslizamiento hacia la u, el abrigo se vuelve un verbo.',
    },
  },
];

/**
 * Las consonantes.
 *
 * Aquí los fallos son más fáciles de arreglar que los de las vocales, porque casi
 * siempre son una posición de la lengua que se puede describir en una frase y
 * comprobar con un dedo. La mala noticia es que se notan más: una consonante
 * cambiada convierte la palabra en otra palabra, y no en una versión rara de la
 * misma.
 */
const CONSONANTES: readonly Sonido[] = [
  {
    simbolo: 'θ',
    familia: 'consonante',
    nombre: 'la de «think», sin voz',
    ancla: 'think',
    comoSeHace:
      'Saca la punta de la lengua entre los dientes hasta que se vea, y sopla. Las cuerdas no vibran: ponte dos dedos en la garganta y no debe temblar nada. La lengua tiene que asomar; si se queda detrás de los dientes, sale otra cosa.',
    seConfundeCon: 'la «s», la «t» o la «d», según de dónde seas',
    porQue:
      'Si hablas español de España, tu «z» de «cereza» está a un paso: solo hay que sacar más la lengua. Si hablas español de América, ese sonido no existe en tu boca y sale la vecina más cercana, casi siempre una s. Es el mismo fallo con tres caras.',
    parMinimo: {
      uno: 'think (pensar)',
      otro: 'sink (fregadero)',
      loQueCambia: '«I think» y «I sink»: pensar y hundirse.',
    },
  },
  {
    simbolo: 'ð',
    familia: 'consonante',
    nombre: 'la de «this», con voz',
    ancla: 'this',
    comoSeHace:
      'La misma posición que la de arriba —la lengua entre los dientes— pero con voz: la garganta TIENE que temblar. Buena noticia: ya lo haces todos los días, es la d de «nada» y de «cada», la segunda d de «dedo».',
    seConfundeCon: 'la «d» dura de «dedo» (la primera) o una «s»',
    porQue:
      'En español las dos des son la misma letra y nadie se da cuenta de que son sonidos distintos, así que al ver una d escrita sale la dura. Y esta aparece en «the», «this», «that», «they», «there»: las palabras más repetidas del idioma.',
    parMinimo: {
      uno: 'they (ellos)',
      otro: 'day (día)',
      loQueCambia: 'Con la d dura, «they came» es «day came».',
    },
  },
  {
    simbolo: 'v',
    familia: 'consonante',
    nombre: 'la v de verdad',
    ancla: 'very',
    comoSeHace:
      'El labio de ABAJO toca los dientes de ARRIBA. Los labios no se tocan entre ellos en ningún momento. Prueba así: di una «f» larga y, sin mover nada de sitio, enciende la voz. Eso es.',
    seConfundeCon: 'la «b»',
    porQue:
      'En español la b y la v son la misma letra y exactamente el mismo sonido: «vaca» y «baca» se dicen igual. No es que lo hagas mal, es que tu idioma nunca te pidió distinguirlas, así que el oído tampoco las separa al escuchar.',
    parMinimo: {
      uno: 'vest (chaleco)',
      otro: 'best (el mejor)',
      loQueCambia: 'Un chaleco y lo mejor. Y «vote/boat», votar y barco.',
    },
  },
  {
    simbolo: 'z',
    familia: 'consonante',
    nombre: 'la s con voz',
    ancla: 'zoo',
    comoSeHace:
      'La «s» de siempre, misma lengua y mismos dientes, pero con la garganta vibrando. Ya la tienes: es la s de «mismo», «desde», «isla». Alarga esa y no la sueltes.',
    seConfundeCon: 'la «s» sorda de toda la vida',
    porQue:
      'En español ese sonido existe, pero solo por accidente cuando le sigue una consonante con voz; nunca al principio ni al final, y nunca cambia el significado. En inglés cambia el significado y además está en todas partes: «is», «was», «his», «has», los plurales y la tercera persona llevan z, aunque estén escritos con s.',
    parMinimo: {
      uno: 'peas (guisantes)',
      otro: 'peace (paz)',
      loQueCambia:
        'Y sobre todo «eyes/ice», «rise/rice». Comerse la z es lo que hace que los plurales no se oigan.',
    },
  },
  {
    simbolo: 'ʃ',
    familia: 'consonante',
    nombre: 'el sonido de mandar callar',
    ancla: 'she',
    comoSeHace:
      'Shhh. Lleva la lengua un poco más atrás que para la «s», adelanta y redondea los labios como si fueras a soplar, y deja salir el aire sin voz. Los labios redondeados es la mitad del truco.',
    seConfundeCon: 'la «s» o la «ch»',
    porQue:
      'No existe en español —salvo en México y en algunas zonas, donde sí— así que sale la s si se piensa en el aire, o la ch si se piensa en el golpe. La ch inglesa existe aparte, y aquí no hay golpe: es aire continuo.',
    parMinimo: {
      uno: 'ship (barco)',
      otro: 'chip (patata frita)',
      loQueCambia: 'Y «she/see», que es peor porque «she» se dice cada dos frases.',
    },
  },
  {
    simbolo: 'ʒ',
    familia: 'consonante',
    nombre: 'la ll de un argentino',
    ancla: 'vision',
    comoSeHace:
      'Igual que el de mandar callar, pero con voz. Si conoces el acento rioplatense, es su «ll» de «calle» o su «y» de «yo». Misma lengua, mismos labios redondeados, la garganta encendida.',
    seConfundeCon: 'el sonido sordo de «she»',
    porQue:
      'Es el más raro de esta lista y el que menos urge: sale en «usually», «television», «decision», «measure» y poco más. Se apaga la voz sin querer y sale «vishion», que se entiende igual.',
    parMinimo: {
      uno: 'measure, con la ll argentina',
      otro: 'measure, con el shhh',
      loQueCambia:
        'No es un par mínimo: casi no hay palabras que se distingan solo por esto. Por eso está el último en la cola de cosas que arreglar.',
    },
  },
  {
    simbolo: 'dʒ',
    alias: ['ʤ'],
    familia: 'consonante',
    nombre: 'la ch con voz',
    ancla: 'job',
    comoSeHace:
      'La «ch» de «coche», pero con la garganta vibrando desde el primer instante. Empieza con la lengua pegada arriba —hay un golpe— y suéltala hacia el shhh. Si no notas golpe al principio, te falta.',
    seConfundeCon: 'la «y» de «yo» o directamente la «ch»',
    porQue:
      'Está escrito con j o con g —job, John, age, change— y en español esas letras suenan a «jota», que aquí no pinta nada. Sin el golpe inicial sale «yob» en vez de «job».',
    parMinimo: {
      uno: 'jeep (todoterreno)',
      otro: 'cheap (barato)',
      loQueCambia: 'Solo cambia la voz. Y «joke/yolk», un chiste y una yema de huevo.',
    },
  },
  {
    simbolo: 'j',
    familia: 'consonante',
    nombre: 'la i consonante de «hielo»',
    ancla: 'yes',
    comoSeHace:
      'Que sea suave: es una «i» que se desliza hacia la vocal siguiente, y la lengua NO llega a tocar el paladar. Nada de golpe. Si notas contacto, se te está convirtiendo en la de «job».',
    seConfundeCon: 'la de «job», justo la de la ficha anterior',
    porQue:
      'En buena parte del mundo hispanohablante la y y la ll se endurecen: «yo» y «hielo» salen con un golpe que en inglés ya es otra consonante. Así «year» se vuelve «jeer» y «yellow» se vuelve el nombre de un postre.',
    parMinimo: {
      uno: 'year (año)',
      otro: 'jeer (burlarse)',
      loQueCambia: 'Este y el anterior son el mismo problema visto desde los dos lados.',
    },
  },
  {
    simbolo: 'h',
    familia: 'consonante',
    nombre: 'el soplo',
    ancla: 'hat',
    comoSeHace:
      'Solo aire, como cuando empañas un cristal para escribir con el dedo. La lengua no hace absolutamente nada y la garganta no raspa. Es lo más fácil de esta lista en cuanto te acuerdas de que hay que hacer algo.',
    seConfundeCon: 'nada, porque se calla; o la «j» de «jamón», que raspa demasiado',
    porQue:
      'En español la h escrita es muda, así que el ojo la ve y la boca la salta: «hi» sale «ai», «have» sale «av», «home» sale «oum». Y quien sabe que ahí va algo suele tirar de la jota, que se hace con la garganta y suena mucho más áspera.',
    parMinimo: {
      uno: 'hat (sombrero)',
      otro: 'at (en)',
      loQueCambia: 'Y «hill/ill», «heart/art». Si la h no suena, se cae media palabra.',
    },
  },
  {
    simbolo: 'ŋ',
    familia: 'consonante',
    nombre: 'la n de «tango»',
    ancla: 'sing',
    comoSeHace:
      'Sube la parte de ATRÁS de la lengua hasta tapar contra el fondo del paladar, como en la n de «banco» o «tengo». Y ahí se queda: no sueltes ninguna «g» detrás. El sonido termina con la lengua todavía arriba.',
    seConfundeCon: 'la «n» normal, o una n seguida de una g bien marcada',
    porQue:
      'En español este sonido ya existe, pero solo delante de otra consonante y sin que nadie se dé cuenta; al final de palabra no aparece nunca. Así que «sing» sale «sin» o «sing-g», y las dos se oyen mal. Toca todas las palabras acabadas en -ing, que son muchas.',
    parMinimo: {
      uno: 'sing (cantar)',
      otro: 'sin (pecado)',
      loQueCambia: 'Y «thing/thin». La -ing del gerundio se apoya entera en esto.',
    },
  },
  {
    simbolo: 'ɹ',
    alias: ['r'],
    familia: 'consonante',
    nombre: 'la r que no vibra',
    ancla: 'red',
    comoSeHace:
      'Levanta la punta de la lengua hacia el paladar y NO la dejes llegar: se queda a medio centímetro, sin tocar y sin vibrar. Redondea un poco los labios a la vez. Si notas cualquier golpecito o cualquier temblor, es la española.',
    seConfundeCon: 'la r de «caro» (un golpe) o la de «perro» (vibración)',
    porQue:
      'Las dos erres españolas se hacen tocando; la inglesa se hace sin tocar, y es prácticamente el único sonido de esta lista donde hay que aprender a NO hacer algo.',
    parMinimo: {
      uno: 'very, con la r inglesa',
      otro: 'very, con la r de «caro»',
      loQueCambia:
        'No es un par mínimo, es algo peor: ese golpecito español es exactamente el sonido que un nativo usa para la tt de «better». Así que al oírte no piensa «acento», entiende una d. «Very» le llega como «veddy».',
    },
  },
  {
    simbolo: 'w',
    familia: 'consonante',
    nombre: 'la u consonante de «huevo»',
    ancla: 'we',
    comoSeHace:
      'Redondea los labios casi hasta cerrarlos y ábrelos soltando el sonido. La lengua no toca nada arriba. Solo labios.',
    seConfundeCon: 'una «g» pegada delante: «güe»',
    porQue:
      'En español, «huevo» y «hueso» se endurecen en la boca de casi todo el mundo y salen «güevo» y «güeso». Esa g se cuela también en inglés: «we» sale «güi», «work» sale «guorc», «one» sale «guan».',
    parMinimo: {
      uno: 'west (oeste)',
      otro: 'guest (invitado)',
      loQueCambia: 'Justo la g que se cuela. Son dos palabras distintas de verdad.',
    },
  },
  {
    simbolo: 'p t k',
    alias: ['p', 't', 'k', 'pʰ', 'tʰ', 'kʰ'],
    soloAlPrincipio: true,
    familia: 'consonante',
    nombre: 'el soplo detrás de la p, la t y la k',
    ancla: 'pen',
    comoSeHace:
      'Al principio de palabra, suelta un golpe de aire justo detrás de la consonante. Compruébalo: palma de la mano delante de la boca y di «pen», «time», «cat». Tiene que notarse el soplo en la mano. Si no se nota, un nativo oye «Ben», «dime», «gat».',
    seConfundeCon: 'la b, la d y la g',
    porQue:
      'La p, la t y la k españolas son secas: salen sin aire detrás. Para un oído inglés, lo que separa la p de la b al principio de palabra no es la voz, es ese soplo; sin él, tu p entra en el cajón de la b. Es un fallo que nadie te corrige nunca porque quien lo comete no sabe que está haciendo nada.',
    parMinimo: {
      uno: 'pin (alfiler)',
      otro: 'bin (cubo)',
      loQueCambia: 'Y «time/dime», «coat/goat». Tres pares de consonantes por el precio de uno.',
    },
  },
];

export const SONIDOS: readonly Sonido[] = [...VOCALES, ...CONSONANTES];

/**
 * Los dos patrones que no son un sonido, sino un sitio.
 *
 * No son fonemas: son costumbres de la boca española que se activan según DÓNDE
 * cae el sonido en la palabra. La /s/ de «school» está perfectamente bien hecha;
 * el problema es la «e» que aparece delante sola. Y la /d/ de «and» tampoco está
 * mal hecha: está desaparecida. Explicarlos como si fueran un sonido defectuoso
 * mandaría a practicar lo que ya se sabe hacer.
 *
 * Por eso viven aparte y se detectan mirando la posición, no la puntuación: ver
 * `lib/fonetica.ts`.
 */
export type IdPatron = 'ese-inicial' | 'consonante-final';

export interface Patron {
  id: IdPatron;
  titulo: string;
  comoSeHace: string;
  porQue: string;
  parMinimo: Contraste;
}

export const PATRONES: Record<IdPatron, Patron> = {
  'ese-inicial': {
    id: 'ese-inicial',
    titulo: 'Se te coló una «e» delante de la s',
    comoSeHace:
      'Arranca la palabra con la lengua ya puesta en la s, sin nada antes. Dos trucos que funcionan: alarga la ese —«ssschool»— en lugar de apoyarte en una vocal; o pega la palabra a la anterior y piensa «the-school», «I-speak», «my-Spanish», porque con la palabra de delante la e desaparece sola.',
    porQue:
      'En español no existe ni una sola palabra que empiece por s más consonante: por eso «Spain» es «España» y «school» es «escuela». La boca añade esa e sin pedir permiso, igual que no puedes decir «tl» al principio. Es el rasgo que más delata un acento español y a la vez el más fácil de quitar, porque no hay que aprender ningún sonido nuevo: hay que quitar uno.',
    parMinimo: {
      uno: 'speak',
      otro: 'e-speak',
      loQueCambia:
        'No es un par mínimo —«espeak» no existe— pero es una sílaba entera de más, y donde más se nota es en «Spanish», «study», «school» y «start».',
    },
  },
  'consonante-final': {
    id: 'consonante-final',
    titulo: 'El final de la palabra se quedó a medias',
    comoSeHace:
      'La palabra acaba en esa consonante y ahí se termina: ni vocal detrás («and» no es «andi») ni desaparecida («and» no es «an»). Al practicar, exagera el final hasta que te suene raro; en velocidad normal quedará justo.',
    porQue:
      'En español casi todo acaba en vocal o en -n, -s, -r, -l, así que la boca hace una de dos cosas con un final inglés: le pone una vocal de apoyo o se lo come. Y en inglés el final de palabra es donde vive la gramática: el pasado (-ed), los plurales y posesivos (-s), la tercera persona. Si el final se cae, no se cae un sonido: se cae el tiempo verbal, y pasas de «I worked» a «I work».',
    parMinimo: {
      uno: 'band (grupo)',
      otro: 'ban (prohibir)',
      loQueCambia: 'Y «card/car», «wind/wine». Comerse el final cuesta palabras enteras.',
    },
  },
};

/* ------------------------------------------------------------------ */
/* Búsqueda por símbolo                                                */
/* ------------------------------------------------------------------ */

/**
 * Deja un símbolo IPA en su forma de comparar.
 *
 * Quita las marcas de acento (`ˈ`, `ˌ`), los separadores de sílaba y la marca de
 * largo, porque ninguna de las tres cambia de qué sonido hablamos y todas
 * aparecen o no según el proveedor. La marca de largo se quita sin miedo: las
 * parejas larga/corta del inglés se distinguen además por el símbolo base —`iː`
 * frente a `ɪ`, `uː` frente a `ʊ`— así que no se mezcla ninguna al quitarla.
 */
export function normalizarSimbolo(crudo: string): string {
  return crudo
    .normalize('NFC')
    .replace(/[ˈˌˑ'".\s]/g, '')
    .replace(/[ː:]/g, '');
}

const INDICE = new Map<string, Sonido>();
for (const sonido of SONIDOS) {
  for (const clave of [sonido.simbolo, ...(sonido.alias ?? [])]) {
    const normal = normalizarSimbolo(clave);
    // El primero gana: si dos fichas se pelean por un alias, se queda la de más
    // arriba en la lista. Sin esto, un alias repetido por descuido cambiaría en
    // silencio lo que se enseña de un sonido.
    if (!INDICE.has(normal)) INDICE.set(normal, sonido);
  }
}

/** La ficha de un símbolo, o null si no tenemos nada que contar de él. */
export function sonidoDe(simbolo: string): Sonido | null {
  return INDICE.get(normalizarSimbolo(simbolo)) ?? null;
}

/**
 * QUÉ SE HA QUEDADO FUERA, Y POR QUÉ
 *
 * Fuera porque el español ya los hace bien y no hay nada que enseñar:
 *   /p/ /b/ /t/ /d/ /k/ /g/ /f/ /m/ /n/ /l/ /s/ /tʃ/, y los diptongos /aɪ/ (my),
 *   /aʊ/ (now) y /ɔɪ/ (boy), que son «ai», «au» y «oi» tal cual. La única
 *   pega de /p/ /t/ /k/ es la aspiración, y esa sí está, en su propia ficha.
 *
 * Fuera porque se nota el acento pero se te entiende igual. La lista tiene que
 * caber en la cabeza de alguien y cada ficha de más le quita sitio a una que
 * cambia palabras:
 *   · La «l» oscura del final (feel, milk, full). Marca acento, no significado.
 *   · La /t/ que se vuelve un golpecito entre vocales (water → «wader»). Es un
 *     problema de ENTENDER a un nativo, no de que te entiendan a ti, y esta
 *     pantalla corrige lo que sale de tu boca.
 *   · /ɒ/ y /ɔː/ (cot / caught). Medio mundo angloparlante las ha fundido en una
 *     sola, así que enseñar a separarlas es trabajo para algo que ni siquiera
 *     los nativos hacen igual. La parte que sí importa —no dejar la «o» plana
 *     como en español— está en la ficha de /oʊ/.
 *   · /ɑː/ (father). Muy parecida a la «a» española; la diferencia es de
 *     duración y no cuesta palabras.
 *
 * Fuera porque no son un sonido:
 *   El acento de palabra (PREsent frente a preSENT) y la entonación de la frase.
 *   Importan tanto o más que todo esto, pero se miden y se enseñan en otro sitio
 *   —el shadowing— y mezclarlos aquí convertiría esta tabla en un curso entero.
 *
 * Y una advertencia para quien venga a añadir fichas: el valor de este archivo
 * está en que es CORTO. La pantalla solo enseña dos sonidos por intento; una
 * lista de cuarenta no haría que se aprendiera más, solo que la ficha que de
 * verdad hacía falta apareciese menos veces.
 */
