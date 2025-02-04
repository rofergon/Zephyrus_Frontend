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

// Main message handler
self.onmessage = async (event) => {
  try {
    const { sourceCode, sourcePath } = event.data;
    
    // Initialize the compiler if not already initialized
    if (!compiler) {
      compiler = new Solc((solc) => {
        console.log('[Worker] Compiler initialized successfully');
      });
    }
    
    // Verify solidity version in pragma
    const pragmaMatch = sourceCode.match(/pragma solidity\s+(\^?\d+\.\d+\.\d+);/);
    if (pragmaMatch) {
      const version = pragmaMatch[1].replace('^', '');
      const versionParts = version.split('.').map(Number);
      if (versionParts[0] === 0 && versionParts[1] === 8 && versionParts[2] > 20) {
        throw new Error(`La versión ${version} no está disponible. La última versión estable es 0.8.20. Por favor, actualiza el pragma solidity a una versión disponible.`);
      }
    }
    
    // Clear the file cache
    fileCache.clear();
    
    // Preload all local dependencies
    await preloadDependencies(sourceCode, sourcePath || 'main.sol');
    
    // Log the contents of fileCache for debugging
    console.log('[Worker] Files loaded:', Array.from(fileCache.entries()));
    
    // Compile the contract
    console.log('[Worker] Starting compilation');
    const output = await compiler.compile(sourceCode, importCallback);
    
    // Process compilation results
    const markers = [];
    
    if (output.errors) {
      output.errors.forEach(error => {
        const lineMatch = error.formattedMessage?.match(/:(\d+):/);
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