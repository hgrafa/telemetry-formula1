/// <reference types="vite/client" />

/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_LOCAL_IP: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
