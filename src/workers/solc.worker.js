// Explicitly mark as module worker
self.window = self; // Some libraries expect window to be defined

import * as solc from 'solc';

console.log('[Worker] Initializing solc worker...');

try {
  // Configuración del worker
  self.onmessage = async (e) => {
    console.log('[Worker] Message received:', e.data);
    const { sourceCode, sourcePath } = e.data;

    try {
      // Preparar input para el compilador
      const input = {
        language: 'Solidity',
        sources: {
          'Compiled_Contracts': {
            content: sourceCode
          }
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['*']
            }
          },
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      };

      console.log('[Worker] Compiling with solc...');
      const output = JSON.parse(solc.compile(JSON.stringify(input)));
      console.log('[Worker] Compilation completed');

      if (output.errors) {
        const markers = output.errors.map(error => ({
          severity: error.severity === 'error' ? 8 : 4,
          message: error.message,
          startLineNumber: error.sourceLocation?.start || 1,
          startColumn: 1,
          endLineNumber: error.sourceLocation?.end || 1,
          endColumn: 1
        }));

        self.postMessage({ markers, output });
      } else {
        self.postMessage({ output });
      }
    } catch (error) {
      console.error('[Worker] Compilation error:', error);
      self.postMessage({
        error: `Compilation error: ${error.message || 'Unknown error'}`
      });
    }
  };

  console.log('[Worker] Worker initialized successfully');
} catch (error) {
  console.error('[Worker] Worker initialization error:', error);
  self.postMessage({
    error: `Worker initialization error: ${error.message || 'Unknown error'}`
  });
}