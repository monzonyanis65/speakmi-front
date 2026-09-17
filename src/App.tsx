import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Bienvenida } from '@/pages/Bienvenida';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Reintentar un error de validación o de permisos no arregla nada.
      retry: (intento, error) => intento < 2 && !(error instanceof Error && 'code' in error),
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Bienvenida />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
