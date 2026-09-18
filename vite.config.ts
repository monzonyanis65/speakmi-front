import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Un año y un día, en segundos. Se nombran para que las caducidades de abajo
// se lean como una decisión y no como un número suelto.
const UN_ANO = 60 * 60 * 24 * 365;
const UN_DIA = 60 * 60 * 24;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Se pregunta antes de actualizar en vez de hacerlo solo. Con 'autoUpdate'
      // el service worker recarga la página por su cuenta, y hacerlo a mitad de
      // una lección tiraría por la borda lo que la persona lleve respondido.
      // Con 'prompt', el aviso espera a que termine. Ver AvisoActualizacion.tsx.
      registerType: 'prompt',
      // Los iconos ya los recoge el globPatterns de abajo; dejar que el plugin
      // los añada otra vez duplicaría cinco entradas del precaché.
      includeManifestIcons: false,
      manifest: {
        name: 'Speakmi',
        short_name: 'Speakmi',
        description:
          'Aprende inglés hablando: Speakmi te escucha y te corrige la pronunciación palabra por palabra.',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'es',
        categories: ['education'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Android recorta el icono con la forma que quiera el fabricante; el
          // maskable lleva margen de sobra para que Milo nunca pierda la cabeza.
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Incluye lo que el build genera y también lo copiado de public/:
        // los iconos y el favicon tienen que estar sin red.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        // Sin esto, entrar directo a /ruta o /leccion/x sin red daría un 404:
        // el router vive en index.html y es index.html lo que hay que servir.
        navigateFallback: '/index.html',
        // …salvo para la API, que no es navegación y debe fallar como tal.
        navigateFallbackDenylist: [/^\/api\//],
        // El orden importa: Workbox se queda con la primera regla que encaja.
        runtimeCaching: [
          {
            // Las fuentes son inmutables y pesan: una vez descargadas, no se
            // vuelven a pedir jamás.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-hojas',
              expiration: { maxEntries: 20, maxAgeSeconds: UN_ANO },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-ficheros',
              expiration: { maxEntries: 40, maxAgeSeconds: UN_ANO },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // El currículo cambia cada muchos meses, así que se puede ojear la
            // ruta de lecciones en el metro. Va antes que la regla general.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/curriculum/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-curriculo',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: UN_DIA },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Todo lo demás de la API es progreso, sesión y correcciones de voz:
            // servir una copia vieja sería mentirle a quien estudia.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        // Apagado a propósito: un service worker en desarrollo sirve versiones
        // viejas del código y hace perder tardes enteras.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    // Escucha en todas las direcciones, no solo en localhost. Es lo que permite
    // abrir la aplicación desde el móvil escribiendo la IP del portátil, que es
    // la única forma de ver de verdad cómo queda en un teléfono.
    host: true,
    // En local la API va por aquí, así que el navegador ve un solo origen,
    // igual que en producción con la reescritura de Vercel.
    // Ver docs/07-entornos-local-y-produccion.md en speakmi-back.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
