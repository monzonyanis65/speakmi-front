import { useNavigate } from 'react-router-dom';
import { salir } from '@/lib/auth';
import { useSesion } from '@/store/sesion';
import { MascotaConMensaje } from '@/components/Mascota';

interface Entrada {
  icono: string;
  titulo: string;
  descripcion: string;
  a: string;
}

interface Grupo {
  titulo: string;
  entradas: Entrada[];
}

/*
  QUÉ QUEDA AQUÍ DESDE QUE HAY BARRA ABAJO, Y QUÉ SE FUE

  Esta pantalla era el índice de la aplicación: nueve entradas, y cuatro de
  ellas —juegos, liga, perfil y tienda— eran los sitios a los que más se entra.
  Llegar a lo que más se usa escondiéndolo detrás de una hamburguesa era el
  problema que vino a resolver la barra de abajo, así que esas cuatro ya no
  están aquí: están a un dedo, abajo, en todas las pantallas.

  Lo que no cabía en cinco botones sí sigue aquí, y por eso este menú no se
  borra. Son dos cosas distintas y van en dos grupos distintos:

  - Lo que se HACE y no tiene sitio propio en la barra: textos, desafíos y
    novedades. Se entra de vez en cuando, no todos los días.
  - La CUENTA: ajustes y seguridad. Se entra una vez al mes o una vez al año.

  El orden es ese y no el contrario porque lo que se hace se busca más que lo
  que se configura.
*/
const GRUPOS: Grupo[] = [
  {
    titulo: 'Más cosas que hacer',
    entradas: [
      {
        icono: '📖',
        titulo: 'Tus textos',
        descripcion: 'Trae un artículo tuyo y léelo tocando lo que no conozcas',
        a: '/lecturas',
      },
      {
        icono: '⚔️',
        titulo: 'Desafíos',
        descripcion: 'Los tres de hoy, el del mes y cuánto te falta para cada uno',
        a: '/misiones',
      },
      {
        icono: '📣',
        titulo: 'Novedades',
        descripcion: 'Lo que habéis hecho tú y tu gente estos días',
        a: '/novedades',
      },
    ],
  },
  {
    titulo: 'Tu cuenta',
    entradas: [
      {
        icono: '⚙️',
        titulo: 'Ajustes',
        descripcion: 'Voz, tema y recordatorios',
        a: '/ajustes',
      },
      {
        icono: '🔒',
        titulo: 'Seguridad',
        descripcion: 'Contraseña y sesiones abiertas',
        a: '/seguridad',
      },
    ],
  },
];

/** Lo que no cabe en los cinco botones de abajo: textos, desafíos y la cuenta. */
export function Menu() {
  const navegar = useNavigate();
  const usuario = useSesion((estado) => estado.usuario);

  async function cerrarSesion() {
    await salir();
    navegar('/', { replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Más</h1>
        {/*
          Vuelve a donde se estaba, no a la ruta. Desde que hay barra abajo se
          puede llegar aquí desde cualquier sección, y mandar siempre a la ruta
          convertía el botón de volver en un botón de irse a otro sitio.
        */}
        <button
          type="button"
          onClick={() => navegar(-1)}
          className="-mr-2 flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm text-[var(--texto-suave)] hover:bg-[var(--superficie)]"
        >
          Volver
        </button>
      </header>

      <div className="mt-6">
        <MascotaConMensaje
          estado="feliz"
          mensaje={usuario ? `Hola, ${usuario.displayName}.` : 'Hola.'}
        />
      </div>

      {GRUPOS.map((grupo, iGrupo) => (
        <section key={grupo.titulo} className="mt-7">
          {/*
            El título del grupo es un encabezado de verdad y no un párrafo en
            gris: con lector de pantalla es lo único que separa «cosas que
            hacer» de «tu cuenta», y leídas de corrido las cinco entradas
            vuelven a ser la lista indistinta que había antes.
          */}
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-[var(--texto-suave)]">
            {grupo.titulo}
          </h2>

          <nav className="mt-3 grid gap-3">
            {grupo.entradas.map((entrada, indice) => (
              <button
                key={entrada.a}
                type="button"
                onClick={() => navegar(entrada.a)}
                style={{
                  animationDelay: `${(iGrupo * 3 + indice) * 70}ms`,
                  animationFillMode: 'backwards',
                }}
                className="boton-3d flex animate-entrada items-center gap-4 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4 text-left"
              >
                <span aria-hidden className="text-2xl">
                  {entrada.icono}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{entrada.titulo}</span>
                  <span className="block text-sm text-[var(--texto-suave)]">
                    {entrada.descripcion}
                  </span>
                </span>
                <span aria-hidden className="text-[var(--texto-suave)]">
                  ›
                </span>
              </button>
            ))}
          </nav>
        </section>
      ))}

      {/*
        Salir va suelto y al final, separado de lo demás. Es el único botón de
        esta pantalla que no lleva a ningún sitio, y mezclarlo con los otros
        invita a pulsarlo sin querer.
      */}
      <button
        type="button"
        onClick={() => void cerrarSesion()}
        // `--color-fallo` es el rojo de las correcciones, pensado para ir sobre
        // un fondo rosado. Sobre el fondo normal se queda en 3.6 de contraste,
        // por debajo del mínimo, así que aquí va un rojo más oscuro.
        className="mt-8 min-h-12 w-full rounded-xl py-3.5 text-center text-sm font-bold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
