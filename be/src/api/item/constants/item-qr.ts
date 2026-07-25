export const ITEM_QR_PAYLOAD_PREFIX = 'i:';

export const ITEM_QR_MIME = 'image/svg+xml';

export const ITEM_QR_EXT = '.svg';

export const itemQrStorageKey = (ownerId: string, itemId: string): string =>
  `users/${ownerId}/qr/item/${itemId}${ITEM_QR_EXT}`;
