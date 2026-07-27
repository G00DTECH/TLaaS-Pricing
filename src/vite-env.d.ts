/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REP_PASSPHRASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
