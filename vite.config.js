import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm start` serves the app at http://localhost:3000 and opens it in your browser.
// If port 3000 is busy, Vite picks the next free port and prints the address.
// Set NO_OPEN=1 to stop the browser opening automatically.
const openBrowser = !process.env.CI && !process.env.NO_OPEN;

/**
 * The App chunk is loaded lazily (so its CSS never blocks the instant poster), which would
 * normally make the browser wait for the entry script before even requesting it. This adds
 * <link rel="modulepreload"> / <link rel="preload" as="style"> hints so the App chunk and its
 * styles download in parallel with the entry, and records the chunk's URLs for main.jsx's
 * retry. Hints only: if anything here fails, the build is unchanged.
 */
function preloadAppChunk() {
  let base = '/';
  return {
    name: 'swish-preload-app-chunk',
    apply: 'build',
    configResolved(config) {
      base = config.base || '/';
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        try {
          const tags = [];
          for (const chunk of Object.values(ctx.bundle || {})) {
            if (chunk.type !== 'chunk' || !chunk.isDynamicEntry) continue;
            if (!/[\\/]src[\\/]App\.jsx$/.test(chunk.facadeModuleId || '')) continue;
            const css = [...(chunk.viteMetadata?.importedCss || [])].map((file) => base + file);
            tags.push({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: base + chunk.fileName }, injectTo: 'head' });
            for (const href of css) {
              tags.push({ tag: 'link', attrs: { rel: 'preload', as: 'style', crossorigin: '', href }, injectTo: 'head' });
            }
            // Where the App chunk lives, so main.jsx can retry it under a fresh URL: browsers
            // remember a failed module download for the page's lifetime.
            tags.push({
              tag: 'script',
              children: `window.__swishApp=${JSON.stringify({ js: base + chunk.fileName, css })};`,
              injectTo: 'head',
            });
          }
          return tags;
        } catch (error) {
          console.warn('[swish] could not add preload hints:', error);
          return [];
        }
      },
    },
  };
}

/**
 * Strip metadata from the WebP images in the build. Copying files around (e.g. on Windows) can
 * append provenance / EXIF / XMP chunks (~6 KB each) that browsers never use; on a slow
 * connection every kilobyte counts. Only the image data chunks are kept. Any file that does not
 * parse as a plain RIFF/WebP is left untouched.
 */
const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);
function stripWebp(input) {
  const buf = Buffer.from(input);
  if (buf.length < 20 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
  const parts = [buf.subarray(0, 12)];
  let dropped = false;
  let i = 12;
  while (i + 8 <= buf.length) {
    const tag = buf.toString('latin1', i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const end = i + 8 + size + (size & 1);
    if (end > buf.length) return null; // malformed: leave the file alone
    if (WEBP_KEEP.has(tag)) parts.push(buf.subarray(i, end));
    else dropped = true;
    i = end;
  }
  if (!dropped) return null;
  const out = Buffer.concat(parts);
  out.writeUInt32LE(out.length - 8, 4);
  const first = out.toString('latin1', 12, 16);
  if (first === 'VP8X') out[20] &= ~0x0c; // the EXIF / XMP flags no longer apply
  return out;
}
function stripWebpMetadata() {
  return {
    name: 'swish-strip-webp-metadata',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !/\.webp$/i.test(file.fileName) || typeof file.source === 'string') continue;
        try {
          const stripped = stripWebp(file.source);
          if (stripped) file.source = new Uint8Array(stripped);
        } catch (error) {
          console.warn(`[swish] left ${file.fileName} as is:`, error);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), preloadAppChunk(), stripWebpMetadata()],
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
    // Small images (the backdrop) are inlined; the footage atlases and the plate stay files.
    assetsInlineLimit: 4096,
  },
});
