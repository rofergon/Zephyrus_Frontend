/// <reference types="vitest" />
/// <reference types="vite/client" />

interface Window {
  Worker: typeof Worker;
  XMLHttpRequest: typeof XMLHttpRequest;
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
  }
}

declare module '*.sol' {
  const content: string;
  export default content;
}

declare module '@testing-library/jest-dom/matchers' {
  import { expect } from 'vitest';
  const matchers: Record<string, any>;
  export default matchers;
} 