import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Giro Certo — Controle de Ganhos',
          short_name: 'Giro Certo',
          description:
            'Aplicativo para motoristas e entregadores de aplicativo controlarem ganhos, despesas, jornadas de trabalho e lucro real.',
          lang: 'pt-BR',
          display: 'standalone',
          orientation: 'portrait-primary',
          background_color: '#060910',
          theme_color: '#090d16',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icons/icon-maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Apenas o essencial vai para o precache. O arquivo original de branding
          // (public/branding/giro-certo-icon-original.png, ~1,9 MB) fica de fora.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
          globIgnores: ['**/branding/**', '**/giro-certo-icon-original.png'],
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts',
                expiration: {
                  maxEntries: 8,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': import.meta.dirname,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});