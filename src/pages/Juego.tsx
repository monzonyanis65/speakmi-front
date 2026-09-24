import { useCallback, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { Respuesta } from '@/components/ejercicios/tipos';
import { Boton } from '@/components/Boton';
import { MascotaConMensaje } from '@/components/Mascota';
import { Aviso } from '@/components/juegos/Tablero';
import { FinDeJuego } from '@/components/juegos/FinDeJuego';
import { JuegoDeEjercicios } from '@/components/juegos/JuegoDeEjercicios';
import { Parejas } from '@/components/juegos/Parejas';
import { Escucha } from '@/components/juegos/Escucha';
import { Lluvia } from '@/components/juegos/Lluvia';
import { CincoLetras } from '@/components/juegos/CincoLetras';
import { FalsosAmigos } from '@/components/juegos/FalsosAmigos';
import { Particulas } from '@/components/juegos/Particulas';
import {
  esCodigoJuego,
  FICHAS,
  type IntentoCorregido,
  type Marcador,
  type RespuestaCorregida,
  type ResultadoFinal,
  type RondaDeCincoLetras,
  type RondaDeEjercicios,
  type RondaDeEscucha,
  type RondaDeFalsosAmigos,
  type RondaDeParticulas,
  type RondaDeLluvia,
  type RondaDeParejas,
} from '@/components/juegos/tipos';

/**
 * Una partida, del juego que sea.
 *
 * Esta pantalla no sabe jugar a nada: pide la ronda, habla con el servidor y
 * enseña el final. Las reglas viven en cada juego. Lo que se gana con eso es que
 * el trato con la API —y sobre todo lo que pasa cuando la API no contesta— esté
 * escrito UNA vez y se comporte igual en los cuatro.
 */
export function Juego() {
  const { code } = useParams();
  const navegar = useNavigate();

  /*
    El número de partida forma parte de la clave de la consulta.

    Es lo que hace que «otra partida» pida una ronda nueva de verdad en vez de
    reutilizar la que está en caché, que sería jugar dos veces a lo mismo.
  */
  const [partida, setPartida] = useState(0);
  const [marcador, setMarcador] = useState<Marcador | null>(null);

  const valido = esCodigoJuego(code);

  const ronda = useQuery({
    queryKey: ['juego', code, partida],
    queryFn: () => api.get<unknown>(`/games/${code}/ronda`),
    enabled: valido,
    retry: false,
    /*
      Ni refresco al volver a la pestaña ni al reconectar. Una partida a medias
      que se recarga sola porque alguien miró el correo es perder la partida.
    */
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
  });

  const guardar = useMutation({
    mutationFn: (fin: Marcador) => api.post<ResultadoFinal>(`/games/${code}/fin`, fin),
  });

  const { mutate: guardarPartida, reset: olvidarPartida } = guardar;

  const terminar = useCallback(
    (fin: Marcador) => {
      setMarcador(fin);
      guardarPartida(fin);
    },
    [guardarPartida],
  );

  const otraPartida = useCallback(() => {
    setMarcador(null);
    olvidarPartida();
    setPartida((n) => n + 1);
  }, [olvidarPartida]);

  const salir = useCallback(() => navegar('/juegos'), [navegar]);

  /** Corrige un ejercicio. Lanza si no se pudo: el juego decide qué hacer. */
  const corregirEjercicio = useCallback(
    (exerciseCode: string, answer: Respuesta | null) =>
      api.post<RespuestaCorregida>(`/games/${code}/respuesta`, { exerciseCode, answer }),
    [code],
  );

  const corregirRonda = useCallback(
    (rondaId: string, answer: string) =>
      api.post<RespuestaCorregida>(`/games/${code}/respuesta`, { rondaId, answer }),
    [code],
  );

  /**
   * Un intento de la palabra del día.
   *
   * Va sin `rondaId` porque aquí no hay rondas que señalar: la partida es la del
   * día y el servidor ya sabe cuál es. Lo que vuelve es el color de cada letra,
   * nunca la palabra.
   */
  const intentarPalabra = useCallback(
    (answer: string) => api.post<IntentoCorregido>(`/games/${code}/respuesta`, { answer }),
    [code],
  );

  /**
   * Cerrar la partida y saber qué se ganó, sin pasar por `FinDeJuego`.
   *
   * El final de siempre ofrece OTRA PARTIDA, y en un juego que solo se juega una
   * vez al día ese botón es una promesa que el servidor va a rechazar. Cinco
   * letras pinta su propio final —con la palabra y los cuadraditos— y para eso
   * necesita el resultado en la mano en vez de que se lo pinte otro.
   */
  const cerrarPartida = useCallback(
    (fin: Marcador) => api.post<ResultadoFinal>(`/games/${code}/fin`, fin),
    [code],
  );

  /**
   * Lo mismo, pero sin esperar respuesta.
   *
   * Parejas ya sabe si acertó —la ronda le llegó con las dos mitades— así que
   * esto es solo llevar la cuenta al servidor. Que falle no cambia nada de lo
   * que ve quien juega.
   */
  const avisarRonda = useCallback(
    (rondaId: string, answer: string) => {
      void api
        .post<RespuestaCorregida>(`/games/${code}/respuesta`, { rondaId, answer })
        .catch(() => undefined);
    },
    [code],
  );

  if (!valido) return <Navigate to="/juegos" replace />;

  const ficha = FICHAS[code];

  if (marcador) {
    return (
      <FinDeJuego
        ficha={ficha}
        marcador={marcador}
        resultado={guardar.data ?? null}
        guardando={guardar.isPending}
        noSeGuardo={guardar.isError}
        onOtra={otraPartida}
        onSalir={salir}
      />
    );
  }

  if (ronda.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-[var(--texto-suave)]">Preparando la partida…</p>
      </div>
    );
  }

  if (ronda.isError) {
    return (
      <NoSePudo
        error={ronda.error}
        titulo={ficha.titulo}
        onReintentar={() => void ronda.refetch()}
        onSalir={salir}
      />
    );
  }

  const datos = ronda.data;

  return (
    <>
      {code === 'CONTRARRELOJ' && (
        <JuegoDeEjercicios
          ronda={datos as RondaDeEjercicios}
          modo="contrarreloj"
          onResponder={corregirEjercicio}
          onFin={terminar}
          onSalir={salir}
        />
      )}

      {code === 'CADENA' && (
        <JuegoDeEjercicios
          ronda={datos as RondaDeEjercicios}
          modo="cadena"
          onResponder={corregirEjercicio}
          onFin={terminar}
          onSalir={salir}
        />
      )}

      {code === 'PAREJAS' && (
        <Parejas
          ronda={datos as RondaDeParejas}
          onResponder={avisarRonda}
          onFin={terminar}
          onSalir={salir}
        />
      )}

      {code === 'CINCO_LETRAS' && (
        <CincoLetras
          ronda={datos as RondaDeCincoLetras}
          onIntentar={intentarPalabra}
          onTerminar={cerrarPartida}
          onSalir={salir}
        />
      )}

      {code === 'ESCUCHA' && (
        <Escucha
          ronda={datos as RondaDeEscucha}
          onResponder={corregirRonda}
          onFin={terminar}
          onSalir={salir}
          onAjustes={() => navegar('/ajustes')}
        />
      )}

      {/*
        CAEN avisa de cada palabra con `corregirRonda` y no con `avisarRonda`
        aunque tampoco espere a la respuesta para pintar nada. La diferencia es
        que aquí sí importa cuándo terminan de llegar: el juego encola las
        caídas y no cierra la partida hasta que el servidor tiene la última,
        porque si el `/fin` adelantara a las tres últimas respuestas, la
        puntuación final saldría más baja que la que se acaba de ver subir.
      */}
      {code === 'CAEN' && (
        <Lluvia
          ronda={datos as RondaDeLluvia}
          onResponder={corregirRonda}
          onFin={terminar}
          onSalir={salir}
        />
      )}

      {/*
        FALSOS_AMIGOS usa `corregirRonda` por lo mismo que CAEN: pinta el
        veredicto al instante con la carta que ya tiene —no le da la vida
        esperar a la red con una carta de segundo y medio— pero sí espera a que
        lleguen todas antes de cerrar la partida, porque si el `/fin` adelantara
        a las últimas cartas la puntuación final saldría por debajo de la que se
        acaba de ver subir.
      */}
      {code === 'FALSOS_AMIGOS' && (
        <FalsosAmigos
          ronda={datos as RondaDeFalsosAmigos}
          onResponder={corregirRonda}
          onFin={terminar}
          onSalir={salir}
        />
      )}

      {/*
        PARTICULAS, igual: la ronda le llega con la solución dentro porque la
        barra dura tres segundos y el resultado no puede esperar a la red, pero
        cada partícula pulsada —y cada barra que se vacía sin pulsar nada— se
        manda y se espera a que lleguen todas antes de cerrar la partida.
      */}
      {code === 'PARTICULAS' && (
        <Particulas
          ronda={datos as RondaDeParticulas}
          onResponder={corregirRonda}
          onFin={terminar}
          onSalir={salir}
        />
      )}
    </>
  );
}

/**
 * La ronda no llegó.
 *
 * Se distingue el caso de «todavía no existe» del de «se cayó», porque no se
 * arreglan igual: uno se espera y el otro se reintenta. Decir «algo salió mal» a
 * las dos cosas deja a la persona pulsando «reintentar» para siempre.
 */
function NoSePudo({
  error,
  titulo,
  onReintentar,
  onSalir,
}: {
  error: unknown;
  titulo: string;
  onReintentar: () => void;
  onSalir: () => void;
}) {
  const todaviaNo = error instanceof ApiError && error.status === 404;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <MascotaConMensaje
        estado="triste"
        mensaje={
          todaviaNo
            ? `${titulo} todavía no está listo. Vuelve en unos días.`
            : 'No pudimos preparar la partida.'
        }
      />

      <div className="mt-6">
        <Aviso>
          {todaviaNo
            ? 'Este juego aún no está disponible en el servidor. No es culpa de tu conexión.'
            : error instanceof Error
              ? error.message
              : 'No pudimos conectar con el servidor.'}
        </Aviso>
      </div>

      <div className="mt-8 grid gap-3">
        {!todaviaNo && (
          <Boton tamano="grande" onClick={onReintentar}>
            REINTENTAR
          </Boton>
        )}
        <Boton
          tono={todaviaNo ? 'marca' : 'suave'}
          tamano={todaviaNo ? 'grande' : 'normal'}
          onClick={onSalir}
        >
          {todaviaNo ? 'PROBAR OTRO JUEGO' : 'Volver a los juegos'}
        </Boton>
      </div>
    </div>
  );
}
