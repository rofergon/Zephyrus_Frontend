import { CompilationResult } from '../types/contracts';
import * as monaco from 'monaco-editor';

export class CompilationService {
  private static instance: CompilationService;
  private apiUrl: string;

  private constructor() {
    // Use environment variable for API URL with fallback
    this.apiUrl = (import.meta as any).env.VITE_COMPILER_API_URL || 'http://localhost:3000/api/compile';
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

      // Extract the source code for just this contract
      let relevantCode = code;
      if (mainContract && mainContract.index !== undefined) {
        const startIndex = mainContract.index;
        let endIndex = code.length;
        let braceCount = 0;
        let inString = false;
        let stringChar = '';

        // Find the matching closing brace for this contract
        for (let i = startIndex; i < code.length; i++) {
          const char = code[i];
          if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
            else if (char === '"' || char === "'") {
              inString = true;
              stringChar = char;
            }
          } else if (char === stringChar && code[i - 1] !== '\\') {
            inString = false;
          }
        }
        relevantCode = code.substring(startIndex, endIndex);
      }

      // Double-check the contract name in the relevant code
      const finalNameMatch = relevantCode.match(/\bcontract\s+(\w+)/);
      if (finalNameMatch && finalNameMatch[1]) {
        contractName = finalNameMatch[1];
        console.log('[CompilationService] Final contract name:', contractName);
      }

      // Get Solidity version from pragma
      const pragmaMatch = code.match(/pragma\s+solidity\s+(\^?\d+\.\d+\.\d+)/);
      const solidityVersion = pragmaMatch ? pragmaMatch[1].replace('^', '') : '0.8.20';

      console.log('[CompilationService] Sending compilation request...');
      const requestBody = {
        contractName: contractName,
        sourceCode: code,
        version: solidityVersion,
        mainContractCode: relevantCode
      };
      
      console.log('[CompilationService] API Request:', {
        url: this.apiUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          ...requestBody,
          sourceCode: `${code.substring(0, 100)}... (${code.length} chars)` // Truncate for logging
        }
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          throw new Error(`Compilation failed: ${response.status} - ${errorJson.error}${errorJson.details ? ': ' + errorJson.details : ''}`);
        } catch (e) {
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
      addConsoleMessage(
        `Compilation failed: ${errorMessage}`,
        "error"
      );
      
      // Set error marker in editor
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

      // Use Set for unique messages
      const uniqueMessages = new Set<string>();
      markers.forEach(marker => {
        const message = `[Line ${marker.startLineNumber}:${marker.startColumn}] ${marker.message}`;
        if (!uniqueMessages.has(message)) {
          uniqueMessages.add(message);
          addConsoleMessage(message, marker.severity >= 8 ? 'error' : 'warning');
        }
      });
    }

    if (output?.artifact?.abi) {
      try {
        const processedFunctions = this.processABI(output.artifact.abi);
        const contractName = output.artifact.name || 'Contract';
        const newArtifact = {
          name: contractName,
          description: `Smart contract ${contractName} interface`,
          functions: processedFunctions,
          abi: output.artifact.abi
        };
        setCurrentArtifact(newArtifact);
        addConsoleMessage(`Contract "${contractName}" compiled successfully`, 'success');
      } catch (error) {
        console.error('[CompilationService] Error processing compilation output:', error);
        addConsoleMessage(`Error processing compilation output: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }
  }

  private processABI(abi: any[]): any[] {
    return abi
      .filter(item => item.type === 'function' || item.type === 'constructor')
      .map(item => {
        // Para constructores, crear una descripción especial
        if (item.type === 'constructor') {
          return {
            name: 'constructor',
            description: 'Contract constructor',
            type: 'constructor',
            stateMutability: item.stateMutability || 'nonpayable',
            inputs: item.inputs?.map((input: any) => ({
              name: input.name || 'value',
              type: input.type,
              description: `Constructor parameter of type ${input.type}`,
              components: input.components
            })) || [],
            outputs: []
          };
        }

        // Para funciones regulares
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
          inputs: item.inputs?.map((input: any) => ({
            name: input.name || 'value',
            type: input.type,
            description: `Input parameter of type ${input.type}`,
            components: input.components
          })) || [],
          outputs: item.outputs?.map((output: any) => ({
            name: output.name || 'value',
            type: output.type,
            components: output.components
          })) || []
        };
      })
      .filter(item => item !== null); // Filtrar cualquier resultado nulo
  }

  private generateFunctionDescription(func: any): string {
    const inputsDesc = func.inputs
      .map((input: any) => `${input.name || 'value'} (${input.type})`)
      .join(', ');

    const outputsDesc = func.outputs && func.outputs.length > 0
      ? ` returns (${func.outputs.map((out: any) => `${out.name || 'value'} (${out.type})`).join(', ')})`
      : '';

    const mutability = func.stateMutability ? ` [${func.stateMutability}]` : '';
    
    // Generar una descripción más detallada basada en el tipo de función
    let description = `${func.name}(${inputsDesc})${outputsDesc}${mutability}`;
    
    // Añadir información adicional basada en la mutabilidad
    if (func.stateMutability === 'view') {
      description += ' - Read-only function that does not modify the contract state';
    } else if (func.stateMutability === 'pure') {
      description += ' - Pure function that neither reads from nor modifies the contract state';
    } else if (func.stateMutability === 'payable') {
      description += ' - Function that can receive Ether';
    } else if (func.stateMutability === 'nonpayable') {
      description += ' - Function that modifies the contract state';
    }

    return description;
  }
} 