import { api, ApiError } from './api';
import { useSesion, type Usuario } from '@/store/sesion';

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
 * Recupera la sesión al abrir la app.
 * Devuelve false sin hacer ruido si no había ninguna, que es lo normal.
 */
export async function recuperarSesion(): Promise<boolean> {
  try {
    const respuesta = await api.post<RespuestaSesion>('/auth/refresh');
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
