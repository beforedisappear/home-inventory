interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_REFRESH_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
