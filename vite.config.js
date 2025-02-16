import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import { resolve } from 'path'

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
    'process.env': process.env ?? {},
    'process.env.VITE_WORKER_URL': JSON.stringify('/src/workers/solc.worker.js')
  },
  worker: {
    format: 'es',
    plugins: [
      NodeGlobalsPolyfillPlugin({
        buffer: true,
        process: true
      }),
      NodeModulesPolyfillPlugin()
    ],
    rollupOptions: {
      output: {
        format: 'es',
        inlineDynamicImports: true,
        chunkFileNames: 'assets/workers/[name]-[hash].js',
      }
    }
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true
    },
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        worker: resolve(__dirname, 'src/workers/solc.worker.js')
      },
      plugins: [nodePolyfills()],
      output: {
        manualChunks: {
          'vendor': [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          'monaco': [
            'monaco-editor',
          ],
          'web3': [
            'web3'
          ],
          'solc': [
            'solc',
            'browserify-fs'
          ]
        },
        format: 'es',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
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
      events: 'events',
      util: 'util',
      url: 'url',
      assert: 'assert',
      process: 'process/browser',
      buffer: 'buffer',
      '@openzeppelin/contracts': './node_modules/@openzeppelin/contracts',
      '@safe-global/safe-apps-sdk': '@safe-global/safe-apps-sdk',
      '@safe-global/safe-apps-provider': '@safe-global/safe-apps-provider',
      'solc-browserify': './src/services/solc-browserify',
      'fs': 'browserify-fs'
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
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
      '@safe-global/safe-apps-provider',
      'solc',
      'browserify-fs'
    ]
  },
  server: {
    fs: {
      allow: ['..', 'node_modules']
    }
  }
})