import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { NOMBRE_CATEGORIA } from '@/components/ejercicios/tipos';
import { useContador } from '@/lib/contador';
import { useNombreMascota } from '@/lib/mascota-contexto';
import { avisarAhora, marcarAvisado, tocaAvisar } from '@/lib/recordatorio';

interface Progreso {
  xpTotal: number;
  xpHoy: number;
  leccionesCompletadas: number;
  racha: { currentDays: number; longestDays: number; freezesAvailable: number };
  repasosPendientes: number;
  dominio: Array<{ skillCode: string; titleEs: string; mastery: number; attempts: number }>;
  debilidades: Array<{
    category: string;
    veces: number;
    ultimoEjemplo: string | null;
    ultimoEsperado: string | null;
  }>;
}

/**
 * Cabecera del panel de inicio.
 *
 * El orden importa: primero lo que toca hacer hoy, luego lo que cuesta, y la
 * racha en pequeño. Es lo contrario de Duolingo a propósito, porque la racha
 * mide asistencia y lo que aquí interesa medir es competencia.
 */
export function PanelInicio() {
  const navegar = useNavigate();
  const nombre = useNombreMascota();

  /*
    El recordatorio diario, cuando toca.

    Va aquí y no en un sitio más general porque este panel solo se pinta en la
    ruta, que es la pantalla de inicio: es donde se llega al abrir la
    aplicación, y avisar en cualquier otra sería avisar a mitad de una lección.
  */
  useEffect(() => {
    let hora = '19:00';
    try {
      hora = localStorage.getItem('speakmi.recordatorio.hora') ?? hora;
    } catch {
      // Sin memoria se usa la hora por defecto.
    }
    if (!tocaAvisar(hora)) return;
    if (avisarAhora('Un rato de inglés y sigues la racha.')) marcarAvisado();
  }, []);

  const { data } = useQuery({
    queryKey: ['progreso'],
    queryFn: () => api.get<Progreso>('/progress'),
    // Siempre fresco al volver a esta pantalla: si acabas de fallar algo en una
    // lección, el aviso de repaso tiene que aparecer al instante, no en 30 segundos.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // La cartera va aparte del progreso: son dos cosas distintas y si una falla
  // la otra se sigue viendo.
  const { data: cartera } = useQuery({
    queryKey: ['cartera'],
    queryFn: () => api.get<{ coins: number }>('/me/wallet'),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (!data) return null;

  const debilidad = data.debilidades[0];
  const flojo = data.dominio.find((skill) => skill.attempts >= 2 && skill.mastery < 0.7);

  return (
    <div className="grid gap-3">
      {data.repasosPendientes > 0 && (
        <button
          type="button"
          onClick={() => navegar('/repaso')}
          className="boton-3d flex animate-entrada items-center gap-4 rounded-2xl border-acento-600 bg-acento-500 p-4 text-left text-white hover:bg-acento-400"
        >
          <span className="animate-latido text-2xl" aria-hidden>
            🔄
          </span>
          <span className="flex-1">
            <span className="block font-semibold">
              {data.repasosPendientes === 1
                ? 'Tienes 1 repaso pendiente'
                : `Tienes ${data.repasosPendientes} repasos pendientes`}
            </span>
            <span className="block text-sm text-amber-50">
              Cosas que fallaste y toca volver a ver
            </span>
          </span>
          <span aria-hidden>›</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => navegar('/conversar')}
        className="boton-3d flex animate-entrada items-center gap-4 rounded-2xl border-marca-800 bg-marca-600 p-4 text-left text-white hover:bg-marca-500"
      >
        <span className="text-2xl" aria-hidden>
          💬
        </span>
        <span className="flex-1">
          <span className="block font-bold">Conversar con {nombre}</span>
          <span className="block text-sm text-marca-100">
            Habla de lo que quieras. Te corrige al final, no mientras hablas.
          </span>
        </span>
        <span aria-hidden>›</span>
      </button>

      <div className="grid grid-cols-4 gap-2">
        <Dato
          valor={data.racha.currentDays}
          etiqueta={data.racha.currentDays === 1 ? 'día' : 'días'}
          icono="🔥"
          vivo={data.racha.currentDays > 0}
          retraso={0}
        />
        <Dato valor={data.xpTotal} etiqueta="XP" icono="⭐" retraso={80} />
        {/* Las monedas llevan a la tienda: verlas y no poder gastarlas frustra. */}
        <Dato
          valor={cartera?.coins ?? 0}
          etiqueta="monedas"
          icono="🪙"
          retraso={160}
          onClick={() => navegar('/tienda')}
        />
        <Dato valor={data.leccionesCompletadas} etiqueta="lecciones" icono="📘" retraso={240} />
      </div>

      {/* Solo si tiene alguno: un cero permanente no informa de nada. */}
      {data.racha.freezesAvailable > 0 && (
        <p className="text-center text-xs text-[var(--texto-suave)]">
          ❄️ Tienes {data.racha.freezesAvailable}{' '}
          {data.racha.freezesAvailable === 1 ? 'congelado' : 'congelados'} para salvar la racha
        </p>
      )}

      {(debilidad ?? flojo) && (
        <div className="rounded-2xl border border-[var(--borde)] bg-[var(--superficie)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--texto-suave)]">
            En lo que más fallas
          </p>

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
              Escribiste{' '}
              <span className="text-[var(--color-fallo)]">{debilidad.ultimoEjemplo}</span> donde iba{' '}
              <span className="text-[var(--color-acierto)]">{debilidad.ultimoEsperado}</span>
            </p>
          )}

          {flojo && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--texto-suave)]">{flojo.titleEs}</span>
                <span className="text-[var(--texto-suave)]">
                  {Math.round(flojo.mastery * 100)}%
                </span>
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
        </div>
      )}
    </div>
  );
}

/**
 * Una cifra del panel.
 *
 * Las tres entran escalonadas, no las tres a la vez: cuando algo aparece en
 * cascada el ojo lo sigue, y cuando aparece de golpe ni se mira. Y el número
 * sube contando, que es lo que convierte un dato en un pequeño premio.
 */
function Dato({
  valor,
  etiqueta,
  icono,
  retraso,
  vivo = false,
  onClick,
}: {
  valor: number;
  etiqueta: string;
  icono: string;
  retraso: number;
  vivo?: boolean;
  onClick?: () => void;
}) {
  const contado = useContador(valor);
  // Con `onClick` se pinta como botón de verdad, no como un div que escucha
  // toques: así se llega con el teclado y el lector de pantalla lo anuncia.
  const Caja = onClick ? 'button' : 'div';

  return (
    <Caja
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'animate-entrada rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-3 text-center',
        onClick && 'boton-3d',
      )}
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
    >
      {/* La llama solo late si la racha está viva. Un fuego apagado no parpadea. */}
      <p className={cn('text-lg', vivo && 'animate-latido')} aria-hidden>
        {icono}
      </p>
      {/* El número cambia solo; para quien escucha la página basta el final. */}
      <p className="mt-0.5 text-xl font-extrabold tabular-nums" aria-label={`${valor} ${etiqueta}`}>
        <span aria-hidden>{contado}</span>
      </p>
      <p className="text-xs text-[var(--texto-suave)]">{etiqueta}</p>
    </Caja>
  );
}
