import { defineConfig } from 'vite';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

export default defineConfig({
  build: {
    target: 'esnext',
    lib: {
      entry: 'src/workers/solc.worker.ts',
      formats: ['es'],
      fileName: 'solc.worker'
    },
    rollupOptions: {
      external: ['vite'],
    },
  },
  plugins: [
    NodeGlobalsPolyfillPlugin({
      buffer: true,
      process: true
    }),
    NodeModulesPolyfillPlugin()
  ],
}); 