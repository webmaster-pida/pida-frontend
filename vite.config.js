import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    createHtmlPlugin({
      minify: true,
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        privacidad: resolve(__dirname, 'privacidad.html'),
        terminos: resolve(__dirname, 'terminos.html'),
        unsubscribe: resolve(__dirname, 'unsubscribe.html'),
      },
    },
  },
});