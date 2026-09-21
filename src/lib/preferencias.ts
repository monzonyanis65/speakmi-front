import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { aplicarTema, temaGuardado, type Tema } from '@/lib/tema';

export interface Preferencias {
  ttsVoice: string | null;
  ttsAccent: 'us' | 'uk';
  correctionMode: 'end_of_turn' | 'instant';
  subtitlesEnabled: boolean;
  hapticsEnabled: boolean;
  theme: Tema;
  reminderEnabled: boolean;
  /** 'HH:MM', 24 horas. */
  reminderTime: string;
}

export const CLAVE_HORA = 'speakmi.recordatorio.hora';

/**
 * Los ajustes, guardados en la cuenta y también en el navegador.
 *
 * Los dos sitios, y no uno: el servidor es la verdad y viaja de un aparato a
 * otro, pero tarda. El navegador responde al instante y permite aplicar el tema
 * antes de pintar nada. Sin la copia local, entrar en la app sería un fogonazo
 * claro seguido de un salto a oscuro.
 *
 * Cuando discrepan manda el servidor, porque puede venir de otro aparato.
 */
export function usePreferencias() {
  const cliente = useQueryClient();

  const consulta = useQuery({
    queryKey: ['preferencias'],
    queryFn: async () => {
      const remotas = await api.get<Preferencias>('/me/preferences');

      // Al llegar se vuelca a lo local, que es lo que se lee al arrancar.
      if (remotas.theme !== temaGuardado()) aplicarTema(remotas.theme);
      try {
        localStorage.setItem(CLAVE_HORA, remotas.reminderEnabled ? remotas.reminderTime : '');
      } catch {
        // Sin memoria local el recordatorio no salta, pero los ajustes se ven.
      }

      return remotas;
    },
  });

  const guardar = useMutation({
    mutationFn: (cambios: Partial<Preferencias>) =>
      api.put<Preferencias>('/me/preferences', cambios),
    onSuccess: (nuevas) => cliente.setQueryData(['preferencias'], nuevas),
  });

  return { preferencias: consulta.data, cargando: consulta.isPending, guardar };
}
