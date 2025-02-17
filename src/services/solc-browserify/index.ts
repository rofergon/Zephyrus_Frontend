import { CompilerEvent, ImportCallbackFn } from "./browser.solidity.worker";
import { _version } from "./constant";
import { CompilerHelpers } from "./helpers";
import { _Worker } from "./worker";

export type CallbackFn = (Solc: Solc) => any;
export type CompilerOutput<T = any, U = any> = {
  contracts?: T;
  errors?: CompilerError[];
  sources?: U;
};
export type CompilerError = {
  component: string;
  errorCode: string;
  formattedMessage: string;
  message: string;
  severity: string;
  sourceLocation: SourceLocation;
  type: string;
};

export type SourceLocation = {
  end: number;
  file: string;
  start: number;
};

/**
 * instantiate this as soon as possible so that the WebWoker can initialize the compiler
 * and is ready for compilation when needed.
 */
export class Solc {
  private worker: Worker;
  callback: CallbackFn | undefined;

  /**
   * instantiate this as soon as possible so that the WebWoker can initialize the compiler
   * and is ready for compilation when needed.
   */
  constructor(callback?: CallbackFn) {
    this.callback = callback;
    this.worker = this.createCompilerWebWorker();
    this.onready();
    this.initWorker();
  }

  private onready() {
    this.worker.onmessage = (_event) => {
      const event: CompilerEvent = _event.data as any;

      if (this.callback === undefined) {
        return;
      }

      if (event.type === "ready") {
        this.callback(this);
      }
    };
  }

  private initWorker() {
    const event: CompilerEvent = {
      type: "init",
      version: _version,
    };

    this.worker.postMessage(event);
  }

  /**
   *
   * @param contract contract body
   * @param importCallback import callback function, currently does not support arrow function and closures. only support synchronous function.
   * ```javascript
   * // this is not supported
   * const resolveDeps = (path) =>{
   * // ... some code
   * }
   *
   * // this is supported
   * function resolveDeps(path) {
   * // ... some code
   * }
   *
   * // this is supported
   * const resolveDeps = function (path) =>{
   * // ... some code
   * }
   * ```
   */
  public async compile(
    input: string | any,
    importCallback?: ImportCallbackFn
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[Solc] Creating compile input...');
        const inputString = typeof input === 'string' ? input : JSON.stringify(input);
        console.log('[Solc] Compile input:', inputString);

        // Create a message handler for compilation result
        const messageHandler = (event: MessageEvent) => {
          const response = event.data;
          console.log('[Solc] Received compilation response:', response);

          if (response.type === 'out') {
            try {
              const parsedOutput = typeof response.output === 'string' ? JSON.parse(response.output) : response.output;
              console.log('[Solc] Parsed compilation output:', parsedOutput);
              
              if (parsedOutput.errors) {
                console.log('[Solc] Compilation errors:', JSON.stringify(parsedOutput.errors, null, 2));
              }
              
              this.worker.removeEventListener('message', messageHandler);
              resolve(parsedOutput);
            } catch (error) {
              console.error('[Solc] Error parsing compilation output:', error);
              this.worker.removeEventListener('message', messageHandler);
              reject(error);
            }
          } else if (response.type === 'error') {
            console.error('[Solc] Compilation error:', response.error);
            this.worker.removeEventListener('message', messageHandler);
            reject(new Error(response.error));
          }
        };

        this.worker.addEventListener('message', messageHandler);

        // Send compilation request with the correct format
        console.log('[Solc] Sending compilation request...');
        this.worker.postMessage({
          type: 'compile',
          compilerInput: inputString,
          importCallback: importCallback ? importCallback.toString() : undefined
        });
      } catch (error) {
        console.error('[Solc] Compilation error:', error);
        reject(error);
      }
    });
  }

  private createCompilerWebWorker() {
    return new Worker(
      URL.createObjectURL(new Blob([`(new ${_Worker})`], { type: "module" }))
    );
  }
} 