import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  borrarLectura,
  crearLectura,
  hayServidorDeLecturas,
  listarLecturas,
  type ResumenLectura,
} from '@/lib/lecturas';
import { Boton } from '@/components/Boton';
import { MascotaConMensaje } from '@/components/Mascota';
import { cn } from '@/lib/cn';

type Modo = 'pegado' | 'url';

/**
 * Tus textos.
 *
 * La pantalla que hace que esto no sea otra app de contenido enlatado: aquí
 * traes TÚ lo que quieres leer. Para alguien de B1 que programa, el artículo
 * sobre revisiones de código que tenía abierto en otra pestaña enseña más que
 * cualquier unidad del curso, porque es vocabulario que va a volver a ver el
 * lunes.
 *
 * El formulario va arriba y no detrás de un botón «+»: la primera vez que se
 * entra no hay nada que listar, y una pantalla vacía con un más en una esquina
 * no explica para qué sirve. Con el recuadro abierto, para qué sirve se entiende
 * sin leer nada.
 */
export function Lecturas() {
  const navegar = useNavigate();
  const cliente = useQueryClient();

  const [modo, setModo] = useState<Modo>('pegado');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [url, setUrl] = useState('');
  const [aBorrar, setABorrar] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['lecturas'],
    queryFn: listarLecturas,
    retry: false,
  });

  const crear = useMutation({
    mutationFn: () =>
      crearLectura(
        modo === 'pegado'
          ? { titulo: titulo.trim() || undefined, texto }
          : { titulo: titulo.trim() || undefined, url },
      ),
    onSuccess: (creada) => {
      setTitulo('');
      setTexto('');
      setUrl('');
      void cliente.invalidateQueries({ queryKey: ['lecturas'] });
      navegar(`/lecturas/${creada.id}`);
    },
  });

  const borrar = useMutation({
    mutationFn: (id: string) => borrarLectura(id),
    onSuccess: () => {
      setABorrar(null);
      void cliente.invalidateQueries({ queryKey: ['lecturas'] });
    },
  });

  const listo = modo === 'pegado' ? texto.trim().length > 20 : /^https?:\/\/\S+$/.test(url.trim());

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Tus textos</h1>
        <button
          type="button"
          onClick={() => navegar('/menu')}
          className="-mr-2 flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      {hayServidorDeLecturas() === 'no' && (
        <p className="mt-4 rounded-xl border-2 border-dashed border-[var(--hueco)] px-3 py-2.5 text-sm text-[var(--texto-suave)]">
          <span aria-hidden>🧪 </span>
          El servidor de textos todavía no está. Lo que hay aquí se guarda solo en este navegador y
          no viaja a tu cuenta.
        </p>
      )}

      <form
        className="mt-5 rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] p-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (listo) crear.mutate();
        }}
      >
        <h2 className="font-bold">Trae algo que te interese</h2>
        <p className="mt-1 text-sm text-[var(--texto-suave)]">
          Un artículo, la documentación que estabas leyendo, la nota de una versión. Lo tocas
          palabra a palabra y lo que no sepas entra en tu repaso.
        </p>

        <div role="tablist" aria-label="De dónde viene el texto" className="mt-3 flex gap-2">
          {(
            [
              ['pegado', 'Pegar texto'],
              ['url', 'Desde una dirección'],
            ] as const
          ).map(([valor, nombre]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={modo === valor}
              onClick={() => setModo(valor)}
              className={cn(
                'min-h-11 rounded-xl border-2 px-3 text-sm font-bold',
                modo === valor
                  ? 'border-marca-700 bg-marca-600 text-white'
                  : 'border-[var(--hueco)] bg-[var(--fondo)]',
              )}
            >
              {nombre}
            </button>
          ))}
        </div>

        <label className="mt-3 block text-sm font-bold" htmlFor="titulo-lectura">
          Título <span className="font-normal text-[var(--texto-suave)]">(opcional)</span>
        </label>
        <input
          id="titulo-lectura"
          value={titulo}
          onChange={(evento) => setTitulo(evento.currentTarget.value)}
          placeholder="Cómo lo quieres encontrar luego"
          className="mt-1 min-h-12 w-full rounded-xl border-2 border-[var(--hueco)] bg-[var(--fondo)] px-3 text-base"
        />

        {modo === 'pegado' ? (
          <>
            <label className="mt-3 block text-sm font-bold" htmlFor="texto-lectura">
              El texto, en inglés
            </label>
            <textarea
              id="texto-lectura"
              value={texto}
              onChange={(evento) => setTexto(evento.currentTarget.value)}
              rows={6}
              placeholder="Pega aquí el artículo…"
              className="mt-1 w-full rounded-xl border-2 border-[var(--hueco)] bg-[var(--fondo)] p-3 text-base"
            />
          </>
        ) : (
          <>
            <label className="mt-3 block text-sm font-bold" htmlFor="url-lectura">
              La dirección
            </label>
            <input
              id="url-lectura"
              type="url"
              inputMode="url"
              value={url}
              onChange={(evento) => setUrl(evento.currentTarget.value)}
              placeholder="https://…"
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-[var(--hueco)] bg-[var(--fondo)] px-3 text-base"
            />
            <p className="mt-1 text-xs text-[var(--texto-suave)]">
              El servidor la abre y se queda con el texto. Las páginas que piden entrar con cuenta
              no se pueden traer.
            </p>
          </>
        )}

        {crear.isError && (
          <p role="alert" className="mt-3 text-sm text-[var(--texto-fallo)]">
            {crear.error instanceof Error
              ? crear.error.message
              : 'No pudimos preparar ese texto. Inténtalo otra vez.'}
          </p>
        )}

        <div className="mt-4">
          <Boton type="submit" disabled={!listo || crear.isPending}>
            {crear.isPending ? 'Preparándolo…' : 'Empezar a leerlo'}
          </Boton>
        </div>
      </form>

      <section className="mt-6">
        <h2 className="text-sm font-bold tracking-wide text-[var(--texto-suave)] uppercase">
          Lo que has traído
        </h2>

        {isPending && (
          <p className="mt-3 text-sm text-[var(--texto-suave)]">Buscando tus textos…</p>
        )}

        {isError && (
          <p className="mt-3 text-sm text-[var(--texto-suave)]">
            No pudimos pedir tu lista. Puedes traer un texto nuevo igualmente.
          </p>
        )}

        {data?.length === 0 && (
          <div className="mt-4">
            <MascotaConMensaje
              estado="feliz"
              mensaje="Trae el primero y te lo voy coloreando por lo que ya sabes."
            />
          </div>
        )}

        <ul className="mt-3 grid gap-3">
          {data?.map((lectura) => (
            <li key={lectura.id}>
              <Tarjeta
                lectura={lectura}
                confirmando={aBorrar === lectura.id}
                borrando={borrar.isPending && aBorrar === lectura.id}
                onAbrir={() => navegar(`/lecturas/${lectura.id}`)}
                onPedirBorrar={() => setABorrar(aBorrar === lectura.id ? null : lectura.id)}
                onBorrar={() => borrar.mutate(lectura.id)}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

interface TarjetaProps {
  lectura: ResumenLectura;
  confirmando: boolean;
  borrando: boolean;
  onAbrir: () => void;
  onPedirBorrar: () => void;
  onBorrar: () => void;
}

function Tarjeta({
  lectura,
  confirmando,
  borrando,
  onAbrir,
  onPedirBorrar,
  onBorrar,
}: TarjetaProps) {
  const sabidas = Math.max(0, lectura.palabras - lectura.sinSaber);
  const porcentaje = lectura.palabras === 0 ? 0 : (sabidas / lectura.palabras) * 100;

  return (
    <div className="rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)]">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onAbrir}
          className="min-w-0 flex-1 rounded-l-2xl p-4 text-left"
        >
          <span className="block font-bold">{lectura.titulo}</span>
          <span className="mt-0.5 block text-sm text-[var(--texto-suave)]">
            {lectura.palabras} palabras · {lectura.sinSaber} por descubrir
          </span>
          {/*
            Dos tramos y sin rojo. Lo que se ve crecer es lo que ya sabes, en el
            color de la marca; lo que falta se queda en el ámbar del rotulador,
            igual que en el texto. Un artículo nuevo sale casi todo ámbar, y eso
            tiene que parecer un libro por subrayar, no un examen corregido.
          */}
          <span
            aria-hidden
            className="mt-2 flex h-2 overflow-hidden rounded-full bg-acento-300 dark:bg-acento-500"
          >
            <span className="bg-marca-600 dark:bg-marca-400" style={{ width: `${porcentaje}%` }} />
          </span>
        </button>

        <button
          type="button"
          onClick={onPedirBorrar}
          aria-label={
            confirmando ? `Cancelar borrar ${lectura.titulo}` : `Borrar ${lectura.titulo}`
          }
          className="flex w-12 shrink-0 items-center justify-center rounded-r-2xl text-[var(--texto-suave)] hover:bg-[var(--fondo)]"
        >
          <span aria-hidden>{confirmando ? '✕' : '🗑'}</span>
        </button>
      </div>

      {/*
        Borrar pregunta en la propia tarjeta y no con un `confirm` del navegador:
        el diálogo del sistema no dice QUÉ se borra, y con seis textos en la
        lista eso es una ruleta.
      */}
      {confirmando && (
        <div className="border-t-2 border-[var(--borde)] px-4 py-3">
          <p className="text-sm">
            ¿Borrar «{lectura.titulo}»? Se pierde lo que llevabas marcado en él.
          </p>
          <div className="mt-2">
            <Boton tono="fallo" ancho={false} disabled={borrando} onClick={onBorrar}>
              {borrando ? 'Borrando…' : 'Sí, borrarlo'}
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
