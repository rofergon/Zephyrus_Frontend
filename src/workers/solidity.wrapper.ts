import { Solc } from '../services/solc-browserify';

export class SolidityCompiler {
  private compiler: Solc | null = null;
  private readyCallback: (() => void) | null = null;

  constructor() {
    this.compiler = new Solc((solc) => {
      if (this.readyCallback) {
        this.readyCallback();
      }
    });
  }

  onReady(callback: () => void) {
    this.readyCallback = callback;
  }

  async compile(sourceCode: string, importCallback?: (path: string) => { contents: string } | { error: string }) {
    if (!this.compiler) {
      throw new Error('Compiler not initialized');
    }
    return this.compiler.compile(sourceCode, importCallback);
  }
} 