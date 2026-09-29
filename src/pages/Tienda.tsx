import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useContador } from '@/lib/contador';
import { Escaparate } from '@/components/Escaparate';
import { Mascota } from '@/components/Mascota';
import type { Atuendo, Especie } from '@/components/mascotas';
import { Boton } from '@/components/Boton';
import { MascotaConMensaje } from '@/components/Mascota';
import { Cofre, type CofreDelDia } from '@/components/Cofre';
import { Mosaico, type Temporada } from '@/components/Mosaico';

type TipoArticulo = 'mascota' | 'atuendo' | 'poder';
type OrigenArticulo = 'tienda' | 'temporada';

interface ArticuloTienda {
  code: string;
  kind: TipoArticulo;
  nameEs: string;
  descriptionEs: string;
  price: number;
  emoji: string;
  /**
   * De dónde sale. Puede faltar: el servidor y el navegador se despliegan por
   * separado, así que una versión vieja de la API manda el catálogo sin este
   * campo. Sin valor se trata como de la tienda, que es lo que era todo antes.
   */
  origen?: OrigenArticulo;
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

interface Protectores {
  equipados: number;
  maximo: number;
}

interface Cartera {
  coins: number;
  items: ArticuloEnCartera[];
  equipped: Equipado;
  protectores?: Protectores;
}

interface FranjaPosible {
  code: string;
  nombreEs: string;
  cuandoEs: string;
  desde: number;
  hasta: number;
}

interface Recompensas {
  zona: string;
  dia: string;
  minutos: number;
  franjas: [string, string];
  franjasNuevas: [string, string] | null;
  cofres: CofreDelDia[];
  temporada: Temporada | null;
  franjasPosibles: FranjaPosible[];
}

interface CofreAbierto {
  franja: string;
  monedas: number;
  piezas: number;
  saldo: number;
  premios: Array<{ itemCode: string; nameEs: string; coins: number }>;
}

const CLAVE_CARTERA = ['cartera'] as const;
const CLAVE_RECOMPENSAS = ['tienda', 'recompensas'] as const;

const PESTANAS = [
  { id: 'tienda', titulo: 'Tienda' },
  { id: 'cosas', titulo: 'Tus cosas' },
] as const;

type Pestana = (typeof PESTANAS)[number]['id'];

/** El código del protector de racha, que es el único artículo con techo. */
const PROTECTOR = 'POWER_FREEZE';

/**
 * El orden de los grupos no es alfabético ni casual.
 *
 * Los poderes van primero porque son lo único que cambia cómo se estudia: un
 * protector de racha se compra para poder seguir practicando. Las mascotas y
 * los atuendos son adorno, y el adorno se mira después.
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

/** Lo que se vende. Lo que se gana en el festival no se vende, y no se mezcla. */
function seVende(articulo: ArticuloTienda): boolean {
  return (articulo.origen ?? 'tienda') === 'tienda';
}

/**
 * Convierte un fallo de la API en algo que se pueda hacer.
 *
 * El 404 tiene texto propio porque es lo que contesta un endpoint que todavía
 * no existe en el servidor desplegado, y mandar a alguien a mirarse el wifi
 * cuando lo que pasa es eso le hace perder el rato buscando un fallo suyo.
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
        const faltanMonedas = articulo.price - monedas;
        if (faltanMonedas <= 0) {
          return 'Tus monedas habían cambiado y ya no alcanzan. Mira el saldo de arriba, está al día.';
        }
        return `Te faltan ${faltanMonedas} ${faltanMonedas === 1 ? 'moneda' : 'monedas'}. Termina una lección y vuelve.`;
      }
      case 'SHOP-003':
        return 'Ya lo tienes. No hace falta comprarlo otra vez.';
      case 'SHOP-001':
        return 'Este artículo ya no está en la tienda. Recarga para ver el catálogo al día.';
      case 'SHOP-005':
        return 'Ya llevas todos los protectores que caben. Gasta alguno y vuelve.';
      case 'SHOP-011':
        return 'Esto no se compra: se gana juntando las piezas del festival.';
      default:
        return explicarFallo(error, 'Comprar');
    }
  }
  return explicarFallo(error, 'Comprar');
}

/**
 * Qué decirle a quien pulsó un cofre y no se abrió.
 *
 * Los tres motivos que puede haber son tres cosas distintas que hacer, y por eso
 * no comparten mensaje: a uno le falta practicar, a otro le falta esperar y al
 * tercero no le falta nada porque ya lo cogió.
 */
function explicarCofre(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'SHOP-008':
        return 'Todavía no has practicado en esta franja. Haz una lección o una partida y vuelve.';
      case 'SHOP-007':
        return 'Este cofre no está en su hora. Mira cuánto falta aquí arriba.';
      case 'SHOP-009':
        return 'Este ya lo abriste hoy. Mañana hay otro.';
      case 'SHOP-006':
        return 'Ese cofre no es de los tuyos. Recarga la pantalla.';
      default:
        return explicarFallo(error, 'Abrir el cofre');
    }
  }
  return explicarFallo(error, 'Abrir el cofre');
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
 * ponérselo, y se decide qué ponerse mirando lo que falta por comprar.
 *
 * EL ORDEN DE LA PANTALLA, que es lo que se rehízo
 *
 * Arriba el saldo, porque es lo primero que se mira al entrar y lo primero que
 * se comprueba después de gastar. Debajo, y por delante de todo lo que se
 * vende, lo que CADUCA: los dos cofres de hoy y el festival de temporada. Esa
 * es la diferencia entre una tienda y una pantalla de recompensas — lo que se
 * vende sigue ahí mañana, el cofre de esta tarde no— y ponerlo al revés
 * obligaba a bajar por delante de diez artículos para ver si había algo que
 * recoger.
 *
 * Son tres consultas distintas a propósito. Si el catálogo se cae, las monedas
 * y los cofres siguen viéndose; si los cofres se caen —o el servidor todavía no
 * los tiene desplegados— la tienda entera sigue funcionando como siempre.
 */
export function Tienda() {
  const navegar = useNavigate();
  const clienteConsultas = useQueryClient();
  const [pestana, setPestana] = useState<Pestana>('tienda');
  const [recienComprado, setRecienComprado] = useState<string | null>(null);
  const [recienAbierto, setRecienAbierto] = useState<CofreAbierto | null>(null);
  const [eligiendoHoras, setEligiendoHoras] = useState(false);
  /*
    Lo que se está probando en el escaparate.

    Es aparte de lo que se lleva puesto: aquí se mira sin comprometerse, como
    quien se prueba algo delante del espejo. Al entrar se enseña lo puesto, que
    es el punto de partida honesto.
  */
  const [probando, setProbando] = useState<{ especie?: Especie; atuendo?: Atuendo | null }>({});

  const catalogo = useQuery({
    queryKey: ['tienda', 'catalogo'],
    queryFn: () => api.get<{ items: ArticuloTienda[] }>('/shop/catalog'),
  });

  const cartera = useQuery({
    queryKey: CLAVE_CARTERA,
    queryFn: () => api.get<Cartera>('/me/wallet'),
  });

  const recompensas = useQuery({
    queryKey: CLAVE_RECOMPENSAS,
    queryFn: () => api.get<Recompensas>('/shop/rewards'),
    // Un cofre cambia de estado al pasar la hora, así que los datos se quedan
    // viejos solos. Se vuelven a pedir al volver a la pestaña del navegador,
    // que es cuando alguien mira si ya toca.
    refetchOnWindowFocus: true,
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

  const abrirCofre = useMutation({
    mutationFn: (franja: string) => api.post<CofreAbierto>(`/shop/chests/${franja}/open`, {}),
    onSuccess: (abierto) => {
      setRecienAbierto(abierto);
      // Las dos cambian: el saldo y las piezas están en consultas distintas.
      void clienteConsultas.invalidateQueries({ queryKey: CLAVE_CARTERA });
      void clienteConsultas.invalidateQueries({ queryKey: CLAVE_RECOMPENSAS });
    },
    onError: () => {
      // Sea cual sea el motivo, lo que se veía estaba viejo: o pasó la hora, o
      // ya se abrió en otro sitio. Se vuelve a preguntar.
      void clienteConsultas.invalidateQueries({ queryKey: CLAVE_RECOMPENSAS });
    },
  });

  const cambiarFranjas = useMutation({
    mutationFn: (franjas: [string, string]) => api.put<Recompensas>('/shop/chests', { franjas }),
    onSuccess: (nuevas) => {
      clienteConsultas.setQueryData(CLAVE_RECOMPENSAS, nuevas);
      setEligiendoHoras(false);
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

  /**
   * Qué enseña el escaparate ahora mismo.
   *
   * Por defecto, lo que se lleva puesto. Si se está probando algo, eso. Y el
   * pie explica en palabras lo que la figura ya enseña, que hace falta para
   * quien no ve la pantalla.
   */
  const enEscaparate = useMemo(() => {
    const puesta = (cartera.data?.equipped.mascota ?? 'PET_MILO') as Especie;
    const ropaPuesta = (cartera.data?.equipped.atuendo ?? null) as Atuendo | null;

    const especie = probando.especie ?? puesta;
    const atuendo = probando.atuendo !== undefined ? probando.atuendo : ropaPuesta;

    const cambiado = especie !== puesta || atuendo !== ropaPuesta;
    return {
      especie,
      atuendo,
      cambiado,
      pie: cambiado
        ? 'Lo estás probando. Se queda si lo compras y te lo pones.'
        : 'Lo que llevas ahora',
    };
  }, [cartera.data, probando]);

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
   * Solo lo que se vende: los disfraces del festival llegan en el mismo catálogo
   * —hacen falta para ponerles nombre en «Tus cosas»— pero aquí no pintan nada.
   * Enseñarlos con un botón de comprar sería prometer algo que el servidor
   * rechaza, y enseñarlos sin botón, en la sección de comprar, sería un
   * escaparate con cosas que no están a la venta.
   *
   * El escalonado cuenta seguido entre grupos y no se reinicia en cada uno: así
   * la pantalla entra como una sola lista y no como tres bloques a la vez.
   */
  const grupos = useMemo(() => {
    let orden = 0;
    return GRUPOS.map((grupo) => ({
      ...grupo,
      articulos: articulos
        .filter((articulo) => articulo.kind === grupo.kind && seVende(articulo))
        .map((articulo) => ({ articulo, retraso: orden++ * 70 })),
    })).filter((grupo) => grupo.articulos.length > 0);
  }, [articulos]);

  const comprado = recienComprado
    ? articulos.find((articulo) => articulo.code === recienComprado)
    : undefined;

  const protectores = cartera.data?.protectores ?? null;

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
            Lo que caduca, antes que lo que se vende. Un cofre de esta tarde
            deja de existir esta noche; una gorra de 120 monedas sigue ahí la
            semana que viene.
          */}
          {recompensas.data && (
            <>
              <CofresDeHoy
                recompensas={recompensas.data}
                abriendo={abrirCofre.isPending ? (abrirCofre.variables ?? null) : null}
                errorEn={
                  abrirCofre.isError && typeof abrirCofre.variables === 'string'
                    ? { franja: abrirCofre.variables, mensaje: explicarCofre(abrirCofre.error) }
                    : null
                }
                abierto={recienAbierto}
                alAbrir={(franja) => abrirCofre.mutate(franja)}
                eligiendo={eligiendoHoras}
                alElegir={() => setEligiendoHoras((antes) => !antes)}
                alGuardar={(franjas) => cambiarFranjas.mutate(franjas)}
                guardando={cambiarFranjas.isPending}
                errorGuardar={
                  cambiarFranjas.isError
                    ? explicarFallo(cambiarFranjas.error, 'Cambiar tus horas')
                    : null
                }
              />

              {recompensas.data.temporada && <Mosaico temporada={recompensas.data.temporada} />}
            </>
          )}

          {/*
            El escaparate. Antes aquí solo había un emoji por artículo, y comprar
            un animal era comprar a ciegas: el emoji del sistema no se parece en
            nada al que luego acompaña en la aplicación.
          */}
          <div className="mt-6">
            <Escaparate
              especie={enEscaparate.especie}
              atuendo={enEscaparate.atuendo}
              pie={enEscaparate.pie}
            />

            {enEscaparate.cambiado && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProbando((antes) => ({ ...antes, atuendo: null }))}
                  className="min-h-12 rounded-xl border border-[var(--borde)] text-sm font-bold hover:border-marca-400"
                >
                  Sin ropa
                </button>
                <button
                  type="button"
                  onClick={() => setProbando({})}
                  className="min-h-12 rounded-xl border border-[var(--borde)] text-sm font-bold hover:border-marca-400"
                >
                  Volver a lo mío
                </button>
              </div>
            )}
          </div>

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
                    contador={articulo.code === PROTECTOR ? protectores : null}
                    error={
                      comprar.isError && comprar.variables === articulo.code
                        ? explicarCompra(comprar.error, articulo, monedas)
                        : null
                    }
                    especieBase={enEscaparate.especie}
                    alProbar={
                      // Los poderes no se ven: un protector no tiene aspecto.
                      articulo.kind === 'mascota'
                        ? () => setProbando({ especie: articulo.code as Especie })
                        : articulo.kind === 'atuendo'
                          ? () =>
                              setProbando((antes) => ({
                                ...antes,
                                atuendo: articulo.code as Atuendo,
                              }))
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
          <div className="mt-4">
            <Escaparate
              especie={enEscaparate.especie}
              atuendo={enEscaparate.atuendo}
              pie={enEscaparate.pie}
            />
          </div>

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
 * Los dos cofres de hoy, con el aviso de lo que salió del último.
 *
 * El bloque de elegir horas está PLEGADO de serie y no siempre a la vista. La
 * mayoría de la gente no lo va a tocar nunca —las dos franjas de serie son las
 * que quiere casi todo el mundo— y desplegado ocupaba media pantalla por
 * delante de los dos cofres, que es lo que se viene a ver.
 */
function CofresDeHoy({
  recompensas,
  abriendo,
  errorEn,
  abierto,
  alAbrir,
  eligiendo,
  alElegir,
  alGuardar,
  guardando,
  errorGuardar,
}: {
  recompensas: Recompensas;
  abriendo: string | null;
  errorEn: { franja: string; mensaje: string } | null;
  abierto: CofreAbierto | null;
  alAbrir: (franja: string) => void;
  eligiendo: boolean;
  alElegir: () => void;
  alGuardar: (franjas: [string, string]) => void;
  guardando: boolean;
  errorGuardar: string | null;
}) {
  return (
    <section className="mt-6" aria-labelledby="titulo-cofres">
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="titulo-cofres"
          className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]"
        >
          Tus cofres de hoy
        </h2>
        <button
          type="button"
          onClick={alElegir}
          aria-expanded={eligiendo}
          className="min-h-12 rounded-xl px-3 text-sm font-bold text-marca-700 hover:bg-[var(--superficie)] dark:text-marca-300"
        >
          {eligiendo ? 'Cerrar' : 'Cambiar mis horas'}
        </button>
      </div>

      {/*
        Lo que salió del cofre. Va antes de las tarjetas porque después de
        abrirlo el cofre se queda apagado y con un «Hecho», y sin esta línea no
        habría manera de saber cuánto cayó.
      */}
      {abierto && (
        <p
          role="status"
          className="mt-2 animate-crecer rounded-2xl border-2 border-b-4 border-emerald-900 bg-emerald-800 px-4 py-3 text-sm font-bold text-white"
        >
          <span aria-hidden>🎁 </span>
          Cofre abierto: {abierto.monedas} {abierto.monedas === 1 ? 'moneda' : 'monedas'}
          {abierto.piezas > 0 &&
            ` y ${abierto.piezas} ${abierto.piezas === 1 ? 'pieza del festival' : 'piezas del festival'}`}
          .
          {abierto.premios.map((premio) => (
            <span key={premio.itemCode} className="mt-1 block">
              ¡Desbloqueaste {premio.nameEs}!
              {premio.coins > 0 && ` Y ${premio.coins} monedas de regalo.`}
            </span>
          ))}
        </p>
      )}

      {/*
        Lo que pasó al guardar un cambio de horas.

        Va FUERA del panel de elegir, que se cierra al guardar, y esto no es un
        detalle: sin esta línea, guardar hacía desaparecer el panel y no dejaba
        ni rastro, así que lo único que se veía era que los cofres de hoy seguían
        exactamente igual. Es decir, se veía como si no hubiera funcionado.
      */}
      {recompensas.franjasNuevas && !eligiendo && (
        <p className="mt-2 rounded-xl bg-[var(--superficie)] px-3 py-2 text-xs font-semibold text-[var(--texto-suave)]">
          Desde mañana tus cofres serán{' '}
          {recompensas.franjasNuevas
            .map(
              (code) =>
                recompensas.franjasPosibles.find((franja) => franja.code === code)?.nombreEs ??
                code,
            )
            .join(' y ')}
          . Los de hoy siguen en sus horas.
        </p>
      )}

      {eligiendo && (
        <ElegirHoras
          posibles={recompensas.franjasPosibles}
          actuales={recompensas.franjasNuevas ?? recompensas.franjas}
          pendientes={recompensas.franjasNuevas !== null}
          guardando={guardando}
          error={errorGuardar}
          alGuardar={alGuardar}
        />
      )}

      <div className="mt-3 grid gap-3">
        {recompensas.cofres.map((cofre, indice) => (
          <Cofre
            key={cofre.franja}
            cofre={cofre}
            abriendo={abriendo === cofre.franja}
            error={errorEn?.franja === cofre.franja ? errorEn.mensaje : null}
            alAbrir={() => alAbrir(cofre.franja)}
            retraso={indice * 70}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Elegir en qué dos franjas se quieren los cofres.
 *
 * ESTO ES LO QUE HACE QUE UN COFRE CON HORARIO NO CASTIGUE A NADIE.
 *
 * En las capturas, los dos cofres son «antes de las doce» y «de seis a
 * medianoche», y eso premia estudiar a ciertas horas: a quien solo puede a las
 * dos de la tarde le sobra la mitad del sistema. Aquí las cuatro franjas cubren
 * el día entero y se eligen las dos que uno quiera, así que el cofre pasa de
 * premiar «la hora buena» a premiar TU hora, que además es lo único que fija
 * una costumbre de verdad.
 *
 * Se eligen exactamente dos. Al marcar una tercera se suelta la más antigua, en
 * vez de apagar el botón y obligar a desmarcar primero: es un gesto menos y no
 * deja a nadie preguntándose por qué no pasa nada al pulsar.
 */
function ElegirHoras({
  posibles,
  actuales,
  pendientes,
  guardando,
  error,
  alGuardar,
}: {
  posibles: FranjaPosible[];
  actuales: [string, string];
  pendientes: boolean;
  guardando: boolean;
  error: string | null;
  alGuardar: (franjas: [string, string]) => void;
}) {
  const [elegidas, setElegidas] = useState<string[]>([actuales[0], actuales[1]]);

  function alternar(code: string) {
    setElegidas((antes) => {
      if (antes.includes(code)) return antes.filter((otra) => otra !== code);
      // La más antigua sale para dejar sitio a la nueva.
      return [...antes, code].slice(-2);
    });
  }

  const listas = elegidas.length === 2;
  const cambiado = listas && (elegidas[0] !== actuales[0] || elegidas[1] !== actuales[1]);

  return (
    <div className="mt-3 animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-4">
      <p className="text-sm font-bold">Elige tus dos franjas</p>
      <p className="mt-0.5 text-sm text-[var(--texto-suave)]">
        Cualquier hora del día vale. El cofre premia que practiques a tu hora, no a una hora
        concreta.
      </p>

      <div
        role="group"
        aria-label="Las dos franjas en las que quieres tus cofres"
        className="mt-3 grid gap-2"
      >
        {posibles.map((franja) => {
          const puesta = elegidas.includes(franja.code);
          return (
            <button
              key={franja.code}
              type="button"
              aria-pressed={puesta}
              onClick={() => alternar(franja.code)}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-xl border-2 p-3 text-left transition',
                puesta
                  ? 'border-marca-600 bg-marca-50 dark:bg-marca-600/20'
                  : 'border-[var(--borde)] hover:border-marca-400',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-md border-2 text-xs font-bold',
                  puesta ? 'border-marca-600 bg-marca-600 text-white' : 'border-[var(--hueco)]',
                )}
              >
                {puesta ? '✓' : ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-tight">{franja.nombreEs}</span>
                <span className="block text-xs text-[var(--texto-suave)]">{franja.cuandoEs}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/*
        El aviso de que el cambio es para mañana va ANTES del botón, no después
        de pulsarlo. Enterarse de que lo que acabas de guardar no vale hoy, una
        vez guardado, es la manera de que parezca que la aplicación falló.
      */}
      <p className="mt-3 text-xs text-[var(--texto-suave)]">
        El cambio empieza mañana. Los cofres de hoy siguen en sus horas de siempre, para que mover
        la ventana no sirva para pillar un cofre a última hora.
      </p>

      {pendientes && (
        <p className="mt-2 text-xs font-semibold text-[var(--texto-suave)]">
          Ya tienes un cambio guardado esperando a mañana.
        </p>
      )}

      {/*
        Por qué no se puede guardar todavía.

        Salió probando la pantalla solo con el teclado: al desmarcar una franja
        el botón se apagaba y no había nada que dijera por qué. Un botón apagado
        sin explicación se lee como que la aplicación se ha roto, y con el
        teclado ni siquiera se puede enfocar para preguntarle.
      */}
      {!listas && (
        <p className="mt-2 text-xs font-semibold text-[var(--texto-suave)]">
          Elige dos franjas para poder guardar. Llevas {elegidas.length}.
        </p>
      )}

      {error !== null && (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <Boton
        className="mt-3 min-h-12"
        disabled={!listas || !cambiado || guardando}
        onClick={() => listas && alGuardar([elegidas[0]!, elegidas[1]!])}
      >
        {guardando ? 'Guardando…' : 'Guardar para mañana'}
      </Boton>
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
  contador,
  error,
  alComprar,
  alProbar,
  especieBase,
}: {
  articulo: ArticuloTienda;
  cantidad: number;
  monedas: number;
  retraso: number;
  recienComprado: boolean;
  comprando: boolean;
  /** Solo el protector de racha lo trae: cuántos llevas puestos y cuántos caben. */
  contador: Protectores | null;
  error: string | null;
  /** Enseñarlo en el escaparate sin comprarlo. Nulo para lo que no se ve. */
  alProbar: (() => void) | null;
  /** Sobre quién se enseña la ropa: la que se lleva puesta. */
  especieBase: Especie;
  alComprar: () => void;
}) {
  const consumible = esConsumible(articulo.kind);
  const yaEsTuyo = cantidad > 0 && !consumible;
  const faltanMonedas = articulo.price - monedas;
  const sinSaldo = faltanMonedas > 0;
  const lleno = contador !== null && contador.equipados >= contador.maximo;

  return (
    /*
      EL ANCHO DE 320 px ES LO QUE MANDA EN ESTA TARJETA.

      Antes iban en una sola fila la miniatura, el texto y el botón. A 390 px
      cuadraba; a 320 el botón se quedaba con noventa píxeles y a la descripción
      le sobraban dos palabras por línea: «Un búho / para quien / estudia de /
      noche.» Cuatro renglones para seis palabras, y multiplicado por diez
      artículos.

      El botón baja a su propia fila con el ancho entero, y desde 640 px vuelve
      al lado. El texto recupera los 320 px enteros y el botón pasa a ser el
      blanco más fácil de acertar con el pulgar de toda la pantalla.
    */
    <article
      className={cn(
        'animate-entrada rounded-2xl border-2 border-b-4 bg-[var(--superficie)] p-4 sm:flex sm:items-start sm:gap-3',
        yaEsTuyo ? 'border-marca-600' : 'border-[var(--borde)]',
        recienComprado && 'animate-crecer',
      )}
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-start gap-3 sm:contents">
        {/*
        La miniatura es el animal de verdad, no el emoji del sistema.
        Un 🦊 no se parece en nada al zorro que luego acompaña en la aplicación,
        y comprarlo por el emoji es comprar otra cosa. La ropa se enseña puesta
        sobre la mascota que se lleva, que es cómo se va a ver.
      */}
        {alProbar ? (
          <button
            type="button"
            onClick={alProbar}
            aria-label={`Ver cómo queda ${articulo.nameEs}`}
            className="grid size-14 shrink-0 place-items-center rounded-xl transition hover:bg-[var(--fondo)]"
          >
            {articulo.kind === 'mascota' ? (
              <Mascota especie={articulo.code as Especie} atuendo={null} tamano={52} />
            ) : (
              <Mascota especie={especieBase} atuendo={articulo.code as Atuendo} tamano={52} />
            )}
          </button>
        ) : (
          <span
            aria-hidden
            className="grid size-14 shrink-0 place-items-center text-4xl leading-none"
          >
            {articulo.emoji}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{articulo.nameEs}</h3>
          <p className="mt-0.5 text-sm text-[var(--texto-suave)]">{articulo.descriptionEs}</p>

          {/*
          El contador del protector: «3 / 4 equipados».

          Es lo que convierte «tienes 3» en información: sin el techo al lado,
          un número suelto no dice si conviene comprar otro. Y va en palabras
          además de en cifras porque la barra de color sola no la lee nadie con
          un lector de pantalla.
        */}
          {contador !== null ? (
            <div className="mt-2">
              <p className="text-xs font-bold tabular-nums">
                {contador.equipados} / {contador.maximo} equipados
              </p>
              <div
                className="mt-1 flex gap-1"
                role="img"
                aria-label={`${contador.equipados} de ${contador.maximo} protectores equipados`}
              >
                {Array.from({ length: contador.maximo }, (_, indice) => (
                  <span
                    key={indice}
                    className={cn(
                      'h-2 flex-1 rounded-full',
                      indice < contador.equipados ? 'bg-marca-600' : 'bg-[var(--hueco)]',
                    )}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-[var(--texto-suave)]">
                {lleno
                  ? 'Están todos puestos. Se gastan solos el día que faltes.'
                  : 'Se ponen solos el día que faltes, sin que tengas que acordarte.'}
              </p>
            </div>
          ) : (
            consumible &&
            cantidad > 0 && (
              <p className="mt-1 text-xs font-semibold text-[var(--texto-suave)]">
                Tienes {cantidad}
              </p>
            )
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
                  Te faltan {faltanMonedas} {faltanMonedas === 1 ? 'moneda' : 'monedas'}
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
      </div>

      {!yaEsTuyo && (
        <Boton
          className="mt-3 min-h-12 shrink-0 sm:mt-0 sm:w-auto sm:self-center"
          disabled={sinSaldo || comprando || lleno}
          onClick={alComprar}
          aria-label={
            lleno
              ? `Comprar ${articulo.nameEs}: ya llevas los ${contador?.maximo} que caben`
              : sinSaldo
                ? `Comprar ${articulo.nameEs}: te faltan ${faltanMonedas} ${faltanMonedas === 1 ? 'moneda' : 'monedas'}`
                : `Comprar ${articulo.nameEs} por ${articulo.price} ${articulo.price === 1 ? 'moneda' : 'monedas'}`
          }
        >
          {comprando
            ? 'Comprando…'
            : lleno
              ? 'Al tope'
              : consumible && cantidad > 0
                ? 'Otro'
                : 'Comprar'}
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
          mensaje="De momento llevas a Milo tal como vino. Con las monedas que ganas practicando puedes comprarle atuendos, mascotas nuevas y protectores de racha; y los disfraces del festival se ganan abriendo cofres."
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
              const techo = item.code === PROTECTOR ? cartera.protectores : undefined;
              return (
                /*
                  La cuenta baja a su propia línea y no va al lado del texto.

                  «3/4 equipados» es una etiqueta larga, y puesta a la derecha
                  le dejaba a la descripción unos 150 px de los 320: seis
                  renglones de tres palabras. Debajo ocupa una línea y el texto
                  recupera el ancho entero.
                */
                <div
                  key={item.code}
                  className="animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-3"
                  style={{ animationDelay: `${indice * 70}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="text-2xl leading-none">
                      {poder.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-tight">{poder.nameEs}</p>
                      {poder.descriptionEs !== '' && (
                        <p className="text-sm text-[var(--texto-suave)]">{poder.descriptionEs}</p>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 inline-flex rounded-full bg-[var(--fondo)] px-2.5 py-1 text-xs font-bold tabular-nums">
                    {techo ? `${techo.equipados}/${techo.maximo} equipados` : `×${item.quantity}`}
                  </p>
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
            Todavía no tienes atuendos. Se compran en la tienda o se ganan en el festival.
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
              const delFestival = !seVende(atuendo);
              return (
                <Opcion
                  key={code}
                  emoji={atuendo.emoji}
                  nombre={atuendo.nameEs}
                  puesta={puesta}
                  deshabilitada={equipando}
                  retraso={(indice + 1) * 70}
                  // Lo ganado se distingue de lo comprado. No es decoración:
                  // es la diferencia entre algo que costó monedas y algo que
                  // costó doce días de práctica, y conviene que se note.
                  ganado={delFestival}
                  etiqueta={
                    puesta
                      ? `${atuendo.nameEs}, es lo que llevas`
                      : `Ponerle ${atuendo.nameEs}${delFestival ? ', del festival' : ''}`
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
  ganado,
  alPulsar,
}: {
  emoji: string;
  nombre: string;
  puesta: boolean;
  deshabilitada: boolean;
  retraso: number;
  etiqueta: string;
  ganado?: boolean;
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
        'relative flex min-h-12 animate-entrada flex-col items-center gap-1 rounded-2xl border-2 border-b-4 bg-[var(--superficie)] p-3 text-center transition disabled:opacity-60',
        puesta ? 'border-marca-600 bg-marca-50 dark:bg-marca-600/20' : 'border-[var(--borde)]',
        !deshabilitada && !puesta && 'hover:border-marca-400',
      )}
    >
      {ganado && (
        <span
          aria-hidden
          className="absolute right-1 top-1 rounded-full bg-acento-500 px-1.5 text-[0.6rem] font-extrabold text-white"
        >
          Festival
        </span>
      )}
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
