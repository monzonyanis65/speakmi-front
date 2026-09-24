import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Boton } from '@/components/Boton';
import { Mascota } from '@/components/Mascota';
import { Ejercicio } from '@/components/ejercicios/Ejercicio';
import type { Correccion, Respuesta } from '@/components/ejercicios/tipos';
import { useMenosMovimiento } from '@/lib/movimiento';
import { sonar, useDespertarSonido } from '@/lib/sonido';
import { Aviso, CabeceraJuego, Contador, Racha, Reloj } from './Tablero';
import { Destello, PuntosGanados } from './efectos';
import { loQueSumaElSiguiente, puntosDelServidor } from './puntos';
import {
  textoDeFeedback,
  type CodigoJuego,
  type Marcador,
  type RespuestaCorregida,
  type RondaDeEjercicios,
} from './tipos';

/**
 * Los dos juegos que se juegan con ejercicios de verdad: contrarreloj y cadena.
 *
 * Comparten componente porque casi todo es lo mismo —pintar el ejercicio, mandar
 * la respuesta, sumar la racha— y lo que cambia es UNA regla: en contrarreloj te
 * echa el reloj y en cadena te echa el primer fallo. Tenerlos separados haría
 * que dentro de un mes se movieran distinto sin que nadie lo hubiera decidido.
 *
 * Los ejercicios no se reinventan: son los mismos siete tipos de las lecciones,
 * con el mismo componente. Lo único que cambia aquí es el ritmo.
 */

type Modo = 'contrarreloj' | 'cadena';

/** Cuánto dura el contrarreloj si el servidor no dice otra cosa. */
const SEGUNDOS_POR_DEFECTO = 60;

/**
 * Los tipos que se contestan de un toque y no necesitan botón de enviar.
 *
 * En una lección un botón extra no molesta. En un contrarreloj sí: obliga a dos
 * gestos por ejercicio, y con sesenta segundos eso son varias respuestas menos.
 * Los que se escriben sí llevan botón, porque ahí teclear no significa que hayas
 * terminado de escribir.
 */
const DE_UN_TOQUE = new Set(['multiple_choice', 'minimal_pair']);

interface Visto {
  isCorrect: boolean;
  texto: string | null;
  correcta?: string;
}

export function JuegoDeEjercicios({
  ronda,
  modo,
  onResponder,
  onFin,
  onSalir,
}: {
  ronda: RondaDeEjercicios;
  modo: Modo;
  /** Manda la respuesta al servidor. Que lance si no se pudo: aquí se maneja. */
  onResponder: (exerciseCode: string, answer: Respuesta | null) => Promise<RespuestaCorregida>;
  onFin: (marcador: Marcador) => void;
  onSalir: () => void;
}) {
  const menosMovimiento = useMenosMovimiento();
  // El audio no puede nacer hasta que alguien toque algo. Esto lo deja listo en
  // el primer toque, que además es el de la primera respuesta: así ya suena.
  useDespertarSonido();

  const [indice, setIndice] = useState(0);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [visto, setVisto] = useState<Visto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [falloDeRed, setFalloDeRed] = useState(false);

  const [aciertos, setAciertos] = useState(0);
  const [contestados, setContestados] = useState(0);
  /*
    Lo que llevas hecho, acierto a acierto.

    No es adorno ni es un contador más: es la partida vista de un vistazo. Sin
    esto la pantalla enseña un ejercicio y nada alrededor, y eso es exactamente
    lo que hace que un juego con reloj se sienta un examen con reloj. Con la
    tira, cada respuesta deja marca y la racha se VE, que es lo que engancha.
  */
  const [historial, setHistorial] = useState<boolean[]>([]);
  const [racha, setRacha] = useState(0);
  /*
    La racha viva se rompe al fallar; la que PAGA es la más larga de la partida.
    Se guarda aparte para que el marcador en vivo enseñe lo mismo que va a cerrar
    el servidor: un número que baja al fallar y luego no cuadra con el final es
    justo lo que hace que un juego se sienta trucado.
  */
  const [rachaMaxima, setRachaMaxima] = useState(0);

  const codigo: CodigoJuego = modo === 'cadena' ? 'CADENA' : 'CONTRARRELOJ';
  /*
    La puntuación no es un estado: es una cuenta de los aciertos, con la misma
    fórmula que usará el servidor al cerrar la partida. Guardarla aparte era
    justo lo que permitía que se desviara de la de verdad.
  */
  const puntuacion = puntosDelServidor(codigo, aciertos, rachaMaxima);
  const segundos = modo === 'contrarreloj' ? (ronda.segundos ?? SEGUNDOS_POR_DEFECTO) : 0;
  const [restantes, setRestantes] = useState(segundos);

  const ejercicio = ronda.ejercicios[indice];

  /*
    El marcador vive en un `ref` además de en el estado.

    El reloj se dispara desde fuera del render, y leer el estado desde ahí
    devuelve el valor que tenía cuando se creó el temporizador, no el de ahora.
    Con un `ref` se lee lo de ahora, que es lo que hay que mandar al servidor.
  */
  const ultimo = useRef<Marcador>({ puntuacion: 0, aciertos: 0, total: 0 });
  ultimo.current = { puntuacion, aciertos, total: contestados };

  const terminado = useRef(false);
  const terminar = useCallback(() => {
    if (terminado.current) return;
    terminado.current = true;
    onFin(ultimo.current);
  }, [onFin]);

  /*
    El reloj, solo en contrarreloj.

    Se cuenta contra una hora de fin en vez de restar de uno en uno. Una pestaña
    en segundo plano congela los temporizadores, y restando se regalarían todos
    los segundos que estuvo escondida.
  */
  useEffect(() => {
    if (modo !== 'contrarreloj') return;

    const fin = Date.now() + segundos * 1000;
    const reloj = setInterval(() => {
      const quedan = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
      setRestantes(quedan);
      if (quedan <= 0) {
        clearInterval(reloj);
        terminar();
      }
    }, 250);

    return () => clearInterval(reloj);
  }, [modo, segundos, terminar]);

  const avanzar = useCallback(() => {
    setVisto(null);
    setRespuesta(null);
    setIndice((anterior) => anterior + 1);
  }, []);

  // Cuando se acaban los ejercicios se termina, aunque quede reloj. Repetir los
  // mismos convertiría el juego en una prueba de memoria.
  useEffect(() => {
    if (!ejercicio) terminar();
  }, [ejercicio, terminar]);

  async function responder(valor: Respuesta | null) {
    if (!ejercicio || enviando || visto) return;

    setEnviando(true);
    setFalloDeRed(false);

    try {
      const corregida = await onResponder(ejercicio.code, valor);
      const nuevaRacha = corregida.isCorrect ? racha + 1 : 0;
      setRachaMaxima((mejor) => Math.max(mejor, nuevaRacha));

      setContestados((n) => n + 1);
      setHistorial((anterior) => [...anterior, corregida.isCorrect]);
      setRacha(nuevaRacha);
      if (corregida.isCorrect) setAciertos((n) => n + 1);

      /*
        El sonido va aquí y no en un efecto, porque esto sigue dentro del gesto
        que lo permitió. A partir de dos seguidas suena el arpegio de la racha,
        y sube un semitono con cada acierto: la escalera se oye antes de verse.
      */
      if (!corregida.isCorrect) sonar('fallo');
      else if (nuevaRacha >= 2) sonar('combo', { racha: nuevaRacha });
      else sonar('acierto');

      const objeto = typeof corregida.feedback === 'object' ? corregida.feedback : null;
      setVisto({
        isCorrect: corregida.isCorrect,
        texto: textoDeFeedback(corregida.feedback),
        ...(objeto?.correcta ? { correcta: objeto.correcta } : {}),
      });
    } catch {
      // Sin servidor no se puede saber si estuvo bien, y adivinarlo sería mentir.
      // La partida no se pierde: se puede reintentar o pasar de largo.
      setFalloDeRed(true);
    } finally {
      setEnviando(false);
    }
  }

  // En cadena, el primer fallo acaba la partida. Se deja ver la corrección
  // antes: enterarse de por qué se rompió la cadena es la mitad del juego.
  const seRompio = modo === 'cadena' && visto?.isCorrect === false;

  if (!ejercicio) return null;

  const paraElEjercicio: Correccion | null = visto
    ? {
        isCorrect: visto.isCorrect,
        score: visto.isCorrect ? 1 : 0,
        feedback: {
          message_es: visto.texto ?? '',
          ...(visto.correcta ? { correcta: visto.correcta } : {}),
          errores: [],
        },
      }
    : null;

  const deUnToque = DE_UN_TOQUE.has(ejercicio.type);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-4">
      <CabeceraJuego onSalir={onSalir}>
        {modo === 'contrarreloj' ? (
          <Reloj restantes={restantes} total={segundos} />
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-extrabold leading-none tabular-nums">{racha}</p>
            <p className="text-xs text-[var(--texto-suave)]">
              {racha === 1 ? 'acierto seguido' : 'aciertos seguidos'}
            </p>
          </div>
        )}
        {/*
          Los puntos, en vivo y de verdad.

          Antes aquí ponía «aciertos», porque una versión anterior enseñaba unos
          puntos inventados que no cuadraban con los del final —se veía subir 118
          y la pantalla final ponía 60— y la salida fue dejar de enseñarlos. La
          salida buena era la de ahora: calcular exactamente lo mismo que calcula
          el servidor. La cifra del final la sigue diciendo él; esta solo tiene
          que coincidir, y coincide.

          Con el número a la vista, cada respuesta mueve algo. Sin él, la partida
          entera era un ejercicio detrás de otro.
        */}
        <Contador
          etiqueta="Puntos"
          valor={puntuacion}
          tono={aciertos > 0 ? 'acierto' : 'normal'}
          vivo
        >
          {visto?.isCorrect && (
            <PuntosGanados key={contestados} puntos={loQueSumaElSiguiente(codigo, aciertos - 1)} />
          )}
        </Contador>
      </CabeceraJuego>

      {/* El fogonazo de la respuesta. Se monta de nuevo con cada una y se borra solo. */}
      {visto && (
        <Destello
          key={contestados}
          senal={!visto.isCorrect ? 'fallo' : racha >= 3 ? 'combo' : 'acierto'}
        />
      )}

      {/*
        El ejercicio va centrado, y la racha viaja con él.

        Pegado arriba deja medio móvil vacío debajo; y con la racha anclada bajo
        la cabecera quedaban DOS huecos, uno a cada lado de una línea suelta.
        Todo lo que cambia con la respuesta —racha, enunciado, opciones— es un
        solo bloque y se mueve junto.
      */}
      <div className="mt-6 flex flex-1 flex-col justify-center">
        <div className="mb-4 flex min-h-8 items-center gap-2">
          <Racha racha={racha} />
          {/*
            En cadena se dice cuánto vale el siguiente, y se dice desde el
            principio: el acierto número n sube el marcador 10n-5, así que el
            primero paga 5 y el décimo 95. Ver esa cifra crecer antes de
            contestar es la razón para contestar una más.

            En contrarreloj no se pone: todos valen diez, y repetirlo veinte
            veces no dice nada.
          */}
          {modo === 'cadena' ? (
            <span className="text-xs font-bold text-[var(--texto-aviso)]">
              la siguiente vale +{loQueSumaElSiguiente('CADENA', aciertos)}
            </span>
          ) : (
            racha < 2 && (
              <p className="text-xs text-[var(--texto-suave)]">
                Sin pensarlo mucho: cada acierto son diez puntos.
              </p>
            )
          )}
        </div>

        <Ejercicio
          key={ejercicio.code}
          ejercicio={ejercicio}
          bloqueado={enviando || visto !== null}
          onCambio={(valor) => {
            setRespuesta(valor);
            // Los de un toque se mandan solos: en un juego de velocidad, pedir
            // un segundo toque para confirmar es tiempo regalado.
            if (deUnToque && valor !== null) void responder(valor);
          }}
          {...(paraElEjercicio ? { resultado: paraElEjercicio } : {})}
        />
      </div>

      <Tira historial={historial} modo={modo} />

      {falloDeRed && (
        <div className="mt-4">
          <Aviso>
            No pudimos corregir esta respuesta. Reinténtalo o pasa a la siguiente; esta no cuenta.
          </Aviso>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Boton tono="suave" onClick={() => void responder(respuesta)}>
              Reintentar
            </Boton>
            <Boton tono="suave" onClick={avanzar}>
              Saltar
            </Boton>
          </div>
        </div>
      )}

      {visto && (
        <div
          role="status"
          className={cn(
            'mt-4 flex items-center gap-3 rounded-2xl p-3',
            visto.isCorrect
              ? 'bg-emerald-50 dark:bg-emerald-950/30'
              : 'bg-red-50 dark:bg-red-950/30',
            !visto.isCorrect && !menosMovimiento && 'animate-temblor',
          )}
        >
          {/* La mascota reacciona: a partir de cinco seguidas ya no celebra, presume. */}
          <Mascota
            estado={visto.isCorrect ? (racha >= 5 ? 'orgulloso' : 'celebrando') : 'triste'}
            tamano={44}
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'font-extrabold',
                visto.isCorrect ? 'text-[var(--texto-acierto)]' : 'text-[var(--texto-fallo)]',
              )}
            >
              {visto.isCorrect
                ? racha >= 2
                  ? `¡Bien! ${racha} seguidas`
                  : '¡Bien!'
                : seRompio
                  ? 'Se rompió la cadena'
                  : 'No era esa'}
            </p>
            {/*
              La buena, al lado de la tuya.

              Fallar sin enterarse de cuál era no enseña nada y encima enfada: el
              ejercicio de debajo ya marca la correcta, pero cuando el servidor
              la manda escrita se repite aquí, que es donde está mirando la vista
              justo después de responder.
            */}
            {visto.correcta && (
              <p className="mt-0.5 text-sm">
                Era <strong lang="en">{visto.correcta}</strong>
              </p>
            )}
            {visto.texto && visto.texto !== visto.correcta && (
              <p className="mt-0.5 text-sm">{visto.texto}</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        {visto ? (
          <Boton
            tamano="grande"
            tono={visto.isCorrect ? 'acierto' : 'marca'}
            autoFocus
            onClick={seRompio ? terminar : avanzar}
          >
            {seRompio ? 'VER RESULTADO' : 'SEGUIR'}
          </Boton>
        ) : (
          !deUnToque && (
            <Boton
              tamano="grande"
              disabled={enviando || respuesta === null || respuesta === ''}
              onClick={() => void responder(respuesta)}
            >
              {enviando ? 'Comprobando…' : 'RESPONDER'}
            </Boton>
          )
        )}
      </div>
    </div>
  );
}

/**
 * La partida vista de golpe: un punto por respuesta, verde o rojo.
 *
 * En cadena son eslabones y se ven todos, porque la cadena ES el juego. En
 * contrarreloj pueden ser treinta en un minuto, así que solo caben los últimos:
 * lo que importa ahí es si vienes caliente, no lo que hiciste al principio.
 */
function Tira({ historial, modo }: { historial: boolean[]; modo: Modo }) {
  if (historial.length === 0) return null;
  const visibles = modo === 'cadena' ? historial : historial.slice(-18);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-hidden>
      {visibles.map((bien, i) => (
        <span key={i} className={cn('size-2.5 rounded-full', bien ? 'bg-acierto' : 'bg-fallo')} />
      ))}
    </div>
  );
}
