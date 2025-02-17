// Explicitly mark as module worker
self.window = self; // Some libraries expect window to be defined

import { Solc } from '../services/solc-browserify';
import { virtualFS } from '../services/virtual-fs';
import { logger } from '../services/logger';

let compiler = null;
const fileCache = new Map();

// Function to preload all local dependencies
async function preloadDependencies(sourceCode, sourcePath) {
  try {
    logger.debug('SolcWorker', 'Starting dependency preload', { sourcePath });
    // Store the main file
    fileCache.set(sourcePath, sourceCode);
    
    // Find all imports
    const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?["']([^"']+)["']/g;
    let match;
    
    while ((match = importRegex.exec(sourceCode)) !== null) {
      const importPath = match[1];
      
      // Skip OpenZeppelin imports as they'll be handled separately
      if (importPath.startsWith('@openzeppelin/')) {
        logger.debug('SolcWorker', 'Skipping OpenZeppelin import', { importPath });
        continue;
      }
      
      // Normalize the path
      const normalizedPath = importPath.replace(/^\.\//, '').replace(/^\.\.\//, '');
      
      // Only load if not already in cache
      if (!fileCache.has(normalizedPath)) {
        try {
          const content = await virtualFS.readFile(normalizedPath);
          logger.info('SolcWorker', 'Loaded local file', { path: normalizedPath });
          fileCache.set(normalizedPath, content);
          // Recursively preload dependencies
          await preloadDependencies(content, normalizedPath);
        } catch (error) {
          logger.error('SolcWorker', 'Failed to load dependency', { 
            path: normalizedPath,
            error: error.message 
          });
        }
      }
    }
  } catch (error) {
    logger.error('SolcWorker', 'Error preloading dependencies', { error: error.message });
  }
}

// Import resolution callback function - must be synchronous
function importCallback(path) {
  logger.debug('SolcWorker', 'Resolving import', { path });
  
  try {
    // Handle OpenZeppelin imports
    if (path.startsWith('@openzeppelin/')) {
      logger.info('SolcWorker', 'Processing OpenZeppelin import', { path });
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v4.9.0/contracts/${path.replace('@openzeppelin/contracts/', '')}`, false);
      xhr.send(null);
      
      if (xhr.status === 200) {
        logger.info('SolcWorker', 'Successfully resolved OpenZeppelin import', { path });
        return { contents: xhr.responseText };
      } else {
        logger.error('SolcWorker', 'OpenZeppelin import resolution error', { 
          path,
          status: xhr.status,
          statusText: xhr.statusText 
        });
        return { error: `Failed to load ${path}: ${xhr.statusText}` };
      }
    }
    
    // Handle local imports from cache
    const normalizedPath = path.replace(/^\.\//, '').replace(/^\.\.\//, '');
    if (fileCache.has(normalizedPath)) {
      logger.info('SolcWorker', 'Resolved local import from cache', { path: normalizedPath });
      return { contents: fileCache.get(normalizedPath) };
    }
    
    logger.error('SolcWorker', 'Import not found', { path });
    throw new Error(`Could not find ${path}`);
  } catch (error) {
    logger.error('SolcWorker', 'Import resolution error', { 
      path,
      error: error.message 
    });
    return { error: error.message };
  }
}

// Main message handler
self.onmessage = async (event) => {
  try {
    const { type, sourceCode, sourcePath, version } = event.data;
    logger.debug('SolcWorker', 'Received message', { type });

    // Handle initialization message
    if (type === 'init') {
      if (!compiler) {
        logger.info('SolcWorker', 'Initializing compiler');
        compiler = new Solc((solc) => {
          logger.info('SolcWorker', 'Compiler initialized successfully');
          self.postMessage({ type: 'ready', status: true });
        });
      }
      return;
    }

    // Handle compilation message
    if (type === 'compile') {
      logger.info('SolcWorker', 'Starting compilation');
      
      // Create the compiler input object
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
          }
        }
      };

      // Verify solidity version in pragma
      const pragmaMatch = sourceCode.match(/pragma solidity\s+(\^?\d+\.\d+\.\d+);/);
      if (pragmaMatch) {
        const version = pragmaMatch[1].replace('^', '');
        const versionParts = version.split('.').map(Number);
        if (versionParts[0] === 0 && versionParts[1] === 8 && versionParts[2] > 20) {
          logger.error('SolcWorker', 'Unsupported Solidity version', { version });
          throw new Error(`La versión ${version} no está disponible. La última versión estable es 0.8.20. Por favor, actualiza el pragma solidity a una versión disponible.`);
        }
      }
      
      // Clear the file cache
      logger.debug('SolcWorker', 'Clearing file cache');
      fileCache.clear();
      
      // Preload all local dependencies
      await preloadDependencies(sourceCode, 'main.sol');
      
      logger.debug('SolcWorker', 'Files loaded', { 
        cacheSize: fileCache.size,
        files: Array.from(fileCache.keys())
      });
      
      // Compile the contract
      logger.info('SolcWorker', 'Executing compilation');
      try {
        const output = await compiler.compile(input, importCallback);
        logger.info('SolcWorker', 'Compilation completed successfully');
        
        if (output.errors) {
          logger.warn('SolcWorker', 'Compilation completed with warnings/errors', { 
            errorCount: output.errors.length 
          });
        }

        self.postMessage({ type: 'out', output });
        return;
      } catch (error) {
        logger.error('SolcWorker', 'Compilation error', { error: error.message });
        self.postMessage({
          type: 'error',
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
        return;
      }
    }

    // Handle unknown message type
    logger.error('SolcWorker', 'Unknown message type', { type });
    throw new Error(`Unknown message type: ${type}`);
  } catch (error) {
    logger.error('SolcWorker', 'Worker error', { error: error.message });
    self.postMessage({
      type: 'error',
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