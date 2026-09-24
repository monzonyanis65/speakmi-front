import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { Confeti } from '@/components/Confeti';
import { Mascota } from '@/components/Mascota';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { Aviso } from './Tablero';
import { LluviaDeMonedas } from './efectos';
import type { FichaDeJuego, Marcador, ResultadoFinal } from './tipos';

/**
 * El final de la partida.
 *
 * Es la pantalla que decide si se juega otra. Todo lo de antes puede estar bien
 * y, si aquí solo pone «has terminado», nadie vuelve. Por eso el orden es este y
 * no otro: primero la cara de la mascota, que se lee sin leer; luego la cifra,
 * sola y enorme; después el récord, si lo hubo; y solo al final el detalle.
 *
 * El botón grande es OTRA PARTIDA, no «volver». Quien acaba de terminar está
 * justo en el momento de querer repetir, y hay que ponérselo delante.
 */
export function FinDeJuego({
  ficha,
  marcador,
  resultado,
  guardando,
  noSeGuardo,
  onOtra,
  onSalir,
}: {
  ficha: FichaDeJuego;
  marcador: Marcador;
  /** Lo que contestó el servidor. Sin él se enseña la puntuación local igual. */
  resultado: ResultadoFinal | null;
  guardando: boolean;
  noSeGuardo: boolean;
  onOtra: () => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();

  const puntuacion = resultado?.puntuacion ?? marcador.puntuacion;
  const record = resultado?.recordNuevo ?? false;
  const monedas = resultado?.monedas ?? 0;
  const acierto = marcador.total > 0 ? marcador.aciertos / marcador.total : 0;

  const estado = record ? 'orgulloso' : acierto >= 0.6 ? 'celebrando' : 'animando';

  /*
    La música del final, una sola vez y cuando ya se sabe qué tocar.

    Se espera a que el servidor conteste: la fanfarria del récord y el «se
    acabó» son sonidos distintos, y sonar el segundo para luego enterarse de que
    era récord estropea justo el momento que había que celebrar. Las monedas
    entran después, cuando las de la pantalla ya están cayendo.
  */
  const sonado = useRef(false);
  useEffect(() => {
    if (sonado.current || guardando) return;
    sonado.current = true;

    sonar(record ? 'record' : 'fin');
    if (monedas <= 0) return;

    const reloj = setTimeout(() => sonar('moneda'), record ? 800 : 450);
    return () => clearTimeout(reloj);
  }, [guardando, record, monedas]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8 text-center">
      {/* Las monedas que de verdad ganaste, ni una más. Y confeti solo si hay récord. */}
      {monedas > 0 && <LluviaDeMonedas cantidad={monedas} />}
      {record && !menosMovimiento && <Confeti cantidad={24} />}
      <div className={cn('flex justify-center', !menosMovimiento && 'animate-revelar')}>
        <Mascota estado={estado} tamano={130} />
      </div>

      <p className="mt-4 text-sm text-[var(--texto-suave)]">
        {ficha.icono} {ficha.titulo}
      </p>

      <h1 className="mt-1 text-2xl font-extrabold">
        {record ? '¡Récord nuevo!' : acierto >= 0.6 ? '¡Buena partida!' : 'Se acabó'}
      </h1>

      {/* La cifra, sola. Es lo único que se recuerda al día siguiente. */}
      <Cifra valor={puntuacion} />
      <p className="text-xs uppercase tracking-widest text-[var(--texto-suave)]">puntos</p>

      {record && (
        <p
          className={cn(
            'mx-auto mt-4 inline-flex min-h-9 items-center gap-2 rounded-full bg-acento-600 px-4 text-sm font-extrabold text-white',
            !menosMovimiento && 'animate-crecer',
          )}
        >
          <span aria-hidden>🏆</span> Nunca habías llegado tan lejos
        </p>
      )}

      <dl className="mt-8 grid grid-cols-3 gap-2 text-center">
        <Dato
          etiqueta="Aciertos"
          valor={
            marcador.total > 0 ? `${marcador.aciertos}/${marcador.total}` : `${marcador.aciertos}`
          }
        />
        <Dato
          etiqueta="Monedas"
          valor={resultado ? `+${resultado.monedas}` : '—'}
          tono={resultado && resultado.monedas > 0 ? 'acento' : 'normal'}
        />
        <Dato etiqueta="Tu mejor" valor={resultado ? resultado.mejorPuntuacion : '—'} />
      </dl>

      {guardando && (
        <p role="status" className="mt-4 text-sm text-[var(--texto-suave)]">
          Guardando la partida…
        </p>
      )}

      {noSeGuardo && (
        <div className="mt-4 text-left">
          <Aviso tono="aviso">
            No pudimos guardar esta partida, así que no suma monedas ni récord. La puntuación de
            arriba es la de esta ronda. Inténtalo otra vez en un rato.
          </Aviso>
        </div>
      )}

      <div className="mt-8 grid gap-3">
        <Boton tamano="grande" onClick={onOtra}>
          OTRA PARTIDA
        </Boton>
        <Boton tono="suave" onClick={onSalir}>
          Volver a los juegos
        </Boton>
      </div>
    </div>
  );
}

/**
 * La puntuación subiendo hasta su valor.
 *
 * Medio segundo, no más: lo suficiente para que la cifra se sienta ganada y no
 * tanto como para tener que esperarla. Quien pidió menos movimiento la ve puesta
 * desde el primer fotograma, que es exactamente el mismo dato.
 */
function Cifra({ valor }: { valor: number }) {
  const menosMovimiento = useMenosMovimiento();
  const [visible, setVisible] = useState(menosMovimiento ? valor : 0);

  useEffect(() => {
    if (menosMovimiento) {
      setVisible(valor);
      return;
    }

    const duracion = 600;
    const inicio = performance.now();
    let cuadro = 0;

    const paso = (ahora: number) => {
      const avance = Math.min(1, (ahora - inicio) / duracion);
      // Frena al final, que es lo que hace que parezca que se posa.
      setVisible(Math.round(valor * (1 - Math.pow(1 - avance, 3))));
      if (avance < 1) cuadro = requestAnimationFrame(paso);
    };

    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, menosMovimiento]);

  return (
    <p className="mt-6 text-6xl font-extrabold tabular-nums leading-none text-marca-600 dark:text-marca-300">
      {visible}
    </p>
  );
}

function Dato({
  etiqueta,
  valor,
  tono = 'normal',
}: {
  etiqueta: string;
  valor: string | number;
  tono?: 'normal' | 'acento';
}) {
  return (
    <div className="rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] px-2 py-3">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--texto-suave)]">{etiqueta}</dt>
      <dd
        className={cn(
          'mt-1 text-lg font-extrabold tabular-nums',
          tono === 'acento' && 'text-[var(--texto-aviso)]',
        )}
      >
        {valor}
      </dd>
    </div>
  );
}
