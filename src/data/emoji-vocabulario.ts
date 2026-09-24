/**
 * Un dibujo para cada palabra del curso.
 *
 * PARA QUÉ
 *
 * En PAREJAS las cartas están boca abajo y hay que acordarse de dónde estaba
 * cada cosa. Doce rectángulos con texto dentro son doce rectángulos: la memoria
 * no se agarra a ninguno. Un dibujo sí se recuerda, y por eso el emoji no es un
 * adorno aquí, es lo que hace jugable el juego.
 *
 * POR QUÉ EMOJI Y NO ILUSTRACIONES
 *
 * Pesan cero —ya están en el sistema—, escalan sin pixelarse, se ven igual de
 * bien en claro que en oscuro y no hay que dibujar ciento ochenta y seis veces.
 * La aplicación ya precarga 760 KB; meter un atlas de imágenes por una carta de
 * memorama sería pagar muy caro un dibujito.
 *
 * POR QUÉ FALTAN ALGUNAS, Y POR QUÉ ESO ESTÁ BIEN
 *
 * «across from» tiene flecha. «actually» no tiene nada, y cualquier cosa que le
 * pongas —una bombilla, una cara pensando— dice algo que la palabra no dice. Un
 * dibujo equivocado es peor que ningún dibujo: en una carta que se mira medio
 * segundo, el dibujo manda sobre el texto. Las palabras sin emoji se pintan con
 * la letra más grande, ocupando el sitio que habría tenido el dibujo, y se ven
 * como una decisión y no como un hueco.
 *
 * LA REGLA QUE MÁS SE NOTA
 *
 * Dos palabras que pueden caer en la misma ronda no pueden llevar emojis que se
 * confundan. Por eso «medicine» es 💊 y «drugstore» es 🏪, y no los dos una
 * pastilla: si dos cartas se ven igual, el memorama se vuelve tramposo.
 *
 * DÓNDE SE PINTA
 *
 * Solo en la carta inglesa. Si la carta española llevara el mismo dibujo, se
 * emparejaría mirando los monigotes sin leer una palabra, y el juego dejaría de
 * entrenar vocabulario para entrenar puntería.
 */

/**
 * Palabra inglesa → emoji.
 *
 * Las claves son el `lemma` tal cual viene del contenido del curso. La búsqueda
 * normaliza mayúsculas y espacios, así que aquí van en minúscula salvo los
 * gentilicios y los meses, que se escriben como se escriben.
 */
const EMOJI: Record<string, string> = {
  // Saludos y fórmulas de cortesía
  hello: '👋',
  'thank you': '🙏',
  'nice to meet you': '🤝',
  "i'm afraid": '😬',
  'would you mind': '🙇',

  // Personas, familia y oficios
  grandmother: '👵',
  relative: '👪',
  sibling: '👫',
  neighbor: '🚪',
  neighborhood: '🏘️',
  engineer: '👷',
  nurse: '👩‍⚕️',
  waiter: '🤵',
  band: '🎵',
  team: '⚽',
  name: '📛',
  'last name': '🪪',
  nationality: '🛂',
  venezuelan: '🇻🇪',
  'be born': '👶',
  'grow up': '🌱',
  retired: '🧓',
  teach: '👩‍🏫',
  'curly hair': '🦱',

  // Casa y objetos
  chair: '🪑',
  couch: '🛋️',
  closet: '🗄️',
  fridge: '🧊',
  key: '🔑',
  box: '📦',
  umbrella: '☂️',
  book: '📕',
  live: '🏠',
  move: '🚚',
  'move in': '📥',
  'stay home': '🏡',
  upstairs: '🪜',

  // Ropa
  clothes: '🧥',
  shirt: '👕',
  shoes: '👟',
  boots: '🥾',
  wear: '🧣',
  size: '📏',

  // Comida
  apple: '🍎',
  breakfast: '🍳',
  meal: '🍽️',
  dish: '🍲',
  juice: '🧃',
  seafood: '🦐',
  vegetables: '🥦',
  spicy: '🌶️',
  hungry: '😋',
  'the check': '🧾',
  try: '🎯',

  // Ciudad, sitios y direcciones
  city: '🏙️',
  downtown: '🌆',
  block: '🧱',
  corner: '📐',
  museum: '🏛️',
  drugstore: '🏪',
  traffic: '🚦',
  country: '🗺️',
  abroad: '🌍',
  view: '🌄',
  where: '📍',
  'next to': '➡️',
  'across from': '↔️',
  straight: '⬆️',

  // Salud
  headache: '🤕',
  'sore throat': '😷',
  throat: '🗣️',
  medicine: '💊',
  hurt: '🩹',
  rest: '😴',
  tired: '🥱',

  // Música, deporte y tiempo libre
  guitar: '🎸',
  drums: '🥁',
  sing: '🎤',
  sports: '🏃',
  swim: '🏊',
  swimming: '🌊',
  'work out': '🏋️',
  hobby: '🎨',
  'free time': '🏖️',
  party: '🎉',
  birthday: '🎂',
  'go dancing': '💃',
  'hang out': '☕',
  'have a good time': '😄',
  'have a great time': '🥳',
  'take a trip': '✈️',
  invite: '💌',
  plot: '🎬',

  // Trabajo, horas, fechas y dinero
  job: '💼',
  schedule: '🗓️',
  february: '📅',
  'next weekend': '⏭️',
  "o'clock": '🕐',
  'half past': '🕜',
  'in the morning': '🌅',
  'at night': '🌃',
  'last night': '🌙',
  ago: '⏳',
  twenty: '🔢',
  price: '🏷️',
  cheap: '🪙',
  expensive: '💰',
  bought: '🛍️',
  'the best': '🥇',
  'the worst': '👎',
  favorite: '⭐',
  prefer: '👍',
  recommend: '💡',

  // Teléfono y recados
  'call back': '📞',
  'hold on': '☎️',
  'leave a message': '📩',
  'take a message': '✍️',
  spell: '🔤',

  // Cómo son las cosas
  big: '🐘',
  tall: '🦒',
  black: '⬛',
  white: '⬜',
  quiet: '🤫',
  crowded: '👥',
  friendly: '😊',
  safe: '🛡️',
  disappointing: '😞',
  touching: '🥹',
  available: '🟢',
  'be free': '🆓',

  // Verbos y engranajes sueltos
  start: '▶️',
  finish: '🏁',
  'listen to': '👂',
  'look like': '🪞',
  'pick up': '🚕',
  should: '☝️',
  'be going to': '🔜',
  'do someone a favor': '🫶',
  twice: '✌️',
  than: '⚖️',
};

/**
 * El emoji de una palabra, o `null` si no tiene uno que no mienta.
 *
 * Devolver `null` es parte del trato: quien pinta la carta decide qué hacer con
 * el hueco, y lo que hace es dar el sitio a la letra. Ver `Parejas.tsx`.
 */
export function emojiDe(palabra: string): string | null {
  return EMOJI[palabra.trim().toLowerCase()] ?? null;
}

/** Cuántas palabras tienen dibujo. Lo usa la prueba que vigila la cobertura. */
export const PALABRAS_CON_EMOJI = Object.keys(EMOJI).length;
