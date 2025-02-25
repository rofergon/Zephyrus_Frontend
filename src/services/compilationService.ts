import { ContractArtifact } from '../types/contracts';
import * as monaco from 'monaco-editor';

export class CompilationService {
  private static instance: CompilationService;
  private apiUrl: string;

  private constructor() {
    // Use environment variable for API URL with fallback
    this.apiUrl = `${(import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/compile`;
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
    addConsoleMessage: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void,
    setCurrentArtifact: (artifact: any | null) => void
  ): Promise<void> {
    if (!code) return;

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

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('[CompilationService] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CompilationService] API Error:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('[CompilationService] Parsed API Error:', errorJson);
          
          let errorMarker;
          
          if (errorJson.location) {
            // Obtener el texto de la línea para determinar la longitud del error
            const lines = code.split('\n');
            const errorLine = lines[errorJson.location.line - 1] || '';
            const errorLength = 1; // Longitud mínima por defecto
            
            // Intentar determinar la longitud del error basado en el contexto
            let contextLength = errorLength;
            if (errorLine) {
              // Si estamos en la línea correcta, intentar encontrar un token relevante
              const tokenMatch = errorLine.substr(errorJson.location.column - 1).match(/[a-zA-Z0-9_]+|[^a-zA-Z0-9_\s]+/);
              if (tokenMatch) {
                contextLength = tokenMatch[0].length;
              }
            }

            errorMarker = {
              startLineNumber: errorJson.location.line,
              endLineNumber: errorJson.location.line,
              startColumn: errorJson.location.column,
              endColumn: errorJson.location.column + contextLength,
              message: `${errorJson.message}${errorJson.suggestion ? `\nSuggestion: ${errorJson.suggestion}` : ''}`,
              severity: monaco.MarkerSeverity.Error,
              source: 'solidity'
            };

            // Log para debugging
            console.log('[CompilationService] Created error marker:', {
              line: errorJson.location.line,
              column: errorJson.location.column,
              errorLine,
              contextLength
            });
          } else {
            errorMarker = {
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: 1,
              endColumn: 1,
              message: errorJson.message || 'Unknown error',
              severity: monaco.MarkerSeverity.Error,
              source: 'solidity'
            };
          }

          // Limpiar marcadores anteriores antes de establecer el nuevo
          monaco.editor.setModelMarkers(model, 'solidity', []);
          
          // Establecer el nuevo marcador
          monaco.editor.setModelMarkers(model, 'solidity', [errorMarker]);
          
          // Añadir mensaje a la consola con información de ubicación
          const locationInfo = errorJson.location 
            ? ` at line ${errorJson.location.line}, column ${errorJson.location.column}`
            : '';
          const errorMessage = `Compilation failed${locationInfo}: ${errorJson.message}${errorJson.suggestion ? `\nSuggestion: ${errorJson.suggestion}` : ''}`;
          addConsoleMessage(errorMessage, 'error');
          
          throw new Error(errorMessage);
        } catch (e) {
          // Si no podemos parsear el error JSON, usar el mensaje de error original
          const errorMarker = {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
            message: errorText,
            severity: monaco.MarkerSeverity.Error,
            source: 'solidity'
          };
          monaco.editor.setModelMarkers(model, 'solidity', [errorMarker]);
          addConsoleMessage(errorText, 'error');
          throw new Error(`Compilation failed: ${response.status} - ${errorText}`);
        }
      }

      const compilationResult = await response.json();
      console.log('[CompilationService] Compilation result:', compilationResult);
      
      if (compilationResult.error) {
        this.handleCompilationResult(
          {
            success: false,
            markers: this.convertErrorsToMarkers([{ 
              formattedMessage: compilationResult.error,
              severity: 'error'
            }], monaco),
            error: compilationResult.error,
            output: null
          },
          monaco,
          model,
          addConsoleMessage,
          setCurrentArtifact
        );
        return;
      }

      // Handle successful compilation with new format
      this.handleCompilationResult(
        {
          success: true,
          markers: [],
          output: compilationResult
        },
        monaco,
        model,
        addConsoleMessage,
        setCurrentArtifact
      );

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
    addConsoleMessage: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void,
    setCurrentArtifact: (artifact: any | null) => void
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