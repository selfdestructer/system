/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build` → dist/ (hashed assets, relative base: works on GitHub Pages or any folder).
// `vite build --mode single` → dist-single/index.html, one self-contained file for the
// claude.ai artifact preview.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: single ? [react(), viteSingleFile()] : [react()],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      emptyOutDir: true,
      target: 'es2020',
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
