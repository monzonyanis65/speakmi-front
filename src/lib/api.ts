/**
 * Cliente de la API.
 *
 * Todo pasa por aquí para que el manejo de los tracking codes esté en un solo
 * sitio. Cuando el backend responde con un error, esta capa lo convierte en un
 * ApiError que ya trae el código y el mensaje en español listos para mostrar.
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, unknown>;
    docs?: string;
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    if (body.requestId) this.requestId = body.requestId;
    if (body.details) this.details = body.details;
  }

  /** Los errores de validación traen un mensaje por campo, para pintarlo bajo cada input. */
  get fieldErrors(): Record<string, string> {
    const fields = this.details?.fields;
    return typeof fields === 'object' && fields !== null ? (fields as Record<string, string>) : {};
  }
}

/** Cuando ni siquiera hubo respuesta: sin red, servidor caído, dominio mal escrito. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('No pudimos conectar. Revisa tu conexión a internet.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

const BASE = import.meta.env.VITE_API_URL ?? '';

/**
 * Cómo se consigue el token. Se inyecta desde fuera para que este archivo no
 * dependa del módulo de sesión, que a su vez depende de este. Sin esto, los dos
 * se importarían en círculo.
 */
let proveedorToken: () => string | null = () => null;
let renovarSesion: (() => Promise<boolean>) | null = null;

export function configurarAuth(opciones: {
  token: () => string | null;
  renovar: () => Promise<boolean>;
}): void {
  proveedorToken = opciones.token;
  renovarSesion = opciones.renovar;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Se corta la petición si tarda demasiado, para no dejar la interfaz colgada. */
  timeoutMs?: number;
  /**
   * Marca las peticiones que NO deben intentar renovar la sesión.
   * La propia llamada de refresco lleva esto puesto: sin ello, un refresco
   * caducado dispararía otro refresco, y ese otro, en un bucle infinito.
   */
  sinRenovar?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return ejecutar<T>(path, options, true);
}

async function ejecutar<T>(
  path: string,
  options: RequestOptions,
  puedeReintentar: boolean,
): Promise<T> {
  const { body, timeoutMs = 20_000, headers, sinRenovar, ...rest } = options;
  const token = proveedorToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      ...rest,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new NetworkError(error);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = data as ApiErrorBody | null;
    const detalle = parsed?.error ?? {
      code: 'SYS-001',
      message: 'Algo salió mal por nuestra parte.',
    };

    // El token caducó: se renueva y se repite la petición una sola vez.
    // Un segundo fallo significa que la sesión terminó de verdad.
    if (detalle.code === 'AUTH-004' && puedeReintentar && !sinRenovar && renovarSesion) {
      const renovada = await renovarSesion();
      if (renovada) return ejecutar<T>(path, options, false);
    }

    throw new ApiError(response.status, detalle);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
