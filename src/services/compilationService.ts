import { ContractArtifact } from '../types/contracts';
import * as monaco from 'monaco-editor';
import { ConsoleMessage } from '../types/contracts';

export class CompilationService {
  private static instance: CompilationService;
  private apiUrl: string;
  private lastCompiledCode: string = '';
  private lastCompilationTimestamp: number = 0;
  private compilationInProgress: boolean = false;
  private compilationQueue: Array<{
    code: string;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  private compilationResults: Map<string, any> = new Map(); // Cache for compilation results

  private constructor() {
    // Use environment variable for API URL with fallback
    const baseUrl = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000';
    
    // Clean the URL and make sure it doesn't have a trailing slash
    const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    
    this.apiUrl = `${cleanBaseUrl}/api/compile`;
    
    console.log('[CompilationService] Initialized with API URL:', this.apiUrl);
  }

  public static getInstance(): CompilationService {
    if (!CompilationService.instance) {
      CompilationService.instance = new CompilationService();
    }
    return CompilationService.instance;
  }

  public async compileCode(
    code: string,
    monaco: typeof import('monaco-editor'),
    model: monaco.editor.ITextModel,
    addConsoleMessage: (message: string, type: ConsoleMessage['type']) => void,
    setCurrentArtifact: (artifact: ContractArtifact | null) => void
  ): Promise<void> {
    // Asegurar que el código es una cadena válida
    if (!code || typeof code !== 'string') {
      console.error('[CompilationService] Invalid code format:', code);
      addConsoleMessage('Invalid code format provided', 'error');
      return;
    }

    // Limpiar el código de caracteres no válidos
    code = code.replace(/^\uFEFF/, ''); // Eliminar BOM si existe

    // Skip if this is an exact duplicate of last compilation within the last 5 seconds
    const now = Date.now();
    if (code === this.lastCompiledCode && now - this.lastCompilationTimestamp < 5000) {
      console.log('[CompilationService] Skipping duplicate compilation request within 5s cooldown');
      return;
    }

    // If a compilation is already in progress, queue this one
    if (this.compilationInProgress) {
      console.log('[CompilationService] Compilation already in progress, queueing request');
      
      // Only queue if this is different from what's being compiled
      if (code !== this.lastCompiledCode) {
        // Return a promise that will be resolved when this compilation is processed
        return new Promise((resolve, reject) => {
          this.compilationQueue.push({ code, resolve, reject });
        });
      } else {
        console.log('[CompilationService] Ignoring duplicate compilation request for code already being compiled');
        return;
      }
    }

    // Set flags and cache this compilation
    this.compilationInProgress = true;
    this.lastCompiledCode = code;
    this.lastCompilationTimestamp = now;

    // Check if we have a cached result first
    if (this.compilationResults.has(code)) {
      console.log('[CompilationService] Using cached compilation result');
      const cachedResult = this.compilationResults.get(code);
      
      try {
        this.handleCompilationResult(cachedResult, monaco, model, addConsoleMessage, setCurrentArtifact);
      } finally {
        // Process next queued compilation if any
        this.compilationInProgress = false;
        this.processNextQueuedCompilation(monaco, model, addConsoleMessage, setCurrentArtifact);
      }
      return;
    }

    // Clear previous markers
    monaco.editor.setModelMarkers(model, 'solidity', []);
    addConsoleMessage("Starting compilation...", "info");

    try {
      console.log('[CompilationService] Analyzing source code...');
      
      // Extract contract name using a more precise regex
      const contractRegex = /\bcontract\s+(\w+)(?:\s+is\s+[^{]+|\s+implements\s+[^{]+|\s*){/g;
      const matches = [...code.matchAll(contractRegex)];
      
      console.log('[CompilationService] Found contract declarations:', matches.map(m => m[1]));
      
      let contractName = 'Contract'; // Default fallback
      let mainContract = null;
      
      if (matches.length > 0) {
        // Filter out any matches that have 'abstract' before them
        const validContracts = matches.filter(match => {
          const startIndex = match.index || 0;
          const previousCode = code.substring(Math.max(0, startIndex - 50), startIndex);
          return !previousCode.includes('abstract');
        });
        
        if (validContracts.length > 0) {
          mainContract = validContracts[validContracts.length - 1];
          contractName = mainContract[1];
          console.log('[CompilationService] Selected main contract:', contractName);
        }
      }

      // Get Solidity version from pragma
      const pragmaMatch = code.match(/pragma\s+solidity\s+(\^?\d+\.\d+\.\d+)/);
      const solidityVersion = pragmaMatch ? pragmaMatch[1].replace('^', '') : '0.8.20';

      console.log('[CompilationService] Sending compilation request...');
      const requestBody = {
        sourceCode: code,
        version: solidityVersion,
        contractName: contractName,
        optimize: true,
        runs: 200
      };
      
      console.log('[CompilationService] API Request:', {
        url: this.apiUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          ...requestBody,
          sourceCode: `${code.substring(0, 100)}... (${code.length} chars)`
        }
      });

      // Optimized with better error handling for CORS issues
      
      console.log(`[CompilationService] Sending compile request to: ${this.apiUrl}`);
      
      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify(requestBody),
          // Add mode credentials to enable cookies if needed
          credentials: 'same-origin'
        });

        console.log('[CompilationService] Response status:', response.status);

        const responseText = await response.text();
        console.log('[CompilationService] API response:', responseText);

        // Handle HTTP error status codes (4xx, 5xx)
        if (!response.ok) {
          console.error(`[CompilationService] HTTP error ${response.status}: ${responseText}`);
          
          // Try to extract meaningful error message from the response
          let errorMessage = `Server error (${response.status})`;
          let errorCode = 'ServerError';
          
          // Check if the response contains a meaningful error message
          if (responseText) {
            // For 500 errors that contain Solidity error messages
            if (responseText.includes('Error HH') || 
                responseText.includes('not found') || 
                responseText.includes('imported from')) {
              
              errorMessage = responseText.trim();
              
              // Extract error code if present
              const errorCodeMatch = responseText.match(/Error ([A-Z0-9]+):/);
              if (errorCodeMatch && errorCodeMatch[1]) {
                errorCode = errorCodeMatch[1];
              }
              
              // For import errors, provide more helpful message
              if (responseText.includes('not found') && responseText.includes('imported from')) {
                const missingFileMatch = responseText.match(/File ([^,]+), imported from/);
                if (missingFileMatch && missingFileMatch[1]) {
                  const missingFile = missingFileMatch[1];
                  
                  // Add installation instructions for common packages
                  
                }
              }
            }
          }
          
          // Create a properly formatted error result
          const result = {
            success: false,
            markers: this.convertErrorsToMarkers([{
              formattedMessage: errorMessage,
              severity: 'error',
              errorCode: errorCode
            }], monaco),
            error: errorMessage,
            output: null
          };
          
          // Handle the error result
          this.handleCompilationResult(result, monaco, model, addConsoleMessage, setCurrentArtifact);
          
          // Cache the result
          this.compilationResults.set(code, result);
          return;
        }

        let compilationResult;
        try {
          // Try to parse as JSON first
          compilationResult = JSON.parse(responseText);
        } catch (e) {
          // If it's not JSON, assume it's a compilation error message
          console.log('[CompilationService] Response is not JSON, treating as error message');
          
          // Check if this looks like a Solidity error message
          if (responseText.includes('Error') || responseText.includes('not found') || 
              responseText.includes('Compilation failed') || responseText.includes('HH')) {
            
            // Try to extract specific error information
            let errorCode = 'CompilationError';
            let formattedMessage = responseText;
            
            // Extract error code if present (like HH404)
            const errorCodeMatch = responseText.match(/Error ([A-Z0-9]+):/);
            if (errorCodeMatch && errorCodeMatch[1]) {
              errorCode = errorCodeMatch[1];
            }
            
            // Look for import errors specifically
            if (responseText.includes('not found') && responseText.includes('imported from')) {
              // This is likely an import error, extract the missing file
              const missingFileMatch = responseText.match(/File ([^,]+), imported from/);
              if (missingFileMatch && missingFileMatch[1]) {
                const missingFile = missingFileMatch[1];
                formattedMessage = `Missing dependency: ${missingFile}. Make sure this file is available or install the required package.`;
              }
            }
            
            compilationResult = {
              success: false,
              error: {
                formattedMessage: formattedMessage,
                severity: 'error',
                errorCode: errorCode
              }
            };
          } else {
            // Generic error format
            compilationResult = {
              success: false,
              error: {
                formattedMessage: responseText,
                severity: 'error',
                errorCode: 'ParserError'
              }
            };
          }
        }

        console.log('[CompilationService] Parsed compilation result:', compilationResult);
        
        let result;
        if (!response.ok || compilationResult.error) {
          // Handle both JSON errors and plain text compilation errors
          let errorInfo;
          
          if (typeof compilationResult.error === 'string') {
            errorInfo = { formattedMessage: compilationResult.error, severity: 'error' };
          } else if (compilationResult.error && typeof compilationResult.error === 'object') {
            // Make sure formattedMessage exists, create it if it doesn't
            errorInfo = {
              formattedMessage: compilationResult.error.formattedMessage || 
                                compilationResult.error.message || 
                                JSON.stringify(compilationResult.error),
              severity: compilationResult.error.severity || 'error',
              errorCode: compilationResult.error.errorCode
            };
          } else {
            // Fallback for when error is completely undefined or null
            errorInfo = {
              formattedMessage: 'Unknown compilation error occurred',
              severity: 'error'
            };
          }

          result = {
            success: false,
            markers: this.convertErrorsToMarkers([errorInfo], monaco),
            error: errorInfo.formattedMessage,
            output: null
          };

          // Don't clear the current artifact on compilation errors
          // This prevents the Contract Viewer from disappearing
          this.handleCompilationResult(
            result,
            monaco,
            model,
            addConsoleMessage,
            (artifact) => {
              // Only update the artifact if we're setting a new one
              if (artifact !== null) {
                setCurrentArtifact(artifact);
              }
            }
          );
        } else {
          // Handle successful compilation with new format
          result = {
            success: true,
            markers: [],
            output: compilationResult
          };
          
          this.handleCompilationResult(
            result,
            monaco,
            model,
            addConsoleMessage,
            setCurrentArtifact
          );
        }
        
        // Cache the result for future use
        this.compilationResults.set(code, result);

      } catch (networkError: unknown) {
        console.error('[CompilationService] Network or CORS error:', networkError);
        
        // Check if we have a cached result for this code that we can use as fallback
        if (this.compilationResults.has(code)) {
          console.log('[CompilationService] Using cached result as fallback after network error');
          const cachedResult = this.compilationResults.get(code);
          try {
            this.handleCompilationResult(cachedResult, monaco, model, addConsoleMessage, setCurrentArtifact);
            // Add a warning that we're using cached result
            addConsoleMessage('Using cached compilation result due to network error. The result may be outdated.', 'warning');
            return;
          } catch (cacheError) {
            console.error('[CompilationService] Error using cached result:', cacheError);
          }
        }
        
        // Extract the actual error message
        let errorMessage = 'An unknown network error occurred';
        
        if (networkError instanceof Error) {
          errorMessage = networkError.message;
          
          // Check if this is a HTTP error
          if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
            errorMessage = 'Server error (500): The compilation server encountered an error. This might be due to missing dependencies or invalid code.';
            
            // Try to extract import statements to provide better guidance
            const importRegex = /import\s+[^;]+from\s+["']([^"']+)["']/g;
            const imports = [...code.matchAll(importRegex)].map(match => match[1]);
            
            if (imports.length > 0) {
              // Check for common dependencies
              const missingOpenZeppelin = imports.some(imp => imp.includes('@openzeppelin'));
              
              if (missingOpenZeppelin) {
                errorMessage += '\n\nYour contract imports OpenZeppelin libraries. Make sure to install them:\nnpm install @openzeppelin/contracts';
              } else {
                errorMessage += `\n\nYour contract imports these files which might be missing: ${imports.join(', ')}`;
              }
            }
          }
          
          // Check if this is a missing dependency error (common with imports)
          else if (errorMessage.includes('Cannot read properties of undefined') && 
              errorMessage.includes('formattedMessage')) {
            
            // Try to extract import errors from the code
            const importRegex = /import\s+[^;]+from\s+["']([^"']+)["']/g;
            const imports = [...code.matchAll(importRegex)].map(match => match[1]);
            
            if (imports.length > 0) {
              errorMessage = `Possible missing dependencies: ${imports.join(', ')}. Make sure all imported files are available.`;
            } else {
              errorMessage = 'Compilation error: There might be missing dependencies or import errors in your contract.';
            }
          }
          
          // Create a marker for the error
          const errorMarker = {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
            message: errorMessage,
            severity: monaco.MarkerSeverity.Error
          };
          monaco.editor.setModelMarkers(model, 'solidity', [errorMarker]);
          
          addConsoleMessage(`Compilation error: ${errorMessage}`, 'error');
        } else {
          addConsoleMessage('An unknown compilation error occurred', 'error');
        }
        
        // Don't clear the current artifact on network errors
        // This prevents the Contract Viewer from disappearing
      }

    } catch (error) {
      console.error('[CompilationService] Compilation error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if this is a missing dependency error
      let enhancedErrorMessage = errorMessage;
      
      // Look for import statements in the code to provide better error messages
      if (errorMessage.includes('not found') || errorMessage.includes('dependency') || 
          errorMessage.includes('import') || errorMessage.includes('Cannot find')) {
        
        const importRegex = /import\s+[^;]+from\s+["']([^"']+)["']/g;
        const imports = [...code.matchAll(importRegex)].map(match => match[1]);
        
        if (imports.length > 0) {
          enhancedErrorMessage = `Missing dependencies detected: ${imports.join(', ')}. 
          Make sure all imported files are available. Original error: ${errorMessage}`;
        }
      }
      
      // Si el error ya tiene un marcador establecido (por el código anterior), no necesitamos hacer nada más
      const existingMarkers = monaco.editor.getModelMarkers({ resource: model.uri });
      if (existingMarkers.length === 0) {
        // Solo establecer un nuevo marcador si no hay ninguno existente
        const errorMarker = {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
          message: `Compilation failed: ${enhancedErrorMessage}`,
          severity: monaco.MarkerSeverity.Error
        };
        monaco.editor.setModelMarkers(model, 'solidity', [errorMarker]);
      }
      
      addConsoleMessage(
        `Compilation failed: ${enhancedErrorMessage}`,
        "error"
      );
      
      // Only clear the artifact on actual compilation errors, not network errors
      if (!(error instanceof TypeError && error.message.includes('fetch'))) {
        setCurrentArtifact(null);
      }
    } finally {
      // Reset compilation flag and process next item in queue
      this.compilationInProgress = false;
      this.processNextQueuedCompilation(monaco, model, addConsoleMessage, setCurrentArtifact);
    }
  }
  
  private processNextQueuedCompilation(
    monaco: typeof import('monaco-editor'),
    model: monaco.editor.ITextModel,
    addConsoleMessage: (message: string, type: ConsoleMessage['type']) => void,
    setCurrentArtifact: (artifact: ContractArtifact | null) => void
  ): void {
    if (this.compilationQueue.length > 0) {
      // Get the next compilation request - just process the most recent one
      const nextCompilation = this.compilationQueue.pop();
      
      // Clear the queue - we'll only process the most recent request
      this.compilationQueue = [];
      
      if (nextCompilation) {
        console.log('[CompilationService] Processing next queued compilation');
        
        // Process the next compilation after a short delay
        setTimeout(() => {
          this.compileCode(
            nextCompilation.code,
            monaco,
            model,
            addConsoleMessage,
            setCurrentArtifact
          ).then(nextCompilation.resolve)
            .catch(nextCompilation.reject);
        }, 500);
      }
    }
  }

  private convertErrorsToMarkers(errors: any[], monaco: typeof import('monaco-editor')): any[] {
    if (!errors || !Array.isArray(errors)) {
      console.warn('[CompilationService] Invalid errors array:', errors);
      return [];
    }
    
    return errors.map(error => {
      if (!error) {
        console.warn('[CompilationService] Null or undefined error object');
        return {
          startLineNumber: 1,
          endLineNumber: 1,
          startColumn: 1,
          endColumn: 2,
          message: 'Unknown error',
          severity: monaco.MarkerSeverity.Error,
          source: 'solidity'
        };
      }
      
      // Extract line and column information from the error message
      const formattedMessage = error.formattedMessage || error.message || JSON.stringify(error);
      const locationMatch = formattedMessage.match(/\d+:\d+/);
      let startLineNumber = 1;
      let startColumn = 1;
      
      if (locationMatch) {
        const [line, column] = locationMatch[0].split(':').map(Number);
        startLineNumber = line;
        startColumn = column;
      }

      return {
        startLineNumber,
        endLineNumber: startLineNumber,
        startColumn,
        endColumn: startColumn + 1,
        message: formattedMessage,
        severity: error.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        source: 'solidity'
      };
    });
  }

  private handleCompilationResult(
    result: {
      success: boolean;
      markers?: any[];
      error?: string;
      output?: any;
    },
    monaco: typeof import('monaco-editor'),
    model: monaco.editor.ITextModel,
    addConsoleMessage: (message: string, type: ConsoleMessage['type']) => void,
    setCurrentArtifact: (artifact: ContractArtifact | null) => void
  ): void {
    // Clear previous markers
    monaco.editor.setModelMarkers(model, 'solidity', []);

    if (!result.success || result.error) {
      // Handle compilation error
      let errorMessage = result.error || 'Unknown compilation error';
      
      // Format error message for better readability
      if (errorMessage.includes('Error HH404') || 
          (errorMessage.includes('not found') && errorMessage.includes('imported from'))) {
        
        // This is an import error, extract the missing file
        const missingFileMatch = errorMessage.match(/File ([^,]+), imported from/);
        if (missingFileMatch && missingFileMatch[1]) {
          const missingFile = missingFileMatch[1];
          
          // Add installation instructions for common packages
          
        }
      }
      
      // Add the error message to console
      addConsoleMessage(errorMessage, 'error');

      // Set markers if available
      if (result.markers && result.markers.length > 0) {
        monaco.editor.setModelMarkers(model, 'solidity', result.markers);
      }

      // Don't clear the artifact on compilation errors to prevent UI disruption
      return;
    }

    // Handle successful compilation
    addConsoleMessage('Compilation successful!', 'success');

    try {
      // Registrar la versión compilada exitosamente en el historial
      this.registerCompiledVersion(model.getValue());
    } catch (error) {
      console.warn('[CompilationService] Error registering compiled version:', error);
    }

    if (result.output) {
      const { artifact } = result.output;
      if (artifact) {
        console.log('[CompilationService] Processing ABI:', artifact.abi);

        // Separar los elementos del ABI por tipo
        const functions = artifact.abi.filter((item: any) => item.type === 'function');
        const events = artifact.abi.filter((item: any) => item.type === 'event');
        const constructors = artifact.abi.filter((item: any) => item.type === 'constructor');
        const errors = artifact.abi.filter((item: any) => item.type === 'error');

        // Procesar funciones
        const processedFunctions = functions.map((item: any) => ({
          name: item.name,
          description: `${item.name}(${(item.inputs || []).map((input: any) => `${input.type} ${input.name}`).join(', ')})`,
          type: 'function' as 'function',
          stateMutability: item.stateMutability as 'pure' | 'view' | 'nonpayable' | 'payable',
          inputs: (item.inputs || []).map((input: any) => ({
            name: input.name || 'value',
            type: input.type,
            description: `Input parameter of type ${input.type}`,
            components: input.components
          })),
          outputs: (item.outputs || []).map((output: any) => ({
            name: output.name || 'value',
            type: output.type,
            components: output.components
          }))
        }));

        // Procesar eventos
        const processedEvents = events.map((item: any) => ({
          name: item.name,
          description: `Event: ${item.name}(${(item.inputs || []).map((input: any) => `${input.type} ${input.name}`).join(', ')})`,
          type: 'event' as 'event',
          inputs: (item.inputs || []).map((input: any) => ({
            name: input.name || 'value',
            type: input.type,
            description: `Event parameter of type ${input.type}`,
            components: input.components,
            indexed: input.indexed
          }))
        }));

        // Procesar constructor si existe
        const constructor = constructors[0];
        const processedConstructor = constructor ? {
          name: 'constructor',
          description: `Constructor(${(constructor.inputs || []).map((input: any) => `${input.type} ${input.name}`).join(', ')})`,
          type: 'constructor' as 'constructor',
          stateMutability: constructor.stateMutability as 'nonpayable' | 'payable',
          inputs: (constructor.inputs || []).map((input: any) => ({
            name: input.name || 'value',
            type: input.type,
            description: `Constructor parameter of type ${input.type}`,
            components: input.components
          }))
        } : null;

        // Procesar errores personalizados
        const processedErrors = errors.map((item: any) => ({
          name: item.name,
          description: `Error: ${item.name}(${(item.inputs || []).map((input: any) => `${input.type} ${input.name}`).join(', ')})`,
          type: 'error' as 'error',
          inputs: (item.inputs || []).map((input: any) => ({
            name: input.name || 'value',
            type: input.type,
            description: `Error parameter of type ${input.type}`,
            components: input.components
          }))
        }));

        // Crear el artefacto del contrato con todos los elementos procesados
        const contractArtifact: ContractArtifact = {
          name: artifact.contractName || 'Smart Contract',
          description: 'Compiled Smart Contract',
          functions: processedFunctions,
          events: processedEvents,
          constructor: processedConstructor,
          errors: processedErrors,
          abi: artifact.abi,
          bytecode: artifact.bytecode
        };

        console.log('[CompilationService] Processed contract artifact:', {
          name: contractArtifact.name,
          functionsCount: contractArtifact.functions.length,
          eventsCount: contractArtifact.events?.length || 0,
          hasConstructor: !!contractArtifact.constructor,
          errorsCount: contractArtifact.errors?.length || 0
        });

        setCurrentArtifact(contractArtifact);
        addConsoleMessage(
          `Contract ${contractArtifact.name} compiled successfully with ${contractArtifact.functions.length} functions, ${contractArtifact.events?.length || 0} events, and ${contractArtifact.errors?.length || 0} custom errors`, 
          'success'
        );
      }
    }
  }

  /**
   * Registra una versión compilada exitosamente en el historial de versiones
   * @param sourceCode Código fuente compilado
   */
  private async registerCompiledVersion(sourceCode: string): Promise<void> {
    try {
      // Si el código es el mismo que la última compilación, no registramos una nueva versión
      if (sourceCode === this.lastCompiledCode) {
        console.log('[CompilationService] Skipping version registration - code unchanged');
        return;
      }
      
      // Intentar obtener el nombre del contrato
      const contractNameMatch = sourceCode.match(/contract\s+(\w+)/);
      const contractName = contractNameMatch ? contractNameMatch[1] : 'Contract';
      
      console.log('[CompilationService] Registering successful compilation of contract:', contractName);
      
      // Actualizar el último código compilado
      this.lastCompiledCode = sourceCode;
      this.lastCompilationTimestamp = Date.now();
      
      // Emitir evento de versión registrada directamente
      // Esto es útil cuando no tenemos acceso directo al chatContextService
      window.dispatchEvent(new CustomEvent('contract-version-registered', {
        detail: {
          sourceCode,
          name: contractName,
          timestamp: this.lastCompilationTimestamp
          // No asignamos conversationId aquí, lo tomará del contexto activo
        }
      }));
      
      // Intentar usar el chatContextService si está disponible
      try {
        // Importar dinámicamente para evitar dependencias circulares
        const { ChatContextService } = await import('./chatContextService');
        
        // Buscar una instancia existente en window.__chatContextService (podría no existir)
        const chatContextService = (window as any).__chatContextService;
        
        if (chatContextService && typeof chatContextService.registerContractVersion === 'function') {
          await chatContextService.registerContractVersion(sourceCode, contractName);
        }
      } catch (error) {
        console.warn('[CompilationService] ChatContextService not available:', error);
        // No es un error crítico, ya que el evento ya se emitió
      }
    } catch (error) {
      console.error('[CompilationService] Error in registerCompiledVersion:', error);
    }
  }
} 