import { cn } from '@/lib/cn';

/**
 * Una racha compartida con un amigo.
 *
 * LO QUE ESTA FILA NO DICE, QUE ES LA DECISIÓN ENTERA
 *
 * No dice quién faltó. No dice cuánto queda para que se rompa. No dice que se
 * haya roto. No hay reloj, no hay «en peligro», no hay «salva tu racha» y no
 * hay ningún camino desde aquí a escribirle a nadie.
 *
 * Dos personas que se sienten obligadas a practicar para no romperle la racha
 * al otro acaban dejando la aplicación las dos, porque dejar de mirar es la
 * única forma de dejar de deber. Y el servidor está construido para que esto no
 * se pueda escribir aunque alguien quiera: no guarda la racha compartida en
 * ninguna tabla, así que no existe el instante en que pasa de viva a rota y no
 * hay a qué colgarle un aviso.
 *
 * CÓMO SE ACABA, ENTONCES
 *
 * El número deja de estar y en su sitio queda el récord: «lo mejor, 14 días».
 * Una racha que al terminarse deja un recuerdo es una historia; una que deja un
 * cero es una regañina.
 *
 * LA CARA
 *
 * Es la inicial del nombre en un círculo de color, y no una mascota. Las
 * mascotas —Milo y las otras cuatro— son de quien las lleva puestas, y el
 * servidor no manda cuál tiene cada amigo: ponerle Milo a todo el mundo diría
 * algo que no es verdad. El color sale de las letras del nombre, así que la
 * misma persona tiene siempre el mismo y se reconoce en la lista sin leer.
 */

/**
 * Seis tonos para las caras.
 *
 * Que sean pocos es a propósito: con veinte, dos amigos seguidos tendrían tonos
 * casi iguales y el color dejaría de servir para reconocer a nadie. Con seis se
 * repiten, pero cuando se repiten se nota que son dos y no uno.
 */
const CARAS = [
  'bg-marca-600',
  'bg-sky-600',
  'bg-teal-600',
  'bg-violet-600',
  'bg-orange-600',
  'bg-rose-600',
];

function tonoDe(nombre: string): string {
  let suma = 0;
  for (const letra of nombre) suma += letra.codePointAt(0) ?? 0;
  return CARAS[suma % CARAS.length]!;
}

export interface PropsRacha {
  displayName: string;
  /** Días en los que los dos practicasteis, en la cadena viva. */
  dias: number;
  /** La cadena más larga de la ventana que mira el servidor. */
  mejor: number;
  /** Si la cadena llega al mínimo para que enseñar un número signifique algo. */
  viva: boolean;
}

export function RachaConAmigo({ displayName, dias, mejor, viva }: PropsRacha) {
  const inicial = [...displayName.trim()][0]?.toUpperCase() ?? '?';

  /*
    Tres estados y ni uno más. Hay racha, hubo racha, o todavía no ha habido
    ninguna. Ninguno de los tres es un reproche: el tercero es una invitación,
    porque para empezar una hace falta que practiquen los dos, y eso se dice.
  */
  const detalle = viva
    ? `${dias} ${dias === 1 ? 'día' : 'días'} practicando los dos`
    : mejor > 0
      ? `Lo mejor que llevasteis: ${mejor} ${mejor === 1 ? 'día' : 'días'}`
      : 'Cuando practiquéis el mismo día empieza a contar';

  return (
    <li className="flex items-center gap-3 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-3">
      <span
        aria-hidden
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full text-base font-extrabold text-white',
          tonoDe(displayName),
        )}
      >
        {inicial}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{displayName}</span>
        <span className="block truncate text-xs text-[var(--texto-suave)]">{detalle}</span>
      </span>

      {/*
        El número solo aparece cuando hay racha. Un «0» al lado de una cara se
        lee como un reproche, y un «1» no es una racha: es haber coincidido.
      */}
      {viva && (
        <span
          className="flex shrink-0 items-center gap-1 rounded-xl bg-orange-50 px-2 py-1 font-extrabold tabular-nums text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
          aria-label={`${dias} ${dias === 1 ? 'día' : 'días'} de racha con ${displayName}`}
        >
          <Llama />
          <span aria-hidden>{dias}</span>
        </span>
      )}
    </li>
  );
}

/** La misma llama de las insignias, pequeña. Va decorativa: el número la nombra. */
function Llama() {
  return (
    <svg viewBox="0 0 100 100" className="size-4" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M50 12c14 16 23 26 23 41a23 23 0 0 1-46 0c0-9 5-16 11-23 2 7 5 11 9 12 2-11 2-21 3-30z"
      />
    </svg>
  );
}
