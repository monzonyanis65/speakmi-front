import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Bocadillo, Estrella, Libro, Llama, Moneda, Repasar, Telefono } from '@/components/iconos';
import { useNombreMascota } from '@/lib/mascota-contexto';
import { avisarAhora, marcarAvisado, tocaAvisar } from '@/lib/recordatorio';

/** Solo lo que pintan estas dos tiras. El resto de `/progress` lo lee quien lo use. */
interface Progreso {
  xpTotal: number;
  leccionesCompletadas: number;
  racha: { currentDays: number; longestDays: number; freezesAvailable: number };
  repasosPendientes: number;
}

/**
 * LO QUE HAY EN ESTE ARCHIVO Y POR QUÉ SON DOS TIRAS Y NO UN PANEL
 *
 * Esto era un panel: una pila de tarjetas del mismo tamaño encima del camino de
 * lecciones —repaso, llamada, conversación, cuatro casillas de cifras, en qué
 * fallas— que sumaba más de media pantalla. Medido en un móvil de 320×568, el
 * primer nodo del camino caía por debajo de los 800 px: pantalla y media de
 * scroll para llegar a lo único por lo que se abre la aplicación.
 *
 * El fallo no era ninguna de esas tarjetas por separado; era que TODAS pesaban
 * lo mismo. Cuando todo es una tarjeta grande, nada es lo principal.
 *
 * Así que ahora son dos tiras finas y el camino es lo demás:
 *
 *   `CifrasDeHoy`   — racha, XP, monedas y lecciones en la cabecera, ~44 px.
 *   `AccionesDeHoy` — repasar, llamar y escribir en una fila de tres, ~60 px.
 *
 * Lo que se fue: los subtítulos de cada acción (se leen una vez y estorban
 * todos los días) y el bloque de «en lo que más fallas», que vive ahora en el
 * perfil, que es la pantalla de mirarse las tripas.
 */

/**
 * La consulta del progreso, compartida por las dos tiras.
 *
 * Misma clave que el perfil: entrar aquí no vuelve a pedir lo mismo. Y siempre
 * fresca al volver a esta pantalla, porque si acabas de fallar algo en una
 * lección la chapa de repasos tiene que subir al instante y no en 30 segundos.
 */
function useProgreso() {
  return useQuery({
    queryKey: ['progreso'],
    queryFn: () => api.get<Progreso>('/progress'),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Las cuatro cifras, en una tira de cabecera.
 *
 * Eran cuatro casillas de 72 px de alto para cuatro números de cuatro cifras.
 * Un número no necesita una tarjeta: necesita un icono al lado y sitio para
 * leerse. Aquí caben los cuatro en la misma fila del botón de menú, que es lo
 * que hace Duolingo y por lo mismo.
 *
 * Tampoco cuentan hacia arriba ya. Un contador animado es un premio, y un
 * premio que se cobra cada vez que abres la aplicación deja de serlo; donde sí
 * se gana —al acabar una lección, al cumplir un desafío— ahí sigue contando.
 */
export function CifrasDeHoy() {
  const navegar = useNavigate();
  const { data } = useProgreso();

  /*
    El recordatorio diario, cuando toca.

    Va aquí y no en un sitio más general porque esta tira solo se pinta en la
    ruta, que es la pantalla de inicio: es donde se llega al abrir la
    aplicación, y avisar en cualquier otra sería avisar a mitad de una lección.
  */
  useEffect(() => {
    let hora = '19:00';
    try {
      hora = localStorage.getItem('speakmi.recordatorio.hora') ?? hora;
    } catch {
      // Sin memoria se usa la hora por defecto.
    }
    if (!tocaAvisar(hora)) return;
    if (avisarAhora('Un rato de inglés y sigues la racha.')) marcarAvisado();
  }, []);

  // La cartera va aparte del progreso: son dos cosas distintas y si una falla la
  // otra se sigue viendo.
  const { data: cartera } = useQuery({
    queryKey: ['cartera'],
    queryFn: () => api.get<{ coins: number }>('/me/wallet'),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const dias = data?.racha.currentDays ?? 0;
  const congelados = data?.racha.freezesAvailable ?? 0;

  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-0.5">
      <Cifra
        icono={<Llama tamano={18} />}
        /*
          La llama se enciende cuando hay racha y se apaga cuando no.

          Es el único color de la tira que significa algo en vez de adornar: una
          llama naranja al lado de un cero se lee como que algo va bien, y no va
          bien. Apagada no es un reproche, es que todavía no está encendida.
        */
        color={dias > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--texto-suave)]'}
        valor={dias}
        // Los congelados eran un renglón propio debajo del panel. Son un detalle
        // de la racha, así que se cuentan contando la racha y no ocupan fila.
        etiqueta={
          (dias === 1 ? 'día de racha' : 'días de racha') +
          (congelados > 0
            ? `, con ${congelados === 1 ? 'un congelado' : `${congelados} congelados`} para salvarla`
            : '')
        }
      />
      <Cifra
        icono={<Estrella tamano={18} />}
        color="text-marca-600 dark:text-marca-400"
        valor={data?.xpTotal ?? 0}
        etiqueta="de experiencia"
      />
      {/* Las monedas llevan a la tienda: verlas y no poder gastarlas frustra. */}
      <Cifra
        icono={<Moneda tamano={18} />}
        color="text-amber-600 dark:text-amber-400"
        valor={cartera?.coins ?? 0}
        etiqueta="monedas"
        onClick={() => navegar('/tienda')}
      />
      <Cifra
        icono={<Libro tamano={18} />}
        color="text-emerald-600 dark:text-emerald-400"
        valor={data?.leccionesCompletadas ?? 0}
        etiqueta="lecciones hechas"
      />
    </div>
  );
}

/**
 * Cinco cifras no caben en 320 px.
 *
 * A partir de diez mil se abrevia, porque el XP es el número que crece sin
 * techo y es el que rompía la fila: con «124500» puesto entero, las cuatro
 * cifras se montaban unas encima de otras. Quien escucha la pantalla oye
 * siempre el número exacto, que va en la etiqueta y no en lo que se ve.
 */
function corto(valor: number): string {
  if (valor < 10_000) return String(valor);
  return `${Math.round(valor / 1000)} k`;
}

/**
 * Una cifra de la tira.
 *
 * Con `onClick` se pinta como botón de verdad, no como un elemento que escucha
 * toques: así se llega con el teclado y el lector de pantalla lo anuncia. Sin
 * él, el número y el icono se esconden del lector y se dice la frase entera una
 * sola vez, que es lo que evita oír «fuego 4» como si fuera un dato.
 */
function Cifra({
  icono,
  valor,
  etiqueta,
  color,
  onClick,
}: {
  icono: ReactNode;
  valor: number;
  etiqueta: string;
  /**
   * El tono del icono. Solo del icono.
   *
   * El número se queda del color del texto a propósito: cuatro cifras de cuatro
   * colores distintos es una fila de confeti donde no se lee ninguna. Con el
   * color solo en el dibujo, cada cosa se distingue de un vistazo y los números
   * siguen siendo lo que más contrasta, que es lo que se viene a mirar.
   *
   * Y va aquí y no dentro del icono porque todo el juego está dibujado con
   * `currentColor` justamente para esto: el tono lo pone quien lo usa, y así los
   * mismos dibujos valen en claro y en oscuro sin hacerlos dos veces.
   */
  color?: string;
  onClick?: () => void;
}) {
  const visible = (
    <>
      <span className={color}>{icono}</span>
      <span aria-hidden className="truncate text-sm font-extrabold tabular-nums">
        {corto(valor)}
      </span>
    </>
  );

  /*
    Cada cifra ocupa lo que mide, no un cuarto de la fila.

    Con `flex-1` las cuatro salían iguales y la del XP —que es la única que
    crece sin parar— se cortaba en «12…» teniendo sitio de sobra al lado: la
    racha gasta un dígito y se quedaba con el mismo hueco que un número de
    cuatro. `min-w-0` con `truncate` deja además que se encojan en vez de
    desbordar el día que las cuatro vengan largas a la vez.
  */
  const reparto = 'flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-0.5';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${valor} ${etiqueta}`}
        className={reparto}
      >
        {visible}
      </button>
    );
  }

  return (
    <span className={reparto}>
      {visible}
      <span className="sr-only">{`${valor} ${etiqueta}`}</span>
    </span>
  );
}

/**
 * Lo que se puede hacer hoy aparte de la lección, en una sola fila.
 *
 * ORDEN: LLAMAR ANTES QUE ESCRIBIR, Y ESO NO SE TOCA
 *
 * Hablar es lo que cuesta y lo que se evita; ponerlo delante es la única forma
 * de que se haga. Quien no pueda hablar ahora tiene la otra justo al lado.
 *
 * El repaso va el primero de los tres porque es lo único de la fila que caduca:
 * son cosas que ya fallaste y que vuelven hoy. Pero va en el mismo tamaño que
 * las otras dos y sin color de alarma; lo urgente lo dice la chapa del número.
 */
export function AccionesDeHoy() {
  const navegar = useNavigate();
  const nombre = useNombreMascota();
  const { data } = useProgreso();
  const pendientes = data?.repasosPendientes ?? 0;

  return (
    <div className="grid grid-cols-3 gap-2">
      <Accion
        icono={<Repasar tamano={24} />}
        titulo="Repasar"
        aviso={pendientes}
        etiqueta={
          pendientes > 0
            ? `Repasar. Tienes ${pendientes} ${pendientes === 1 ? 'repaso pendiente' : 'repasos pendientes'}: cosas que fallaste y toca volver a ver`
            : 'Repasar lo que fallaste. Ahora mismo no tienes nada pendiente'
        }
        onClick={() => navegar('/repaso')}
      />
      <Accion
        icono={<Telefono tamano={24} />}
        titulo="Llamar"
        principal
        etiqueta={`Llamar a ${nombre}. Una conversación hablada, en inglés. Te corrige al colgar`}
        onClick={() => navegar('/llamada')}
      />
      <Accion
        icono={<Bocadillo tamano={24} />}
        titulo="Escribir"
        etiqueta="Conversar escribiendo, si ahora no puedes hablar en voz alta"
        onClick={() => navegar('/conversar')}
      />
    </div>
  );
}

/**
 * Una de las tres acciones.
 *
 * El subtítulo que antes se leía debajo del título ahora vive en la etiqueta:
 * no se ha perdido, se ha dejado de repetir. Quien lo necesita —la primera vez,
 * o quien escucha la pantalla— lo sigue teniendo; quien ya sabe qué es llamar
 * no tiene que saltárselo cada día.
 *
 * `aviso` es la chapa con el número. Un punto sobre un icono dice lo mismo que
 * una tarjeta ámbar a todo lo ancho, no ocupa una fila y, sobre todo, no se
 * mueve: lo que late en bucle deja de leerse como información y pasa a leerse
 * como una notificación gritando.
 */
function Accion({
  icono,
  titulo,
  etiqueta,
  aviso = 0,
  principal = false,
  onClick,
}: {
  icono: ReactNode;
  titulo: string;
  etiqueta: string;
  aviso?: number;
  principal?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className={cn(
        'boton-3d flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2',
        principal
          ? 'border-marca-800 bg-marca-600 text-white hover:bg-marca-500'
          : 'border-2 border-[var(--borde)] bg-[var(--superficie)]',
      )}
    >
      {/*
        `inline-flex` y no un `span` suelto: un SVG es texto en línea, así que
        la caja que lo envuelve se lleva además el hueco del renglón —el sitio
        de las colas de la «p»— y crece tres o cuatro píxeles por abajo. La
        chapa se coloca contra esa caja, y con el hueco de más se le descolgaba
        del icono. En línea-flexible la caja mide exactamente el dibujo.
      */}
      <span className="relative inline-flex">
        {icono}
        {aviso > 0 && (
          /*
            El número va sobre el icono y a la vez dentro de la etiqueta del
            botón. Aquí se esconde del lector para que no lo oiga dos veces, pero
            SÍ se pinta: sin él, quien no oye la pantalla no tendría la cuenta.
          */
          <span
            aria-hidden
            className="absolute -right-3 -top-1.5 min-w-5 rounded-full bg-[var(--color-fallo)] px-1 text-center text-[11px] font-extrabold leading-5 text-white"
          >
            {aviso > 9 ? '9+' : aviso}
          </span>
        )}
      </span>
      <span aria-hidden className="truncate text-xs font-bold">
        {titulo}
      </span>
    </button>
  );
}
