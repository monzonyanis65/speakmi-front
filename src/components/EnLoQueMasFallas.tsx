import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { NOMBRE_CATEGORIA } from '@/components/ejercicios/tipos';

/** Solo lo que pinta este bloque. La consulta la comparte con la portada y el perfil. */
interface Progreso {
  dominio?: Array<{ skillCode: string; titleEs: string; mastery: number; attempts: number }>;
  debilidades?: Array<{
    category: string;
    veces: number;
    ultimoEjemplo: string | null;
    ultimoEsperado: string | null;
  }>;
}

/**
 * En lo que más fallas.
 *
 * POR QUÉ ESTÁ AQUÍ Y NO EN LA PORTADA, QUE ES DE DONDE VIENE
 *
 * Esto es un espejo, no una tarea. No dice qué hacer hoy —de eso ya se encargan
 * el camino, el repaso y los desafíos— sino qué se te está atragantando estas
 * semanas. Y un dato que cambia cada quince días no tiene por qué ocupar sitio
 * en la pantalla a la que se entra cada día: ahí se leía una vez, se entendía, y
 * las otras treinta veces era una fila más que saltarse para llegar al camino.
 *
 * El perfil es la pantalla de mirarse las tripas —rachas, medallas, logros,
 * cómo llevas el curso— y aquí es donde esta frase se busca a propósito en vez
 * de encontrarse de paso. Se pone justo debajo del resumen, que es lo bueno,
 * porque lo que cuesta se lee mejor al lado de lo que ya se lleva hecho.
 *
 * Los campos son opcionales a propósito: `/progress` lo piden tres pantallas con
 * la misma clave y no todas declaran lo mismo. Sin ellos este bloque no se
 * pinta, que es exactamente lo correcto el primer día, cuando no has fallado
 * nada todavía.
 */
export function EnLoQueMasFallas() {
  const { data } = useQuery({
    queryKey: ['progreso'],
    queryFn: () => api.get<Progreso>('/progress'),
  });

  const debilidad = data?.debilidades?.[0];
  const flojo = data?.dominio?.find((skill) => skill.attempts >= 2 && skill.mastery < 0.7);

  // Sin nada que decir no se pinta un hueco: un recuadro vacío que dice «aún no
  // fallaste nada» es una forma rara de felicitar a alguien.
  if (!debilidad && !flojo) return null;

  return (
    <section className="mt-6 rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] p-4">
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[var(--texto-suave)]">
        En lo que más fallas
      </h2>

      {debilidad && (
        <p className="mt-2">
          <span className="font-semibold">
            {NOMBRE_CATEGORIA[debilidad.category] ?? debilidad.category}
          </span>
          <span className="text-[var(--texto-suave)]">
            {' '}
            · {debilidad.veces} {debilidad.veces === 1 ? 'vez' : 'veces'}
          </span>
        </p>
      )}

      {debilidad?.ultimoEjemplo && debilidad.ultimoEsperado && (
        <p className="mt-1 text-sm text-[var(--texto-suave)]">
          Escribiste <span className="text-[var(--texto-fallo)]">{debilidad.ultimoEjemplo}</span>{' '}
          donde iba <span className="text-[var(--texto-acierto)]">{debilidad.ultimoEsperado}</span>
        </p>
      )}

      {flojo && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--texto-suave)]">{flojo.titleEs}</span>
            <span className="text-[var(--texto-suave)]">{Math.round(flojo.mastery * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--fondo)]">
            <div
              className={cn(
                'h-full rounded-full',
                flojo.mastery < 0.4 ? 'bg-[var(--color-fallo)]' : 'bg-[var(--color-aviso)]',
              )}
              style={{ width: `${Math.max(flojo.mastery * 100, 4)}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
