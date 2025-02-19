import * as monaco from 'monaco-editor';
import { CompilationResult } from '../types/contracts';

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

    if (result.output?.artifact) {
      setCurrentArtifact(result.output.artifact);
      addConsoleMessage(
        `Contract ${result.output.artifact.name} compiled successfully`,
        'success'
      );
    }
  }



} 