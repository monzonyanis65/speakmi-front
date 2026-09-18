import { QueryClient } from '@tanstack/react-query';

/**
 * El cliente de consultas, en su propio archivo.
 *
 * Vive fuera de `App.tsx` porque hay funciones sueltas, como la de guardar el
 * nivel, que necesitan tocar la caché sin ser componentes de React. Si el
 * cliente se crea dentro del árbol, esas funciones no llegan a él.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (intento, error) => intento < 2 && !(error instanceof Error && 'code' in error),
      refetchOnWindowFocus: false,
    },
  },
});
