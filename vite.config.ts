import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
// @ts-expect-error Módulo JS puro do servidor integrado
import { attachGameServer } from './server/gameServer.mjs';

function animeKombatBackendPlugin(): Plugin {
  return {
    name: 'animekombat-backend',
    configureServer(server) {
      attachGameServer(server.middlewares, server.httpServer);
    },
    configurePreviewServer(server) {
      attachGameServer(server.middlewares, server.httpServer);
    },
  };
}

export default defineConfig({
  plugins: [
    animeKombatBackendPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['assets/characters/manifest.json'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/characters\/manifest\.json$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ak-character-manifest-v2',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/assets\/characters\/.*\.(webp|png)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ak-character-assets-v4',
              expiration: {
                maxEntries: 15000,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/assets\/backgrounds\/.*\.(webp|png|jpg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ak-background-assets-v1',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
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
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    sourcemap: false,
  },
});
