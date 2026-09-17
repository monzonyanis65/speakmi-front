import { useNavigate } from 'react-router-dom';
import { useSesion } from '@/store/sesion';
import { Mascota } from '@/components/Mascota';

/**
 * Bifurcación para quien acaba de entrar y todavía no tiene nivel.
 *
 * Dos caminos igual de válidos: elegir uno mismo, para quien ya sabe por dónde
 * va en su curso, o hacer la prueba, para quien no está seguro.
 */
export function ComoEmpezar() {
  const navegar = useNavigate();
  const usuario = useSesion((estado) => estado.usuario);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <header className="text-center">
        <div className="flex justify-center">
          <Mascota estado="feliz" tamano={120} />
        </div>
        <h1 className="mt-2 text-2xl font-extrabold">Bienvenido, {usuario?.displayName}</h1>
        <p className="mt-2 text-[var(--texto-suave)]">
          Para armar tu ruta necesitamos saber por dónde vas.
        </p>
      </header>

      <div className="mt-8 grid gap-4">
        <Opcion
          emoji="🎯"
          titulo="Ya sé mi nivel"
          descripcion="Elígelo tú de la lista. Es lo más rápido si estás siguiendo un curso."
          onClick={() => navegar('/nivel')}
          principal
        />

        <Opcion
          emoji="📝"
          titulo="Hazme una prueba"
          descripcion="Dieciséis preguntas, unos tres minutos. Te decimos dónde encajas."
          onClick={() => navegar('/prueba')}
        />
      </div>

      <p className="mt-8 text-center text-xs text-[var(--texto-suave)]">
        Da igual cuál elijas: podrás cambiar de nivel cuando quieras.
      </p>
    </div>
  );
}

function Opcion({
  emoji,
  titulo,
  descripcion,
  onClick,
  principal = false,
}: {
  emoji: string;
  titulo: string;
  descripcion: string;
  onClick: () => void;
  principal?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        principal
          ? 'boton-3d animate-entrada rounded-2xl border-marca-800 bg-marca-600 p-5 text-left text-white hover:bg-marca-500'
          : 'boton-3d animate-entrada rounded-2xl border-2 border-[var(--hueco)] bg-[var(--superficie)] p-5 text-left hover:border-marca-400'
      }
    >
      <span className="flex items-start gap-4">
        <span className="text-3xl" aria-hidden>
          {emoji}
        </span>
        <span>
          <span className="block font-semibold">{titulo}</span>
          <span
            className={
              principal
                ? 'mt-1 block text-sm text-marca-100'
                : 'mt-1 block text-sm text-[var(--texto-suave)]'
            }
          >
            {descripcion}
          </span>
        </span>
      </span>
    </button>
  );
}
