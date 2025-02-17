// Explicitly mark as module worker
self.window = self; // Some libraries expect window to be defined

import { Solc } from '../services/solc-browserify';
import { virtualFS } from '../services/virtual-fs';

let compiler = null;
const fileCache = new Map();

// Function to preload all local dependencies
async function preloadDependencies(sourceCode, sourcePath) {
  try {
    // Store the main file
    fileCache.set(sourcePath, sourceCode);
    
    // Find all imports
    const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?["']([^"']+)["']/g;
    let match;
    
    while ((match = importRegex.exec(sourceCode)) !== null) {
      const importPath = match[1];
      
      // Skip OpenZeppelin imports as they'll be handled separately
      if (importPath.startsWith('@openzeppelin/')) {
        continue;
      }
      
      // Normalize the path
      const normalizedPath = importPath.replace(/^\.\//, '').replace(/^\.\.\//, '');
      
      // Only load if not already in cache
      if (!fileCache.has(normalizedPath)) {
        try {
          const content = await virtualFS.readFile(normalizedPath);
          console.log(`[Worker] Loaded local file ${normalizedPath}:`, content);
          fileCache.set(normalizedPath, content);
          // Recursively preload dependencies
          await preloadDependencies(content, normalizedPath);
        } catch (error) {
          console.error(`[Worker] Failed to load dependency ${normalizedPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[Worker] Error preloading dependencies:', error);
  }
}

// Import resolution callback function - must be synchronous
function importCallback(path) {
  console.log('[Worker] Resolving import:', path);
  
  try {
    // Handle OpenZeppelin imports
    if (path.startsWith('@openzeppelin/')) {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v4.9.0/contracts/${path.replace('@openzeppelin/contracts/', '')}`, false);
      xhr.send(null);
      
      if (xhr.status === 200) {
        console.log('[Worker] Successfully resolved OpenZeppelin import:', path);
        return { contents: xhr.responseText };
      } else {
        console.error('[Worker] OpenZeppelin import resolution error:', xhr.statusText);
        return { error: `Failed to load ${path}: ${xhr.statusText}` };
      }
    }
    
    // Handle local imports from cache
    const normalizedPath = path.replace(/^\.\//, '').replace(/^\.\.\//, '');
    if (fileCache.has(normalizedPath)) {
      console.log('[Worker] Successfully resolved local import from cache:', normalizedPath);
      return { contents: fileCache.get(normalizedPath) };
    }
    
    throw new Error(`Could not find ${path}`);
  } catch (error) {
    console.error('[Worker] Import resolution error:', error);
    return { error: error.message };
  }
}

// Initialize compiler
async function initCompiler() {
  try {
    const response = await fetch('https://binaries.soliditylang.org/bin/soljson-v0.8.19+commit.7dd6d404.js');
    const solcJs = await response.text();
    const blob = new Blob([solcJs], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    // Load solc
    importScripts(url);
    
    // Initialize the compiler
    compiler = self.Module;
    
    // Send success message back
    self.postMessage({ type: 'init', success: true });
  } catch (error) {
    console.error('[Solc Worker] Initialization error:', error);
    self.postMessage({ 
      type: 'init', 
      success: false, 
      error: error.message || 'Failed to initialize Solidity compiler' 
    });
  }
}

// Handle messages
self.onmessage = async function(e) {
  try {
    const { type, sourceCode, sourcePath } = e.data;

    if (type === 'init') {
      await initCompiler();
      return;
    }

    if (type === 'compile') {
      if (!compiler) {
        throw new Error('Compiler not initialized. Please wait for initialization to complete.');
      }

      const input = {
        language: 'Solidity',
        sources: {
          [sourcePath]: {
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

      try {
        const output = JSON.parse(compiler.compile(JSON.stringify(input)));
        
        if (output.errors) {
          const errors = output.errors.map(error => ({
            severity: error.severity === 'error' ? 8 : 4,
            message: error.message,
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1
          }));
          
          self.postMessage({ markers: errors });
        } else {
          self.postMessage({ output });
        }
      } catch (error) {
        console.error('[Solc Worker] Compilation error:', error);
        self.postMessage({ 
          error: error.message || 'Compilation failed',
          markers: [{
            severity: 8,
            message: error.message || 'Compilation failed',
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1
          }]
        });
      }
    }
  } catch (error) {
    console.error('[Solc Worker] Worker error:', error);
    self.postMessage({ 
      error: error.message || 'Worker error',
      markers: [{
        severity: 8,
        message: error.message || 'Worker error',
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1
      }]
    });
  }
};