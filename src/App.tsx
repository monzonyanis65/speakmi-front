import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configurarAuth } from '@/lib/api';
import { getToken, recuperarSesion } from '@/lib/auth';
import { useSesion } from '@/store/sesion';
import { Bienvenida } from '@/pages/Bienvenida';
import { Registro } from '@/pages/Registro';
import { Ruta } from '@/pages/Ruta';

// El cliente de API necesita saber de dónde sacar el token y cómo renovarlo.
// Se le dice una sola vez, al cargar la aplicación.
configurarAuth({ token: getToken, renovar: recuperarSesion });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (intento, error) => intento < 2 && !(error instanceof Error && 'code' in error),
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const [comprobando, setComprobando] = useState(true);

  // Al abrir la app se intenta recuperar la sesión con la cookie de refresco.
  // Solo si esta persona ya había entrado alguna vez: a quien llega por primera
  // vez no se le pide nada, y así no aparece un 401 inútil en la consola.
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
          <Route path="/entrar" element={<Registro />} />
          <Route
            path="/ruta"
            element={
              <SoloConSesion>
                <Ruta />
              </SoloConSesion>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/** Quien ya entró no necesita volver a elegir nivel al abrir la app. */
function SoloVisitantes() {
  const usuario = useSesion((estado) => estado.usuario);
  return usuario ? <Navigate to="/ruta" replace /> : <Bienvenida />;
}

function SoloConSesion({ children }: { children: React.ReactNode }) {
  const usuario = useSesion((estado) => estado.usuario);
  return usuario ? <>{children}</> : <Navigate to="/" replace />;
}
