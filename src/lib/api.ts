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

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Se corta la petición si tarda demasiado, para no dejar la interfaz colgada. */
  timeoutMs?: number;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, timeoutMs = 20_000, headers, ...rest } = options;

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
    throw new ApiError(
      response.status,
      parsed?.error ?? { code: 'SYS-001', message: 'Algo salió mal por nuestra parte.' },
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
