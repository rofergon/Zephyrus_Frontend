import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CompilationService } from '../services/compilationService';
import { logger } from '../services/logger';

describe('Solidity Compiler Worker Tests', () => {
  let compilationService: CompilationService;

  beforeEach(() => {
    compilationService = CompilationService.getInstance();
    logger.clearLogs();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize worker correctly', async () => {
    const worker = await compilationService['initWorker']();
    expect(worker).toBeDefined();
    
    const workerLogs = logger.getLogsByContext('CompilationService');
    expect(workerLogs.some(log => 
      log.message.includes('Initializing worker')
    )).toBeTruthy();
  });

  it('should handle worker initialization errors', async () => {
    // Mock error event
    const mockError = new ErrorEvent('error', {
      message: 'Worker initialization failed',
      filename: 'test.js',
      lineno: 1,
      colno: 1
    });

    setTimeout(() => {
      const worker = compilationService['worker'];
      if (worker?.onerror) {
        worker.onerror(mockError);
      }
    }, 0);

    try {
      await compilationService['initWorker']();
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).toBe('Worker initialization failed');
      const errorLogs = logger.getLogsByLevel('error');
      expect(errorLogs.some(log => 
        log.message.includes('Worker initialization error')
      )).toBeTruthy();
    }
  });

  it('should compile simple contract successfully', async () => {
    const simpleContract = `
      pragma solidity ^0.8.0;
      contract Test {
        uint256 public value;
        function setValue(uint256 _value) public {
          value = _value;
        }
      }
    `;

    const addConsoleMessage = vi.fn();
    const setCurrentArtifact = vi.fn();
    const mockMonaco = {
      editor: {
        setModelMarkers: vi.fn(),
      },
      MarkerSeverity: {
        Error: 8,
        Warning: 4,
        Info: 2,
        Hint: 1,
      },
    };
    const mockModel = {};

    await compilationService.compileCode(
      simpleContract,
      mockMonaco as any,
      mockModel as any,
      addConsoleMessage,
      setCurrentArtifact
    );

    const compilationLogs = logger.getLogsByContext('CompilationService');
    expect(compilationLogs.some(log => 
      log.message.includes('Compilation successful')
    )).toBeTruthy();

    expect(setCurrentArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: expect.any(Object)
      })
    );
  });

  it('should handle compilation errors', async () => {
    const invalidContract = `
      pragma solidity ^0.8.0;
      contract Test {
        function invalidFunction() public {
          uint256 = 123; // Invalid syntax
        }
      }
    `;

    const addConsoleMessage = vi.fn();
    const setCurrentArtifact = vi.fn();
    const mockMonaco = {
      editor: {
        setModelMarkers: vi.fn(),
      },
      MarkerSeverity: {
        Error: 8,
      },
    };
    const mockModel = {};

    // Mock error response
    vi.spyOn(global.Worker.prototype, 'postMessage').mockImplementation(function(this: any) {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            data: {
              type: 'error',
              error: 'Compilation failed: Invalid syntax',
              markers: [{
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: 1,
                endColumn: 1,
                message: 'Invalid syntax',
                severity: 8
              }]
            }
          });
        }
      }, 0);
    });

    await compilationService.compileCode(
      invalidContract,
      mockMonaco as any,
      mockModel as any,
      addConsoleMessage,
      setCurrentArtifact
    );

    expect(addConsoleMessage).toHaveBeenCalledWith(
      expect.stringContaining('Invalid syntax'),
      'error'
    );
  });

  it('should handle OpenZeppelin imports', async () => {
    const contractWithImport = `
      pragma solidity ^0.8.0;
      import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
      
      contract MyToken is ERC20 {
        constructor() ERC20("MyToken", "MTK") {}
      }
    `;

    const addConsoleMessage = vi.fn();
    const setCurrentArtifact = vi.fn();
    const mockMonaco = {
      editor: {
        setModelMarkers: vi.fn(),
      },
      MarkerSeverity: {
        Error: 8,
      },
    };
    const mockModel = {};

    // Limpiar logs antes del test
    logger.clearLogs();

    // Simular el proceso de compilación
    await compilationService.compileCode(
      contractWithImport,
      mockMonaco as any,
      mockModel as any,
      addConsoleMessage,
      setCurrentArtifact
    );

    // Verificar que se procesaron las importaciones de OpenZeppelin
    const compilationLogs = logger.getLogsByContext('SolcWorker');
    expect(compilationLogs.some(log => 
      log.message.includes('Processing OpenZeppelin import')
    )).toBeTruthy();

    // Verificar que se compiló correctamente
    expect(setCurrentArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: expect.any(Object)
      })
    );
  });
}); 