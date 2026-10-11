import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm start` serves the app at http://localhost:3000 and opens it in your browser.
// If port 3000 is busy, Vite picks the next free port and prints the address.
// Set NO_OPEN=1 to stop the browser opening automatically.
const openBrowser = !process.env.CI && !process.env.NO_OPEN;

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: false,
    open: openBrowser,
  },
  preview: {
    host: 'localhost',
    port: 4173,
    strictPort: false,
    open: openBrowser,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Keep the 470 KB bag-frame atlas as its own cached file instead of inlining it.
    assetsInlineLimit: 4096,
  },
});
