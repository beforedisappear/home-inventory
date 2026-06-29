interface Env {
  apiUrl: string;
  refreshPath: string;
  isDev: boolean;
}

export const env: Env = {
  apiUrl: import.meta.env.VITE_API_URL,
  refreshPath: import.meta.env.VITE_API_REFRESH_PATH,
  isDev: import.meta.env.DEV,
};
