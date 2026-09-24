import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { Mascota, MascotaConMensaje } from '@/components/Mascota';
import { decir, hayVoz, hayVozInglesa, vozInglesaYa } from '@/lib/voz';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { Aviso, CabeceraJuego, Contador, Racha } from './Tablero';
import { Destello, PuntosGanados } from './efectos';
import { loQueSumaElSiguiente, puntosDelServidor } from './puntos';
import type { Marcador, RespuestaCorregida, RondaDeEscucha } from './tipos';

/**
 * Escucha: suena una palabra y hay que decir cuál era.
 *
 * Entrena el oído, que es lo último que llega y lo único que no se puede releer.
 * En una conversación no hay subtítulos: o la reconoces al vuelo o la frase se
 * te va entera.
 *
 *
 * ESTE JUEGO PUEDE NO PODER JUGARSE, Y HAY QUE DECIRLO ANTES
 *
 * Sin voces inglesas instaladas no hay juego: el navegador leería el inglés con
 * la voz que tenga —aquí, española— y enseñaría una pronunciación que no existe.
 * `decir()` ya se niega a hacerlo, así que el resultado sería silencio y cuatro
 * botones sin pistas. Eso ya nos mordió en los dictados de la prueba de nivel,
 * donde la gente se quedaba encerrada sin poder seguir. Aquí se comprueba ANTES
 * de empezar, se explica, y se sale con un toque.
 */

export function Escucha({
  ronda,
  onResponder,
  onFin,
  onSalir,
  onAjustes,
}: {
  ronda: RondaDeEscucha;
  onResponder: (rondaId: string, answer: string) => Promise<RespuestaCorregida>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
  onAjustes: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  useDespertarSonido();

  const [voz, setVoz] = useState<'comprobando' | 'si' | 'no'>(() => {
    const ya = vozInglesaYa();
    return ya === 'todavia-no-se' ? 'comprobando' : ya;
  });

  const [indice, setIndice] = useState(0);
  const [elegida, setElegida] = useState<string | null>(null);
  const [acertada, setAcertada] = useState<boolean | null>(null);
  const [sonando, setSonando] = useState(false);

  const [aciertos, setAciertos] = useState(0);
  const [contestadas, setContestadas] = useState(0);
  const [racha, setRacha] = useState(0);

  // La misma cuenta que hará el servidor al cerrar: diez por acierto. Así el
  // número que sube durante la partida es el que sale al final, sin sorpresas.
  const puntuacion = puntosDelServidor('ESCUCHA', aciertos);
  const actual = ronda.rondas[indice];

  const marcador = useRef<Marcador>({ puntuacion: 0, aciertos: 0, total: 0 });
  marcador.current = { puntuacion, aciertos, total: contestadas };

  const terminado = useRef(false);
  const terminar = useCallback(() => {
    if (terminado.current) return;
    terminado.current = true;
    onFin(marcador.current);
  }, [onFin]);

  useEffect(() => {
    if (voz !== 'comprobando') return;
    let vivo = true;
    void hayVozInglesa().then((hay) => {
      if (vivo) setVoz(hay ? 'si' : 'no');
    });
    return () => {
      vivo = false;
    };
  }, [voz]);

  const reproducir = useCallback(async (texto: string) => {
    setSonando(true);
    try {
      // Un poco más lento que en las lecciones: aquí la palabra va sola, sin
      // frase alrededor que ayude a colocarla.
      await decir(texto, { velocidad: 0.85 });
    } finally {
      setSonando(false);
    }
  }, []);

  // Suena sola al entrar en cada ronda. Obligar a pulsar «escuchar» antes de
  // cada palabra son dos toques por pregunta y rompe el ritmo.
  useEffect(() => {
    if (voz !== 'si' || !actual) return;
    void reproducir(actual.diceEn);
  }, [voz, actual, reproducir]);

  // Al salir, que no siga hablando por encima de la siguiente pantalla.
  useEffect(() => {
    return () => {
      if (hayVoz()) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (voz === 'si' && !actual) terminar();
  }, [voz, actual, terminar]);

  async function responder(opcion: string) {
    if (!actual || elegida !== null) return;
    setElegida(opcion);

    /*
      La verdad está en el navegador: `diceEn` ES la palabra que sonó. Se
      pregunta igualmente al servidor, porque es él quien lleva la cuenta, pero
      si no contesta no se pierde la ronda ni se inventa nada: se compara con lo
      que ya se sabe, que da exactamente el mismo resultado.
    */
    const local = opcion.trim().toLowerCase() === actual.diceEn.trim().toLowerCase();
    let correcta = local;

    try {
      const corregida = await onResponder(actual.id, opcion);
      correcta = corregida.isCorrect;
    } catch {
      correcta = local;
    }

    const nuevaRacha = correcta ? racha + 1 : 0;
    setAcertada(correcta);
    setContestadas((n) => n + 1);
    setRacha(nuevaRacha);
    if (correcta) setAciertos((n) => n + 1);

    if (!correcta) sonar('fallo');
    else if (nuevaRacha >= 2) sonar('combo', { racha: nuevaRacha });
    else sonar('acierto');
  }

  function avanzar() {
    setElegida(null);
    setAcertada(null);
    setIndice((n) => n + 1);
  }

  if (voz === 'comprobando') {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-[var(--texto-suave)]">Buscando una voz en inglés…</p>
      </div>
    );
  }

  if (voz === 'no') {
    return <SinVoz onSalir={onSalir} onAjustes={onAjustes} />;
  }

  if (!actual) return null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-4">
      <CabeceraJuego onSalir={onSalir}>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold leading-none tabular-nums">
            {indice + 1}
            <span className="text-base font-bold text-[var(--texto-suave)]">
              /{ronda.rondas.length}
            </span>
          </p>
          <p className="text-xs text-[var(--texto-suave)]">palabras</p>
        </div>
        {/* Los puntos, con la fórmula del servidor: diez por acierto. Ver
            `puntos.ts`, que explica por qué se calculan aquí también. */}
        <Contador
          etiqueta="Puntos"
          valor={puntuacion}
          tono={aciertos > 0 ? 'acierto' : 'normal'}
          vivo
        >
          {acertada && (
            <PuntosGanados
              key={contestadas}
              puntos={loQueSumaElSiguiente('ESCUCHA', aciertos - 1)}
            />
          )}
        </Contador>
      </CabeceraJuego>

      {acertada !== null && <Destello key={contestadas} senal={acertada ? 'acierto' : 'fallo'} />}

      <div className="mt-3 min-h-8">
        <Racha racha={racha} />
      </div>

      {/* El botón de oír es lo más grande de la pantalla, porque es el enunciado. */}
      <div className="mt-6 flex flex-col items-center">
        <button
          type="button"
          onClick={() => void reproducir(actual.diceEn)}
          disabled={sonando}
          aria-label="Escuchar la palabra otra vez"
          className={cn(
            'boton-3d flex size-28 items-center justify-center rounded-full border-2 border-marca-900 bg-marca-700 text-5xl text-white',
            sonando && !menosMovimiento && 'animate-latido',
          )}
        >
          <span aria-hidden>{sonando ? '🔊' : '▶'}</span>
        </button>
        <p className="mt-3 text-sm text-[var(--texto-suave)]">
          {sonando ? 'Sonando…' : 'Tócalo para oírla otra vez'}
        </p>
      </div>

      <div className="mt-8 grid flex-1 content-start gap-3">
        {actual.opciones.map((opcion) => {
          const esLaSuya = elegida === opcion;
          const esLaBuena = elegida !== null && opcion === actual.diceEn;

          return (
            <button
              key={opcion}
              type="button"
              lang="en"
              disabled={elegida !== null}
              onClick={() => void responder(opcion)}
              className={cn(
                'min-h-14 rounded-2xl border-2 px-4 py-3 text-center text-lg font-semibold transition',
                elegida === null &&
                  'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400',
                esLaBuena &&
                  'border-emerald-600 bg-emerald-50 text-[var(--texto-acierto)] dark:bg-emerald-950/40',
                elegida !== null &&
                  esLaSuya &&
                  !esLaBuena &&
                  'border-red-500 bg-red-50 text-[var(--texto-fallo)] dark:bg-red-950/40',
                elegida !== null && !esLaSuya && !esLaBuena && 'border-[var(--borde)] opacity-50',
              )}
            >
              {esLaBuena && <span aria-label="Correcta">✓ </span>}
              {elegida !== null && esLaSuya && !esLaBuena && (
                <span aria-label="Tu respuesta">✕ </span>
              )}
              {opcion}
            </button>
          );
        })}
      </div>

      {acertada !== null && (
        <div
          role="status"
          className={cn(
            'mt-4 flex items-center gap-3 rounded-2xl p-3',
            acertada ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30',
          )}
        >
          <Mascota
            estado={acertada ? (racha >= 5 ? 'orgulloso' : 'celebrando') : 'animando'}
            tamano={44}
          />
          <p
            className={cn(
              'font-extrabold',
              acertada ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-fallo)]',
            )}
          >
            {acertada
              ? racha >= 2
                ? `¡Esa era! ${racha} seguidas`
                : '¡Esa era!'
              : `Sonaba «${actual.diceEn}»`}
          </p>
        </div>
      )}

      <div className="mt-4">
        {acertada !== null ? (
          <Boton tamano="grande" tono={acertada ? 'acierto' : 'marca'} autoFocus onClick={avanzar}>
            {indice + 1 < ronda.rondas.length ? 'SIGUIENTE' : 'VER RESULTADO'}
          </Boton>
        ) : (
          /*
            La salida de emergencia dentro del juego.

            La voz puede desaparecer a media partida —el navegador la descarga,
            el sistema la cambia— y entonces quedan cuatro botones y silencio.
            Saltar no cuenta ni a favor ni en contra: no se midió nada.
          */
          <button
            type="button"
            onClick={avanzar}
            className="min-h-11 w-full rounded-xl px-4 text-sm text-[var(--texto-suave)] underline underline-offset-4 hover:text-[var(--texto)]"
          >
            No la oigo, saltar esta
          </button>
        )}
      </div>
    </div>
  );
}

function SinVoz({ onSalir, onAjustes }: { onSalir: () => void; onAjustes: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <MascotaConMensaje
        estado="triste"
        mensaje="Este lo tenemos que dejar para otro día: tu equipo no tiene ninguna voz en inglés."
      />

      <div className="mt-6">
        <Aviso tono="aviso">
          Sin una voz inglesa instalada no podemos reproducir las palabras. Podríamos leerlas con la
          voz española que tienes, pero sonarían mal y aprenderías una pronunciación que no existe.
        </Aviso>
      </div>

      <p className="mt-4 text-sm text-[var(--texto-suave)]">
        En Windows se añaden desde Configuración → Hora e idioma → Idioma y región → añadir inglés.
        Los otros tres juegos funcionan sin voz.
      </p>

      <div className="mt-8 grid gap-3">
        <Boton tamano="grande" onClick={onSalir}>
          JUGAR A OTRA COSA
        </Boton>
        <Boton tono="suave" onClick={onAjustes}>
          Ver mis ajustes de voz
        </Boton>
      </div>
    </div>
  );
}
