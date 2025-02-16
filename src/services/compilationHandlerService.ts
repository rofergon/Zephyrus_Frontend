import * as monaco from 'monaco-editor';
import { ContractArtifact, CompilationResult } from '../types/contracts';
import { processABI } from '../utils/contractUtils';

export class CompilationHandlerService {
  private static instance: CompilationHandlerService;

  private constructor() {}

  public static getInstance(): CompilationHandlerService {
    if (!CompilationHandlerService.instance) {
      CompilationHandlerService.instance = new CompilationHandlerService();
    }
    return CompilationHandlerService.instance;
  }

  public handleCompilationResult(
    result: CompilationResult,
    monaco: typeof import('monaco-editor'),
    model: monaco.editor.ITextModel,
    addConsoleMessage: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void,
    setCurrentArtifact: (artifact: ContractArtifact | null) => void
  ): void {
    const { markers, error, output } = result;
    
    // Limpiar marcadores anteriores
    monaco.editor.setModelMarkers(model, 'solidity', []);
    
    if (error) {
      this.handleError(error, monaco, model, addConsoleMessage);
      return;
    }

    if (markers && markers.length > 0) {
      this.handleMarkers(markers, monaco, model, addConsoleMessage);
    }

    if (output?.contracts) {
      this.handleSuccessfulCompilation(output, addConsoleMessage, setCurrentArtifact);
    }
  }

  private handleError(
    error: string,
    monaco: typeof import('monaco-editor'),
    model: monaco.editor.ITextModel,
    addConsoleMessage: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void
  ): void {
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
  }

  private handleMarkers(
    markers: any[],
    monaco: typeof import('monaco-editor'),
    model: monaco.editor.ITextModel,
    addConsoleMessage: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void
  ): void {
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

  private handleSuccessfulCompilation(
    output: any,
    addConsoleMessage: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void,
    setCurrentArtifact: (artifact: ContractArtifact | null) => void
  ): void {
    const contractName = Object.keys(output.contracts['Compiled_Contracts'])[0];
    if (contractName) {
      const abi = output.contracts['Compiled_Contracts'][contractName].abi;
      const processedFunctions = processABI(abi);
      const newArtifact: ContractArtifact = {
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