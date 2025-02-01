// Import solc wrapper
import wrapper from 'solc/wrapper';
import { virtualFS } from '../services/virtual-fs';

let compiler = null;
let compilerInitPromise = null;
let isInitializing = false;

// Initialize compiler
async function initCompiler() {
  if (compiler) {
    return compiler;
  }

  if (compilerInitPromise) {
    return compilerInitPromise;
  }

  if (isInitializing) {
    // Esperar un poco y reintentar
    await new Promise(resolve => setTimeout(resolve, 100));
    return initCompiler();
  }

  isInitializing = true;
  console.log('[Worker] Starting compiler initialization');

  compilerInitPromise = (async () => {
    try {
      const wasmBinaryURL = 'https://binaries.soliditylang.org/bin/soljson-v0.8.20+commit.a1b79de6.js';
      const response = await fetch(wasmBinaryURL);
      if (!response.ok) {
        throw new Error(`Failed to fetch compiler: ${response.statusText}`);
      }
      const code = await response.text();
      
      return new Promise((resolve, reject) => {
        const Module = {
          print: (text) => console.log('[Solc]', text),
          printErr: (text) => console.error('[Solc Error]', text),
          onRuntimeInitialized: () => {
            try {
              const solc = wrapper(Module);
              solc.loadRemoteVersion = (x, cb) => cb(null, solc);
              compiler = solc;
              console.log('[Worker] Compiler initialized successfully');
              resolve(solc);
            } catch (err) {
              console.error('[Worker] Failed to initialize compiler:', err);
              reject(err);
            } finally {
              isInitializing = false;
              compilerInitPromise = null;
            }
          }
        };

        try {
          console.log('[Worker] Evaluating compiler code');
          const initialize = new Function('Module', code);
          initialize(Module);
        } catch (err) {
          isInitializing = false;
          compilerInitPromise = null;
          console.error('[Worker] Failed to evaluate compiler code:', err);
          reject(err);
        }
      });
    } catch (error) {
      isInitializing = false;
      compilerInitPromise = null;
      console.error('[Worker] Compiler initialization failed:', error);
      throw error;
    }
  })();

  return compilerInitPromise;
}

// Improved import resolution function
async function findImports(path, fromPath) {
  console.log('[Worker] Resolving import:', path, 'from:', fromPath);
  
  try {
    // Usar el sistema de archivos virtual para resolver la importación
    const { path: resolvedPath, content } = await virtualFS.resolveImport(path, fromPath);
    console.log('[Worker] Successfully resolved import:', resolvedPath);
    return { contents: content };
  } catch (error) {
    console.error('[Worker] Import resolution error:', error);
    return { error: error.message };
  }
}

// Improved compilation function
async function compileContract(sourceCode, sourcePath = 'main.sol') {
  try {
    console.log('[Worker] Compiling contract from:', sourcePath);
    
    // Asegurarse de que el compilador esté inicializado
    const solc = await initCompiler();
    if (!solc) {
      throw new Error('Failed to initialize compiler');
    }
    
    // Prepare input for the compiler
    const input = {
      language: 'Solidity',
      sources: {
        [sourcePath]: {
          content: sourceCode
        }
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        outputSelection: {
          '*': {
            '*': ['*']
          }
        }
      }
    };

    // Pre-cargar las importaciones conocidas
    const imports = sourceCode.match(/import\s+(?:{[^}]+}\s+from\s+)?["'][^"']+["']/g) || [];
    console.log('[Worker] Found imports:', imports);

    for (const importStatement of imports) {
      const match = importStatement.match(/["'](.*?)["']/);
      if (match) {
        const path = match[1];
        try {
          const { path: resolvedPath, content } = await virtualFS.resolveImport(path, sourcePath);
          console.log('[Worker] Pre-loaded import:', resolvedPath);
          input.sources[resolvedPath] = { content };
        } catch (error) {
          console.warn('[Worker] Could not pre-load import:', path, error);
        }
      }
    }

    console.log('[Worker] Compiling with input:', input);
    const jsonInput = JSON.stringify(input);
    const output = JSON.parse(solc.compile(jsonInput, { 
      import: async (path) => {
        try {
          const { content } = await virtualFS.resolveImport(path, sourcePath);
          return { contents: content };
        } catch (error) {
          console.error('[Worker] Import resolution error:', error);
          return { error: error.message };
        }
      }
    }));
    
    return output;
  } catch (error) {
    console.error('[Worker] Compilation error:', error);
    throw error;
  }
}

// Update the main message handler
self.onmessage = async (event) => {
  try {
    const { sourceCode, sourcePath } = event.data;
    
    // Compile the contract
    const output = await compileContract(sourceCode, sourcePath);
    
    // Process compilation results
    const markers = [];
    
    if (output.errors) {
      output.errors.forEach(error => {
        const lineMatch = error.formattedMessage.match(/:(\d+):/);
        const lineNumber = lineMatch ? parseInt(lineMatch[1]) : 1;
        
        markers.push({
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: 1000,
          message: error.formattedMessage || error.message,
          severity: error.severity === 'error' ? 8 : 4
        });
      });
    }

    self.postMessage({ markers, output });
  } catch (error) {
    console.error('[Worker] Error:', error);
    self.postMessage({
      error: error.message,
      markers: [{
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        message: `Compilation error: ${error.message}`,
        severity: 8
      }]
    });
  }
};