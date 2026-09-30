import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

/**
 * The landing pages: fills `%site.key%` from landing/site.json (developer, contact, store links), and drops the app
 * manifest link the PWA plugin adds to every page, since the website is not the installable game.
 */
const site = () => ({
  name: 'landing-site',
  enforce: 'post' as const,
  transformIndexHtml: {
    order: 'post' as const,
    handler(html: string, ctx: { filename: string }) {
      if (!ctx.filename.replace(/\\/g, '/').includes('/landing/')) return html;
      const v = JSON.parse(readFileSync(resolve(__dirname, 'landing/site.json'), 'utf8')) as Record<string, string>;
      return html.replace(/%site\.(\w+)%/g, (m, k: string) => k in v ? v[k] : m).replace(/\s*<link rel="manifest"[^>]*>/g, '');
    },
  },
});

// Relative base so the build works under the GitHub Pages sub-path (/Starfall.Grove/).
// The PWA plugin writes a service worker that keeps every game file (code, fonts, icons) on the device, so after the
// first visit the game opens with no connection, and an app manifest so it can be installed to the home screen.
// The landing page and its legal pages (landing/) are built alongside the game and served at /landing/. They are a
// website, not part of the game: the service worker never keeps them and never answers for them.
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
        globIgnores: ['**/starfall-grove-game-icon.png', '**/icon-512.png', '**/icon-maskable-512.png', 'landing/**', 'assets/site-*'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/landing\//],
        cleanupOutdatedCaches: true,
      },
    }),
    site(),
  ],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'site-home': resolve(__dirname, 'landing/index.html'),
        'site-privacy': resolve(__dirname, 'landing/privacy.html'),
        'site-terms': resolve(__dirname, 'landing/terms.html'),
        'site-support': resolve(__dirname, 'landing/support.html'),
        'site-imprint': resolve(__dirname, 'landing/imprint.html'),
      },
    },
  },
});
