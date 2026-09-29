import { useSearchParams } from 'react-router-dom';
import { Shadowing } from '@/components/ejercicios/Shadowing';

/**
 * Banco de pruebas del shadowing.
 *
 * Existe para poder terminar y mirar la pantalla mientras el ejercicio no está
 * cosido a la lección: el componente de verdad es `components/ejercicios/Shadowing`.
 * Va sin sesión, como `/vivo`, porque lo que se viene a ver aquí es el audio y
 * el ritmo, y pedir login para eso solo estorba a quien revisa.
 *
 * Los interruptores de la URL enseñan los caminos honestos, que son justo los
 * que no se ven nunca por casualidad:
 *
 *   /shadowing?sin-tiempos=1   el proveedor no da tiempos por palabra
 *   /shadowing?sin-ritmo=1     el servidor no puede medir el ritmo
 *   /shadowing?real=1          sin doble: se pide al servidor de verdad
 */
export function PruebaShadowing() {
  const [parametros] = useSearchParams();

  return (
    <main className="min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
      <h1 className="mx-auto max-w-md px-4 pt-6 text-2xl font-bold">Shadowing</h1>
      <Shadowing
        ejercicio={{ code: parametros.get('code') ?? 'L6-U1-01-E07' }}
        opciones={{
          simular: parametros.get('real') !== '1',
          sinTiempos: parametros.get('sin-tiempos') === '1',
          sinRitmo: parametros.get('sin-ritmo') === '1',
        }}
      />
    </main>
  );
}
