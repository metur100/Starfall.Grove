import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the build works under the GitHub Pages sub-path (/Starfall.Grove/).
// The PWA plugin writes a service worker that keeps every game file (code, fonts, icons) on the device, so after the
// first visit the game opens with no connection, and an app manifest so it can be installed to the home screen.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon-192.png', 'apple-touch-icon.png', 'starfall.svg'],
      manifest: {
        name: 'Starfall Grove',
        short_name: 'Starfall',
        description: 'A storybook action RPG: four lands, five heroes and one fallen star.',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#0d1330',
        theme_color: '#0d1330',
        categories: ['games'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // The 1 MB source icon is only used by link previews; the app icons above are the small copies.
        globIgnores: ['**/starfall-grove-game-icon.png', '**/icon-512.png', '**/icon-maskable-512.png'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 800 },
});
