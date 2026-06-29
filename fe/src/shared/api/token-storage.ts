export interface TokenStorage {
  getAccess(): string | null;
  getRefresh(): string | null;
  setTokens(access: string, refresh: string): void;
  clear(): void;
}

const ACCESS_KEY = 'hi.access';
const REFRESH_KEY = 'hi.refresh';

export const localStorageTokenStorage: TokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (access, refresh) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// единая точка свапа: в WebView подменим на нативный адаптер того же интерфейса
export const tokenStorage: TokenStorage = localStorageTokenStorage;
