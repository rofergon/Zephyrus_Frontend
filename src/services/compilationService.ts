import { CompilationResult } from '../types/contracts';
import * as monaco from 'monaco-editor';

export class CompilationService {
  private static instance: CompilationService;
  private workerUrl: string;

  private constructor() {
    try {
      // En producción, buscar el worker en la carpeta assets/workers
      const workerPath = import.meta.env.PROD 
        ? '/assets/workers/solc.worker.js'
        : new URL('../workers/solc.worker.js', import.meta.url).toString();

      // Asegurarse de que la URL sea absoluta y loggear para debug
      this.workerUrl = workerPath.startsWith('http') 
        ? workerPath 
        : new URL(workerPath, window.location.origin).toString();
      
      console.log('[CompilationService] Worker URL:', this.workerUrl);
    } catch (error) {
      console.error('[CompilationService] Error initializing worker URL:', error);
      throw error;
    }
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

    // Limpiar marcadores anteriores
    monaco.editor.setModelMarkers(model, 'solidity', []);
    addConsoleMessage("Starting compilation...", "info");
    console.log('[CompilationService] Starting compilation with worker URL:', this.workerUrl);

    try {
      const worker = new Worker(this.workerUrl, { 
        type: 'module',
        name: 'solc-worker'
      });

      console.log('[CompilationService] Worker created successfully');

      worker.onmessage = (event) => {
        console.log('[CompilationService] Worker message received:', event.data);
        const { markers, error, output } = event.data;
        this.handleCompilationResult(
          {
            success: !error,
            markers,
            error,
            output
          },
          monaco,
          model,
          addConsoleMessage,
          setCurrentArtifact
        );
        worker.terminate();
      };

      worker.onerror = (error) => {
        console.error('[CompilationService] Worker error details:', {
          message: error.message,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno
        });
        
        this.handleCompilationResult(
          {
            success: false,
            error: `Worker error: ${error.message} (${error.filename}:${error.lineno})`
          },
          monaco,
          model,
          addConsoleMessage,
          setCurrentArtifact
        );
        worker.terminate();
      };

      console.log('[CompilationService] Posting message to worker');
      worker.postMessage({
        sourceCode: code,
        sourcePath: 'main.sol'
      });

    } catch (error) {
      console.error('[CompilationService] Error creating/using worker:', error);
      addConsoleMessage(
        `Compilation error: ${error instanceof Error ? error.message : String(error)}`,
        "error"
      );
    }
  }

  private handleCompilationResult(
    result: CompilationResult,
    monaco: typeof import('monaco-editor'),
    model: monaco.editor.ITextModel,
    addConsoleMessage: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void,
    setCurrentArtifact: (artifact: any | null) => void
  ): void {
    const { markers, error, output } = result;

    if (error) {
      const errorMarker = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        message: error,
        severity: monaco.MarkerSeverity.Error
      };
      monaco.editor.setModelMarkers(model, 'solidity', [errorMarker]);
      addConsoleMessage(error, 'error');
      return;
    }

    if (markers && markers.length > 0) {
      const processedMarkers = markers.map(marker => ({
        ...marker,
        severity: marker.severity >= 8
          ? monaco.MarkerSeverity.Error
          : monaco.MarkerSeverity.Warning
      }));

      monaco.editor.setModelMarkers(model, 'solidity', processedMarkers);

      // Usar Set para mensajes únicos
      const uniqueMessages = new Set<string>();
      markers.forEach(marker => {
        const message = `[Line ${marker.startLineNumber}:${marker.startColumn}] ${marker.message}`;
        if (!uniqueMessages.has(message)) {
          uniqueMessages.add(message);
          addConsoleMessage(message, marker.severity >= 8 ? 'error' : 'warning');
        }
      });
    }

    if (output?.contracts) {
      const contractName = Object.keys(output.contracts['Compiled_Contracts'])[0];
      if (contractName) {
        const abi = output.contracts['Compiled_Contracts'][contractName].abi;
        const processedFunctions = this.processABI(abi);
        const newArtifact = {
          name: contractName,
          description: `Smart contract ${contractName} interface`,
          functions: processedFunctions,
          abi: abi
        };
        setCurrentArtifact(newArtifact);

        addConsoleMessage(`Contract "${contractName}" compiled successfully`, 'success');
      }
    }
  }

  private processABI(abi: any[]): any[] {
    return abi
      .filter(item => item.type === 'function')
      .map(item => {
        const funcForDescription = {
          name: item.name,
          description: '',
          type: item.type,
          stateMutability: item.stateMutability,
          inputs: item.inputs || [],
          outputs: item.outputs || []
        };

        return {
          name: item.name,
          description: this.generateFunctionDescription(funcForDescription),
          type: item.type,
          stateMutability: item.stateMutability,
          inputs: item.inputs.map((input: any) => ({
            name: input.name || 'value',
            type: input.type,
            description: `Input parameter of type ${input.type}`,
            components: input.components
          })),
          outputs: item.outputs?.map((output: any) => ({
            name: output.name || 'value',
            type: output.type,
            components: output.components
          }))
        };
      });
  }

  private generateFunctionDescription(func: any): string {
    const inputsDesc = func.inputs
      .map((input: any) => `${input.name} (${input.type})`)
      .join(', ');

    const outputsDesc = func.outputs && func.outputs.length > 0
      ? ` returns (${func.outputs.map((out: any) => `${out.name || 'value'} (${out.type})`).join(', ')})`
      : '';

    const mutability = func.stateMutability ? ` [${func.stateMutability}]` : '';

    return `${func.name}(${inputsDesc})${outputsDesc}${mutability}`;
  }
} 