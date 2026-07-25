import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';

export interface QrResponse {
  status: 'none' | 'pending' | 'ready' | 'failed';
  url: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- query key is opaque to this generic UI slice, only the entity-specific services care about it
export type QrQueryOptions<T> = UseQueryOptions<T, Error, T, any>;
export type QrMutationOptions<T> = UseMutationOptions<T, Error, string>;

export interface QrTriggerProps<T extends QrResponse> {
  entityId: string;
  qrQueryOptions: QrQueryOptions<T>;
  generateMutationOptions: QrMutationOptions<T>;
}
