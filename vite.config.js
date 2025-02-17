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
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.includes('solc.worker')) {
            return 'assets/workers/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true
    },
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      plugins: [nodePolyfills()],
      input: {
        main: resolve(__dirname, 'index.html'),
        'solc.worker': resolve(__dirname, 'src/workers/solc.worker.js')
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('monaco-editor')) {
              if (id.includes('editor.worker')) return 'monaco.editor.worker';
              if (id.includes('json.worker')) return 'monaco.json.worker';
              if (id.includes('typescript.worker')) return 'monaco.ts.worker';
              return 'monaco.editor';
            }
            if (id.includes('react')) return 'vendor';
            if (id.includes('web3')) return 'web3';
            if (id.includes('solc') || id.includes('memfs')) return 'solc';
            if (id.includes('wagmi') || id.includes('viem') || id.includes('@wagmi')) return 'wagmi';
            return 'vendor'; // all other node_modules
          }
        },
        format: 'es',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          if (assetInfo.name.includes('worker')) {
            return 'assets/workers/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name.includes('worker')) {
            return 'assets/workers/[name].js';
          }
          return 'assets/js/[name]-[hash].js';
        }
      }
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
        global: 'window'
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
      'memfs',
      'buffer',
      'process',
      'wagmi',
      'viem',
      '@wagmi/core',
      '@wagmi/connectors',
      'monaco-editor',
      'monaco-editor/esm/vs/editor/editor.worker',
      'monaco-editor/esm/vs/language/json/json.worker',
      'monaco-editor/esm/vs/language/typescript/ts.worker'
    ]
  },
  server: {
    fs: {
      allow: ['..', 'node_modules']
    }
  }
})