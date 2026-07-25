export const CONTAINER_QR_PAYLOAD_PREFIX = 'c:';

export const CONTAINER_QR_MIME = 'image/svg+xml';

export const CONTAINER_QR_EXT = '.svg';

export const containerQrStorageKey = (
  ownerId: string,
  containerId: string,
): string => `users/${ownerId}/qr/container/${containerId}${CONTAINER_QR_EXT}`;
