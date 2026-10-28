import { defineConfig } from 'vite';

const allowedHosts = ['.preview.codesignalusercontent-staging.com'];

export default defineConfig({
  root: './client',
  server: { port: 3000, allowedHosts },
  preview: { allowedHosts },
  build: { outDir: '../dist', emptyOutDir: true }
});
