import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Usuario {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

interface EstadoSesion {
  usuario: Usuario | null;
  setSesion: (usuario: Usuario) => void;
  cerrar: () => void;
}

/**
 * Estado de sesión.
 *
 * El token de acceso **no vive aquí** y nunca se guarda en el navegador: se
 * mantiene en memoria dentro del cliente de API. Lo que sí se recuerda entre
 * visitas es quién eres y qué nivel elegiste, que no son secretos.
 */
export const useSesion = create<EstadoSesion>()(
  persist(
    (set) => ({
      usuario: null,
      setSesion: (usuario) => set({ usuario }),
      cerrar: () => set({ usuario: null }),
    }),
    { name: 'speakmi-sesion' },
  ),
);
