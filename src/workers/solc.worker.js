// Explicitly mark as module worker
self.window = self;

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
    console.log('[Solc Worker] Fetching compiler...');
    const response = await fetch('https://binaries.soliditylang.org/bin/soljson-v0.8.19+commit.7dd6d404.js');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch compiler: ${response.statusText}`);
    }

    console.log('[Solc Worker] Compiler fetched, creating blob...');
    const solcJs = await response.text();
    const blob = new Blob([solcJs], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    console.log('[Solc Worker] Loading compiler...');
    importScripts(url);
    
    if (!self.Module) {
      throw new Error('Compiler module not loaded correctly');
    }

    compiler = self.Module;
    console.log('[Solc Worker] Compiler initialized successfully');
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

async function compile(input) {
  try {
    if (!compiler) {
      throw new Error('Compiler not initialized');
    }

    console.log('[Solc Worker] Starting compilation...');
    const result = JSON.parse(compiler.compile(JSON.stringify(input)));
    
    if (result.errors) {
      const errors = result.errors.filter(error => error.severity === 'error');
      if (errors.length > 0) {
        throw new Error(errors[0].formattedMessage || 'Compilation failed');
      }
    }

    console.log('[Solc Worker] Compilation successful');
    self.postMessage({ type: 'compilation', result });
  } catch (error) {
    console.error('[Solc Worker] Compilation error:', error);
    self.postMessage({ 
      type: 'compilation', 
      error: error.message || 'Compilation failed' 
    });
  }
}

self.onmessage = async (event) => {
  const { type, input } = event.data;
  
  switch (type) {
    case 'init':
      await initCompiler();
      break;
    case 'compile':
      await compile(input);
      break;
    default:
      console.error('[Solc Worker] Unknown message type:', type);
      self.postMessage({ 
        type: 'error', 
        error: `Unknown message type: ${type}` 
      });
  }
};