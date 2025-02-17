import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { logger } from '../services/logger';

// Extender los matchers de Vitest con los de jest-dom
expect.extend(matchers as any);

// Mock de IndexedDB
const indexedDB = {
  open: vi.fn().mockReturnValue({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: {
      createObjectStore: vi.fn(),
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          put: vi.fn(),
          get: vi.fn(),
          getAll: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn()
        })
      })
    }
  })
};

global.indexedDB = indexedDB as any;

// Limpiar después de cada test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock de Worker
class MockWorker {
  url: string;
  onmessage: ((ev: MessageEvent) => any) | null;
  onerror: ((ev: ErrorEvent) => any) | null;
  private initialized: boolean = false;
  
  constructor(stringUrl: string) {
    this.url = stringUrl;
    this.onmessage = null;
    this.onerror = null;
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') this.onmessage = listener as any;
    if (type === 'error') this.onerror = listener as any;
  }

  removeEventListener(type: string, listener: EventListener) {
    if (type === 'message') this.onmessage = null;
    if (type === 'error') this.onerror = null;
  }

  postMessage(message: any) {
    if (!this.onmessage) return;

    setTimeout(() => {
      if (message.type === 'init') {
        this.initialized = true;
        const version = message.version?.default || '0.8.20';
        logger.info('SolcWorker', 'Worker initialized successfully', { version });
        this.onmessage?.({
          data: { type: 'ready', status: true, version }
        } as MessageEvent);
      } else if (message.type === 'compile') {
        if (!this.initialized) {
          logger.error('SolcWorker', 'Worker not initialized');
          if (this.onerror) {
            this.onerror(new ErrorEvent('error', {
              message: 'Worker not initialized',
              filename: this.url,
              lineno: 1,
              colno: 1
            }));
          }
          return;
        }

        // Verificar si el código incluye importaciones de OpenZeppelin
        if (message.sourceCode?.includes('@openzeppelin')) {
          // Asegurarse de que el log se genere antes de la compilación
          logger.info('SolcWorker', 'Processing OpenZeppelin import', {
            path: '@openzeppelin/contracts/token/ERC20/ERC20.sol'
          });

          // Simular la compilación exitosa con OpenZeppelin
          this.onmessage?.({
            data: {
              type: 'out',
              output: {
                contracts: {
                  'Compiled_Contracts': {
                    'MyToken': {
                      abi: [{
                        type: 'constructor',
                        inputs: [
                          { name: 'name_', type: 'string' },
                          { name: 'symbol_', type: 'string' }
                        ],
                        stateMutability: 'nonpayable'
                      }],
                      evm: { 
                        bytecode: { object: '0x' },
                        methodIdentifiers: {
                          'name()': '06fdde03',
                          'symbol()': '95d89b41'
                        }
                      }
                    }
                  }
                }
              }
            }
          } as MessageEvent);
        } else {
          logger.info('SolcWorker', 'Compiling contract without imports');
          this.onmessage?.({
            data: {
              type: 'out',
              output: {
                contracts: {
                  'Compiled_Contracts': {
                    'Test': {
                      abi: [],
                      evm: { bytecode: { object: '0x' } }
                    }
                  }
                }
              }
            }
          } as MessageEvent);
        }
      }
    }, 0);
  }

  terminate() {
    this.onmessage = null;
    this.onerror = null;
    this.initialized = false;
  }
}

// Mock global de Worker
global.Worker = MockWorker as any;

// Mock de XMLHttpRequest para las importaciones de OpenZeppelin
class MockXMLHttpRequest {
  status: number = 200;
  responseText: string = '';
  statusText: string = 'OK';
  readyState: number = 0;
  onreadystatechange: ((ev: Event) => any) | null = null;

  open(method: string, url: string, async: boolean = true) {
    if (url.includes('@openzeppelin')) {
      this.responseText = `
        // SPDX-License-Identifier: MIT
        pragma solidity ^0.8.0;
        
        contract ERC20 {
          string private _name;
          string private _symbol;
          
          constructor(string memory name_, string memory symbol_) {
            _name = name_;
            _symbol = symbol_;
          }
          
          function name() public view returns (string memory) {
            return _name;
          }
          
          function symbol() public view returns (string memory) {
            return _symbol;
          }
        }
      `;
    }
  }

  send() {
    setTimeout(() => {
      if (this.onreadystatechange) {
        this.readyState = 4;
        this.status = 200;
        const event = new Event('readystatechange');
        this.onreadystatechange(event);
      }
    }, 0);
  }
}

global.XMLHttpRequest = MockXMLHttpRequest as any;

// Mock de URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');

// Mock de process.env para el entorno
process.env.NODE_ENV = 'test'; 