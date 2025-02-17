import { CompilationResult } from '../types/contracts';
import * as monaco from 'monaco-editor';
import { logger } from './logger';

export class CompilationService {
  private static instance: CompilationService;
  private workerUrl: string;
  private worker: Worker | null = null;

  private constructor() {
    this.workerUrl = new URL('../workers/solc.worker.js', import.meta.url).toString();
    logger.info('CompilationService', 'Service initialized', { workerUrl: this.workerUrl });
  }

  private async initWorker(): Promise<Worker> {
    if (this.worker) {
      logger.debug('CompilationService', 'Terminating existing worker');
      this.worker.terminate();
      this.worker = null;
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info('CompilationService', 'Initializing worker...');
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
          logger.error('CompilationService', 'Worker initialization error', errorDetails);
          reject(new Error(error.message || 'Worker initialization failed'));
        };

        worker.onmessage = (event) => {
          const { type, status, error } = event.data;

          if (type === 'ready' && status === true) {
            logger.info('CompilationService', 'Worker initialized successfully');
            resolve(worker);
          } else if (type === 'error') {
            logger.error('CompilationService', 'Worker initialization failed', { error });
            reject(new Error(error || 'Worker initialization failed'));
          }
        };

        const version = { default: (import.meta as any).env.SOLC_VERSION || '0.8.20' };
        logger.debug('CompilationService', 'Sending init message to worker', { version });
        worker.postMessage({ type: 'init', version });
        this.worker = worker;

      } catch (error) {
        logger.error('CompilationService', 'Failed to create worker', { error });
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
    if (!code) {
      logger.warn('CompilationService', 'Empty code provided for compilation');
      return;
    }

    let worker: Worker;
    try {
      logger.info('CompilationService', 'Starting compilation process');
      worker = await this.initWorker();

      return new Promise((resolve, reject) => {
        if (!worker) {
          const error = new Error('Worker not initialized');
          logger.error('CompilationService', 'Worker not initialized');
          reject(error);
          return;
        }

        const messageHandler = (event: MessageEvent) => {
          const { type, output, error, markers } = event.data;

          if (type === 'out') {
            logger.info('CompilationService', 'Compilation successful', { output });
            
            if (output.errors) {
              output.errors.forEach((error: any) => {
                logger.warn('CompilationService', 'Compilation warning/error', { error });
              });
            }

            this.handleCompilationResult(
              { success: true, result: output },
              monaco,
              model,
              addConsoleMessage,
              setCurrentArtifact
            );
            resolve();
          } else if (type === 'error') {
            logger.error('CompilationService', 'Compilation error', { error, markers });
            this.handleCompilationResult(
              { success: false, error },
              monaco,
              model,
              addConsoleMessage,
              setCurrentArtifact
            );
            resolve();
          }
        };

        const errorHandler = (error: ErrorEvent) => {
          logger.error('CompilationService', 'Worker error', {
            message: error.message,
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno
          });
          
          this.handleCompilationResult(
            {
              success: false,
              error: `Worker error: ${error.message || 'Unknown error'}`
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

        logger.debug('CompilationService', 'Sending compilation request to worker', {
          codeLength: code.length
        });
        
        worker.postMessage({
          type: 'compile',
          sourceCode: code,
          sourcePath: 'main.sol'
        });
      });

    } catch (error) {
      logger.error('CompilationService', 'Compilation initialization error', { error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      addConsoleMessage(
        `Failed to initialize compiler: ${errorMessage}. Please check if you're using a modern browser with Web Workers support.`,
        "error"
      );
      
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
    result: { success: boolean; result?: any; error?: string },
    monaco: typeof import('monaco-editor'),
    model: monaco.editor.ITextModel,
    addConsoleMessage: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void,
    setCurrentArtifact: (artifact: any | null) => void
  ): void {
    if (result.success && result.result) {
      logger.info('CompilationService', 'Processing successful compilation result');
      // Process successful compilation
      const output = result.result;
      const markers: monaco.editor.IMarker[] = [];
      
      if (output.errors) {
        output.errors.forEach((error: any) => {
          logger.warn('CompilationService', 'Processing compilation warning/error', { error });
          // Process error/warning markers...
        });
      }

      // Update markers and artifacts
      monaco.editor.setModelMarkers(model, 'solidity', markers);
      setCurrentArtifact(output);
      addConsoleMessage('Compilation successful', 'success');
      
    } else if (!result.success) {
      logger.error('CompilationService', 'Processing compilation error', { error: result.error });
      // Process compilation error
      const errorMarker = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        message: result.error || 'Unknown compilation error',
        severity: monaco.MarkerSeverity.Error
      };
      
      monaco.editor.setModelMarkers(model, 'solidity', [errorMarker]);
      setCurrentArtifact(null);
      addConsoleMessage(result.error || 'Compilation failed', 'error');
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