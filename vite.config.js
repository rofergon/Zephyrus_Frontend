import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import rollupNodePolyFill from 'rollup-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    NodeGlobalsPolyfillPlugin({
      buffer: true,
      process: true
    }),
    NodeModulesPolyfillPlugin()
  ],
  define: {
    'global': 'globalThis',
    'process.env': process.env ?? {},
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      plugins: [rollupNodePolyFill()],
      output: {
        manualChunks: undefined
      },
      external: [
        '@safe-global/safe-apps-sdk',
        '@safe-global/safe-apps-provider'
      ]
    }
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      events: 'rollup-plugin-node-polyfills/polyfills/events',
      util: 'rollup-plugin-node-polyfills/polyfills/util',
      url: 'url',
      assert: 'assert',
      process: 'process/browser',
      buffer: 'rollup-plugin-node-polyfills/polyfills/buffer-es6',
      '@openzeppelin/contracts': './node_modules/@openzeppelin/contracts',
      '@safe-globalThis/safe-apps-sdk': '@safe-global/safe-apps-sdk',
      '@safe-globalThis/safe-apps-provider': '@safe-global/safe-apps-provider'
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true
        }),
        NodeModulesPolyfillPlugin()
      ]
    },
    include: [
      'process/browser',
      '@safe-global/safe-apps-sdk',
      '@safe-global/safe-apps-provider'
    ]
  },
  server: {
    fs: {
      allow: ['..', 'node_modules']
    }
  }
})