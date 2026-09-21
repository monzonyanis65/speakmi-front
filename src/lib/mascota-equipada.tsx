import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSesion } from '@/store/sesion';
import { ContextoMascota, MASCOTA_POR_DEFECTO, type MascotaEquipada } from '@/lib/mascota-contexto';
import type { Atuendo, Especie } from '@/components/mascotas';

/**
 * Qué mascota lleva puesta esta persona, para toda la aplicación.
 *
 * Va por contexto y no pasando props de pantalla en pantalla porque la mascota
 * sale en once sitios distintos: la portada, la ruta, cada corrección, el
 * resumen, la conversación, el menú… Encadenar la prop por todos ellos sería
 * tocar once archivos cada vez que se añade un sitio nuevo, y bastaría olvidar
 * uno para que alguien viera su gato en toda la app menos en una pantalla.
 *
 * Sin proveedor sale Milo, que es lo que hace que las pruebas de los
 * componentes sigan funcionando sin montar nada alrededor.
 */
export function ProveedorMascota({ children }: { children: ReactNode }) {
  const usuario = useSesion((estado) => estado.usuario);

  const { data } = useQuery({
    queryKey: ['cartera'],
    queryFn: () => api.get<{ equipped: { mascota: string; atuendo: string | null } }>('/me/wallet'),
    // Sin sesión no se pregunta. Funcionaba igual dejándolo fallar, pero soltaba
    // un 401 en la consola de la pantalla de entrada: ruido que parece un fallo
    // y que tapa los errores de verdad cuando se está buscando uno.
    enabled: Boolean(usuario),
    retry: false,
    /*
      Siempre fresco al cambiar de pantalla.

      Con caché de un minuto pasaba lo peor que puede pasar aquí: comprabas un
      gato, te lo ponías, y seguías viendo al pájaro en media aplicación hasta
      que caducaba. Es una petición diminuta y el precio de equivocarse es que
      lo que acabas de comprar parezca que no se compró.
    */
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const equipado: MascotaEquipada = data
    ? {
        especie: (data.equipped.mascota as Especie) ?? MASCOTA_POR_DEFECTO.especie,
        atuendo: (data.equipped.atuendo as Atuendo | null) ?? null,
      }
    : MASCOTA_POR_DEFECTO;

  return <ContextoMascota.Provider value={equipado}>{children}</ContextoMascota.Provider>;
}
