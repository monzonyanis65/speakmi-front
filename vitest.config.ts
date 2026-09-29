import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Configuración de pruebas, separada de vite.config.ts a propósito.
 * Vitest incluye su propia copia de Vite y mezclar ambas hace chocar los tipos.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    /*
      Treinta segundos por prueba, no los cinco de serie. Lo mismo que en el
      back, y por lo mismo.

      Estas pruebas montan componentes de verdad en jsdom y muchas esperan a
      que algo aparezca en pantalla. En una máquina descansada sobra con cinco
      segundos, pero la suite corre varios archivos a la vez y bajo esa carga
      se caían por tiempo pruebas que estaban bien: cada día una distinta, y
      todas pasaban al correrlas solas.

      Una prueba que se pone roja según lo ocupada que esté la máquina enseña a
      no hacer caso del rojo, que es justo lo que no puede pasar aquí.
    */
    testTimeout: 30_000,
  },
});
