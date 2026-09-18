import { api, ApiError } from './api';
import { useSesion, type Usuario } from '@/store/sesion';
import { queryClient } from '@/lib/queryClient';

/**
 * El token de acceso vive solo en memoria.
 *
 * No se guarda en localStorage a propósito: ahí sería legible por cualquier
 * script de la página. Al recargar se pide uno nuevo con la cookie de refresco,
 * que el navegador envía sola y el JavaScript no puede leer.
 */
let tokenEnMemoria: string | null = null;

export function getToken(): string | null {
  return tokenEnMemoria;
}

export function setToken(token: string | null): void {
  tokenEnMemoria = token;
}

interface RespuestaSesion {
  user: Usuario;
  accessToken: string;
}

export async function registrar(datos: {
  email: string;
  password: string;
  displayName: string;
}): Promise<Usuario> {
  const respuesta = await api.post<RespuestaSesion>('/auth/register', datos);
  aplicar(respuesta);
  return respuesta.user;
}

export async function entrar(datos: { email: string; password: string }): Promise<Usuario> {
  const respuesta = await api.post<RespuestaSesion>('/auth/login', datos);
  aplicar(respuesta);
  return respuesta.user;
}

export async function salir(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    setToken(null);
    useSesion.getState().cerrar();
  }
}

/**
 * Recupera la sesión.
 *
 * Se llama al abrir la app y cada vez que caduca el token de acceso. Como el
 * servidor rota el token de refresco en cada uso, dos renovaciones a la vez
 * harían que la segunda usara uno ya gastado, y eso cierra todas las sesiones
 * por seguridad. Por eso solo puede haber una en marcha: las demás esperan a esa.
 */
let renovacionEnCurso: Promise<boolean> | null = null;

export function recuperarSesion(): Promise<boolean> {
  renovacionEnCurso ??= renovarDeVerdad().finally(() => {
    renovacionEnCurso = null;
  });
  return renovacionEnCurso;
}

async function renovarDeVerdad(): Promise<boolean> {
  try {
    // `sinRenovar` corta el bucle: si este refresco falla, no dispara otro.
    const respuesta = await api.post<RespuestaSesion>('/auth/refresh', undefined, {
      sinRenovar: true,
    });
    aplicar(respuesta);
    return true;
  } catch (error) {
    if (error instanceof ApiError) {
      setToken(null);
      useSesion.getState().cerrar();
    }
    return false;
  }
}

export async function guardarNivel(levelCode: string): Promise<void> {
  await api.put('/me/level', { levelCode });

  // Hay que avisar a la caché. Sin esto, la ruta seguía leyendo el nivel viejo
  // durante medio minuto: si era la primera vez, leía «ninguno» y se quedaba
  // cargando sin fin, porque la consulta de la ruta nunca llegaba a encenderse.
  queryClient.setQueryData(['mi-nivel'], { level: { levelCode } });
  await queryClient.invalidateQueries({ queryKey: ['mi-nivel'] });
}

/** ¿Esta persona ya eligió nivel? Decide a qué pantalla va tras entrar. */
export async function tieneNivel(): Promise<boolean> {
  try {
    const respuesta = await api.get<{ level: { levelCode: string } | null }>('/me/level');
    return respuesta.level !== null;
  } catch {
    return false;
  }
}

function aplicar(respuesta: RespuestaSesion): void {
  setToken(respuesta.accessToken);
  useSesion.getState().setSesion(respuesta.user);
}
