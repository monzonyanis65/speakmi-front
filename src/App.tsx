import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { configurarAuth } from '@/lib/api';
import { aplicarTema, temaGuardado } from '@/lib/tema';
import { ProveedorMascota } from '@/lib/mascota-equipada';
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
import { Examen } from '@/pages/Examen';
import { Menu } from '@/pages/Menu';
import { Misiones } from '@/pages/Misiones';
import { Ajustes } from '@/pages/Ajustes';
import { Perfil } from '@/pages/Perfil';
import { Seguridad } from '@/pages/Seguridad';
import { Tienda } from '@/pages/Tienda';
import { Juegos } from '@/pages/Juegos';
import { Liga } from '@/pages/Liga';
import { Novedades } from '@/pages/Novedades';
import { Juego } from '@/pages/Juego';
import { Llamada } from '@/pages/Llamada';
import { MiloVivo } from '@/components/MiloVivo';
import { PruebaShadowing } from '@/pages/PruebaShadowing';
import { PruebaEscritura } from '@/pages/PruebaEscritura';
import { Repaso } from '@/pages/Repaso';
import { Conversar } from '@/pages/Conversar';
import { Lecturas } from '@/pages/Lecturas';
import { Lectura } from '@/pages/Lectura';
import { AvisoActualizacion } from '@/components/AvisoActualizacion';
import { MarcoConBarra } from '@/components/BarraInferior';

// El cliente de API necesita saber de dónde sacar el token y cómo renovarlo.
// Se le dice una sola vez, al cargar la aplicación.
configurarAuth({ token: getToken, renovar: recuperarSesion });

// El tema, antes de pintar nada. Aplicarlo dentro de un componente deja ver un
// fogonazo claro antes de oscurecerse, que en una habitación a oscuras molesta.
aplicarTema(temaGuardado());

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
      <ProveedorMascota>
        <BrowserRouter>
          {/*
            Todas las pantallas van dentro del marco, y no solo las que llevan
            barra: es el marco quien decide si hoy la hay y quien reserva su
            hueco. Pasar las rutas por aquí es lo que hace imposible que una
            pantalla nueva nazca con el último botón tapado.
          */}
          <MarcoConBarra>
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
              {/* El examen que cierra un nivel. Se llega desde el final de la ruta. */}
              <Route
                path="/examen"
                element={
                  <SoloConSesion>
                    <Examen />
                  </SoloConSesion>
                }
              />
              <Route
                path="/menu"
                element={
                  <SoloConSesion>
                    <Menu />
                  </SoloConSesion>
                }
              />
              <Route
                path="/misiones"
                element={
                  <SoloConSesion>
                    <Misiones />
                  </SoloConSesion>
                }
              />
              <Route
                path="/perfil"
                element={
                  <SoloConSesion>
                    <Perfil />
                  </SoloConSesion>
                }
              />
              <Route
                path="/ajustes"
                element={
                  <SoloConSesion>
                    <Ajustes />
                  </SoloConSesion>
                }
              />
              <Route
                path="/tienda"
                element={
                  <SoloConSesion>
                    <Tienda />
                  </SoloConSesion>
                }
              />
              <Route
                path="/seguridad"
                element={
                  <SoloConSesion>
                    <Seguridad />
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
                path="/juegos"
                element={
                  <SoloConSesion>
                    <Juegos />
                  </SoloConSesion>
                }
              />
              <Route
                path="/juegos/:code"
                element={
                  <SoloConSesion>
                    <Juego />
                  </SoloConSesion>
                }
              />
              <Route
                path="/liga"
                element={
                  <SoloConSesion>
                    <Liga />
                  </SoloConSesion>
                }
              />
              {/* El muro de novedades. Va suelto y no dentro de la liga porque lo
                que cuenta no es una competición: es lo que ha hecho tu gente. */}
              <Route
                path="/novedades"
                element={
                  <SoloConSesion>
                    <Novedades />
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
                path="/llamada"
                element={
                  <SoloConSesion>
                    <Llamada />
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
              {/*
              Los textos que trae cada uno. Van en plural y singular, como la
              ruta y las lecciones: la lista y el que estés leyendo.
            */}
              <Route
                path="/lecturas"
                element={
                  <SoloConSesion>
                    <Lecturas />
                  </SoloConSesion>
                }
              />
              <Route
                path="/lecturas/:id"
                element={
                  <SoloConSesion>
                    <Lectura />
                  </SoloConSesion>
                }
              />
              {/*
              Banco de pruebas del Milo con física. No lleva sesión a propósito:
              es para verlo y compararlo, no una pantalla del producto.
            */}
              <Route path="/vivo" element={<MiloVivo />} />
              {/*
              Banco de pruebas del shadowing, mientras el ejercicio no esté
              cosido a la lección. Sin sesión por el mismo motivo que /vivo.
            */}
              <Route path="/shadowing" element={<PruebaShadowing />} />
              {/*
              Banco de pruebas de escribir libre. Sin sesión por lo mismo que
              los dos de arriba: la pantalla de verdad vive dentro de una
              lección y llegar a ella pide cuenta, servidor y clave del modelo.
            */}
              <Route path="/escritura" element={<PruebaEscritura />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MarcoConBarra>
          {/* Fuera de las rutas: el aviso vale para cualquier pantalla. */}
          <AvisoActualizacion />
        </BrowserRouter>
      </ProveedorMascota>
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
