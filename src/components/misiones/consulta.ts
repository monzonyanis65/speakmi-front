import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Misiones } from './tipos';

/**
 * La consulta de las misiones, en un archivo propio.
 *
 * Está fuera del componente por una razón práctica: mezclar un hook con
 * componentes en el mismo archivo rompe la recarga en caliente de React, que
 * solo sabe conservar el estado cuando un archivo exporta componentes y nada
 * más. Y por una de fondo: la clave `['misiones']` la comparten cuatro sitios
 * —la ruta, la pantalla entera, el final de una lección y el final de una
 * partida— y conviene que se escriba UNA vez.
 */
export function useMisiones(opciones: { activa?: boolean } = {}) {
  return useQuery({
    queryKey: ['misiones'],
    queryFn: () => api.get<Misiones>('/misiones'),
    enabled: opciones.activa ?? true,
    retry: false,
    // Las misiones caducan a medianoche, no a los cinco minutos: no tiene
    // sentido volver a pedirlas cada vez que la pestaña recupera el foco.
    refetchOnWindowFocus: false,
  });
}
