import { useNavigate } from 'react-router-dom';
import { Mascota } from '@/components/Mascota';
import { Boton } from '@/components/Boton';

/**
 * Qué se ve cuando un nivel todavía no tiene contenido.
 *
 * Antes solo decía "no hay contenido" y dejaba a la persona en una pantalla
 * muerta, sin nada que hacer. Ahora se ofrecen las dos salidas que sí existen:
 * cambiar de nivel o ponerse a conversar, que no depende del contenido.
 */
export function NivelVacio({ nivel }: { nivel?: string }) {
  const navegar = useNavigate();

  return (
    <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--borde)] p-8 text-center">
      <Mascota estado="pensando" tamano={110} className="mx-auto" />

      <p className="mt-3 text-lg font-bold">
        {nivel
          ? `El nivel ${nivel} todavía no tiene lecciones`
          : 'Este nivel todavía no tiene lecciones'}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--texto-suave)]">
        Lo estamos preparando. Mientras tanto puedes practicar hablando, que no depende del nivel, o
        empezar por otro.
      </p>

      <div className="mx-auto mt-6 grid max-w-xs gap-3">
        <Boton tamano="grande" onClick={() => navegar('/conversar')}>
          HABLAR CON MILO
        </Boton>
        <Boton tono="suave" onClick={() => navegar('/nivel')}>
          Cambiar de nivel
        </Boton>
      </div>
    </div>
  );
}
