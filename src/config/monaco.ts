import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

export function configureMonaco() {
  try {
    if (typeof window !== 'undefined') {
      // @ts-ignore
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

      // Ensure monaco namespace is available
      if (monaco && monaco.languages) {
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
      }
    }
  } catch (error) {
    console.error('[Monaco Config] Error configuring Monaco:', error);
  }
} 