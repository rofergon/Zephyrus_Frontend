import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    deps: {
      inline: [
        '@monaco-editor/react',
        'monaco-editor'
      ]
    },
    threads: false, // Disable threading for more stable tests
    environmentOptions: {
      jsdom: {
        url: 'http://localhost'
      }
    }
  }
}); 