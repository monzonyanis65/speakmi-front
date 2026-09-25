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

/*
  Qué va en el menú y en qué orden.

  Lo que se toca a menudo arriba. La seguridad va la última de las tres porque
  se entra una vez al año, y ponerla primera solo sirve para que estorbe.
*/
const ENTRADAS: Entrada[] = [
  {
    icono: '🎮',
    titulo: 'Juegos',
    descripcion: 'Contrarreloj, parejas, cadena y escucha. Cinco minutos y monedas',
    a: '/juegos',
  },
  {
    icono: '🏆',
    titulo: 'Liga y amigos',
    descripcion: 'Tu semana, la clasificación y la gente que estudia contigo',
    a: '/liga',
  },
  {
    icono: '👤',
    titulo: 'Mi perfil',
    descripcion: 'Tu nombre, tu nivel y cómo llevas el curso',
    a: '/perfil',
  },
  {
    icono: '🛍️',
    titulo: 'Tienda',
    descripcion: 'Gasta tus monedas en mascotas, atuendos y congelados',
    a: '/tienda',
  },
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
];

/** El menú de la cuenta: perfil, ajustes y seguridad. */
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
        <h1 className="text-xl font-bold">Tu cuenta</h1>
        <button
          type="button"
          onClick={() => navegar('/ruta')}
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

      <nav className="mt-6 grid gap-3">
        {ENTRADAS.map((entrada, indice) => (
          <button
            key={entrada.a}
            type="button"
            onClick={() => navegar(entrada.a)}
            style={{ animationDelay: `${indice * 70}ms`, animationFillMode: 'backwards' }}
            className="boton-3d flex animate-entrada items-center gap-4 rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-4 text-left"
          >
            <span aria-hidden className="text-2xl">
              {entrada.icono}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{entrada.titulo}</span>
              <span className="block text-sm text-[var(--texto-suave)]">{entrada.descripcion}</span>
            </span>
            <span aria-hidden className="text-[var(--texto-suave)]">
              ›
            </span>
          </button>
        ))}
      </nav>

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
