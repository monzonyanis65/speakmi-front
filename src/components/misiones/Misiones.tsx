import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useContador } from '@/lib/contador';
import { useMenosMovimiento } from '@/lib/movimiento';
import { Barra } from './Barra';
import { useMisiones } from './consulta';
import { Cofre } from './Cofre';
import { cuantoFalta, type DesafioDelMes, type Misiones, type MisionDiaria } from './tipos';

/**
 * Las misiones: los desafíos del día y el del mes.
 *
 * QUÉ ES ESTO Y POR QUÉ NO ES UN ADORNO
 *
 * Una misión no es una medalla. Una medalla cuenta lo que ya hiciste; una
 * misión es una razón para abrir la aplicación HOY. Y solo funciona si se ve
 * CUÁNTO FALTA en todo momento, que es lo único que este archivo tiene que
 * hacer bien: la barra, el número al lado y la cuenta atrás, siempre visibles,
 * y moviéndose en el momento en que se termina una lección y no al día
 * siguiente.
 *
 * LO QUE AQUÍ NO SE CALCULA, QUE ES TODO
 *
 * Ni el progreso, ni qué día es, ni cuánto paga cada misión. Todo llega hecho
 * del servidor, incluido el instante en el que se renuevan. Una misión que
 * contara en el navegador se hace trampa sola, y un número enseñado aquí que el
 * servidor no fuera a pagar es peor que no enseñar nada: en esta aplicación ya
 * hubo tres marcadores que no cuadraban con el final y se leen como un engaño.
 *
 * CÓMO SE PIDE
 *
 * Con una sola consulta compartida —la clave `['misiones']`— para que el panel
 * de la ruta y la pantalla entera no pidan lo mismo dos veces. Quien termine
 * una lección, una partida o un repaso invalida esa clave y la barra se mueve.
 */

/**
 * Cuánto falta para que se renueven, refrescado cada minuto.
 *
 * El minuto lo marca un temporizador del navegador, pero el FINAL lo puso el
 * servidor: aquí solo se resta. Así, alguien que le adelante el reloj al móvil
 * ve una cuenta atrás rara y nada más; las misiones que cobra siguen siendo las
 * de hoy, porque el día lo decide la base de datos.
 */
function useCuentaAtras(terminaEl: string | undefined): string {
  const [texto, setTexto] = useState(() => (terminaEl ? cuantoFalta(terminaEl) : ''));

  useEffect(() => {
    if (!terminaEl) return;
    setTexto(cuantoFalta(terminaEl));
    const reloj = setInterval(() => setTexto(cuantoFalta(terminaEl)), 60_000);
    return () => clearInterval(reloj);
  }, [terminaEl]);

  return texto;
}

/* -------------------------------------------------------------------------- */

/**
 * A dónde se va para cumplir cada misión.
 *
 * Esto vive en la pantalla y no en el servidor a propósito: son rutas del
 * navegador, y el servidor no tiene por qué saberse el mapa de la aplicación.
 * Lo que no esté en la lista cae en la ruta de lecciones, que es lo que hay que
 * hacer en la inmensa mayoría de los casos y nunca es una respuesta absurda.
 */
const DESTINO: Record<string, string> = {
  UNA_LECCION: '/ruta',
  TRES_LECCIONES: '/ruta',
  XP_DEL_DIA: '/ruta',
  LECCION_PERFECTA: '/ruta',
  REPASAR: '/repaso',
  UNA_PARTIDA: '/juegos',
};

/**
 * Una misión del día.
 *
 * LA TARJETA CUMPLIDA NO SE APAGA, SE ILUMINA
 *
 * Tacharla o bajarle el color es lo primero que sale y es un error: lo hecho es
 * el trofeo del día y el motivo por el que se vuelve a mirar el panel. Se pone
 * en verde, con el visto y con el «+15 XP» ganado.
 *
 * LA QUE FALTA SE PUEDE TOCAR; LA HECHA, NO
 *
 * Una misión pendiente es un enlace al sitio donde se cumple, porque una
 * pantalla que dice qué hacer y no deja ir a hacerlo obliga a volver atrás y
 * buscarlo en un menú. Y de paso es lo que hace que esta pantalla se pueda usar
 * entera con el teclado: sin esto, lo único que se alcanza con el tabulador es
 * el botón de volver.
 *
 * El enlace lleva su propio `aria-label` y eso NO es un adorno: sin él, el
 * nombre del enlace para un lector de pantalla sería la tarjeta entera leída de
 * corrido —título, barra, «1 de 3», «+15 XP»—, que es exactamente el ruido que
 * hace que la navegación por voz se vuelva inservible.
 *
 * `recienCumplida` solo es cierto la primera vez que el servidor la paga, y es
 * lo que decide si el número sube contando. En las siguientes visitas ya está
 * ahí puesto: celebrar cada recarga es dejar de celebrar nada.
 */
function TarjetaMision({
  mision,
  recienCumplida,
}: {
  mision: MisionDiaria;
  recienCumplida: boolean;
}) {
  const menosMovimiento = useMenosMovimiento();
  const celebra = recienCumplida && !menosMovimiento;
  const xpContando = useContador(celebra ? mision.xp : 0);

  /*
    CÓMO SE REPARTE LA TARJETA, QUE ES TODO DECISIONES DE 320 px.

    La primera versión ponía icono, título, barra y premio en una sola fila. En
    un móvil de 320 —y dentro del panel de la pantalla de inicio, que además
    tiene su propio relleno— al título le quedaban unos cien píxeles, así que
    salía «Termina 3 lecci…». Un desafío que no se puede leer no es un desafío.

    La segunda le dio al título toda la fila menos el premio, y entonces los
    títulos partían en dos líneas: la tarjeta crecía hasta 112 px y el panel
    entero hasta 698, con lo que el camino de lecciones empezaba fuera de la
    pantalla.

    La de ahora deja la fila de arriba entera para el título —que así cabe en
    una línea— y baja el premio a la fila de la barra, junto al «1/3». Los tres
    números del desafío quedan además juntos y se leen de una pasada: lo que
    llevas, lo que falta y lo que paga.
  */
  const dentro = (
    <>
      <span className="flex items-center gap-3">
        {/*
          La placa del icono, con degradado y no plana. Es lo mismo que hacen
          las tarjetas del escaparate de juegos en `aspecto.ts`: da volumen sin
          una sola imagen y hace que la tarjeta se reconozca antes de leerla.
        */}
        <span
          aria-hidden
          className={
            mision.cumplida
              ? 'flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-xl shadow-sm'
              : 'flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-marca-400 to-marca-600 text-xl shadow-sm'
          }
        >
          {mision.cumplida ? '✓' : mision.icono}
        </span>

        <span className="min-w-0 flex-1 text-sm font-bold">{mision.tituloEs}</span>
      </span>

      <span className="mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <Barra
            hecho={mision.hecho}
            objetivo={mision.objetivo}
            cumplida={mision.cumplida}
            etiqueta={mision.tituloEs}
          />
        </span>

        <span
          className={
            mision.cumplida
              ? 'shrink-0 text-sm font-bold text-[var(--texto-acierto)]'
              : 'shrink-0 text-sm font-bold text-[var(--texto-suave)]'
          }
        >
          {/*
            El «+15 XP» con el número subiendo cuando se acaba de ganar, y
            quieto el resto de las veces. Quien pidió menos movimiento lo ve
            puesto: la información es la misma, lo que se quita es el baile.
          */}
          {celebra ? `+${xpContando}` : `+${mision.xp}`} XP
        </span>
      </span>
    </>
  );

  if (mision.cumplida) {
    return (
      <li className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
        {dentro}
      </li>
    );
  }

  return (
    <li>
      <Link
        to={DESTINO[mision.codigo] ?? '/ruta'}
        aria-label={`${mision.tituloEs}. Llevas ${mision.hecho} de ${mision.objetivo}. Ir a hacerlo.`}
        className="boton-3d block rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-3 hover:border-marca-300 dark:hover:border-marca-700"
      >
        {dentro}
      </Link>
    </li>
  );
}

/**
 * El desafío del mes.
 *
 * Es más grande que las diarias a propósito: es otra cosa. Las diarias se
 * cumplen hoy; esta se cumple volviendo, y por eso lo que enseña, cumplido o
 * no, es cuántos días quedan.
 *
 * EN LA PANTALLA DE INICIO VA RECORTADO, Y NO POR CAPRICHO
 *
 * Medido en un móvil de 320×568: con la tarjeta entera el panel ocupaba 698 px,
 * o sea que el camino de lecciones empezaba fuera de la pantalla. Un panel que
 * tapa aquello para lo que se entra deja de ser una invitación y pasa a ser un
 * peaje. Así que ahí se queda el cofre, el título, la barra y los días —lo que
 * hace falta para decidir si ponerse— y el premio con su letra pequeña se lee
 * en la pantalla propia, que es donde se va cuando ya se ha decidido.
 */
function TarjetaDelMes({
  mes,
  recienCumplida,
  compacto,
}: {
  mes: DesafioDelMes;
  recienCumplida: boolean;
  compacto: boolean;
}) {
  const menosMovimiento = useMenosMovimiento();

  /*
    Los días que quedan van SIEMPRE, cumplido o no, porque es el dato que deja
    decidir si merece la pena ponerse hoy. Y en singular cuando toca: «1 días»
    es el detalle que hace que una aplicación parezca hecha a medias.
  */
  const dias = `${mes.diasQueQuedan} ${mes.diasQueQuedan === 1 ? 'día' : 'días'}`;

  return (
    <section
      className={
        mes.cumplida
          ? 'rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-amber-100 p-3 dark:border-amber-700 dark:from-amber-950/60 dark:to-amber-900/40'
          : 'rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-3'
      }
    >
      <div className="flex items-start gap-3">
        <Cofre abierto={mes.cumplida} tamano={compacto ? 40 : 56} />

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--texto-suave)]">
            Desafío del mes
          </p>
          <h3 className="mt-0.5 text-sm font-bold">{mes.tituloEs}</h3>
        </div>
      </div>

      <div className="mt-2">
        <Barra
          hecho={mes.hecho}
          objetivo={mes.objetivo}
          cumplida={mes.cumplida}
          etiqueta={mes.tituloEs}
        />
      </div>

      {compacto ? (
        <p className="mt-2 text-sm text-[var(--texto-suave)]">
          {mes.cumplida ? (
            <span className="font-bold text-[var(--texto-aviso)]">¡Cofre abierto!</span>
          ) : (
            <>
              Quedan <strong className="text-[var(--texto)]">{dias}</strong> de mes.
            </>
          )}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-[var(--texto-suave)]">
            {mes.cumplida ? (
              <span className="font-bold text-[var(--texto-aviso)]">
                {recienCumplida && !menosMovimiento ? '¡Cofre abierto! ' : 'Cofre abierto. '}
                Ganaste {mes.xp} XP y{' '}
                {mes.congelados === 1 ? 'un congelado' : `${mes.congelados} congelados`} de racha.
              </span>
            ) : (
              <>
                Premio: <strong className="text-[var(--texto)]">{mes.xp} XP</strong> y{' '}
                <strong className="text-[var(--texto)]">
                  {mes.congelados === 1 ? 'un congelado' : `${mes.congelados} congelados`} de racha
                </strong>
                , para el día que no puedas estudiar.
              </>
            )}
          </p>

          {!mes.cumplida && (
            <p className="mt-1 text-sm text-[var(--texto-suave)]">
              Quedan <strong className="text-[var(--texto)]">{dias}</strong> de mes.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * La lista entera: las tres del día, su cuenta atrás y el desafío del mes.
 *
 * `compacto` es lo que se pinta en la pantalla de inicio, al lado de la ruta:
 * lo mismo pero sin la explicación de abajo, porque allí el sitio se lo ha
 * ganado el camino de lecciones. La información es la misma; lo que cambia es
 * cuánto se cuenta.
 */
export function ListaDeMisiones({
  datos,
  compacto = false,
}: {
  datos: Misiones;
  compacto?: boolean;
}) {
  const falta = useCuentaAtras(datos.terminaEl);
  const cumplidas = datos.diarias.filter((m) => m.cumplida).length;
  const todas = cumplidas === datos.diarias.length && datos.diarias.length > 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">
          Desafíos de hoy{' '}
          <span className="font-normal text-[var(--texto-suave)]">
            {/*
              «1 de 3» y no «1/3». La barra de cada misión ya usa la forma con
              barra para su propia cuenta, y dos «1/3» distintos en la misma
              pantalla —uno de misiones y otro de lecciones— se confunden.

              Y sin la palabra «hechos» detrás: con ella, a 320 px la cabecera
              no cabía en una línea junto a la cuenta atrás y «hechos» se
              quedaba solo en la de abajo.
            */}
            {cumplidas} de {datos.diarias.length}
          </span>
        </h2>
        {/*
          La cuenta atrás. `aria-live` puesto en «off» a propósito: un lector de
          pantalla anunciando «quedan 6 h 41 min» cada minuto haría la pantalla
          inservible. Está ahí para leerlo cuando se quiera, no para que te lo
          griten.
        */}
        <p aria-live="off" className="shrink-0 text-xs font-medium text-[var(--texto-suave)]">
          ⏳ {falta}
        </p>
      </div>

      <ul className="mt-2 grid gap-2">
        {datos.diarias.map((mision) => (
          <TarjetaMision
            key={mision.codigo}
            mision={mision}
            recienCumplida={datos.recienCumplidas.includes(mision.codigo)}
          />
        ))}
      </ul>

      {todas && (
        <p className="mt-2 text-center text-sm font-bold text-[var(--texto-acierto)]">
          ¡Los tres de hoy, hechos!
        </p>
      )}

      {datos.mes && (
        <div className="mt-4">
          <TarjetaDelMes
            mes={datos.mes}
            recienCumplida={datos.recienCumplidas.includes('MES')}
            compacto={compacto}
          />
        </div>
      )}

      {!datos.mes && !compacto && (
        // Honestidad antes que relleno, igual que la liga cuando todavía no hay
        // gente: si el mes está tan avanzado que no da tiempo, se dice.
        <p className="mt-4 rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-4 text-sm text-[var(--texto-suave)]">
          El desafío del mes empieza el día uno. Queda muy poco de este para proponerte algo que dé
          tiempo a hacer.
        </p>
      )}

      {!compacto && (
        <p className="mt-4 text-sm text-[var(--texto-suave)]">
          Los desafíos del día se cambian a medianoche. Si hoy no te da tiempo no pasa nada:{' '}
          <strong className="text-[var(--texto)]">no se pierde nada por no cumplirlos</strong> y
          mañana hay otros tres.
        </p>
      )}
    </div>
  );
}

/**
 * El panel que vive en la pantalla de inicio.
 *
 * Enseña ya lo importante en vez de ser solo un enlace, porque una misión que
 * hay que ir a buscar a un menú no es una razón para volver: la gracia está en
 * verla al entrar y verla moverse al salir de una lección.
 *
 * El enlace a la pantalla entera va SUELTO abajo y no envolviendo el panel. Un
 * `<a>` alrededor de todo se lee bien con el ratón y fatal con un lector de
 * pantalla: el nombre del enlace pasaría a ser las tres misiones enteras con
 * sus barras y sus cuentas, de una tirada.
 */
export function PanelDeMisiones() {
  const { data, isError } = useMisiones();

  // Mientras carga no se pinta un hueco gris: se pinta nada. Un esqueleto
  // parpadeando al lado de la ruta cada vez que se entra molesta más de lo que
  // informa, y esta consulta tarda décimas.
  if (!data || data.diarias.length === 0) {
    if (!isError) return null;
    return (
      <p className="rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-4 text-sm text-[var(--texto-suave)]">
        No pudimos cargar tus desafíos. Se verán en cuanto vuelva la conexión.
      </p>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-4">
      <ListaDeMisiones datos={data} compacto />
      <Link
        to="/misiones"
        className="mt-3 block min-h-12 rounded-xl py-3.5 text-center text-sm font-bold text-marca-600 hover:bg-[var(--fondo)] dark:text-marca-300"
      >
        Ver todos los desafíos
      </Link>
    </section>
  );
}
