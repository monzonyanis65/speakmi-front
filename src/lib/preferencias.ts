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

/*
  EL SONIDO DE LOS JUEGOS NO ESTÁ AQUÍ, Y ES A PROPÓSITO

  Se guarda solo en este aparato, en `lib/sonido.ts`. Lo de aquí arriba viaja con
  la cuenta porque son decisiones de la persona —qué voz quiere, a qué hora se le
  avisa—, y esas valen igual en el móvil que en el portátil. El sonido no: es una
  decisión del SITIO donde estás. Quien lo apaga en el portátil del trabajo lo
  apaga porque hay gente al lado, y sincronizarlo se lo dejaría apagado también
  en el sofá de su casa, que es justo donde lo quería.

  Además es una columna menos en la base de datos, y una migración menos.
*/

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
