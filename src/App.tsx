import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { configurarAuth } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { getToken, recuperarSesion } from '@/lib/auth';
import { useSesion } from '@/store/sesion';
import { Entrada } from '@/pages/Entrada';
import { OlvideClave } from '@/pages/OlvideClave';
import { ComoEmpezar } from '@/pages/ComoEmpezar';
import { Prueba } from '@/pages/Prueba';
import { Bienvenida } from '@/pages/Bienvenida';
import { Ruta } from '@/pages/Ruta';
import { Leccion } from '@/pages/Leccion';
import { Guia } from '@/pages/Guia';
import { Repaso } from '@/pages/Repaso';
import { Conversar } from '@/pages/Conversar';
import { AvisoActualizacion } from '@/components/AvisoActualizacion';

// El cliente de API necesita saber de dónde sacar el token y cómo renovarlo.
// Se le dice una sola vez, al cargar la aplicación.
configurarAuth({ token: getToken, renovar: recuperarSesion });

/**
 * Orden de las pantallas:
 *
 *   entrar  →  ¿cómo empiezas?  →  elegir nivel o hacer la prueba  →  ruta
 *
 * Los pasos del medio solo aparecen la primera vez, o cuando alguien quiere
 * cambiar de nivel.
 *
 * Quien vuelve con la sesión abierta va directo a su ruta.
 */
export default function App() {
  const [comprobando, setComprobando] = useState(true);

  // Solo se intenta recuperar la sesión de quien ya había entrado alguna vez.
  // A quien llega por primera vez no se le pide nada.
  useEffect(() => {
    if (!useSesion.getState().usuario) {
      setComprobando(false);
      return;
    }
    void recuperarSesion().finally(() => setComprobando(false));
  }, []);

  if (comprobando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-[var(--texto-suave)]">Un momento…</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SoloVisitantes />} />
          <Route path="/recuperar" element={<OlvideClave />} />
          <Route
            path="/empezar"
            element={
              <SoloConSesion>
                <ComoEmpezar />
              </SoloConSesion>
            }
          />
          <Route
            path="/prueba"
            element={
              <SoloConSesion>
                <Prueba />
              </SoloConSesion>
            }
          />
          <Route
            path="/nivel"
            element={
              <SoloConSesion>
                <Bienvenida />
              </SoloConSesion>
            }
          />
          <Route
            path="/ruta"
            element={
              <SoloConSesion>
                <Ruta />
              </SoloConSesion>
            }
          />
          <Route
            path="/leccion/:code"
            element={
              <SoloConSesion>
                <Leccion />
              </SoloConSesion>
            }
          />
          <Route
            path="/guia/:code"
            element={
              <SoloConSesion>
                <Guia />
              </SoloConSesion>
            }
          />
          <Route
            path="/repaso"
            element={
              <SoloConSesion>
                <Repaso />
              </SoloConSesion>
            }
          />
          <Route
            path="/conversar"
            element={
              <SoloConSesion>
                <Conversar />
              </SoloConSesion>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {/* Fuera de las rutas: el aviso vale para cualquier pantalla. */}
        <AvisoActualizacion />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/** Quien ya entró no vuelve a ver la pantalla de acceso. */
function SoloVisitantes() {
  const usuario = useSesion((estado) => estado.usuario);
  return usuario ? <Navigate to="/ruta" replace /> : <Entrada />;
}

function SoloConSesion({ children }: { children: React.ReactNode }) {
  const usuario = useSesion((estado) => estado.usuario);
  return usuario ? <>{children}</> : <Navigate to="/" replace />;
}
