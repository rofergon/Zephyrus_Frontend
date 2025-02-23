// worker cannot import modules directly using require or import statements. because we activate the worker using inline blob method.
// worker should use imporScripts instead.
declare global {
  interface Worker {
    Module: any;
    solc: any;
    wrapper: any;
  }
  
  function importScripts(...urls: string[]): void;
}

export type FnString = {
  name: string;
  args: string;
  body: string;
};

export type ImportCallbackReturnType = { contents: string } | { error: string };
export type ImportCallbackFn = (path: string) => ImportCallbackReturnType;

export type CompilerEvent =
  | {
      type: "compile";
      compilerInput: any;
      /**
       * MUST be a pure function and not a closure to avoid reference errors.
       */
      importCallback?: FnString;
    }
  | {
      type: "init";
      version: Version;
    }
  | {
      type: "ready";
      status: boolean;
    }
  | {
      type: "out";
      output: any;
    };

export type Version = {
  default: string;
};

type GetVersionResponse = {
  builds: any[];
  releases: any;
  latestRelease: string;
};

export class Compiler {
  private readonly ctx: Worker;
  private solc: any;

  constructor() {
    this.ctx = self as any;
    this.registerMessageHandler();
  }

  private init(version: Version) {
    const buildVersion = this.getVersionScript(version);

    // must import the soljson binary first then the solc bundler will wrap the binary and emit a solc global window.
    // IMPORTANT : the bundler is actually just `solc/wrapper` bundled together with browserify
    // because of that, the bundler version and the binary version must match!

    // will emit global `Module`
    importScripts(`https://binaries.soliditylang.org/bin/${buildVersion}`);
    // will emit global `wrapper`
    importScripts(
      `https://unpkg.com/solc-wrapper-bundle@${version.default}/dist/bundle.js`
    );
    const wrapper = this.ctx.wrapper;
    const module = this.ctx.Module;

    this.solc = wrapper(module);
    this.ready();
  }

  private ready() {
    const event: CompilerEvent = {
      type: "ready",
      status: true,
    };

    this.ctx.postMessage(event);
  }

  private getVersionScript(version: Version) {
    const api = new XMLHttpRequest();
    api.open("GET", "https://binaries.soliditylang.org/bin/list.json", false);
    api.send(null);

    const response: GetVersionResponse = JSON.parse(api.response);

    return response.releases[version.default];
  }

  private registerMessageHandler() {
    this.ctx.onmessage = (event: MessageEvent<CompilerEvent>) => {
      switch (event.data.type) {
        case "compile":
          this.compile(event.data.compilerInput, event.data.importCallback);
          break;

        case "init":
          this.init(event.data.version);
          break;

        default:
          console.log("invalid message type: " + event.data);
      }
    };
  }

  private compile(input: any, fn?: FnString) {
    let output;

    if (fn === undefined) {
      output = this.solc.compile(input);
    } else {
      const callback = this.constructFn(fn);
      output = this.solc.compile(input, { import: callback });
    }
    const event: CompilerEvent = { type: "out", output };
    this.ctx.postMessage(event);
  }

  private constructFn(fn: FnString) {
    return new Function(fn.args, fn.body);
  }
} 