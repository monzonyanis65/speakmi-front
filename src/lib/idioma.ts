/**
 * ¿Esto está en inglés o en español?
 *
 *
 * POR QUÉ HACE FALTA ADIVINARLO
 *
 * Al tocar una opción se oye cómo se pronuncia, y eso solo vale si la opción
 * está en inglés. Media aplicación tiene opciones en español —las preguntas de
 * comprensión lectora, las columnas de significados, los «¿qué quiere decir
 * esto?» de gramática— y leerlas con una voz inglesa no es un defecto de
 * sonido: es enseñar una pronunciación que no existe. Es la misma regla que
 * `voz.ts` aplica al revés, donde antes que dejar a una voz española leer
 * inglés se prefiere el silencio.
 *
 * El ejercicio no lo dice. El servidor manda `options: [{text}]` y nada más:
 * ni idioma, ni de qué tipo de lección viene. Así que se mira el texto.
 *
 *
 * CÓMO SE DECIDE, Y POR QUÉ ASÍ
 *
 * No se busca «inglés correcto»: se buscan MARCAS, cosas que en un idioma
 * aparecen y en el otro no pueden aparecer. Una «ñ» o una tilde solo salen en
 * español; «th», «sh» o una «w» solo salen en inglés. Un puñado de palabras
 * vacías de cada idioma cuenta igual, porque son las que más se repiten.
 *
 * El validador del back hace algo parecido con `pareceIngles`, pero allí se
 * exigen DOS marcas porque lo que mira son frases enteras de una consigna.
 * Aquí no sirve: media opción es una palabra suelta —«aunt», «reading»,
 * «doctor»— y con ese listón no sonaría casi nada.
 *
 * Por eso se cuenta en dos columnas en vez de en una, y por eso hay un tercer
 * veredicto. Las tres respuestas no son dos:
 *
 *   ingles   → hay marcas de inglés y ninguna de español. Suena.
 *   espanol  → al revés, o gana el español por goleada. No suena.
 *   no-se    → ni una marca de nada («box», «Nuevos»). NO SUENA.
 *
 * Ese «no-se» es la pieza importante. Un desempate inventado acertaría la mitad
 * de las veces, y la mitad equivocada es una voz inglesa leyendo español en voz
 * alta. Callarse no enseña nada, pero tampoco enseña nada falso.
 *
 * Medido sobre las 665 preguntas de opción múltiple del temario (2 660
 * opciones): 1 669 suenan, 959 se callan por estar en español y 32 se callan por
 * no saberlo. Ni una opción española clasificada como inglesa.
 */

export type Idioma = 'ingles' | 'espanol' | 'no-se';

/**
 * Palabras que solo existen en uno de los dos idiomas.
 *
 * Las dudosas están fuera a propósito, y cada una costó un fallo real:
 * «a», «me», «he» y «has» son inglesas y españolas a la vez («he visto», «has
 * dicho»), y con ellas dentro «llevar a cabo» y «me arrepiento» se clasificaban
 * como inglés. «no», «son» y «era» son españolas y también inglesas («no way»,
 * «my son», «a new era»), y con ellas dentro «definitely / probably / maybe /
 * no way» se clasificaba como español.
 */
const PALABRAS_ESPANOLAS = new Set(
  (
    'el la los las un una unos unas de del que y o en con por para su sus se es ' +
    'esta estan si muy mas pero porque cuando donde quien como cual cuanto ' +
    'todavia ya tambien cada desde hasta sobre entre nada ninguno dos tres uno ' +
    'lo le les mi tu al han hay fue ser estar tiene tienen'
  ).split(' '),
);

const PALABRAS_INGLESAS = new Set(
  (
    'the is are was were am an to of and or in on at for with from by you your ' +
    'she it we they his her their my this that these those do does did have had ' +
    'will would should could can not but there some any all always never him ' +
    'them if as what who which when where how more than too very yes been being ' +
    'get got go went'
  ).split(' '),
);

/** Lo que una palabra española puede llevar al final y una inglesa no. */
const FINAL_ESPANOL = /(cion|idad|mente|ando|iendo)$/;

/**
 * Letras juntas que el español no escribe nunca.
 *
 * Fuera quedaron «ea» y «ee», que parecen inglesas y no lo son: «sea», «real»,
 * «idea», «creer», «leer». Y «ing» solo cuenta al final, porque en medio está
 * en «ingeniero» y en «ingrediente».
 *
 * Las consonantes dobles son la marca más barata que existe: el español solo
 * dobla ll, rr, cc y nn, así que cualquier otra —«stopped», «offer», «ss»— es
 * inglesa sin discusión.
 */
const TROZO_INGLES =
  /th|sh|wh|ph|ck|kn|wr|gh|oo|ou|ow|aw|ew|k|w|tion|ght|bb|dd|ff|gg|mm|pp|ss|tt|vv|zz|ing$/;

/** Lo que solo se escribe en español, sin tener que partir en palabras. */
const SIGNOS_ESPANOLES = /[ñáéíóúü¿¡]/;

/** Minúsculas y sin tildes, para poder comparar con las listas. */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface Marcas {
  espanol: number;
  ingles: number;
}

function marcasDe(texto: string): Marcas {
  let espanol = 0;
  let ingles = 0;

  if (SIGNOS_ESPANOLES.test(texto.toLowerCase())) espanol += 1;
  // El apóstrofo de «don't», «I'm» o «it's». El español no lo usa.
  if (/['’]/.test(texto)) ingles += 1;

  for (const palabra of normalizar(texto).split(/[^a-z']+/)) {
    if (!palabra) continue;
    if (PALABRAS_ESPANOLAS.has(palabra)) espanol += 1;
    if (PALABRAS_INGLESAS.has(palabra)) ingles += 1;
    if (FINAL_ESPANOL.test(palabra)) espanol += 1;
    if (TROZO_INGLES.test(palabra)) ingles += 1;
  }

  return { espanol, ingles };
}

/**
 * El veredicto a partir del recuento.
 *
 * El caso mezclado existe de verdad: ««three words in nine pages», que pide otra
 * coma» es una opción española que cita inglés, y lo que se iba a leer en voz
 * alta es la frase entera. Por eso para hablar no basta con ir ganando: hace
 * falta cuatro a uno. Una frase española con tres palabras inglesas dentro
 * sigue siendo una frase española.
 *
 * Cuatro y no tres porque con tres esa frase sonaba. Probado el listón contra
 * las 5 534 opciones del temario, subirlo de tres a cuatro cambia exactamente
 * dos: esa, que pasa a callarse y debía, y un «a» suelto de un ejercicio de
 * artículos —«an / a / the / no hace falta nada»—, que se calla sin que se
 * pierda nada: «an» y «the» siguen sonando y una «a» átona suelta no enseña
 * ninguna pronunciación. De cinco en adelante ya no cambia nada.
 */
const VENTAJA = 4;

function veredicto({ espanol, ingles }: Marcas): Idioma {
  if (espanol === 0 && ingles === 0) return 'no-se';
  if (espanol === 0) return 'ingles';
  if (ingles === 0) return 'espanol';
  return ingles >= espanol * VENTAJA ? 'ingles' : 'espanol';
}

/** En qué idioma está este texto, mirándolo solo a él. */
export function idiomaDe(texto: string): Idioma {
  return veredicto(marcasDe(texto));
}

/**
 * El idioma de cada opción de un grupo, usando el grupo como contexto.
 *
 * Las opciones de un ejercicio van casi siempre en el mismo idioma, y eso
 * rescata a las que por sí solas no dicen nada. «box» no tiene ni una marca,
 * pero va con «boxes», «boxs» y «boxies»; «Nuevos» tampoco, pero va con
 * «Negros», «Viejos» y «Azules». Sumando el grupo, una sola opción con marca
 * decide por todas las mudas.
 *
 * Lo que NO se hace es imponer el veredicto del grupo a una opción que sí tiene
 * marcas propias, y esa diferencia tiene dueño: «am / is / are / no hace falta
 * nada» es un grupo mezclado de verdad. Las tres primeras suenan y la cuarta se
 * calla, que es exactamente lo que hay que hacer con ella.
 *
 * `contexto` es para los huecos: ahí lo que decide el idioma de «in / to / of»
 * no son las tres opciones —son palabras vacías de los dos idiomas— sino la
 * frase que vienen a completar, que es inglesa entera.
 */
export function idiomaDeCada(opciones: readonly string[], contexto?: string): Idioma[] {
  const marcas = opciones.map(marcasDe);
  const total = marcas.reduce(
    (suma, una) => ({ espanol: suma.espanol + una.espanol, ingles: suma.ingles + una.ingles }),
    contexto ? marcasDe(contexto) : { espanol: 0, ingles: 0 },
  );

  const delGrupo = veredicto(total);
  return marcas.map((una) => (una.espanol === 0 && una.ingles === 0 ? delGrupo : veredicto(una)));
}
