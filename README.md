# Speakmi · frontend

Interfaz web de Speakmi, la app para aprender inglés hablando. Responsive para PC y móvil, instalable como
aplicación web progresiva.

**Estado:** repositorio recién creado. Todavía sin código.

## Documentación

Toda la documentación de producto y arquitectura vive en el repositorio del backend,
[speakmi-back](https://github.com/monzonyanis65/speakmi-back), dentro de la carpeta `docs`. Lo más relevante
para quien trabaje aquí:

- Diseño de interfaz, identidad visual y mapa de pantallas, en `docs/06-diseno-ui-ux.md`.
- Los ocho tipos de ejercicio y el contrato con la API, en `docs/03-arquitectura.md`.
- Cómo funciona el entorno local y el despliegue en Vercel, en `docs/07-entornos-local-y-produccion.md`.

## Stack previsto

React 19 con Vite y TypeScript estricto, Tailwind CSS con shadcn/ui, TanStack Query para el estado de
servidor, Zustand para el estado de la sesión de lección, React Router y Workbox para la aplicación web
progresiva. La grabación de voz usa MediaRecorder y la API de voz del navegador.

## Puesta en marcha

Pendiente hasta que se complete la fase 0 del plan de implementación.

```bash
npm install
npm run dev
```

La aplicación espera encontrar el backend en la dirección indicada por `VITE_API_URL`.
