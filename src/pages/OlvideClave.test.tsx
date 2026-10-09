import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OlvideClave } from './OlvideClave';

/**
 * Recuperar la cuenta, que es la pantalla a la que se llega habiendo perdido el
 * acceso.
 *
 * Es la única de la aplicación donde quien la mira ya está fuera: no puede
 * probar otra cosa, no puede seguir estudiando y no tiene a quién preguntar. Si
 * aquí se le dice algo que no es verdad, se queda esperando un correo que no
 * va a llegar, y no vuelve.
 *
 * Por eso lo que se vigila no es que el formulario funcione —eso se ve— sino
 * las tres cosas que fallan en silencio:
 *
 *   · que NO se prometa un correo cuando no hay servicio para mandarlo;
 *   · que si hay otra forma de entrar, se diga cuál;
 *   · que un código equivocado lo diga, en vez de quedarse quieto.
 */

/** Lo que contesta `/auth/proveedores`: con qué se puede entrar hoy. */
let proveedores = {
  google: { disponible: false },
  correo: { disponible: false, pruebaLocal: false },
};
/** Lo que contesta el servidor a cada POST. Una función para poder fallar. */
let responder: (ruta: string, cuerpo: unknown) => Promise<unknown> = () => Promise.resolve({});

/*
  La clase del error va en `vi.hoisted` y no suelta.

  Las fábricas de `vi.mock` se izan por encima de todo el archivo, así que una
  clase declarada aquí abajo todavía no existe cuando la fábrica la usa y el
  archivo entero revienta antes de correr una sola prueba.
*/
const { ApiErrorFalso } = vi.hoisted(() => ({
  ApiErrorFalso: class extends Error {
    code = 'AUT-010';
    status = 400;
    fieldErrors: Record<string, string> = {};
    constructor(mensaje: string, campos: Record<string, string> = {}) {
      super(mensaje);
      this.fieldErrors = campos;
    }
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: () => Promise.resolve(proveedores),
    post: (ruta: string, cuerpo: unknown) => responder(ruta, cuerpo),
  },
  ApiError: ApiErrorFalso,
}));

vi.mock('@/lib/auth', () => ({
  proveedoresDeEntrada: () => Promise.resolve(proveedores),
}));

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <OlvideClave />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  proveedores = {
    google: { disponible: false },
    correo: { disponible: false, pruebaLocal: false },
  };
  responder = () => Promise.resolve({ message: 'Hecho.' });
});

describe('recuperar la cuenta', () => {
  it('sin servicio de correo, no promete ningún correo', async () => {
    pintar();

    await screen.findByText(/todavía no podemos mandarte el correo/i);

    /*
      Lo que no puede aparecer: una promesa de envío. El servidor contestaba
      «si ese correo tiene cuenta, te enviamos instrucciones» y era mentira —el
      código se genera y se guarda, pero no hay nada que lo mande—. Quien llega
      aquí se queda esperando para siempre.
    */
    expect(screen.queryByText(/te mandamos cómo volver a entrar/i)).not.toBeInTheDocument();
  });

  it('si se puede entrar con Google, lo dice en vez de dejar sin salida', async () => {
    proveedores = {
      google: { disponible: true },
      correo: { disponible: false, pruebaLocal: false },
    };
    pintar();

    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent(/entra con Google/i);
    expect(aviso).toHaveTextContent(/Seguridad/i);
  });

  it('sin correo y sin Google lo reconoce, en vez de disimular', async () => {
    pintar();

    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent(/no podemos devolverte el acceso desde aquí/i);
  });

  it('con servicio de correo sí ofrece el formulario', async () => {
    proveedores = {
      google: { disponible: false },
      correo: { disponible: true, pruebaLocal: false },
    };
    pintar();

    await screen.findByText(/te mandamos cómo volver a entrar/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('un código equivocado se cuenta, no se traga', async () => {
    proveedores = {
      google: { disponible: false },
      correo: { disponible: true, pruebaLocal: true },
    };
    const usuario = userEvent.setup();

    responder = (ruta) => {
      if (ruta.includes('forgot-password')) {
        return Promise.resolve({
          message: 'Te hemos mandado un código.',
          codigoDesarrollo: '123456',
        });
      }
      return Promise.reject(new ApiErrorFalso('Ese código ya no vale. Pide uno nuevo.'));
    };

    pintar();
    await screen.findByText(/te mandamos cómo volver a entrar/i);

    await usuario.type(screen.getByLabelText(/correo/i), 'alguien@speakmi.test');
    await usuario.click(screen.getByRole('button', { name: /enviar|continuar|mandar|pedir/i }));

    // Segundo paso: el código llega relleno en local.
    await screen.findByText(/elige una contraseña nueva/i);
    await usuario.type(screen.getByLabelText(/contraseña/i), 'unaClaveSegura123');
    await usuario.click(screen.getByRole('button', { name: /cambiar|guardar|confirmar/i }));

    /*
      Lo que importa: que el mensaje del servidor llegue a la pantalla. Un
      código caducado sin aviso deja a alguien pulsando el botón otra vez,
      convencido de que no funciona la app.
    */
    expect(await screen.findByText(/ese código ya no vale/i)).toBeInTheDocument();
  });
});
