import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import nodePolyfills from 'rollup-plugin-polyfill-node'

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
        inlineDynamicImports: true
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
            'memfs'
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
      'fs': 'memfs'
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
      'memfs'
    ]
  },
  server: {
    fs: {
      allow: ['..', 'node_modules']
    }
  }
})