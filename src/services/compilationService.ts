import { ContractArtifact } from '../types/contracts';
import * as monaco from 'monaco-editor';
import { CompilationHandlerService } from './compilationHandlerService';
import { ConsoleMessage } from '../types/contracts';

export class CompilationService {
  private static instance: CompilationService;
  private apiUrl: string;
  private compilationHandler: CompilationHandlerService;
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
    this.compilationHandler = new CompilationHandlerService();
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
    if (!code) return;

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
      const corsProxyPrefix = ''; // Can be filled with a CORS proxy URL if needed
      
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

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[CompilationService] API error response:', errorText);
          throw new Error(`Compilation failed: ${response.status} ${response.statusText}`);
        }

        const compilationResult = await response.json();
        console.log('[CompilationService] Compilation result:', compilationResult);
        
        let result;
        if (compilationResult.error) {
          result = {
            success: false,
            markers: this.convertErrorsToMarkers([{ 
              formattedMessage: compilationResult.error,
              severity: 'error'
            }], monaco),
            error: compilationResult.error,
            output: null
          };
        } else {
          // Handle successful compilation with new format
          result = {
            success: true,
            markers: [],
            output: compilationResult
          };
        }
        
        // Cache the result for future use
        this.compilationResults.set(code, result);
        
        this.handleCompilationResult(
          result,
          monaco,
          model,
          addConsoleMessage,
          setCurrentArtifact
        );

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
        
        if (networkError instanceof Error) {
          addConsoleMessage(`Network error: ${networkError.message}. This may be a CORS issue if you're seeing errors about 'Access-Control-Allow-Origin'.`, 'error');
        } else {
          addConsoleMessage('An unknown network error occurred', 'error');
        }
        
        // Don't clear the current artifact on network errors
        // This prevents the Contract Viewer from disappearing
        
        // Don't rethrow the error here to allow the app to continue functioning
        // throw networkError; 
      }

    } catch (error) {
      console.error('[CompilationService] Compilation error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Si el error ya tiene un marcador establecido (por el código anterior), no necesitamos hacer nada más
      const existingMarkers = monaco.editor.getModelMarkers({ resource: model.uri });
      if (existingMarkers.length === 0) {
        // Solo establecer un nuevo marcador si no hay ninguno existente
        const errorMarker = {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
          message: `Compilation failed: ${errorMessage}`,
          severity: monaco.MarkerSeverity.Error
        };
        monaco.editor.setModelMarkers(model, 'solidity', [errorMarker]);
      }
      
      addConsoleMessage(
        `Compilation failed: ${errorMessage}`,
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
    return errors.map(error => {
      // Extract line and column information from the error message
      const locationMatch = error.formattedMessage?.match(/\d+:\d+/);
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
        message: error.formattedMessage || error.message,
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
      const errorMessage = result.error || 'Unknown compilation error';
      addConsoleMessage(errorMessage, 'error');

      if (result.markers && result.markers.length > 0) {
        monaco.editor.setModelMarkers(model, 'solidity', result.markers);
      }

      setCurrentArtifact(null);
      return;
    }

    // Handle successful compilation
    addConsoleMessage('Compilation successful!', 'success');

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
} 