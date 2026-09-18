import { useRegisterSW } from 'virtual:pwa-register/react';
import { Boton } from '@/components/Boton';

/** Cada hora. Instalada en el móvil, la pestaña puede pasar días sin recargarse. */
const CADA_HORA = 60 * 60 * 1000;

/**
 * Aviso de versión nueva.
 *
 * Va abajo y ocupa poco a propósito: puede aparecer en mitad de una lección, y
 * cortar a quien está grabando su voz para anunciarle una actualización sería
 * peor que esperar a que termine.
 *
 * Ojo: con `registerType: 'autoUpdate'` el service worker toma el control solo
 * y recarga la página, así que este aviso solo salta cuando el navegador deja
 * la versión nueva esperando. Si algún día se quiere confirmación siempre,
 * basta con pasar el registro a 'prompt' en vite.config.ts.
 */
export function AvisoActualizacion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // Sin esta comprobación periódica, quien nunca cierra la app se quedaría
      // con la versión del día que la instaló.
      if (registro) {
        setInterval(() => void registro.update(), CADA_HORA);
      }
    },
  });

  if (!hayVersionNueva) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
    >
      <div className="flex w-full max-w-sm animate-subir items-center gap-3 rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-4 py-3 shadow-lg">
        <p className="flex-1 text-sm text-[var(--texto-suave)]">Hay una versión nueva de Speakmi</p>
        <Boton
          tono="marca"
          ancho={false}
          className="shrink-0"
          onClick={() => void updateServiceWorker()}
        >
          Actualizar
        </Boton>
        <button
          type="button"
          aria-label="Cerrar el aviso"
          onClick={() => setHayVersionNueva(false)}
          className="shrink-0 rounded-full px-2 py-1 text-lg leading-none text-[var(--texto-suave)] transition hover:text-[var(--texto)]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
