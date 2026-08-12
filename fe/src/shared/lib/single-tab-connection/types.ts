export interface SingleTabConnectionOptions<T> {
  name: string;
  connect: (emit: (event: T) => void, signal: AbortSignal) => Promise<void>;
}

export interface SingleTabConnection<T> {
  subscribe: (listener: (event: T) => void) => () => void;
}
