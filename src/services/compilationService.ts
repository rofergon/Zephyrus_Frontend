import { CompilationResult } from '../types/contracts';
import * as monaco from 'monaco-editor';

export class CompilationService {
  private static instance: CompilationService;
  private workerUrl: string;
  private worker: Worker | null = null;

  private constructor() {
    this.workerUrl = new URL('../workers/solc.worker.js', import.meta.url).toString();
    console.log('[CompilationService] Worker URL:', this.workerUrl);
  }

  private async initWorker(): Promise<Worker> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('[CompilationService] Initializing worker...');
        const worker = new Worker(this.workerUrl, { 
          type: 'module',
          name: 'solidity-compiler-worker'
        });

        worker.onerror = (error) => {
          const errorDetails = {
            message: error.message,
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno
          };
          console.error('[CompilationService] Worker initialization error:', errorDetails);
          reject(new Error(error.message || 'Worker initialization failed'));
        };

        worker.onmessage = (event) => {
          const { type, success, error } = event.data;
          
          if (type === 'init') {
            if (success) {
              console.log('[CompilationService] Worker initialized successfully');
              resolve(worker);
            } else {
              console.error('[CompilationService] Worker initialization failed:', error);
              reject(new Error(error || 'Worker initialization failed'));
            }
          }
        };

        const version = { default: import.meta.env.SOLC_VERSION || '0.8.17' };
        // Send init message to worker with version information
        worker.postMessage({ type: 'init', version });
        this.worker = worker;

      } catch (error) {
        console.error('[CompilationService] Failed to create worker:', error);
        reject(error);
      }
    });
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

    try {
      console.log('[CompilationService] Attempting to create worker...');
      const worker = await this.initWorker();
      console.log('[CompilationService] Worker created successfully');

      return new Promise((resolve, reject) => {
        if (!worker) {
          reject(new Error('Worker initialization failed'));
          return;
        }

        const messageHandler = (event: MessageEvent) => {
          const { type, markers, error, output } = event.data;
          
          if (type === 'result') {
            console.log('[CompilationService] Received compilation result');
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
            worker.removeEventListener('message', messageHandler);
            worker.terminate();
            resolve();
          }
        };

        const errorHandler = (error: ErrorEvent) => {
          console.error('[CompilationService] Worker error:', {
            message: error.message,
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno
          });
          
          this.handleCompilationResult(
            {
              success: false,
              error: `Worker error: ${error.message || 'Unknown error'}. Check console for details.`
            },
            monaco,
            model,
            addConsoleMessage,
            setCurrentArtifact
          );
          worker.removeEventListener('message', messageHandler);
          worker.removeEventListener('error', errorHandler);
          worker.terminate();
          reject(error);
        };

        worker.addEventListener('message', messageHandler);
        worker.addEventListener('error', errorHandler);

        console.log('[CompilationService] Posting message to worker...');
        worker.postMessage({
          type: 'compile',
          sourceCode: code,
          sourcePath: 'main.sol'
        });
      });

    } catch (error) {
      console.error('[CompilationService] Compilation initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addConsoleMessage(
        `Failed to initialize compiler: ${errorMessage}. Please check if you're using a modern browser with Web Workers support.`,
        "error"
      );
      
      // Set error marker in editor
      const errorMarker = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        message: `Compiler initialization failed: ${errorMessage}`,
        severity: monaco.MarkerSeverity.Error
      };
      monaco.editor.setModelMarkers(model, 'solidity', [errorMarker]);
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