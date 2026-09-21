import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useContador } from '@/lib/contador';
import { Boton } from '@/components/Boton';
import { MascotaConMensaje } from '@/components/Mascota';

type TipoArticulo = 'mascota' | 'atuendo' | 'poder';

interface ArticuloTienda {
  code: string;
  kind: TipoArticulo;
  nameEs: string;
  descriptionEs: string;
  price: number;
  emoji: string;
}

interface ArticuloEnCartera {
  code: string;
  kind: TipoArticulo;
  quantity: number;
}

interface Equipado {
  mascota: string;
  atuendo: string | null;
}

interface Cartera {
  coins: number;
  items: ArticuloEnCartera[];
  equipped: Equipado;
}

const CLAVE_CARTERA = ['cartera'] as const;

const PESTANAS = [
  { id: 'tienda', titulo: 'Tienda' },
  { id: 'cosas', titulo: 'Tus cosas' },
] as const;

type Pestana = (typeof PESTANAS)[number]['id'];

/**
 * El orden de los grupos no es alfabético ni casual.
 *
 * Los poderes van primero porque son lo único que cambia cómo se estudia: una
 * vida extra o un congelador de racha se compran para seguir practicando. Las
 * mascotas y los atuendos son adorno, y el adorno se mira después.
 */
const GRUPOS: Array<{ kind: TipoArticulo; titulo: string }> = [
  { kind: 'poder', titulo: 'Poderes' },
  { kind: 'mascota', titulo: 'Mascotas' },
  { kind: 'atuendo', titulo: 'Atuendos' },
];

/**
 * Los poderes se gastan; las mascotas y los atuendos no.
 *
 * De ahí sale todo lo demás: un atuendo que ya tienes sale marcado como tuyo y
 * sin precio, y un poder que ya tienes sigue enseñando su precio, porque
 * comprar el segundo es lo normal.
 */
function esConsumible(kind: TipoArticulo): boolean {
  return kind === 'poder';
}

/**
 * Convierte un fallo de la API en algo que se pueda hacer.
 *
 * El 404 tiene texto propio porque, mientras la tienda se termina en el
 * backend, ese es el error que contesta, y mandar a alguien a mirarse el wifi
 * cuando lo que pasa es que el endpoint todavía no existe le hace perder el
 * rato buscando un fallo suyo.
 */
function explicarFallo(error: unknown, accion: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return `${accion} todavía no está disponible en el servidor. Vuelve a intentarlo dentro de un rato.`;
    }
    return error.message;
  }
  return 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.';
}

/**
 * Qué decirle a quien intentó comprar y no pudo.
 *
 * Los códigos del backend no se enseñan tal cual: «409 SHOP-002» no le dice a
 * nadie qué hacer y «te faltan 40 monedas» sí. La cuenta se hace aquí con lo
 * que ya está en pantalla, que es justo lo que la persona está mirando.
 *
 * El caso raro es que el servidor diga que no alcanza cuando en pantalla sí
 * alcanzaba: entonces el saldo que se estaba viendo era viejo. Ahí no se puede
 * inventar una cifra, así que se dice lo que pasó y se recarga la cartera.
 */
function explicarCompra(error: unknown, articulo: ArticuloTienda, monedas: number): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'SHOP-002': {
        const faltan = articulo.price - monedas;
        if (faltan <= 0) {
          return 'Tus monedas habían cambiado y ya no alcanzan. Mira el saldo de arriba, está al día.';
        }
        return `Te faltan ${faltan} ${faltan === 1 ? 'moneda' : 'monedas'}. Termina una lección y vuelve.`;
      }
      case 'SHOP-003':
        return 'Ya lo tienes. No hace falta comprarlo otra vez.';
      case 'SHOP-001':
        return 'Este artículo ya no está en la tienda. Recarga para ver el catálogo al día.';
      default:
        return explicarFallo(error, 'Comprar');
    }
  }
  return explicarFallo(error, 'Comprar');
}

function explicarEquipar(error: unknown): string {
  if (error instanceof ApiError && error.code === 'SHOP-004') {
    return 'Todavía no tienes eso. Cómpralo en la tienda y vuelve a esta pestaña.';
  }
  return explicarFallo(error, 'Cambiar lo que llevas');
}

/**
 * La tienda y lo que ya tienes, en una sola pantalla con dos pestañas.
 *
 * Están juntas porque son el mismo gesto partido en dos: se compra para
 * ponérselo, y se decide qué ponerse mirando lo que falta por comprar. Además
 * la cartera (las monedas, lo que tienes y lo que llevas puesto) es la misma
 * consulta en las dos pestañas, así que cambiar de pestaña no pide nada.
 *
 * El catálogo y la cartera sí son dos consultas distintas, a propósito: si el
 * catálogo se cae, las monedas y tus cosas siguen viéndose, y al revés.
 */
export function Tienda() {
  const navegar = useNavigate();
  const clienteConsultas = useQueryClient();
  const [pestana, setPestana] = useState<Pestana>('tienda');
  const [recienComprado, setRecienComprado] = useState<string | null>(null);

  const catalogo = useQuery({
    queryKey: ['tienda', 'catalogo'],
    queryFn: () => api.get<{ items: ArticuloTienda[] }>('/shop/catalog'),
  });

  const cartera = useQuery({
    queryKey: CLAVE_CARTERA,
    queryFn: () => api.get<Cartera>('/me/wallet'),
  });

  const monedas = cartera.data?.coins ?? 0;
  // Las monedas cuentan al entrar y vuelven a contar después de cada compra: el
  // número no cambia de golpe, y ese recuento es lo que confirma que se compró.
  const monedasContadas = useContador(monedas, 700);

  const comprar = useMutation({
    mutationFn: (code: string) => api.post<Cartera>('/shop/buy', { code }),
    onSuccess: (nueva, code) => {
      // La respuesta ya es la cartera entera, así que se pinta al momento. La
      // invalidación de después es el seguro por si algo más la tocó.
      clienteConsultas.setQueryData(CLAVE_CARTERA, nueva);
      void clienteConsultas.invalidateQueries({ queryKey: CLAVE_CARTERA });
      setRecienComprado(code);
    },
    onError: (error) => {
      // Si el servidor dice que no alcanza o que ya lo tienes, lo que hay en
      // pantalla está viejo. Se vuelve a pedir la cartera para que el mensaje y
      // el saldo cuenten lo mismo.
      if (error instanceof ApiError && (error.code === 'SHOP-002' || error.code === 'SHOP-003')) {
        void clienteConsultas.invalidateQueries({ queryKey: CLAVE_CARTERA });
      }
    },
  });

  const equipar = useMutation({
    mutationFn: (cambio: { mascota?: string; atuendo?: string | null }) =>
      api.put<{ equipped: Equipado }>('/me/equipped', cambio),
    onSuccess: (respuesta) => {
      clienteConsultas.setQueryData<Cartera>(CLAVE_CARTERA, (previa) =>
        previa ? { ...previa, equipped: respuesta.equipped } : previa,
      );
    },
  });

  const articulos = useMemo(() => catalogo.data?.items ?? [], [catalogo.data]);

  /** Cuánto tienes de cada cosa, por código, para no recorrer la lista en cada tarjeta. */
  const cantidades = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const item of cartera.data?.items ?? []) {
      mapa.set(item.code, (mapa.get(item.code) ?? 0) + item.quantity);
    }
    return mapa;
  }, [cartera.data]);

  /**
   * Los artículos agrupados, con su retraso de entrada ya calculado.
   *
   * El escalonado cuenta seguido entre grupos y no se reinicia en cada uno: así
   * la pantalla entra como una sola lista y no como tres bloques a la vez.
   */
  const grupos = useMemo(() => {
    let orden = 0;
    return GRUPOS.map((grupo) => ({
      ...grupo,
      articulos: articulos
        .filter((articulo) => articulo.kind === grupo.kind)
        .map((articulo) => ({ articulo, retraso: orden++ * 70 })),
    })).filter((grupo) => grupo.articulos.length > 0);
  }, [articulos]);

  const comprado = recienComprado
    ? articulos.find((articulo) => articulo.code === recienComprado)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--texto-suave)]">Lo que ganas practicando</p>
          <h1 className="text-xl font-bold">Tienda</h1>
        </div>
        <button
          type="button"
          onClick={() => navegar('/menu')}
          className="-mr-2 flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      <p
        className="mt-4 flex min-h-12 animate-entrada items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] px-4 py-3 text-2xl font-extrabold tabular-nums"
        aria-label={
          cartera.isError
            ? 'No pudimos leer tus monedas'
            : `Tienes ${monedas} ${monedas === 1 ? 'moneda' : 'monedas'}`
        }
      >
        <span aria-hidden>🪙</span>
        <span aria-hidden>{cartera.isError ? '—' : monedasContadas}</span>
        <span aria-hidden className="text-sm font-medium text-[var(--texto-suave)]">
          monedas
        </span>
      </p>

      {cartera.isError && (
        <p className="mt-2 text-center text-sm text-[var(--texto-suave)]">
          {explicarFallo(cartera.error, 'Ver tus monedas')}
        </p>
      )}

      <div role="tablist" aria-label="Tienda y tus cosas" className="mt-4 grid grid-cols-2 gap-2">
        {PESTANAS.map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            role="tab"
            id={`pestana-${opcion.id}`}
            aria-selected={pestana === opcion.id}
            aria-controls={`panel-${opcion.id}`}
            onClick={() => setPestana(opcion.id)}
            className={cn(
              'min-h-12 rounded-xl border-2 border-b-4 px-4 text-sm font-bold transition',
              pestana === opcion.id
                ? 'border-marca-900 bg-marca-700 text-white'
                : 'border-[var(--borde)] bg-[var(--superficie)] hover:border-marca-400',
            )}
          >
            {opcion.titulo}
          </button>
        ))}
      </div>

      {pestana === 'tienda' ? (
        <div id="panel-tienda" role="tabpanel" aria-labelledby="pestana-tienda">
          {/*
            La confirmación va aquí arriba y no dentro de la tarjeta: después de
            comprar, lo primero que se mira es el saldo, y así el aviso queda
            justo al lado del número que acaba de bajar.
          */}
          {comprado && (
            <p
              role="status"
              className="mt-4 animate-crecer rounded-2xl border-2 border-b-4 border-emerald-900 bg-emerald-800 px-4 py-3 text-sm font-bold text-white"
            >
              <span aria-hidden>✅ </span>
              {comprado.nameEs} es tuyo. Te quedan {monedas} {monedas === 1 ? 'moneda' : 'monedas'}.
            </p>
          )}

          {catalogo.isPending && (
            <p className="mt-10 text-center text-[var(--texto-suave)]">Cargando la tienda…</p>
          )}

          {catalogo.isError && (
            <div className="mt-8">
              <MascotaConMensaje
                estado="pensando"
                mensaje={explicarFallo(catalogo.error, 'La tienda')}
              />
              <Boton
                tono="suave"
                ancho={false}
                className="mt-4 min-h-12"
                onClick={() => void catalogo.refetch()}
                disabled={catalogo.isFetching}
              >
                {catalogo.isFetching ? 'Reintentando…' : 'Reintentar'}
              </Boton>
            </div>
          )}

          {catalogo.data && grupos.length === 0 && (
            <p className="mt-10 text-center text-[var(--texto-suave)]">
              La tienda está vacía por ahora. Seguimos llenándola.
            </p>
          )}

          {grupos.map((grupo) => (
            <section key={grupo.kind} className="mt-6">
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
                {grupo.titulo}
              </h2>
              <div className="mt-3 grid gap-3">
                {grupo.articulos.map(({ articulo, retraso }) => (
                  <TarjetaArticulo
                    key={articulo.code}
                    articulo={articulo}
                    cantidad={cantidades.get(articulo.code) ?? 0}
                    monedas={monedas}
                    retraso={retraso}
                    recienComprado={recienComprado === articulo.code}
                    comprando={comprar.isPending && comprar.variables === articulo.code}
                    error={
                      comprar.isError && comprar.variables === articulo.code
                        ? explicarCompra(comprar.error, articulo, monedas)
                        : null
                    }
                    alComprar={() => comprar.mutate(articulo.code)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div id="panel-cosas" role="tabpanel" aria-labelledby="pestana-cosas">
          <TusCosas
            cartera={cartera.data}
            cargando={cartera.isPending}
            error={cartera.isError ? explicarFallo(cartera.error, 'Ver tus cosas') : null}
            articulos={articulos}
            equipar={(cambio) => equipar.mutate(cambio)}
            equipando={equipar.isPending}
            errorEquipar={equipar.isError ? explicarEquipar(equipar.error) : null}
            irALaTienda={() => setPestana('tienda')}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Un artículo de la tienda.
 *
 * Lo que no te alcanza se queda a la vista, con el precio en rojo y el botón
 * apagado. Esconderlo dejaría una tienda en la que todo se puede comprar, y
 * entonces no hay ninguna razón para volver mañana. El rojo no va solo: debajo
 * dice cuántas monedas faltan, porque quien no distingue el rojo tiene que
 * poder enterarse igual.
 */
function TarjetaArticulo({
  articulo,
  cantidad,
  monedas,
  retraso,
  recienComprado,
  comprando,
  error,
  alComprar,
}: {
  articulo: ArticuloTienda;
  cantidad: number;
  monedas: number;
  retraso: number;
  recienComprado: boolean;
  comprando: boolean;
  error: string | null;
  alComprar: () => void;
}) {
  const consumible = esConsumible(articulo.kind);
  const yaEsTuyo = cantidad > 0 && !consumible;
  const faltan = articulo.price - monedas;
  const sinSaldo = faltan > 0;

  return (
    <article
      className={cn(
        'flex animate-entrada items-start gap-3 rounded-2xl border-2 border-b-4 bg-[var(--superficie)] p-4',
        yaEsTuyo ? 'border-marca-600' : 'border-[var(--borde)]',
        recienComprado && 'animate-crecer',
      )}
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <span aria-hidden className="text-4xl leading-none">
        {articulo.emoji}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="font-bold leading-tight">{articulo.nameEs}</h3>
        <p className="mt-0.5 text-sm text-[var(--texto-suave)]">{articulo.descriptionEs}</p>

        {consumible && cantidad > 0 && (
          <p className="mt-1 text-xs font-semibold text-[var(--texto-suave)]">Tienes {cantidad}</p>
        )}

        {yaEsTuyo ? (
          <p className="mt-2 inline-flex rounded-full bg-marca-100 px-2.5 py-1 text-xs font-bold text-marca-800 dark:bg-marca-900/50 dark:text-marca-200">
            Ya es tuyo
          </p>
        ) : (
          <>
            <p
              className={cn(
                'mt-2 text-sm font-bold tabular-nums',
                sinSaldo && 'text-red-700 dark:text-red-300',
              )}
            >
              <span aria-hidden>🪙 </span>
              {articulo.price} {articulo.price === 1 ? 'moneda' : 'monedas'}
            </p>
            {sinSaldo && (
              <p className="mt-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                Te faltan {faltan} {faltan === 1 ? 'moneda' : 'monedas'}
              </p>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>

      {!yaEsTuyo && (
        <Boton
          ancho={false}
          className="min-h-12 shrink-0 self-center"
          disabled={sinSaldo || comprando}
          onClick={alComprar}
          aria-label={
            sinSaldo
              ? `Comprar ${articulo.nameEs}: te faltan ${faltan} ${faltan === 1 ? 'moneda' : 'monedas'}`
              : `Comprar ${articulo.nameEs} por ${articulo.price} ${articulo.price === 1 ? 'moneda' : 'monedas'}`
          }
        >
          {comprando ? 'Comprando…' : consumible && cantidad > 0 ? 'Otro' : 'Comprar'}
        </Boton>
      )}
    </article>
  );
}

/**
 * La pestaña de tus cosas: lo que tienes y qué llevas puesto.
 *
 * La mascota que llevas se añade a la lista aunque el servidor no la devuelva
 * entre los artículos comprados. La de serie no se compró nunca, y sin esto la
 * pantalla diría «no tienes nada» a alguien que está mirando a Milo.
 */
function TusCosas({
  cartera,
  cargando,
  error,
  articulos,
  equipar,
  equipando,
  errorEquipar,
  irALaTienda,
}: {
  cartera: Cartera | undefined;
  cargando: boolean;
  error: string | null;
  articulos: ArticuloTienda[];
  equipar: (cambio: { mascota?: string; atuendo?: string | null }) => void;
  equipando: boolean;
  errorEquipar: string | null;
  irALaTienda: () => void;
}) {
  /** El catálogo pone los nombres; sin él, al menos el código y un emoji neutro. */
  function describir(code: string, kind: TipoArticulo): ArticuloTienda {
    return (
      articulos.find((articulo) => articulo.code === code) ?? {
        code,
        kind,
        nameEs: code,
        descriptionEs: '',
        price: 0,
        emoji: kind === 'mascota' ? '🐦' : kind === 'atuendo' ? '🎒' : '✨',
      }
    );
  }

  if (cargando) {
    return <p className="mt-10 text-center text-[var(--texto-suave)]">Cargando tus cosas…</p>;
  }

  if (error !== null || !cartera) {
    return (
      <div className="mt-8">
        <MascotaConMensaje estado="pensando" mensaje={error ?? 'No pudimos leer tus cosas.'} />
      </div>
    );
  }

  const tuyos = cartera.items.filter((item) => item.quantity > 0);
  const mascotas = tuyos.filter((item) => item.kind === 'mascota').map((item) => item.code);
  if (!mascotas.includes(cartera.equipped.mascota)) mascotas.unshift(cartera.equipped.mascota);
  const atuendos = tuyos.filter((item) => item.kind === 'atuendo').map((item) => item.code);
  const poderes = tuyos.filter((item) => item.kind === 'poder');

  // Solo la mascota de serie y nada más: no hay nada que elegir, así que en vez
  // de enseñar tres listas vacías se dice en una frase y se manda a la tienda.
  const soloLoDeSerie = mascotas.length <= 1 && atuendos.length === 0 && poderes.length === 0;

  if (soloLoDeSerie) {
    return (
      <div className="mt-8">
        <MascotaConMensaje
          estado="animando"
          mensaje="De momento llevas a Milo tal como vino. Con las monedas que ganas practicando puedes comprarle atuendos, mascotas nuevas y poderes."
        />
        <Boton className="mt-4 min-h-12" onClick={irALaTienda}>
          Ver la tienda
        </Boton>
      </div>
    );
  }

  return (
    <div>
      {errorEquipar !== null && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border-2 border-b-4 border-red-800 bg-red-600 px-4 py-3 text-sm font-bold text-white"
        >
          {errorEquipar}
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
          Poderes
        </h2>
        {poderes.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--texto-suave)]">
            No tienes poderes guardados. Están en la tienda.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {poderes.map((item, indice) => {
              const poder = describir(item.code, 'poder');
              return (
                <div
                  key={item.code}
                  className="flex animate-entrada items-center gap-3 rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-3"
                  style={{ animationDelay: `${indice * 70}ms`, animationFillMode: 'backwards' }}
                >
                  <span aria-hidden className="text-2xl">
                    {poder.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-tight">{poder.nameEs}</p>
                    {poder.descriptionEs !== '' && (
                      <p className="text-sm text-[var(--texto-suave)]">{poder.descriptionEs}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--fondo)] px-2.5 py-1 text-xs font-bold tabular-nums">
                    ×{item.quantity}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
          Mascotas
        </h2>
        <p className="mt-1 text-sm text-[var(--texto-suave)]">Elige a quién llevas contigo.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {mascotas.map((code, indice) => {
            const mascota = describir(code, 'mascota');
            const puesta = cartera.equipped.mascota === code;
            return (
              <Opcion
                key={code}
                emoji={mascota.emoji}
                nombre={mascota.nameEs}
                puesta={puesta}
                deshabilitada={equipando}
                retraso={indice * 70}
                etiqueta={
                  puesta ? `${mascota.nameEs}, es la que llevas` : `Llevar ${mascota.nameEs}`
                }
                alPulsar={() => equipar({ mascota: code })}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
          Atuendos
        </h2>
        {atuendos.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--texto-suave)]">
            Todavía no tienes atuendos. Están en la tienda.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {/*
              Quitarse el atuendo es una opción más y no un botón aparte: si
              vestirse se hace eligiendo, desvestirse también.
            */}
            <Opcion
              emoji="🚫"
              nombre="Sin atuendo"
              puesta={cartera.equipped.atuendo === null}
              deshabilitada={equipando}
              retraso={0}
              etiqueta={
                cartera.equipped.atuendo === null
                  ? 'Sin atuendo, es lo que llevas'
                  : 'Quitar el atuendo'
              }
              alPulsar={() => equipar({ atuendo: null })}
            />
            {atuendos.map((code, indice) => {
              const atuendo = describir(code, 'atuendo');
              const puesta = cartera.equipped.atuendo === code;
              return (
                <Opcion
                  key={code}
                  emoji={atuendo.emoji}
                  nombre={atuendo.nameEs}
                  puesta={puesta}
                  deshabilitada={equipando}
                  retraso={(indice + 1) * 70}
                  etiqueta={
                    puesta ? `${atuendo.nameEs}, es lo que llevas` : `Ponerle ${atuendo.nameEs}`
                  }
                  alPulsar={() => equipar({ atuendo: code })}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Una cosa que se puede llevar puesta.
 *
 * Lo elegido se marca de tres maneras: `aria-pressed`, el borde de marca y la
 * palabra «Puesto» escrita debajo. El color solo no vale, porque el borde de
 * marca y el gris se parecen bastante para quien no los distingue.
 */
function Opcion({
  emoji,
  nombre,
  puesta,
  deshabilitada,
  retraso,
  etiqueta,
  alPulsar,
}: {
  emoji: string;
  nombre: string;
  puesta: boolean;
  deshabilitada: boolean;
  retraso: number;
  etiqueta: string;
  alPulsar: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={puesta}
      aria-label={etiqueta}
      disabled={deshabilitada}
      onClick={alPulsar}
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
      className={cn(
        'flex min-h-12 animate-entrada flex-col items-center gap-1 rounded-2xl border-2 border-b-4 bg-[var(--superficie)] p-3 text-center transition disabled:opacity-60',
        puesta ? 'border-marca-600 bg-marca-50 dark:bg-marca-600/20' : 'border-[var(--borde)]',
        !deshabilitada && !puesta && 'hover:border-marca-400',
      )}
    >
      <span aria-hidden className="text-3xl leading-none">
        {emoji}
      </span>
      <span className="text-xs font-bold leading-tight">{nombre}</span>
      <span
        className={cn(
          'text-[0.65rem] font-bold uppercase tracking-wide',
          puesta ? 'text-marca-700 dark:text-marca-300' : 'text-transparent',
        )}
        aria-hidden={!puesta}
      >
        {puesta ? 'Puesto' : '·'}
      </span>
    </button>
  );
}
