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
import { Brecha } from '@/components/juegos/Brecha';
import { Mercado } from '@/components/juegos/Mercado';
import { Neon } from '@/components/juegos/Neon';
import { Carrera } from '@/components/juegos/Carrera';
import { Beat } from '@/components/juegos/Beat';
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
  type RondaDeBrecha,
  type RespuestaDeMercado,
  type RondaDeMercado,
  type RondaDeNeon,
  type RondaDeCarrera,
  type RondaDeBeat,
  type VeredictoDeNeon,
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
    /*
      `?otra=1` a partir de la segunda vuelta, y solo lo mira el de cinco
      letras: entrar al juego enseña tu partida del día —para poder volver a
      verla y compartirla— y pedir otra palabra es lo que arranca una nueva.
    */
    queryFn: () => api.get<unknown>(`/games/${code}/ronda${partida > 0 ? '?otra=1' : ''}`),
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
   * Lo mismo, pero mandando una SECUENCIA entera.
   *
   * BRECHA no contesta una cosa: ejecuta varias en un orden, y lo que hay que
   * corregir es la maniobra completa. Va aparte y no ensanchando `corregirRonda`
   * porque lo que viaja no es la misma forma —una lista de gestos en vez de una
   * respuesta suelta— y mezclarlas dejaría a los otros seis juegos aceptando
   * algo que ninguno sabe mandar.
   */
  const corregirSecuencia = useCallback(
    (rondaId: string, answer: string[]) =>
      api.post<RespuestaCorregida>(`/games/${code}/respuesta`, { rondaId, answer }),
    [code],
  );

  /**
   * Una mitad de atender a un cliente en MERCADO.
   *
   * Va aparte porque es la única que manda las DOS formas: el objeto forjado es
   * una lista de runas y la respuesta al regateo es una sola opción. Y porque
   * lo que vuelve es más gordo que un `RespuestaCorregida` normal —la frase
   * buena, la que montaste, por qué no valía cada señuelo que colaste y si lo
   * que dijiste ofende—, que es justo lo que hace que fallar enseñe algo.
   *
   * Aquí SÍ se espera la respuesta antes de pintar nada, al revés que en CAEN,
   * FALSOS_AMIGOS, PARTICULAS y BRECHA. Es lo que permite que la ronda llegue
   * sin soluciones dentro: este juego no tiene reloj, así que el viaje al
   * servidor no le quita el instante a nadie.
   */
  const responderMercado = useCallback(
    (rondaId: string, answer: string | string[]) =>
      api.post<RespuestaDeMercado>(`/games/${code}/respuesta`, { rondaId, answer }),
    [code],
  );

  /**
   * Una pregunta del caso de NEON.
   *
   * Manda el índice de la opción pulsada COMO TEXTO, porque el contrato de
   * `/respuesta` acepta las dos formas y el servidor entiende el número escrito
   * igual que el número. Lo que vuelve es más gordo que un `RespuestaCorregida`
   * normal —la línea del expediente que desmiente lo que elegiste, por qué la
   * buena era la buena, qué contesta el sospechoso—, y eso es todo lo que este
   * juego enseña al fallar.
   *
   * Aquí también SE ESPERA, como en MERCADO y por lo mismo: sin reloj, el viaje
   * al servidor no le quita el instante a nadie, y a cambio la ronda puede
   * llegar sin una sola respuesta dentro.
   */
  const responderNeon = useCallback(
    (rondaId: string, answer: string) =>
      api.post<VeredictoDeNeon>(`/games/${code}/respuesta`, { rondaId, answer }),
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
          onOtra={otraPartida}
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
      {/*
        BRECHA, igual que CAEN y PARTICULAS: la ronda le llega con la secuencia
        buena dentro porque la falla crítica tiene que verse en el momento del
        gesto equivocado, pero cada maniobra —y cada ventana que se agota sin
        terminarla— se manda y se espera a que lleguen todas antes de cerrar la
        partida.
      */}
      {code === 'BRECHA' && (
        <Brecha
          ronda={datos as RondaDeBrecha}
          onResponder={corregirSecuencia}
          onFin={terminar}
          onSalir={salir}
        />
      )}

      {code === 'PARTICULAS' && (
        <Particulas
          ronda={datos as RondaDeParticulas}
          onResponder={corregirRonda}
          onFin={terminar}
          onSalir={salir}
        />
      )}

      {/*
        MERCADO es el único que NO recibe la solución con la ronda, y por eso
        es el único que espera al servidor antes de pintar el resultado. Se lo
        puede permitir porque no tiene reloj: montar una frase lleva medio
        minuto, así que los trescientos milisegundos de red no le quitan el
        instante a nadie, y a cambio la respuesta no se puede leer en la
        pestaña de red.
      */}
      {code === 'MERCADO' && (
        <Mercado
          ronda={datos as RondaDeMercado}
          onResponder={responderMercado}
          onFin={terminar}
          onSalir={salir}
        />
      )}

      {/*
        NEON, igual que MERCADO: la ronda llega sin respuestas y cada pregunta
        espera al servidor. Aquí la razón pesa aún más, porque este juego
        consiste ENTERO en averiguar las respuestas: mandarlas por delante sería
        servir la solución del crucigrama con el crucigrama.
      */}
      {/*
        BEAT usa `corregirRonda` como CAEN, FALSOS_AMIGOS y PARTICULAS: la
        ronda le llega con la pastilla buena dentro porque la ventana de
        acierto dura 800 ms y un viaje al servidor se comería más de un tercio,
        pero cada nota —y cada una que pasa de largo sin que nadie pulse— se
        manda y se espera a que lleguen todas antes de cerrar la partida.

        Y recibe `onAjustes` como ESCUCHA, porque también comprueba si hay voz
        inglesa. La diferencia es lo que hace cuando no la hay: ESCUCHA no se
        puede jugar, y aquí solo se cae una de las dos formas de jugar.
      */}
      {code === 'BEAT' && (
        <Beat
          ronda={datos as RondaDeBeat}
          onResponder={corregirRonda}
          onFin={terminar}
          onSalir={salir}
          onAjustes={() => navegar('/ajustes')}
        />
      )}

      {/*
        CARRERA usa `corregirRonda` por lo mismo que CAEN y FALSOS_AMIGOS: la
        ronda le llega con la opción buena dentro porque entre que Milo cruza el
        portal y se ve si coge impulso o frena no cabe un viaje al servidor, y
        menos con la puerta siguiente ya acercándose. Pero cada puerta cruzada se
        manda y se espera a que lleguen todas antes de cerrar la partida, porque
        si el `/fin` adelantara a las últimas, la puntuación final saldría por
        debajo de la que se acaba de ver subir.
      */}
      {code === 'CARRERA' && (
        <Carrera
          ronda={datos as RondaDeCarrera}
          onResponder={corregirRonda}
          onFin={terminar}
          onSalir={salir}
        />
      )}

      {code === 'NEON' && (
        <Neon
          ronda={datos as RondaDeNeon}
          onResponder={responderNeon}
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
