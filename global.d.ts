/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_GITHUB_TOKEN?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
