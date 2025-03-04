/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TURSO_DATABASE_URL: string;
  readonly VITE_TURSO_AUTH_TOKEN: string;
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
  readonly VITE_COMPILER_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {}; 