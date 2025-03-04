// This file sets up the test environment for all tests

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Automatically cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock indexedDB
const indexedDBMock = {
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
          clear: vi.fn(),
          index: vi.fn().mockReturnValue({
            get: vi.fn(),
            getAll: vi.fn()
          })
        }),
        oncomplete: null,
        onerror: null
      })
    }
  })
};

// Set up setTimeout trigger for callbacks
const triggerIndexedDBCallbacks = () => {
  const openRequest = indexedDBMock.open();
  if (openRequest.onsuccess) {
    openRequest.onsuccess(new Event('success'));
  }
};

global.indexedDB = indexedDBMock as any;
global.triggerIndexedDBCallbacks = triggerIndexedDBCallbacks;

// Mock window properties that might not be available in test environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock HTML Canvas methods that might be used in the app
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(() => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  stroke: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  createLinearGradient: vi.fn().mockImplementation(() => ({
    addColorStop: vi.fn()
  })),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn().mockImplementation(() => ({ width: 100 }))
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock Custom Event since it's used for communication between components
global.CustomEvent = class CustomEvent extends Event {
  detail: any;
  constructor(type: string, options?: CustomEventInit) {
    super(type, options);
    this.detail = options?.detail || null;
  }
};

// Mock local storage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Silence console errors and warnings during tests
// but keep them available for debugging if needed
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = vi.fn((...args) => {
  if (process.env.DEBUG) {
    originalConsoleError(...args);
  }
});

console.warn = vi.fn((...args) => {
  if (process.env.DEBUG) {
    originalConsoleWarn(...args);
  }
});

console.log = vi.fn((...args) => {
  if (process.env.DEBUG) {
    originalConsoleLog(...args);
  }
}); 