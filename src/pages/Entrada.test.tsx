import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Entrada } from './Entrada';
import { useSesion } from '@/store/sesion';

/**
 * La pantalla de acceso.
 *
 * Lo que se comprueba aquí es lo que se rompía de verdad: una errata al teclear
 * la contraseña dejaba a alguien fuera de su cuenta para siempre, porque no hay
 * envío de correo; y el botón de Google no puede aparecer cuando el servidor
 * dice que no está configurado.
 */

/** Qué contesta el servidor de mentira a cada dirección. */
let respuestas: Record<string, { estado: number; cuerpo: unknown }>;

function servidorDeMentira() {
  return vi.fn((url: string) => {
    const ruta = new URL(url, 'http://localhost').pathname;
    const guion = respuestas[ruta];

    if (!guion) return Promise.reject(new Error(`sin guion para ${ruta}`));

    return Promise.resolve(
      new Response(JSON.stringify(guion.cuerpo), {
        status: guion.estado,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

function renderizar(direccion = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[direccion]}>
        <Entrada />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useSesion.getState().cerrar();
  respuestas = {
    '/api/auth/proveedores': {
      estado: 200,
      cuerpo: { google: { disponible: false }, correo: { disponible: false } },
    },
  };
  vi.stubGlobal('fetch', servidorDeMentira());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('crear cuenta con la contraseña repetida', () => {
  it('no manda nada al servidor si las dos contraseñas no coinciden', async () => {
    const persona = userEvent.setup();
    renderizar();

    await persona.click(screen.getByRole('button', { name: 'Soy nuevo' }));

    await persona.type(screen.getByLabelText('¿Cómo te llamas?'), 'Yanis');
    await persona.type(screen.getByLabelText('Correo'), 'yanis@speakmi.test');
    await persona.type(screen.getByLabelText('Contraseña'), 'unaClaveSegura123');
    await persona.type(screen.getByLabelText('Repite la contraseña'), 'unaClaveSegura124');

    await persona.click(screen.getByRole('button', { name: 'CREAR MI CUENTA' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden');

    /*
      Esto es lo importante: la cuenta NO se crea. Antes de tener el segundo
      campo, esa errata se guardaba como contraseña buena y la persona se
      quedaba fuera de su propia cuenta sin ninguna forma de volver.
    */
    const peticiones = (globalThis.fetch as unknown as { mock: { calls: string[][] } }).mock.calls;
    expect(peticiones.some(([url]) => url?.includes('/auth/register'))).toBe(false);
  });

  it('cuando coinciden, crea la cuenta', async () => {
    const persona = userEvent.setup();
    respuestas['/api/auth/register'] = {
      estado: 201,
      cuerpo: {
        user: { id: '1', email: 'yanis@speakmi.test', displayName: 'Yanis', role: 'student' },
        accessToken: 'un-token',
      },
    };

    renderizar();
    await persona.click(screen.getByRole('button', { name: 'Soy nuevo' }));

    await persona.type(screen.getByLabelText('¿Cómo te llamas?'), 'Yanis');
    await persona.type(screen.getByLabelText('Correo'), 'yanis@speakmi.test');
    await persona.type(screen.getByLabelText('Contraseña'), 'unaClaveSegura123');
    await persona.type(screen.getByLabelText('Repite la contraseña'), 'unaClaveSegura123');

    await persona.click(screen.getByRole('button', { name: 'CREAR MI CUENTA' }));

    await waitFor(() => {
      expect(useSesion.getState().usuario?.email).toBe('yanis@speakmi.test');
    });
  });

  it('el campo repetido no existe al entrar, solo al crear cuenta', async () => {
    renderizar();

    expect(screen.queryByLabelText('Repite la contraseña')).not.toBeInTheDocument();
  });
});

describe('cómo se anuncia el campo de contraseña', () => {
  it('la ayuda no forma parte del nombre del campo', async () => {
    const persona = userEvent.setup();
    renderizar();
    await persona.click(screen.getByRole('button', { name: 'Soy nuevo' }));

    /*
      Con la etiqueta envolviendo al campo, su nombre accesible salía de todo el
      texto de dentro: un lector de pantalla anunciaba «Contraseña Al menos 8
      caracteres». Buscarlo por el nombre exacto es lo que lo demuestra.
    */
    const campo = screen.getByLabelText('Contraseña');
    expect(campo).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña Al menos 8 caracteres')).not.toBeInTheDocument();

    // Y la ayuda se sigue leyendo, pero como descripción.
    const descrita = campo.getAttribute('aria-describedby');
    expect(descrita).toBeTruthy();
    expect(document.getElementById(descrita!)).toHaveTextContent('Al menos 8 caracteres');
  });
});

describe('entrar con Google', () => {
  it('sin credenciales en el servidor, el botón no se ofrece', async () => {
    renderizar();

    // Se espera a que la consulta termine para no dar por bueno un «todavía no».
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ENTRAR' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: /Google/ })).not.toBeInTheDocument();
  });

  it('con credenciales, el botón lleva al servidor y no a una pantalla rota', async () => {
    respuestas['/api/auth/proveedores'] = {
      estado: 200,
      cuerpo: { google: { disponible: true }, correo: { disponible: false } },
    };

    renderizar();

    const enlace = await screen.findByRole('link', { name: /Entrar con Google/ });
    // Un enlace de verdad, no un `onClick`: la vuelta de Google tiene que poner
    // una cookie, y eso solo pasa en una navegación del navegador.
    expect(enlace).toHaveAttribute('href', '/api/auth/google/start');
  });

  it('cuenta lo que pasó cuando Google no confirmó el correo', async () => {
    renderizar('/?google=AUTH-011');

    expect(await screen.findByRole('alert')).toHaveTextContent('no nos confirmó');
  });

  it('quien cancela en Google vuelve sin ningún aviso rojo', async () => {
    renderizar('/?google=cancelado');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ENTRAR' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
