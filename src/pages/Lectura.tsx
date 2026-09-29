import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  contar,
  desplazamientoParaVer,
  frasesCon,
  marcarLema,
  marcarPalabra,
  obtenerLectura,
  vecesQueSale,
  type EstadoPalabra,
  type Lectura as Texto,
  type Palabra,
} from '@/lib/lecturas';
import { decir, hayVozInglesa } from '@/lib/voz';
import { Leyenda, Progreso } from '@/components/lecturas/Progreso';
import { Reproductor } from '@/components/lecturas/Reproductor';
import { TextoTocable } from '@/components/lecturas/TextoTocable';
import { PanelPalabra } from '@/components/lecturas/PanelPalabra';

/**
 * Leer un texto tuyo.
 *
 *
 * LA PROMESA DE ESTA PANTALLA
 *
 * Que tocar una palabra no te saque de donde ibas. Todo lo demás —los colores,
 * el progreso, el audio— cuelga de eso: un artículo son doscientos toques, y a
 * la décima vez que pierdes el renglón cierras la aplicación.
 *
 * Se cumple con cuatro cosas que van juntas y que por separado no bastan:
 *
 * 1. El panel es una caja abajo y NO cambia de ruta. El texto no se desmonta,
 *    no se vuelve a pedir y no vuelve arriba.
 *
 * 2. Los cuatro estados de una palabra miden lo mismo (ver `aspecto.ts`), así
 *    que marcarla no recoloca ni una letra del párrafo.
 *
 * 3. La pantalla solo se mueve si la palabra tocada se quedaba TAPADA por el
 *    panel, y entonces lo mínimo. Si se veía, no se mueve nada. Ver
 *    `desplazamientoParaVer`.
 *
 * 4. El panel se queda abierto mientras se va leyendo: tocar la siguiente
 *    palabra cambia lo que pone, no abre ni cierra nada. El sitio por el que ibas
 *    sigue señalado con un anillo, que es una sombra y tampoco ocupa sitio.
 *
 * Y para quien lee con teclado o con lector de pantalla, «dónde ibas» es dónde
 * está el foco: al cerrar el panel, el foco vuelve a la palabra.
 */
export function Lectura() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const cliente = useQueryClient();

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['lectura', id],
    queryFn: () => obtenerLectura(id),
    retry: false,
  });

  const [seleccion, setSeleccion] = useState<{ parrafo: number; i: number } | null>(null);
  const [altoPanel, setAltoPanel] = useState(0);
  const [fallo, setFallo] = useState(false);
  /*
    Qué párrafo suena. Vive aquí y no en el reproductor porque lo usan los dos:
    el reproductor para saber cuál va, y el texto para señalarlo. Es lo único que
    hace que se pueda leer y escuchar a la vez sin inventarse nada.
  */
  const [sonando, setSonando] = useState<number | null>(null);
  const [puedeSonar, setPuedeSonar] = useState(false);

  const tocado = useRef<HTMLButtonElement | null>(null);
  const cabecera = useRef<HTMLElement>(null);
  const habiaPanel = useRef(false);

  useEffect(() => {
    let vivo = true;
    void hayVozInglesa().then((hay) => {
      if (vivo) setPuedeSonar(hay);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const alTocar = useCallback((palabra: Palabra, parrafo: number, boton: HTMLButtonElement) => {
    tocado.current = boton;
    setFallo(false);
    setSeleccion({ parrafo, i: palabra.i });
  }, []);

  const cerrar = useCallback(() => setSeleccion(null), []);
  const alAltura = useCallback((px: number) => setAltoPanel(px), []);

  /*
    Lo único que puede mover la pantalla, y solo cuando hace falta.

    `useLayoutEffect` y no `useEffect`: el ajuste tiene que ir en el mismo
    fotograma en que aparece el panel. Un fotograma tarde se ve como un salto,
    que es justo lo que esto existe para evitar.
  */
  useLayoutEffect(() => {
    if (!seleccion || altoPanel === 0) return;
    const boton = tocado.current;
    if (!boton) return;

    const caja = boton.getBoundingClientRect();
    const salto = desplazamientoParaVer({
      arriba: caja.top,
      abajo: caja.bottom,
      altoVentana: window.innerHeight,
      altoPanel,
      altoCabecera: cabecera.current?.offsetHeight ?? 0,
    });

    if (salto !== 0 && typeof window.scrollBy === 'function') window.scrollBy(0, salto);
  }, [seleccion, altoPanel]);

  // Al cerrar, el foco vuelve a la palabra. Sin esto, quien navega con teclado
  // acaba al principio del documento cada vez que mira una palabra.
  useEffect(() => {
    if (seleccion) {
      habiaPanel.current = true;
      return;
    }
    if (!habiaPanel.current) return;
    habiaPanel.current = false;
    setAltoPanel(0);
    tocado.current?.focus();
  }, [seleccion]);

  const parrafos = useMemo(() => data?.parrafos ?? [], [data]);
  const cuenta = useMemo(() => contar(parrafos), [parrafos]);

  const palabra = useMemo(() => {
    if (!seleccion) return null;
    const parrafo = parrafos.find((p) => p.indice === seleccion.parrafo);
    return parrafo?.palabras.find((p) => p.i === seleccion.i) ?? null;
  }, [parrafos, seleccion]);

  async function marcar(estado: EstadoPalabra) {
    if (!palabra) return;
    const lema = palabra.lema;
    const antes = cliente.getQueryData<Texto>(['lectura', id]);

    /*
      Se pinta antes de que conteste el servidor.

      Marcar una palabra es un gesto de leer, no de guardar: esperar trescientos
      milisegundos a que el color cambie rompe el ritmo y hace dudar de si el
      toque ha entrado. Si el servidor dice que no, se deshace y se avisa, que
      pasa una vez de cada mil.
    */
    cliente.setQueryData<Texto>(['lectura', id], (vieja) =>
      vieja ? { ...vieja, parrafos: marcarLema(vieja.parrafos, lema, estado) } : vieja,
    );

    try {
      await marcarPalabra(id, lema, estado);
      // La lista de textos enseña cuántas quedan: ya no es verdad.
      void cliente.invalidateQueries({ queryKey: ['lecturas'] });
    } catch {
      if (antes) cliente.setQueryData<Texto>(['lectura', id], antes);
      setFallo(true);
    }
  }

  if (isPending) {
    return <Centrado>Abriendo el texto…</Centrado>;
  }

  if (isError || !data) {
    return (
      <Centrado>
        <p className="font-bold">No pudimos abrir este texto.</p>
        <p className="mt-1 text-sm text-[var(--texto-suave)]">
          {error instanceof Error ? error.message : 'Vuelve a intentarlo en un momento.'}
        </p>
        <button
          type="button"
          onClick={() => navegar('/lecturas')}
          className="boton-3d mt-5 min-h-12 rounded-xl border-2 border-[var(--hueco)] bg-[var(--superficie)] px-5 font-bold"
        >
          Volver a tus textos
        </button>
      </Centrado>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <header
        ref={cabecera}
        className="sticky top-0 z-20 -mx-4 bg-[var(--fondo)] px-4 pt-2 pb-2 sm:-mx-6 sm:px-6"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navegar('/lecturas')}
            aria-label="Volver a tus textos"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
          >
            <span aria-hidden>‹</span>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-bold" title={data.titulo}>
            {data.titulo}
          </h1>
        </div>
        <div className="mt-1.5">
          <Progreso cuenta={cuenta} />
        </div>
      </header>

      {/*
        El sitio para el panel se reserva ABAJO, que es la única dirección en la
        que se puede crecer sin empujar nada: alargar el final del documento no
        mueve ni una línea de lo que ya estaba escrito. Sin esto, el último
        párrafo quedaría siempre debajo del panel y no habría forma de llegar a
        él sin cerrarlo.
      */}
      <div className="pt-3" style={{ paddingBottom: seleccion ? `${altoPanel + 24}px` : '2rem' }}>
        <Reproductor
          id={id}
          audioEntero={data.audio}
          totalParrafos={parrafos.length}
          sonando={sonando}
          onSonando={setSonando}
        />

        <div className="mt-3">
          <Leyenda />
        </div>

        {fallo && (
          <p
            role="alert"
            className="mt-3 rounded-xl border-2 border-[var(--hueco)] bg-[var(--superficie)] px-3 py-2 text-sm text-[var(--texto-aviso)]"
          >
            No se pudo guardar esa palabra. Lo que ves es como estaba antes; vuelve a intentarlo.
          </p>
        )}

        <div className="mt-5">
          <TextoTocable
            parrafos={parrafos}
            seleccion={seleccion}
            sonando={sonando}
            onTocar={alTocar}
          />
        </div>
      </div>

      {palabra && (
        <PanelPalabra
          key={`${seleccion?.parrafo}:${seleccion?.i}`}
          palabra={palabra}
          veces={vecesQueSale(parrafos, palabra.lema)}
          frases={frasesCon(parrafos, palabra.lema, 2)}
          puedeSonar={puedeSonar}
          onSonar={() => void decir(palabra.texto, { velocidad: 0.85 })}
          onEstado={(estado) => void marcar(estado)}
          onCerrar={cerrar}
          onAltura={alAltura}
        />
      )}
    </div>
  );
}

function Centrado({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
