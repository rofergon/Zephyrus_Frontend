// Explicitly mark as module worker
declare const self: Worker & { window?: any };
self.window = self; // Some libraries expect window to be defined

import { Solc } from '../services/solc-browserify';
import { virtualFS } from '../services/virtual-fs';
import { CompilerInput, CompilerOutput, CompilerError, ImportCallback } from '@/types/compiler';

let compiler: Solc | null = null;
const fileCache: Map<string, string> = new Map();

// Function to preload all local dependencies
async function preloadDependencies(sourceCode: string, sourcePath: string): Promise<void> {
  try {
    // Store the main file
    fileCache.set(sourcePath, sourceCode);
    
    // Find all imports
    const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    
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
function importCallback(path: string): { contents: string } | { error: string } {
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
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

interface WorkerMessage {
  type: 'init' | 'compile';
  sourceCode?: string;
  sourcePath?: string;
  version?: string;
}

interface WorkerResponse {
  type: 'ready' | 'out' | 'error';
  status?: boolean;
  output?: CompilerOutput;
  error?: string;
  markers?: Array<{
    startLineNumber: number;
    endLineNumber: number;
    startColumn: number;
    endColumn: number;
    message: string;
    severity: number;
    source: string;
  }>;
}

// Main message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  try {
    const { type, sourceCode, version } = event.data;

    // Handle initialization message
    if (type === 'init') {
      if (!compiler) {
        compiler = new Solc((solc) => {
          console.log('[Worker] Compiler initialized successfully');
          self.postMessage({ type: 'ready', status: true });
        });
      }
      return;
    }

    // Handle compilation message
    if (type === 'compile' && sourceCode) {
      console.log('[Worker] Received source code:', sourceCode);
      
      // Create the compiler input object
      const input: CompilerInput = {
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
          throw new Error(`La versión ${version} no está disponible. La última versión estable es 0.8.20. Por favor, actualiza el pragma solidity a una versión disponible.`);
        }
      }
      
      // Clear the file cache
      fileCache.clear();
      
      // Preload all local dependencies
      await preloadDependencies(sourceCode, 'main.sol');
      
      // Log the contents of fileCache for debugging
      console.log('[Worker] Files loaded:', Array.from(fileCache.entries()));
      
      // Compile the contract
      console.log('[Worker] Starting compilation');
      try {
        // Send the input object to the compiler
        console.log('[Worker] Sending input to compiler:', input);
        const output = await compiler?.compile(input, importCallback);
        console.log('[Worker] Raw compilation output:', output);

        if (!output) {
          throw new Error('No compilation output received');
        }

        // Parse the output if it's a string
        const parsedOutput: CompilerOutput = typeof output === 'string' ? JSON.parse(output) : output;
        console.log('[Worker] Parsed compilation output:', parsedOutput);
        
        if (parsedOutput.errors) {
          console.log('[Worker] Compilation errors:', JSON.stringify(parsedOutput.errors, null, 2));
        }

        // Process compilation results
        const markers = [];
      
        if (parsedOutput.errors) {
          parsedOutput.errors.forEach((error: CompilerError) => {
            // Extract line and column information from formatted message
            const locationMatch = error.formattedMessage?.match(/Compiled_Contracts:(\d+):(\d+):/);
            if (locationMatch) {
              const [_, line, column] = locationMatch;
              
              // Extract error range from formatted message
              const errorLines = error.formattedMessage.split('\n');
              let errorLength = 1;
              
              // Find the line containing the error code
              const codeLine = errorLines.find(line => line.includes('^'));
              if (codeLine) {
                const caretIndex = codeLine.indexOf('^');
                const caretLength = codeLine.split('').filter(char => char === '^').length;
                errorLength = caretLength;
              }
              
              markers.push({
                startLineNumber: parseInt(line),
                endLineNumber: parseInt(line),
                startColumn: parseInt(column),
                endColumn: parseInt(column) + errorLength,
                message: error.formattedMessage,
                severity: error.type === 'ParserError' || error.type === 'DeclarationError' || error.severity === 'error' ? 8 : 4,
                source: 'solidity'
              });
            } else {
              // If exact location cannot be extracted, use a generic marker
              markers.push({
                startLineNumber: 1,
                endLineNumber: 1,
                startColumn: 1,
                endColumn: 1000,
                message: error.formattedMessage || error.message,
                severity: error.type === 'ParserError' || error.type === 'DeclarationError' || error.severity === 'error' ? 8 : 4,
                source: 'solidity'
              });
            }
          });
        }

        // Log the compilation result and send it back
        const response: WorkerResponse = { type: 'out', output: parsedOutput };
        console.log('[Worker] Compilation completed. Sending result:', response);
        self.postMessage(response);
        return;
      } catch (error) {
        console.error('[Worker] Compilation error:', error);
        const response: WorkerResponse = {
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
          markers: [{
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
            message: `Compilation error: ${error instanceof Error ? error.message : String(error)}`,
            severity: 8,
            source: 'solidity'
          }]
        };
        self.postMessage(response);
        return;
      }
    }

    // Handle unknown message type
    throw new Error(`Unknown message type: ${type}`);
  } catch (error) {
    console.error('[Worker] Error:', error);
    const response: WorkerResponse = {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
      markers: [{
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        message: `Compilation error: ${error instanceof Error ? error.message : String(error)}`,
        severity: 8,
        source: 'solidity'
      }]
    };
    self.postMessage(response);
  }
}; 