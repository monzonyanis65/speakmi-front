import '@testing-library/jest-dom/vitest';

/**
 * Un almacenamiento de verdad para las pruebas.
 *
 * El jsdom de esta configuración expone `localStorage` como un objeto vacío,
 * sin `getItem` ni `setItem`. El código de la aplicación no se entera porque
 * envuelve cada acceso en un `try`, pero eso significa que las pruebas del tema
 * y de los recordatorios estarían comprobando el camino de error en vez del
 * normal, que es justo lo que hay que comprobar.
 */
function almacenamientoDeMentira(): Storage {
  const datos = new Map<string, string>();

  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (clave: string) => datos.get(clave) ?? null,
    key: (indice: number) => [...datos.keys()][indice] ?? null,
    removeItem: (clave: string) => {
      datos.delete(clave);
    },
    setItem: (clave: string, valor: string) => {
      datos.set(clave, String(valor));
    },
  };
}

for (const nombre of ['localStorage', 'sessionStorage'] as const) {
  const actual = globalThis[nombre] as Storage | undefined;
  if (typeof actual?.getItem === 'function') continue;

  Object.defineProperty(globalThis, nombre, {
    value: almacenamientoDeMentira(),
    writable: true,
    configurable: true,
  });
}

/**
 * El segundo reloj de las pruebas, el que no se veía.
 *
 * `vitest.config.ts` ya sube a treinta segundos el tiempo de cada prueba, y aun
 * así seguían cayéndose por tiempo pruebas correctas: una distinta cada vez, y
 * todas verdes al correrlas solas. El motivo es que `findBy*` y `waitFor` NO
 * miran ese límite. Traen el suyo, de un segundo, y es el que saltaba.
 *
 * Subirlo no hace pasar nada que estuviera roto: si lo que se espera no llega a
 * aparecer, la prueba sigue fallando, solo que más tarde. Lo único que cambia
 * es que deja de depender de lo ocupada que esté la máquina — y una prueba que
 * se pone roja según la carga enseña a no hacer caso del rojo, que es lo que no
 * nos podemos permitir aquí.
 */
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 15_000 });
