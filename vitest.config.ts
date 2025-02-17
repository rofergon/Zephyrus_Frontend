/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import vite from './vite.config';

export default mergeConfig(
  vite,
  defineConfig({
    plugins: [react()],
    define: {
      'process.env': {}
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      testTimeout: 20000,
      coverage: {
        provider: 'istanbul',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/setup.ts',
        ],
      },
      deps: {
        inline: [/monaco-editor/],
      },
      alias: {
        'monaco-editor': 'monaco-editor/esm/vs/editor/editor.api.js',
      },
    }
  })
); 