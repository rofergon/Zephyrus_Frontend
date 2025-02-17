import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

let isInitialized = false;

export function configureMonaco() {
  if (isInitialized) return;

  try {
    if (typeof window === 'undefined') return;

    // Configure workers
    window.MonacoEnvironment = {
      getWorker(_, label) {
        switch (label) {
          case 'json':
            return new jsonWorker();
          case 'typescript':
          case 'javascript':
            return new tsWorker();
          default:
            return new editorWorker();
        }
      }
    };

    // Wait for monaco to be fully loaded
    if (!monaco || !monaco.editor || !monaco.languages) {
      console.warn('[Monaco Config] Monaco not fully loaded yet, retrying in 100ms...');
      setTimeout(configureMonaco, 100);
      return;
    }

    // Configure Monaco Editor settings
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false
    });

    // Register Solidity language if not already registered
    if (!monaco.languages.getLanguages().some(lang => lang.id === 'solidity')) {
      monaco.languages.register({ id: 'solidity' });
      monaco.languages.setMonarchTokensProvider('solidity', {
        tokenizer: {
          root: [
            [/[a-zA-Z_]\w*/, 'identifier'],
            [/[=><!~?:&|+\-*\/\^%]+/, 'operator'],
            [/\d+/, 'number'],
            [/".*?"/, 'string'],
            [/\/\/.*$/, 'comment'],
            [/\/\*/, 'comment', '@comment'],
          ],
          comment: [
            [/[^/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/[/*]/, 'comment']
          ]
        }
      });
    }

    isInitialized = true;
    console.log('[Monaco Config] Monaco successfully configured');
  } catch (error) {
    console.error('[Monaco Config] Error configuring Monaco:', error);
    // Retry configuration after a delay
    setTimeout(configureMonaco, 100);
  }
}

// Pre-load Monaco
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    configureMonaco();
  });
} 